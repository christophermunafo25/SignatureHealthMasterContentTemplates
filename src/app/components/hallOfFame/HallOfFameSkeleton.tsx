import React from "react";
import { PublicShell } from "../public/PublicApp";

/** Loading states for the Hall of Fame pages, drawn in the portal's own
 * layout so nothing jumps when the real page arrives. Inline styles and
 * global Tailwind classes only: the full-page version is the React.lazy
 * fallback, so it renders before the page chunk (and its stylesheet) loads. */

/** Heading bars on the navy wash. */
const ON_WASH = "rgba(255, 255, 255, 0.16)";
/** Bars inside white cards. */
const IN_CARD = "var(--surface-sunken)";

const card: React.CSSProperties = {
  background: "var(--lift)",
  border: "1px solid var(--hairline)",
  borderRadius: 12,
};

export function SkeletonBlock({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse motion-reduce:animate-none"
      style={{ background: IN_CARD, borderRadius: 8, ...style }}
    />
  );
}

function Announce({ children }: { children: string }) {
  return (
    <p role="status" className="sr-only">
      {children}
    </p>
  );
}

function CardSkeleton() {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ ...card, borderRadius: "var(--radius-card-sm)", boxShadow: "var(--shadow-e1)" }}
    >
      <div style={{ padding: 8 }}>
        <div style={{ aspectRatio: "1 / 1", background: IN_CARD, borderRadius: 14, padding: 20 }}>
          <SkeletonBlock style={{ width: "100%", height: "100%", background: "#e1e5ea", borderRadius: 10 }} />
        </div>
      </div>
      <div className="p-4 space-y-2">
        <SkeletonBlock style={{ width: 104, height: 11 }} />
        <SkeletonBlock style={{ width: 132, height: 17 }} />
      </div>
    </div>
  );
}

/** The library body: heading, then two sections of three cards. */
export function LibrarySkeleton() {
  return (
    <>
      <Announce>Loading templates</Announce>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-11 sm:pt-[55px] pb-2">
        {/* Heading: its own size and leading, on as many lines as it takes:
            two, or three on phones under 389px wide (iPhone SE and mini). */}
        <div className="flex flex-col" style={{ fontSize: "clamp(20px, 3vw, 34px)", gap: "0.25em", padding: "0.125em 0", marginBottom: 8 }}>
          <SkeletonBlock style={{ width: "min(640px, 92%)", height: "0.8em", background: ON_WASH }} />
          <SkeletonBlock style={{ width: "min(520px, 72%)", height: "0.8em", background: ON_WASH }} />
          <div className="min-[389px]:hidden" style={{ height: "0.8em" }}>
            <SkeletonBlock style={{ width: "62%", height: "100%", background: ON_WASH }} />
          </div>
        </div>
        {/* Intro: three 24px lines. */}
        <div className="flex flex-col" style={{ maxWidth: 460, gap: 10, padding: "5px 0", marginBottom: 18 }}>
          <SkeletonBlock style={{ width: "100%", height: 14, background: ON_WASH }} />
          <SkeletonBlock style={{ width: "92%", height: 14, background: ON_WASH }} />
          <SkeletonBlock style={{ width: "40%", height: 14, background: ON_WASH }} />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 space-y-10">
        {[0, 1].map((section) => (
          <div key={section}>
            <SkeletonBlock style={{ width: 220, height: 20, background: ON_WASH, marginBottom: 16 }} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** The fill page body: field panels on the left, the preview on the right.
 * On phones the preview sits between the fields and the action panel, like
 * the page itself (TemplateFillLayout's previewAboveActionsOnMobile). */
export function FillSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6">
      <Announce>Loading template</Announce>
      <SkeletonBlock style={{ width: 120, height: 15, background: ON_WASH, marginBottom: 20 }} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-lg:gap-4">
        <div className="lg:col-span-5 space-y-4 max-lg:contents max-lg:space-y-0">
          <div>
            <SkeletonBlock style={{ width: 250, height: 12, background: ON_WASH, marginBottom: 10 }} />
            <SkeletonBlock style={{ width: 160, height: 30, background: ON_WASH }} />
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="p-4 space-y-2.5" style={card}>
              <SkeletonBlock style={{ width: 56, height: 11 }} />
              <SkeletonBlock style={{ width: 128, height: 16 }} />
              <SkeletonBlock style={{ width: "100%", height: i === 0 ? 96 : 46 }} />
            </div>
          ))}
          <div className="p-4 max-lg:order-1" style={card}>
            <SkeletonBlock style={{ width: "100%", height: 46 }} />
          </div>
        </div>
        <div className="lg:col-span-7">
          <div className="p-5" style={card}>
            <SkeletonBlock style={{ width: 72, height: 16, marginBottom: 12 }} />
            <SkeletonBlock style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 12 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Whole page, header included: the fallback while the page chunk loads. */
export function HallOfFameSkeleton({ view }: { view: "library" | "fill" }) {
  return (
    <PublicShell data={null}>
      {view === "library" ? <LibrarySkeleton /> : <FillSkeleton />}
    </PublicShell>
  );
}
