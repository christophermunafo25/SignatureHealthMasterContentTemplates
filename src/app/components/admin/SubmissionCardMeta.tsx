import React from "react";
import { CalendarClock, Flag } from "lucide-react";
import type { Submission } from "@/lib/types";

/** The v2.2 card metadata row shared by the board cards and the list view:
 * platform chips, requested post date, and the VP-not-approved flag. */
export function SubmissionCardMeta({ submission }: { submission: Submission }) {
  const hasAny =
    submission.platforms.length > 0 || submission.requestedPostDate || submission.releaseFlagged;
  if (!hasAny) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" style={{ marginTop: 6 }}>
      {submission.platforms.map((p) => (
        <span
          key={p}
          className="rounded-full px-2 py-0.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            letterSpacing: "0.04em",
            border: "1px solid var(--hairline-strong)",
            color: "var(--fg-2)",
            background: "var(--paper)",
          }}
        >
          {p === "Facebook" ? "FB" : p === "Instagram" ? "IG" : p}
        </span>
      ))}
      {submission.requestedPostDate && (
        <span
          className="flex items-center gap-1 rounded-full px-2 py-0.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            border: "1px solid var(--hairline-strong)",
            color: "var(--fg-2)",
            background: "var(--paper)",
          }}
          title={`Requested post date${submission.requestedPostTime ? ` · ${submission.requestedPostTime}` : ""}`}
        >
          <CalendarClock style={{ width: 10, height: 10 }} />
          {formatShortDate(submission.requestedPostDate)}
        </span>
      )}
      {submission.releaseFlagged && (
        <span
          className="flex items-center gap-1 rounded-full px-2 py-0.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            fontWeight: 600,
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            background: "color-mix(in srgb, var(--danger) 8%, transparent)",
          }}
        >
          <Flag style={{ width: 10, height: 10 }} />
          VP not approved
        </span>
      )}
    </div>
  );
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
