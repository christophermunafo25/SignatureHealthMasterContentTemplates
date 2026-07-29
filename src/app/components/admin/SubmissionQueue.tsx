import React, { useEffect, useMemo, useState } from "react";
import { Inbox, Search } from "lucide-react";
import type { Submission, SubmissionStatus } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../../router";
import { ErrorState } from "../ErrorState";

const TABS: Array<{ key: SubmissionStatus; label: string }> = [
  { key: "submitted", label: "New" },
  { key: "approved", label: "Approved" },
  { key: "posted", label: "Posted" },
  { key: "archived", label: "Archived" },
];

export function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Signed (or dev data-URL) preview thumbnail for a submission card. */
function PreviewThumb({ submission }: { submission: Submission }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (submission.previewPath) {
      void stores.submissions.previewUrl(submission.previewPath).then((u) => alive && setUrl(u));
    }
    return () => {
      alive = false;
    };
  }, [submission.previewPath]);
  return (
    <div
      className="flex-shrink-0 overflow-hidden rounded-lg"
      style={{ width: 72, height: 72, background: "var(--surface-sunken)", border: "1px solid var(--hairline)" }}
    >
      {url && <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
    </div>
  );
}

/** The social team's review queue: everything facilities have submitted,
 * newest first, defaulting to the New tab. */
export function SubmissionQueue() {
  const { company } = useAuth();
  const { navigate } = useRouter();
  const companyId = company?.id ?? "";
  const [tab, setTab] = useState<SubmissionStatus>("submitted");
  const [facility, setFacility] = useState<string>("");
  const [search, setSearch] = useState("");

  const listState = useAsync(
    () => stores.submissions.list(companyId, { status: tab }),
    [companyId, tab],
  );
  const rows = listState.status === "ready" ? listState.data : [];

  const facilities = useMemo(
    () => [...new Set(rows.map((s) => s.facilityName))].sort(),
    [rows],
  );

  const shown = useMemo(() => {
    let out = rows;
    if (facility) out = out.filter((s) => s.facilityName === facility);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (s) =>
          s.facilityName.toLowerCase().includes(q) ||
          s.submitterName.toLowerCase().includes(q) ||
          s.caption.toLowerCase().includes(q) ||
          s.templateName.toLowerCase().includes(q),
      );
    }
    return out;
  }, [rows, facility, search]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">
      <div>
        <h1 className="sp-page-title">Submissions</h1>
        <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
          Content from your facilities. Review, fix, download, and mark it
          posted.
        </p>
      </div>

      {/* Status tabs + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1" role="tablist" aria-label="Submission status">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className="sp-btn"
              style={{
                minHeight: 32,
                padding: "4px 12px",
                background: tab === key ? "var(--accent-wash)" : "transparent",
                border: `1px solid ${tab === key ? "var(--accent-border)" : "var(--hairline-strong)"}`,
                color: tab === key ? "var(--ink)" : "var(--fg-2)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {facilities.length > 1 && (
          <select
            className="sp-input"
            style={{ width: "auto", fontSize: 12, padding: "6px 10px" }}
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
            aria-label="Filter by facility"
          >
            <option value="">All facilities</option>
            {facilities.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        )}
        <div className="relative" style={{ width: 220 }}>
          <Search className="absolute" style={{ left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--fg-3)", zIndex: 1 }} />
          <input
            className="sp-input"
            style={{ padding: "7px 10px 7px 30px", fontSize: 12 }}
            placeholder="Facility, submitter, caption…"
            aria-label="Search submissions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Queue */}
      {listState.status === "loading" ? (
        <p className="text-center py-16" style={{ fontSize: 13, color: "var(--fg-3)" }}>Loading…</p>
      ) : listState.status === "error" ? (
        <ErrorState
          title="We couldn't load submissions."
          detail="Check your connection and try again."
          onRetry={listState.retry}
        />
      ) : shown.length === 0 ? (
        <div className="sp-card text-center py-16 px-6">
          <Inbox style={{ width: 28, height: 28, color: "var(--fg-4)", margin: "0 auto 10px" }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-1)" }}>
            {tab === "submitted" ? "No new submissions" : `Nothing ${tab} yet`}
          </p>
          <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 6 }}>
            {tab === "submitted"
              ? "Facility submissions land here the moment they're sent."
              : "Items you move to this status will show up here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate({ name: "submissionDetail", submissionId: s.id })}
              className="w-full text-left p-4 flex items-center gap-4 transition-all"
              style={{
                background: "var(--lift)",
                border: "1px solid var(--hairline)",
                borderRadius: 12,
                boxShadow: "var(--shadow-e1)",
              }}
            >
              <PreviewThumb submission={s} />
              <div className="min-w-0 flex-1">
                <p className="truncate" style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
                  {s.templateName}
                  {JSON.stringify(s.values) !== JSON.stringify(s.originalValues) && (
                    <span style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 400 }}> · edited</span>
                  )}
                </p>
                <p className="truncate" style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 2 }}>
                  {s.facilityName} · {s.submitterName}
                </p>
                {s.caption && (
                  <p className="truncate" style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>
                    {s.caption}
                  </p>
                )}
              </div>
              <span className="flex-shrink-0" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>
                {relativeTime(s.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
