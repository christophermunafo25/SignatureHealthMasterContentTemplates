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
  | { name: "publicPortal"; token: string }
  | { name: "publicTemplate"; token: string; templateId: string }
  // Root-URL public portal (no token in the address; resolved server-side
  // to the company that opted in via portal_public).
  | { name: "publicHome" }
  | { name: "publicHomeTemplate"; templateId: string };

export function pathFor(route: Route): string {
  switch (route.name) {
    case "portal":
      return "/admin";
    case "publicHome":
      return "/";
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
    case "publicPortal":
      return `/g/${encodeURIComponent(route.token)}`;
    case "publicTemplate":
      return `/g/${encodeURIComponent(route.token)}/${encodeURIComponent(route.templateId)}`;
  }
}

/** Unknown paths resolve to the portal rather than a 404 screen — the app
 * decides what the signed-in user may actually see from there. */
export function routeFor(pathname: string): Route {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [head, second, third] = parts;
  switch (head) {
    case undefined:
      // The bare URL is the anonymous facility portal; the signed-in app
      // lives under /admin.
      return { name: "publicHome" };
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
    case "g":
      if (!second) return { name: "portal" };
      return third
        ? { name: "publicTemplate", token: second, templateId: third }
        : { name: "publicPortal", token: second };
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
