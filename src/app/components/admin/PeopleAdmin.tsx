import React, { useCallback, useEffect, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import type { Role } from "@/lib/types";
import type { Member } from "@/lib/stores/interfaces";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";

/** Team management: invite by email, change roles, remove. Invites are sent
 * by the invite-member Edge Function (admin-verified server-side). */
export function PeopleAdmin() {
  const { company, user, isDevAuth } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!company) return;
    setMembers(await stores.people.list(company.id));
  }, [company]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => console.error("People load failed", e))
      .finally(() => setLoading(false));
  }, [load]);

  const invite = async () => {
    if (!company || !email.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await stores.people.invite(company.id, email.trim().toLowerCase(), role);
      setNotice(`Invite sent to ${email.trim()}.`);
      setEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="sp-page-title">People</h1>
      <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4, marginBottom: 24 }}>
        Admins build and manage the brand; members use the portal to fill in templates.
      </p>

      {isDevAuth && (
        <p className="rounded-lg px-4 py-3 mb-5" style={{ fontSize: 12, background: "var(--paper-warm)", color: "var(--fg-2)" }}>
          People management needs the Supabase backend with auth enabled — this dev backend has no
          real accounts.
        </p>
      )}

      <div className="flex gap-2 mb-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void invite()}
          placeholder="person@company.com"
          className="sp-input flex-1"
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="sp-input" style={{ width: "auto" }}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button className="sp-btn sp-btn-primary" disabled={busy || !email.trim() || isDevAuth} onClick={() => void invite()}>
          <Send style={{ width: 13, height: 13 }} />
          {busy ? "Inviting…" : "Invite"}
        </button>
      </div>
      {error && <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>{error}</p>}
      {notice && <p style={{ fontSize: 12, color: "var(--success)", marginBottom: 8 }}>{notice}</p>}

      <div className="sp-card overflow-hidden mt-4">
        {loading ? (
          <p className="px-4 py-8 text-center" style={{ fontSize: 13, color: "var(--fg-3)" }}>Loading…</p>
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
                style={{ width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", overflow: "hidden" }}
              >
                <span style={{ color: "#fff", fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 11 }}>
                  {(m.name ?? m.email).slice(0, 1).toUpperCase()}
                </span>
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate" style={{ fontSize: 13, color: "var(--ink)" }}>
                  {m.email}
                  {m.userId === user?.id && <span style={{ color: "var(--fg-3)" }}> (you)</span>}
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
                    .then(load)
                    .catch((err) => setError(err instanceof Error ? err.message : "Failed."));
                }}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button
                disabled={m.userId === user?.id}
                onClick={() => {
                  if (!company) return;
                  if (window.confirm(`Remove ${m.email} from ${company.name}?`)) {
                    void stores.people
                      .remove(company.id, m.userId)
                      .then(load)
                      .catch((err) => setError(err instanceof Error ? err.message : "Failed."));
                  }
                }}
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
