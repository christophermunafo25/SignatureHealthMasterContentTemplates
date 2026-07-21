import React from "react";
import { Lock, Trash2 } from "lucide-react";
import type { BrandKit, FieldType, TemplateField, TextGradient } from "@/lib/types";
import { useBrand } from "@/lib/brand/BrandContext";
import { GOOGLE_FONTS } from "@/lib/render/fonts";
import { suggestFieldKey } from "@/lib/caption";
import { getTypeStyle, lockedProperties, ruleSentences } from "@/lib/brand/resolveStyle";
import { ColorControl } from "../ColorControl";

interface FieldInspectorProps {
  field: TemplateField;
  allFields: TemplateField[];
  onChange(patch: Partial<TemplateField>): void;
  onDelete(): void;
}

const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
  { value: "text", label: "Text (single line)" },
  { value: "multiline", label: "Text (multi-line)" },
  { value: "image", label: "Image" },
  { value: "select", label: "Dropdown" },
];

const labelClass = "sp-eyebrow block mb-1";
const labelStyle: React.CSSProperties = {};
const controlClass = "sp-input";
const controlStyle: React.CSSProperties = {};

/** Inspector for the selected field: label/type, locked styling (fonts and
 * colors come from the brand kit — never free values), and guardrails. */
export function FieldInspector({ field, allFields, onChange, onDelete }: FieldInspectorProps) {
  const { kit, assets } = useBrand();
  const isText = field.type === "text" || field.type === "multiline" || field.type === "select";
  const boundStyle = getTypeStyle(kit, field.typeStyleKey);
  const locked = lockedProperties(boundStyle);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="sp-panel-title">Field settings</h3>
        <button onClick={onDelete} title="Delete field">
          <Trash2 className="w-4 h-4" style={{ color: "var(--destructive)" }} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelClass} style={labelStyle}>Label</label>
          <input
            className={controlClass}
            style={controlStyle}
            value={field.label}
            onChange={(e) => {
              const label = e.target.value;
              onChange({
                label,
                fieldKey: suggestFieldKey(label, allFields.filter((f) => f.id !== field.id)),
              });
            }}
          />
          <p className="text-[10px] mt-1 font-mono" style={{ color: "var(--muted-foreground)" }}>
            caption tag: {"{"}{field.fieldKey}{"}"}
          </p>
        </div>
        <div className="col-span-2">
          <label className={labelClass} style={labelStyle}>Type</label>
          <select
            className={controlClass}
            style={controlStyle}
            value={field.type}
            onChange={(e) => onChange({ type: e.target.value as FieldType })}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {isText && (
          <div className="col-span-2">
            <label className={labelClass} style={labelStyle}>Saved style (optional)</label>
            <select
              className={controlClass}
              style={controlStyle}
              value={field.typeStyleKey ?? ""}
              onChange={(e) => onChange({ typeStyleKey: e.target.value || undefined })}
            >
              <option value="">None — style freely below</option>
              {(kit?.typeStyles ?? []).map((ts) => (
                <option key={ts.key} value={ts.key}>{ts.name}</option>
              ))}
            </select>
            {boundStyle && (
              <div
                className="mt-2 rounded-lg px-3 py-2 space-y-0.5"
                style={{ background: "rgba(255,63,0,0.06)", border: "1px solid rgba(255,63,0,0.18)" }}
              >
                {ruleSentences(boundStyle, kit).map((r) => (
                  <p key={r} style={{ fontSize: 11, color: "var(--fg-2)" }}>
                    <Lock style={{ width: 10, height: 10, display: "inline", marginRight: 5, verticalAlign: "-1px", color: "var(--solar)" }} />
                    {r}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Placement (fine-tuning; boxes are usually dragged) */}
        {(["x", "y", "width", "height"] as const).map((k) => (
          <div key={k}>
            <label className={labelClass} style={labelStyle}>{k}</label>
            <input
              type="number"
              className={controlClass}
              style={controlStyle}
              value={Math.round(field[k])}
              onChange={(e) => onChange({ [k]: Number(e.target.value) } as Partial<TemplateField>)}
            />
          </div>
        ))}
        <div>
          <label className={labelClass} style={labelStyle}>Rotation °</label>
          <input
            type="number"
            className={controlClass}
            style={controlStyle}
            value={field.rotation ?? 0}
            onChange={(e) => onChange({ rotation: Number(e.target.value) || undefined })}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Anchor</label>
          <select
            className={controlClass}
            style={controlStyle}
            value={field.anchor ?? "topLeft"}
            onChange={(e) => onChange({ anchor: e.target.value as TemplateField["anchor"] })}
          >
            <option value="topLeft">Top-left</option>
            <option value="center">Center</option>
          </select>
        </div>
      </div>

      {isText && <TextStyling field={field} kit={kit} locked={locked} onChange={onChange} customFamilies={
        assets.filter((a) => a.kind === "font").map((a) => a.metadata.family ?? a.name)
      } />}

      {/* Guardrails */}
      <div className="pt-2 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
        <h4 className="sp-eyebrow">Guardrails</h4>
        {isText && field.type !== "select" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>Max characters</label>
              <input
                type="number"
                className={controlClass}
                style={controlStyle}
                disabled={locked.has("maxLength")}
                value={field.maxLength ?? ""}
                placeholder="none"
                onChange={(e) => onChange({ maxLength: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm" style={{ color: "var(--foreground)" }}>
              <input
                type="checkbox"
                disabled={locked.has("autoFit")}
                checked={field.autoFit ?? false}
                onChange={(e) => onChange({ autoFit: e.target.checked || undefined })}
              />
              Auto-shrink to fit
            </label>
          </div>
        )}
        {field.type === "image" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>Crop ratio (w/h)</label>
              <input
                type="number"
                step="0.01"
                className={controlClass}
                style={controlStyle}
                value={field.aspectRatio ?? ""}
                placeholder={`box: ${(field.width / field.height).toFixed(2)}`}
                onChange={(e) => onChange({ aspectRatio: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Fit</label>
              <select
                className={controlClass}
                style={controlStyle}
                value={field.objectFit ?? "cover"}
                onChange={(e) => onChange({ objectFit: e.target.value as TemplateField["objectFit"] })}
              >
                <option value="cover">Cover (fill box)</option>
                <option value="contain">Contain (fit inside)</option>
              </select>
            </div>
          </div>
        )}
        {field.type === "select" && (
          <div>
            <label className={labelClass} style={labelStyle}>Options (one per line)</label>
            <textarea
              rows={3}
              className={controlClass}
              style={controlStyle}
              value={(field.options ?? []).join("\n")}
              onChange={(e) =>
                onChange({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })
              }
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>Placeholder</label>
            <input
              className={controlClass}
              style={controlStyle}
              value={field.placeholder ?? ""}
              onChange={(e) => onChange({ placeholder: e.target.value || undefined })}
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm" style={{ color: "var(--foreground)" }}>
            <input
              type="checkbox"
              checked={field.required ?? false}
              onChange={(e) => onChange({ required: e.target.checked || undefined })}
            />
            Required
          </label>
        </div>
      </div>
    </div>
  );
}

interface TextStylingProps {
  field: TemplateField;
  kit: BrandKit | null;
  customFamilies: string[];
  /** Properties fixed by the bound brand type style — rendered disabled. */
  locked: Set<string>;
  onChange(patch: Partial<TemplateField>): void;
}

/** Locked styling: font family choices are the brand kit's fonts + custom
 * uploads + curated Google list; colors are ONLY brand palette keys. */
function TextStyling({ field, kit, customFamilies, locked, onChange }: TextStylingProps) {
  const brandFamilies = [
    ...new Set(
      [kit?.headingFont?.family, kit?.bodyFont?.family, ...customFamilies].filter(
        (f): f is string => Boolean(f),
      ),
    ),
  ];
  const otherFamilies = GOOGLE_FONTS.filter((f) => !brandFamilies.includes(f));

  return (
    <div className="pt-2 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
      <h4 className="sp-eyebrow">Locked styling</h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelClass} style={labelStyle}>Font</label>
          <select
            className={controlClass}
            style={controlStyle}
            disabled={locked.has("fontFamily")}
            value={field.fontFamily ?? ""}
            onChange={(e) => onChange({ fontFamily: e.target.value || undefined })}
          >
            <option value="">Default (sans-serif)</option>
            {brandFamilies.length > 0 && (
              <optgroup label="Brand fonts">
                {brandFamilies.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Google Fonts">
              {otherFamilies.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Weight</label>
          <select
            className={controlClass}
            style={controlStyle}
            disabled={locked.has("weight")}
            value={field.fontWeight ?? ""}
            onChange={(e) => onChange({ fontWeight: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">Default</option>
            {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Size (px)</label>
          <input
            type="number"
            className={controlClass}
            style={controlStyle}
            disabled={locked.has("fontSizePx")}
            value={field.fontSizePx ?? 45}
            onChange={(e) => onChange({ fontSizePx: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Min size (auto-fit)</label>
          <input
            type="number"
            className={controlClass}
            style={controlStyle}
            value={field.minFontSizePx ?? ""}
            placeholder="18"
            onChange={(e) => onChange({ minFontSizePx: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div className="col-span-2 space-y-2">
          <label className={labelClass} style={labelStyle}>Color</label>
          <ColorControl
            ariaLabel="Field text color"
            value={field.colorHex ?? kit?.colors.find((c) => c.key === field.colorKey)?.hex}
            onChange={(hex) =>
              !locked.has("colorKey") &&
              onChange({ colorHex: hex, colorKey: undefined, textGradient: undefined })
            }
          />
          {(kit?.colors.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="sp-eyebrow" style={{ fontSize: 9 }}>Brand</span>
              {(kit?.colors ?? []).map((c) => (
                <button
                  key={c.key}
                  title={`${c.name} — click to use`}
                  disabled={locked.has("colorKey")}
                  onClick={() => onChange({ colorKey: c.key, colorHex: undefined, textGradient: undefined })}
                  className="w-5 h-5 rounded-md border-2 transition-transform hover:scale-110 cursor-pointer"
                  style={{
                    background: c.hex,
                    borderColor: field.colorKey === c.key ? "var(--ring)" : "var(--hairline)",
                  }}
                />
              ))}
            </div>
          )}
          <GradientEditor
            gradient={field.textGradient}
            disabled={locked.has("colorKey")}
            onChange={(textGradient) => onChange({ textGradient })}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Align</label>
          <select
            className={controlClass}
            style={controlStyle}
            value={field.align ?? "left"}
            onChange={(e) => onChange({ align: e.target.value as TemplateField["align"] })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
        <div className="flex items-end gap-4 pb-2">
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--foreground)" }}>
            <input
              type="checkbox"
              disabled={locked.has("uppercase")}
              checked={field.uppercase ?? false}
              onChange={(e) => onChange({ uppercase: e.target.checked || undefined })}
            />
            Uppercase
          </label>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Letter spacing</label>
          <input
            type="number"
            step="0.1"
            className={controlClass}
            style={controlStyle}
            disabled={locked.has("letterSpacingPx")}
            value={field.letterSpacingPx ?? ""}
            placeholder="0"
            onChange={(e) => onChange({ letterSpacingPx: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Line height</label>
          <input
            type="number"
            step="0.05"
            className={controlClass}
            style={controlStyle}
            disabled={locked.has("lineHeight")}
            value={field.lineHeight ?? ""}
            placeholder="1.1"
            onChange={(e) => onChange({ lineHeight: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      </div>
    </div>
  );
}


interface GradientEditorProps {
  gradient: TextGradient | undefined;
  disabled: boolean;
  onChange(gradient: TextGradient | undefined): void;
}

/** Optional text-fill gradient: toggle, per-stop hex-first color controls,
 * stop positions, and angle. Wins over the solid color when enabled. */
function GradientEditor({ gradient, disabled, onChange }: GradientEditorProps) {
  const enabled = Boolean(gradient);
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--ink)" }}>
        <input
          type="checkbox"
          disabled={disabled}
          checked={enabled}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? {
                    angle: 90,
                    stops: [
                      { position: 0, color: "#FF8300" },
                      { position: 1, color: "#FF5A72" },
                    ],
                  }
                : undefined,
            )
          }
        />
        Gradient fill
      </label>
      {gradient && (
        <div className="space-y-1.5 pl-5">
          {gradient.stops.map((stop, i) => (
            <div key={i} className="flex items-center gap-2">
              <ColorControl
                ariaLabel={`Gradient stop ${i + 1}`}
                size={24}
                value={stop.color}
                onChange={(color) =>
                  onChange({
                    ...gradient,
                    stops: gradient.stops.map((st, j) => (j === i ? { ...st, color } : st)),
                  })
                }
              />
              <input
                type="number"
                min={0}
                max={100}
                className="sp-input"
                style={{ width: 62, padding: "4px 6px", fontSize: 11 }}
                value={Math.round(stop.position * 100)}
                title="Stop position (%)"
                onChange={(e) =>
                  onChange({
                    ...gradient,
                    stops: gradient.stops.map((st, j) =>
                      j === i ? { ...st, position: Math.min(100, Math.max(0, Number(e.target.value))) / 100 } : st,
                    ),
                  })
                }
              />
              {gradient.stops.length > 2 && (
                <button
                  onClick={() => onChange({ ...gradient, stops: gradient.stops.filter((_, j) => j !== i) })}
                  style={{ fontSize: 11, color: "var(--fg-3)" }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                onChange({ ...gradient, stops: [...gradient.stops, { position: 1, color: "#FFED8C" }] })
              }
              style={{ fontSize: 11, color: "var(--solar)" }}
            >
              + Add stop
            </button>
            <label className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--fg-2)" }}>
              Angle
              <input
                type="number"
                className="sp-input"
                style={{ width: 62, padding: "4px 6px", fontSize: 11 }}
                value={gradient.angle}
                onChange={(e) => onChange({ ...gradient, angle: Number(e.target.value) })}
              />
              °
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
