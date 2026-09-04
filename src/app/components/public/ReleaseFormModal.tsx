import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, Send } from "lucide-react";
import type { PublicFacility } from "@/lib/publicClient";
import {
  isBlocked,
  questionNumberForField,
  validateReleaseForm,
  type ReleaseForm as ReleaseFormDoc,
  type ReleaseFormIssue,
} from "@/lib/releaseForm";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { ReleaseForm, type PendingAsset } from "./ReleaseForm";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export interface ReleaseFormModalProps {
  /** Rendered graphic shown in the fixed preview strip (object URL). */
  previewUrl: string | null;
  facilities: PublicFacility[];
  facility: PublicFacility | null;
  onSelectFacility(f: PublicFacility): void;
  onClearFacility(): void;
  submitterName: string;
  submitterEmail: string;
  onIdentityChange(patch: { submitterName?: string; submitterEmail?: string }): void;
  form: Partial<ReleaseFormDoc>;
  onChange(patch: Partial<ReleaseFormDoc>): void;
  assets: PendingAsset[];
  onAssetsChange(next: PendingAsset[]): void;
  uploading: boolean;
  submitting: boolean;
  uploadStatus: string | null;
  submitError: string | null;
  onSubmit(): void;
  onClose(): void;
}

/** The template path's release form, wrapped in a dialog at submit time —
 * the rendered graphic and the caption arrive pre-loaded, so it reads as a
 * continuation of the build rather than a second form. */
export function ReleaseFormModal(props: ReleaseFormModalProps) {
  const {
    previewUrl,
    facility,
    submitterName,
    submitterEmail,
    form,
    assets,
    uploading,
    submitting,
    uploadStatus,
    submitError,
    onSubmit,
    onClose,
  } = props;
  const [showIssues, setShowIssues] = useState(false);

  const issues = useMemo<ReleaseFormIssue[]>(
    () => validateReleaseForm(form, { hasGeneratedGraphic: true, assetCount: assets.length }),
    [form, assets.length],
  );
  const identityOk =
    facility !== null && submitterName.trim().length > 1 && EMAIL_RE.test(submitterEmail.trim());
  const blocked = isBlocked(issues) || !identityOk;
  const busy = uploading || submitting;

  // Blocked-reason line mirrors the fill page's "Still needed" pattern.
  const blockedReason = useMemo(() => {
    if (!showIssues || !blocked) return null;
    const needs = [
      ...(facility ? [] : ["your facility"]),
      ...(submitterName.trim().length > 1 ? [] : ["your name"]),
      ...(EMAIL_RE.test(submitterEmail.trim()) ? [] : ["your email"]),
      ...issues
        .filter((i) => i.severity === "blocking")
        .map((i) => questionNumberForField(i.field))
        .filter((n): n is string => n !== null)
        .map((n) => `Q${n}`),
    ];
    return needs.length ? `Still needed: ${[...new Set(needs)].join(", ")}` : null;
  }, [showIssues, blocked, facility, submitterName, submitterEmail, issues]);

  const handleSubmit = () => {
    if (blocked) {
      setShowIssues(true);
      const firstField = issues.find((i) => i.severity === "blocking")?.field;
      const anchor = firstField ? document.getElementById(`rf-${firstField}`) : null;
      anchor?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onSubmit();
  };

  // Escape must not tear the dialog down mid-upload.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && busy) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [busy]);

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        className="p-0 gap-0 flex flex-col sm:max-w-[720px] sm:max-h-[90vh] max-sm:top-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-full max-sm:rounded-none max-sm:border-0"
        style={{ background: "var(--linen)" }}
        onInteractOutside={(e) => busy && e.preventDefault()}
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-start justify-between gap-3 flex-shrink-0"
          style={{ background: "var(--lift)", borderBottom: "1px solid var(--hairline)" }}
        >
          <div>
            <DialogTitle
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: 16,
                color: "var(--ink)",
              }}
            >
              A few last questions
            </DialogTitle>
            <DialogDescription style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 2 }}>
              The Agency needs these answers before anything is posted.
            </DialogDescription>
          </div>
          {/* Radix's built-in close X sits top-right; onOpenChange guards it
              against closing mid-upload. */}
        </div>

        {/* Fixed preview strip — what makes this feel like a continuation */}
        <div
          className="px-5 py-3 flex items-center gap-3 flex-shrink-0"
          style={{ background: "var(--lift)", borderBottom: "1px solid var(--hairline)" }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Your graphic, attached to this submission"
              className="flex-shrink-0 object-cover"
              style={{ width: 52, height: 52, borderRadius: 8, border: "1px solid var(--hairline)" }}
            />
          ) : (
            <span
              className="flex-shrink-0"
              style={{ width: 52, height: 52, borderRadius: 8, background: "var(--surface-sunken)", border: "1px solid var(--hairline)" }}
            />
          )}
          <span className="min-w-0">
            <span className="block" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              Your graphic is attached
            </span>
            <span className="block truncate" style={{ fontSize: 12, color: "var(--fg-3)" }}>
              {facility ? facility.name : "Choose your facility below"}
            </span>
          </span>
        </div>

        {/* Scrolling form body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <ReleaseForm
            facilities={props.facilities}
            facility={facility}
            onSelectFacility={props.onSelectFacility}
            onClearFacility={props.onClearFacility}
            submitterName={submitterName}
            submitterEmail={submitterEmail}
            onIdentityChange={props.onIdentityChange}
            form={form}
            onChange={props.onChange}
            hasGeneratedGraphic
            graphicPreviewUrl={previewUrl}
            assets={assets}
            onAssetsChange={props.onAssetsChange}
            showIssues={showIssues}
            issues={issues}
            uploading={uploading}
          />
        </div>

        {/* Sticky footer */}
        <div
          className="px-5 py-3 flex-shrink-0 space-y-2"
          style={{ background: "var(--lift)", borderTop: "1px solid var(--hairline)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <button className="sp-btn sp-btn-ghost" onClick={() => !busy && onClose()} disabled={busy}>
              Cancel
            </button>
            <button
              className="sp-btn sp-btn-primary"
              onClick={handleSubmit}
              disabled={busy}
              aria-describedby={blockedReason ? "modal-blocked-reason" : undefined}
            >
              {busy ? (
                <RefreshCw className="animate-spin" style={{ width: 14, height: 14 }} />
              ) : (
                <Send style={{ width: 14, height: 14 }} />
              )}
              {uploading ? uploadStatus ?? "Uploading…" : submitting ? "Sending…" : "Submit for review"}
            </button>
          </div>
          {blockedReason && (
            <p id="modal-blocked-reason" role="status" aria-live="polite" className="text-right" style={{ fontSize: 12, color: "var(--fg-3)" }}>
              {blockedReason}
            </p>
          )}
          {submitError && (
            <p role="alert" className="flex items-center gap-1.5 justify-end" style={{ fontSize: 12, color: "var(--danger)" }}>
              <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0 }} />
              {submitError}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

