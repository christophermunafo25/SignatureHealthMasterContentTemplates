import React, { useState } from "react";
import { X } from "lucide-react";

/** One-tap starting points that fill the field and stay editable. */
const PRESETS = [
  "Off-brand",
  "Incorrect information",
  "Photo quality",
  "Duplicate",
  "Wrong channel",
  "Needs family approval",
];

/** Decline with a REQUIRED reason. The submitter notification defaults on
 * when an email exists — a facility director who submits into a void and
 * hears nothing stops using the tool. */
export function DeclineDialog({
  submitterEmail,
  onDecline,
  onCancel,
}: {
  submitterEmail?: string;
  onDecline(reason: string, notify: boolean): void;
  onCancel(): void;
}) {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(Boolean(submitterEmail));

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(0,59,113,0.4)", zIndex: 70 }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Decline submission"
    >
      <div
        className="p-5 space-y-3"
        style={{
          background: "var(--lift)",
          border: "1px solid var(--hairline)",
          borderRadius: 12,
          maxWidth: 440,
          width: "100%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="sp-panel-title">Decline this submission</h2>
          <button onClick={onCancel} aria-label="Close" style={{ color: "var(--fg-3)" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              className="rounded-full px-3 py-1"
              style={{
                fontSize: 12,
                border: "1px solid var(--hairline-strong)",
                background: reason === preset ? "var(--accent-wash)" : "var(--lift)",
                color: "var(--fg-1)",
              }}
              onClick={() => setReason(preset)}
            >
              {preset}
            </button>
          ))}
        </div>
        <textarea
          className="sp-input"
          rows={3}
          placeholder="Why it can't be posted (required — the facility may read this)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
          aria-label="Decline reason"
        />
        <label className="flex items-center gap-2" style={{ fontSize: 13, color: submitterEmail ? "var(--fg-1)" : "var(--fg-4)" }}>
          <input
            type="checkbox"
            checked={notify && Boolean(submitterEmail)}
            disabled={!submitterEmail}
            onChange={(e) => setNotify(e.target.checked)}
          />
          {submitterEmail
            ? `Email the reason to ${submitterEmail}`
            : "The submitter left no email — they can't be notified"}
        </label>
        <div className="flex justify-end gap-2">
          <button className="sp-btn sp-btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="sp-btn"
            style={{ background: "var(--danger)", color: "#fff" }}
            disabled={!reason.trim()}
            onClick={() => onDecline(reason.trim(), notify && Boolean(submitterEmail))}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
