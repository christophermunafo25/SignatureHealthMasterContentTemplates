import React, { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { daysUntil } from "@/lib/holidays";
import {
  EMPTY_FILTER,
  isFiltered,
  type LibraryFilter,
  type LibrarySection,
  type OrganizedLibrary,
} from "@/lib/templateLibrary";

/** The browse controls and grouped grid shared by the facility library
 * (on the navy brand wash) and the team gallery (on the light canvas).
 * Organizing lives in src/lib/templateLibrary.ts; this file only draws. */

export type LibraryTone = "onDark" | "onLight";

// ── Filter state, mirrored to the URL ────────────────────────────────────
// Category and holiday ride the query string so a link like
// /browse?category=Holidays&holiday=thanksgiving opens straight to it. The
// search text stays local: it's a moment, not a destination.

function readFilterFromUrl(): LibraryFilter {
  if (typeof window === "undefined") return EMPTY_FILTER;
  const p = new URLSearchParams(window.location.search);
  return { query: "", category: p.get("category") || null, holiday: p.get("holiday") || null };
}

export function useLibraryFilter(): [LibraryFilter, (next: LibraryFilter) => void] {
  const [filter, setFilter] = useState<LibraryFilter>(readFilterFromUrl);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const set = (k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k));
    set("category", filter.category);
    set("holiday", filter.holiday);
    const search = p.toString();
    const url = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [filter.category, filter.holiday]);

  return [filter, setFilter];
}

// ── Chips ────────────────────────────────────────────────────────────────

function Chip({
  tone,
  active,
  count,
  onClick,
  children,
}: {
  tone: LibraryTone;
  active: boolean;
  count?: number;
  onClick(): void;
  children: React.ReactNode;
}) {
  const palette =
    tone === "onDark"
      ? active
        ? { background: "#ffffff", color: "var(--ink)", border: "1px solid #ffffff" }
        : { background: "rgba(255,255,255,0.1)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.3)" }
      : active
        ? { background: "var(--ink)", color: "var(--fg-on-dark-1)", border: "1px solid var(--ink)" }
        : { background: "var(--lift)", color: "var(--fg-2)", border: "1px solid var(--hairline-strong)" };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex items-center gap-1.5 flex-shrink-0"
      style={{
        ...palette,
        borderRadius: "var(--radius-pill)",
        padding: "7px 13px",
        minHeight: 36,
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        whiteSpace: "nowrap",
        cursor: "pointer",
      }}
    >
      {children}
      {count !== undefined && <span style={{ opacity: 0.65, fontWeight: 500 }}>{count}</span>}
    </button>
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────

export function LibraryFilterBar<T>({
  library,
  filter,
  onChange,
  totalCount,
  tone,
  showSearch = true,
}: {
  library: OrganizedLibrary<T>;
  filter: LibraryFilter;
  onChange(next: LibraryFilter): void;
  /** Every template, before filters: the "All" chip's count. */
  totalCount: number;
  tone: LibraryTone;
  showSearch?: boolean;
}) {
  const setCategory = (category: string | null) =>
    // A new category starts with every holiday in it showing.
    onChange({ ...filter, category: filter.category === category ? null : category, holiday: null });
  const setHoliday = (holiday: string | null) =>
    onChange({ ...filter, holiday: filter.holiday === holiday ? null : holiday });

  // One category means the chips would only restate the page.
  const showCategories = library.categories.length > 1;

  // On a phone the holiday row scrolls sideways; bring the selected chip
  // into view (a shared ?holiday=easter link would otherwise land with it
  // off-screen). Horizontal only, so the page itself never jumps.
  const holidayRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = holidayRow.current;
    const active = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !active) return;
    const left = active.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + active.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollLeft = left - 16;
    }
  }, [filter.holiday, library.holidays.length]);

  return (
    <div className="space-y-3">
      {showSearch && (
        <div className="relative max-w-md">
          <Search
            className="absolute"
            style={{ left: 14, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "var(--fg-3)", zIndex: 1 }}
          />
          <input
            type="text"
            value={filter.query}
            onChange={(e) => onChange({ ...filter, query: e.target.value })}
            placeholder="Search templates…"
            aria-label="Search templates"
            className="sp-input"
            style={{ padding: "10px 14px 10px 38px" }}
          />
        </div>
      )}
      {showCategories && (
        <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
          <Chip tone={tone} active={filter.category === null} count={totalCount} onClick={() => setCategory(null)}>
            All
          </Chip>
          {library.categories.map((c) => (
            <Chip
              key={c.name}
              tone={tone}
              active={filter.category === c.name}
              count={c.count}
              onClick={() => setCategory(c.name)}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      )}
      {library.holidays.length > 0 && (
        // Many holidays: one scrolling row on a phone instead of a wall of
        // wrapped chips. Soonest first, so the likely pick is on screen.
        <div
          ref={holidayRow}
          role="group"
          aria-label="Filter by holiday"
          className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible"
          style={{ scrollbarWidth: "thin" }}
        >
          {library.holidays.map((h) => (
            <Chip
              key={h.key}
              tone={tone}
              active={filter.holiday === h.key}
              count={h.count}
              onClick={() => setHoliday(h.key)}
            >
              {h.label}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

function sectionEyebrow(s: LibrarySection<unknown>, now: Date): string | null {
  if (!s.date) return null;
  const days = daysUntil(s.date, now);
  const when = days === 0 ? "Today" : days === 1 ? "Tomorrow" : fmtDate(s.date);
  return s.comingUp ? `Coming up · ${when}` : when;
}

export function LibrarySections<T extends { id: string }>({
  sections,
  tone,
  renderCard,
  now = new Date(),
}: {
  sections: LibrarySection<T>[];
  tone: LibraryTone;
  renderCard(t: T): React.ReactNode;
  now?: Date;
}) {
  const titleColor = tone === "onDark" ? "#ffffff" : "var(--ink)";
  return (
    <div className="space-y-10">
      {sections.map((s) => {
        const eyebrow = sectionEyebrow(s, now);
        const headingId = `library-${s.key.replace(/[^a-z0-9]+/gi, "-")}`;
        return (
          <section key={s.key} aria-labelledby={s.title ? headingId : undefined}>
            {s.title && (
              <div className="mb-4">
                {eyebrow && (
                  <p
                    className="sp-eyebrow mb-1"
                    style={
                      s.comingUp
                        ? { color: tone === "onDark" ? "var(--mint)" : "var(--solar)" }
                        : tone === "onDark"
                          ? { color: "rgba(255,255,255,0.7)" }
                          : undefined
                    }
                  >
                    {eyebrow}
                  </p>
                )}
                <h2
                  id={headingId}
                  className="flex items-baseline gap-2"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 20,
                    letterSpacing: "-0.01em",
                    color: titleColor,
                  }}
                >
                  {s.title}
                  <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.6 }}>{s.templates.length}</span>
                </h2>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {s.templates.map((t) => (
                <React.Fragment key={t.id}>{renderCard(t)}</React.Fragment>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ── Empty result ─────────────────────────────────────────────────────────

export function LibraryNoMatches({
  filter,
  onClear,
  tone,
}: {
  filter: LibraryFilter;
  onClear(): void;
  tone: LibraryTone;
}) {
  const q = filter.query.trim();
  return (
    <div className="text-center py-16 space-y-3">
      <p style={{ fontSize: 16, color: tone === "onDark" ? "rgba(255,255,255,0.85)" : "var(--fg-2)" }}>
        {q ? <>No templates match &ldquo;{q}&rdquo;{isFiltered({ ...filter, query: "" }) ? " here" : ""}.</> : "No templates here yet."}
      </p>
      {isFiltered(filter) && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5"
          style={{
            fontSize: 14,
            color: tone === "onDark" ? "#ffffff" : "var(--ink)",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          <X style={{ width: 13, height: 13 }} />
          Clear search and filters
        </button>
      )}
    </div>
  );
}
