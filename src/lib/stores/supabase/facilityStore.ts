import type { Facility } from "../../types";
import type { FacilityStore } from "../interfaces";
import { supabase } from "./client";

interface FacilityRow {
  id: string;
  company_id: string;
  name: string;
  short_name: string;
  state: string | null;
  region: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

const toFacility = (r: FacilityRow): Facility => ({
  id: r.id,
  companyId: r.company_id,
  name: r.name,
  shortName: r.short_name || r.name,
  state: r.state ?? undefined,
  region: r.region ?? undefined,
  sortOrder: r.sort_order,
  active: r.active,
  createdAt: r.created_at,
});

export class SupabaseFacilityStore implements FacilityStore {
  async list(companyId: string): Promise<Facility[]> {
    const { data, error } = await supabase()
      .from("facilities")
      .select("*")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true })
      .order("short_name", { ascending: true });
    if (error) throw error;
    return (data as FacilityRow[]).map(toFacility);
  }

  async create(companyId: string, input: { name: string; shortName: string }): Promise<Facility> {
    const { data, error } = await supabase()
      .from("facilities")
      .insert({ company_id: companyId, name: input.name, short_name: input.shortName })
      .select()
      .single();
    if (error) throw error;
    return toFacility(data as FacilityRow);
  }

  async bulkCreate(
    companyId: string,
    rows: Array<{ name: string; shortName: string }>,
  ): Promise<Facility[]> {
    const { data, error } = await supabase()
      .from("facilities")
      .upsert(
        rows.map((r) => ({ company_id: companyId, name: r.name, short_name: r.shortName })),
        { onConflict: "company_id,name" },
      )
      .select();
    if (error) throw error;
    return (data as FacilityRow[]).map(toFacility);
  }

  async rename(id: string, patch: { name?: string; shortName?: string }): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.shortName !== undefined) row.short_name = patch.shortName;
    const { error } = await supabase().from("facilities").update(row).eq("id", id);
    if (error) throw error;
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const { error } = await supabase().from("facilities").update({ active }).eq("id", id);
    if (error) throw error;
  }
}
