import React, { useCallback, useEffect, useState } from "react";
import { fetchPublicPortal, HOME_REF, LinkInactiveError, type PublicFacility, type PublicPortalData } from "@/lib/publicClient";
import { isSupabaseConfigured, supabase } from "@/lib/stores/supabase/client";
import { applyBrandTheme } from "@/lib/theme";
import { loadBrandFonts } from "@/lib/render/fonts";
import { useRouter, type Route } from "../../router";
import { PublicChooser } from "./PublicChooser";
import { PublicDirectSubmit } from "./PublicDirectSubmit";
import { PublicPortal } from "./PublicPortal";
import { PublicTemplateUse } from "./PublicTemplateUse";

/** Home-aware route builders: the same components serve the tokened shared
 * link (/g/…) and the root-URL public portal (ref === HOME_REF). */
export const portalRoute = (token: string): Route =>
  token === HOME_REF ? { name: "publicHome" } : { name: "publicPortal", token };
export const libraryRoute = (token: string): Route =>
  token === HOME_REF ? { name: "publicHomeLibrary" } : { name: "publicLibrary", token };
export const submitRoute = (token: string): Route =>
  token === HOME_REF ? { name: "publicHomeSubmit" } : { name: "publicSubmit", token };
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

/** The admin entry into the signed-in app for staff who land on the public
 * root. A plain anchor: /admin mounts a different provider tree, so a full
 * page load is exactly right. The label follows the session — telling an
 * already-signed-in admin to "sign in" is a dead end — and the read is
 * non-blocking: the library paints regardless of how it resolves. */
export function AdminSignInLink({ variant = "link" }: { variant?: "link" | "button" }) {
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (alive) setHasSession(Boolean(data.session));
      })
      .catch(() => {
        /* no session is the normal case here, not an error */
      });
    return () => {
      alive = false;
    };
  }, []);
  const label = hasSession ? "Go to admin" : "Admin sign in";

  if (variant === "button") {
    return (
      <a href="/admin" className="sp-btn sp-btn-primary" style={{ minHeight: 32, padding: "6px 14px", fontSize: 12 }}>
        {label}
      </a>
    );
  }
  return (
    <a
      href="/admin"
      // Link variant renders on the brand gradient (PublicInactive) — light.
      style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", textDecoration: "underline", textUnderlineOffset: 3 }}
    >
      {label}
    </a>
  );
}

/** Brand page wash for the WHOLE public system: navy deepening into the
 * lighter brand blue. Every facility-facing screen sits on it; text outside
 * white cards must use the light-on-navy treatments. The signed-in admin
 * app keeps its clean-white theme — this wash never crosses /admin. */
export const BRAND_PAGE_GRADIENT = "linear-gradient(180deg, #003b71 0%, #0067b1 100%)";

export function PublicShell({
  data,
  adminLink,
  pageBackground,
  children,
}: {
  data: PublicPortalData | null;
  /** Root-URL mode: show the admin entry in the header. */
  adminLink?: boolean;
  /** Override the default brand gradient wash. */
  pageBackground?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: pageBackground ?? BRAND_PAGE_GRADIENT }}>
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
        {adminLink && <AdminSignInLink variant="button" />}
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
    </div>
  );
}

export function PublicInactive({ adminLink }: { adminLink?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: BRAND_PAGE_GRADIENT }}>
      <div className="text-center space-y-2" style={{ maxWidth: 360 }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: "#ffffff" }}>
          {adminLink ? "The portal isn't open yet." : "This link isn't active."}
        </p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND_PAGE_GRADIENT }}>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>Loading…</p>
    </div>
  );
}

export function PublicError({ retry }: { retry(): void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: BRAND_PAGE_GRADIENT }}>
      <div className="text-center space-y-3">
        <p style={{ fontSize: 14, fontWeight: 500, color: "#ffffff" }}>We couldn't load the templates.</p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>Check your connection and try again.</p>
        <button className="sp-btn sp-btn-solar" onClick={retry}>Try again</button>
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
    return <PublicChooser token={route.token} />;
  }
  if (route.name === "publicLibrary") {
    return <PublicPortal token={route.token} />;
  }
  if (route.name === "publicSubmit") {
    return <PublicDirectSubmit token={route.token} />;
  }
  if (route.name === "publicHomeTemplate") {
    return <PublicTemplateUse token={HOME_REF} templateId={route.templateId} />;
  }
  if (route.name === "publicHome") {
    return <PublicChooser token={HOME_REF} />;
  }
  if (route.name === "publicHomeLibrary") {
    return <PublicPortal token={HOME_REF} />;
  }
  if (route.name === "publicHomeSubmit") {
    return <PublicDirectSubmit token={HOME_REF} />;
  }
  return <PublicInactive />;
}
