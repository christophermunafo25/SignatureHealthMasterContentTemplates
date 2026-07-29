import React, { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { BrandKit, FieldValues, TemplateField, TemplateSchema } from "@/lib/types";
import { mergeCaption } from "@/lib/caption";
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
  return template.fields.filter((f) => !f.static && f.required && !values[f.fieldKey]);
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
}: TemplateFillLayoutProps) {
  const [copied, setCopied] = useState(false);

  const suggestedCaption = mergeCaption(template, values);
  const shownCaption = caption ?? suggestedCaption;

  // Static elements are baked into the graphic — they are never form fields.
  const formFields = useMemo(() => template.fields.filter((f) => !f.static), [template]);

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
            <button onClick={handleCopy} className="sp-btn sp-btn-ghost w-full">
              {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
              {copied ? "Copied" : "Copy caption"}
            </button>
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
              {template.canvasWidth}×{template.canvasHeight} · live
            </span>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--paper-warm)", border: "1px solid var(--hairline)" }}>
            <SchemaRenderer
              ref={rendererRef}
              schema={template}
              values={values}
              brandKit={brandKit}
              instrument={instrument}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
