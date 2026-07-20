# Template schema

A template is **data, not code**: a background image plus an array of guarded
fields, rendered by the single `SchemaRenderer` component. No per-template JSX
exists anywhere. Source of truth: `src/lib/types.ts` (`TemplateSchema`,
`TemplateField`) ↔ `templates` / `template_fields` tables.

## TemplateSchema

| Field | Notes |
|---|---|
| `canvasWidth` / `canvasHeight` | Pixel size of the canvas. v1 creation is locked to the `square-1440` preset (1440×1440) but **every consumer reads from here** — renderer scale math, builder overlay, `toPng` export. New sizes = new `canvas_presets` rows, zero code changes. |
| `backgroundUrl` | Storage URL of the uploaded/imported PNG. Converted to a data URL before render/export. |
| `fields` | Ordered `TemplateField[]`. |
| `captionTemplate` | Merge string with `{field_key}` placeholders, e.g. `"{name} celebrated {years} years at {location}!"`. Members see the merged result, can edit it, and copy it. Location fields merge as the location's display name; image fields have no caption value. |
| `status` | `draft` \| `published`. Only published templates appear in the member portal. |

## TemplateField

Placement (canvas pixel space):

- `x`, `y`, `width`, `height` — the field box. `x/y` are the box's top-left,
  unless `anchor: "center"` (then they're the box center — for center-anchored
  text à la the original name banner).
- `rotation` — degrees about the box center.

Types:

- `text` / `multiline` — single/multi-line text.
- `image` — member uploads a photo; cropped to `aspectRatio` (falls back to
  the box's own ratio); `objectFit` cover/contain.
- `select` — fixed `options` list.
- `location` — picker over the company's `locations`; renders the location's
  logo in the box.

Locked styling (member can NEVER change these):

- `fontFamily`, `fontSizePx`, `align`, `uppercase`, `letterSpacingPx`,
  `lineHeight`.
- `colorKey` — a **brand-kit palette key** (`primary`, `accent`, `text`, or a
  custom entry), not a hex value. Resolved at render time, so re-branding in
  Brand Studio restyles every existing template.

Guardrails:

- `maxLength` — hard char limit enforced by the input.
- `autoFit` (+ `minFontSizePx`) — shrink-to-fit text. Generalized from the
  reference generators: `fontSize = clamp(min, (2·width)/(len·0.58), fontSizePx)`
  (see `src/lib/render/autoFit.ts`).
- `aspectRatio` — enforced by the crop dialog for image fields.
- `required` — blocks download until filled.
- `placeholder` — ghost text in the form and on the canvas preview.

Identity:

- `fieldKey` — stable human slug (`team_name`) used by caption merge tags.
  Unique per template; auto-suggested from the label. Field rows are replaced
  wholesale on each builder save, and `fieldKey` is what keeps captions valid
  across edits.

## Rendering contract

`SchemaRenderer` renders any schema into a live-scaled canvas
(`scale = min(containerW/canvasW, containerH/canvasH, 1)`), places each field
absolutely in canvas space, and exposes `exportPng()` (dimensions from the
schema). It records `open` on mount and `download` after successful export —
the single instrumentation point for the usage dashboard. Builder previews
pass `instrument={false}`.
