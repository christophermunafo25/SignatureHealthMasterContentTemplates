import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

/** Lightweight routing over the History API. The `Route` union and
 * `navigate()` signature predate URL routing — call sites are unchanged;
 * the provider now mirrors routes to `window.location` (Vercel rewrites
 * every path to index.html, so deep links work with no infra changes). */
export type Route =
  | { name: "onboarding" }
  | { name: "portal" }
  | { name: "template"; templateId: string }
  | { name: "adminTemplates" }
  | { name: "builder"; templateId: string | null }
  | { name: "brandStudio" }
  | { name: "dashboard" }
  | { name: "people" }
  | { name: "settings" }
  | { name: "submissions" }
  | { name: "submissionDetail"; submissionId: string }
  | { name: "portalAccess" }
  // v2.2 public intake: the root (tokened or not) is a CHOOSER between the
  // direct-upload path and the template library; the grid moved to /browse.
  | { name: "publicPortal"; token: string } // chooser (tokened)
  | { name: "publicLibrary"; token: string }
  | { name: "publicSubmit"; token: string }
  | { name: "publicTemplate"; token: string; templateId: string }
  // Root-URL public portal (no token in the address; resolved server-side
  // to the company that opted in via portal_public).
  | { name: "publicHome" } // chooser (root mode)
  | { name: "publicHomeLibrary" }
  | { name: "publicHomeSubmit" }
  | { name: "publicHomeTemplate"; templateId: string }
  // v2.2 Form Records — the admin register of release forms.
  | { name: "records" }
  | { name: "recordDetail"; submissionId: string };

export function pathFor(route: Route): string {
  switch (route.name) {
    case "portal":
      return "/admin";
    case "publicHome":
      return "/";
    case "publicHomeLibrary":
      return "/browse";
    case "publicHomeSubmit":
      return "/submit";
    case "publicHomeTemplate":
      return `/p/${encodeURIComponent(route.templateId)}`;
    case "onboarding":
      return "/onboarding";
    case "template":
      return `/t/${encodeURIComponent(route.templateId)}`;
    case "adminTemplates":
      return "/templates";
    case "builder":
      return route.templateId ? `/builder/${encodeURIComponent(route.templateId)}` : "/builder";
    case "brandStudio":
      return "/brand";
    case "dashboard":
      return "/insights";
    case "people":
      return "/people";
    case "settings":
      return "/settings";
    case "submissions":
      return "/submissions";
    case "submissionDetail":
      return `/submissions/${encodeURIComponent(route.submissionId)}`;
    case "portalAccess":
      return "/portal-access";
    case "records":
      return "/records";
    case "recordDetail":
      return `/records/${encodeURIComponent(route.submissionId)}`;
    case "publicPortal":
      return `/g/${encodeURIComponent(route.token)}`;
    case "publicLibrary":
      return `/g/${encodeURIComponent(route.token)}/browse`;
    case "publicSubmit":
      return `/g/${encodeURIComponent(route.token)}/submit`;
    case "publicTemplate":
      return `/g/${encodeURIComponent(route.token)}/t/${encodeURIComponent(route.templateId)}`;
  }
}

/** Unknown paths resolve to the portal rather than a 404 screen — the app
 * decides what the signed-in user may actually see from there. */
export function routeFor(pathname: string): Route {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [head, second, third, fourth] = parts;
  switch (head) {
    case undefined:
      // The bare URL is the anonymous facility portal; the signed-in app
      // lives under /admin.
      return { name: "publicHome" };
    case "browse":
      return { name: "publicHomeLibrary" };
    case "submit":
      return { name: "publicHomeSubmit" };
    case "admin":
      return { name: "portal" };
    case "p":
      return second ? { name: "publicHomeTemplate", templateId: second } : { name: "publicHome" };
    case "onboarding":
      return { name: "onboarding" };
    case "t":
      return second ? { name: "template", templateId: second } : { name: "portal" };
    case "templates":
      return { name: "adminTemplates" };
    case "builder":
      return { name: "builder", templateId: second ?? null };
    case "brand":
      return { name: "brandStudio" };
    case "insights":
      return { name: "dashboard" };
    case "people":
      return { name: "people" };
    case "settings":
      return { name: "settings" };
    case "submissions":
      return second ? { name: "submissionDetail", submissionId: second } : { name: "submissions" };
    case "portal-access":
    case "facility-links": // pre-v2.1 path, kept resolving
      return { name: "portalAccess" };
    case "records":
      return second ? { name: "recordDetail", submissionId: second } : { name: "records" };
    case "g":
      if (!second) return { name: "portal" };
      if (!third) return { name: "publicPortal", token: second };
      if (third === "browse") return { name: "publicLibrary", token: second };
      if (third === "submit") return { name: "publicSubmit", token: second };
      if (third === "t") {
        return fourth
          ? { name: "publicTemplate", token: second, templateId: fourth }
          : { name: "publicLibrary", token: second };
      }
      // Legacy shape /g/:token/:templateId — links already in circulation
      // keep opening their template.
      return { name: "publicTemplate", token: second, templateId: third };
    default:
      return { name: "portal" };
  }
}

interface RouterState {
  route: Route;
  navigate(route: Route): void;
}

const RouterContext = createContext<RouterState | null>(null);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<Route>(() => routeFor(window.location.pathname));

  useEffect(() => {
    const onPop = () => setRoute(routeFor(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const value = useMemo<RouterState>(
    () => ({
      route,
      navigate(next: Route) {
        const path = pathFor(next);
        if (path !== window.location.pathname) {
          window.history.pushState(null, "", path);
        }
        setRoute(next);
      },
    }),
    [route],
  );
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterState {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside RouterProvider");
  return ctx;
}
