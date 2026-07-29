import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Frame,
  Inbox,
  Link2,
  LogOut,
  Menu,
  Paintbrush,
  PanelLeft,
  PencilRuler,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { profileDisplayName, profileInitials } from "@/lib/profile";
import { stores } from "@/lib/stores";
import { useRouter, type Route } from "../router";
import { ProfileDialog } from "./ProfileDialog";
const LS_COLLAPSED = "shc-graphics-sidebar-collapsed";

/** Signature HealthCare mark — "SH" monogram placeholder rendered in the
 * display face, one-color via currentColor. Swap for the official logo
 * asset when it lands in src/assets. Used where the full lockup doesn't
 * fit: the collapsed rail and DS empty states. */
export function BrandMark({ width = 28 }: { width?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width,
        height: width,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: Math.max(5, Math.round(width * 0.18)),
        border: "0.09em solid currentColor",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: Math.round(width * 0.4),
        letterSpacing: "0.04em",
        lineHeight: 1,
      }}
    >
      SH
    </span>
  );
}

/** Horizontal lockup — text wordmark placeholder in the display face until
 * the official logo asset lands in src/assets. Inherits chrome ink so it
 * works on light and dark. */
function BrandLockup({ height = 16 }: { height?: number }) {
  return (
    <span
      aria-label="Signature HealthCare"
      style={{
        display: "block",
        fontFamily: "var(--font-display)",
        fontSize: height * 0.82,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        color: "var(--ink)",
      }}
    >
      Signature&nbsp;<span style={{ fontWeight: 400 }}>HealthCare</span>
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

/** Nav order: Published Templates · Template Builder · Insights & Analytics ·
 * Brand Studio · People · Settings & Admin. Members see only the first. */
const NAV: NavItem[] = [
  { label: "Published Templates", route: { name: "portal" }, Icon: Paintbrush, adminOnly: false, matches: ["portal", "template"] },
  { label: "Template Builder", route: { name: "adminTemplates" }, Icon: Frame, adminOnly: true, matches: ["adminTemplates", "builder"] },
  { label: "Submissions", route: { name: "submissions" }, Icon: Inbox, adminOnly: true, matches: ["submissions", "submissionDetail"] },
  { label: "Insights & Analytics", route: { name: "dashboard" }, Icon: BarChart3, adminOnly: true, matches: ["dashboard"] },
  { label: "Brand Studio", route: { name: "brandStudio" }, Icon: PencilRuler, adminOnly: true, matches: ["brandStudio"] },
  { label: "Portal Access", route: { name: "portalAccess" }, Icon: Link2, adminOnly: true, matches: ["portalAccess"] },
  { label: "People", route: { name: "people" }, Icon: Users, adminOnly: true, matches: ["people"] },
  { label: "Settings & Admin", route: { name: "settings" }, Icon: Settings, adminOnly: true, matches: ["settings"] },
];

/** Workspace switcher + dev role toggle + user row — shared between the
 * desktop sidebar's bottom block and the mobile dropdown. */
function AccountBlock({ onNavigate }: { onNavigate(route: Route): void }) {
  const { company, companies, role, user, profile, isDevAuth, setCompany, setRole, signOut, backend } = useAuth();
  const [editingProfile, setEditingProfile] = useState(false);
  const initials = user
    ? profileInitials(profile, user.email)
    : (company?.name ?? "?")
        .split(/[\s._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]!.toUpperCase())
        .join("");
  const displayName = user ? profileDisplayName(profile, user.email) : company?.name ?? "Workspace";
  const subline = user ? [profile?.title, user.email].filter(Boolean).join(" · ") : `${company?.name ?? "Workspace"} · ${role}`;

  return (
    <>
      {(companies.length > 1 || isDevAuth) && (
        <select
          value={company?.id ?? ""}
          onChange={(e) => {
            if (e.target.value === "__new__") onNavigate({ name: "onboarding" });
            else void setCompany(e.target.value);
          }}
          className="sp-input mb-2"
          style={{ fontSize: 12, padding: "6px 10px" }}
          aria-label="Company"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          {/* Company creation is operator-provisioned under real auth. */}
          {isDevAuth && <option value="__new__">+ Create company…</option>}
        </select>
      )}
      {isDevAuth && (
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
      <div className="flex items-center gap-3">
        <button
          className="flex items-center justify-center flex-shrink-0 overflow-hidden"
          disabled={!user}
          onClick={() => user && setEditingProfile(true)}
          title={
            user
              ? "Edit profile"
              : `${displayName}${company ? ` · ${company.name}` : ""} · ${role}${backend === "local" ? " · dev backend" : ""}`
          }
          aria-label={user ? "Edit profile" : undefined}
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            background: "var(--mint)", // flat fill — gradients are banned as surface treatment
            color: "#003b71",
            fontSize: 12,
            fontWeight: 600,
            cursor: user ? "pointer" : "default",
          }}
        >
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            initials
          )}
        </button>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate" style={{ fontSize: 13, fontWeight: 500, color: "var(--sb-fg-active)" }}>
            {displayName}
          </span>
          <span className="block truncate" style={{ fontSize: 11, color: "var(--sb-fg)" }} title={subline}>
            {subline}
          </span>
        </span>
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
      </div>
      {editingProfile && <ProfileDialog onClose={() => setEditingProfile(false)} />}
    </>
  );
}

/** App-shell navigation. Desktop (≥1024px): the persistent left sidebar
 * (Figma node 13:28) with a collapsible icon rail. Mobile: no rail at all —
 * a slim top bar with the brand and a menu button; the nav drops down
 * vertically from the top as a panel over a scrim. Platform product UI —
 * tenant brand kits never re-color it. */

/** New-submission count for the sidebar badge — the whole reason the social
 * team opens the app. Refreshes on navigation. */
function useNewSubmissionCount(companyId: string | undefined, routeName: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!companyId) return;
    let alive = true;
    stores.submissions
      .countNew(companyId)
      .then((n) => alive && setCount(n))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [companyId, routeName]);
  return count;
}

function NewBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      className="flex-shrink-0 flex items-center justify-center"
      style={{
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        borderRadius: 999,
        background: "var(--mint)",
        color: "#003b71",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 600,
        marginLeft: "auto",
      }}
      aria-label={`${n} new submissions`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function Sidebar() {
  const { role, company } = useAuth();
  const { route, navigate } = useRouter();
  const newCount = useNewSubmissionCount(role === "admin" ? company?.id : undefined, route.name);
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia("(max-width: 1023px)").matches);
  const [menuOpen, setMenuOpen] = useState(false);
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
      setMenuOpen(false);
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

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const go = (target: Route) => {
    navigate(target);
    setMenuOpen(false);
  };

  const items = NAV.filter((item) => role === "admin" || !item.adminOnly);

  // ── Mobile: top bar + drop-down navigation ──────────────────────────────
  if (isNarrow) {
    return (
      <>
        {menuOpen && (
          <div
            className="fixed inset-0"
            style={{ background: "rgba(0,59,113,0.4)", zIndex: 39 }}
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
        )}
        <header
          className="sticky top-0 w-full"
          style={{ background: "var(--sb-bg)", borderBottom: "1px solid var(--sb-border)", zIndex: 40 }}
        >
          <div className="flex items-center justify-between px-4" style={{ height: 56 }}>
            <button onClick={() => go({ name: role === "admin" ? "adminTemplates" : "portal" })} aria-label="Signature HealthCare — home">
              <BrandLockup height={18} />
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              className="flex items-center justify-center rounded-md"
              style={{ width: 36, height: 36, color: "var(--sb-fg-active)", border: "1px solid var(--sb-border)" }}
            >
              {menuOpen ? <X style={{ width: 16, height: 16 }} /> : <Menu style={{ width: 16, height: 16 }} />}
            </button>
          </div>

          {/* Drop-down panel — slides down from under the bar */}
          <div
            style={{
              display: "grid",
              gridTemplateRows: menuOpen ? "1fr" : "0fr",
              transition: "grid-template-rows var(--dur-panel) var(--ease)",
            }}
          >
            <div style={{ overflow: "hidden" }}>
              <nav
                aria-label="Primary"
                className="px-3 pb-3 pt-1"
                style={{ maxHeight: "calc(100vh - 72px)", overflowY: "auto" }}
              >
                <div className="flex flex-col gap-1.5">
                  {items.map(({ label, route: target, Icon, matches }) => {
                    const active = matches.includes(route.name);
                    return (
                      <button
                        key={label}
                        onClick={() => go(target)}
                        className="sp-sidebar-item"
                        data-active={active}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon style={{ width: 17, height: 17, flexShrink: 0 }} />
                        {label}
                        {label === "Submissions" && <NewBadge n={newCount} />}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--sb-border)" }}>
                  <AccountBlock onNavigate={go} />
                </div>
              </nav>
            </div>
          </div>
        </header>
      </>
    );
  }

  // ── Desktop: persistent left sidebar ────────────────────────────────────
  const collapsed = collapsedPref;
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: collapsed ? "var(--sb-width-collapsed)" : "var(--sb-width)",
        transition: "width 0.2s ease",
      }}
    >
      <aside
        className="sp-sidebar flex flex-col sticky top-0"
        style={{
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
            <button onClick={() => go({ name: role === "admin" ? "adminTemplates" : "portal" })} title="Home" aria-label="Signature HealthCare — home">
              <BrandLockup />
            </button>
          )}
          <button
            onClick={() => setCollapsedPref((c) => !c)}
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
            title="Signature HealthCare — home"
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
                {!collapsed && label === "Submissions" && <NewBadge n={newCount} />}
              </button>
            );
          })}
        </nav>

        <div style={{ height: 16 }} />

        {!collapsed ? (
          <AccountBlock onNavigate={go} />
        ) : (
          <div className="flex justify-center">
            <span
              className="flex items-center justify-center"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                background: "var(--mint)",
                color: "#003b71",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <CollapsedInitials />
            </span>
          </div>
        )}
      </aside>
    </div>
  );
}

function CollapsedInitials() {
  const { company, user } = useAuth();
  return (
    <>
      {(user?.email ?? company?.name ?? "?")
        .split(/[@\s._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]!.toUpperCase())
        .join("")}
    </>
  );
}
