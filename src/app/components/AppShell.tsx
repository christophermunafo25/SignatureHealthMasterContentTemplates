import React from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { useRouter, type Route } from "../router";
import { DevSwitcher } from "./DevSwitcher";

const ADMIN_NAV: Array<{ label: string; route: Route }> = [
  { label: "Templates", route: { name: "adminTemplates" } },
  { label: "Brand Studio", route: { name: "brandStudio" } },
  { label: "Dashboard", route: { name: "dashboard" } },
  { label: "People", route: { name: "people" } },
  { label: "Portal", route: { name: "portal" } },
];

/** Platform chrome — SocialPaint design system (topbar on lift, hairline
 * borders, Inter UI type, solar active tint). The tenant appears as a
 * workspace identity chip; their brand styles the graphics, not the chrome. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { company, role } = useAuth();
  const { primaryLogoUrl } = useBrand();
  const { route, navigate } = useRouter();

  return (
    <div className="min-h-screen" style={{ background: "var(--linen)", fontFamily: "var(--font-ui)" }}>
      <header style={{ background: "var(--lift)", borderBottom: "1px solid var(--hairline)" }}>
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            onClick={() => navigate({ name: role === "admin" ? "adminTemplates" : "portal" })}
            className="flex items-center gap-2.5"
          >
            {primaryLogoUrl ? (
              <img src={primaryLogoUrl} alt="" style={{ height: 26, width: "auto", display: "block" }} />
            ) : (
              <span
                className="sp-mesh"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--font-display)",
                  fontWeight: 500,
                  fontSize: 12,
                  color: "#fff",
                  overflow: "hidden",
                }}
              >
                <span>{(company?.name ?? "?").slice(0, 1).toUpperCase()}</span>
              </span>
            )}
            <span className="text-left">
              <span className="block" style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.2 }}>
                {company?.name ?? "Brand portal"}
              </span>
              <span className="sp-eyebrow block" style={{ fontSize: 9 }}>
                {role === "admin" ? "Workspace · Admin" : "Workspace"}
              </span>
            </span>
          </button>

          {role === "admin" && (
            <nav className="hidden sm:flex items-center gap-0.5 ml-3">
              {ADMIN_NAV.map((item) => {
                const active =
                  route.name === item.route.name ||
                  (item.route.name === "adminTemplates" && route.name === "builder") ||
                  (item.route.name === "portal" && route.name === "template");
                return (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.route)}
                    className="px-3 py-1.5 rounded-lg transition-colors"
                    style={{
                      fontSize: 13,
                      ...(active
                        ? { background: "rgba(255,63,0,0.10)", color: "var(--solar)" }
                        : { color: "var(--fg-2)" }),
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          )}

          <div className="ml-auto">
            <DevSwitcher />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
