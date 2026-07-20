import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { BrandKit, FieldValues, Location, TemplateField, TemplateSchema } from "@/lib/types";
import { useDataUrl } from "@/lib/render/useDataUrl";
import { fittedFontSize } from "@/lib/render/autoFit";
import { resolveFieldStyle } from "@/lib/brand/resolveStyle";
import { loadGoogleFonts, schemaFontFamilies } from "@/lib/render/fonts";
import { exportSchemaPng, type ExportOutcome } from "@/lib/render/exportPng";
import { stores } from "@/lib/stores";

export interface SchemaRendererHandle {
  /** Renders the canvas to PNG and hands it to the user. Records a
   * `download` usage event on success (unless instrument={false}). */
  exportPng(): Promise<ExportOutcome>;
}

interface SchemaRendererProps {
  schema: TemplateSchema;
  values: FieldValues;
  brandKit: BrandKit | null;
  locations: Location[];
  /** Record open/download usage events (default true; builder previews pass false). */
  instrument?: boolean;
  /** Optional overlay painted in canvas space (Template Builder field boxes). */
  overlay?: React.ReactNode;
}

/** Renders ANY TemplateSchema onto a live-scaled canvas sized from
 * schema.canvasWidth/Height, using the coordinate/scale/export technique
 * ported from the reference Signature generators. The ONLY thing member input
 * changes is field content — positions and styling are locked in the schema. */
export const SchemaRenderer = forwardRef<SchemaRendererHandle, SchemaRendererProps>(
  function SchemaRenderer({ schema, values, brandKit, locations, instrument = true, overlay }, ref) {
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
    // Figma fonts included) so fields render in their designed typeface.
    useEffect(() => {
      loadGoogleFonts(schemaFontFamilies(schema));
    }, [schema]);

    // One instrumentation point covers every template (Feature 3).
    useEffect(() => {
      if (instrument) void stores.usage.record(schema.companyId, schema.id, "open");
    }, [instrument, schema.companyId, schema.id]);

    const exportPng = useCallback(async () => {
      if (!canvasRef.current) throw new Error("Canvas not mounted");
      const outcome = await exportSchemaPng(schema, canvasRef.current);
      if (instrument) void stores.usage.record(schema.companyId, schema.id, "download");
      return outcome;
    }, [schema, instrument]);

    useImperativeHandle(ref, () => ({ exportPng }), [exportPng]);

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
              background: "#ffffff",
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
                locations={locations}
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

function boxStyle(field: TemplateField): React.CSSProperties {
  // Three positioning patterns from the reference generators: plain absolute
  // boxes, center-anchored boxes (translate(-50%,-50%)), rotated content.
  const transforms: string[] = [];
  if (field.anchor === "center") transforms.push("translate(-50%, -50%)");
  if (field.rotation) transforms.push(`rotate(${field.rotation}deg)`);
  return {
    position: "absolute",
    left: field.x,
    top: field.y,
    width: field.width,
    height: field.height,
    transform: transforms.join(" ") || undefined,
  };
}

interface FieldBoxProps {
  field: TemplateField;
  value: string | undefined;
  brandKit: BrandKit | null;
  locations: Location[];
}

function FieldBox({ field, value, brandKit, locations }: FieldBoxProps) {
  if (field.type === "image") {
    return <ImageFieldBox field={field} value={value} />;
  }
  if (field.type === "location") {
    const location = locations.find((l) => l.id === value);
    return <LocationFieldBox field={field} location={location} />;
  }
  return <TextFieldBox field={field} value={value} brandKit={brandKit} />;
}

function TextFieldBox({ field, value, brandKit }: Omit<FieldBoxProps, "locations">) {
  // Brand rules engine: properties defined by the bound type style win.
  const style = resolveFieldStyle(field, brandKit);
  const text = value || field.placeholder || field.label;
  const fontSize = fittedFontSize({ width: field.width, ...style }, text);
  const justify =
    field.align === "center" ? "center" : field.align === "right" ? "flex-end" : "flex-start";
  return (
    <div style={{ ...boxStyle(field), display: "flex", alignItems: "center", justifyContent: justify }}>
      <p
        style={{
          fontFamily: style.fontFamily ? `"${style.fontFamily}", sans-serif` : "sans-serif",
          fontWeight: style.fontWeight,
          fontSize,
          color: value ? resolveColor(style.colorKey, style.colorHex, brandKit) : "rgba(120,120,120,0.55)",
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

function ImageFieldBox({ field, value }: { field: TemplateField; value: string | undefined }) {
  return (
    <div
      style={{
        ...boxStyle(field),
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: value ? undefined : "rgba(0,0,0,0.06)",
        border: value ? undefined : "1.5px dashed rgba(0,0,0,0.25)",
      }}
    >
      {value ? (
        <img
          src={value}
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

function LocationFieldBox({ field, location }: { field: TemplateField; location: Location | undefined }) {
  const logoDataUrl = useDataUrl(location?.logoUrl);
  return (
    <div
      style={{
        ...boxStyle(field),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        border: logoDataUrl ? undefined : "1.5px dashed rgba(0,0,0,0.25)",
      }}
    >
      {logoDataUrl ? (
        <img
          src={logoDataUrl}
          alt={location?.name ?? field.label}
          style={{ width: "100%", height: "100%", objectFit: field.objectFit ?? "contain" }}
        />
      ) : (
        <span style={{ color: "rgba(0,0,0,0.35)", fontSize: Math.max(16, field.width / 18), textAlign: "center" }}>
          {location ? location.name : field.label}
        </span>
      )}
    </div>
  );
}
