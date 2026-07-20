-- Figma import fidelity: imported fields keep the exact styling they had on
-- the Figma canvas even when it isn't expressible as a brand palette key.
-- color_hex is a FALLBACK — brand-kit colorKey and type-style bindings still
-- win when set (see src/lib/brand/resolveStyle.ts).

alter table template_fields
  add column if not exists font_weight numeric,
  add column if not exists color_hex text;
