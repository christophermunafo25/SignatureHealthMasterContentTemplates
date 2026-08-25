import React, { useState } from "react";
import { ChevronDown, ClipboardList, Flag } from "lucide-react";
import type { Submission } from "@/lib/types";
import { LEGACY_RELEASE_QUESTIONS, RELEASE_QUESTIONS, isV3Form } from "@/lib/releaseForm";
import { useRouter } from "../../router";

/** Collapsible read-only rendering of a submission's release answers, shown
 * on the review screen for both kinds. Opens by default when the submission
 * is flagged — the flag is the reason a reviewer needs this panel. */
export function ReleaseFormPanel({ submission }: { submission: Submission }) {
  const { navigate } = useRouter();
  const [open, setOpen] = useState(submission.releaseFlagged);
  const rf = submission.releaseForm;
  if (!rf) return null;

  const v3 = isV3Form(rf);
  const Q = RELEASE_QUESTIONS;
  const L = LEGACY_RELEASE_QUESTIONS;

  // v3 collapsed six consent questions into one agreement, so there are only
  // two answers left to list. Legacy documents render exactly the rows they
  // always have, under the copy they were actually asked.
  const rows: Array<[string, string]> = v3
    ? [
        [Q.platforms.label, rf.platforms?.length ? rf.platforms.join(", ") : "Not recorded"],
        [Q.acknowledged.label, rf.acknowledged ? "Confirmed" : "Not confirmed"],
      ]
    : [
        [L.platforms.label, rf.platforms?.length ? rf.platforms.join(", ") : "Not recorded"],
        [L.isEvent.label, rf.isEvent ?? "Not recorded"],
        // Gated follow-ups: shown only when the gate was answered "Yes", so an
        // omitted row means "never asked" rather than "unanswered".
        ...(rf.vpApproved ? [[L.vpApproved.label, rf.vpApproved] as [string, string]] : []),
        [L.photoRelease.label, rf.photoRelease ?? "Not recorded"],
        [L.hasMinors.label, rf.hasMinors ?? "Not recorded"],
        ...(rf.minorRelease ? [[L.minorRelease.label, rf.minorRelease] as [string, string]] : []),
        [L.offCampusRelease.label, rf.offCampusRelease ?? "Not recorded"],
        [L.includesMedia.label, rf.includesMedia ?? "Not recorded"],
      ];

  const requestedDate = submission.requestedPostDate ?? rf.requestedPostDate;
  const requestedTime = submission.requestedPostTime ?? rf.requestedPostTime;

  return (
    <div
      className="mt-6"
      style={{ background: "var(--lift)", border: "1px solid var(--hairline)", borderRadius: 12 }}
    >
      <button
        className="flex items-center justify-between gap-2 w-full px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <ClipboardList style={{ width: 15, height: 15, color: "var(--fg-3)" }} />
          <span className="sp-panel-title">Submission form</span>
          {submission.releaseFlagged && (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                fontWeight: 600,
                border: "1px solid var(--danger)",
                color: "var(--danger)",
              }}
            >
              <Flag style={{ width: 10, height: 10 }} />
              VP not approved
            </span>
          )}
        </span>
        <ChevronDown
          style={{
            width: 15,
            height: 15,
            color: "var(--fg-3)",
            transform: open ? "rotate(180deg)" : undefined,
            transition: "transform 0.15s",
          }}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {submission.releaseFlagged && (
            <p
              className="rounded-lg px-3 py-2"
              style={{ fontSize: 12.5, fontWeight: 500, color: "var(--solar)", background: "var(--accent-wash)" }}
            >
              Needs a look: VP of Operations did not approve this event.
            </p>
          )}
          {/* The requested slot — the operationally useful pair — sits first.
              On v3 most submissions have none, so say so once rather than
              printing "Not recorded" twice on the happy path. */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {v3 && !requestedDate ? (
              <span>
                <span className="sp-eyebrow block">Scheduling</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                  Standard scheduling
                </span>
              </span>
            ) : (
              <>
                <span>
                  <span className="sp-eyebrow block">Requested post date</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                    {requestedDate ?? "Not recorded"}
                  </span>
                </span>
                <span>
                  <span className="sp-eyebrow block">Requested time</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                    {requestedTime ?? (v3 ? "Any time" : "Not recorded")}
                  </span>
                </span>
              </>
            )}
            <span>
              <span className="sp-eyebrow block">Files</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{submission.assets.length}</span>
            </span>
          </div>
          <dl className="space-y-2">
            {rows.map(([label, answer]) => (
              <div key={label} className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                <dt style={{ fontSize: 12, color: "var(--fg-3)", flex: "1 1 60%" }}>{label}</dt>
                <dd
                  style={{
                    fontSize: 12.5,
                    fontWeight: answer === "Not recorded" ? 400 : 600,
                    color: answer === "Not recorded" ? "var(--fg-4)" : answer === "No" ? "var(--danger)" : "var(--ink)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {answer}
                </dd>
              </div>
            ))}
          </dl>
          <button
            className="flex items-center gap-1.5"
            style={{ fontSize: 12, color: "var(--solar)", textDecoration: "underline", textUnderlineOffset: 3 }}
            onClick={() => navigate({ name: "recordDetail", submissionId: submission.id })}
          >
            Open in Form Records
          </button>
        </div>
      )}
    </div>
  );
}
