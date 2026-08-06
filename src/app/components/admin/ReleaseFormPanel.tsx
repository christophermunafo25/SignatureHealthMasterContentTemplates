import React, { useState } from "react";
import { ChevronDown, ClipboardList, Flag } from "lucide-react";
import type { Submission } from "@/lib/types";
import { RELEASE_QUESTIONS } from "@/lib/releaseForm";
import { useRouter } from "../../router";

/** Collapsible read-only rendering of a submission's release answers, shown
 * on the review screen for both kinds. Opens by default when the submission
 * is flagged — the flag is the reason a reviewer needs this panel. */
export function ReleaseFormPanel({ submission }: { submission: Submission }) {
  const { navigate } = useRouter();
  const [open, setOpen] = useState(submission.releaseFlagged);
  const rf = submission.releaseForm;
  if (!rf) return null;

  const Q = RELEASE_QUESTIONS;
  const rows: Array<[string, string]> = [
    [Q.platforms.label, rf.platforms?.length ? rf.platforms.join(", ") : "Not recorded"],
    [Q.vpApproved.label, rf.vpApproved ?? "Not recorded"],
    [Q.photoRelease.label, rf.photoRelease ?? "Not recorded"],
    [Q.minorRelease.label, rf.minorRelease ?? "Not recorded"],
    [Q.offCampusRelease.label, rf.offCampusRelease ?? "Not recorded"],
    [Q.includesMedia.label, rf.includesMedia ?? "Not recorded"],
  ];

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
          <span className="sp-panel-title">Release form</span>
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
          {/* The requested slot — the operationally useful pair — sits first. */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <span>
              <span className="sp-eyebrow block">Requested post date</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                {submission.requestedPostDate ?? rf.requestedPostDate ?? "Not recorded"}
              </span>
            </span>
            <span>
              <span className="sp-eyebrow block">Requested time</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                {submission.requestedPostTime ?? rf.requestedPostTime ?? "Not recorded"}
              </span>
            </span>
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
