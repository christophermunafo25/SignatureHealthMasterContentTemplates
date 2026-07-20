import React from "react";
import { DevAuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { BrandProvider } from "@/lib/brand/BrandContext";
import { RouterProvider, useRouter } from "./router";
import { AppShell } from "./components/AppShell";
import { Portal } from "./components/Portal";
import { TemplateUsePage } from "./components/TemplateUsePage";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { AdminTemplates } from "./components/admin/AdminTemplates";
import { TemplateBuilder } from "./components/builder/TemplateBuilder";
import { BrandStudio } from "./components/admin/BrandStudio";
import { LocationsAdmin } from "./components/admin/LocationsAdmin";
import { Dashboard } from "./components/admin/Dashboard";

function Screen() {
  const { loading, company, role } = useAuth();
  const { route } = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Loading…</p>
      </div>
    );
  }

  // First-run: no company exists (or user chose "Create company") → onboarding.
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
      {route.name === "locations" && adminOnly(<LocationsAdmin />)}
      {route.name === "dashboard" && adminOnly(<Dashboard />)}
    </AppShell>
  );
}

export default function App() {
  return (
    <DevAuthProvider>
      <BrandProvider>
        <RouterProvider>
          <Screen />
        </RouterProvider>
      </BrandProvider>
    </DevAuthProvider>
  );
}
