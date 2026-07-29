import { FunctionsHttpError } from "@supabase/supabase-js";
import type { Role } from "../../types";
import type { InviteResult, Member, PeopleStore } from "../interfaces";
import { supabase } from "./client";

/** Every Edge Function here returns { error: string } on failure, but
 * functions.invoke wraps any non-2xx in a FunctionsHttpError whose message
 * is always the same generic sentence — the real reason is in the response
 * body. Surface it. */
export async function functionErrorDetail(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string } | null;
      if (body?.error) return body.error;
    } catch {
      // fall through to the generic message
    }
  }
  return error instanceof Error ? error.message : String(error);
}

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

  async invite(
    companyId: string,
    email: string,
    role: Role,
    mode: "email" | "link" = "email",
  ): Promise<InviteResult> {
    const { data, error } = await supabase().functions.invoke("invite-member", {
      // /admin, not the origin root — the root serves the public portal.
      body: { companyId, email, role, mode, redirectTo: `${window.location.origin}/admin` },
    });
    if (error) throw new Error(`Invite failed: ${await functionErrorDetail(error)}`);
    const body = data as { error?: string; existing?: boolean; actionLink?: string | null };
    if (body?.error) throw new Error(body.error);
    return { existing: Boolean(body?.existing), actionLink: body?.actionLink ?? null };
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
