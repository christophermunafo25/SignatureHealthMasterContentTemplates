import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Frame,
  LogOut,
  Monitor,
  Moon,
  Paintbrush,
  PanelLeft,
  PencilRuler,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useColorScheme, type ColorScheme } from "@/lib/colorScheme";
import { useRouter, type Route } from "../router";
import logoOnLight from "@/assets/socialpaint/socialpaint-logo-on-light.png";
import logoOnDark from "@/assets/socialpaint/socialpaint-logo-on-dark.png";
import markOnly from "@/assets/socialpaint/socialpaint-mark.png";

const LS_COLLAPSED = "sp-sidebar-collapsed";

interface NavItem {
  label: string;
  route: Route;
  Icon: typeof Paintbrush;
  adminOnly: boolean;
  /** Route names that keep this item highlighted. */
  matches: string[];
}

/** Figma order: Brand Templates · Template Builder · Insights & Analytics ·
 * Brand Studio · People · Settings & Admin. Members see only the first. */
const NAV: NavItem[] = [
  { label: "Brand Templates", route: { name: "portal" }, Icon: Paintbrush, adminOnly: false, matches: ["portal", "template"] },
  { label: "Template Builder", route: { name: "adminTemplates" }, Icon: Frame, adminOnly: true, matches: ["adminTemplates", "builder"] },
  { label: "Insights & Analytics", route: { name: "dashboard" }, Icon: BarChart3, adminOnly: true, matches: ["dashboard"] },
  { label: "Brand Studio", route: { name: "brandStudio" }, Icon: PencilRuler, adminOnly: true, matches: ["brandStudio"] },
  { label: "People", route: { name: "people" }, Icon: Users, adminOnly: true, matches: ["people"] },
  { label: "Settings & Admin", route: { name: "settings" }, Icon: Settings, adminOnly: true, matches: ["settings"] },
];

const SCHEME_CYCLE: Array<{ key: ColorScheme; label: string; Icon: typeof Sun }> = [
  { key: "system", label: "System theme", Icon: Monitor },
  { key: "light", label: "Light theme", Icon: Sun },
  { key: "dark", label: "Dark theme", Icon: Moon },
];

function ThemeToggle() {
  const { scheme, setScheme } = useColorScheme();
  const idx = SCHEME_CYCLE.findIndex((s) => s.key === scheme);
  const current = SCHEME_CYCLE[idx === -1 ? 0 : idx];
  const next = SCHEME_CYCLE[(idx + 1) % SCHEME_CYCLE.length];
  return (
    <button
      onClick={() => setScheme(next.key)}
      title={`${current.label} — click for ${next.label.toLowerCase()}`}
      aria-label={`Color theme: ${current.label}. Switch to ${next.label}`}
      className="flex items-center justify-center rounded-lg flex-shrink-0"
      style={{ width: 28, height: 28, color: "var(--sb-fg)" }}
    >
      <current.Icon style={{ width: 14, height: 14 }} />
    </button>
  );
}

/** Persistent app-shell sidebar (Figma KFBFgZBs7Tl9LXovzNUaNP node 13:28):
 * glass panel, full viewport height, right corners rounded, logo + collapse
 * toggle up top, role-gated nav, user block pinned to the bottom. This is
 * SocialPaint product UI — tenant brand kits never re-color it. */
export function Sidebar() {
  const { company, companies, role, user, isDevAuth, setCompany, setRole, signOut, backend } = useAuth();
  const { resolved } = useColorScheme();
  const { route, navigate } = useRouter();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(LS_COLLAPSED);
      if (stored !== null) return stored === "1";
    } catch {
      // fall through to the width default
    }
    return window.innerWidth < 1024;
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSED, collapsed ? "1" : "0");
    } catch {
      // persistence is best-effort
    }
  }, [collapsed]);

  const items = NAV.filter((item) => role === "admin" || !item.adminOnly);
  const initials = (user?.email ?? company?.name ?? "?")
    .split(/[@\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
  const displayName = user
    ? user.email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : company?.name ?? "Workspace";

  return (
    <aside
      className="sp-sidebar sticky top-0 flex flex-col flex-shrink-0"
      style={{
        width: collapsed ? "var(--sb-width-collapsed)" : "var(--sb-width)",
        height: "100vh",
        padding: collapsed ? "20px 12px" : "24px 20px",
        transition: "width 0.2s ease",
        zIndex: 20,
      }}
    >
      {/* Logo + collapse toggle */}
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} mb-7`}>
        {!collapsed && (
          <button onClick={() => navigate({ name: role === "admin" ? "adminTemplates" : "portal" })} title="Home">
            <img
              src={resolved === "dark" ? logoOnDark : logoOnLight}
              alt="SocialPaint"
              style={{ height: 20, width: "auto", display: "block" }}
            />
          </button>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center justify-center rounded-md flex-shrink-0"
          style={{ width: 26, height: 26, color: "var(--sb-fg)", border: "1.5px solid var(--sb-border)" }}
        >
          <PanelLeft style={{ width: 13, height: 13 }} />
        </button>
      </div>
      {collapsed && (
        <button
          onClick={() => navigate({ name: role === "admin" ? "adminTemplates" : "portal" })}
          title="SocialPaint — home"
          className="mx-auto mb-6"
        >
          <img src={markOnly} alt="SocialPaint" style={{ height: 24, width: "auto", display: "block" }} />
        </button>
      )}

      {/* Nav */}
      <nav className="flex flex-col gap-3.5" aria-label="Primary">
        {items.map(({ label, route: target, Icon, matches }) => {
          const active = matches.includes(route.name);
          return (
            <button
              key={label}
              onClick={() => navigate(target)}
              className="sp-sidebar-item"
              data-active={active}
              title={collapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
              style={collapsed ? { justifyContent: "center", padding: 0 } : undefined}
            >
              <Icon style={{ width: 17, height: 17, flexShrink: 0 }} />
              {!collapsed && label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Dev/backends controls + user block pinned to the bottom */}
      {!collapsed && (companies.length > 1 || isDevAuth) && (
        <select
          value={company?.id ?? ""}
          onChange={(e) => {
            if (e.target.value === "__new__") navigate({ name: "onboarding" });
            else void setCompany(e.target.value);
          }}
          className="sp-input mb-2"
          style={{ fontSize: 12, padding: "6px 10px" }}
          aria-label="Workspace"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value="__new__">+ Create company…</option>
        </select>
      )}
      {!collapsed && isDevAuth && (
        <div className="flex items-center gap-1 mb-3" role="group" aria-label="Dev role (localStorage backend)">
          {(["admin", "member"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className="flex-1 py-1 rounded-md capitalize"
              style={{
                fontSize: 11,
                border: "1px solid var(--sb-border)",
                background: role === r ? "var(--sb-active-bg)" : "transparent",
                color: role === r ? "var(--sb-fg-active)" : "var(--sb-fg)",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
        <span
          className="flex items-center justify-center flex-shrink-0"
          title={`${displayName}${company ? ` · ${company.name}` : ""} · ${role}${backend === "local" ? " · dev backend" : ""}`}
          style={{
            width: collapsed ? 34 : 42,
            height: collapsed ? 34 : 42,
            borderRadius: 999,
            background: "linear-gradient(135deg, var(--mint) 0%, #2fbf71 100%)",
            color: "#12351f",
            fontSize: collapsed ? 11 : 13,
            fontWeight: 600,
          }}
        >
          {initials}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate" style={{ fontSize: 13, fontWeight: 500, color: "var(--sb-fg-active)" }}>
                {displayName}
              </span>
              <span className="block truncate" style={{ fontSize: 11, color: "var(--sb-fg)" }}>
                {user?.email ?? `${company?.name ?? "Workspace"} · ${role}`}
              </span>
            </span>
            <ThemeToggle />
            {signOut && (
              <button
                onClick={() => void signOut()}
                title="Sign out"
                aria-label="Sign out"
                className="flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ width: 28, height: 28, color: "var(--sb-fg)" }}
              >
                <LogOut style={{ width: 14, height: 14 }} />
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
