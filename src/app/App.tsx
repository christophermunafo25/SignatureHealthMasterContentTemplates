import React from "react";
import { DevAuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { SupabaseAuthProvider } from "@/lib/auth/SupabaseAuthProvider";
import { stores } from "@/lib/stores";
import { AuthPage } from "./components/auth/AuthPage";
import { PeopleAdmin } from "./components/admin/PeopleAdmin";
import { BrandProvider, useBrand } from "@/lib/brand/BrandContext";
import { ColorSchemeProvider } from "@/lib/colorScheme";
import { RouterProvider, useRouter } from "./router";
import { AppShell } from "./components/AppShell";
import { ErrorState } from "./components/ErrorState";
import { Portal } from "./components/Portal";
import { TemplateUsePage } from "./components/TemplateUsePage";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { AdminTemplates } from "./components/admin/AdminTemplates";
import { TemplateBuilder } from "./components/builder/TemplateBuilder";
import { BrandStudio } from "./components/admin/BrandStudio";
import { Dashboard } from "./components/admin/Dashboard";
import { SettingsAdmin } from "./components/admin/SettingsAdmin";
import { PublicApp } from "./components/public/PublicApp";
import { FacilityLinks } from "./components/admin/FacilityLinks";

function Screen() {
  const { loading, error, retry, company, role, user, backend } = useAuth();
  const brand = useBrand();
  const { route } = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Loading…</p>
      </div>
    );
  }

  // A failed identity/membership load is an ERROR — never treat it as
  // "signed out" or "no company" (both would point the user at the wrong fix).
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <ErrorState
          title="We couldn't load your account."
          detail="Check your connection and try again."
          onRetry={retry}
        />
      </div>
    );
  }

  // Real auth: no session → sign in / sign up.
  if (backend === "supabase" && !user) {
    return <AuthPage />;
  }

  // Same rule for the brand kit: don't render brand-aware screens against a
  // kit that failed to load.
  if (!brand.loading && brand.error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <ErrorState
          title="We couldn't load your brand."
          detail="Check your connection and try again."
          onRetry={brand.retry}
        />
      </div>
    );
  }

  // No company for this identity (or "Create company") → onboarding.
  if (!company || route.name === "onboarding") {
    return <OnboardingWizard firstRun={!company} />;
  }

  const adminOnly = (node: React.ReactNode) =>
    role === "admin" ? node : <Portal />;

  return (
    <AppShell>
      {route.name === "portal" && <Portal />}
      {route.name === "template" && <TemplateUsePage templateId={route.templateId} />}
      {route.name === "adminTemplates" && adminOnly(<AdminTemplates />)}
      {route.name === "builder" && adminOnly(<TemplateBuilder templateId={route.templateId} />)}
      {route.name === "brandStudio" && adminOnly(<BrandStudio />)}
      {route.name === "dashboard" && adminOnly(<Dashboard />)}
      {route.name === "people" && adminOnly(<PeopleAdmin />)}
      {route.name === "settings" && adminOnly(<SettingsAdmin />)}
      {route.name === "facilityLinks" && adminOnly(<FacilityLinks />)}
      {/* Routes shipped in later phases of v2 — fall back to the portal
       * until their screens land so a deep link never renders blank. */}
      {(route.name === "submissions" || route.name === "submissionDetail") && adminOnly(<Portal />)}
    </AppShell>
  );
}

/** Branches BEFORE the auth provider mounts: a public route must never
 * trigger a session lookup (a failed one would render the sign-in page). */
function RootSwitch() {
  const { route } = useRouter();
  if (route.name === "publicPortal" || route.name === "publicTemplate") {
    return <PublicApp />;
  }
  const AuthProvider = stores.backend === "supabase" ? SupabaseAuthProvider : DevAuthProvider;
  return (
    <AuthProvider>
      <BrandProvider>
        <Screen />
      </BrandProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <ColorSchemeProvider>
      <RouterProvider>
        <RootSwitch />
      </RouterProvider>
    </ColorSchemeProvider>
  );
}
