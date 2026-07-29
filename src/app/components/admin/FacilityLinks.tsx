import React, { useMemo, useState } from "react";
import { Check, Copy, Link2, Plus, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import type { FacilityLink } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { ErrorState } from "../ErrorState";
import { pathFor } from "../../router";

const panel: React.CSSProperties = {
  background: "var(--lift)",
  border: "1px solid var(--hairline)",
  borderRadius: 12,
};

function linkUrl(link: FacilityLink): string {
  return `${window.location.origin}${pathFor({ name: "publicPortal", token: link.token })}`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Admin management of anonymous facility links: one unguessable URL per
 * facility, printable as a QR sheet for a break room. Deactivating takes
 * effect on the facility's next request — no deploy involved. */
export function FacilityLinks() {
  const { company } = useAuth();
  const companyId = company?.id ?? "";
  const linksState = useAsync(() => stores.facilityLinks.list(companyId), [companyId]);
  const [links, setLinks] = useState<FacilityLink[] | null>(null);
  const shown = links ?? (linksState.status === "ready" ? linksState.data : []);

  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [expiry, setExpiry] = useState("");
  const [creating, setCreating] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrLink, setQrLink] = useState<FacilityLink | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => setLinks(await stores.facilityLinks.list(companyId));

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await stores.facilityLinks.create(companyId, {
        facilityName: name.trim(),
        templateTags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        expiresAt: expiry ? new Date(expiry).toISOString() : null,
      });
      setName("");
      setTags("");
      setExpiry("");
      await refresh();
    } catch (e) {
      console.error("Create link failed", e);
      setError("Couldn't create the link. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleBulkCreate = async () => {
    const names = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!names.length) return;
    setCreating(true);
    setError(null);
    try {
      await stores.facilityLinks.bulkCreate(companyId, names);
      setBulkText("");
      setBulkOpen(false);
      await refresh();
    } catch (e) {
      console.error("Bulk create failed", e);
      setError("Couldn't create the links. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (link: FacilityLink) => {
    await navigator.clipboard.writeText(linkUrl(link));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId((c) => (c === link.id ? null : c)), 1600);
  };

  const handleToggle = async (link: FacilityLink) => {
    await stores.facilityLinks.setActive(link.id, !link.active);
    await refresh();
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="sp-page-title">Facility Links</h1>
        <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
          One private link per facility — staff open it, fill in a template, and
          submit for review. No accounts, no passwords. Deactivating a link cuts
          off that facility immediately.
        </p>
      </div>

      {/* Create */}
      <div className="sp-card p-5 space-y-3">
        <h2 className="sp-panel-title">New facility link</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="sp-eyebrow block mb-1" htmlFor="fl-name">Facility name</label>
            <input
              id="fl-name"
              className="sp-input"
              placeholder="e.g. Signature HealthCARE of Memphis"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div>
            <label className="sp-eyebrow block mb-1" htmlFor="fl-tags">Template tags (optional)</label>
            <input
              id="fl-tags"
              className="sp-input"
              placeholder="Empty = all published templates"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
          <div>
            <label className="sp-eyebrow block mb-1" htmlFor="fl-expiry">Expires (optional)</label>
            <input
              id="fl-expiry"
              type="date"
              className="sp-input"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="sp-btn sp-btn-primary" onClick={handleCreate} disabled={creating || !name.trim()}>
            <Plus style={{ width: 14, height: 14 }} />
            {creating ? "Creating…" : "Create link"}
          </button>
          <button
            className="sp-btn sp-btn-ghost"
            onClick={() => setBulkOpen((o) => !o)}
            aria-expanded={bulkOpen}
          >
            Bulk create from list
          </button>
        </div>
        {bulkOpen && (
          <div className="space-y-2">
            <textarea
              className="sp-input"
              rows={6}
              placeholder={"One facility name per line:\nSignature HealthCARE of Memphis\nSignature HealthCARE of Roanoke\n…"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <button className="sp-btn sp-btn-primary" onClick={handleBulkCreate} disabled={creating || !bulkText.trim()}>
              {creating ? "Creating…" : `Create ${bulkText.split("\n").filter((l) => l.trim()).length} links`}
            </button>
          </div>
        )}
        {error && <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}
      </div>

      {/* List */}
      {linksState.status === "loading" && !links ? (
        <p className="text-center py-12" style={{ fontSize: 13, color: "var(--fg-3)" }}>Loading…</p>
      ) : linksState.status === "error" && !links ? (
        <ErrorState
          title="We couldn't load your facility links."
          detail="Check your connection and try again."
          onRetry={linksState.retry}
        />
      ) : shown.length === 0 ? (
        <div className="sp-card text-center py-14 px-6">
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-1)" }}>No facility links yet</p>
          <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 6 }}>
            Create one per facility above — each gets its own private URL and QR code.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((link) => (
            <div key={link.id} className="p-4 flex flex-wrap items-center gap-3" style={panel}>
              <Link2 style={{ width: 16, height: 16, color: link.active ? "var(--success)" : "var(--fg-4)", flexShrink: 0 }} />
              <div className="min-w-0 flex-1" style={{ minWidth: 220 }}>
                <p className="truncate" style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
                  {link.facilityName}
                </p>
                <p className="truncate" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>
                  {linkUrl(link)}
                </p>
              </div>
              <span
                className="capitalize"
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: link.active ? "var(--success)" : "var(--fg-3)",
                }}
              >
                {link.active ? (link.expiresAt && new Date(link.expiresAt) < new Date() ? "expired" : "active") : "inactive"}
              </span>
              <span style={{ fontSize: 11, color: "var(--fg-3)" }}>
                Last used {link.lastUsedAt ? fmtDate(link.lastUsedAt) : "never"} · Created {fmtDate(link.createdAt)}
              </span>
              <div className="flex items-center gap-1.5">
                <button className="sp-btn sp-btn-ghost" style={{ minHeight: 32, padding: "4px 10px" }} onClick={() => handleCopy(link)}>
                  {copiedId === link.id ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
                  {copiedId === link.id ? "Copied" : "Copy link"}
                </button>
                <button
                  className="sp-btn sp-btn-ghost"
                  style={{ minHeight: 32, padding: "4px 10px" }}
                  onClick={() => setQrLink(link)}
                  title="Show QR code"
                >
                  <QrCode style={{ width: 13, height: 13 }} />
                  QR
                </button>
                <button
                  className="sp-btn sp-btn-ghost"
                  style={{ minHeight: 32, padding: "4px 10px" }}
                  onClick={() => handleToggle(link)}
                >
                  {link.active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {qrLink && <QrDialog link={qrLink} onClose={() => setQrLink(null)} />}
    </div>
  );
}

/** Print-friendly QR dialog — facility staff get this link on a printed
 * sheet in a break room more often than in an email. */
function QrDialog({ link, onClose }: { link: FacilityLink; onClose(): void }) {
  const url = linkUrl(link);
  const qrState = useAsync(
    () => QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: "#003b71", light: "#ffffff" } }),
    [url],
  );
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(0,59,113,0.4)", zIndex: 70 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`QR code for ${link.facilityName}`}
    >
      <div
        className="p-6 text-center space-y-3"
        style={{ ...panel, maxWidth: 380, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="sp-panel-title">{link.facilityName}</h2>
          <button onClick={onClose} aria-label="Close" style={{ color: "var(--fg-3)" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        {qrState.status === "ready" ? (
          <img src={qrState.data} alt={`QR code linking to ${url}`} style={{ width: "100%", maxWidth: 320, margin: "0 auto" }} />
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
