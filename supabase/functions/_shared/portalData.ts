// Row → domain mapping for the public portal, mirroring
// src/lib/stores/supabase/rows.ts (which cannot be imported here: it reads
// import.meta.env in the browser bundle). Keep the two in sync when the
// template or brand-kit shape changes.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const BUCKETS = {
  brandAssets: "brand-assets",
  templateBackgrounds: "template-backgrounds",
} as const;

function publicUrl(bucket: string, path: string): string {
  const base = Deno.env.get("SUPABASE_URL")!;
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

const resolveUrl = (bucket: string, path: string): string =>
  /^https?:\/\//.test(path) ? path : publicUrl(bucket, path);

const opt = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export function toTemplateField(r: Row): Row {
  return {
    id: r.id,
    fieldKey: r.field_key,
    label: r.label,
    type: r.type,
    typeStyleKey: opt(r.type_style_key),
    x: Number(r.x),
    y: Number(r.y),
    width: Number(r.width),
    height: Number(r.height),
    rotation: opt(r.rotation) === undefined ? undefined : Number(r.rotation),
    anchor: opt(r.anchor),
    zIndex: opt(r.z_index) === undefined ? undefined : Number(r.z_index),
    cornerRadius: opt(r.corner_radius),
    opacity: opt(r.opacity) === undefined ? undefined : Number(r.opacity),
    shape: opt(r.shape),
    static: opt(r.is_static),
    staticValue: opt(r.static_value),
    fontFamily: opt(r.font_family),
    fontWeight: opt(r.font_weight) === undefined ? undefined : Number(r.font_weight),
    colorHex: opt(r.color_hex),
    textGradient: opt(r.text_gradient),
    fontSizePx: opt(r.font_size_px) === undefined ? undefined : Number(r.font_size_px),
    minFontSizePx: opt(r.min_font_size_px) === undefined ? undefined : Number(r.min_font_size_px),
    colorKey: opt(r.color_key),
    align: opt(r.align),
    verticalAlign: opt(r.vertical_align),
    uppercase: opt(r.uppercase),
    letterSpacingPx: opt(r.letter_spacing_px) === undefined ? undefined : Number(r.letter_spacing_px),
    lineHeight: opt(r.line_height) === undefined ? undefined : Number(r.line_height),
    maxLength: opt(r.max_length),
    fixedWidth: opt(r.fixed_width),
    autoFit: opt(r.auto_fit),
    objectFit: opt(r.object_fit),
    aspectRatio: opt(r.aspect_ratio) === undefined ? undefined : Number(r.aspect_ratio),
    options: opt(r.options),
    placeholder: opt(r.placeholder),
    required: r.required,
  };
}

export function toTemplate(r: Row): Row {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    description: r.description,
    category: r.category,
    tags: r.tags ?? [],
    status: r.status,
    canvasWidth: r.canvas_width,
    canvasHeight: r.canvas_height,
    backgroundColor: r.background_color ?? undefined,
    backgroundGradient: r.background_gradient ?? undefined,
    backgroundUrl: r.background_storage_path
      ? resolveUrl(BUCKETS.templateBackgrounds, r.background_storage_path)
      : "",
    fields: (r.template_fields ?? [])
      .slice()
      .sort((a: Row, b: Row) => a.sort_order - b.sort_order)
      .map(toTemplateField),
    captionTemplate: r.caption_template,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toBrandKit(r: Row): Row {
  return {
    id: r.id,
    companyId: r.company_id,
    colors: r.colors ?? [],
    typeStyles: r.type_styles ?? [],
    guidelines: [], // internal do/don't rules are not public content
    headingFont: r.heading_font ?? undefined,
    bodyFont: r.body_font ?? undefined,
    primaryLogoAssetId: r.primary_logo_asset_id ?? undefined,
  };
}

/** Published templates for a link, honoring its template_tags filter. */
export async function loadPublishedTemplates(
  db: SupabaseClient,
  companyId: string,
  templateTags: string[],
): Promise<Row[]> {
  let q = db
    .from("templates")
    .select("*, template_fields(*)")
    .eq("company_id", companyId)
    .eq("status", "published");
  if (templateTags.length) q = q.overlaps("tags", templateTags);
  const { data, error } = await q.order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toTemplate);
}

/** Brand kit + resolved primary logo URL (or null when none is set). */
export async function loadBrandKit(
  db: SupabaseClient,
  companyId: string,
): Promise<{ brandKit: Row | null; logoUrl: string | null; brandAssets: Row[] }> {
  const { data } = await db.from("brand_kits").select("*").eq("company_id", companyId).maybeSingle();
  if (!data) return { brandKit: null, logoUrl: null, brandAssets: [] };
  const kit = toBrandKit(data);
  // Custom fonts render through brand assets — the public page needs their
  // storage URLs, but nothing else about the asset library.
  const { data: assets } = await db
    .from("brand_assets")
    .select("id, company_id, kind, name, storage_path, metadata, created_at")
    .eq("company_id", companyId)
    .in("kind", ["font", "logo"]);
  const mapped = (assets ?? []).map((a: Row) => ({
    id: a.id,
    companyId: a.company_id,
    kind: a.kind,
    name: a.name,
    url: resolveUrl(BUCKETS.brandAssets, a.storage_path),
    metadata: a.metadata ?? {},
    createdAt: a.created_at,
  }));
  const logo = kit.primaryLogoAssetId
    ? mapped.find((a: Row) => a.id === kit.primaryLogoAssetId) ?? null
    : null;
  return { brandKit: kit, logoUrl: logo ? logo.url : null, brandAssets: mapped };
}
