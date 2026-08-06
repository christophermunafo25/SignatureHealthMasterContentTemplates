# Signature HealthCare Graphics

Signature HealthCare's self-service brand template portal. Marketing admins design locked templates once; everyone else fills in a few fields and downloads a perfectly on-brand graphic.

The core design principle is **subtraction**: the only thing an end user can change is the content of the fields the admin defined. Layout, typography, colors, and logos stay exactly where the brand team put them.

## How it works

**Admins** build templates in a Figma-style canvas editor: start from a blank canvas, an uploaded PNG, or an imported Figma frame, then place text, image, select, and shape elements with a full inspector (position, layout, typography, fill, opacity, layers). Publishing makes the template available to members.

**Members** open a published template, fill in the fields the admin exposed (with guardrails like character limits, required fields, and auto-fit text), preview the result live, and export a pixel-perfect PNG. A caption template merges their answers into ready-to-post copy.

**Facilities** (v2.1) reach the portal through ONE shared company link —
an unguessable URL (and printable QR): staff browse a mobile-first
library of published templates, fill in fields, edit the caption, and
**submit for review** (no download, no caption copy on the facility
side). The link, its 14-day rotation grace window, the kill switch, and
the facility roster live on the Portal Access screen. An admin can also
opt the portal into the **bare site URL** (Portal Access → "Public
portal at the site address"): the root serves the same facility
experience with no token in the address, while the signed-in app lives
at `/admin`. Sign-in is invite-only, and the interface is a single
clean-white theme.

**Dual intake + release form** (v2.2): the public root is a chooser
between two paths that share one **Social Media Update Form**. *Submit
content* lets a facility upload its own photos, videos, or documents
(up to 10 files, 200 MB each) with proposed post copy — no template
involved. *Use a brand template* keeps the build-then-submit flow, with
the release form appearing as a modal at submit time, the rendered
graphic and caption pre-loaded. Answering "No" to the photo, minor, or
off-campus release questions blocks submission with guidance; "No" on
VP-of-Operations approval flags the submission for review instead. The
admin **Submissions** screen is now a Kanban **board** (Submissions /
Approved / Declined / Posted, drag-and-drop plus a keyboard-and-touch
"Move to…" menu), with the classic list — stat strip, tabs, bulk
actions, J/K/Enter/A/D — one toggle away. **Form Records** (`/records`)
is a searchable, filterable register of every release form with
read-only detail views and CSV export.

**Brand Studio** holds each company's kit: unlimited palette colors, heading and body fonts (Google Fonts or uploads), logos, and named type styles that act as a rules engine. A field bound to the "Heading" style inherits everything that style defines, and changing the style restyles every bound field across every template instantly.

## Features

- Figma-style template builder: drag elements from a palette, multi-select, copy/paste/duplicate, context menus, z-ordering, rotation, and a collapsible inspector
- Shapes (rectangle, ellipse, triangle, star, line) with solid, brand-palette, or gradient fills that survive PNG export
- Canvas backgrounds: solid color, gradient, or image
- Figma import: paste a frame link and every detected text layer or image placeholder becomes a candidate field you can accept or leave baked into the background
- Design-system import: fill the brand kit from a design-tokens JSON, a guidelines markdown file, or a connected Figma file's published styles
- Guarded member inputs: max length, required, auto-fit and fixed-width text, aspect-ratio-enforced image cropping
- Caption templates with `{field_key}` merge tags
- Reliable PNG export (fonts embedded, cross-origin images pre-converted, mobile share sheet support)
- Dual public intake (v2.2): direct media upload or brand template, both gated by the Social Media Update Form with hard blocks on missing releases
- Kanban submissions board with drag-and-drop review flow, plus the classic keyboard-driven list view
- Form Records: audit register of every release form, filterable by two independent date ranges, exportable to CSV
- Insights dashboard: opens, downloads, 30-day trend, template leaderboard
- Multi-tenant auth on Supabase (email/password, invites, admin and member roles, row-level security), with light and dark themes throughout

## Quick start

No backend setup required. The app ships with a localStorage dev backend behind the same store interfaces the production backend uses.

```bash
npm i
npm run dev
```

Open the printed localhost URL and the first-run wizard walks you through creating a company, brand kit, and first template. A switcher chip in the header shows which backend is active, and the dev backend adds a tenant/role switcher so you can preview the portal as an admin or a member.

## Running against Supabase

1. Create a Supabase project and copy `.env.example` to `.env`:

   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

   These are client-safe values; security comes from row-level security policies, not secrecy.

2. Apply the migrations in `supabase/migrations/` (via `supabase db push` or the SQL editor). The database ships empty of tenant data; onboarding creates everything.

   **v2.2 storage note:** migration `0028` raises the `submissions`
   bucket to 200 MB per file and widens its allowed types to photos,
   videos, PDFs, and Office documents — but the project's **global**
   upload size limit (Dashboard → Storage → Settings) must also be
   raised to at least 200 MB or the bucket limit has no effect.

3. Deploy the Edge Functions:

   ```bash
   supabase functions deploy figma-status figma-connect figma-import figma-layers figma-styles invite-member
   supabase functions deploy public-portal public-upload submit-content notify-submitter
   ```

   The three `public-*` functions are token-verified, not JWT-verified —
   `supabase/config.toml` sets `verify_jwt = false` for them.

   Upgrading to v2.2 redeploys two existing functions (no new ones):

   ```bash
   supabase functions deploy public-upload submit-content
   ```

   For submission notification email, set the function secrets (and have
   IT add SPF/DKIM on the sending domain):

   ```bash
   supabase secrets set RESEND_API_KEY=... NOTIFICATION_FROM_EMAIL=... PUBLIC_APP_URL=...
   ```

4. In the Supabase dashboard (Authentication → URL Configuration), set the Site URL to your production domain and add your local and hosted URLs to the additional redirect URLs so confirmation, invite, and reset links land correctly.

### Figma integration (optional)

The manual builder always works without it. To enable Figma import, an admin connects a Figma personal access token from Settings; the token is stored server-side and used only by Edge Functions. The client never talks to the Figma API directly. OAuth is also implemented: set `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET`, and `FIGMA_OAUTH_REDIRECT_URI` via `supabase secrets set` to enable it.

## Architecture at a glance

Pure React SPA (React 18, Vite, Tailwind v4) with Supabase as the backend. Components import only the store interfaces in `src/lib/stores/interfaces.ts`; a factory picks the Supabase or localStorage implementation from the environment, so both backends exercise identical UI code paths.

A template is data, not code: a background plus an ordered array of guarded fields, rendered everywhere by the single `SchemaRenderer` component. The renderer also records usage events, which is why one code path covers every template in the analytics.

```
src/lib/types.ts              Domain types (TemplateSchema, BrandKit, …)
src/lib/stores/               Data layer (Supabase + localStorage backends)
src/lib/auth/                 Auth boundary (Supabase Auth or dev switcher)
src/lib/brand/                Brand kit context, type-style resolution, imports
src/lib/render/               Canvas math, fonts, auto-fit, PNG export
src/app/components/           App shell, portal, SchemaRenderer
src/app/components/builder/   Admin template builder (wizard + canvas editor)
supabase/migrations/          Schema, RLS, storage policies
supabase/functions/           Figma + invite Edge Functions (Deno)
```

Full details:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): stack, layers, data model, auth, theming, export pipeline
- [docs/TEMPLATE_SCHEMA.md](docs/TEMPLATE_SCHEMA.md): the template and field schema contract

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server (set `PORT` to pick a port) |
| `npm run build` | Production build |

## Origins

The project began as an internal template generator for a healthcare marketing team and was generalized into a multi-tenant product. The original design exploration came out of Figma Make; see [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for third-party notices.
