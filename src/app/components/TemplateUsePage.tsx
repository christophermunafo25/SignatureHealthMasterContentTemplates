import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Download, RefreshCw } from "lucide-react";
import type { FieldValues, TemplateSchema } from "@/lib/types";
import { stores } from "@/lib/stores";
import { mergeCaption } from "@/lib/caption";
import { useBrand } from "@/lib/brand/BrandContext";
import { useRouter } from "../router";
import { SchemaRenderer, type SchemaRendererHandle } from "./SchemaRenderer";
import { FieldInput } from "./FieldInput";

/** Member self-service flow: fields on the left, live preview on the right
 * (the reference two-column layout), suggested caption, PNG download.
 * Members change field CONTENT only — layout and styling are locked. */
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
    return <p className="text-center py-24 text-sm" style={{ color: "var(--muted-foreground)" }}>Loading template…</p>;
  }
  if (!template) {
    return <p className="text-center py-24 text-sm" style={{ color: "var(--muted-foreground)" }}>Template not found.</p>;
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
    <div className="max-w-6xl mx-auto px-6 py-8 lg:py-10">
      <button
        onClick={() => navigate({ name: "portal" })}
        className="flex items-center gap-1.5 mb-6 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors"
        style={{ color: "var(--muted-foreground)" }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All Templates
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left — field form */}
        <div className="lg:col-span-5 space-y-5">
          <div>
            <h1 className="font-extrabold uppercase text-xl" style={{ color: "var(--foreground)" }}>{template.name}</h1>
            {template.description && (
              <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>{template.description}</p>
            )}
          </div>

          {template.fields.map((field, i) => (
            <div
              key={field.id}
              className="bg-white rounded-2xl border p-5 shadow-sm space-y-3"
              style={{ borderColor: "var(--border)" }}
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--primary)" }}>
                  Step {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="font-extrabold uppercase text-[15px] mt-0.5" style={{ color: "var(--foreground)" }}>
                  {field.label}
                  {field.required && <span style={{ color: "var(--destructive)" }}> *</span>}
                </h2>
                {field.maxLength && (
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {(values[field.fieldKey] ?? "").length}/{field.maxLength} characters
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
            <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between">
                <h2 className="font-extrabold uppercase text-[15px]" style={{ color: "var(--foreground)" }}>
                  Suggested Caption
                </h2>
                {caption !== null && (
                  <button
                    onClick={() => setCaption(null)}
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--primary)" }}
                  >
                    Reset to suggestion
                  </button>
                )}
              </div>
              <textarea
                value={shownCaption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                style={{ borderColor: "var(--border)", background: "var(--input-background)", color: "var(--foreground)" }}
              />
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 border-2 font-bold uppercase text-xs tracking-[0.18em] py-3 rounded-xl transition-all"
                style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Caption"}
              </button>
            </div>
          )}

          {/* Download */}
          <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-2" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={handleDownload}
              disabled={exporting || missingRequired.length > 0}
              className="w-full font-bold uppercase text-xs tracking-[0.18em] py-4 rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-md disabled:opacity-50"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? "Generating…" : "Download Graphic"}
            </button>
            {missingRequired.length > 0 && (
              <p className="text-[11px] text-center" style={{ color: "var(--muted-foreground)" }}>
                Fill required: {missingRequired.map((f) => f.label).join(", ")}
              </p>
            )}
          </div>
        </div>

        {/* Right — live preview */}
        <div className="lg:col-span-7 lg:sticky lg:top-8">
          <div className="bg-white rounded-3xl border shadow-lg p-6" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold uppercase text-sm" style={{ color: "var(--foreground)" }}>Preview</h3>
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
                {template.canvasWidth}×{template.canvasHeight} · Live
              </span>
            </div>
            <div className="rounded-2xl overflow-hidden border-4 border-white shadow-inner" style={{ background: "var(--secondary)" }}>
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
