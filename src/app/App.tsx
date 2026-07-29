import React from "react";
import { DevAuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { SupabaseAuthProvider } from "@/lib/auth/SupabaseAuthProvider";
import { stores } from "@/lib/stores";
import { AuthPage } from "./components/auth/AuthPage";
import { PeopleAdmin } from "./components/admin/PeopleAdmin";
import { BrandProvider, useBrand } from "@/lib/brand/BrandContext";
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
import { PortalAccess } from "./components/admin/PortalAccess";
import { SubmissionQueue } from "./components/admin/SubmissionQueue";
import { SubmissionDetail } from "./components/admin/SubmissionDetail";

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

  // No company for this identity. Under real auth this is invite-only —
  // there is no self-service company creation (see migration 0018); the
  // dev backend keeps the onboarding wizard for local work.
  if (!company) {
    return backend === "supabase" ? <NoMembership /> : <OnboardingWizard firstRun />;
  }
  if (route.name === "onboarding") {
    return backend === "supabase" ? <Portal /> : <OnboardingWizard firstRun={false} />;
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
      {route.name === "portalAccess" && adminOnly(<PortalAccess />)}
      {route.name === "submissions" && adminOnly(<SubmissionQueue />)}
      {route.name === "submissionDetail" && adminOnly(<SubmissionDetail submissionId={route.submissionId} />)}
    </AppShell>
  );
}

/** Signed in, but no company membership. Invite-only: the account was
 * created by an invite that hasn't landed, or someone signed in with the
 * wrong address. */
function NoMembership() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--linen)" }}>
      <div className="text-center space-y-3" style={{ maxWidth: 380 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>No workspace access yet</p>
        <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.6 }}>
          {user?.email ? <b style={{ color: "var(--fg-2)" }}>{user.email}</b> : "This account"} isn't a
          member of a company on this portal. Ask an admin to send you an
          invite from the People page, then sign in again.
        </p>
        {signOut && (
          <button className="sp-btn sp-btn-ghost" onClick={() => void signOut()}>Sign out</button>
        )}
      </div>
    </div>
  );
}

/** Branches BEFORE the auth provider mounts: a public route must never
 * trigger a session lookup (a failed one would render the sign-in page). */
function RootSwitch() {
  const { route } = useRouter();
  if (
    route.name === "publicPortal" ||
    route.name === "publicTemplate" ||
    route.name === "publicHome" ||
    route.name === "publicHomeTemplate"
  ) {
    return <PublicApp />;
  }
  // Mount-time guard (one of three): never run the no-auth dev backend in
  // a production bundle.
  if (import.meta.env.PROD && stores.backend !== "supabase") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--linen)" }}>
        <p style={{ fontSize: 14, color: "var(--danger)" }}>
          This deployment is missing its backend configuration. Contact the administrator.
        </p>
      </div>
    );
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
    <RouterProvider>
      <RootSwitch />
    </RouterProvider>
  );
}
