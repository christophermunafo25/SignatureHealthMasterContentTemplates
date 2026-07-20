# Architecture

A multi-tenant, self-service brand template portal. Marketing admins build
locked templates once; everyone else fills in fields and downloads on-brand
graphics. The core design principle is **subtraction**: the only thing an end
user can change is the content of the fields the admin defined.

## Stack

- **Client**: React 18 + Vite + Tailwind v4 (Figma Make export conventions kept).
  Pure SPA — no custom server.
- **Backend**: Supabase (Postgres + Storage + Edge Functions) as BaaS.
- **Dev fallback**: with no `VITE_SUPABASE_URL` set, the app runs on a
  localStorage backend behind the same store interfaces — zero setup, same UI
  code paths. The switcher chip in the header shows which backend is active.

## Layers

```
src/lib/types.ts            Domain types (TemplateSchema, BrandKit, …)
src/lib/stores/             Data layer — components import ONLY these interfaces
  interfaces.ts               CompanyStore, TemplateStore, BrandKitStore,
                              BrandAssetStore, LocationStore, UsageStore,
                              DesignImportProvider
  supabase/                   Supabase implementations (+ FigmaImporter → Edge Functions)
  local/                      localStorage dev implementations
  index.ts                    Factory: picks backend from env
src/lib/auth/AuthContext.tsx  Auth boundary (dev switcher now, Supabase Auth later)
src/lib/brand/BrandContext.tsx Active company's kit/assets/locations + theming
src/lib/render/              Canvas math: data-URL pipeline, autofit, fonts, toPng export
src/app/components/SchemaRenderer.tsx  THE renderer — every template goes through it
src/app/components/builder/  Admin Template Builder (overlay editor, inspector, caption)
src/app/components/onboarding/ First-run wizard
supabase/migrations/         Schema + RLS (dev-active, real-ready)
supabase/functions/          figma-status / figma-connect / figma-import (Deno)
```

## Data model

Every tenant-owned table carries `company_id` → `companies`. See
`supabase/migrations/0001_schema.sql` for full DDL.

- `companies`, `users`, `memberships` (role: `admin` | `member`)
- `brand_kits` (palette jsonb, heading/body font refs, primary logo) — one
  active per company
- `brand_assets` (logo | font | image; Storage-backed)
- `locations` — generic per-tenant branches/facilities with optional logos
- `canvas_presets` — reference data; the ONLY seeded table. v1 enables just
  `square-1440`. Adding Instagram/Story/etc. sizes is a data change, not code:
  flip/insert a row.
- `templates` + `template_fields` — the heart of the system; see
  `docs/TEMPLATE_SCHEMA.md`
- `usage_events` (`open` | `download`) — recorded inside `SchemaRenderer` so
  one code path covers every template
- `integration_connections` — Figma tokens. **No client access, ever** —
  Edge Functions only, via service role.

The database ships **empty of tenant data**. Onboarding creates everything.

## Multi-tenancy & RLS

`supabase/migrations/0002_rls.sql` enables RLS on every table and ships two
policy sets:

- **Dev (active)**: permissive `dev_all_*` policies, because v1 stubs auth
  with a client-side tenant/role switcher.
- **Real (commented, `TODO(auth)`)**: company-scoped via `memberships` +
  `auth.uid()`. Members read published templates + brand data of their own
  companies; admins write; usage events are insert-only for members and
  readable by admins.

### Enabling real RLS

1. Enable Supabase Auth; map `users.id` to `auth.users.id` (create users on
   signup via trigger or edge function; create `memberships` on invite).
2. In `0002_rls.sql`: delete every `dev_all_*` policy, uncomment every
   `TODO(auth)` block (also in `0003_storage.sql` for Storage).
3. Replace `DevAuthProvider` internals in `src/lib/auth/AuthContext.tsx` with
   Supabase Auth session handling. Components consume `AuthState` only, so no
   component changes.
4. Rotate the anon key.

## Theming

`applyBrandTheme` (src/lib/theme.ts) maps the active brand kit's palette onto
the app's CSS variables (`--primary`, `--accent`, …) plus `--brand-*` custom
entries. With no kit (fresh install) the neutral default theme in
`src/styles/theme.css` applies. Fonts load via the Google Fonts css2 API or
runtime `@font-face` with data URLs for uploads (export-safe — see
`src/lib/render/fonts.ts`).

## PNG export

`exportSchemaPng` (src/lib/render/exportPng.ts) ports the proven technique
from the original generators: dimensions from the schema (never hardcoded),
all raster assets pre-converted to data URLs (html-to-image drops
cross-origin images silently), a double `toPng` with 150 ms pause (Safari
decode warm-up), `navigator.share` on mobile with download fallback. Custom
uploaded fonts are embedded via `fontEmbedCSS`; Google fonts render from the
document font cache.

## Adding a company / client

Every client starts from the identical blank slate:

1. Header switcher → **+ Create company…** (or first run routes there
   automatically).
2. Wizard: name → colors → fonts (Google or upload) → logo → optional
   locations.
3. Land in the empty admin Templates view → build or import the first
   template → publish.

Everything set in onboarding is editable later in Brand Studio.

## Figma integration

Additive convenience on top of the manual PNG builder (which must always work
alone). Client code talks ONLY to our Edge Functions:

- `figma-connect` — stores a credential in `integration_connections`.
  v1 primary path is a **personal access token** (validated against `/v1/me`),
  which avoids standing up the OAuth app. OAuth code exchange is implemented
  too: set `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET`,
  `FIGMA_OAUTH_REDIRECT_URI` via `supabase secrets set` to enable it.
- `figma-status` — is a token stored for this company?
- `figma-import` — parses a frame URL, `GET /v1/files/:key/nodes`, renders the
  frame via `GET /v1/images` (scale 2), re-hosts the PNG in the
  `template-backgrounds` bucket (Figma render URLs expire), and walks the node
  tree: TEXT nodes → suggested text fields (position, font, size, alignment,
  characters as placeholder); image-filled rects/frames → image fields.
  Coordinates are normalized to the frame origin; canvas size comes from the
  frame's bounding box.

Known caveats (handled with `warnings` + graceful fallback): duplicated node
ids from component instances are skipped; masks/effects don't map; if the
tree can't be parsed you still get the rendered background and map fields
manually.

## Environment

See `.env.example`. Client env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
is safe to expose — security comes from RLS. Figma secrets exist only as Edge
Function secrets. No secrets in code, ever.

Local dev: `npm run dev`. With Supabase: `supabase start` (or a hosted
project), `supabase db push` (or run migrations), `supabase functions deploy
figma-status figma-connect figma-import`, fill `.env`.
