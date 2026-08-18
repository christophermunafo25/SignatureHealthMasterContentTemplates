// Domain types shared across the app. Mirrors supabase/migrations/0001_schema.sql.

export type Role = "admin" | "member";

export interface Company {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  /** Recipients for submission notifications — configuration, not a
   * constant (see the v2 brief, D6). */
  notificationEmails?: string[];
  /** Shared facility-portal access (v2.1): one token per company, with a
   * rotation grace window and a kill switch. */
  portalToken?: string;
  portalTokenPrevious?: string;
  portalTokenPreviousExpires?: string;
  portalEnabled?: boolean;
  /** Root-URL public portal opt-in: the facility portal is also served at
   * the bare production URL (no token). portal_enabled still kills it. */
  portalPublic?: boolean;
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
  /** Locks the field's text sizing mode (see TemplateField.textSizing). */
  textSizing?: "free" | "shrink" | "fill";
  /** @deprecated Superseded by `textSizing` ("shrink"). Migrated in place in
   *  the type_styles jsonb by 0030; read only as a fallback for a style the
   *  migration did not reach. Never written. */
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

export interface CanvasPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  enabled: boolean;
  /** Grouping for the size picker (Instagram, Facebook, …). */
  platform: string;
  /** Human format inside the platform group ("Story / Reel"). */
  format: string;
  sortOrder: number;
  recommended: boolean;
}

export interface TextGradient {
  angle: number; // degrees, CSS linear-gradient convention
  stops: Array<{ position: number; color: string }>; // position 0..1, #RRGGBB
}

export type FieldType = "text" | "multiline" | "image" | "select" | "shape" | "facility_logo";

/** The facility in context for facility_logo elements: threaded into every
 * render surface, and frozen into Submission.brandSnapshot.facility at
 * submit time so review/export never re-resolve a live logo. */
export interface FacilitySnapshot {
  name: string;
  shortName: string;
  logoUrl: string | null;
}

/** Decorative shape kinds (a "line" is a thin rect). */
export type ShapeKind = "rect" | "ellipse" | "triangle" | "star";

/** Per-corner radius for image fields (px, canvas space). Uniform radius is
 * simply all four corners equal — the builder's link toggle edits them
 * together. */
export interface CornerRadius {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

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
  /** Canvas paint (layer) order — higher paints on top. This is a SEPARATE
   * concern from the fields array order, which is the member form order. */
  zIndex?: number;
  /** Static element: exists on the graphic but is NOT a member-editable
   * field — no form entry, no caption tag, no required check. The admin
   * fixes its content in `staticValue` (text, or an image URL). */
  static?: boolean;
  staticValue?: string;
  /** Image fields only: rounded corners, rendered identically in the
   * builder, member preview, and PNG export. */
  cornerRadius?: CornerRadius;
  /** Element opacity, 0–100 (default 100). */
  opacity?: number;
  /** Shape fields only: which shape to draw. Fill comes from colorHex /
   * colorKey / textGradient (same fill pipeline as text); rects also honor
   * cornerRadius. Shapes are always static — never member-editable. */
  shape?: ShapeKind;
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
  /** Optional text fill gradient (wins over solid color when set). */
  textGradient?: TextGradient;
  align?: "left" | "center" | "right";
  /** Vertical placement of text within the box (default middle). */
  verticalAlign?: "top" | "middle" | "bottom";
  uppercase?: boolean;
  letterSpacingPx?: number;
  lineHeight?: number;
  // Guardrails
  maxLength?: number;
  /** How text responds to content length. "free" (or absent): the font size
   * is fixed and the box grows taller as lines wrap — height is computed,
   * never authored. "shrink": the box is exactly what the admin drew and the
   * font size decreases (measured, never estimated) until the content fits —
   * single-line text is width-constrained, multiline is height-constrained
   * with wrapping at the box width. "fill": the box is as drawn and the text
   * is sized to fill it, growing as well as shrinking.
   *
   * Replaces the `autoFit` / `fixedWidth` boolean pair, both of which mapped
   * to "shrink" in migration 0030. */
  textSizing?: "free" | "shrink" | "fill";
  /** @deprecated Superseded by `textSizing: "shrink"`. Backfilled by 0030 and
   *  read only as a fallback for rows that migration did not reach. The column
   *  stays for rollback safety; nothing writes it. */
  autoFit?: boolean;
  /** @deprecated Superseded by `textSizing: "shrink"`. Same story as
   *  `autoFit` — the box width was a hard constraint, which is what shrink
   *  means, except shrink now constrains the height too. */
  fixedWidth?: boolean;
  objectFit?: "cover" | "contain";
  aspectRatio?: number;
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

/** A point along one axis of a layout group: the main-axis anchor (which
 * point holds still as content grows) or the cross-axis alignment. */
export type GroupAxisPoint = "start" | "center" | "end";

/** An auto-layout stack: an ordered run of fields placed along an axis with
 * a fixed gap, anchored at a point that does not move when content grows.
 *
 * Groups are pure layout metadata, deliberately OUTSIDE the fields array:
 * fields stay flat, so the member form order (fields array), caption merge
 * tags, and paint order (zIndex) provably cannot change when an admin groups
 * elements. A template with no groups renders through the identical path it
 * always did.
 *
 * Geometry semantics, vertical direction (horizontal swaps the axes):
 *  - x is the stack's left edge; crossSize its width.
 *  - y is the ANCHOR point: the top edge when anchor="start", the vertical
 *    center when "center", the bottom edge when "end". Content grows away
 *    from it, which is the whole point of the feature.
 *  - Main-axis size is computed from measured content — never stored.
 */
export interface LayoutGroup {
  /** Client-generated and persisted verbatim (the DB re-mints template_fields
   * row ids on every save, so groups never reference fields by row id). */
  id: string;
  name: string;
  /** "free": a plain group — children keep their authored positions and the
   * group is just a movable bounding box. "stack" (or absent): an auto-layout
   * stack that places children along `direction`. In free mode `direction`,
   * `gap`, `anchor`, `align`, `crossSize`, and `shrinkToFit` are retained
   * but ignored; `x`/`y` are unused (the frame is computed from children). */
  mode?: "free" | "stack";
  direction: "vertical" | "horizontal";
  /** Canvas px between adjacent children. */
  gap: number;
  anchor: GroupAxisPoint;
  align: GroupAxisPoint;
  x: number;
  y: number;
  crossSize: number;
  /** Ordered stack children: a field's fieldKey (the one save-stable field
   * identifier), or "group:<id>" for a nested group. Array order IS the
   * stack order — a third ordering, separate from form order and zIndex. */
  children: string[];
  /** Overflow policy: proportionally shrink text children (never below their
   * minimum font sizes) until the stack fits inside the canvas. Off by
   * default — overflow stays visible, with a builder-only warning. */
  shrinkToFit?: boolean;
}

/** Child reference encoding for LayoutGroup.children. fieldKeys are
 * [a-z0-9_] slugs, so the "group:" prefix can never collide. */
export const groupChildRef = (groupId: string): string => `group:${groupId}`;
export const parseGroupChildRef = (ref: string): string | null =>
  ref.startsWith("group:") ? ref.slice(6) : null;

/** Absent mode means "stack" — the only kind that existed before free
 * groups, so old templates keep their exact behavior. */
export const isFreeGroup = (g: LayoutGroup): boolean => g.mode === "free";

export type TemplateStatus = "draft" | "published";

export interface TemplateSchema {
  id: string;
  companyId: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  status: TemplateStatus;
  // The renderer, builder, and export ALWAYS read dimensions from here —
  // never from a preset row. canvasPresetId records which catalog size the
  // template was built against (informational only).
  canvasWidth: number;
  canvasHeight: number;
  canvasPresetId?: string;
  backgroundUrl: string;
  /** Canvas base fill for blank-built templates. Precedence when rendering:
   * background image (backgroundUrl) → gradient → color → white. */
  backgroundColor?: string;
  backgroundGradient?: TextGradient;
  fields: TemplateField[];
  /** Layout groups over the flat fields (absent = none — the pre-groups
   * rendering path, byte for byte). */
  layoutGroups?: LayoutGroup[];
  captionTemplate: string; // "{name} celebrated {years} incredible years!"
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

/** One day of activity for the Insights trend chart (date = YYYY-MM-DD). */
export interface DailyActivityPoint {
  date: string;
  opens: number;
  downloads: number;
}

/** The values a member has entered for a template's fields, keyed by fieldKey.
 * Image fields hold a data URL. */
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

/** The facility roster. Access runs through ONE shared company portal
 * token (companies.portalToken); a facility row is identity + labeling,
 * chosen by staff in the facility gate. */
export interface Facility {
  id: string;
  companyId: string;
  /** Legal name — stored on submissions, emailed, shown in the dashboard. */
  name: string;
  /** Display name for the picker (e.g. "Memphis"). */
  shortName: string;
  state?: string;
  region?: string;
  sortOrder: number;
  active: boolean;
  /** Resolved public URL of the facility's logo (facility_logo elements).
   * Absent until an admin uploads one on Portal Access. */
  logoUrl?: string;
  createdAt: string;
}

export type SubmissionStatus = "submitted" | "approved" | "posted" | "archived" | "declined";

/** v2.2: how the submission arrived. 'template' is the brand template flow
 * (frozen schema snapshot, filled values); 'direct' is a facility uploading
 * their own media with proposed copy — no template involved. */
export type SubmissionKind = "template" | "direct";

/** One uploaded file on a submission. `path` is a BARE storage path in the
 * private submissions bucket. Resolve to a signed URL at display time only. */
export interface SubmissionAsset {
  path: string;
  name: string;
  mimeType: string;
  size: number;
}

/** A facility submission: an editable document (field values + frozen
 * schema/brand snapshots). The PNG preview is a byproduct — the
 * authoritative artifact is re-rendered from values + snapshot. */
export interface Submission {
  id: string;
  companyId: string;
  kind: SubmissionKind;
  templateId?: string;
  facilityId?: string;
  /** Denormalized so the queue reads correctly after link/template deletion. */
  facilityName: string;
  templateName: string;
  submitterName: string;
  submitterEmail?: string;
  values: FieldValues;
  /** Untouched copy of what the facility originally entered, for audit. */
  originalValues: FieldValues;
  caption: string;
  originalCaption: string;
  /** v2.2 Social Media Update Form document. Absent on pre-v2.2 rows —
   * every UI surface must tolerate a submission with no release form. */
  releaseForm?: import("./releaseForm").ReleaseForm;
  /** Facility-uploaded media (direct kind, or extra files on either kind). */
  assets: SubmissionAsset[];
  /** Denormalized from the release form for query-side filtering. */
  platforms: string[];
  requestedPostDate?: string; // YYYY-MM-DD
  requestedPostTime?: string;
  vpApproved?: boolean;
  releaseFlagged: boolean;
  /** Frozen at submit time — later template/brand edits never change a
   * queued item. Null for direct submissions (no template). */
  schemaSnapshot: TemplateSchema | null;
  brandSnapshot: {
    brandKit: BrandKit | null;
    logoUrl?: string | null;
    brandAssets: BrandAsset[];
    /** Frozen facility identity for facility_logo elements. Absent on
     * pre-0029 rows — every consumer must tolerate that, the same way they
     * tolerate a missing releaseForm. A logo swapped after submission must
     * never retroactively change a queued item. */
    facility?: FacilitySnapshot;
  };
  previewPath?: string;
  status: SubmissionStatus;
  declineReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  /** First save where values or caption diverged from the originals. */
  editedBy?: string;
  editedAt?: string;
  postedAt?: string;
  internalNote: string;
  createdAt: string;
  updatedAt: string;
}
