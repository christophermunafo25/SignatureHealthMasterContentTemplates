import type { FacilityLink } from "../../types";
import type { FacilityLinkStore } from "../interfaces";
import { supabase } from "./client";

interface FacilityLinkRow {
  id: string;
  company_id: string;
  token: string;
  facility_name: string;
  template_tags: string[];
  active: boolean;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
}

const toLink = (r: FacilityLinkRow): FacilityLink => ({
  id: r.id,
  companyId: r.company_id,
  token: r.token,
  facilityName: r.facility_name,
  templateTags: r.template_tags ?? [],
  active: r.active,
  expiresAt: r.expires_at ?? undefined,
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at ?? undefined,
});

export class SupabaseFacilityLinkStore implements FacilityLinkStore {
  async list(companyId: string): Promise<FacilityLink[]> {
    const { data, error } = await supabase()
      .from("facility_links")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as FacilityLinkRow[]).map(toLink);
  }

  async create(
    companyId: string,
    input: { facilityName: string; templateTags?: string[]; expiresAt?: string | null },
  ): Promise<FacilityLink> {
    // No token in the insert: the database default mints it server-side
    // (gen_random_bytes — see migration 0016).
    const { data, error } = await supabase()
      .from("facility_links")
      .insert({
        company_id: companyId,
        facility_name: input.facilityName,
        template_tags: input.templateTags ?? [],
        expires_at: input.expiresAt ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return toLink(data as FacilityLinkRow);
  }

  async bulkCreate(companyId: string, facilityNames: string[]): Promise<FacilityLink[]> {
    const rows = facilityNames.map((facility_name) => ({ company_id: companyId, facility_name }));
    const { data, error } = await supabase().from("facility_links").insert(rows).select();
    if (error) throw error;
    return (data as FacilityLinkRow[]).map(toLink);
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const { error } = await supabase().from("facility_links").update({ active }).eq("id", id);
    if (error) throw error;
  }
}
