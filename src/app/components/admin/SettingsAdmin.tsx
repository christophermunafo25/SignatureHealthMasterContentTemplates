import React, { useState } from "react";
import { LogOut, Monitor, Moon, Plus, Sun, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useColorScheme, type ColorScheme } from "@/lib/colorScheme";
import { stores } from "@/lib/stores";

const SCHEMES: Array<{ key: ColorScheme; label: string; Icon: typeof Sun; hint: string }> = [
  { key: "system", label: "System", Icon: Monitor, hint: "Follow the OS preference" },
  { key: "light", label: "Light", Icon: Sun, hint: "Always light chrome" },
  { key: "dark", label: "Dark", Icon: Moon, hint: "Always dark chrome" },
];

/** Settings & Admin — the sidebar's sixth destination. Workspace facts,
 * appearance, and account. People management lives on its own page. */
export function SettingsAdmin() {
  const { company, role, user, backend, signOut } = useAuth();
  const { scheme, setScheme } = useColorScheme();

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-5">
      <div>
        <h1 className="sp-page-title">Settings & Admin</h1>
        <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
          Company, appearance, and account. Admins and members are managed on
          the People page.
        </p>
      </div>

      <div className="sp-card p-5 space-y-3">
        <h2 className="sp-panel-title">Company</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2" style={{ fontSize: 13 }}>
          <span style={{ color: "var(--fg-3)" }}>Name</span>
          <span style={{ color: "var(--ink)" }}>{company?.name ?? "—"}</span>
          <span style={{ color: "var(--fg-3)" }}>Slug</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>
            {company?.slug ?? "—"}
          </span>
          <span style={{ color: "var(--fg-3)" }}>Backend</span>
          <span style={{ color: "var(--ink)" }}>
            {backend === "supabase" ? "Supabase (live)" : "Local dev (browser storage)"}
          </span>
        </div>
      </div>

      <NotificationsCard />

      <div className="sp-card p-5 space-y-3">
        <h2 className="sp-panel-title">Appearance</h2>
        <p style={{ fontSize: 12, color: "var(--fg-3)" }}>
          Applies to the portal chrome only — template graphics and
          exports are identical in both modes.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {SCHEMES.map(({ key, label, Icon, hint }) => (
            <button
              key={key}
              onClick={() => setScheme(key)}
              title={hint}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl"
              style={{
                border: `1.5px solid ${scheme === key ? "var(--solar)" : "var(--hairline-strong)"}`,
                background: scheme === key ? "var(--accent-wash)" : "var(--lift)",
                color: "var(--ink)",
                fontSize: 12.5,
              }}
            >
              <Icon style={{ width: 16, height: 16, color: scheme === key ? "var(--solar)" : "var(--fg-2)" }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="sp-card p-5 space-y-3">
        <h2 className="sp-panel-title">Account</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2" style={{ fontSize: 13 }}>
          <span style={{ color: "var(--fg-3)" }}>Email</span>
          <span style={{ color: "var(--ink)" }}>{user?.email ?? "— (dev backend)"}</span>
          <span style={{ color: "var(--fg-3)" }}>Role</span>
          <span className="capitalize" style={{ color: "var(--ink)" }}>{role}</span>
        </div>
        {signOut && (
          <button onClick={() => void signOut()} className="sp-btn sp-btn-ghost">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}

/** Who gets emailed when a facility submits content. Per-submission email
 * ships immediately; recipients are configuration, never a constant. */
function NotificationsCard() {
  const { company, refresh } = useAuth();
  const [emails, setEmails] = useState<string[]>(company?.notificationEmails ?? []);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = async (next: string[]) => {
    if (!company) return;
    setEmails(next);
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await stores.companies.setNotificationEmails(company.id, next);
      await refresh?.();
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      console.error("Saving recipients failed", e);
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const add = () => {
    const v = draft.trim().toLowerCase();
    if (!v || !v.includes("@") || emails.includes(v)) return;
    setDraft("");
    void persist([...emails, v]);
  };

  return (
    <div className="sp-card p-5 space-y-3">
      <h2 className="sp-panel-title">Submission notifications</h2>
      <p style={{ fontSize: 12, color: "var(--fg-3)" }}>
        Every facility submission emails these addresses with a preview and a
        review link. Leave empty to turn notifications off.
      </p>
      <div className="space-y-1.5">
        {emails.map((email) => (
          <div
            key={email}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
            style={{ background: "var(--paper)", fontSize: 13, color: "var(--ink)" }}
          >
            <span className="truncate">{email}</span>
            <button
              onClick={() => void persist(emails.filter((e) => e !== email))}
              aria-label={`Remove ${email}`}
              style={{ color: "var(--fg-3)" }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        ))}
        {emails.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--fg-4)" }}>No recipients yet.</p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="email"
          className="sp-input"
          placeholder="e.g. shcsocial@signaturehealthcarellc.com"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          aria-label="Add notification recipient"
        />
        <button className="sp-btn sp-btn-ghost flex-shrink-0" onClick={add} disabled={saving || !draft.includes("@")}>
          <Plus style={{ width: 14, height: 14 }} />
          Add
        </button>
      </div>
      {saved && <p style={{ fontSize: 12, color: "var(--success)" }}>Saved.</p>}
      {error && <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
