import React, { useEffect, useState } from "react";
import { ArrowLeft, Download, ExternalLink, Flag } from "lucide-react";
import type { Submission, SubmissionAsset } from "@/lib/types";
import {
  LEGACY_RELEASE_QUESTIONS,
  RELEASE_QUESTIONS,
  SUBMISSION_AGREEMENT,
  isV3Form,
  type ReleaseForm,
} from "@/lib/releaseForm";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useRouter } from "../../router";
import { ErrorState } from "../ErrorState";
import { relativeTime } from "./SubmissionQueue";

const panel: React.CSSProperties = {
  background: "var(--lift)",
  border: "1px solid var(--hairline)",
  borderRadius: 12,
};

const fmtSize = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const NotRecorded = () => <span style={{ color: "var(--fg-4)", fontWeight: 400 }}>Not recorded</span>;

function Answer({ value }: { value: string | undefined | null }) {
  if (!value) return <NotRecorded />;
  return (
    <span style={{ fontWeight: 600, color: value === "No" ? "var(--danger)" : "var(--ink)" }}>{value}</span>
  );
}

function Question({
  number,
  suffix,
  label,
  children,
}: {
  number: number;
  suffix?: "a" | "b";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 space-y-1.5" style={panel}>
      <p className="sp-eyebrow">
        Question {String(number).padStart(2, "0")}
        {suffix ?? ""}
      </p>
      <p style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{label}</p>
      <div style={{ fontSize: 13, color: "var(--fg-1)" }}>{children}</div>
    </div>
  );
}

/** Read-only rendering of one submitted release form, laid out to mirror
 * the paper form the client knows. Bookkeeping, not review — the actions
 * live on /submissions/:id. */
export function FormRecordDetail({ submissionId }: { submissionId: string }) {
  const { navigate } = useRouter();
  const subState = useAsync(() => stores.submissions.get(submissionId), [submissionId]);

  if (subState.status === "loading") {
    return <p className="text-center py-24" style={{ fontSize: 13, color: "var(--fg-3)" }}>Loading…</p>;
  }
  if (subState.status === "error") {
    return (
      <ErrorState title="We couldn't load this record." detail="Check your connection and try again." onRetry={subState.retry} />
    );
  }
  if (!subState.data) {
    return <p className="text-center py-24" style={{ fontSize: 13, color: "var(--fg-3)" }}>Record not found.</p>;
  }
  return <RecordLoaded sub={subState.data} onBack={() => navigate({ name: "records" })} />;
}

function RecordLoaded({ sub, onBack }: { sub: Submission; onBack(): void }) {
  const { navigate } = useRouter();
  const rf: ReleaseForm | undefined = sub.releaseForm;
  const v3 = isV3Form(rf);
  const Q = RELEASE_QUESTIONS;
  const L = LEGACY_RELEASE_QUESTIONS;
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void stores.submissions
      .assetUrls(sub.assets)
      .then((u) => alive && setUrls(u))
      .catch((e) => console.warn("Signing assets failed", e));
    return () => {
      alive = false;
    };
  }, [sub.assets]);

  const downloadAsset = async (asset: SubmissionAsset) => {
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
      console.error("Download failed", e);
      setError(`Couldn't download ${asset.name}. Try again.`);
    }
  };

  return (
    <div className="mx-auto px-6 py-8" style={{ maxWidth: 760 }}>
      <button onClick={onBack} className="flex items-center gap-1.5 mb-5" style={{ fontSize: 13, color: "var(--fg-2)" }}>
        <ArrowLeft style={{ width: 14, height: 14 }} />
        Back to records
      </button>

      {/* Header */}
      <div className="p-5 mb-4" style={panel}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="sp-eyebrow">{sub.kind === "direct" ? "Direct upload" : sub.templateName || "Template"}</p>
            <h1 className="sp-page-title" style={{ marginTop: 2 }}>{sub.facilityName}</h1>
            <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              {sub.submitterName}
              {sub.submitterEmail && <> · {sub.submitterEmail}</>} · submitted{" "}
              {new Date(sub.createdAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              ({relativeTime(sub.createdAt)})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 capitalize"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                fontWeight: 600,
                border: "1px solid var(--hairline-strong)",
                color: "var(--ink)",
                background: "var(--paper)",
              }}
            >
              {sub.status === "submitted" ? "new" : sub.status}
            </span>
            {sub.releaseFlagged && (
              <span
                className="flex items-center gap-1 rounded-full px-2.5 py-1"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  fontWeight: 600,
                  border: "1px solid var(--danger)",
                  color: "var(--danger)",
                }}
              >
                <Flag style={{ width: 10, height: 10 }} />
                VP not approved
              </span>
            )}
          </div>
        </div>
      </div>

      {!rf ? (
        <p className="p-5 text-center" style={{ ...panel, fontSize: 13, color: "var(--fg-3)" }}>
          This submission predates the release form — there are no recorded
          answers to show.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Information, then the questions in the order the form asked
              them — v3's Q1–Q6, or the v1/v2 Q2–Q12 for older records. */}
          <div className="p-4 space-y-1.5" style={panel}>
            <p className="sp-eyebrow">Information</p>
            <dl className="space-y-1" style={{ fontSize: 13 }}>
              {/* v3 asks for the facility as Q1, so it renders below rather
                  than twice. Legacy forms never numbered it. */}
              {!v3 && (
                <div className="flex gap-2">
                  <dt style={{ color: "var(--fg-3)" }}>Facility:</dt>
                  <dd style={{ fontWeight: 600, color: "var(--ink)" }}>{sub.facilityName}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt style={{ color: "var(--fg-3)" }}>Name:</dt>
                <dd style={{ fontWeight: 600, color: "var(--ink)" }}>{sub.submitterName}</dd>
              </div>
              <div className="flex gap-2">
                <dt style={{ color: "var(--fg-3)" }}>Email:</dt>
                <dd style={{ fontWeight: 600, color: "var(--ink)" }}>{sub.submitterEmail ?? <NotRecorded />}</dd>
              </div>
            </dl>
          </div>

{v3 ? (
        <>
          {/* v3 — Q1 through Q6, in the order the facility answered them. */}
          <Question number={Q.facility.number} label={Q.facility.label}>
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>{sub.facilityName}</span>
          </Question>
          <Question number={Q.platforms.number} label={Q.platforms.label}>
            {rf.platforms?.length ? (
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                {rf.platformChoice === "Both" ? "Both" : rf.platforms.join(", ")}
              </span>
            ) : (
              <NotRecorded />
            )}
          </Question>
          <Question number={Q.postText.number} label={Q.postText.label}>
            {rf.postText ? (
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{rf.postText}</p>
            ) : (
              <NotRecorded />
            )}
          </Question>
          <Question number={Q.upload.number} label="Attachments">
            {sub.assets.length === 0 ? (
              <p style={{ color: "var(--fg-3)" }}>No files were uploaded.</p>
            ) : (
              <ul className="space-y-2" style={{ marginTop: 4 }}>
                {sub.assets.map((asset) => (
                  <li
                    key={asset.path}
                    className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{ border: "1px solid var(--hairline)", background: "var(--paper)" }}
                  >
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
                      disabled={!urls[asset.path]}
                    >
                      <Download style={{ width: 12, height: 12 }} />
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Question>
          <Question number={Q.needsSpecificSchedule.number} label={Q.needsSpecificSchedule.label}>
            <Answer value={rf.needsSpecificSchedule} />
          </Question>
          {/* The schedule pair was only ever asked when Q5 was "Yes", so an
              omitted row means "standard scheduling", not "unanswered". */}
          {rf.needsSpecificSchedule === "Yes" && (
            <>
              <Question
                number={Q.requestedPostDate.number}
                suffix={Q.requestedPostDate.suffix}
                label={Q.requestedPostDate.label}
              >
                <Answer value={rf.requestedPostDate} />
              </Question>
              <Question
                number={Q.requestedPostTime.number}
                suffix={Q.requestedPostTime.suffix}
                label={Q.requestedPostTime.label}
              >
                {rf.requestedPostTime ? (
                  <Answer value={rf.requestedPostTime} />
                ) : (
                  <span style={{ color: "var(--fg-4)" }}>No time requested</span>
                )}
              </Question>
            </>
          )}
          <Question number={Q.acknowledged.number} label={Q.acknowledged.label}>
            <Answer value={rf.acknowledged ? "Yes" : "No"} />
            <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 6, lineHeight: 1.55 }}>
              {Q.acknowledged.helper}
            </p>
            <p style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 6 }}>
              {SUBMISSION_AGREEMENT.preamble}
            </p>
            <ul className="space-y-1" style={{ paddingLeft: 16, listStyle: "disc", marginTop: 2 }}>
              {SUBMISSION_AGREEMENT.items.map((item) => (
                <li key={item} style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--fg-4)" }}>
                  {item}
                </li>
              ))}
            </ul>
          </Question>
        </>
      ) : (
        <>
          {/* v1/v2 — Q2 through Q12, under the copy the facility was
              actually asked. Frozen: an old record must read today exactly
              as it read the day it was submitted. */}
          <Question number={L.platforms.number} label={L.platforms.label}>
            {rf.platforms?.length ? (
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>{rf.platforms.join(", ")}</span>
            ) : (
              <NotRecorded />
            )}
          </Question>
          <Question number={L.isEvent.number} suffix={L.isEvent.suffix} label={L.isEvent.label}>
            <Answer value={rf.isEvent} />
          </Question>
          {/* Gated follow-ups render only when asked — a missing 3b means
              "not an event", which the 3a answer above already states. */}
          {rf.vpApproved && (
            <Question number={L.vpApproved.number} suffix={L.vpApproved.suffix} label={L.vpApproved.label}>
              <Answer value={rf.vpApproved} />
            </Question>
          )}
          <Question number={L.photoRelease.number} label={L.photoRelease.label}>
            <Answer value={rf.photoRelease} />
          </Question>
          <Question number={L.hasMinors.number} suffix={L.hasMinors.suffix} label={L.hasMinors.label}>
            <Answer value={rf.hasMinors} />
          </Question>
          {rf.minorRelease && (
            <Question number={L.minorRelease.number} suffix={L.minorRelease.suffix} label={L.minorRelease.label}>
              <Answer value={rf.minorRelease} />
            </Question>
          )}
          <Question number={L.offCampusRelease.number} label={L.offCampusRelease.label}>
            <Answer value={rf.offCampusRelease} />
          </Question>
          <Question number={L.requestedPostDate.number} label={L.requestedPostDate.label}>
            <Answer value={rf.requestedPostDate} />
          </Question>
          <Question number={L.requestedPostTime.number} label={L.requestedPostTime.label}>
            <Answer value={rf.requestedPostTime} />
          </Question>
          <Question number={L.postText.number} label={L.postText.label}>
            {rf.postText ? (
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{rf.postText}</p>
            ) : (
              <NotRecorded />
            )}
          </Question>
          <Question number={L.includesMedia.number} label={L.includesMedia.label}>
            <Answer value={rf.includesMedia} />
          </Question>
          <Question number={L.upload.number} label="Attachments">
            {sub.assets.length === 0 ? (
              <p style={{ color: "var(--fg-3)" }}>No files were uploaded.</p>
            ) : (
              <ul className="space-y-2" style={{ marginTop: 4 }}>
                {sub.assets.map((asset) => (
                  <li
                    key={asset.path}
                    className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{ border: "1px solid var(--hairline)", background: "var(--paper)" }}
                  >
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
                      disabled={!urls[asset.path]}
                    >
                      <Download style={{ width: 12, height: 12 }} />
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Question>
          <Question number={L.acknowledged.number} label={L.acknowledged.label}>
            <Answer value={rf.acknowledged ? "Yes" : "No"} />
            <p style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 4 }}>{L.acknowledged.helper}</p>
          </Question>
        </>
      )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-center mt-3" style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-5">
        <button onClick={onBack} className="sp-btn sp-btn-ghost">
          <ArrowLeft style={{ width: 13, height: 13 }} />
          Back to records
        </button>
        <button
          className="sp-btn sp-btn-primary"
          onClick={() => navigate({ name: "submissionDetail", submissionId: sub.id })}
        >
          <ExternalLink style={{ width: 13, height: 13 }} />
          Open in review
        </button>
      </div>
    </div>
  );
}
