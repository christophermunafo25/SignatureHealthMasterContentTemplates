import React from "react";
import { HOME_REF } from "@/lib/publicClient";
import { useRouter } from "../../router";
import {
  PublicError,
  PublicInactive,
  PublicLoading,
  PublicShell,
  libraryRoute,
  submitRoute,
  usePublicPortal,
} from "./PublicApp";

// Scoped to this page. Lora and Montserrat already arrive with the Google
// Fonts @import in signature.css, so nothing new is loaded; the global
// --font-* tokens are left alone deliberately.
const SERIF = '"Lora", Georgia, serif';
const SANS = '"Montserrat", ui-sans-serif, system-ui, sans-serif';

/** v2.2 landing: the public root is a CHOOSER, not the template grid. Two
 * paths — upload your own content, or build a brand template — both ending
 * in the same release form and the same review queue.
 *
 * Figma "Public Chooser — Gradient + Norfolk colors 1440", node 5:81. Every
 * number below is read from that frame. The card is a plain container and
 * the CTA is the only interactive element, so there are no nested
 * interactive elements the way the old whole-card button had. */
export function PublicChooser({ token }: { token: string }) {
  const { navigate } = useRouter();
  const state = usePublicPortal(token);

  const isHome = token === HOME_REF;
  if (state.status === "loading") return <PublicLoading />;
  if (state.status === "inactive") return <PublicInactive adminLink={isHome} />;
  if (state.status === "error") return <PublicError retry={state.retry} />;
  const { data } = state;

  const paths = [
    {
      title: "Submit Content",
      qualifier: "I already have the photo or video",
      qualifierColor: "color-mix(in srgb, var(--ink) 75%, transparent)",
      steps: ["Upload", "Answer the form", "Sent for review"],
      numberBg: "var(--mint)",
      numberColor: "var(--ink)",
      bestFor: "Event photos, resident spotlights, anything you shot yourself.",
      cta: "Upload your content",
      ctaBg: "var(--ink)",
      ctaColor: "#ffffff",
      ctaHover: "color-mix(in srgb, var(--ink) 92%, #000000)",
      ctaRing: "var(--mint)",
      go: () => navigate(submitRoute(token)),
    },
    {
      title: "Use a brand template",
      qualifier: "I need a graphic made",
      qualifierColor: "var(--mint)",
      steps: ["Pick a template", "Fill it in", "Answer the form"],
      numberBg: "var(--ink)",
      numberColor: "#ffffff",
      bestFor: "Birthdays, work anniversaries, holidays, and facility milestones.",
      cta: "Browse templates",
      ctaBg: "var(--mint)",
      ctaColor: "var(--ink)",
      ctaHover: "color-mix(in srgb, var(--mint) 92%, #000000)",
      ctaRing: "var(--ink)",
      go: () => navigate(libraryRoute(token)),
    },
  ];

  return (
    <PublicShell data={data} adminLink={isHome}>
      {/* Content column: 1212 incl. side padding. 32/40 mobile, 55/55 desktop. */}
      <div className="w-full max-w-[1212px] mx-auto px-4 sm:px-8 pt-8 sm:pt-[55px] pb-10 sm:pb-[55px] flex flex-col gap-6 sm:gap-8">
        {/* Intro — 12px between the two lines */}
        <div className="flex flex-col gap-3">
          <h1
            style={{
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: "clamp(38px, 4.2vw, 54px)",
              lineHeight: 1.1,
              color: "#ffffff",
            }}
          >
            Send us something to post
          </h1>
          <p
            className="text-[17px] sm:text-[18px]"
            style={{
              fontFamily: SANS,
              fontWeight: 400,
              lineHeight: 1.5,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            The Agency reviews everything before it goes live on the brand&rsquo;s channels.
          </p>
        </div>

        {/* Two equal columns on desktop, stacked on mobile. Heights come from
            content now — the spacer below keeps the two cards aligned. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 items-stretch">
          {paths.map((p) => (
            <div
              key={p.title}
              className="flex flex-col gap-6 pt-6 sm:pt-9 px-4 sm:px-9 pb-4 sm:pb-7"
              style={{ background: "var(--lift)", borderRadius: "var(--radius-card)" }}
            >
              {/* Heading group — 10px */}
              <div className="flex flex-col gap-2.5">
                <h2
                  className="text-[32px] sm:text-[38px]"
                  style={{ fontFamily: SERIF, fontWeight: 700, lineHeight: 1.1, color: "var(--ink)" }}
                >
                  {p.title}
                </h2>
                <p
                  style={{
                    fontFamily: SANS,
                    fontWeight: 600,
                    fontSize: 15,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    lineHeight: 1.3,
                    color: p.qualifierColor,
                  }}
                >
                  {p.qualifier}
                </p>
              </div>

              {/* Steps — the <ol> carries the order for screen readers, so no
                  aria-label is needed the way the old inline arrow line did. */}
              <ol className="flex flex-col gap-3.5" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {p.steps.map((step, si) => (
                  <li key={step} className="flex items-center gap-3.5">
                    <span
                      className="flex items-center justify-center flex-shrink-0 rounded-full"
                      style={{
                        width: 34,
                        height: 34,
                        background: p.numberBg,
                        fontFamily: SANS,
                        fontWeight: 700,
                        fontSize: 15,
                        color: p.numberColor,
                      }}
                      aria-hidden
                    >
                      {si + 1}
                    </span>
                    <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 19, lineHeight: 1.3, color: "var(--ink)" }}>
                      {step}
                    </span>
                  </li>
                ))}
              </ol>

              {/* Pushes "Best for" and the CTA to the bottom so both cards line
                  up on desktop; collapses to its minimum when stacked. */}
              <div className="flex-1 min-h-[24px]" aria-hidden />

              <div className="flex flex-col gap-1.5">
                <p
                  style={{
                    fontFamily: SANS,
                    fontWeight: 600,
                    fontSize: 13,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--fg-2)",
                  }}
                >
                  Best for
                </p>
                <p style={{ fontFamily: SANS, fontWeight: 400, fontSize: 17, lineHeight: 1.5, color: "var(--fg-2)" }}>
                  {p.bestFor}
                </p>
              </div>

              <button
                onClick={p.go}
                className="pc-cta w-full h-14 sm:h-[60px] flex items-center justify-center gap-3"
                style={
                  {
                    background: p.ctaBg,
                    color: p.ctaColor,
                    border: "none",
                    borderRadius: 10,
                    fontFamily: SANS,
                    fontWeight: 700,
                    fontSize: 18,
                    "--pc-cta-hover": p.ctaHover,
                    "--pc-cta-ring": p.ctaRing,
                  } as React.CSSProperties
                }
              >
                {p.cta}
                <svg width={22} height={22} viewBox="0 0 20 20" aria-hidden style={{ flexShrink: 0 }}>
                  <path
                    d="M3 10h13M11 4.5l5.5 5.5-5.5 5.5"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="square"
                    fill="none"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
