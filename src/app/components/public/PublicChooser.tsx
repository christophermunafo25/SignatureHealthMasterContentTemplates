import React from "react";
import { ArrowRight, Image, Upload } from "lucide-react";
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

/** v2.2 landing: the public root is a CHOOSER, not the template grid. Two
 * paths — upload your own content, or build a brand template — both ending
 * in the same release form and the same review queue. */
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
      qualifier: "I already have the photo or video",
      title: "Submit content",
      body:
        "Upload your photos, write your caption, and submit for posting.",
      steps: ["Upload", "Answer the form", "Sent for review"],
      bestFor: "Event photos, resident spotlights, anything you shot yourself.",
      cta: "Upload your content",
      accent: "var(--mint)",
      tile: "var(--peach)",
      Icon: Upload,
      go: () => navigate(submitRoute(token)),
    },
    {
      qualifier: "I need a graphic made",
      title: "Use a brand template",
      body:
        "Pick a Signature template, fill in the details, and we'll take care of the design. A few last questions come at the end.",
      steps: ["Pick a template", "Fill it in", "Answer the form"],
      bestFor: "Birthdays, work anniversaries, holidays, and facility milestones.",
      cta: "Browse templates",
      accent: "var(--sky)",
      tile: "var(--sky)",
      Icon: Image,
      go: () => navigate(libraryRoute(token)),
    },
  ];

  // Figma "Public Chooser — Current State (1440x900)", node 2:2. Every
  // number below is read from that frame; tokens are used where the value
  // matches one exactly (it always does — the frame was drawn from them).
  const orBadge = (
    <span
      className="flex items-center justify-center rounded-full flex-shrink-0"
      style={{
        width: 46,
        height: 46,
        background: "var(--lift)",
        border: "1px solid var(--hairline-strong)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: "var(--fg-3)",
        boxShadow: "var(--shadow-e1)",
      }}
      aria-hidden
    >
      OR
    </span>
  );

  return (
    <PublicShell data={data} adminLink={isHome}>
      {/* Content column: 1212 wide incl. 32px side padding, 80 top / 56 bottom, 20 between blocks */}
      <div className="w-full max-w-[1212px] mx-auto px-5 sm:px-8 pt-10 sm:pt-20 pb-10 sm:pb-14">
        {/* Intro — 8px between the three lines */}
        <p
          className="sp-eyebrow"
          style={{ fontSize: 10, lineHeight: 1.3, letterSpacing: "0.04em", color: "var(--mint)", marginBottom: 8 }}
        >
          {data.company.name}
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(24px, 3.2vw, 34px)",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            color: "#ffffff",
            marginBottom: 8,
          }}
        >
          Send us something to post
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.85)",
            maxWidth: 440,
            marginBottom: 20,
          }}
        >
          The Agency reviews everything before it goes live on the brand&rsquo;s channels.
        </p>

        {/* Path cards — 20px gutter, 380px tall on desktop, OR badge centered between */}
        <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-5 items-stretch sm:h-[380px]">
          <span className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
            {orBadge}
          </span>
          {paths.map(({ qualifier, title, body, steps, bestFor, cta, accent, tile, Icon, go }, i) => (
            <React.Fragment key={title}>
              {i === 1 && <span className="flex sm:hidden justify-center -my-1">{orBadge}</span>}
              <button
                onClick={go}
                className="group text-left flex flex-col overflow-hidden transition-all h-full"
                style={{
                  background: "var(--lift)",
                  border: "1px solid var(--hairline)",
                  borderRadius: "var(--radius-card)",
                  boxShadow: "var(--shadow-e1)",
                }}
              >
                {/* Body: 20px padding, 12px between rows, best-for pinned to the bottom */}
                <span className="flex flex-col gap-3 p-5 flex-1 w-full">
                  <span className="flex items-center gap-3">
                    <span
                      className="flex items-center justify-center flex-shrink-0"
                      style={{ width: 40, height: 40, borderRadius: "var(--radius-icon)", background: tile }}
                    >
                      <Icon style={{ width: 17, height: 17, color: "var(--ink)" }} />
                    </span>
                    <h2
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 20,
                        letterSpacing: "-0.01em",
                        color: "var(--ink)",
                      }}
                    >
                      {title}
                    </h2>
                  </span>
                  {/* The decision, in the visitor's own words */}
                  <span
                    className="self-start rounded-full"
                    style={{
                      padding: "4px 12px",
                      fontFamily: "var(--font-ui)",
                      fontSize: 10.5,
                      fontWeight: 500,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "var(--ink)",
                      background: `color-mix(in srgb, ${accent} 22%, transparent)`,
                    }}
                  >
                    {qualifier}
                  </span>
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, lineHeight: 1.55, color: "var(--fg-2)" }}>{body}</p>
                  {/* How the path unfolds, at a glance */}
                  <span
                    style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-3)", whiteSpace: "nowrap" }}
                    aria-label={`Steps: ${steps.join(", then ")}`}
                  >
                    {steps.map((step, si) => (
                      <React.Fragment key={step}>
                        {si > 0 && <span aria-hidden style={{ color: "var(--fg-4)" }}> → </span>}
                        {step}
                      </React.Fragment>
                    ))}
                  </span>
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, lineHeight: 1.5, color: "var(--fg-3)", marginTop: "auto" }}>
                    <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>Best for:</span> {bestFor}
                  </p>
                </span>
                {/* Labeled CTA footer — right-aligned label + arrow circle */}
                <span
                  className="flex items-center justify-end gap-3 w-full"
                  style={{ padding: "12px 20px", borderTop: "1px solid var(--hairline)", background: "var(--paper)" }}
                >
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{cta}</span>
                  <span
                    className="flex items-center justify-center flex-shrink-0 rounded-full transition-transform group-hover:translate-x-0.5"
                    style={{ width: 28, height: 28, background: tile }}
                  >
                    <ArrowRight style={{ width: 13, height: 13, color: "var(--ink)" }} />
                  </span>
                </span>
              </button>
            </React.Fragment>
          ))}
        </div>

        <p
          className="text-center"
          style={{ fontFamily: "var(--font-ui)", fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.75)", marginTop: 20 }}
        >
          Not sure which? Start with a template. You can always upload your own
          photo inside one.
        </p>
      </div>
    </PublicShell>
  );
}
