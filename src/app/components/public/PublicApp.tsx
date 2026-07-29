import React, { useCallback, useEffect, useState } from "react";
import { fetchPublicPortal, HOME_REF, LinkInactiveError, type PublicFacility, type PublicPortalData } from "@/lib/publicClient";
import { applyBrandTheme } from "@/lib/theme";
import { loadBrandFonts } from "@/lib/render/fonts";
import { useRouter, type Route } from "../../router";
import { PublicPortal } from "./PublicPortal";
import { PublicTemplateUse } from "./PublicTemplateUse";

/** Home-aware route builders: the same components serve the tokened shared
 * link (/g/…) and the root-URL public portal (ref === HOME_REF). */
export const portalRoute = (token: string): Route =>
  token === HOME_REF ? { name: "publicHome" } : { name: "publicPortal", token };
export const templateRoute = (token: string, templateId: string): Route =>
  token === HOME_REF
    ? { name: "publicHomeTemplate", templateId }
    : { name: "publicTemplate", token, templateId };

export type PublicDataState =
  | { status: "loading" }
  | { status: "inactive" }
  | { status: "error"; retry(): void }
  | { status: "ready"; data: PublicPortalData };

/** Fetch the portal payload for the shared token (and optionally one
 * template — that variant also records the anonymous `open` event
 * server-side, attributed via facilityId). Applies the tenant brand theme
 * and loads brand fonts once data lands. */
export function usePublicPortal(
  token: string,
  opts?: { templateId?: string; facilityId?: string },
): PublicDataState {
  const [state, setState] = useState<PublicDataState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const templateId = opts?.templateId;
  const facilityId = opts?.facilityId;

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    fetchPublicPortal(token, { templateId, facilityId })
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
  }, [token, templateId, facilityId, tick]);

  return state;
}

/** Scoped to the token, so a rotation re-prompts naturally. */
const facilityKey = (token: string) => `shc-portal-facility:${token}`;

/** The visitor's chosen facility for this token — persisted locally,
 * validated against the live roster (a renamed/deactivated facility
 * re-prompts). NO default selection. */
export function useSelectedFacility(token: string, facilities: PublicFacility[] | null) {
  const [facilityId, setFacilityId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(facilityKey(token));
    } catch {
      return null;
    }
  });

  const select = useCallback(
    (f: PublicFacility) => {
      try {
        localStorage.setItem(facilityKey(token), f.id);
      } catch {
        // persistence is best-effort
      }
      setFacilityId(f.id);
    },
    [token],
  );

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(facilityKey(token));
    } catch {
      // best-effort
    }
    setFacilityId(null);
  }, [token]);

  const facility =
    facilityId && facilities ? facilities.find((f) => f.id === facilityId) ?? null : null;
  // A stored id that no longer resolves (renamed roster, deactivated) is
  // treated as unselected.
  return { facility, select, clear };
}

/** Slim anonymous header: brand mark + facility chip with a "Not you?"
 * escape. No sidebar, no account UI. */
/** Quiet path into the signed-in app for staff who land on the public root.
 * A plain anchor: /admin mounts a different provider tree, so a full page
 * load is exactly right. */
export function AdminSignInLink() {
  return (
    <a
      href="/admin"
      style={{ fontSize: 12, color: "var(--fg-3)", textDecoration: "underline", textUnderlineOffset: 3 }}
    >
      Admin sign in
    </a>
  );
}

export function PublicShell({
  data,
  adminLink,
  children,
}: {
  data: PublicPortalData | null;
  /** Root-URL mode: show the quiet admin entry in the footer. */
  adminLink?: boolean;
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
      </header>
      {data?.tokenStale && (
        <div
          role="status"
          className="px-5 sm:px-8 py-2 text-center"
          style={{ background: "var(--paper)", borderBottom: "1px solid var(--hairline)", fontSize: 12, color: "var(--fg-2)" }}
        >
          This link is being replaced — ask your marketing contact for the new one.
        </div>
      )}
      <main className="flex-1">{children}</main>
      {adminLink && (
        <footer className="text-center py-5">
          <AdminSignInLink />
        </footer>
      )}
    </div>
  );
}

export function PublicInactive({ adminLink }: { adminLink?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--linen)" }}>
      <div className="text-center space-y-2" style={{ maxWidth: 360 }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
          {adminLink ? "The portal isn't open yet." : "This link isn't active."}
        </p>
        <p style={{ fontSize: 13, color: "var(--fg-3)" }}>
          {adminLink
            ? "Facility staff: use the link your marketing team shared with you."
            : "It may have been replaced or turned off. Ask your marketing team for a current link to the template portal."}
        </p>
        {adminLink && (
          <p style={{ paddingTop: 8 }}>
            <AdminSignInLink />
          </p>
        )}
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
  if (route.name === "publicHomeTemplate") {
    return <PublicTemplateUse token={HOME_REF} templateId={route.templateId} />;
  }
  if (route.name === "publicHome") {
    return <PublicPortal token={HOME_REF} />;
  }
  return <PublicInactive />;
}
