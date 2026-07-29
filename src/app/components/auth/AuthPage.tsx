import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/stores/supabase/client";

type View = "signin" | "forgot" | "setPassword";

/** Sign in / password reset. INVITE-ONLY: there is no signup view —
 * accounts are created through People-page invites, and the dashboard's
 * public-signup switch must be off. Also handles the recovery redirect
 * (Supabase fires PASSWORD_RECOVERY after the email link). */
export function AuthPage() {
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setView("setPassword");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const signIn = () =>
    run(async () => {
      const { error: err } = await supabase().auth.signInWithPassword({ email, password });
      if (err) throw err;
      // Session change re-renders the app; nothing else to do.
    });

  const forgot = () =>
    run(async () => {
      const { error: err } = await supabase().auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (err) throw err;
      setNotice("Password reset link sent — check your email.");
    });

  const setNewPassword = () =>
    run(async () => {
      const { error: err } = await supabase().auth.updateUser({ password });
      if (err) throw err;
      setNotice("Password updated.");
      setView("signin");
    });

  const field = (
    label: string,
    type: string,
    value: string,
    onChange: (v: string) => void,
    autoComplete?: string,
  ) => (
    <div>
      <label className="sp-eyebrow block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (view === "signin") void signIn();
            else if (view === "forgot") void forgot();
            else if (view === "setPassword") void setNewPassword();
          }
        }}
        className="sp-input"
      />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--linen)" }}>
      <div
        className="w-full max-w-sm overflow-hidden"
        style={{ background: "var(--lift)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-e4)" }}
      >
        <div className="sp-mesh px-7 pt-7 pb-6">
          <p className="sp-eyebrow mb-1" style={{ color: "rgba(255,255,255,0.85)" }}>
            Signature HealthCare
          </p>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", fontSize: 20, letterSpacing: "0.1em", color: "#ffffff" }}>
            {view === "forgot" ? "Reset password" : view === "setPassword" ? "Choose a new password" : "Sign in"}
          </h1>
        </div>

        <div className="px-7 py-6 space-y-4">
          {view !== "setPassword" && field("Email", "email", email, setEmail, "email")}
          {view !== "forgot" &&
            field(
              view === "setPassword" ? "New password" : "Password",
              "password",
              password,
              setPassword,
              view === "signin" ? "current-password" : "new-password",
            )}

          {error && (
            <p className="rounded-lg px-3 py-2" style={{ fontSize: 12, background: "var(--fill-danger-bg)", color: "var(--danger)" }}>
              {error}
            </p>
          )}
          {notice && <p style={{ fontSize: 12, color: "var(--success)" }}>{notice}</p>}

          {view === "signin" && (
            <>
              <button className="sp-btn sp-btn-primary w-full" disabled={busy || !email || !password} onClick={() => void signIn()}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <button
                className="w-full text-center"
                style={{ fontSize: 12, color: "var(--fg-2)" }}
                onClick={() => setView("forgot")}
              >
                Forgot password?
              </button>
            </>
          )}
          {view === "forgot" && (
            <>
              <button className="sp-btn sp-btn-primary w-full" disabled={busy || !email} onClick={() => void forgot()}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
              <button style={{ fontSize: 12, color: "var(--fg-2)" }} onClick={() => setView("signin")}>
                Back to sign in
              </button>
            </>
          )}
          {view === "setPassword" && (
            <button className="sp-btn sp-btn-primary w-full" disabled={busy || password.length < 8} onClick={() => void setNewPassword()}>
              {busy ? "Saving…" : "Save password"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
