import React, { useMemo, useState } from "react";
import { Check, Copy, Link2, Plus, Power, QrCode, RefreshCw, X } from "lucide-react";
import QRCode from "qrcode";
import type { Facility } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { ErrorState } from "../ErrorState";
import { ConfirmDialog } from "../ConfirmDialog";
import { pathFor } from "../../router";

const panel: React.CSSProperties = {
  background: "var(--lift)",
  border: "1px solid var(--hairline)",
  borderRadius: 12,
};

/** Strip the corporate wrapper down to the distinguishing words —
 * "Signature HealthCARE of Memphis" → "Memphis". Admin-editable before
 * save; this is only the starting point. */
export function deriveShortName(name: string): string {
  let s = name.trim();
  const prefixed = s.replace(/^Signature HealthCARE (of|at)\s+/i, "");
  if (prefixed !== s) return prefixed;
  const suffixes = [
    / Care & Rehabilitation Center$/i,
    / Care & Rehab$/i,
    / Health & Rehabilitation Center$/i,
    / Rehab & Wellness Center$/i,
    / Nursing & Rehabilitation Center$/i,
    / Health Care Center$/i,
    / Centre for Health & Rehabilitation$/i,
    / Health & Rehabilitation$/i,
    / Assisted Living and Transitional Care$/i,
  ];
  for (const suffix of suffixes) {
    const trimmed = s.replace(suffix, "");
    if (trimmed !== s) return trimmed;
  }
  return s;
}

function portalUrl(token: string): string {
  return `${window.location.origin}${pathFor({ name: "publicPortal", token })}`;
}

/** One shared portal link for every facility, plus the facility roster the
 * gate screen searches. Replaces the per-facility links screen. */
export function PortalAccess() {
  const { company, refresh } = useAuth();
  const companyId = company?.id ?? "";
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="sp-page-title">Portal Access</h1>
        <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
          One shared link opens the facility portal; staff pick their facility
          from the roster below. Disabling the portal cuts everyone off
          immediately.
        </p>
      </div>
      <LinkPanel companyId={companyId} refreshAuth={refresh} />
      <RosterPanel companyId={companyId} />
    </div>
  );
}

function LinkPanel({ companyId, refreshAuth }: { companyId: string; refreshAuth?: () => Promise<void> }) {
  const { company } = useAuth();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = company?.portalToken;
  const enabled = company?.portalEnabled ?? false;
  const prevExpires = company?.portalTokenPreviousExpires;
  const prevLive = Boolean(
    company?.portalTokenPrevious && prevExpires && new Date(prevExpires).getTime() > Date.now(),
  );
  const prevDaysLeft = prevLive
    ? Math.max(1, Math.ceil((new Date(prevExpires!).getTime() - Date.now()) / 86_400_000))
    : 0;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refreshAuth?.();
    } catch (e) {
      console.error("Portal link action failed", e);
      setError("Couldn't update the portal link. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(portalUrl(token));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="sp-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="sp-panel-title">Shared portal link</h2>
        {token && (
          <button
            className="sp-btn sp-btn-ghost"
            style={{ minHeight: 32, padding: "4px 12px" }}
            onClick={() => void act(() => stores.companies.setPortalEnabled(companyId, !enabled))}
            disabled={busy}
            aria-pressed={enabled}
          >
            <Power style={{ width: 13, height: 13, color: enabled ? "var(--success)" : "var(--danger)" }} />
            {enabled ? "Enabled" : "Disabled"}
          </button>
        )}
      </div>

      {!token ? (
        <div className="space-y-2">
          <p style={{ fontSize: 13, color: "var(--fg-3)" }}>
            No portal link yet. Generate one, print the QR code, and share it
            with your facilities.
          </p>
          <button
            className="sp-btn sp-btn-primary"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await stores.companies.rotatePortalToken(companyId);
                await stores.companies.setPortalEnabled(companyId, true);
              })
            }
          >
            <Link2 style={{ width: 14, height: 14 }} />
            {busy ? "Generating…" : "Generate portal link"}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <code
              className="truncate flex-1"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--ink)",
                background: "var(--paper)",
                border: "1px solid var(--hairline)",
                borderRadius: 8,
                padding: "8px 12px",
                minWidth: 220,
              }}
            >
              {portalUrl(token)}
            </code>
            <button className="sp-btn sp-btn-ghost" style={{ minHeight: 34 }} onClick={handleCopy}>
              {copied ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button className="sp-btn sp-btn-ghost" style={{ minHeight: 34 }} onClick={() => setQrOpen(true)}>
              <QrCode style={{ width: 13, height: 13 }} />
              QR
            </button>
            <button
              className="sp-btn sp-btn-ghost"
              style={{ minHeight: 34 }}
              onClick={() => setRotateOpen(true)}
              disabled={busy}
            >
              <RefreshCw style={{ width: 13, height: 13 }} />
              Rotate
            </button>
          </div>
          {!enabled && (
            <p style={{ fontSize: 12, color: "var(--danger)" }}>
              The portal is disabled — every facility gets "this link isn't active" until it's re-enabled.
            </p>
          )}
          {prevLive && (
            <p style={{ fontSize: 12, color: "var(--fg-3)" }}>
              The previous link still works for {prevDaysLeft} more day{prevDaysLeft === 1 ? "" : "s"},
              then it stops. Facilities on the old QR sheet should switch before then.
            </p>
          )}
        </>
      )}
      {error && <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}

      {qrOpen && token && <QrDialog url={portalUrl(token)} onClose={() => setQrOpen(false)} />}
      <ConfirmDialog
        open={rotateOpen}
        title="Rotate the portal link?"
        description="Every printed QR code and saved link switches to a new address. The old link keeps working for 14 more days so facilities aren't cut off mid-rollout — after that it stops."
        confirmLabel="Rotate link"
        tone="primary"
        onConfirm={() => {
          setRotateOpen(false);
          void act(() => stores.companies.rotatePortalToken(companyId));
        }}
        onCancel={() => setRotateOpen(false)}
      />
    </div>
  );
}

function RosterPanel({ companyId }: { companyId: string }) {
  const listState = useAsync(() => stores.facilities.list(companyId), [companyId]);
  const countsState = useAsync(async () => {
    const subs = await stores.submissions.list(companyId);
    const by = new Map<string, number>();
    for (const s of subs) if (s.facilityId) by.set(s.facilityId, (by.get(s.facilityId) ?? 0) + 1);
    return by;
  }, [companyId]);
  const counts = countsState.status === "ready" ? countsState.data : new Map<string, number>();

  const [rows, setRows] = useState<Facility[] | null>(null);
  const shown = rows ?? (listState.status === "ready" ? listState.data : []);

  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [shortTouched, setShortTouched] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editShort, setEditShort] = useState("");

  const refresh = async () => setRows(await stores.facilities.list(companyId));

  const bulkRows = useMemo(
    () =>
      bulkText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((legal) => ({ name: legal, shortName: deriveShortName(legal) })),
    [bulkText],
  );

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      console.error("Roster action failed", e);
      setError("Couldn't update the roster. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sp-card p-5 space-y-3">
      <h2 className="sp-panel-title">Facility roster ({shown.filter((f) => f.active).length} active)</h2>
      <p style={{ fontSize: 12, color: "var(--fg-3)" }}>
        The names staff pick from behind the shared link. Deactivate rather
        than delete — submission history keeps the facility's name either way.
      </p>

      {/* Add one */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-2 items-end">
        <div>
          <label className="sp-eyebrow block mb-1" htmlFor="fac-name">Legal name</label>
          <input
            id="fac-name"
            className="sp-input"
            placeholder="e.g. Signature HealthCARE of Memphis"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!shortTouched) setShortName(deriveShortName(e.target.value));
            }}
          />
        </div>
        <div>
          <label className="sp-eyebrow block mb-1" htmlFor="fac-short">Short name</label>
          <input
            id="fac-short"
            className="sp-input"
            placeholder="e.g. Memphis"
            value={shortName}
            onChange={(e) => {
              setShortTouched(true);
              setShortName(e.target.value);
            }}
          />
        </div>
        <button
          className="sp-btn sp-btn-primary"
          disabled={busy || !name.trim() || !shortName.trim()}
          onClick={() =>
            void act(async () => {
              await stores.facilities.create(companyId, {
                name: name.trim(),
                shortName: shortName.trim(),
              });
              setName("");
              setShortName("");
              setShortTouched(false);
            })
          }
        >
          <Plus style={{ width: 14, height: 14 }} />
          Add
        </button>
      </div>
      <button className="sp-btn sp-btn-ghost" onClick={() => setBulkOpen((o) => !o)} aria-expanded={bulkOpen}>
        Bulk add from list
      </button>
      {bulkOpen && (
        <div className="space-y-2">
          <textarea
            className="sp-input"
            rows={6}
            placeholder={"One legal name per line:\nSignature HealthCARE of Memphis\nBluegrass Care & Rehabilitation Center\n…"}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          {bulkRows.length > 0 && (
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--hairline)" }}>
              <table className="w-full" style={{ fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--paper)" }}>
                    <th className="text-left px-3 py-1.5" style={{ color: "var(--fg-3)", fontWeight: 500 }}>Short name (derived — review)</th>
                    <th className="text-left px-3 py-1.5" style={{ color: "var(--fg-3)", fontWeight: 500 }}>Legal name</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((r) => (
                    <tr key={r.name} style={{ borderTop: "1px solid var(--hairline)" }}>
                      <td className="px-3 py-1.5" style={{ fontWeight: 600, color: "var(--ink)" }}>{r.shortName}</td>
                      <td className="px-3 py-1.5" style={{ color: "var(--fg-2)" }}>{r.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            className="sp-btn sp-btn-primary"
            disabled={busy || bulkRows.length === 0}
            onClick={() =>
              void act(async () => {
                await stores.facilities.bulkCreate(companyId, bulkRows);
                setBulkText("");
                setBulkOpen(false);
              })
            }
          >
            {busy ? "Adding…" : `Add ${bulkRows.length} facilities`}
          </button>
        </div>
      )}
      {error && <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}

      {/* Roster */}
      {listState.status === "loading" && !rows ? (
        <p className="text-center py-8" style={{ fontSize: 13, color: "var(--fg-3)" }}>Loading…</p>
      ) : listState.status === "error" && !rows ? (
        <ErrorState title="We couldn't load the roster." detail="Check your connection and try again." onRetry={listState.retry} />
      ) : shown.length === 0 ? (
        <p className="text-center py-8" style={{ fontSize: 13, color: "var(--fg-3)" }}>
          No facilities yet — add them above or bulk-paste the roster.
        </p>
      ) : (
        <div className="space-y-1">
          {shown.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg"
              style={{ background: f.active ? "transparent" : "var(--paper)", border: "1px solid var(--hairline)" }}
            >
              <div className="min-w-0 flex-1" style={{ minWidth: 200 }}>
                {editingId === f.id ? (
                  <input
                    className="sp-input"
                    style={{ padding: "4px 8px", fontSize: 13 }}
                    value={editShort}
                    autoFocus
                    onChange={(e) => setEditShort(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editShort.trim()) {
                        setEditingId(null);
                        void act(() => stores.facilities.rename(f.id, { shortName: editShort.trim() }));
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => setEditingId(null)}
                    aria-label={`Short name for ${f.name}`}
                  />
                ) : (
                  <button
                    className="text-left"
                    title="Click to rename the short name"
                    onClick={() => {
                      setEditingId(f.id);
                      setEditShort(f.shortName);
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: f.active ? "var(--ink)" : "var(--fg-4)" }}>
                      {f.shortName}
                    </span>
                    <span className="block truncate" style={{ fontSize: 11, color: "var(--fg-3)" }}>{f.name}</span>
                  </button>
                )}
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>
                {counts.get(f.id) ?? 0} submission{(counts.get(f.id) ?? 0) === 1 ? "" : "s"}
              </span>
              <button
                className="sp-btn sp-btn-ghost"
                style={{ minHeight: 28, padding: "2px 10px", fontSize: 12 }}
                disabled={busy}
                onClick={() => void act(() => stores.facilities.setActive(f.id, !f.active))}
              >
                {f.active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Print-quality QR dialog — the link reaches facilities on a printed
 * sheet in a break room more often than in an email. */
function QrDialog({ url, onClose }: { url: string; onClose(): void }) {
  const qrState = useAsync(
    () => QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: "#003b71", light: "#ffffff" } }),
    [url],
  );
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(0,59,113,0.4)", zIndex: 70 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Portal QR code"
    >
      <div className="p-6 text-center space-y-3" style={{ ...panel, maxWidth: 400, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="sp-panel-title">Facility portal</h2>
          <button onClick={onClose} aria-label="Close" style={{ color: "var(--fg-3)" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        {qrState.status === "ready" ? (
          <img src={qrState.data} alt={`QR code linking to ${url}`} style={{ width: "100%", maxWidth: 340, margin: "0 auto" }} />
        ) : (
          <p style={{ fontSize: 12, color: "var(--fg-3)", padding: "60px 0" }}>Generating…</p>
        )}
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", wordBreak: "break-all" }}>{url}</p>
        <button className="sp-btn sp-btn-ghost w-full" onClick={() => window.print()}>
          Print
        </button>
      </div>
    </div>
  );
}
