import React, { useMemo, useRef, useState } from "react";
import { Archive, ArrowLeft, Check, Download, RefreshCw, RotateCcw, Send } from "lucide-react";
import type { Submission, SubmissionStatus } from "@/lib/types";
import { mergeCaption } from "@/lib/caption";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useRouter } from "../../router";
import { ErrorState } from "../ErrorState";
import { type SchemaRendererHandle } from "../SchemaRenderer";
import { TemplateFillLayout } from "../TemplateFillLayout";
import { relativeTime } from "./SubmissionQueue";

/** Review one submission: the same fill layout the facility used, prefilled
 * and fully editable — editing is the point (typos, mostly). The preview
 * renders from the FROZEN schema/brand snapshots, so later template or brand
 * edits never change what's being reviewed. */
export function SubmissionDetail({ submissionId }: { submissionId: string }) {
  const { navigate } = useRouter();
  const subState = useAsync(() => stores.submissions.get(submissionId), [submissionId]);

  if (subState.status === "loading") {
    return <p className="text-center py-24" style={{ fontSize: 13, color: "var(--fg-3)" }}>Loading…</p>;
  }
  if (subState.status === "error") {
    return (
      <ErrorState
        title="We couldn't load this submission."
        detail="Check your connection and try again."
        onRetry={subState.retry}
      />
    );
  }
  if (!subState.data) {
    return <p className="text-center py-24" style={{ fontSize: 13, color: "var(--fg-3)" }}>Submission not found.</p>;
  }
  return <Loaded initial={subState.data} onBack={() => navigate({ name: "submissions" })} />;
}

function Loaded({ initial, onBack }: { initial: Submission; onBack(): void }) {
  const [sub, setSub] = useState<Submission>(initial);
  const [values, setValues] = useState(initial.values);
  const [caption, setCaption] = useState<string | null>(initial.caption);
  const [note, setNote] = useState(initial.internalNote);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const rendererRef = useRef<SchemaRendererHandle>(null);

  const template = sub.schemaSnapshot;
  const brandKit = sub.brandSnapshot?.brandKit ?? null;

  const effectiveCaption = caption ?? mergeCaption(template, values);
  const dirty =
    JSON.stringify(values) !== JSON.stringify(sub.values) ||
    effectiveCaption !== sub.caption ||
    note !== sub.internalNote;
  const edited = useMemo(
    () =>
      JSON.stringify(values) !== JSON.stringify(sub.originalValues) ||
      effectiveCaption !== sub.originalCaption,
    [values, effectiveCaption, sub],
  );

  const persist = async (patch?: Partial<Pick<Submission, "status">>) => {
    setError(null);
    try {
      // caption === null means "follow the suggestion" — persist the merged
      // text, never an empty string.
      const next = await stores.submissions.update(sub.id, {
        values,
        caption: effectiveCaption,
        internalNote: note,
        ...patch,
      });
      setSub(next);
      return next;
    } catch (e) {
      console.error("Save failed", e);
      setError("Couldn't save. Try again.");
      throw e;
    }
  };

  const act = async (label: string, patch?: Partial<Pick<Submission, "status">>) => {
    setBusy(label);
    try {
      await persist(patch);
    } catch {
      /* surfaced via error state */
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    if (!rendererRef.current) return;
    setExporting(true);
    try {
      // Renders the CURRENT edited state through the standard export path.
      await rendererRef.current.exportPng();
    } catch (e) {
      console.error("Export failed", e);
      setError("Couldn't export the graphic. Try again.");
    } finally {
      setExporting(false);
    }
  };

  const revertAll = () => {
    setValues(sub.originalValues);
    setCaption(sub.originalCaption);
  };

  const statusBtn = (status: SubmissionStatus, label: string, Icon: typeof Check) => (
    <button
      className="sp-btn sp-btn-ghost flex-1"
      onClick={() => void act(label, { status })}
      disabled={busy !== null || sub.status === status}
    >
      <Icon style={{ width: 13, height: 13 }} />
      {busy === label ? "Saving…" : label}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <button onClick={onBack} className="flex items-center gap-1.5 mb-5" style={{ fontSize: 13, color: "var(--fg-2)" }}>
        <ArrowLeft style={{ width: 14, height: 14 }} />
        Submissions
      </button>

      <TemplateFillLayout
        template={template}
        brandKit={brandKit}
        values={values}
        onChange={(fieldKey, v) => setValues((prev) => ({ ...prev, [fieldKey]: v }))}
        caption={caption}
        onCaptionEdit={setCaption}
        rendererRef={rendererRef}
        instrument={false}
        header={
          <div>
            <p className="sp-eyebrow">{sub.facilityName}</p>
            <h1 className="sp-page-title" style={{ marginTop: 2 }}>{sub.templateName}</h1>
            <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              Submitted by {sub.submitterName} · {relativeTime(sub.createdAt)} ·{" "}
              <span className="capitalize">{sub.status === "submitted" ? "new" : sub.status}</span>
              {edited && sub.reviewedBy && (
                <span> · edited in review</span>
              )}
            </p>
          </div>
        }
        fieldAccessory={(field) =>
          values[field.fieldKey] !== sub.originalValues[field.fieldKey] ? (
            <button
              onClick={() =>
                setValues((prev) => ({ ...prev, [field.fieldKey]: sub.originalValues[field.fieldKey] ?? "" }))
              }
              title="Revert to what the facility submitted"
              className="flex items-center gap-1 flex-shrink-0"
              style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--solar)" }}
            >
              <RotateCcw style={{ width: 11, height: 11 }} />
              Revert
            </button>
          ) : null
        }
        actions={
          <>
            <div>
              <label className="sp-eyebrow block mb-1" htmlFor="internal-note">Internal note</label>
              <textarea
                id="internal-note"
                className="sp-input"
                rows={2}
                placeholder="For your team only — facilities never see this."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                className="sp-btn sp-btn-primary flex-1"
                onClick={handleDownload}
                disabled={exporting}
              >
                {exporting ? <RefreshCw className="animate-spin" style={{ width: 14, height: 14 }} /> : <Download style={{ width: 14, height: 14 }} />}
                {exporting ? "Generating…" : "Download graphic"}
              </button>
              <button
                className="sp-btn sp-btn-ghost"
                onClick={() => void act("Save")}
                disabled={busy !== null || !dirty}
              >
                {busy === "Save" ? "Saving…" : "Save changes"}
              </button>
            </div>
            <div className="flex gap-2">
              {statusBtn("approved", "Mark approved", Check)}
              {statusBtn("posted", "Mark posted", Send)}
              {statusBtn("archived", "Archive", Archive)}
            </div>
            {edited && (
              <button
                onClick={revertAll}
                className="flex items-center gap-1.5 justify-center w-full"
                style={{ fontSize: 12, color: "var(--fg-3)" }}
              >
                <RotateCcw style={{ width: 12, height: 12 }} />
                Revert everything to the original submission
              </button>
            )}
            {error && <p role="alert" className="text-center" style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}
          </>
        }
      />
    </div>
  );
}
