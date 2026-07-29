import React, { useEffect, useState } from "react";
import { fetchPublicPortal, LinkInactiveError, type PublicPortalData } from "@/lib/publicClient";
import { applyBrandTheme } from "@/lib/theme";
import { loadBrandFonts } from "@/lib/render/fonts";
import { useRouter } from "../../router";
import { PublicPortal } from "./PublicPortal";
import { PublicTemplateUse } from "./PublicTemplateUse";

export type PublicDataState =
  | { status: "loading" }
  | { status: "inactive" }
  | { status: "error"; retry(): void }
  | { status: "ready"; data: PublicPortalData };

/** Fetch the portal payload for a token (and optionally one template — that
 * variant also records the anonymous `open` event server-side). Applies the
 * tenant brand theme and loads brand fonts once data lands. */
export function usePublicPortal(token: string, templateId?: string): PublicDataState {
  const [state, setState] = useState<PublicDataState>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    fetchPublicPortal(token, templateId)
      .then(async (data) => {
        if (!alive) return;
        applyBrandTheme(data.brandKit);
        if (data.brandKit) {
          await loadBrandFonts(
            data.brandKit,
            data.brandAssets.filter((a) => a.kind === "font"),
          );
        }
        if (alive) setState({ status: "ready", data });
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof LinkInactiveError) setState({ status: "inactive" });
        else {
          console.error("Public portal load failed", e);
          setState({ status: "error", retry: () => setTick((t) => t + 1) });
        }
      });
    return () => {
      alive = false;
    };
  }, [token, templateId, tick]);

  return state;
}

/** Slim anonymous header: brand mark + facility name. No sidebar, no theme
 * toggle, no account UI. */
export function PublicShell({
  data,
  children,
}: {
  data: PublicPortalData | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--linen)" }}>
      <header
        className="flex items-center justify-between gap-3 px-5 sm:px-8"
        style={{ height: 56, background: "var(--lift)", borderBottom: "1px solid var(--hairline)" }}
      >
        {data?.logoUrl ? (
          <img src={data.logoUrl} alt={data.company.name} style={{ height: 24, width: "auto" }} />
        ) : (
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink)",
              whiteSpace: "nowrap",
            }}
          >
            {data?.company.name || "Signature HealthCare"}
          </span>
        )}
        {data && (
          <span
            className="truncate text-right"
            style={{ fontSize: 12, color: "var(--fg-3)", maxWidth: "55%" }}
            title={data.facility.name}
          >
            {data.facility.name}
          </span>
        )}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

export function PublicInactive() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--linen)" }}>
      <div className="text-center space-y-2" style={{ maxWidth: 360 }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>This link isn't active.</p>
        <p style={{ fontSize: 13, color: "var(--fg-3)" }}>
          It may have been replaced or turned off. Ask your marketing team for a
          current link to the template portal.
        </p>
      </div>
    </div>
  );
}

export function PublicLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--linen)" }}>
      <p style={{ fontSize: 13, color: "var(--fg-3)" }}>Loading…</p>
    </div>
  );
}

export function PublicError({ retry }: { retry(): void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--linen)" }}>
      <div className="text-center space-y-3">
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>We couldn't load the templates.</p>
        <p style={{ fontSize: 13, color: "var(--fg-3)" }}>Check your connection and try again.</p>
        <button className="sp-btn sp-btn-primary" onClick={retry}>Try again</button>
      </div>
    </div>
  );
}

/** Anonymous facility tree, mounted INSTEAD of the auth/brand providers —
 * an anonymous visitor must never trigger a session lookup (which would
 * land them on the sign-in page). */
export function PublicApp() {
  const { route } = useRouter();
  if (route.name === "publicTemplate") {
    return <PublicTemplateUse token={route.token} templateId={route.templateId} />;
  }
  if (route.name === "publicPortal") {
    return <PublicPortal token={route.token} />;
  }
  return <PublicInactive />;
}
