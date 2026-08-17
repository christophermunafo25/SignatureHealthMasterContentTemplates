import React from "react";

// Three containment levels (root / route / canvas+field), one class. Each
// boundary reports what it caught with ids-only context, renders a fallback
// in the app's own voice, and can recover: `retry` re-renders the subtree,
// and a change in `resetKeys` (route navigation, the field being edited)
// resets a crashed boundary automatically.
//
// IMPORTANT: this module is safe to import from main.tsx BEFORE the app
// bundle, so it must never import stores, auth, or anything that evaluates
// backend config. React only.
//
// The upstream version reports through a Sentry-backed monitoring module.
// That module is deliberately out of scope for this port, so `captureError`
// below is a local console reporter with the same signature — wiring a real
// backend later is a one-function swap, and no call site changes.

export type BoundaryLevel = "root" | "route" | "canvas" | "field";

export interface CaptureContext {
  /** Which boundary (or handler) caught it. */
  boundary?: BoundaryLevel;
  /** Route NAME only ("builder", "portal") — never a full URL. */
  route?: string;
  companyId?: string;
  templateId?: string;
  facilityId?: string;
  submissionId?: string;
  fieldId?: string;
  /** Auth user id (opaque). Never email, never display name. */
  userId?: string;
  componentStack?: string;
}

/** Ids-only error report. Never pass member content, names, or emails —
 *  submissions carry PHI-adjacent material and none of it belongs in a log. */
function captureError(error: unknown, context: CaptureContext = {}): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${context.boundary ?? "unknown"}] ${message}`, { error, context });
}

interface ErrorBoundaryProps {
  level: BoundaryLevel;
  /** Ids-only context merged into the report — never customer content. */
  context?: CaptureContext;
  /** Fallback UI; `retry` resets the boundary and re-renders the children. */
  fallback: (retry: () => void) => React.ReactNode;
  /** A crashed boundary resets itself when any of these change. */
  resetKeys?: readonly unknown[];
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, { crashed: boolean }> {
  state = { crashed: false };

  static getDerivedStateFromError(): { crashed: boolean } {
    return { crashed: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    captureError(error, {
      ...this.props.context,
      boundary: this.props.level,
      componentStack: info.componentStack ?? undefined,
    });
  }

  componentDidUpdate(prev: ErrorBoundaryProps): void {
    if (!this.state.crashed) return;
    const a = prev.resetKeys;
    const b = this.props.resetKeys;
    if (!a || !b) return;
    if (a.length !== b.length || b.some((k, i) => k !== a[i])) {
      this.setState({ crashed: false });
    }
  }

  retry = (): void => this.setState({ crashed: false });

  render(): React.ReactNode {
    return this.state.crashed ? this.props.fallback(this.retry) : this.props.children;
  }
}

/** Root fallback — also rendered directly when the app bundle itself fails
 * to load. Sits OUTSIDE every provider, so it uses only the stylesheet
 * (classes and CSS variables), no context, no router. */
export function RootCrashScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--background)" }}
    >
      <div className="text-center space-y-3" style={{ maxWidth: 420 }}>
        <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>
          Signature HealthCare Graphics ran into a problem it couldn't recover from.
        </p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Reloading brings you back to your last saved work — published templates, saved drafts, and
          submitted content aren't affected.
        </p>
        <button className="sp-btn sp-btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    </div>
  );
}

/** Fallback for a single field on the canvas: fills the field's box, sized
 * in canvas units like the content it replaces. The element stays selectable
 * and deletable in the builder — one bad field never takes the canvas. */
export function FieldCrashFallback({ width, height }: { width: number; height: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1.5px dashed var(--border-strong)",
        background: "color-mix(in srgb, var(--border) 18%, transparent)",
      }}
    >
      <span
        style={{
          fontSize: Math.max(16, Math.min(width, height) / 6),
          color: "var(--text-muted)",
          textAlign: "center",
          padding: 8,
        }}
      >
        This element couldn't be shown
      </span>
    </div>
  );
}
