import React from "react";

/** Failure state for data loads — the counterpart to the empty states, in the
 * same visual language (centered, generous padding, quiet type). Copy stays
 * plain and non-technical; the actual error is already in the console. */
export function ErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail?: string;
  onRetry: () => void;
}) {
  return (
    <div className="text-center py-20 space-y-3 px-6">
      <p style={{ fontSize: 14, color: "var(--fg-2)" }}>{title}</p>
      {detail && <p style={{ fontSize: 13, color: "var(--fg-3)" }}>{detail}</p>}
      <button className="sp-btn sp-btn-primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
