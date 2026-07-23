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

const LS_COLLAPSED = "sp-sidebar-collapsed";

/** The SocialPaint mark — five bars resolving into a solid square. Recolors
 * via currentColor: lime on dark chrome, deep green on light. Exported for
 * DS empty states (the mark at low opacity behind the text). */
export function BrandMark({ width = 28 }: { width?: number }) {
  return (
    <svg viewBox="0 0 164 78" fill="currentColor" style={{ width, height: "auto", display: "block" }} aria-hidden>
      <rect x="0" y="0" width="7" height="78" />
      <rect x="16" y="0" width="10" height="78" />
      <rect x="34" y="0" width="10" height="78" />
      <rect x="51" y="0" width="12" height="78" />
      <rect x="67" y="0" width="14" height="78" />
      <rect x="85" y="0" width="79" height="78" />
    </svg>
  );
}

/** Mark + wordmark lockup (wordmark in the heading face, per the DS NavRail). */
function BrandLockup() {
  return (
    <span className="flex items-center gap-2" style={{ color: "var(--solar)" }}>
      <BrandMark width={26} />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          textTransform: "uppercase",
          fontSize: 13,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
        }}
      >
        SocialPaint
      </span>
    </span>
  );
}

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
  const { route, navigate } = useRouter();
  // Narrow viewports (<1024px) always get the icon rail; expanding there
  // opens the panel as an OVERLAY above the content instead of pushing it —
  // a 264px panel would otherwise crush a phone's content to a sliver.
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia("(max-width: 1023px)").matches);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [collapsedPref, setCollapsedPref] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LS_COLLAPSED) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const onChange = () => {
      setIsNarrow(mq.matches);
      setOverlayOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSED, collapsedPref ? "1" : "0");
    } catch {
      // persistence is best-effort
    }
  }, [collapsedPref]);

  const collapsed = isNarrow ? !overlayOpen : collapsedPref;
  const toggle = () => (isNarrow ? setOverlayOpen((o) => !o) : setCollapsedPref((c) => !c));
  /** Close the overlay after any navigation on narrow screens. */
  const go = (target: Route) => {
    navigate(target);
    if (isNarrow) setOverlayOpen(false);
  };

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
    <>
      {/* Scrim behind the narrow-screen overlay panel */}
      {isNarrow && overlayOpen && (
        <div
          className="fixed inset-0"
          style={{ background: "rgba(26,23,26,0.4)", zIndex: 29 }}
          onClick={() => setOverlayOpen(false)}
          aria-hidden
        />
      )}
    {/* The wrapper reserves layout space (always just the rail on narrow
        screens) so the overlay panel never reflows the content behind it. */}
    <div
      className="flex-shrink-0"
      style={{
        width: isNarrow || collapsedPref ? "var(--sb-width-collapsed)" : "var(--sb-width)",
        transition: "width 0.2s ease",
      }}
    >
    <aside
      className="sp-sidebar flex flex-col"
      style={{
        position: isNarrow && overlayOpen ? "fixed" : "sticky",
        left: isNarrow && overlayOpen ? 0 : undefined,
        top: 0,
        width: collapsed ? "var(--sb-width-collapsed)" : "var(--sb-width)",
        height: "100vh",
        padding: collapsed ? "20px 12px" : "24px 20px",
        transition: "width 0.2s ease",
        zIndex: 30,
      }}
    >
      {/* Logo + collapse toggle */}
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} mb-7`}>
        {!collapsed && (
          <button onClick={() => go({ name: role === "admin" ? "adminTemplates" : "portal" })} title="Home" aria-label="SocialPaint — home">
            <BrandLockup />
          </button>
        )}
        <button
          onClick={toggle}
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
          onClick={() => go({ name: role === "admin" ? "adminTemplates" : "portal" })}
          title="SocialPaint — home"
          className="mx-auto mb-6"
          style={{ color: "var(--solar)" }}
        >
          <BrandMark width={26} />
        </button>
      )}

      {/* Nav — scrolls on short viewports so the user block stays reachable */}
      <nav className="flex flex-col gap-3.5 flex-1 min-h-0 overflow-y-auto" aria-label="Primary">
        {items.map(({ label, route: target, Icon, matches }) => {
          const active = matches.includes(route.name);
          return (
            <button
              key={label}
              onClick={() => go(target)}
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

      <div style={{ height: 16 }} />

      {/* Dev/backends controls + user block pinned to the bottom */}
      {!collapsed && (companies.length > 1 || isDevAuth) && (
        <select
          value={company?.id ?? ""}
          onChange={(e) => {
            if (e.target.value === "__new__") go({ name: "onboarding" });
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
            background: "var(--mint)", // flat fill — gradients are banned as surface treatment
            color: "#122407",
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
    </div>
    </>
  );
}
