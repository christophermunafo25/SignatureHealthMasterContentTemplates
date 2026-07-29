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
  reviewed_by: string | null;
  reviewed_at: string | null;
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
  reviewedBy: r.reviewed_by ?? undefined,
  reviewedAt: r.reviewed_at ?? undefined,
  internalNote: r.internal_note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class SupabaseSubmissionStore implements SubmissionStore {
  async list(
    companyId: string,
    filter?: { status?: SubmissionStatus; facilityId?: string; search?: string },
  ): Promise<Submission[]> {
    let q = supabase()
      .from("submissions")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (filter?.status) q = q.eq("status", filter.status);
    if (filter?.facilityId) q = q.eq("facility_id", filter.facilityId);
    if (filter?.search?.trim()) {
      const s = filter.search.trim().replace(/[%_]/g, "");
      q = q.or(`facility_name.ilike.%${s}%,submitter_name.ilike.%${s}%,caption.ilike.%${s}%,template_name.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data as SubmissionRow[]).map(toSubmission);
  }

  async get(id: string): Promise<Submission | null> {
    const { data, error } = await supabase().from("submissions").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? toSubmission(data as SubmissionRow) : null;
  }

  async update(
    id: string,
    patch: Partial<Pick<Submission, "values" | "caption" | "status" | "internalNote">>,
  ): Promise<Submission> {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.values !== undefined) row.values = patch.values;
    if (patch.caption !== undefined) row.caption = patch.caption;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.internalNote !== undefined) row.internal_note = patch.internalNote;

    // First edit or status change stamps the reviewer.
    const isReview = patch.values !== undefined || patch.caption !== undefined || patch.status !== undefined;
    if (isReview) {
      const current = await this.get(id);
      if (current && !current.reviewedAt) {
        const { data: userData } = await supabase().auth.getUser();
        row.reviewed_by = userData.user?.id ?? null;
        row.reviewed_at = new Date().toISOString();
      }
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
