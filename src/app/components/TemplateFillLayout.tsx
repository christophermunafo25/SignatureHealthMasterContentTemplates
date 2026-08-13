import React, { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { BrandKit, FacilitySnapshot, FieldValues, TemplateField, TemplateSchema } from "@/lib/types";
import { mergeCaption } from "@/lib/caption";
import { isFormField } from "@/lib/fields";
import { resolveFieldStyle } from "@/lib/brand/resolveStyle";
import { SchemaRenderer, type SchemaRendererHandle } from "./SchemaRenderer";
import { FieldInput } from "./FieldInput";

const panel: React.CSSProperties = {
  background: "var(--lift)",
  border: "1px solid var(--hairline)",
  borderRadius: 12,
};

/** Fields still empty that the template requires — shared by every action
 * panel (member download, facility submit, review edits). */
export function missingRequiredFields(template: TemplateSchema, values: FieldValues): TemplateField[] {
  return template.fields.filter((f) => isFormField(f) && f.required && !values[f.fieldKey]);
}

/** True when the template carries a facility_logo element — the fill
 * surfaces show a facility picker exactly when this is true. */
export function needsFacility(template: TemplateSchema): boolean {
  return template.fields.some((f) => f.type === "facility_logo");
}

export interface TemplateFillLayoutProps {
  template: TemplateSchema;
  brandKit: BrandKit | null;
  values: FieldValues;
  onChange(fieldKey: string, value: string): void;
  /** null → follow the merged suggestion. */
  caption: string | null;
  onCaptionEdit(caption: string | null): void;
  /** Action panel content rendered under the form (download, submit, review
   * actions) — the ONLY part of this screen the three composers differ on. */
  actions: React.ReactNode;
  rendererRef?: React.Ref<SchemaRendererHandle>;
  /** Record open/download usage events (default true). */
  instrument?: boolean;
  /** Optional per-field accessory (the review screen's revert control). */
  fieldAccessory?: (field: TemplateField) => React.ReactNode;
  /** Header block above the fields; defaults to template name + description. */
  header?: React.ReactNode;
  /** Show the copy-to-clipboard control on the caption panel.
   *  Facility users submit rather than post, so they never need it. */
  allowCaptionCopy?: boolean;
  /** Preview panel eyebrow; defaults to the canvas dimensions. The public
   * screen replaces builder language with what the panel actually is. */
  previewHint?: string;
  /** Facility in context for facility_logo elements — forwarded to the
   * renderer and the caption merge. */
  facility?: FacilitySnapshot | null;
}

/** The shared body of every template-fill surface: field form + caption on
 * the left, live preview on the right. Extracted from TemplateUsePage so the
 * authenticated page, the public facility page, and the review detail page
 * compose ONE implementation instead of forking it (the forks would drift
 * within a month). */
export function TemplateFillLayout({
  template,
  brandKit,
  values,
  onChange,
  caption,
  onCaptionEdit,
  actions,
  rendererRef,
  instrument = true,
  fieldAccessory,
  header,
  allowCaptionCopy = true,
  previewHint,
  facility,
}: TemplateFillLayoutProps) {
  const [copied, setCopied] = useState(false);

  const suggestedCaption = mergeCaption(template, values, facility);
  const shownCaption = caption ?? suggestedCaption;

  // Static elements are baked into the graphic and facility logos resolve
  // automatically — neither is ever a form field.
  const formFields = useMemo(() => template.fields.filter(isFormField), [template]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shownCaption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left — field form */}
      <div className="lg:col-span-5 space-y-4">
        {header ?? (
          <div>
            <h1 className="sp-page-title">{template.name}</h1>
            {template.description && (
              <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>{template.description}</p>
            )}
          </div>
        )}

        {formFields.map((field, i) => {
          const maxLength = resolveFieldStyle(field, brandKit).maxLength;
          const inputId = `field-${field.id}`;
          return (
            <div key={field.id} className="p-4 space-y-2.5" style={panel}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="sp-eyebrow">Step {String(i + 1).padStart(2, "0")}</p>
                  <label
                    htmlFor={inputId}
                    className="block"
                    style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", marginTop: 2 }}
                  >
                    {field.label}
                    {field.required && (
                      <>
                        <span aria-hidden style={{ color: "var(--solar)" }}> *</span>
                        <span className="sr-only"> (required)</span>
                      </>
                    )}
                  </label>
                  {maxLength && (
                    <p
                      role="status"
                      aria-live="polite"
                      aria-label={`${(values[field.fieldKey] ?? "").length} of ${maxLength} characters used`}
                      style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginTop: 2 }}
                    >
                      {(values[field.fieldKey] ?? "").length}/{maxLength}
                    </p>
                  )}
                </div>
                {fieldAccessory?.(field)}
              </div>
              <FieldInput
                field={{ ...field, maxLength }}
                value={values[field.fieldKey] ?? ""}
                onChange={(v) => onChange(field.fieldKey, v)}
                inputId={inputId}
              />
            </div>
          );
        })}

        {/* Suggested caption */}
        {template.captionTemplate && (
          <div className="p-4 space-y-2.5" style={panel}>
            <div className="flex items-center justify-between">
              <h2 className="sp-panel-title">Suggested caption</h2>
              {caption !== null && (
                <button
                  onClick={() => onCaptionEdit(null)}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--solar)" }}
                >
                  Reset to suggestion
                </button>
              )}
            </div>
            <textarea
              value={shownCaption}
              onChange={(e) => onCaptionEdit(e.target.value)}
              rows={4}
              aria-label="Suggested caption"
              className="sp-input"
              style={{ resize: "vertical" }}
            />
            {allowCaptionCopy && (
              <button onClick={handleCopy} className="sp-btn sp-btn-ghost w-full">
                {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                {copied ? "Copied" : "Copy caption"}
              </button>
            )}
          </div>
        )}

        {/* Action panel — download / submit / review, per composer */}
        <div className="p-4 space-y-2" style={panel}>
          {actions}
        </div>
      </div>

      {/* Right — live preview */}
      <div className="lg:col-span-7 lg:sticky lg:top-8">
        <div className="p-5" style={{ ...panel, boxShadow: "var(--shadow-e2)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="sp-panel-title">Preview</h3>
            <span className="sp-eyebrow">
              {previewHint ?? `${template.canvasWidth}×${template.canvasHeight} · live`}
            </span>
          </div>
          <div
            className="rounded-xl overflow-hidden mx-auto w-full"
            style={{
              background: "var(--surface-sunken)",
              border: "1px solid var(--hairline)",
              // A 1080×1920 Story must not run past a laptop viewport: cap
              // portrait previews by width so height lands near 70vh and the
              // renderer scales down.
              ...(template.canvasHeight > template.canvasWidth
                ? { maxWidth: `calc(70vh * ${(template.canvasWidth / template.canvasHeight).toFixed(4)})` }
                : {}),
            }}
          >
            <SchemaRenderer
              ref={rendererRef}
              schema={template}
              values={values}
              brandKit={brandKit}
              instrument={instrument}
              facility={facility}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
