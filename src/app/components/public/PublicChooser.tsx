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

  const card: React.CSSProperties = {
    background: "var(--lift)",
    border: "1px solid var(--hairline)",
    borderRadius: "var(--radius-card)",
    boxShadow: "var(--shadow-e1)",
  };

  const paths = [
    {
      title: "Submit content",
      body:
        "You already have the photo or video. Upload it with the caption you'd like, answer a few release questions, and send it to the social team.",
      bestFor: "Event photos, resident spotlights, anything you shot yourself.",
      Icon: Upload,
      go: () => navigate(submitRoute(token)),
    },
    {
      title: "Use a brand template",
      body:
        "Build the graphic here. Pick a Signature template, fill in the details, and we'll take care of the design. The release questions come at the end.",
      bestFor: "Birthdays, work anniversaries, hiring posts, holidays.",
      Icon: Image,
      go: () => navigate(libraryRoute(token)),
    },
  ];

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {paths.map(({ title, body, bestFor, Icon, go }) => (
            <button
              key={title}
              onClick={go}
              className="group text-left p-5 flex flex-col gap-3 transition-all"
              style={card}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="flex items-center justify-center flex-shrink-0 rounded-full"
                  style={{ width: 36, height: 36, background: "var(--peach)" }}
                >
                  <Icon style={{ width: 16, height: 16, color: "var(--ink)" }} />
                </span>
                <span
                  className="flex items-center justify-center flex-shrink-0 rounded-full transition-transform group-hover:translate-x-0.5"
                  style={{ width: 30, height: 30, background: "var(--peach)" }}
                >
                  <ArrowRight style={{ width: 14, height: 14, color: "var(--ink)" }} />
                </span>
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: 16,
                  letterSpacing: "0.04em",
                  color: "var(--ink)",
                }}
              >
                {title}
              </h2>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--fg-2)" }}>{body}</p>
              <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--fg-3)" }}>
                <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>Best for:</span> {bestFor}
              </p>
            </button>
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
