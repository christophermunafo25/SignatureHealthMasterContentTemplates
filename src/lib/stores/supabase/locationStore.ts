import type { Location } from "../../types";
import type { LocationStore } from "../interfaces";
import { BUCKETS, supabase } from "./client";
import { toLocation, type LocationRow } from "./rows";

async function uploadLogo(companyId: string, file: File): Promise<string> {
  const path = `${companyId}/locations/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase().storage.from(BUCKETS.brandAssets).upload(path, file);
  if (error) throw error;
  return path;
}

export class SupabaseLocationStore implements LocationStore {
  async list(companyId: string): Promise<Location[]> {
    const { data, error } = await supabase()
      .from("locations")
      .select("*")
      .eq("company_id", companyId)
      .order("name");
    if (error) throw error;
    return (data as LocationRow[]).map(toLocation);
  }

  async create(companyId: string, input: { name: string; logoFile?: File }): Promise<Location> {
    const logo_storage_path = input.logoFile ? await uploadLogo(companyId, input.logoFile) : null;
    const { data, error } = await supabase()
      .from("locations")
      .insert({ company_id: companyId, name: input.name, logo_storage_path })
      .select()
      .single();
    if (error) throw error;
    return toLocation(data as LocationRow);
  }

  async update(id: string, patch: { name?: string; logoFile?: File }): Promise<Location> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.logoFile) {
      const { data: cur } = await supabase().from("locations").select("company_id").eq("id", id).single();
      row.logo_storage_path = await uploadLogo((cur as { company_id: string }).company_id, patch.logoFile);
    }
    const { data, error } = await supabase().from("locations").update(row).eq("id", id).select().single();
    if (error) throw error;
    return toLocation(data as LocationRow);
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase().from("locations").delete().eq("id", id);
    if (error) throw error;
  }
}
