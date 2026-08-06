import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Check, FileText, Inbox, LayoutGrid, List, MoreHorizontal, Search, Send, ThumbsDown, Undo2, X } from "lucide-react";
import { toast, Toaster } from "sonner";
import type { Submission, SubmissionStatus } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { isSupabaseConfigured, supabase } from "@/lib/stores/supabase/client";
import { useRouter } from "../../router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { DeclineDialog } from "./DeclineDialog";
import { SubmissionCardMeta } from "./SubmissionCardMeta";
import { FacilityFilter, Stat, SubmissionQueue, relativeTime } from "./SubmissionQueue";
import {
  hasActiveQueueFilters,
  readQueueFilters,
  toStoreFilter,
  writeQueueFilters,
  type QueueFilters,
} from "./submissionFilters";

const PAGE_SIZE = 25;

interface BoardColumnDef {
  status: SubmissionStatus;
  label: string;
  accent: string;
  muted?: boolean;
}

const COLUMNS: BoardColumnDef[] = [
  { status: "submitted", label: "Submissions", accent: "var(--ink)" },
  { status: "approved", label: "Approved", accent: "var(--success)" },
  { status: "declined", label: "Declined", accent: "var(--danger)" },
  { status: "posted", label: "Posted", accent: "var(--solar)" },
];

const ARCHIVED_COLUMN: BoardColumnDef = {
  status: "archived",
  label: "Archived",
  accent: "var(--fg-4)",
  muted: true,
};

/** Route-level wrapper: reads view=board|list from the URL and renders the
 * Kanban board or the classic list. Both views share the same URL filter
 * params, so toggling preserves the working set. */
export function SubmissionsScreen() {
  const [view, setView] = useState<"board" | "list">(() => readQueueFilters().view);
  return view === "board" ? (
    <SubmissionBoard onSwitchView={() => setView("list")} />
  ) : (
    <SubmissionQueue onSwitchView={() => setView("board")} />
  );
}

/** The Board / List segmented toggle, persisted in the URL as view=. */
export function ViewToggle({ view, onSwitch }: { view: "board" | "list"; onSwitch(): void }) {
  const seg = (active: boolean): React.CSSProperties => ({
    minHeight: 30,
    padding: "3px 10px",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    background: active ? "var(--accent-wash)" : "transparent",
    color: active ? "var(--ink)" : "var(--fg-3)",
  });
  return (
    <div
      className="flex items-center gap-0.5 p-0.5 rounded-lg flex-shrink-0"
      style={{ border: "1px solid var(--hairline-strong)" }}
      role="group"
      aria-label="View"
    >
      <button style={seg(view === "board")} onClick={() => view !== "board" && onSwitch()} aria-pressed={view === "board"}>
        <LayoutGrid style={{ width: 12, height: 12 }} />
        Board
      </button>
      <button style={seg(view === "list")} onClick={() => view !== "list" && onSwitch()} aria-pressed={view === "list"}>
        <List style={{ width: 12, height: 12 }} />
        List
      </button>
    </div>
  );
}

/** Card thumbnail: the rendered preview, else the first uploaded image,
 * else a file-type glyph. Signed at render time, never persisted. */
function BoardThumb({ submission }: { submission: Submission }) {
  const [url, setUrl] = useState<string | null>(null);
  const firstImage = submission.assets.find((a) => a.mimeType.startsWith("image/"));
  useEffect(() => {
    let alive = true;
    if (submission.previewPath) {
      void stores.submissions.previewUrl(submission.previewPath).then((u) => alive && setUrl(u));
    } else if (firstImage) {
      void stores.submissions
        .assetUrls([firstImage])
        .then((map) => alive && setUrl(map[firstImage.path] ?? null));
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission.previewPath, firstImage?.path]);
  return (
    <div
      className="flex-shrink-0 overflow-hidden rounded-lg flex items-center justify-center"
      style={{ width: 44, height: 44, background: "var(--surface-sunken)", border: "1px solid var(--hairline)" }}
    >
      {url ? (
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <FileText style={{ width: 15, height: 15, color: "var(--fg-4)" }} />
      )}
    </div>
  );
}

interface ColumnState {
  rows: Submission[];
  /** Query offset for Load more — tracks rows FETCHED, separate from
   * optimistic moves in/out. */
  offset: number;
  exhausted: boolean;
  loading: boolean;
}

const emptyColumn = (): ColumnState => ({ rows: [], offset: 0, exhausted: false, loading: true });

/** v2.2 Kanban view of the review queue. No manual ordering inside a
 * column — cards always sort created_at desc; this is deliberate, not a
 * bug (see the build spec, Workstream E). */
export function SubmissionBoard({ onSwitchView }: { onSwitchView(): void }) {
  const { company } = useAuth();
  const { navigate } = useRouter();
  const companyId = company?.id ?? "";

  const [filters, setFilters] = useState<QueueFilters>(() => ({ ...readQueueFilters(), view: "board" }));
  const [columns, setColumns] = useState<Record<string, ColumnState>>({});
  const [counts, setCounts] = useState<Record<SubmissionStatus, number> | null>(null);
  const [dragOver, setDragOver] = useState<SubmissionStatus | null>(null);
  const [declinePending, setDeclinePending] = useState<{ submission: Submission; from: SubmissionStatus } | null>(null);
  const [announce, setAnnounce] = useState("");
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia("(max-width: 639px)").matches);
  const [expanded, setExpanded] = useState<Set<SubmissionStatus>>(() => new Set(["submitted"]));
  const dragId = useRef<string | null>(null);

  useEffect(() => writeQueueFilters(filters), [filters]);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const storeFilter = useMemo(() => toStoreFilter(filters), [filters]);
  const shownColumns = filters.showArchived ? [...COLUMNS, ARCHIVED_COLUMN] : COLUMNS;

  const statsState = useAsync(() => stores.submissions.stats(companyId), [companyId]);
  const facilitiesState = useAsync(() => stores.facilities.list(companyId), [companyId]);
  const templatesState = useAsync(() => stores.templates.listAll(companyId), [companyId]);

  // Column bodies + header counts reload together whenever the filter set
  // changes.
  useEffect(() => {
    let alive = true;
    const statuses = (filters.showArchived ? [...COLUMNS, ARCHIVED_COLUMN] : COLUMNS).map((c) => c.status);
    setColumns(Object.fromEntries(statuses.map((s) => [s, emptyColumn()])));
    void stores.submissions
      .counts(companyId, storeFilter)
      .then((c) => alive && setCounts(c))
      .catch((e) => console.error("counts failed", e));
    for (const status of statuses) {
      void stores.submissions
        .list(companyId, { ...storeFilter, status, limit: PAGE_SIZE, offset: 0 })
        .then((rows) => {
          if (!alive) return;
          setColumns((cols) => ({
            ...cols,
            [status]: { rows, offset: rows.length, exhausted: rows.length < PAGE_SIZE, loading: false },
          }));
        })
        .catch((e) => {
          console.error("column load failed", e);
          if (alive) setColumns((cols) => ({ ...cols, [status]: { ...emptyColumn(), loading: false, exhausted: true } }));
        });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, storeFilter, filters.showArchived]);

  const loadMore = async (status: SubmissionStatus) => {
    const col = columns[status];
    if (!col || col.loading || col.exhausted) return;
    setColumns((cols) => ({ ...cols, [status]: { ...col, loading: true } }));
    try {
      const more = await stores.submissions.list(companyId, {
        ...storeFilter,
        status,
        limit: PAGE_SIZE,
        offset: col.offset,
      });
      setColumns((cols) => {
        const cur = cols[status];
        if (!cur) return cols;
        const seen = new Set(cur.rows.map((r) => r.id));
        return {
          ...cols,
          [status]: {
            rows: [...cur.rows, ...more.filter((r) => !seen.has(r.id))],
            offset: cur.offset + more.length,
            exhausted: more.length < PAGE_SIZE,
            loading: false,
          },
        };
      });
    } catch (e) {
      console.error("load more failed", e);
      setColumns((cols) => (cols[status] ? { ...cols, [status]: { ...cols[status], loading: false } } : cols));
    }
  };

  /** Optimistic move: shift the card between columns, persist, roll back
   * with a toast on failure. Declines go through the reason dialog first. */
  const moveCard = useCallback(
    async (submission: Submission, to: SubmissionStatus, opts?: { declineReason?: string; notify?: boolean }) => {
      const from = submission.status;
      if (from === to) return;
      if (to === "declined" && opts?.declineReason === undefined) {
        setDeclinePending({ submission, from });
        return;
      }

      const label = COLUMNS.concat(ARCHIVED_COLUMN).find((c) => c.status === to)?.label ?? to;
      const moved: Submission = { ...submission, status: to };
      setColumns((cols) => {
        const next = { ...cols };
        if (next[from]) {
          next[from] = { ...next[from], rows: next[from].rows.filter((r) => r.id !== submission.id) };
        }
        if (next[to]) {
          const rows = [...next[to].rows.filter((r) => r.id !== submission.id), moved].sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          );
          next[to] = { ...next[to], rows };
        }
        return next;
      });
      setCounts((c) =>
        c ? { ...c, [from]: Math.max(0, c[from] - 1), [to]: c[to] + 1 } : c,
      );
      setAnnounce(`Moved to ${label}.`);

      try {
        await stores.submissions.update(submission.id, {
          status: to,
          ...(opts?.declineReason !== undefined ? { declineReason: opts.declineReason } : {}),
        });
        if (to === "declined" && opts?.notify && isSupabaseConfigured) {
          try {
            await supabase().functions.invoke("notify-submitter", {
              body: { submissionId: submission.id, reason: opts.declineReason },
            });
          } catch (e) {
            console.warn("Submitter notification failed", e);
          }
        }
      } catch (e) {
        console.error("Move failed", e);
        toast.error("Couldn't move the card — put it back.");
        // Roll back.
        setColumns((cols) => {
          const next = { ...cols };
          if (next[to]) next[to] = { ...next[to], rows: next[to].rows.filter((r) => r.id !== submission.id) };
          if (next[from]) {
            const rows = [...next[from].rows.filter((r) => r.id !== submission.id), submission].sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt),
            );
            next[from] = { ...next[from], rows };
          }
          return next;
        });
        setCounts((c) => (c ? { ...c, [from]: c[from] + 1, [to]: Math.max(0, c[to] - 1) } : c));
        setAnnounce("Move failed.");
      }
    },
    [],
  );

  const findCard = (id: string): Submission | null => {
    for (const col of Object.values(columns)) {
      const hit = col.rows.find((r) => r.id === id);
      if (hit) return hit;
    }
    return null;
  };

  const handleDrop = (status: SubmissionStatus, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/plain") || dragId.current;
    dragId.current = null;
    if (!id) return;
    const card = findCard(id);
    if (card) void moveCard(card, status);
  };

  const stats = statsState.status === "ready" ? statsState.data : null;
  const facilities = facilitiesState.status === "ready" ? facilitiesState.data : [];
  const facilityOptions = useMemo(
    () => facilities.map((f) => ({ id: f.id, name: f.name, shortName: f.shortName, state: f.state })),
    [facilities],
  );
  const templates = templatesState.status === "ready" ? templatesState.data : [];
  const filterFacility = facilityOptions.find((f) => f.id === filters.facilityId);

  const setFilter = (patch: Partial<QueueFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const switchToList = () => {
    setFilters((f) => {
      const next = { ...f, view: "list" as const };
      writeQueueFilters(next);
      return next;
    });
    onSwitchView();
  };

  const card = (s: Submission, accent: string) => (
    <div
      key={s.id}
      draggable
      tabIndex={0}
      role="article"
      aria-label={`${s.kind === "direct" ? "Direct upload" : s.templateName} from ${s.facilityName}`}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", s.id);
        e.dataTransfer.effectAllowed = "move";
        dragId.current = s.id;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) {
          navigate({ name: "submissionDetail", submissionId: s.id });
        }
      }}
      className="p-3 space-y-0 cursor-grab active:cursor-grabbing"
      style={{
        background: "var(--lift)",
        border: "1px solid var(--hairline)",
        borderRadius: 12,
        boxShadow: "var(--shadow-e1)",
      }}
    >
      <div className="flex items-start gap-2.5">
        <BoardThumb submission={s} />
        <button
          className="min-w-0 flex-1 text-left"
          onClick={() => navigate({ name: "submissionDetail", submissionId: s.id })}
          tabIndex={-1}
        >
          <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
            {s.kind === "direct" ? "Direct upload" : s.templateName}
          </p>
          <p className="truncate" style={{ fontSize: 11.5, color: "var(--fg-2)", marginTop: 1 }}>
            {s.facilityName}
          </p>
          <p className="truncate" style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 1 }}>
            {s.submitterName} · {relativeTime(s.createdAt)}
          </p>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`Move ${s.kind === "direct" ? "direct upload" : s.templateName} from ${s.facilityName}`}
              className="flex items-center justify-center rounded-md flex-shrink-0"
              style={{ width: 24, height: 24, color: "var(--fg-3)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal style={{ width: 14, height: 14 }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ background: "var(--lift)" }}>
            {[
              { status: "submitted" as const, label: "Move to Submissions", Icon: Undo2 },
              { status: "approved" as const, label: "Move to Approved", Icon: Check },
              { status: "declined" as const, label: "Move to Declined…", Icon: ThumbsDown },
              { status: "posted" as const, label: "Move to Posted", Icon: Send },
            ]
              .filter((m) => m.status !== s.status)
              .map(({ status, label, Icon }) => (
                <DropdownMenuItem key={status} onClick={() => void moveCard(s, status)}>
                  <Icon style={{ width: 13, height: 13 }} />
                  {label}
                </DropdownMenuItem>
              ))}
            {s.status !== "archived" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void moveCard(s, "archived")}>
                  <Archive style={{ width: 13, height: 13 }} />
                  Archive
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {s.status === "declined" && s.declineReason && (
        <p className="truncate" style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>
          {s.declineReason}
        </p>
      )}
      <SubmissionCardMeta submission={s} />
      <span aria-hidden style={{ display: "block", marginTop: 6, height: 2, borderRadius: 2, background: `color-mix(in srgb, ${accent} 18%, transparent)` }} />
    </div>
  );

  const column = (def: BoardColumnDef) => {
    const col = columns[def.status] ?? emptyColumn();
    const count = counts?.[def.status] ?? null;
    const isOver = dragOver === def.status;
    const isExpanded = !isNarrow || expanded.has(def.status);
    return (
      <section
        key={def.status}
        role="region"
        aria-label={`${def.label}${count !== null ? ` (${count})` : ""}`}
        className="flex flex-col sm:flex-1"
        style={{
          minWidth: isNarrow ? undefined : 300,
          borderTop: `3px solid ${def.accent}`,
          borderRadius: 12,
          background: isOver ? "var(--accent-wash)" : "var(--paper)",
          border: isOver ? "1px solid var(--accent-border)" : "1px solid var(--hairline)",
          borderTopWidth: 3,
          borderTopColor: def.accent,
          opacity: def.muted ? 0.75 : 1,
          transition: "background 0.12s",
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(def.status);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
        }}
        onDrop={(e) => handleDrop(def.status, e)}
      >
        <button
          className="flex items-center justify-between gap-2 px-3 py-2.5 w-full text-left"
          onClick={() =>
            isNarrow &&
            setExpanded((prev) => {
              const next = new Set(prev);
              if (next.has(def.status)) next.delete(def.status);
              else next.add(def.status);
              return next;
            })
          }
          aria-expanded={isNarrow ? isExpanded : undefined}
          style={{ cursor: isNarrow ? "pointer" : "default" }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{def.label}</span>
          <span
            className="flex items-center justify-center rounded-full px-2"
            style={{
              minWidth: 20,
              height: 20,
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              fontWeight: 600,
              color: "var(--ink)",
              background: `color-mix(in srgb, ${def.accent} 12%, transparent)`,
            }}
          >
            {count ?? "…"}
          </span>
        </button>
        {isExpanded && (
          <div
            className="flex flex-col gap-2 px-2.5 pb-2.5 min-h-0"
            style={{ overflowY: "auto", maxHeight: isNarrow ? undefined : "calc(100vh - 320px)", minHeight: 60 }}
          >
            {col.loading && col.rows.length === 0 ? (
              <p className="text-center py-6" style={{ fontSize: 12, color: "var(--fg-3)" }}>Loading…</p>
            ) : col.rows.length === 0 ? (
              <p className="text-center py-6" style={{ fontSize: 12, color: "var(--fg-4)" }}>Nothing here.</p>
            ) : (
              col.rows.map((s) => card(s, def.accent))
            )}
            {!col.exhausted && col.rows.length > 0 && (
              <button
                className="sp-btn sp-btn-ghost"
                style={{ minHeight: 30, fontSize: 12 }}
                disabled={col.loading}
                onClick={() => void loadMore(def.status)}
              >
                {col.loading ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-5">
      <Toaster position="bottom-right" />
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="sp-page-title">Submissions</h1>
          <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
            Content from your facilities. Drag cards between columns, or use a
            card&rsquo;s menu to move it.
          </p>
        </div>
        <ViewToggle view="board" onSwitch={switchToList} />
      </div>

      {stats && (
        <div className="flex flex-wrap gap-2">
          <Stat label="Awaiting review" value={stats.awaitingReview} />
          <Stat label="Approved, not posted" value={stats.approvedUnposted} />
          <Stat label="Posted · 30d" value={stats.posted30d} />
          <Stat label="Declined · 30d" value={stats.declined30d} />
        </div>
      )}

      {/* Filter row — shared URL params with the list view */}
      <div className="flex flex-wrap items-center gap-2">
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
        <label className="flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--fg-2)" }}>
          <input
            type="checkbox"
            checked={filters.flaggedOnly}
            onChange={(e) => setFilter({ flaggedOnly: e.target.checked })}
          />
          Flagged only
        </label>
        <label className="flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--fg-2)" }}>
          <input
            type="checkbox"
            checked={filters.showArchived}
            onChange={(e) => setFilter({ showArchived: e.target.checked })}
          />
          Show archived
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

      {/* The board */}
      {counts && Object.values(counts).every((n) => n === 0) && !hasActiveQueueFilters(filters) ? (
        <div className="sp-card text-center py-16 px-6">
          <Inbox style={{ width: 28, height: 28, color: "var(--fg-4)", margin: "0 auto 10px" }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-1)" }}>No submissions yet</p>
          <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 6 }}>
            Facility submissions land here the moment they&rsquo;re sent.
          </p>
        </div>
      ) : (
        <div className={isNarrow ? "flex flex-col gap-3" : "flex gap-3 items-stretch"} style={isNarrow ? undefined : { overflowX: "auto", paddingBottom: 6 }}>
          {shownColumns.map(column)}
        </div>
      )}

      {declinePending && (
        <DeclineDialog
          submitterEmail={declinePending.submission.submitterEmail}
          onDecline={(reason, notify) => {
            const { submission } = declinePending;
            setDeclinePending(null);
            void moveCard(submission, "declined", { declineReason: reason, notify });
          }}
          onCancel={() => setDeclinePending(null)}
        />
      )}

    </div>
  );
}
