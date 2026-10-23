import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, RefreshCw } from "lucide-react";
import type { FieldValues, TemplateSchema } from "@/lib/types";
import { isFormField } from "@/lib/fields";
import { HOF_NAME_KEY, HOF_PHOTO_KEY, exportNameFor, type HallOfFameTemplate } from "@/lib/hallOfFame";
import { displayText, fitTemplate } from "@/lib/hallOfFameFit";
import { type SchemaRendererHandle } from "../SchemaRenderer";
import { TemplateFillLayout } from "../TemplateFillLayout";
import { FillSkeleton } from "./HallOfFameSkeleton";
import { useAssetsReady, useMeasurers } from "./useHallOfFameAssets";

type Toast = "downloaded" | "shared" | "error";

/** Fill one Hall of Fame template and download the PNG. The body is the
 * portal's TemplateFillLayout (the same form, crop, and preview facilities
 * already use); this file owns the fitting and the download. No caption, no
 * questions, no submission, no usage events. */
export function HallOfFameFill({ template, onBack }: { template: HallOfFameTemplate; onBack(): void }) {
  const templates = useMemo(() => [template], [template]);
  const ready = useAssetsReady(templates);
  const measurers = useMeasurers(ready);
  const [values, setValues] = useState<FieldValues>({});
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const rendererRef = useRef<SchemaRendererHandle>(null);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // What the graphic renders: display text (trimmed, single spaces), and this
  // template's placeholder photo until a real one is in. `values` stays
  // exactly as typed, for the form and the required check.
  const previewValues = useMemo<FieldValues>(() => {
    const out: FieldValues = {};
    for (const [key, value] of Object.entries(values)) out[key] = key === HOF_PHOTO_KEY ? value : displayText(value);
    out[HOF_PHOTO_KEY] = values[HOF_PHOTO_KEY] || template.photoPlaceholder;
    return out;
  }, [values, template]);

  const previewTemplate = useMemo<TemplateSchema>(
    () => ({
      ...fitTemplate(template, previewValues, measurers),
      // schema.name becomes the download file name (Hall_of_Fame_<name>.png).
      name: exportNameFor(values[HOF_NAME_KEY]),
    }),
    [template, previewValues, measurers, values],
  );

  // Required means more than spaces: a blank name would export the
  // placeholder text.
  const missing = useMemo(
    () => template.schema.fields.filter((f) => isFormField(f) && f.required && !(values[f.fieldKey] ?? "").trim()),
    [template, values],
  );

  if (!ready) return <FillSkeleton />;

  const showToast = (kind: Toast) => {
    window.clearTimeout(toastTimer.current);
    setToast(kind);
    toastTimer.current = window.setTimeout(() => setToast(null), kind === "error" ? 6000 : 4000);
  };

  const handleDownload = async () => {
    if (!rendererRef.current || missing.length > 0) return;
    setExporting(true);
    try {
      const outcome = await rendererRef.current.exportPng();
      // Closing the share sheet needs no confirmation of anything.
      if (outcome !== "canceled") showToast(outcome);
    } catch (e) {
      console.error("Hall of Fame export failed", e);
      showToast("error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6">
      {toast && (
        <div
          className="sp-toast"
          data-tone={toast === "error" ? "danger" : undefined}
          role={toast === "error" ? "alert" : "status"}
          aria-live={toast === "error" ? "assertive" : "polite"}
        >
          {toast === "error" ? (
            <AlertTriangle style={{ width: 16, height: 16, color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
          ) : (
            <CheckCircle2 style={{ width: 16, height: 16, color: "var(--success)", flexShrink: 0, marginTop: 1 }} />
          )}
          <span className="min-w-0">
            <span className="block" style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
              {toast === "downloaded" && "Graphic downloaded"}
              {toast === "shared" && "Graphic shared"}
              {toast === "error" && "Couldn't create the graphic"}
            </span>
            {toast === "error" && (
              <span className="block" style={{ fontSize: 13, color: "var(--fg-3)" }}>
                Try again.
              </span>
            )}
          </span>
        </div>
      )}

      {/* Light-on-navy: this page sits on the brand wash. The padding and
          matching negative margin grow the tap target to 45px without
          moving anything. */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5"
        style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", padding: "11px 0", margin: "-11px 0 9px" }}
      >
        <ArrowLeft style={{ width: 14, height: 14 }} />
        All templates
      </button>

      <TemplateFillLayout
        header={
          <div>
            <p className="sp-eyebrow mb-2" style={{ color: "var(--mint)" }}>
              Hall of Fame · {template.schema.category}
            </p>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                fontSize: "clamp(19px, 2.6vw, 30px)",
                lineHeight: 1.1,
                color: "#ffffff",
              }}
            >
              {template.schema.name}
            </h1>
          </div>
        }
        template={template.schema}
        previewTemplate={previewTemplate}
        previewValues={previewValues}
        brandKit={null}
        values={values}
        onChange={(fieldKey, v) => setValues((prev) => ({ ...prev, [fieldKey]: v }))}
        caption={null}
        onCaptionEdit={() => undefined}
        rendererRef={rendererRef}
        instrument={false}
        allowCaptionCopy={false}
        previewHint="1080×1080 PNG"
        // Download is the last step, so on a phone the finished graphic sits
        // right above it.
        previewAboveActionsOnMobile
        actions={
          <>
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={exporting || missing.length > 0}
              aria-describedby={missing.length > 0 ? "hof-download-blocked" : undefined}
              className="sp-btn sp-btn-primary w-full"
              style={{ padding: "11px 14px" }}
            >
              {exporting ? (
                <RefreshCw className="animate-spin" style={{ width: 14, height: 14 }} />
              ) : (
                <Download style={{ width: 14, height: 14 }} />
              )}
              {exporting ? "Generating…" : "Download graphic"}
            </button>
            {missing.length > 0 && (
              <p
                id="hof-download-blocked"
                role="status"
                aria-live="polite"
                className="text-center"
                style={{ fontSize: 13, color: "var(--fg-3)" }}
              >
                Still needed: {missing.map((f) => f.label).join(", ")}
              </p>
            )}
          </>
        }
      />
    </div>
  );
}
