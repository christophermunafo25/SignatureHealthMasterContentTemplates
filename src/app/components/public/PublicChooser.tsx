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
        "Upload what you shot, write the caption you'd like, answer a few release questions, and send it to the social team.",
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
        "Pick a Signature template, fill in the details, and we'll take care of the design. The release questions come at the end.",
      steps: ["Pick a template", "Fill it in", "Answer the form"],
      bestFor: "Birthdays, work anniversaries, hiring posts, holidays.",
      cta: "Browse templates",
      accent: "var(--sky)",
      tile: "var(--sky)",
      Icon: Image,
      go: () => navigate(libraryRoute(token)),
    },
  ];

  const orBadge = (
    <span
      className="flex items-center justify-center rounded-full flex-shrink-0"
      style={{
        width: 36,
        height: 36,
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
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <p className="sp-eyebrow mb-2">{data.company.name}</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            textTransform: "uppercase",
            fontSize: "clamp(22px, 3.2vw, 34px)",
            letterSpacing: "0.06em",
            lineHeight: 1.05,
            color: "var(--ink)",
            marginBottom: 8,
          }}
        >
          Send us something to post
        </h1>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--fg-2)", fontSize: 14, maxWidth: 440, marginBottom: 24 }}>
          The Signature social team reviews everything before it goes live on the
          brand&rsquo;s channels.
        </p>

        <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
          {/* Desktop: the OR badge floats between the two cards. */}
          <span className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
            {orBadge}
          </span>
          {paths.map(({ qualifier, title, body, steps, bestFor, cta, accent, tile, Icon, go }, i) => (
            <React.Fragment key={title}>
              {/* Mobile: the OR divider sits between the stacked cards. */}
              {i === 1 && <span className="flex sm:hidden justify-center -my-1">{orBadge}</span>}
              <button
                onClick={go}
                className="group text-left flex flex-col overflow-hidden transition-all"
                style={{
                  background: "var(--lift)",
                  border: "1px solid var(--hairline)",
                  borderTop: `4px solid ${accent}`,
                  borderRadius: "var(--radius-card)",
                  boxShadow: "var(--shadow-e1)",
                }}
              >
                <span className="flex flex-col gap-3 p-5 flex-1">
                  {/* The decision, in the visitor's own words */}
                  <span
                    className="self-start rounded-full px-3 py-1"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "var(--ink)",
                      background: `color-mix(in srgb, ${accent} 22%, transparent)`,
                    }}
                  >
                    {qualifier}
                  </span>
                  <span className="flex items-center gap-3">
                    <span
                      className="flex items-center justify-center flex-shrink-0"
                      style={{ width: 40, height: 40, borderRadius: "var(--radius-icon, 10px)", background: tile }}
                    >
                      <Icon style={{ width: 17, height: 17, color: "var(--ink)" }} />
                    </span>
                    <h2
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        fontSize: 17,
                        letterSpacing: "0.04em",
                        color: "var(--ink)",
                      }}
                    >
                      {title}
                    </h2>
                  </span>
                  <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--fg-2)" }}>{body}</p>
                  {/* How the path unfolds, at a glance */}
                  <span className="flex items-center flex-wrap gap-1.5" aria-label={`Steps: ${steps.join(", then ")}`}>
                    {steps.map((step, si) => (
                      <React.Fragment key={step}>
                        {si > 0 && <ArrowRight aria-hidden style={{ width: 10, height: 10, color: "var(--fg-4)" }} />}
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-3)", whiteSpace: "nowrap" }}>
                          {step}
                        </span>
                      </React.Fragment>
                    ))}
                  </span>
                  <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--fg-3)", marginTop: "auto" }}>
                    <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>Best for:</span> {bestFor}
                  </p>
                </span>
                {/* Labeled CTA footer — each path says where it goes */}
                <span
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderTop: "1px solid var(--hairline)", background: "var(--paper)" }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{cta}</span>
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

        <p className="text-center" style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 20 }}>
          Not sure which? Start with a template. You can always upload your own
          photo inside one.
        </p>
      </div>
    </PublicShell>
  );
}
