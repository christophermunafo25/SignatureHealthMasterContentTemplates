import type { Role } from "../../types";
import type { Member, PeopleStore } from "../interfaces";
import { supabase } from "./client";

interface MemberRow {
  user_id: string;
  role: Role;
  users: { email: string; name: string | null } | null;
}

export class SupabasePeopleStore implements PeopleStore {
  async list(companyId: string): Promise<Member[]> {
    const { data, error } = await supabase()
      .from("memberships")
      .select("user_id, role, users(email, name)")
      .eq("company_id", companyId)
      .order("created_at");
    if (error) throw error;
    return (data as unknown as MemberRow[]).map((r) => ({
      userId: r.user_id,
      email: r.users?.email ?? "(unknown)",
      name: r.users?.name ?? undefined,
      role: r.role,
    }));
  }

  async invite(companyId: string, email: string, role: Role): Promise<void> {
    const { data, error } = await supabase().functions.invoke("invite-member", {
      body: { companyId, email, role, redirectTo: window.location.origin },
    });
    if (error) throw new Error(`Invite failed: ${error.message}`);
    const body = data as { error?: string };
    if (body?.error) throw new Error(body.error);
  }

  async setRole(companyId: string, userId: string, role: Role): Promise<void> {
    const { error } = await supabase()
      .from("memberships")
      .update({ role })
      .eq("company_id", companyId)
      .eq("user_id", userId);
    if (error) throw error;
  }

  async remove(companyId: string, userId: string): Promise<void> {
    const { error } = await supabase()
      .from("memberships")
      .delete()
      .eq("company_id", companyId)
      .eq("user_id", userId);
    if (error) throw error;
  }
}
