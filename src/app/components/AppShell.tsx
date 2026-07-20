import React from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { useRouter, type Route } from "../router";
import { DevSwitcher } from "./DevSwitcher";

const ADMIN_NAV: Array<{ label: string; route: Route }> = [
  { label: "Templates", route: { name: "adminTemplates" } },
  { label: "Brand Studio", route: { name: "brandStudio" } },
  { label: "Locations", route: { name: "locations" } },
  { label: "Dashboard", route: { name: "dashboard" } },
  { label: "Portal", route: { name: "portal" } },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { company, role } = useAuth();
  const { primaryLogoUrl } = useBrand();
  const { route, navigate } = useRouter();

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="border-b bg-white" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate({ name: role === "admin" ? "adminTemplates" : "portal" })}
            className="flex items-center gap-2.5"
          >
            {primaryLogoUrl ? (
              <img src={primaryLogoUrl} alt="" style={{ height: 30, width: "auto", display: "block" }} />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-sm"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {(company?.name ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="text-left">
              <p className="font-extrabold text-sm leading-tight" style={{ color: "var(--foreground)" }}>
                {company?.name ?? "Brand Portal"}
              </p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted-foreground)" }}>
                Template Portal
              </p>
            </div>
          </button>

          {role === "admin" && (
            <nav className="hidden sm:flex items-center gap-1 ml-4">
              {ADMIN_NAV.map((item) => {
                const active =
                  route.name === item.route.name ||
                  (item.route.name === "adminTemplates" && route.name === "builder") ||
                  (item.route.name === "portal" && route.name === "template");
                return (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.route)}
                    className="text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-lg transition-colors"
                    style={
                      active
                        ? { background: "var(--secondary)", color: "var(--secondary-foreground)" }
                        : { color: "var(--muted-foreground)" }
                    }
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
