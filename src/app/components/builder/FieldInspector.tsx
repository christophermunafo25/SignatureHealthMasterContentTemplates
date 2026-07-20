import React from "react";
import { Trash2 } from "lucide-react";
import type { BrandKit, FieldType, TemplateField } from "@/lib/types";
import { useBrand } from "@/lib/brand/BrandContext";
import { GOOGLE_FONTS } from "@/lib/render/fonts";
import { suggestFieldKey } from "@/lib/caption";

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
  { value: "location", label: "Location logo" },
];

const labelClass = "text-[10px] font-bold uppercase tracking-wider block mb-1";
const labelStyle: React.CSSProperties = { color: "var(--muted-foreground)" };
const controlClass = "w-full rounded-lg border px-2.5 py-2 text-sm";
const controlStyle: React.CSSProperties = {
  borderColor: "var(--border)",
  background: "var(--input-background)",
  color: "var(--foreground)",
};

/** Inspector for the selected field: label/type, locked styling (fonts and
 * colors come from the brand kit — never free values), and guardrails. */
export function FieldInspector({ field, allFields, onChange, onDelete }: FieldInspectorProps) {
  const { kit, assets } = useBrand();
  const isText = field.type === "text" || field.type === "multiline" || field.type === "select";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold uppercase text-sm" style={{ color: "var(--foreground)" }}>Field settings</h3>
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

      {isText && <TextStyling field={field} kit={kit} onChange={onChange} customFamilies={
        assets.filter((a) => a.kind === "font").map((a) => a.metadata.family ?? a.name)
      } />}

      {/* Guardrails */}
      <div className="pt-2 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
        <h4 className="font-extrabold uppercase text-[11px]" style={{ color: "var(--foreground)" }}>Guardrails</h4>
        {isText && field.type !== "select" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>Max characters</label>
              <input
                type="number"
                className={controlClass}
                style={controlStyle}
                value={field.maxLength ?? ""}
                placeholder="none"
                onChange={(e) => onChange({ maxLength: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm" style={{ color: "var(--foreground)" }}>
              <input
                type="checkbox"
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
  onChange(patch: Partial<TemplateField>): void;
}

/** Locked styling: font family choices are the brand kit's fonts + custom
 * uploads + curated Google list; colors are ONLY brand palette keys. */
function TextStyling({ field, kit, customFamilies, onChange }: TextStylingProps) {
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
      <h4 className="font-extrabold uppercase text-[11px]" style={{ color: "var(--foreground)" }}>
        Locked styling
      </h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelClass} style={labelStyle}>Font</label>
          <select
            className={controlClass}
            style={controlStyle}
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
          <label className={labelClass} style={labelStyle}>Size (px)</label>
          <input
            type="number"
            className={controlClass}
            style={controlStyle}
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
        <div className="col-span-2">
          <label className={labelClass} style={labelStyle}>Color (brand palette)</label>
          <div className="flex flex-wrap gap-2">
            {(kit?.colors ?? []).map((c) => (
              <button
                key={c.key}
                title={c.name}
                onClick={() => onChange({ colorKey: c.key })}
                className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-105"
                style={{
                  background: c.hex,
                  borderColor: field.colorKey === c.key ? "var(--ring)" : "transparent",
                }}
              />
            ))}
            {!kit?.colors.length && (
              <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                No brand palette yet — set colors in Brand Studio.
              </p>
            )}
          </div>
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
            value={field.lineHeight ?? ""}
            placeholder="1.1"
            onChange={(e) => onChange({ lineHeight: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      </div>
    </div>
  );
}
