import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Download, RefreshCw } from "lucide-react";
import type { FieldValues, TemplateSchema } from "@/lib/types";
import { stores } from "@/lib/stores";
import { mergeCaption } from "@/lib/caption";
import { useBrand } from "@/lib/brand/BrandContext";
import { useRouter } from "../router";
import { SchemaRenderer, type SchemaRendererHandle } from "./SchemaRenderer";
import { FieldInput } from "./FieldInput";

const panel: React.CSSProperties = {
  background: "var(--lift)",
  border: "1px solid var(--hairline)",
  borderRadius: 12,
};

/** Member self-service flow: fields on the left, live preview on the right,
 * suggested caption, PNG download. Members change field CONTENT only. */
export function TemplateUsePage({ templateId }: { templateId: string }) {
  const { kit, locations } = useBrand();
  const { navigate } = useRouter();
  const [template, setTemplate] = useState<TemplateSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<FieldValues>({});
  const [caption, setCaption] = useState<string | null>(null); // null → follow suggestion
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const rendererRef = useRef<SchemaRendererHandle>(null);

  useEffect(() => {
    setLoading(true);
    stores.templates
      .get(templateId)
      .then(setTemplate)
      .catch((e) => console.error("Template load failed", e))
      .finally(() => setLoading(false));
  }, [templateId]);

  const locationNames = useMemo(
    () => Object.fromEntries(locations.map((l) => [l.id, l.name])),
    [locations],
  );
  const suggestedCaption = template ? mergeCaption(template, values, locationNames) : "";
  const shownCaption = caption ?? suggestedCaption;

  const missingRequired = useMemo(
    () => (template?.fields ?? []).filter((f) => f.required && !values[f.fieldKey]),
    [template, values],
  );

  if (loading) {
    return <p className="text-center py-24" style={{ fontSize: 13, color: "var(--fg-3)" }}>Loading template…</p>;
  }
  if (!template) {
    return <p className="text-center py-24" style={{ fontSize: 13, color: "var(--fg-3)" }}>Template not found.</p>;
  }

  const handleDownload = async () => {
    if (!rendererRef.current) return;
    setExporting(true);
    try {
      await rendererRef.current.exportPng();
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shownCaption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <button
        onClick={() => navigate({ name: "portal" })}
        className="flex items-center gap-1.5 mb-5"
        style={{ fontSize: 13, color: "var(--fg-2)" }}
      >
        <ArrowLeft style={{ width: 14, height: 14 }} />
        All templates
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left — field form */}
        <div className="lg:col-span-5 space-y-4">
          <div>
            <h1 className="sp-page-title">{template.name}</h1>
            {template.description && (
              <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>{template.description}</p>
            )}
          </div>

          {template.fields.map((field, i) => (
            <div key={field.id} className="p-4 space-y-2.5" style={panel}>
              <div>
                <p className="sp-eyebrow">Step {String(i + 1).padStart(2, "0")}</p>
                <h2 style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", marginTop: 2 }}>
                  {field.label}
                  {field.required && <span style={{ color: "var(--solar)" }}> *</span>}
                </h2>
                {field.maxLength && (
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginTop: 2 }}>
                    {(values[field.fieldKey] ?? "").length}/{field.maxLength}
                  </p>
                )}
              </div>
              <FieldInput
                field={field}
                value={values[field.fieldKey] ?? ""}
                onChange={(v) => setValues((prev) => ({ ...prev, [field.fieldKey]: v }))}
                locations={locations}
              />
            </div>
          ))}

          {/* Suggested caption */}
          {template.captionTemplate && (
            <div className="p-4 space-y-2.5" style={panel}>
              <div className="flex items-center justify-between">
                <h2 className="sp-panel-title">Suggested caption</h2>
                {caption !== null && (
                  <button
                    onClick={() => setCaption(null)}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--solar)" }}
                  >
                    Reset to suggestion
                  </button>
                )}
              </div>
              <textarea
                value={shownCaption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                className="sp-input"
                style={{ resize: "vertical" }}
              />
              <button onClick={handleCopy} className="sp-btn sp-btn-ghost w-full">
                {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                {copied ? "Copied" : "Copy caption"}
              </button>
            </div>
          )}

          {/* Download */}
          <div className="p-4 space-y-2" style={panel}>
            <button
              onClick={handleDownload}
              disabled={exporting || missingRequired.length > 0}
              className="sp-btn sp-btn-primary w-full"
              style={{ padding: "11px 14px" }}
            >
              {exporting ? <RefreshCw className="animate-spin" style={{ width: 14, height: 14 }} /> : <Download style={{ width: 14, height: 14 }} />}
              {exporting ? "Generating…" : "Download graphic"}
            </button>
            {missingRequired.length > 0 && (
              <p className="text-center" style={{ fontSize: 12, color: "var(--fg-3)" }}>
                Fill required: {missingRequired.map((f) => f.label).join(", ")}
              </p>
            )}
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
                brandKit={kit}
                locations={locations}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
