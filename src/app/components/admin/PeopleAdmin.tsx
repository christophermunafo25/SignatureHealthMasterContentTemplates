import React, { useState } from "react";
import { Check, Copy, Link2, Send, Trash2 } from "lucide-react";
import type { Role } from "@/lib/types";
import type { Member } from "@/lib/stores/interfaces";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { ConfirmDialog } from "../ConfirmDialog";
import { ErrorState } from "../ErrorState";

/** Team management: invite by email, change roles, remove. Invites are sent
 * by the invite-member Edge Function (admin-verified server-side). */
export function PeopleAdmin() {
  const { company, user, isDevAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Link-mode result: the one-time URL to hand over directly. */
  const [inviteLink, setInviteLink] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  /** Bumped after mutations so the list reloads through the same hook. */
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const membersState = useAsync(
    () => (company ? stores.people.list(company.id) : Promise.resolve([])),
    [company, version],
  );
  const members = membersState.status === "ready" ? membersState.data : [];

  /** Member pending remove confirmation. */
  const [removing, setRemoving] = useState<Member | null>(null);

  const confirmRemove = () => {
    if (!company || !removing) return;
    void stores.people
      .remove(company.id, removing.userId)
      .then(reload)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed."));
    setRemoving(null);
  };

  const invite = async (mode: "email" | "link") => {
    if (!company || !email.trim()) return;
    const address = email.trim().toLowerCase();
    setBusy(true);
    setError(null);
    setNotice(null);
    setInviteLink(null);
    try {
      const result = await stores.people.invite(company.id, address, role, mode);
      if (mode === "link" && result.actionLink) {
        setInviteLink({ email: address, url: result.actionLink });
        setNotice(null);
      } else {
        setNotice(
          result.existing
            ? `${address} already had an account — added to this workspace as ${role}.`
            : `Invite sent to ${address}.`,
        );
      }
      setEmail("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.email ?? ""} from ${company?.name ?? "this company"}?`}
        confirmLabel="Remove member"
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
      <h1 className="sp-page-title">People</h1>
      <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4, marginBottom: 24 }}>
        Admins build and manage the brand; members use the portal to fill in templates.
      </p>

      {isDevAuth && (
        <p className="rounded-lg px-4 py-3 mb-5" style={{ fontSize: 12, background: "var(--surface-sunken)", color: "var(--fg-2)" }}>
          People management needs the Supabase backend with auth enabled — this dev backend has no
          real accounts.
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void invite("email")}
          placeholder="person@company.com"
          className="sp-input flex-1"
          style={{ minWidth: 200 }}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="sp-input" style={{ width: "auto" }}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button className="sp-btn sp-btn-primary" disabled={busy || !email.trim() || isDevAuth} onClick={() => void invite("email")}>
          <Send style={{ width: 13, height: 13 }} />
          {busy ? "Working…" : "Email invite"}
        </button>
        <button
          className="sp-btn sp-btn-ghost"
          disabled={busy || !email.trim() || isDevAuth}
          onClick={() => void invite("link")}
          title="Creates the account and gives you a link to send yourself — no email is sent, so this is never rate-limited"
        >
          <Link2 style={{ width: 13, height: 13 }} />
          Get invite link
        </button>
      </div>
      {error && <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>{error}</p>}
      {notice && <p style={{ fontSize: 12, color: "var(--success)", marginBottom: 8 }}>{notice}</p>}
      {inviteLink && (
        <div className="sp-card p-4 mb-3 space-y-2">
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            Invite link for {inviteLink.email}
          </p>
          <p style={{ fontSize: 12, color: "var(--fg-3)" }}>
            They're already added to the workspace. Send them this link — it
            opens account setup, works once, and expires. No email was sent.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code
              className="truncate flex-1"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink)",
                background: "var(--paper)",
                border: "1px solid var(--hairline)",
                borderRadius: 8,
                padding: "8px 12px",
                minWidth: 220,
              }}
            >
              {inviteLink.url}
            </code>
            <button
              className="sp-btn sp-btn-ghost"
              style={{ minHeight: 34 }}
              onClick={async () => {
                await navigator.clipboard.writeText(inviteLink.url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
            >
              {copied ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button className="sp-btn sp-btn-ghost" style={{ minHeight: 34 }} onClick={() => setInviteLink(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      <div className="sp-card overflow-hidden mt-4">
        {membersState.status === "loading" ? (
          <p className="px-4 py-8 text-center" style={{ fontSize: 13, color: "var(--fg-3)" }}>Loading…</p>
        ) : membersState.status === "error" ? (
          <ErrorState
            title="We couldn't load your team."
            detail="Check your connection and try again."
            onRetry={membersState.retry}
          />
        ) : members.length === 0 ? (
          <p className="px-4 py-8 text-center" style={{ fontSize: 13, color: "var(--fg-3)" }}>
            No members yet.
          </p>
        ) : (
          members.map((m, i) => (
            <div
              key={m.userId}
              className="flex items-center gap-3 px-4 py-3"
              style={i > 0 ? { borderTop: "1px solid var(--hairline)" } : undefined}
            >
              <span
                className="sp-mesh flex-shrink-0"
                style={{ width: 32, height: 32, borderRadius: 999, display: "grid", placeItems: "center", overflow: "hidden" }}
              >
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ color: "#fff", fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase" as const, fontSize: 11 }}>
                    {(m.firstName ?? m.name ?? m.email).slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                  {[m.firstName, m.lastName].filter(Boolean).join(" ") || m.name || m.email}
                  {m.userId === user?.id && <span style={{ color: "var(--fg-3)", fontWeight: 400 }}> (you)</span>}
                </p>
                <p className="truncate" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                  {[m.title, m.email].filter(Boolean).join(" · ")}
                </p>
              </div>
              <select
                className="sp-input"
                style={{ width: "auto", padding: "5px 8px", fontSize: 12 }}
                value={m.role}
                disabled={m.userId === user?.id}
                onChange={(e) => {
                  if (!company) return;
                  void stores.people
                    .setRole(company.id, m.userId, e.target.value as Role)
                    .then(reload)
                    .catch((err) => setError(err instanceof Error ? err.message : "Failed."));
                }}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button
                disabled={m.userId === user?.id}
                onClick={() => setRemoving(m)}
                aria-label={`Remove ${m.email}`}
                style={{ opacity: m.userId === user?.id ? 0.3 : 1 }}
              >
                <Trash2 style={{ width: 15, height: 15, color: "var(--danger)" }} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
