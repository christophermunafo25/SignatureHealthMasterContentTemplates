import type { Submission, SubmissionStatus } from "../../types";
import type { SubmissionStore } from "../interfaces";
import { supabase } from "./client";

// deno-style Row typing kept loose: jsonb columns carry domain shapes verbatim.
interface SubmissionRow {
  id: string;
  company_id: string;
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
  schema_snapshot: Submission["schemaSnapshot"];
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

export class SupabaseSubmissionStore implements SubmissionStore {
  async list(
    companyId: string,
    filter?: {
      status?: SubmissionStatus | "all";
      facilityId?: string;
      templateId?: string;
      from?: string;
      to?: string;
      search?: string;
    },
  ): Promise<Submission[]> {
    // Every filter is part of the QUERY — never fetch-all-then-filter.
    let q = supabase()
      .from("submissions")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (filter?.status && filter.status !== "all") q = q.eq("status", filter.status);
    if (filter?.facilityId) q = q.eq("facility_id", filter.facilityId);
    if (filter?.templateId) q = q.eq("template_id", filter.templateId);
    if (filter?.from) q = q.gte("created_at", filter.from);
    if (filter?.to) q = q.lte("created_at", filter.to);
    if (filter?.search?.trim()) {
      const s = filter.search.trim().replace(/[%_,]/g, "");
      q = q.or(`facility_name.ilike.%${s}%,submitter_name.ilike.%${s}%,caption.ilike.%${s}%,template_name.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data as SubmissionRow[]).map(toSubmission);
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

  async previewUrl(path: string): Promise<string | null> {
    // Private bucket: admin RLS on storage.objects makes signing possible.
    const { data, error } = await supabase().storage.from("submissions").createSignedUrl(path, 60 * 60);
    if (error) {
      console.warn("preview sign failed", error);
      return null;
    }
    return data?.signedUrl ?? null;
  }
}
