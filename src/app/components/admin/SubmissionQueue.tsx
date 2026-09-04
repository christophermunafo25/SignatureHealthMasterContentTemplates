import React, { useEffect, useMemo, useState } from "react";
import { Archive, Check, Inbox, Search, Send, X } from "lucide-react";
import type { Submission, SubmissionStatus } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../../router";
import { ErrorState } from "../ErrorState";
import { FacilityCombobox } from "../FacilityCombobox";
import { DeclineDialog } from "./DeclineDialog";
import { SubmissionCardMeta } from "./SubmissionCardMeta";
import { ViewToggle } from "./SubmissionBoard";
import {
  readQueueFilters,
  toStoreFilter,
  writeQueueFilters,
  hasActiveQueueFilters,
  type QueueFilters,
} from "./submissionFilters";
import { isSupabaseConfigured, supabase } from "@/lib/stores/supabase/client";

const TABS: Array<{ key: SubmissionStatus; label: string }> = [
  { key: "submitted", label: "New" },
  { key: "approved", label: "Approved" },
  { key: "posted", label: "Posted" },
  { key: "declined", label: "Declined" },
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

export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="sp-card px-4 py-3 flex-1" style={{ minWidth: 140 }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 22, lineHeight: 1.1, color: "var(--ink)" }}>{value}</p>
      <p style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>{label}</p>
    </div>
  );
}

/** The Agency's working queue, now the LIST view behind the Board /
 * List toggle: stat strip, status tabs, query-side filters, bulk actions,
 * and the J/K/Enter/A/D keyboard flow the board can't replicate. */
export function SubmissionQueue({ onSwitchView }: { onSwitchView(): void }) {
  const { company } = useAuth();
  const { navigate } = useRouter();
  const companyId = company?.id ?? "";

  const [filters, setFilters] = useState<QueueFilters>(() => ({ ...readQueueFilters(), view: "list" }));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusIndex, setFocusIndex] = useState(0);
  const [declineFor, setDeclineFor] = useState<Submission | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => writeQueueFilters(filters), [filters]);

  const statsState = useAsync(() => stores.submissions.stats(companyId), [companyId, tick]);
  const facilitiesState = useAsync(() => stores.facilities.list(companyId), [companyId]);
  const templatesState = useAsync(() => stores.templates.listAll(companyId), [companyId]);

  const listState = useAsync(
    () => stores.submissions.list(companyId, { ...toStoreFilter(filters), status: filters.status }),
    [
      companyId,
      filters.status,
      filters.kind,
      filters.flaggedOnly,
      filters.facilityId,
      filters.templateId,
      filters.from,
      filters.to,
      filters.search,
      tick,
    ],
  );
  const rows = listState.status === "ready" ? listState.data : [];

  // The detail screen's J/K navigation follows this exact ordering.
  useEffect(() => {
    try {
      sessionStorage.setItem("shc-queue-order", JSON.stringify(rows.map((r) => r.id)));
    } catch {
      // best-effort
    }
  }, [rows]);

  const facilities = facilitiesState.status === "ready" ? facilitiesState.data : [];
  const facilityOptions = useMemo(
    () => facilities.map((f) => ({ id: f.id, name: f.name, shortName: f.shortName, state: f.state })),
    [facilities],
  );
  const templates = templatesState.status === "ready" ? templatesState.data : [];

  const refresh = () => {
    setSelected(new Set());
    setTick((t) => t + 1);
  };

  const setFilter = (patch: Partial<QueueFilters>) => {
    setSelected(new Set());
    setFocusIndex(0);
    setFilters((f) => ({ ...f, ...patch }));
  };

  const switchToBoard = () => {
    setFilters((f) => {
      const next = { ...f, view: "board" as const };
      writeQueueFilters(next);
      return next;
    });
    onSwitchView();
  };

  const bulk = async (status: SubmissionStatus) => {
    if (!selected.size) return;
    setBulkBusy(true);
    try {
      await Promise.all([...selected].map((id) => stores.submissions.update(id, { status })));
      refresh();
    } catch (e) {
      console.error("Bulk action failed", e);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDecline = async (submission: Submission, reason: string, notify: boolean) => {
    setDeclineFor(null);
    try {
      await stores.submissions.update(submission.id, { status: "declined", declineReason: reason });
      if (notify && isSupabaseConfigured) {
        try {
          await supabase().functions.invoke("notify-submitter", {
            body: { submissionId: submission.id, reason },
          });
        } catch (e) {
          console.warn("Submitter notification failed", e);
        }
      }
      refresh();
    } catch (e) {
      console.error("Decline failed", e);
    }
  };

  // J/K move focus, Enter opens, A approves, D opens decline.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const focused = rows[focusIndex];
      if (["j", "J", "k", "K", "a", "A", "d", "D", "Enter"].includes(e.key)) e.preventDefault();
      if (e.key === "j" || e.key === "J") {
        setFocusIndex((i) => Math.min(rows.length - 1, i + 1));
      } else if (e.key === "k" || e.key === "K") {
        setFocusIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter" && focused) {
        navigate({ name: "submissionDetail", submissionId: focused.id });
      } else if ((e.key === "a" || e.key === "A") && focused) {
        void stores.submissions.update(focused.id, { status: "approved" }).then(refresh);
      } else if ((e.key === "d" || e.key === "D") && focused) {
        setDeclineFor(focused);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, focusIndex, navigate]);

  const stats = statsState.status === "ready" ? statsState.data : null;
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const filterFacility = facilityOptions.find((f) => f.id === filters.facilityId);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="sp-page-title">Submissions</h1>
          <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
            Content from your facilities. Review, fix, download, and mark it
            posted. <span style={{ color: "var(--fg-4)" }}>J/K move · Enter opens · A approves · D declines.</span>
          </p>
        </div>
        <ViewToggle view="list" onSwitch={switchToBoard} />
      </div>

      {/* Stat strip — compact, no charts; /insights is the analytics product */}
      {stats && (
        <div className="flex flex-wrap gap-2">
          <Stat label="Awaiting review" value={stats.awaitingReview} />
          <Stat label="Approved, not posted" value={stats.approvedUnposted} />
          <Stat label="Posted · 30d" value={stats.posted30d} />
          <Stat label="Declined · 30d" value={stats.declined30d} />
        </div>
      )}

      {/* Status tabs + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 flex-wrap" role="tablist" aria-label="Submission status">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={filters.status === key}
              onClick={() => setFilter({ status: key })}
              className="sp-btn"
              style={{
                minHeight: 32,
                padding: "4px 12px",
                background: filters.status === key ? "var(--accent-wash)" : "transparent",
                border: `1px solid ${filters.status === key ? "var(--accent-border)" : "var(--hairline-strong)"}`,
                color: filters.status === key ? "var(--ink)" : "var(--fg-2)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative" style={{ width: 200 }}>
          <Search className="absolute" style={{ left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--fg-3)", zIndex: 1 }} />
          <input
            className="sp-input"
            style={{ padding: "7px 10px 7px 30px", fontSize: 12 }}
            placeholder="Facility, submitter, caption…"
            aria-label="Search submissions"
            value={filters.search}
            onChange={(e) => setFilter({ search: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Facility filter — the same combobox the facility gate uses */}
        <FacilityFilter
          value={filterFacility ?? null}
          options={facilityOptions}
          onChange={(id) => setFilter({ facilityId: id })}
        />
        <select
          className="sp-input"
          style={{ width: "auto", fontSize: 12, padding: "6px 10px" }}
          value={filters.templateId}
          onChange={(e) => setFilter({ templateId: e.target.value })}
          aria-label="Filter by template"
        >
          <option value="">All templates</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input
          type="date"
          className="sp-input"
          style={{ width: "auto", fontSize: 12, padding: "6px 10px" }}
          value={filters.from}
          onChange={(e) => setFilter({ from: e.target.value })}
          aria-label="From date"
        />
        <span style={{ fontSize: 12, color: "var(--fg-4)" }}>to</span>
        <input
          type="date"
          className="sp-input"
          style={{ width: "auto", fontSize: 12, padding: "6px 10px" }}
          value={filters.to}
          onChange={(e) => setFilter({ to: e.target.value })}
          aria-label="To date"
        />
        <select
          className="sp-input"
          style={{ width: "auto", fontSize: 12, padding: "6px 10px" }}
          value={filters.kind}
          onChange={(e) => setFilter({ kind: e.target.value as QueueFilters["kind"] })}
          aria-label="Filter by submission kind"
        >
          <option value="">All submissions</option>
          <option value="template">Templates</option>
          <option value="direct">Direct uploads</option>
        </select>
        <label className="flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--fg-2)" }}>
          <input
            type="checkbox"
            checked={filters.flaggedOnly}
            onChange={(e) => setFilter({ flaggedOnly: e.target.checked })}
          />
          Flagged only
        </label>
        {hasActiveQueueFilters(filters) && (
          <button
            className="flex items-center gap-1"
            style={{ fontSize: 12, color: "var(--fg-3)" }}
            onClick={() =>
              setFilter({ kind: "", facilityId: "", templateId: "", from: "", to: "", search: "", flaggedOnly: false })
            }
          >
            <X style={{ width: 12, height: 12 }} />
            Clear filters
          </button>
        )}
      </div>

      {/* Bulk bar — NO bulk decline: a blanket reason is not a real reason */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" style={{ fontSize: 12 }}>
          <label className="flex items-center gap-2" style={{ color: "var(--fg-2)" }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) =>
                setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())
              }
              aria-label="Select all in current filter"
            />
            {selected.size ? `${selected.size} selected` : "Select all"}
          </label>
          {selected.size > 0 && (
            <>
              <button className="sp-btn sp-btn-ghost" style={{ minHeight: 28, padding: "2px 10px" }} disabled={bulkBusy} onClick={() => void bulk("approved")}>
                <Check style={{ width: 12, height: 12 }} /> Approve
              </button>
              <button className="sp-btn sp-btn-ghost" style={{ minHeight: 28, padding: "2px 10px" }} disabled={bulkBusy} onClick={() => void bulk("posted")}>
                <Send style={{ width: 12, height: 12 }} /> Mark posted
              </button>
              <button className="sp-btn sp-btn-ghost" style={{ minHeight: 28, padding: "2px 10px" }} disabled={bulkBusy} onClick={() => void bulk("archived")}>
                <Archive style={{ width: 12, height: 12 }} /> Archive
              </button>
            </>
          )}
        </div>
      )}

      {/* Queue */}
      {listState.status === "loading" ? (
        <p className="text-center py-16" style={{ fontSize: 13, color: "var(--fg-3)" }}>Loading…</p>
      ) : listState.status === "error" ? (
        <ErrorState
          title="We couldn't load submissions."
          detail="Check your connection and try again."
          onRetry={listState.retry}
        />
      ) : rows.length === 0 ? (
        <div className="sp-card text-center py-16 px-6">
          <Inbox style={{ width: 28, height: 28, color: "var(--fg-4)", margin: "0 auto 10px" }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-1)" }}>
            {filters.status === "submitted" ? "No new submissions" : `Nothing ${filters.status} yet`}
          </p>
          <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 6 }}>
            {filters.facilityId || filters.search || filters.templateId || filters.from
              ? "Nothing matches the current filters."
              : filters.status === "submitted"
                ? "Facility submissions land here the moment they're sent."
                : "Items you move to this status will show up here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((s, i) => (
            <div
              key={s.id}
              className="w-full p-4 flex items-center gap-4 transition-all"
              style={{
                background: "var(--lift)",
                border: `1px solid ${i === focusIndex ? "var(--accent-border)" : "var(--hairline)"}`,
                borderRadius: 12,
                boxShadow: "var(--shadow-e1)",
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(s.id);
                  else next.delete(s.id);
                  setSelected(next);
                }}
                aria-label={`Select ${s.templateName} from ${s.facilityName}`}
              />
              <button
                className="flex items-center gap-4 flex-1 min-w-0 text-left"
                onClick={() => navigate({ name: "submissionDetail", submissionId: s.id })}
              >
                <PreviewThumb submission={s} />
                <div className="min-w-0 flex-1">
                  <p className="truncate" style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
                    {s.kind === "direct" ? "Direct upload" : s.templateName}
                    {s.editedAt && (
                      <span style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 400 }}> · edited</span>
                    )}
                  </p>
                  <p className="truncate" style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 2 }}>
                    {s.facilityName} · {s.submitterName}
                  </p>
                  {s.status === "declined" && s.declineReason ? (
                    <p className="truncate" style={{ fontSize: 12, color: "var(--danger)", marginTop: 2 }}>
                      Declined: {s.declineReason}
                    </p>
                  ) : (
                    s.caption && (
                      <p className="truncate" style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>
                        {s.caption}
                      </p>
                    )
                  )}
                  <SubmissionCardMeta submission={s} />
                </div>
                <span className="flex-shrink-0" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>
                  {relativeTime(s.createdAt)}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {declineFor && (
        <DeclineDialog
          submitterEmail={declineFor.submitterEmail}
          onDecline={(reason, notify) => void handleDecline(declineFor, reason, notify)}
          onCancel={() => setDeclineFor(null)}
        />
      )}
    </div>
  );
}

/** Compact popover wrapper around FacilityCombobox for the filter row. */
export function FacilityFilter({
  value,
  options,
  onChange,
}: {
  value: { id: string; shortName: string } | null;
  options: Array<{ id: string; name: string; shortName: string; state?: string }>;
  onChange(id: string): void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="sp-btn sp-btn-ghost"
        style={{ minHeight: 32, padding: "4px 12px", fontSize: 12 }}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {value ? `Facility: ${value.shortName}` : "All facilities"}
        {value && (
          <X
            style={{ width: 12, height: 12 }}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          />
        )}
      </button>
      {open && (
        <div
          className="absolute z-30 mt-1"
          style={{ minWidth: 300, background: "var(--lift)", borderRadius: 12, boxShadow: "var(--shadow-e3)" }}
        >
          <FacilityCombobox
            facilities={options}
            autoFocus
            placeholder="Filter by facility…"
            onSelect={(f) => {
              onChange(f.id);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
