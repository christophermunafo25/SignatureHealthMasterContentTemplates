import type { FieldValues, Submission, SubmissionAsset, SubmissionKind, SubmissionStatus, TemplateSchema } from "../../types";
import type { SubmissionFilter, SubmissionStore } from "../interfaces";
import { supabase } from "./client";

// deno-style Row typing kept loose: jsonb columns carry domain shapes verbatim.
interface SubmissionRow {
  id: string;
  company_id: string;
  kind: SubmissionKind | null;
  template_id: string | null;
  facility_id: string | null;
  facility_name: string;
  template_name: string;
  submitter_name: string;
  submitter_email: string | null;
  values: Submission["values"];
  original_values: Submission["originalValues"];
  caption: string;
  original_caption: string;
  release_form: Submission["releaseForm"] | null;
  asset_paths: SubmissionAsset[] | null;
  platforms: string[] | null;
  requested_post_date: string | null;
  requested_post_time: string | null;
  vp_approved: boolean | null;
  release_flagged: boolean | null;
  schema_snapshot: TemplateSchema | null;
  brand_snapshot: Submission["brandSnapshot"];
  preview_path: string | null;
  status: SubmissionStatus;
  decline_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  edited_by: string | null;
  edited_at: string | null;
  posted_at: string | null;
  internal_note: string;
  created_at: string;
  updated_at: string;
}

const toSubmission = (r: SubmissionRow): Submission => ({
  id: r.id,
  companyId: r.company_id,
  // Legacy pre-v2.2 rows default to the template kind.
  kind: r.kind ?? "template",
  templateId: r.template_id ?? undefined,
  facilityId: r.facility_id ?? undefined,
  facilityName: r.facility_name,
  templateName: r.template_name,
  submitterName: r.submitter_name,
  submitterEmail: r.submitter_email ?? undefined,
  values: r.values ?? {},
  originalValues: r.original_values ?? {},
  caption: r.caption,
  originalCaption: r.original_caption,
  releaseForm: r.release_form ?? undefined,
  assets: r.asset_paths ?? [],
  platforms: r.platforms ?? [],
  requestedPostDate: r.requested_post_date ?? undefined,
  requestedPostTime: r.requested_post_time ?? undefined,
  vpApproved: r.vp_approved ?? undefined,
  releaseFlagged: r.release_flagged ?? false,
  schemaSnapshot: r.schema_snapshot,
  brandSnapshot: r.brand_snapshot ?? { brandKit: null, brandAssets: [] },
  previewPath: r.preview_path ?? undefined,
  status: r.status,
  declineReason: r.decline_reason ?? undefined,
  reviewedBy: r.reviewed_by ?? undefined,
  reviewedAt: r.reviewed_at ?? undefined,
  editedBy: r.edited_by ?? undefined,
  editedAt: r.edited_at ?? undefined,
  postedAt: r.posted_at ?? undefined,
  internalNote: r.internal_note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const STATUSES: SubmissionStatus[] = ["submitted", "approved", "posted", "archived", "declined"];

/** Apply every SubmissionFilter field to a PostgREST query builder — the
 * one place the filter → query translation lives (list and counts share it). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilter(q: any, filter?: SubmissionFilter): any {
  if (!filter) return q;
  if (filter.status && filter.status !== "all") q = q.eq("status", filter.status);
  if (filter.statuses?.length) q = q.in("status", filter.statuses);
  if (filter.kind && filter.kind !== "all") q = q.eq("kind", filter.kind);
  if (filter.facilityId) q = q.eq("facility_id", filter.facilityId);
  if (filter.templateId) q = q.eq("template_id", filter.templateId);
  if (filter.from) q = q.gte("created_at", filter.from);
  if (filter.to) q = q.lte("created_at", filter.to);
  if (filter.postDateFrom) q = q.gte("requested_post_date", filter.postDateFrom);
  if (filter.postDateTo) q = q.lte("requested_post_date", filter.postDateTo);
  if (filter.platform) q = q.contains("platforms", [filter.platform]);
  if (filter.flaggedOnly) q = q.eq("release_flagged", true);
  if (filter.search?.trim()) {
    const s = filter.search.trim().replace(/[%_,]/g, "");
    q = q.or(`facility_name.ilike.%${s}%,submitter_name.ilike.%${s}%,caption.ilike.%${s}%,template_name.ilike.%${s}%`);
  }
  return q;
}

export class SupabaseSubmissionStore implements SubmissionStore {
  async list(companyId: string, filter?: SubmissionFilter): Promise<Submission[]> {
    // Every filter is part of the QUERY — never fetch-all-then-filter.
    const ascending = filter?.orderDir === "asc";
    let q = supabase().from("submissions").select("*").eq("company_id", companyId);
    q =
      filter?.orderBy === "requestedPostDate"
        ? q.order("requested_post_date", { ascending, nullsFirst: ascending }).order("created_at", { ascending: false })
        : q.order("created_at", { ascending });
    q = applyFilter(q, filter);
    if (filter?.limit !== undefined) {
      const offset = filter.offset ?? 0;
      q = q.range(offset, offset + filter.limit - 1);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data as SubmissionRow[]).map(toSubmission);
  }

  async counts(
    companyId: string,
    filter?: Omit<SubmissionFilter, "status" | "statuses" | "limit" | "offset">,
  ): Promise<Record<SubmissionStatus, number>> {
    // Head + exact count per status — the board headers never list rows.
    const one = async (status: SubmissionStatus): Promise<number> => {
      let q = supabase()
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", status);
      q = applyFilter(q, filter);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    };
    const values = await Promise.all(STATUSES.map(one));
    return Object.fromEntries(STATUSES.map((s, i) => [s, values[i]])) as Record<SubmissionStatus, number>;
  }

  async stats(companyId: string) {
    const count = async (apply: (q: any) => any): Promise<number> => {
      const base = supabase()
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      const { count: n, error } = await apply(base);
      if (error) throw error;
      return n ?? 0;
    };
    const cutoff30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [awaitingReview, approvedUnposted, posted30d, declined30d] = await Promise.all([
      count((q) => q.eq("status", "submitted")),
      count((q) => q.eq("status", "approved")),
      count((q) => q.eq("status", "posted").gte("updated_at", cutoff30)),
      count((q) => q.eq("status", "declined").gte("updated_at", cutoff30)),
    ]);
    return { awaitingReview, approvedUnposted, posted30d, declined30d };
  }

  async get(id: string): Promise<Submission | null> {
    const { data, error } = await supabase().from("submissions").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? toSubmission(data as SubmissionRow) : null;
  }

  async update(
    id: string,
    patch: Partial<Pick<Submission, "values" | "caption" | "status" | "internalNote" | "declineReason">>,
  ): Promise<Submission> {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.values !== undefined) row.values = patch.values;
    if (patch.caption !== undefined) row.caption = patch.caption;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.internalNote !== undefined) row.internal_note = patch.internalNote;
    if (patch.declineReason !== undefined) row.decline_reason = patch.declineReason;

    const isReview = patch.values !== undefined || patch.caption !== undefined || patch.status !== undefined;
    if (isReview) {
      const current = await this.get(id);
      const now = new Date().toISOString();
      const { data: userData } = await supabase().auth.getUser();
      const uid = userData.user?.id ?? null;
      // First edit or status change stamps the reviewer.
      if (current && !current.reviewedAt) {
        row.reviewed_by = uid;
        row.reviewed_at = now;
      }
      // First save where the document diverges from the originals stamps
      // the editor — the "Edited by" marker.
      if (current && !current.editedAt) {
        const nextValues = patch.values ?? current.values;
        const nextCaption = patch.caption ?? current.caption;
        if (
          JSON.stringify(nextValues) !== JSON.stringify(current.originalValues) ||
          nextCaption !== current.originalCaption
        ) {
          row.edited_by = uid;
          row.edited_at = now;
        }
      }
      if (patch.status === "posted") row.posted_at = now;
      // Reopening clears the decline reason.
      if (patch.status === "submitted" && patch.declineReason === undefined) row.decline_reason = null;
    }

    const { data, error } = await supabase()
      .from("submissions")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return toSubmission(data as SubmissionRow);
  }

  async countNew(companyId: string): Promise<number> {
    const { count, error } = await supabase()
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "submitted");
    if (error) throw error;
    return count ?? 0;
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase().from("submissions").delete().eq("id", id);
    if (error) throw error;
  }

  async signedValues(schema: TemplateSchema, values: FieldValues): Promise<FieldValues> {
    // Image field values are STORAGE PATHS (publicClient uploads the file and
    // stores the path so the values jsonb never carries megabytes of base64).
    // The submissions bucket is private, so a path renders as nothing and
    // breaks the export's data-URL pre-conversion. Sign them for display —
    // one round trip for the whole template, never written back to `values`.
    const paths = schema.fields
      .filter((f) => f.type === "image")
      .map((f) => values[f.fieldKey])
      .filter((v): v is string => Boolean(v) && !v.startsWith("data:") && !v.startsWith("http"));
    if (paths.length === 0) return values;

    const { data, error } = await supabase()
      .storage.from("submissions")
      .createSignedUrls(paths, 60 * 60);
    if (error) {
      console.warn("signing submission image values failed", error);
      return values;
    }
    const byPath = new Map<string, string>();
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) byPath.set(row.path, row.signedUrl);
    }
    const next: FieldValues = { ...values };
    for (const f of schema.fields) {
      if (f.type !== "image") continue;
      const signed = byPath.get(next[f.fieldKey] ?? "");
      if (signed) next[f.fieldKey] = signed;
    }
    return next;
  }

  async previewUrl(path: string): Promise<string | null> {
    // Private bucket: admin RLS on storage.objects makes signing possible.
    const { data, error } = await supabase().storage.from("submissions").createSignedUrl(path, 60 * 60);
    if (error) {
      console.warn("preview sign failed", error);
      return null;
    }
    return data?.signedUrl ?? null;
  }

  async assetUrls(assets: SubmissionAsset[]): Promise<Record<string, string>> {
    // One batch createSignedUrls call for the whole gallery (same pattern as
    // signedValues). Results key by BARE path and are never persisted.
    const paths = assets.map((a) => a.path).filter(Boolean);
    if (paths.length === 0) return {};
    const { data, error } = await supabase()
      .storage.from("submissions")
      .createSignedUrls(paths, 60 * 60);
    if (error) {
      console.warn("signing submission assets failed", error);
      return {};
    }
    const out: Record<string, string> = {};
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
    }
    return out;
  }
}
