import type { Role } from "../../types";
import type { Member, PeopleStore } from "../interfaces";
import { supabase } from "./client";

interface MemberRow {
  user_id: string;
  role: Role;
  users: {
    email: string;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    title: string | null;
    avatar_url: string | null;
  } | null;
}

export class SupabasePeopleStore implements PeopleStore {
  async list(companyId: string): Promise<Member[]> {
    const { data, error } = await supabase()
      .from("memberships")
      .select("user_id, role, users(email, name, first_name, last_name, title, avatar_url)")
      .eq("company_id", companyId)
      .order("created_at");
    if (error) throw error;
    return (data as unknown as MemberRow[]).map((r) => ({
      userId: r.user_id,
      email: r.users?.email ?? "(unknown)",
      name: r.users?.name ?? undefined,
      firstName: r.users?.first_name ?? undefined,
      lastName: r.users?.last_name ?? undefined,
      title: r.users?.title ?? undefined,
      avatarUrl: r.users?.avatar_url ?? undefined,
      role: r.role,
    }));
  }

  async invite(companyId: string, email: string, role: Role): Promise<void> {
    const { data, error } = await supabase().functions.invoke("invite-member", {
      // /admin, not the origin root — the root serves the public portal.
      body: { companyId, email, role, redirectTo: `${window.location.origin}/admin` },
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
