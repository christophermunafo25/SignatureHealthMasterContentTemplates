import React, { createContext, useContext, useMemo, useState } from "react";

/** Lightweight view-state routing, extending the original App.tsx pattern
 * (no URL router — matches the Figma Make export's structure). */
export type Route =
  | { name: "onboarding" }
  | { name: "portal" }
  | { name: "template"; templateId: string }
  | { name: "adminTemplates" }
  | { name: "builder"; templateId: string | null }
  | { name: "brandStudio" }
  | { name: "locations" }
  | { name: "dashboard" };

interface RouterState {
  route: Route;
  navigate(route: Route): void;
}

const RouterContext = createContext<RouterState | null>(null);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [route, navigate] = useState<Route>({ name: "portal" });
  const value = useMemo<RouterState>(() => ({ route, navigate }), [route]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterState {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside RouterProvider");
  return ctx;
}
