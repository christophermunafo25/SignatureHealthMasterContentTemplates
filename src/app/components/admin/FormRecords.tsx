import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ClipboardList, Download, Flag, Search, X } from "lucide-react";
import type { Submission, SubmissionStatus } from "@/lib/types";
import { LEGACY_RELEASE_QUESTIONS, RELEASE_QUESTIONS, isV3Form } from "@/lib/releaseForm";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../../router";
import { ErrorState } from "../ErrorState";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { FacilityFilter } from "./SubmissionQueue";
import {
  QUEUE_STATUSES,
  hasActiveRecordFilters,
  readRecordFilters,
  recordStoreFilter,
  writeRecordFilters,
  type RecordFilters,
} from "./submissionFilters";

const PAGE_SIZE = 50;

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  submitted: "New",
  approved: "Approved",
  posted: "Posted",
  declined: "Declined",
  archived: "Archived",
};

/** CSV escaping: every field quoted, embedded quotes doubled — commas,
 * newlines, and quotes inside answers survive Excel. */
const csvField = (v: unknown): string => `"${String(v ?? "").replace(/"/g, '""')}"`;

function buildCsv(rows: Submission[]): string {
  const Q = RELEASE_QUESTIONS;
  const L = LEGACY_RELEASE_QUESTIONS;
  // The CSV is an audit artifact, so no column is ever dropped: metadata
  // first, then the v3 questions, then the v1/v2-only questions kept at the
  // end so historical rows still export the consent answers they gave. A v3
  // row leaves the legacy cells empty and a legacy row leaves the v3-only
  // cell empty; the shared questions (platforms, post copy, requested slot,
  // acknowledgement) fill for both, which is why "Form version" is here —
  // it says which questionnaire produced the answer.
  const header = [
    "Submitted",
    "Facility",
    "Submitter",
    "Email",
    "Type",
    "Status",
    "Flagged",
    "Files",
    "Form version",
    Q.platforms.label,
    Q.postText.label,
    Q.needsSpecificSchedule.label,
    Q.requestedPostDate.label,
    Q.requestedPostTime.label,
    Q.acknowledged.label,
    L.isEvent.label,
    L.vpApproved.label,
    L.photoRelease.label,
    L.hasMinors.label,
    L.minorRelease.label,
    L.offCampusRelease.label,
    L.includesMedia.label,
  ];
  const lines = [header.map(csvField).join(",")];
  for (const s of rows) {
    const rf = s.releaseForm;
    const v3 = isV3Form(rf);
    lines.push(
      [
        s.createdAt,
        s.facilityName,
        s.submitterName,
        s.submitterEmail ?? "",
        s.kind === "direct" ? "Direct upload" : s.templateName,
        STATUS_LABELS[s.status],
        s.releaseFlagged ? "Yes" : "No",
        s.assets.length,
        rf ? `v${rf.version}` : "",
        rf?.platforms?.join("; ") ?? "",
        rf?.postText ?? s.caption,
        v3 ? rf?.needsSpecificSchedule ?? "" : "",
        rf?.requestedPostDate ?? "",
        rf?.requestedPostTime ?? "",
        rf ? (rf.acknowledged ? "Yes" : "No") : "",
        v3 ? "" : rf?.isEvent ?? "",
        v3 ? "" : rf?.vpApproved ?? "",
        v3 ? "" : rf?.photoRelease ?? "",
        v3 ? "" : rf?.hasMinors ?? "",
        v3 ? "" : rf?.minorRelease ?? "",
        v3 ? "" : rf?.offCampusRelease ?? "",
        v3 ? "" : rf?.includesMedia ?? "",
      ]
        .map(csvField)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

/** Form Records: the searchable, filterable register of every submitted
 * form, v1 through v3. A dense table for lookup and audit — the working
 * queue lives on the Submissions board. */
export function FormRecords() {
  const { company } = useAuth();
  const { navigate } = useRouter();
  const companyId = company?.id ?? "";

  const [filters, setFilters] = useState<RecordFilters>(() => readRecordFilters());
  const [exporting, setExporting] = useState(false);

  useEffect(() => writeRecordFilters(filters), [filters]);

  const storeFilter = useMemo(() => recordStoreFilter(filters), [filters]);
  const facilitiesState = useAsync(() => stores.facilities.list(companyId), [companyId]);

  const listState = useAsync(
    () =>
      stores.submissions.list(companyId, {
        ...storeFilter,
        orderBy: filters.sort === "postDate" ? "requestedPostDate" : "createdAt",
        orderDir: filters.sortDir,
        limit: PAGE_SIZE,
        offset: filters.page * PAGE_SIZE,
      }),
    [companyId, storeFilter, filters.sort, filters.sortDir, filters.page],
  );
  const countsState = useAsync(() => stores.submissions.counts(companyId, storeFilter), [companyId, storeFilter]);

  const rows = listState.status === "ready" ? listState.data : [];
  const total =
    countsState.status === "ready"
      ? filters.statuses.length
        ? filters.statuses.reduce((n, s) => n + countsState.data[s], 0)
        : Object.values(countsState.data).reduce((n, c) => n + c, 0)
      : null;
  const pageCount = total !== null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : null;

  const facilities = facilitiesState.status === "ready" ? facilitiesState.data : [];
  const facilityOptions = useMemo(
    () => facilities.map((f) => ({ id: f.id, name: f.name, shortName: f.shortName, state: f.state })),
    [facilities],
  );
  const filterFacility = facilityOptions.find((f) => f.id === filters.facilityId);

  const setFilter = (patch: Partial<RecordFilters>) =>
    setFilters((f) => ({ ...f, ...patch, ...(patch.page === undefined ? { page: 0 } : {}) }));

  const toggleSort = (col: "created" | "postDate") =>
    setFilters((f) => ({
      ...f,
      sort: col,
      sortDir: f.sort === col && f.sortDir === "desc" ? "asc" : "desc",
      page: 0,
    }));

  const exportCsv = async () => {
    setExporting(true);
    try {
      // The FULL filtered result set, not the current page.
      const all = await stores.submissions.list(companyId, {
        ...storeFilter,
        orderBy: filters.sort === "postDate" ? "requestedPostDate" : "createdAt",
        orderDir: filters.sortDir,
      });
      const csv = buildCsv(all);
      const a = document.createElement("a");
      // UTF-8 BOM so Excel opens accented characters cleanly.
      a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
      a.download = `shc-form-records-${new Date().toLocaleDateString("en-CA")}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error("CSV export failed", e);
    } finally {
      setExporting(false);
    }
  };

  const sortHeader = (label: string, col: "created" | "postDate") => (
    <button className="flex items-center gap-1" onClick={() => toggleSort(col)} style={{ fontWeight: 600 }}>
      {label}
      {filters.sort === col &&
        (filters.sortDir === "desc" ? (
          <ArrowDown style={{ width: 11, height: 11 }} />
        ) : (
          <ArrowUp style={{ width: 11, height: 11 }} />
        ))}
    </button>
  );

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "8px 10px",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--fg-3)",
    whiteSpace: "nowrap",
    borderBottom: "1px solid var(--hairline-strong)",
  };
  const td: React.CSSProperties = {
    padding: "9px 10px",
    fontSize: 12.5,
    color: "var(--fg-1)",
    borderBottom: "1px solid var(--hairline)",
    whiteSpace: "nowrap",
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="sp-page-title">Form Records</h1>
          <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
            The register of every Social Media Submission Form. For lookup
            and audit — review happens on the Submissions board.
          </p>
        </div>
        <button className="sp-btn sp-btn-ghost" onClick={() => void exportCsv()} disabled={exporting || rows.length === 0}>
          <Download style={{ width: 13, height: 13 }} />
          {exporting ? "Exporting…" : "Download CSV"}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative" style={{ width: 220 }}>
          <Search className="absolute" style={{ left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--fg-3)", zIndex: 1 }} />
          <input
            className="sp-input"
            style={{ padding: "7px 10px 7px 30px", fontSize: 12 }}
            placeholder="Facility, submitter, post copy…"
            aria-label="Search records"
            value={filters.search}
            onChange={(e) => setFilter({ search: e.target.value })}
          />
        </div>
        <FacilityFilter
          value={filterFacility ?? null}
          options={facilityOptions}
          onChange={(id) => setFilter({ facilityId: id })}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="sp-btn sp-btn-ghost" style={{ minHeight: 32, padding: "4px 12px", fontSize: 12 }}>
              {filters.statuses.length ? `Status: ${filters.statuses.map((s) => STATUS_LABELS[s]).join(", ")}` : "All statuses"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" style={{ background: "var(--lift)" }}>
            {QUEUE_STATUSES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={filters.statuses.includes(s)}
                onCheckedChange={(on) =>
                  setFilter({
                    statuses: on ? [...filters.statuses, s] : filters.statuses.filter((x) => x !== s),
                  })
                }
              >
                {STATUS_LABELS[s]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <select
          className="sp-input"
          style={{ width: "auto", fontSize: 12, padding: "6px 10px" }}
          value={filters.kind}
          onChange={(e) => setFilter({ kind: e.target.value as RecordFilters["kind"] })}
          aria-label="Filter by submission kind"
        >
          <option value="">All types</option>
          <option value="template">Templates</option>
          <option value="direct">Direct uploads</option>
        </select>
        <select
          className="sp-input"
          style={{ width: "auto", fontSize: 12, padding: "6px 10px" }}
          value={filters.platform}
          onChange={(e) => setFilter({ platform: e.target.value })}
          aria-label="Filter by platform"
        >
          <option value="">All platforms</option>
          <option value="Facebook">Facebook</option>
          <option value="Instagram">Instagram</option>
        </select>
        <label className="flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--fg-2)" }}>
          <input
            type="checkbox"
            checked={filters.flaggedOnly}
            onChange={(e) => setFilter({ flaggedOnly: e.target.checked })}
          />
          Flagged only
        </label>
      </div>

      {/* Two INDEPENDENT date ranges — clearly labelled so "submitted" and
          "requested to post" can't be conflated. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <fieldset className="flex items-center gap-2" style={{ border: "1px solid var(--hairline)", borderRadius: 10, padding: "6px 10px" }}>
          <legend className="sp-eyebrow" style={{ padding: "0 4px" }}>Submitted between</legend>
          <input type="date" className="sp-input" style={{ width: "auto", fontSize: 12, padding: "4px 8px" }} value={filters.from} onChange={(e) => setFilter({ from: e.target.value })} aria-label="Submitted from" />
          <span style={{ fontSize: 12, color: "var(--fg-4)" }}>and</span>
          <input type="date" className="sp-input" style={{ width: "auto", fontSize: 12, padding: "4px 8px" }} value={filters.to} onChange={(e) => setFilter({ to: e.target.value })} aria-label="Submitted to" />
        </fieldset>
        <fieldset className="flex items-center gap-2" style={{ border: "1px solid var(--hairline)", borderRadius: 10, padding: "6px 10px" }}>
          <legend className="sp-eyebrow" style={{ padding: "0 4px" }}>Requested to post between</legend>
          <input type="date" className="sp-input" style={{ width: "auto", fontSize: 12, padding: "4px 8px" }} value={filters.postFrom} onChange={(e) => setFilter({ postFrom: e.target.value })} aria-label="Requested post from" />
          <span style={{ fontSize: 12, color: "var(--fg-4)" }}>and</span>
          <input type="date" className="sp-input" style={{ width: "auto", fontSize: 12, padding: "4px 8px" }} value={filters.postTo} onChange={(e) => setFilter({ postTo: e.target.value })} aria-label="Requested post to" />
        </fieldset>
        {hasActiveRecordFilters(filters) && (
          <button
            className="flex items-center gap-1"
            style={{ fontSize: 12, color: "var(--fg-3)" }}
            onClick={() =>
              setFilter({
                search: "",
                facilityId: "",
                statuses: [],
                kind: "",
                platform: "",
                flaggedOnly: false,
                from: "",
                to: "",
                postFrom: "",
                postTo: "",
              })
            }
          >
            <X style={{ width: 12, height: 12 }} />
            Clear filters
          </button>
        )}
      </div>

      {/* Register table */}
      {listState.status === "loading" ? (
        <p className="text-center py-16" style={{ fontSize: 13, color: "var(--fg-3)" }}>Loading…</p>
      ) : listState.status === "error" ? (
        <ErrorState title="We couldn't load the records." detail="Check your connection and try again." onRetry={listState.retry} />
      ) : rows.length === 0 ? (
        <div className="sp-card text-center py-16 px-6">
          <ClipboardList style={{ width: 28, height: 28, color: "var(--fg-4)", margin: "0 auto 10px" }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-1)" }}>
            {hasActiveRecordFilters(filters) ? "Nothing matches these filters" : "No records yet"}
          </p>
          <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 6 }}>
            {hasActiveRecordFilters(filters)
              ? "Loosen or clear the filters to see more."
              : "Every submission's release form lands here the moment it's sent."}
          </p>
        </div>
      ) : (
        <div className="sp-card" style={{ overflowX: "auto", padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>{sortHeader("Submitted", "created")}</th>
                <th style={th}>Facility</th>
                <th style={th}>Submitter</th>
                <th style={th}>Type</th>
                <th style={th}>Platforms</th>
                <th style={th}>{sortHeader("Requested post", "postDate")}</th>
                <th style={th}>Status</th>
                <th style={th} aria-label="Flag" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate({ name: "recordDetail", submissionId: s.id })}
                  style={{ cursor: "pointer" }}
                  className="hover:bg-[var(--paper)]"
                >
                  <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                    {new Date(s.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td style={{ ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{s.facilityName}</td>
                  <td style={{ ...td, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{s.submitterName}</td>
                  <td style={{ ...td, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.kind === "direct" ? "Direct upload" : s.templateName || "—"}
                  </td>
                  <td style={td}>{s.platforms.length ? s.platforms.map((p) => (p === "Facebook" ? "FB" : p === "Instagram" ? "IG" : p)).join(" · ") : "—"}</td>
                  <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{s.requestedPostDate ?? "—"}</td>
                  <td style={td}>
                    <span className="capitalize">{STATUS_LABELS[s.status]}</span>
                  </td>
                  <td style={td}>
                    {s.releaseFlagged && <Flag style={{ width: 12, height: 12, color: "var(--danger)" }} aria-label="VP not approved" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total !== null && total > PAGE_SIZE && (
        <div className="flex items-center justify-between" style={{ fontSize: 12, color: "var(--fg-2)" }}>
          <span>
            {filters.page * PAGE_SIZE + 1}–{Math.min((filters.page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="sp-btn sp-btn-ghost"
              style={{ minHeight: 30, padding: "3px 10px", fontSize: 12 }}
              disabled={filters.page === 0}
              onClick={() => setFilter({ page: Math.max(0, filters.page - 1) })}
            >
              <ChevronLeft style={{ width: 12, height: 12 }} />
              Prev
            </button>
            <button
              className="sp-btn sp-btn-ghost"
              style={{ minHeight: 30, padding: "3px 10px", fontSize: 12 }}
              disabled={pageCount !== null && filters.page >= pageCount - 1}
              onClick={() => setFilter({ page: filters.page + 1 })}
            >
              Next
              <ChevronRight style={{ width: 12, height: 12 }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
