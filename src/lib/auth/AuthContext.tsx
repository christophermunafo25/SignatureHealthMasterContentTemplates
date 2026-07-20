import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Company, Role } from "../types";
import { stores } from "../stores";

/**
 * Auth boundary. v1 backs this with a dev tenant/role switcher; real Supabase
 * Auth later replaces DevAuthProvider's internals (session → membership →
 * company/role) with NO component changes — consumers only see AuthState.
 * TODO(auth): swap the provider internals when enabling Supabase Auth.
 */
export interface AuthState {
  loading: boolean;
  /** null after loading completes → no company exists → route to onboarding. */
  company: Company | null;
  role: Role;
  user: { id: string; email: string } | null; // null while auth is stubbed
  companies: Company[]; // dev switcher list
  isDevAuth: boolean;
  backend: "supabase" | "local";
  setCompany(companyId: string): Promise<void>;
  setRole(role: Role): void;
  /** Re-reads companies (e.g. after onboarding creates one). */
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const LS_COMPANY = "brand-portal-dev-company";
const LS_ROLE = "brand-portal-dev-role";

export function DevAuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setCompanyState] = useState<Company | null>(null);
  const [role, setRoleState] = useState<Role>(
    (localStorage.getItem(LS_ROLE) as Role | null) ?? "admin",
  );

  const load = useCallback(async () => {
    const list = await stores.companies.list();
    setCompanies(list);
    const savedId = localStorage.getItem(LS_COMPANY);
    const selected = list.find((c) => c.id === savedId) ?? list[0] ?? null;
    setCompanyState(selected);
    if (selected) localStorage.setItem(LS_COMPANY, selected.id);
    else localStorage.removeItem(LS_COMPANY);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => console.error("Auth load failed", e))
      .finally(() => setLoading(false));
  }, [load]);

  const setCompany = useCallback(
    async (companyId: string) => {
      const c = (await stores.companies.get(companyId)) ?? null;
      setCompanyState(c);
      if (c) localStorage.setItem(LS_COMPANY, c.id);
    },
    [],
  );

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    localStorage.setItem(LS_ROLE, r);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      company,
      role,
      user: null,
      companies,
      isDevAuth: true,
      backend: stores.backend,
      setCompany,
      setRole,
      refresh: load,
    }),
    [loading, company, role, companies, setCompany, setRole, load],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside DevAuthProvider");
  return ctx;
}
