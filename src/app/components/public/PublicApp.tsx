import React from "react";

/** Anonymous facility tree, mounted INSTEAD of the auth/brand providers —
 * an anonymous visitor must never trigger a session lookup (which would
 * land them on the sign-in page). Fleshed out in the public-portal phase;
 * this placeholder keeps the routing branch shippable on its own. */
export function PublicApp() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--linen)" }}>
      <p style={{ fontSize: 14, color: "var(--fg-3)" }}>This link isn't active.</p>
    </div>
  );
}
