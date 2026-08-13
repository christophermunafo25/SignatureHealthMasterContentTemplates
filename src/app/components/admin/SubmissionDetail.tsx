import React, { useMemo, useRef, useState } from "react";
import { Archive, ArrowLeft, Check, Download, RefreshCw, RotateCcw, Send, ThumbsDown, Undo2 } from "lucide-react";
import type { FieldValues, Submission, SubmissionStatus } from "@/lib/types";
import { mergeCaption } from "@/lib/caption";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useRouter } from "../../router";
import { ErrorState } from "../ErrorState";
import { type SchemaRendererHandle } from "../SchemaRenderer";
import { TemplateFillLayout } from "../TemplateFillLayout";
import { relativeTime } from "./SubmissionQueue";
import { DeclineDialog } from "./DeclineDialog";
import { DirectSubmissionReview } from "./DirectSubmissionReview";
import { ReleaseFormPanel } from "./ReleaseFormPanel";
import { isSupabaseConfigured, supabase } from "@/lib/stores/supabase/client";

/** Review one submission. Template kind: the same fill layout the facility
 * used, prefilled and fully editable against the FROZEN schema/brand
 * snapshots. Direct kind: the uploaded-asset review layout — no template,
 * no snapshot. */
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
  const sub = subState.data;
  const onBack = () => navigate({ name: "submissions" });
  // A direct submission has no schema snapshot; a legacy row always does.
  return sub.kind === "direct" || !sub.schemaSnapshot ? (
    <DirectSubmissionReview initial={sub} onBack={onBack} />
  ) : (
    <Loaded initial={sub} onBack={onBack} />
  );
}

function Loaded({ initial, onBack }: { initial: Submission; onBack(): void }) {
  const { navigate } = useRouter();
  const [sub, setSub] = useState<Submission>(initial);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [values, setValues] = useState(initial.values);
  const [caption, setCaption] = useState<string | null>(initial.caption);
  const [note, setNote] = useState(initial.internalNote);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const rendererRef = useRef<SchemaRendererHandle>(null);

  // Loaded only renders for the template kind (see SubmissionDetail above).
  const template = sub.schemaSnapshot!;
  const brandKit = sub.brandSnapshot?.brandKit ?? null;
  // Frozen at submit time; absent on pre-0029 rows (placeholder renders).
  // Never re-resolve from the live roster here.
  const facility = sub.brandSnapshot?.facility ?? null;

  /** Render-time projection of `values`: image fields hold PRIVATE storage
   * paths, which render as nothing and break the export's data-URL
   * pre-conversion. This copy carries signed URLs instead. It is strictly
   * derived — `values` stays the source of truth for save and revert, since
   * a persisted signed URL would expire and blank the submission later. */
  const [signedImages, setSignedImages] = useState<FieldValues>({});
  /** Only the image values matter for signing — keying the effect on them
   * keeps a text edit from firing a storage round trip per keystroke. */
  const imageKey = useMemo(
    () =>
      template.fields
        .filter((f) => f.type === "image")
        .map((f) => `${f.fieldKey}=${values[f.fieldKey] ?? ""}`)
        .join("|"),
    [template, values],
  );
  const resign = React.useCallback(async () => {
    try {
      setSignedImages(await stores.submissions.signedValues(template, values));
    } catch (e) {
      console.warn("Signing image values failed; rendering raw", e);
      setSignedImages(values);
    }
    // values is read through imageKey — see the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, imageKey]);
  React.useEffect(() => {
    void resign();
  }, [resign]);
  /** Text edits apply live; image fields fall back to their raw value until
   * the signed URL lands. */
  const signed = useMemo<FieldValues>(() => {
    const next = { ...values };
    for (const f of template.fields) {
      if (f.type !== "image") continue;
      const s = signedImages[f.fieldKey];
      if (s) next[f.fieldKey] = s;
    }
    return next;
  }, [values, signedImages, template]);

  // J/K walk the queue in the order the list screen last showed it —
  // clearing forty birthday posts on a Monday without round-tripping to
  // the list. A approves, D opens decline.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const order: string[] = JSON.parse(sessionStorage.getItem("shc-queue-order") ?? "[]");
      const i = order.indexOf(sub.id);
      if (["j", "J", "k", "K", "a", "A", "d", "D"].includes(e.key)) e.preventDefault();
      if (e.key === "j" || e.key === "J") {
        if (i >= 0 && i < order.length - 1) navigate({ name: "submissionDetail", submissionId: order[i + 1] });
      } else if (e.key === "k" || e.key === "K") {
        if (i > 0) navigate({ name: "submissionDetail", submissionId: order[i - 1] });
      } else if (e.key === "a" || e.key === "A") {
        void act("Mark approved", { status: "approved" });
      } else if (e.key === "d" || e.key === "D") {
        setDeclineOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub.id, navigate]);

  const effectiveCaption = caption ?? mergeCaption(template, values, facility);
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
      // A long review session can outlive the one-hour signed URLs. Re-sign
      // and retry once before calling it a failure.
      console.warn("Export failed; re-signing image values and retrying", e);
      try {
        await resign();
        await new Promise((r) => setTimeout(r, 150)); // let the <img> swap in
        await rendererRef.current.exportPng();
      } catch (retryError) {
        console.error("Export failed after re-sign", retryError);
        setError("Couldn't export the graphic. Try again.");
      }
    } finally {
      setExporting(false);
    }
  };

  const handleDecline = async (reason: string, notify: boolean) => {
    setDeclineOpen(false);
    setBusy("Decline");
    try {
      const next = await stores.submissions.update(sub.id, {
        values,
        caption: effectiveCaption,
        internalNote: note,
        status: "declined",
        declineReason: reason,
      });
      setSub(next);
      if (notify && isSupabaseConfigured) {
        // Best-effort: the decline is saved either way.
        try {
          await supabase().functions.invoke("notify-submitter", {
            body: { submissionId: sub.id, reason },
          });
        } catch (e) {
          console.warn("Submitter notification failed", e);
        }
      }
    } catch (e) {
      console.error("Decline failed", e);
      setError("Couldn't decline. Try again.");
    } finally {
      setBusy(null);
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
        // Signed copy renders; edits still write through to `values`.
        values={signed}
        onChange={(fieldKey, v) => setValues((prev) => ({ ...prev, [fieldKey]: v }))}
        caption={caption}
        onCaptionEdit={setCaption}
        rendererRef={rendererRef}
        instrument={false}
        facility={facility}
        header={
          <div>
            <p className="sp-eyebrow">{sub.facilityName}</p>
            <h1 className="sp-page-title" style={{ marginTop: 2 }}>{sub.templateName}</h1>
            <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              Submitted by {sub.submitterName} · {relativeTime(sub.createdAt)} ·{" "}
              <span className="capitalize">{sub.status === "submitted" ? "new" : sub.status}</span>
              {sub.editedAt && <span> · edited in review {relativeTime(sub.editedAt)}</span>}
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
            <div className="flex gap-2">
              {sub.status !== "declined" && sub.status !== "posted" && (
                <button
                  className="sp-btn flex-1"
                  style={{ border: "1px solid var(--danger)", color: "var(--danger)", background: "transparent" }}
                  onClick={() => setDeclineOpen(true)}
                  disabled={busy !== null}
                >
                  <ThumbsDown style={{ width: 13, height: 13 }} />
                  Decline…
                </button>
              )}
              {(sub.status === "declined" || sub.status === "archived") && (
                <button
                  className="sp-btn sp-btn-ghost flex-1"
                  onClick={() => void act("Reopen", { status: "submitted" })}
                  disabled={busy !== null}
                >
                  <Undo2 style={{ width: 13, height: 13 }} />
                  {busy === "Reopen" ? "Reopening…" : "Reopen"}
                </button>
              )}
            </div>
            {sub.status === "declined" && sub.declineReason && (
              <p
                className="rounded-lg px-3 py-2"
                style={{ fontSize: 12, background: "var(--fill-danger-bg)", color: "var(--danger)" }}
              >
                Declined: {sub.declineReason}
              </p>
            )}
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

      <ReleaseFormPanel submission={sub} />

      {declineOpen && (
        <DeclineDialog
          submitterEmail={sub.submitterEmail}
          onDecline={(reason, notify) => void handleDecline(reason, notify)}
          onCancel={() => setDeclineOpen(false)}
        />
      )}
    </div>
  );
}
