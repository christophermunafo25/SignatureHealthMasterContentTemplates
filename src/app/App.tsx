import React from "react";
import { DevAuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { SupabaseAuthProvider } from "@/lib/auth/SupabaseAuthProvider";
import { stores } from "@/lib/stores";
import { AuthPage } from "./components/auth/AuthPage";
import { PeopleAdmin } from "./components/admin/PeopleAdmin";
import { BrandProvider } from "@/lib/brand/BrandContext";
import { ColorSchemeProvider } from "@/lib/colorScheme";
import { RouterProvider, useRouter } from "./router";
import { AppShell } from "./components/AppShell";
import { Portal } from "./components/Portal";
import { TemplateUsePage } from "./components/TemplateUsePage";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { AdminTemplates } from "./components/admin/AdminTemplates";
import { TemplateBuilder } from "./components/builder/TemplateBuilder";
import { BrandStudio } from "./components/admin/BrandStudio";
import { Dashboard } from "./components/admin/Dashboard";

function Screen() {
  const { loading, company, role, user, backend } = useAuth();
  const { route } = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Loading…</p>
      </div>
    );
  }

  // Real auth: no session → sign in / sign up.
  if (backend === "supabase" && !user) {
    return <AuthPage />;
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
    </AppShell>
  );
}

export default function App() {
  const AuthProvider = stores.backend === "supabase" ? SupabaseAuthProvider : DevAuthProvider;
  return (
    <ColorSchemeProvider>
      <AuthProvider>
        <BrandProvider>
          <RouterProvider>
            <Screen />
          </RouterProvider>
        </BrandProvider>
      </AuthProvider>
    </ColorSchemeProvider>
  );
}
