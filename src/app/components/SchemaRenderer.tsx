import React, {
  forwardRef,
  useMemo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { BrandKit, FacilitySnapshot, FieldValues, TemplateField, TemplateSchema } from "@/lib/types";
import { useDataUrl } from "@/lib/render/useDataUrl";
import { createCanvasMeasurer, fitText } from "@/lib/render/autoFit";
import { computeLayout, type Rect } from "@/lib/render/layout";
import { resolveFieldStyle } from "@/lib/brand/resolveStyle";
import { loadGoogleFonts, schemaFontFamilies } from "@/lib/render/fonts";
import { exportSchemaPng, renderSchemaBlob, type ExportOutcome } from "@/lib/render/exportPng";
import { stores } from "@/lib/stores";
import defaultFacilityLogo from "@/assets/default-facility-logo.png";

export interface SchemaRendererHandle {
  /** Renders the canvas to PNG and hands it to the user. Records a
   * `download` usage event on success (unless instrument={false}). */
  exportPng(): Promise<ExportOutcome>;
  /** Renders the canvas to PNG bytes. No side effects, no usage event —
   * callers (submission upload) instrument themselves. */
  renderBlob(): Promise<Blob>;
}

interface SchemaRendererProps {
  schema: TemplateSchema;
  values: FieldValues;
  brandKit: BrandKit | null;
  /** Record open/download usage events (default true; builder previews pass false). */
  instrument?: boolean;
  /** Optional overlay painted in canvas space (Template Builder field boxes). */
  overlay?: React.ReactNode;
  /** Facility in context for facility_logo elements. Null in the builder and
   *  before a facility is chosen — the element then draws its placeholder. */
  facility?: FacilitySnapshot | null;
}

/** Renders ANY TemplateSchema onto a live-scaled canvas sized from
 * schema.canvasWidth/Height, using the coordinate/scale/export technique
 * ported from the reference Signature generators. The ONLY thing member input
 * changes is field content — positions and styling are locked in the schema. */
export const SchemaRenderer = forwardRef<SchemaRendererHandle, SchemaRendererProps>(
  function SchemaRenderer({ schema, values, brandKit, instrument = true, overlay, facility }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const backgroundDataUrl = useDataUrl(schema.backgroundUrl || undefined);

    // Live scale-to-fit, generalized from the reference's parentWidth/1440.
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const update = () => {
        setScale(Math.min(el.offsetWidth / schema.canvasWidth, el.offsetHeight / schema.canvasHeight, 1));
      };
      update();
      const observer = new ResizeObserver(update);
      observer.observe(el);
      return () => observer.disconnect();
    }, [schema.canvasWidth, schema.canvasHeight]);

    // Best-effort load of every family the schema references (imported
    // Figma fonts and type-style-bound fonts included) so fields render in
    // their designed typeface.
    useEffect(() => {
      loadGoogleFonts(schemaFontFamilies(schema, brandKit));
    }, [schema, brandKit]);

    // Text fitting measures real glyphs — re-render once webfonts finish
    // loading so measurements switch off the fallback font's metrics.
    const [fontsTick, setFontsReady] = useState(0);
    useEffect(() => {
      let mounted = true;
      document.fonts?.ready.then(() => mounted && setFontsReady(1));
      return () => {
        mounted = false;
      };
    }, []);

    // THE layout pass: schema + values in, absolute rects out. One measurer
    // (and its memo) per fonts generation — a webfont landing changes what
    // the same shorthand measures, so the cache must not survive it.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fontsTick deliberately busts the cache
    const measurer = useMemo(() => createCanvasMeasurer(), [fontsTick]);
    const layout = useMemo(
      () => computeLayout(schema, values, brandKit, measurer),
      [schema, values, brandKit, measurer],
    );

    // One instrumentation point covers every template (Feature 3).
    useEffect(() => {
      if (instrument) void stores.usage.record(schema.companyId, schema.id, "open");
    }, [instrument, schema.companyId, schema.id]);

    const exportPng = useCallback(async () => {
      if (!canvasRef.current) throw new Error("Canvas not mounted");
      const outcome = await exportSchemaPng(schema, canvasRef.current, brandKit);
      // A dismissed share sheet produced no graphic — don't count it.
      if (instrument && outcome !== "canceled") {
        void stores.usage.record(schema.companyId, schema.id, "download");
      }
      return outcome;
    }, [schema, instrument, brandKit]);

    const renderBlob = useCallback(async () => {
      if (!canvasRef.current) throw new Error("Canvas not mounted");
      return renderSchemaBlob(schema, canvasRef.current, brandKit);
    }, [schema, brandKit]);

    useImperativeHandle(ref, () => ({ exportPng, renderBlob }), [exportPng, renderBlob]);

    return (
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: `${schema.canvasWidth} / ${schema.canvasHeight}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: schema.canvasWidth,
            height: schema.canvasHeight,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            position: "absolute",
            flexShrink: 0,
          }}
        >
          <div
            ref={canvasRef}
            style={{
              width: schema.canvasWidth,
              height: schema.canvasHeight,
              position: "relative",
              overflow: "hidden",
              background: schemaBackgroundCss(schema),
            }}
          >
            {backgroundDataUrl && (
              <img
                src={backgroundDataUrl}
                alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
            {schema.fields.map((field) => (
              <FieldBox
                key={field.id}
                field={field}
                value={values[field.fieldKey]}
                brandKit={brandKit}
                facility={facility}
                rect={layout.fieldRects.get(field.id)}
                fontSize={layout.fontSizes.get(field.id)}
              />
            ))}
          </div>
          {overlay && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{overlay}</div>
          )}
        </div>
      </div>
    );
  },
);

function resolveColor(
  colorKey: string | undefined,
  colorHex: string | undefined,
  brandKit: BrandKit | null,
): string {
  if (colorKey) {
    const entry = brandKit?.colors.find((c) => c.key === colorKey);
    if (entry) return entry.hex;
  }
  return colorHex ?? "#111111";
}

function boxStyle(field: TemplateField, rect?: Rect): React.CSSProperties {
  // Positioning ONLY — appearance (including opacity) lives on the content,
  // so the builder can host content inside its own screen-space boxes.
  //
  // With a layout rect (the normal path) the box positions from the pass's
  // top-left-space output: anchor normalization already happened there, and
  // grouped children get their stacked, hugged rects. The legacy branch
  // (translate(-50%,-50%) for center anchors) covers only a caller with no
  // layout — the builder's content-only hosting — and resolves to the same
  // painted geometry.
  const transforms: string[] = [];
  if (!rect && field.anchor === "center") transforms.push("translate(-50%, -50%)");
  if (field.rotation) transforms.push(`rotate(${field.rotation}deg)`);
  return {
    position: "absolute",
    left: rect ? rect.x : field.x,
    top: rect ? rect.y : field.y,
    width: rect ? rect.width : field.width,
    height: rect ? rect.height : field.height,
    transform: transforms.join(" ") || undefined,
    // Canvas layer order. Fields array order is the member FORM order; paint
    // order is zIndex (ties fall back to DOM order = form order).
    zIndex: field.zIndex ?? 0,
  };
}

/** Appearance base for a field's content: fills the positioning parent (the
 * FieldBox wrapper or a builder interaction box) and carries element opacity. */
function contentBaseStyle(field: TemplateField): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    // Element opacity (0-100, default 100)
    opacity: field.opacity !== undefined ? Math.max(0, Math.min(100, field.opacity)) / 100 : undefined,
  };
}

/** CSS linear-gradient from the shared gradient shape. */
export function gradientCss(g: { angle: number; stops: Array<{ position: number; color: string }> }): string {
  return `linear-gradient(${g.angle}deg, ${g.stops
    .map((s) => `${s.color} ${Math.round(s.position * 100)}%`)
    .join(", ")})`;
}

/** Canvas base fill: gradient → color → white. A background image (rendered
 * as an <img> above this) still wins visually. Shared with the builder's
 * edit canvas so every surface paints the same base. */
export function schemaBackgroundCss(
  schema: Pick<TemplateSchema, "backgroundColor" | "backgroundGradient">,
): string {
  const g = schema.backgroundGradient;
  if (g?.stops.length) return gradientCss(g);
  return schema.backgroundColor || "#ffffff";
}

export function cornerRadiusCss(field: TemplateField): string | undefined {
  const r = field.cornerRadius;
  if (!r || (!r.tl && !r.tr && !r.br && !r.bl)) return undefined;
  return `${r.tl}px ${r.tr}px ${r.br}px ${r.bl}px`;
}

interface FieldBoxProps {
  field: TemplateField;
  value: string | undefined;
  brandKit: BrandKit | null;
  /** Facility in context for facility_logo elements (absent → placeholder). */
  facility?: FacilitySnapshot | null;
  /** Computed rect from the layout pass. Absent only for the builder's
   *  content-only hosting, which positions the box itself. */
  rect?: Rect;
  /** Computed font size from the layout pass — the same arithmetic the box
   *  would do inline, plus shrinkToFit for grouped children. */
  fontSize?: number;
}

/** Positioning wrapper (boxStyle) around the field's visual content. The
 * single member-preview/export render path — behavior must stay identical. */
export function FieldBox({ field, value, brandKit, facility, rect, fontSize }: FieldBoxProps) {
  return (
    <div style={boxStyle(field, rect)}>
      <FieldBoxContent
        field={field}
        value={value}
        brandKit={brandKit}
        facility={facility}
        fontSize={fontSize}
      />
    </div>
  );
}

/** Content-only variant: identical visuals rendered at the origin, filling a
 * parent sized to field.width × field.height. The builder hosts this inside
 * its screen-space interaction boxes so content moves with the box during
 * drags — no second source of truth, no catch-up jump on release. */
export function FieldBoxContent({ field, value, brandKit, facility, fontSize }: FieldBoxProps) {
  // Static elements carry their own fixed content — member values never apply.
  const effective = field.static ? field.staticValue : value;
  if (field.type === "shape") {
    return <ShapeFieldBox field={field} brandKit={brandKit} />;
  }
  if (field.type === "facility_logo") {
    return <FacilityLogoFieldBox field={field} facility={facility} />;
  }
  if (field.type === "image") {
    return <ImageFieldBox field={field} value={effective} />;
  }
  return (
    <TextFieldBox field={field} value={effective} brandKit={brandKit} fontSize={fontSize} />
  );
}

/** 5-point star, unit square. */
const STAR_POINTS = "50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35";

/** Decorative shape: fill = gradient → brand color key → hex. Rects render
 * as plain divs (corner radius applies); ellipse/triangle/star render as
 * inline SVG so gradients survive the PNG export. */
function ShapeFieldBox({ field, brandKit }: { field: TemplateField; brandKit: BrandKit | null }) {
  const kind = field.shape ?? "rect";
  const solid = resolveColor(field.colorKey, field.colorHex, brandKit);
  const g = field.textGradient?.stops.length ? field.textGradient : undefined;

  if (kind === "rect") {
    return (
      <div
        style={{
          ...contentBaseStyle(field),
          background: g ? gradientCss(g) : solid,
          borderRadius: cornerRadiusCss(field),
        }}
      />
    );
  }

  const gradId = `sp-shape-grad-${field.id}`;
  const paint = g ? `url(#${gradId})` : solid;
  return (
    <div style={contentBaseStyle(field)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
        {g && (
          <defs>
            <linearGradient id={gradId} gradientTransform={`rotate(${((g.angle - 90) % 360 + 360) % 360}, 0.5, 0.5)`}>
              {g.stops.map((s, i) => (
                <stop key={i} offset={`${Math.round(s.position * 100)}%`} stopColor={s.color} />
              ))}
            </linearGradient>
          </defs>
        )}
        {kind === "ellipse" && <ellipse cx="50" cy="50" rx="50" ry="50" fill={paint} />}
        {kind === "triangle" && <polygon points="50,0 100,100 0,100" fill={paint} />}
        {kind === "star" && <polygon points={STAR_POINTS} fill={paint} />}
      </svg>
    </div>
  );
}

function TextFieldBox({ field, value, brandKit, fontSize: layoutFontSize }: FieldBoxProps) {
  // Brand rules engine: properties defined by the bound type style win.
  const style = resolveFieldStyle(field, brandKit);
  // Fixed elements ARE the graphic: their content (falling back to the label)
  // always paints at full strength — the dimmed treatment is only for
  // placeholders a member has yet to fill.
  const text = value || (field.static ? field.label : field.placeholder || field.label);
  const atFullStrength = Boolean(value) || Boolean(field.static);
  // One measured fit for every surface. Shrink constrains BOTH axes now — a
  // line that fits the width but not the height comes down too, which is what
  // "the box stays exactly as drawn" always promised. Nothing clips: content
  // that cannot fit even at the floor paints past the box visibly, because a
  // member's entry silently losing its last words at review is worse than one
  // that visibly needs fixing.
  // The layout pass owns the size when it ran — identical arithmetic, plus
  // shrinkToFit for grouped children. The inline computation stays for hosts
  // without a pass (the builder's interaction boxes).
  const fontSize =
    layoutFontSize ??
    fitText(
      {
        ...style,
        multiline: field.type === "multiline",
        width: field.width,
        height: field.height,
      },
      text,
    ).fontSizePx;
  const justify =
    field.align === "center" ? "center" : field.align === "right" ? "flex-end" : "flex-start";
  const alignItems =
    field.verticalAlign === "top" ? "flex-start" : field.verticalAlign === "bottom" ? "flex-end" : "center";
  return (
    <div
      style={{
        ...contentBaseStyle(field),
        display: "flex",
        alignItems,
        justifyContent: justify,
      }}
    >
      <p
        style={{
          fontFamily: style.fontFamily ? `"${style.fontFamily}", sans-serif` : "sans-serif",
          fontWeight: style.fontWeight,
          fontSize,
          color: resolveColor(style.colorKey, style.colorHex, brandKit),
          opacity: atFullStrength ? 1 : 0.55, // placeholder shows the real styling, dimmed
          ...(style.textGradient?.stops.length
            ? {
                backgroundImage: `linear-gradient(${style.textGradient.angle}deg, ${style.textGradient.stops
                  .map((s) => `${s.color} ${Math.round(s.position * 100)}%`)
                  .join(", ")})`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }
            : {}),
          textAlign: field.align ?? "left",
          textTransform: style.uppercase ? "uppercase" : undefined,
          letterSpacing: style.letterSpacingPx ? `${style.letterSpacingPx}px` : undefined,
          lineHeight: style.lineHeight ?? 1.1,
          whiteSpace: field.type === "multiline" ? "pre-wrap" : "nowrap",
          wordBreak: field.type === "multiline" ? "break-word" : undefined,
          width: field.type === "multiline" ? "100%" : undefined,
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );
}

/** Auto-resolved facility logo. The logo travels through useDataUrl because
 * html-to-image silently drops cross-origin images from the PNG export — a
 * bare storage URL would preview correctly and export a blank box, the exact
 * failure this element type exists to prevent.
 *
 * No facility in context, or a facility without its own logo, falls back to
 * the bundled corporate mark — the element always shows a real logo, so
 * template thumbnails and pre-pick previews never sit on a dashed box. The
 * placeholder below survives only for a failed image load. */
function FacilityLogoFieldBox({
  field,
  facility,
}: {
  field: TemplateField;
  facility?: FacilitySnapshot | null;
}) {
  const logoDataUrl = useDataUrl(facility?.logoUrl ?? defaultFacilityLogo);

  if (logoDataUrl) {
    return (
      <div
        style={{
          ...contentBaseStyle(field),
          overflow: "hidden",
          borderRadius: cornerRadiusCss(field),
        }}
      >
        <img
          src={logoDataUrl}
          alt={facility ? `${facility.shortName} logo` : field.label}
          // A logo must never be cropped — contain unless the admin says otherwise.
          style={{ width: "100%", height: "100%", objectFit: field.objectFit ?? "contain" }}
        />
      </div>
    );
  }

  // No facility yet (builder, or pre-pick fill page) or no logo uploaded:
  // a quiet dashed placeholder that names what will appear here.
  return (
    <div
      style={{
        ...contentBaseStyle(field),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.06)",
        border: "1.5px dashed rgba(0,0,0,0.25)",
        borderRadius: cornerRadiusCss(field),
      }}
    >
      <span
        style={{
          color: "rgba(0,0,0,0.35)",
          fontSize: Math.max(14, Math.min(24, field.width / 14)),
          textAlign: "center",
          padding: "0 8px",
        }}
      >
        {facility ? facility.shortName : field.label || "Facility logo"}
      </span>
    </div>
  );
}

function ImageFieldBox({ field, value }: { field: TemplateField; value: string | undefined }) {
  // Same export rule as every canvas image: html-to-image drops cross-origin
  // images, so a static brand-asset URL must become a data URL before toPng.
  // Member uploads are already data URLs and pass straight through; the raw
  // value fills in only while conversion is in flight (or failed, which
  // renders no worse than before).
  const dataUrl = useDataUrl(value || undefined);
  const shown = value ? dataUrl ?? value : undefined;
  return (
    <div
      style={{
        ...contentBaseStyle(field),
        overflow: "hidden",
        borderRadius: cornerRadiusCss(field),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: shown ? undefined : "rgba(0,0,0,0.06)",
        border: shown ? undefined : "1.5px dashed rgba(0,0,0,0.25)",
      }}
    >
      {shown ? (
        <img
          src={shown}
          alt={field.label}
          style={{ width: "100%", height: "100%", objectFit: field.objectFit ?? "cover" }}
        />
      ) : (
        <span style={{ color: "rgba(0,0,0,0.35)", fontSize: Math.max(18, field.width / 14), textAlign: "center" }}>
          {field.label}
        </span>
      )}
    </div>
  );
}

