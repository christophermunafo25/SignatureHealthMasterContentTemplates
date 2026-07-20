import React from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../router";

/** v1 stand-in for real login: pick the tenant and toggle Admin/Member.
 * Replaced wholesale by Supabase Auth later — components only consume
 * AuthState, so nothing else changes. TODO(auth) */
export function DevSwitcher() {
  const { company, companies, role, setCompany, setRole, backend } = useAuth();
  const { navigate } = useRouter();

  return (
    <div className="flex items-center gap-2">
      <span
        className="hidden md:inline text-[9px] font-semibold uppercase tracking-[0.16em] px-2 py-1 rounded-full"
        style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
        title="Dev-mode auth stub — replaced by real login. Backend in use."
      >
        dev · {backend}
      </span>
      <select
        value={company?.id ?? ""}
        onChange={(e) => {
          if (e.target.value === "__new__") navigate({ name: "onboarding" });
          else void setCompany(e.target.value);
        }}
        className="text-xs rounded-lg border px-2 py-1.5 bg-white"
        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        aria-label="Company"
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value="__new__">+ Create company…</option>
      </select>
      <div
        className="flex rounded-lg overflow-hidden border"
        style={{ borderColor: "var(--border)" }}
        role="group"
        aria-label="Role"
      >
        {(["admin", "member"] as const).map((r) => (
          <button
            key={r}
            onClick={() => {
              setRole(r);
              navigate({ name: r === "admin" ? "adminTemplates" : "portal" });
            }}
            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 transition-colors"
            style={
              role === r
                ? { background: "var(--primary)", color: "var(--primary-foreground)" }
                : { background: "white", color: "var(--muted-foreground)" }
            }
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
