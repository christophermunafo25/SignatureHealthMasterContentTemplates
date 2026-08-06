// URL-serialized filters shared by the submissions Board, the List view,
// and Form Records — one implementation so the three screens can't drift.
// Filters live in the URL so a reviewer can share a filtered view.

import type { SubmissionKind, SubmissionStatus } from "@/lib/types";
import type { SubmissionFilter } from "@/lib/stores/interfaces";

export const QUEUE_STATUSES: SubmissionStatus[] = [
  "submitted",
  "approved",
  "posted",
  "declined",
  "archived",
];

export interface QueueFilters {
  /** List view's active tab (the board shows four columns at once). */
  status: SubmissionStatus;
  view: "board" | "list";
  showArchived: boolean;
  kind: SubmissionKind | "";
  facilityId: string;
  templateId: string;
  from: string;
  to: string;
  search: string;
  flaggedOnly: boolean;
}

export const DEFAULT_QUEUE_FILTERS: QueueFilters = {
  status: "submitted",
  view: "board",
  showArchived: false,
  kind: "",
  facilityId: "",
  templateId: "",
  from: "",
  to: "",
  search: "",
  flaggedOnly: false,
};

export function readQueueFilters(): QueueFilters {
  const p = new URLSearchParams(window.location.search);
  const status = p.get("status") as SubmissionStatus | null;
  const kind = p.get("kind");
  return {
    status: status && QUEUE_STATUSES.includes(status) ? status : "submitted",
    view: p.get("view") === "list" ? "list" : "board",
    showArchived: p.get("archived") === "1",
    kind: kind === "template" || kind === "direct" ? kind : "",
    facilityId: p.get("facility") ?? "",
    templateId: p.get("template") ?? "",
    from: p.get("from") ?? "",
    to: p.get("to") ?? "",
    search: p.get("q") ?? "",
    flaggedOnly: p.get("flagged") === "1",
  };
}

export function writeQueueFilters(f: QueueFilters): void {
  const p = new URLSearchParams();
  if (f.view !== "board") p.set("view", f.view);
  if (f.status !== "submitted") p.set("status", f.status);
  if (f.showArchived) p.set("archived", "1");
  if (f.kind) p.set("kind", f.kind);
  if (f.facilityId) p.set("facility", f.facilityId);
  if (f.templateId) p.set("template", f.templateId);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.search) p.set("q", f.search);
  if (f.flaggedOnly) p.set("flagged", "1");
  const qs = p.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
}

/** The store-facing filter EXCLUDING status — the board queries per column,
 * the list adds its active tab, counts() takes it as-is. */
export function toStoreFilter(f: QueueFilters): Omit<SubmissionFilter, "status" | "statuses" | "limit" | "offset"> {
  return {
    kind: f.kind || undefined,
    facilityId: f.facilityId || undefined,
    templateId: f.templateId || undefined,
    from: f.from ? new Date(f.from).toISOString() : undefined,
    to: f.to ? new Date(`${f.to}T23:59:59`).toISOString() : undefined,
    flaggedOnly: f.flaggedOnly || undefined,
    search: f.search || undefined,
  };
}

export const hasActiveQueueFilters = (f: QueueFilters): boolean =>
  Boolean(f.kind || f.facilityId || f.templateId || f.from || f.to || f.search || f.flaggedOnly);

// ── Form Records ──────────────────────────────────────────────────────────

export interface RecordFilters {
  search: string;
  facilityId: string;
  statuses: SubmissionStatus[];
  kind: SubmissionKind | "";
  platform: string;
  flaggedOnly: boolean;
  /** Submitted between. */
  from: string;
  to: string;
  /** Requested to post between. */
  postFrom: string;
  postTo: string;
  sort: "created" | "postDate";
  sortDir: "asc" | "desc";
  page: number;
}

export const DEFAULT_RECORD_FILTERS: RecordFilters = {
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
  sort: "created",
  sortDir: "desc",
  page: 0,
};

export function readRecordFilters(): RecordFilters {
  const p = new URLSearchParams(window.location.search);
  const kind = p.get("kind");
  const statuses = (p.get("status") ?? "")
    .split(",")
    .filter((s): s is SubmissionStatus => QUEUE_STATUSES.includes(s as SubmissionStatus));
  return {
    search: p.get("q") ?? "",
    facilityId: p.get("facility") ?? "",
    statuses,
    kind: kind === "template" || kind === "direct" ? kind : "",
    platform: p.get("platform") ?? "",
    flaggedOnly: p.get("flagged") === "1",
    from: p.get("from") ?? "",
    to: p.get("to") ?? "",
    postFrom: p.get("postFrom") ?? "",
    postTo: p.get("postTo") ?? "",
    sort: p.get("sort") === "postDate" ? "postDate" : "created",
    sortDir: p.get("dir") === "asc" ? "asc" : "desc",
    page: Math.max(0, Number(p.get("page") ?? 0) || 0),
  };
}

export function writeRecordFilters(f: RecordFilters): void {
  const p = new URLSearchParams();
  if (f.search) p.set("q", f.search);
  if (f.facilityId) p.set("facility", f.facilityId);
  if (f.statuses.length) p.set("status", f.statuses.join(","));
  if (f.kind) p.set("kind", f.kind);
  if (f.platform) p.set("platform", f.platform);
  if (f.flaggedOnly) p.set("flagged", "1");
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.postFrom) p.set("postFrom", f.postFrom);
  if (f.postTo) p.set("postTo", f.postTo);
  if (f.sort !== "created") p.set("sort", f.sort);
  if (f.sortDir !== "desc") p.set("dir", f.sortDir);
  if (f.page > 0) p.set("page", String(f.page));
  const qs = p.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
}

export function recordStoreFilter(f: RecordFilters): Omit<SubmissionFilter, "limit" | "offset"> {
  return {
    search: f.search || undefined,
    facilityId: f.facilityId || undefined,
    statuses: f.statuses.length ? f.statuses : undefined,
    kind: f.kind || undefined,
    platform: f.platform || undefined,
    flaggedOnly: f.flaggedOnly || undefined,
    from: f.from ? new Date(f.from).toISOString() : undefined,
    to: f.to ? new Date(`${f.to}T23:59:59`).toISOString() : undefined,
    postDateFrom: f.postFrom || undefined,
    postDateTo: f.postTo || undefined,
  };
}

export const hasActiveRecordFilters = (f: RecordFilters): boolean =>
  Boolean(
    f.search ||
      f.facilityId ||
      f.statuses.length ||
      f.kind ||
      f.platform ||
      f.flaggedOnly ||
      f.from ||
      f.to ||
      f.postFrom ||
      f.postTo,
  );
