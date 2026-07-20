import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Company, Role } from "../types";
import { stores } from "../stores";
import { supabase } from "../stores/supabase/client";
import { AuthContext, LS_COMPANY, type AuthState } from "./AuthContext";

interface MembershipRow {
  company_id: string;
  role: Role;
  companies: { id: string; name: string; slug: string; created_at: string } | null;
}

/** Real auth: Supabase Auth session → memberships → company + role.
 * Role comes from the membership row — there is no client-side toggle. */
export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roleByCompany, setRoleByCompany] = useState<Record<string, Role>>({});
  const [selectedId, setSelectedId] = useState<string | null>(
    () => localStorage.getItem(LS_COMPANY),
  );

  // Derived, never stored: immune to stale-closure ordering (e.g. onboarding
  // calling refresh() then setCompany() back-to-back).
  const company = useMemo<Company | null>(
    () => companies.find((c) => c.id === selectedId) ?? companies[0] ?? null,
    [companies, selectedId],
  );

  useEffect(() => {
    if (company) localStorage.setItem(LS_COMPANY, company.id);
  }, [company]);

  const loadMemberships = useCallback(async () => {
    const { data, error } = await supabase()
      .from("memberships")
      .select("company_id, role, companies(id, name, slug, created_at)")
      .order("created_at", { ascending: true });
    if (error) throw error;
    const rows = (data as unknown as MembershipRow[]).filter((r) => r.companies);
    const list: Company[] = rows.map((r) => ({
      id: r.companies!.id,
      name: r.companies!.name,
      slug: r.companies!.slug,
      createdAt: r.companies!.created_at,
    }));
    setCompanies(list);
    setRoleByCompany(Object.fromEntries(rows.map((r) => [r.company_id, r.role])));
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled) setSession(data.session);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const { data: sub } = supabase().auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setCompanies([]);
      setRoleByCompany({});
      return;
    }
    setLoading(true);
    loadMemberships()
      .catch((e) => console.error("Membership load failed", e))
      .finally(() => setLoading(false));
  }, [session, loadMemberships]);

  const setCompany = useCallback(async (companyId: string) => {
    setSelectedId(companyId);
    localStorage.setItem(LS_COMPANY, companyId);
  }, []);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    localStorage.removeItem(LS_COMPANY);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      company,
      role: (company && roleByCompany[company.id]) ?? "member",
      user: session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null,
      companies,
      isDevAuth: false,
      backend: stores.backend,
      setCompany,
      setRole: () => undefined, // membership decides
      refresh: loadMemberships,
      signOut,
    }),
    [loading, company, roleByCompany, session, companies, setCompany, loadMemberships, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
