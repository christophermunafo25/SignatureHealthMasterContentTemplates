import React, { useEffect, useState } from "react";
import { Archive, ArrowLeft, Check, Download, FileText, Film, Presentation, RefreshCw, Send, ThumbsDown, Undo2 } from "lucide-react";
import type { Submission, SubmissionAsset, SubmissionStatus } from "@/lib/types";
import { stores } from "@/lib/stores";
import { relativeTime } from "./SubmissionQueue";
import { DeclineDialog } from "./DeclineDialog";
import { ReleaseFormPanel } from "./ReleaseFormPanel";
import { isSupabaseConfigured, supabase } from "@/lib/stores/supabase/client";

const panel: React.CSSProperties = {
  background: "var(--lift)",
  border: "1px solid var(--hairline)",
  borderRadius: 12,
};

const fmtSize = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function DocGlyph({ mimeType }: { mimeType: string }) {
  const Icon = mimeType.startsWith("video/")
    ? Film
    : mimeType.includes("presentation") || mimeType.includes("powerpoint")
      ? Presentation
      : FileText;
  return (
    <span
      className="flex items-center justify-center flex-shrink-0"
      style={{ width: 44, height: 44, borderRadius: 8, background: "var(--paper)", border: "1px solid var(--hairline)" }}
    >
      <Icon style={{ width: 17, height: 17, color: "var(--fg-3)" }} />
    </span>
  );
}

/** Review a DIRECT submission: editable caption + notes + the standard
 * action row on the left, the uploaded asset gallery on the right. Signed
 * URLs live in component state only — never written back through update(). */
export function DirectSubmissionReview({ initial, onBack }: { initial: Submission; onBack(): void }) {
  const [sub, setSub] = useState<Submission>(initial);
  const [caption, setCaption] = useState(initial.caption);
  const [note, setNote] = useState(initial.internalNote);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const resign = React.useCallback(async () => {
    try {
      setUrls(await stores.submissions.assetUrls(sub.assets));
    } catch (e) {
      console.warn("Signing submission assets failed", e);
    }
  }, [sub.assets]);
  useEffect(() => {
    void resign();
  }, [resign]);

  const dirty = caption !== sub.caption || note !== sub.internalNote;

  const persist = async (patch?: Partial<Pick<Submission, "status">>) => {
    setError(null);
    try {
      const next = await stores.submissions.update(sub.id, {
        caption,
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

  /** Download one asset through its signed URL, preserving the display
   * name. A stale URL (long review session) re-signs and retries once. */
  const downloadAsset = async (asset: SubmissionAsset, attempt = 0): Promise<void> => {
    const url = urls[asset.path];
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = asset.name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      if (attempt === 0) {
        console.warn("Download failed; re-signing and retrying", e);
        await resign();
        await new Promise((r) => setTimeout(r, 150));
        return downloadAsset(asset, 1);
      }
      console.error("Download failed after re-sign", e);
      setError(`Couldn't download ${asset.name}. Try again.`);
    }
  };

  /** Sequential downloads — no zip library, no new dependency. */
  const downloadAll = async () => {
    setBusy("Download all");
    try {
      for (const asset of sub.assets) {
        await downloadAsset(asset);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleDecline = async (reason: string, notify: boolean) => {
    setDeclineOpen(false);
    setBusy("Decline");
    try {
      const next = await stores.submissions.update(sub.id, {
        caption,
        internalNote: note,
        status: "declined",
        declineReason: reason,
      });
      setSub(next);
      if (notify && isSupabaseConfigured) {
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left — caption, note, actions */}
        <div className="lg:col-span-5 space-y-4">
          <div>
            <p className="sp-eyebrow">{sub.facilityName}</p>
            <h1 className="sp-page-title" style={{ marginTop: 2 }}>Direct upload</h1>
            <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              Submitted by {sub.submitterName} · {relativeTime(sub.createdAt)} ·{" "}
              <span className="capitalize">{sub.status === "submitted" ? "new" : sub.status}</span>
            </p>
          </div>

          <div className="p-4 space-y-2.5" style={panel}>
            <div className="flex items-center justify-between">
              <h2 className="sp-panel-title">Post copy</h2>
              {caption !== sub.originalCaption && (
                <button
                  onClick={() => setCaption(sub.originalCaption)}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--solar)" }}
                >
                  Revert to submitted
                </button>
              )}
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={6}
              aria-label="Post copy"
              className="sp-input"
              style={{ resize: "vertical" }}
            />
          </div>

          <div className="p-4 space-y-2" style={panel}>
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
                onClick={() => void downloadAll()}
                disabled={busy !== null || sub.assets.length === 0}
              >
                {busy === "Download all" ? (
                  <RefreshCw className="animate-spin" style={{ width: 14, height: 14 }} />
                ) : (
                  <Download style={{ width: 14, height: 14 }} />
                )}
                {busy === "Download all" ? "Downloading…" : "Download all"}
              </button>
              <button className="sp-btn sp-btn-ghost" onClick={() => void act("Save")} disabled={busy !== null || !dirty}>
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
              <p className="rounded-lg px-3 py-2" style={{ fontSize: 12, background: "var(--fill-danger-bg)", color: "var(--danger)" }}>
                Declined: {sub.declineReason}
              </p>
            )}
            {error && <p role="alert" className="text-center" style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}
          </div>

          <ReleaseFormPanel submission={sub} />
        </div>

        {/* Right — asset gallery */}
        <div className="lg:col-span-7">
          <div className="p-5 space-y-4" style={{ ...panel, boxShadow: "var(--shadow-e2)" }}>
            <div className="flex items-center justify-between">
              <h3 className="sp-panel-title">Uploaded files</h3>
              <span className="sp-eyebrow">{sub.assets.length} file{sub.assets.length === 1 ? "" : "s"}</span>
            </div>
            {sub.assets.length === 0 ? (
              <p className="text-center py-10" style={{ fontSize: 13, color: "var(--fg-3)" }}>
                This submission came with no files — the post copy is the content.
              </p>
            ) : (
              <div className="space-y-4">
                {sub.assets.map((asset) => {
                  const url = urls[asset.path];
                  const isImage = asset.mimeType.startsWith("image/");
                  const isVideo = asset.mimeType.startsWith("video/");
                  return (
                    <div key={asset.path} className="space-y-2">
                      {isImage && url ? (
                        <img
                          src={url}
                          alt={asset.name}
                          className="w-full rounded-xl"
                          style={{ border: "1px solid var(--hairline)", maxHeight: 520, objectFit: "contain", background: "var(--surface-sunken)" }}
                        />
                      ) : isVideo && url ? (
                        <video
                          controls
                          src={url}
                          className="w-full rounded-xl"
                          style={{ border: "1px solid var(--hairline)", maxHeight: 520, background: "var(--surface-sunken)" }}
                        />
                      ) : null}
                      <div
                        className="flex items-center gap-3 rounded-xl px-3 py-2"
                        style={{ border: "1px solid var(--hairline)", background: "var(--paper)" }}
                      >
                        {!isImage && !isVideo ? (
                          <DocGlyph mimeType={asset.mimeType} />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate" style={{ fontSize: 13, color: "var(--ink)" }}>{asset.name}</span>
                          <span className="block" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                            {asset.mimeType} · {fmtSize(asset.size)}
                          </span>
                        </span>
                        <button
                          className="sp-btn sp-btn-ghost flex-shrink-0"
                          style={{ minHeight: 30, padding: "3px 10px", fontSize: 12 }}
                          onClick={() => void downloadAsset(asset)}
                          disabled={!url}
                        >
                          <Download style={{ width: 12, height: 12 }} />
                          Download
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

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
