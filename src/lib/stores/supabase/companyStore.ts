import type { CanvasPreset, Company } from "../../types";
import type { CompanyStore } from "../interfaces";
import { supabase } from "./client";
import { toCanvasPreset, toCompany, type CanvasPresetRow, type CompanyRow } from "./rows";

export class SupabaseCompanyStore implements CompanyStore {
  async list(): Promise<Company[]> {
    const { data, error } = await supabase().from("companies").select("*").order("name");
    if (error) throw error;
    return (data as CompanyRow[]).map(toCompany);
  }

  async get(id: string): Promise<Company | null> {
    const { data, error } = await supabase().from("companies").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? toCompany(data as CompanyRow) : null;
  }

  async create(input: { name: string; slug: string }): Promise<Company> {
    // Under real RLS, companies are only creatable via this security-definer
    // RPC, which also makes the caller an admin member atomically.
    const { data, error } = await supabase().rpc("create_company_with_admin", {
      p_name: input.name,
      p_slug: input.slug,
    });
    if (error) throw error;
    return toCompany(data as CompanyRow);
  }

  async setNotificationEmails(companyId: string, emails: string[]): Promise<void> {
    const { error } = await supabase()
      .from("companies")
      .update({ notification_emails: emails })
      .eq("id", companyId);
    if (error) throw error;
  }

  async rotatePortalToken(companyId: string, graceDays = 14): Promise<string> {
    const { data, error } = await supabase().rpc("rotate_portal_token", {
      p_company_id: companyId,
      p_grace_days: graceDays,
    });
    if (error) throw error;
    return data as string;
  }

  async setPortalEnabled(companyId: string, enabled: boolean): Promise<void> {
    const { error } = await supabase()
      .from("companies")
      .update({ portal_enabled: enabled })
      .eq("id", companyId);
    if (error) throw error;
  }

  async hasAnyCompany(): Promise<boolean> {
    const { count, error } = await supabase()
      .from("companies")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async listCanvasPresets(): Promise<CanvasPreset[]> {
    const { data, error } = await supabase()
      .from("canvas_presets")
      .select("*")
      .eq("enabled", true)
      .order("sort_order");
    if (error) throw error;
    return (data as CanvasPresetRow[]).map(toCanvasPreset);
  }
}
