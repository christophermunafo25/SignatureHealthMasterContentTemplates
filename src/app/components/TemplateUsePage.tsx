import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, RefreshCw } from "lucide-react";
import type { FieldValues } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useBrand } from "@/lib/brand/BrandContext";
import { useRouter } from "../router";
import { ErrorState } from "./ErrorState";
import { type SchemaRendererHandle } from "./SchemaRenderer";
import { TemplateFillLayout, missingRequiredFields } from "./TemplateFillLayout";

/** Member self-service flow: fields on the left, live preview on the right,
 * suggested caption, PNG download. Members change field CONTENT only.
 * The body is TemplateFillLayout, shared with the public facility page and
 * the review detail page — this file owns only the download action. */
export function TemplateUsePage({ templateId }: { templateId: string }) {
  const { kit } = useBrand();
  const { navigate } = useRouter();
  const templateState = useAsync(() => stores.templates.get(templateId), [templateId]);
  const template = templateState.status === "ready" ? templateState.data : null;
  const [values, setValues] = useState<FieldValues>({});
  const [caption, setCaption] = useState<string | null>(null); // null → follow suggestion
  const [exporting, setExporting] = useState(false);
  /** Post-export feedback toast; auto-dismisses. */
  const [exportToast, setExportToast] = useState<"downloaded" | "shared" | "error" | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const rendererRef = useRef<SchemaRendererHandle>(null);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const showToast = (kind: "downloaded" | "shared" | "error") => {
    window.clearTimeout(toastTimer.current);
    setExportToast(kind);
    toastTimer.current = window.setTimeout(() => setExportToast(null), kind === "error" ? 6000 : 4000);
  };

  const missingRequired = useMemo(
    () => (template ? missingRequiredFields(template, values) : []),
    [template, values],
  );

  if (templateState.status === "loading") {
    return <p className="text-center py-24" style={{ fontSize: 13, color: "var(--fg-3)" }}>Loading template…</p>;
  }
  if (templateState.status === "error") {
    return (
      <ErrorState
        title="We couldn't load this template."
        detail="Check your connection and try again."
        onRetry={templateState.retry}
      />
    );
  }
  if (!template) {
    return <p className="text-center py-24" style={{ fontSize: 13, color: "var(--fg-3)" }}>Template not found.</p>;
  }

  const handleDownload = async () => {
    if (!rendererRef.current) return;
    setExporting(true);
    try {
      const outcome = await rendererRef.current.exportPng();
      // Canceling the share sheet needs no confirmation of anything.
      if (outcome !== "canceled") showToast(outcome);
    } catch (e) {
      console.error("Export failed", e);
      showToast("error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {exportToast && (
        <div
          className="sp-toast"
          data-tone={exportToast === "error" ? "danger" : undefined}
          role={exportToast === "error" ? "alert" : "status"}
          aria-live={exportToast === "error" ? "assertive" : "polite"}
        >
          {exportToast === "error" ? (
            <AlertTriangle style={{ width: 16, height: 16, color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
          ) : (
            <CheckCircle2 style={{ width: 16, height: 16, color: "var(--success)", flexShrink: 0, marginTop: 1 }} />
          )}
          <span className="min-w-0">
            <span className="block" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
              {exportToast === "downloaded" && "Graphic downloaded"}
              {exportToast === "shared" && "Graphic shared"}
              {exportToast === "error" && "Couldn't export the graphic"}
            </span>
            <span className="block" style={{ fontSize: 12, color: "var(--fg-3)" }}>
              {exportToast === "downloaded" && "It's in your downloads folder, ready to post."}
              {exportToast === "shared" && "Sent through your device's share sheet."}
              {exportToast === "error" && "Try again — if it keeps failing, re-upload the photo."}
            </span>
          </span>
        </div>
      )}
      <button
        onClick={() => navigate({ name: "portal" })}
        className="flex items-center gap-1.5 mb-5"
        style={{ fontSize: 13, color: "var(--fg-2)" }}
      >
        <ArrowLeft style={{ width: 14, height: 14 }} />
        Published Templates
      </button>

      <TemplateFillLayout
        template={template}
        brandKit={kit}
        values={values}
        onChange={(fieldKey, v) => setValues((prev) => ({ ...prev, [fieldKey]: v }))}
        caption={caption}
        onCaptionEdit={setCaption}
        rendererRef={rendererRef}
        actions={
          <>
            <button
              onClick={handleDownload}
              disabled={exporting || missingRequired.length > 0}
              aria-describedby={missingRequired.length > 0 ? "download-blocked-reason" : undefined}
              className="sp-btn sp-btn-primary w-full"
              style={{ padding: "11px 14px" }}
            >
              {exporting ? <RefreshCw className="animate-spin" style={{ width: 14, height: 14 }} /> : <Download style={{ width: 14, height: 14 }} />}
              {exporting ? "Generating…" : "Download graphic"}
            </button>
            {missingRequired.length > 0 && (
              <p
                id="download-blocked-reason"
                role="status"
                aria-live="polite"
                className="text-center"
                style={{ fontSize: 12, color: "var(--fg-3)" }}
              >
                Fill required: {missingRequired.map((f) => f.label).join(", ")}
              </p>
            )}
          </>
        }
      />
    </div>
  );
}
