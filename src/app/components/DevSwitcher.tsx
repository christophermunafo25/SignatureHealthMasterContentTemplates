import React from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../router";

/** Header identity controls.
 *
 * Real auth: company switcher (only if the user belongs to several),
 * account email, sign out. Role comes from the membership — no toggle.
 *
 * Dev stub (localStorage backend): tenant selector + Admin/Member toggle.
 * TODO(auth): the dev branch disappears once the local backend is retired. */
export function DevSwitcher() {
  const { company, companies, role, setCompany, setRole, backend, isDevAuth, user, signOut } = useAuth();
  const { navigate } = useRouter();

  const companySelect = (companies.length > 1 || isDevAuth) && (
    <select
      value={company?.id ?? ""}
      onChange={(e) => {
        if (e.target.value === "__new__") navigate({ name: "onboarding" });
        else void setCompany(e.target.value);
      }}
      className="sp-input"
      style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}
      aria-label="Company"
    >
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      <option value="__new__">+ Create company…</option>
    </select>
  );

  if (!isDevAuth) {
    return (
      <div className="flex items-center gap-2">
        {companySelect}
        <span className="sp-eyebrow hidden md:inline" title={`Signed in as ${user?.email ?? ""} · ${role}`}>
          {user?.email} · {role}
        </span>
        <button
          onClick={() => void signOut?.()}
          className="sp-btn sp-btn-ghost"
          style={{ padding: "6px 10px", fontSize: 12 }}
          title="Sign out"
        >
          <LogOut style={{ width: 13, height: 13 }} />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="sp-eyebrow hidden md:inline px-2 py-1 rounded-md"
        style={{ background: "rgba(35,31,35,0.04)" }}
        title="Dev-mode auth stub — replaced by real login. Backend in use."
      >
        dev · {backend}
      </span>
      {companySelect}
      <div
        className="flex rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--hairline-strong)" }}
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
            className="px-2.5 py-1.5 transition-colors capitalize"
            style={{
              fontSize: 12,
              fontFamily: "var(--font-ui)",
              ...(role === r
                ? { background: "var(--ink)", color: "var(--fg-on-dark-1)" }
                : { background: "var(--lift)", color: "var(--fg-2)" }),
            }}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
