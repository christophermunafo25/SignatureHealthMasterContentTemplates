import React from "react";
import { PublicError } from "../public/PublicApp";

/** Around the lazily loaded Hall of Fame pages (App.tsx). Catches a page
 * chunk that fails to download (a flaky connection, or a deploy that
 * replaced the chunk while the tab was open) and anything that throws while
 * the pages render, so a visitor gets the portal's own error screen with a
 * retry instead of a blank page. Lives in the main bundle on purpose: it has
 * to work when the chunk doesn't. */
export class HallOfFameErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Hall of Fame page failed", error);
  }

  render() {
    // A full reload refetches index.html, which names the current chunk.
    return this.state.failed ? <PublicError retry={() => window.location.reload()} /> : this.props.children;
  }
}
