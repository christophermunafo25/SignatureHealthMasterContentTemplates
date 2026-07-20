// Domain types shared across the app. Mirrors supabase/migrations/0001_schema.sql.

export type Role = "admin" | "member";

export interface Company {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface BrandColor {
  key: string; // palette key referenced by TemplateField.colorKey
  name: string;
  hex: string;
}

export interface FontRef {
  source: "google" | "custom";
  family: string;
  assetId?: string; // brand_assets id when source === "custom"
}

/** A named brand type style ("role") — the unit of the brand rules engine.
 * Every property a style DEFINES is locked: fields bound to the style render
 * with it and the builder/end user cannot override it. Properties left
 * undefined stay editable per field (e.g. layout-specific font size). */
export interface BrandTypeStyle {
  key: string; // stable slug, e.g. "heading"
  name: string; // "Heading"
  font?: FontRef;
  weight?: number; // 100–900
  uppercase?: boolean;
  letterSpacingPx?: number;
  lineHeight?: number;
  colorKey?: string; // brand palette key
  fontSizePx?: number; // set only when the brand fixes the size globally
  maxLength?: number; // "never exceeds N characters"
  autoFit?: boolean;
}

export interface BrandKit {
  id: string;
  companyId: string;
  colors: BrandColor[]; // unlimited
  typeStyles: BrandTypeStyle[]; // unlimited
  /** Accepted free-text brand rules (from guidelines.md import or typed in). */
  guidelines: string[];
  headingFont?: FontRef;
  bodyFont?: FontRef;
  primaryLogoAssetId?: string;
}

export type AssetKind = "logo" | "font" | "image";

export interface FontAssetMetadata {
  family?: string;
  weight?: number;
  style?: "normal" | "italic";
  format?: "woff2" | "woff" | "truetype" | "opentype";
}

export interface BrandAsset {
  id: string;
  companyId: string;
  kind: AssetKind;
  name: string;
  url: string; // resolved public URL (storage_path is an implementation detail)
  metadata: FontAssetMetadata;
  createdAt: string;
}

export interface Location {
  id: string;
  companyId: string;
  name: string;
  logoUrl?: string;
}

export interface CanvasPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  enabled: boolean;
}

export type FieldType = "text" | "multiline" | "image" | "select" | "location";

export interface TemplateField {
  id: string;
  label: string;
  type: FieldType;
  fieldKey: string; // stable slug used in {merge_tags}
  // Placement in canvas pixel space. x/y are the box's top-left unless
  // anchor === "center" (then x/y are the box center — used for
  // center-anchored text like the reference generator's name field).
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number; // degrees, about the box center
  anchor?: "topLeft" | "center";
  /** Figma node this field was imported from (transient import provenance —
   * used to lift the element off the recomposed background). */
  sourceNodeId?: string;
  /** Binding to a named brand type style. When set, every property that
   * style defines overrides the field-level values below and is locked by
   * the brand rules engine. */
  typeStyleKey?: string;
  // Locked styling the member CANNOT change. colorKey references the brand
  // kit palette so a palette change propagates everywhere.
  fontFamily?: string;
  fontWeight?: number; // exact weight from an import; type styles override
  fontSizePx?: number;
  minFontSizePx?: number; // autoFit floor
  colorKey?: string;
  /** Literal color fallback (e.g. from a Figma import) — used only when no
   * type style or palette colorKey applies. */
  colorHex?: string;
  align?: "left" | "center" | "right";
  uppercase?: boolean;
  letterSpacingPx?: number;
  lineHeight?: number;
  // Guardrails
  maxLength?: number;
  autoFit?: boolean;
  objectFit?: "cover" | "contain";
  aspectRatio?: number;
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

export type TemplateStatus = "draft" | "published";

export interface TemplateSchema {
  id: string;
  companyId: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  status: TemplateStatus;
  // v1 is always 1440×1440 (square-1440 preset) but ALWAYS read from here —
  // the renderer, builder, and export never hardcode a dimension.
  canvasWidth: number;
  canvasHeight: number;
  backgroundUrl: string;
  fields: TemplateField[];
  captionTemplate: string; // "{name} celebrated {years} years at {location}!"
  createdAt: string;
  updatedAt: string;
}

export type NewTemplateInput = Omit<TemplateSchema, "id" | "createdAt" | "updatedAt">;

export type UsageAction = "open" | "download";

export interface UsageSummaryRow {
  templateId: string;
  templateName: string;
  opens: number;
  downloads: number;
  lastUsedAt: string | null;
}

export interface UsageSummary {
  rows: UsageSummaryRow[];
  totalDownloads: number;
}

/** The values a member has entered for a template's fields, keyed by fieldKey.
 * Image fields hold a data URL; location fields hold a location id. */
export type FieldValues = Record<string, string>;

export interface DesignImportResult {
  backgroundUrl: string;
  canvasWidth: number;
  canvasHeight: number;
  suggestedFields: TemplateField[];
  warnings: string[];
  /** Echo of the imported frame link — used for the layered re-render. */
  sourceUrl?: string;
}

/** One paintable unit of a decomposed Figma frame (frame-relative, scale 1). */
export interface FigmaLayerUnit {
  kind: "node" | "solid" | "gradient" | "imageFill";
  x: number;
  y: number;
  width: number;
  height: number;
  url?: string; // node render / image fill (re-hosted in our Storage)
  color?: string; // solid
  opacity?: number;
  stops?: Array<{ position: number; color: string }>; // gradient
  handles?: Array<{ x: number; y: number }>; // gradient handle positions (normalized)
}

export interface LayerRenderResult {
  canvasWidth: number;
  canvasHeight: number;
  units: FigmaLayerUnit[];
  warnings: string[];
}
