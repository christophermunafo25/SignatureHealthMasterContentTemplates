import React, { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { useRouter } from "../../router";
import { TemplateThumbnailBase } from "../TemplateThumbnail";
import { PublicError, PublicInactive, PublicLoading, PublicShell, usePublicPortal } from "./PublicApp";

/** Anonymous facility library: the published template grid behind a
 * facility link. Mobile-first — a director of nursing on a phone, not a
 * designer on a desktop. */
export function PublicPortal({ token }: { token: string }) {
  const { navigate } = useRouter();
  const state = usePublicPortal(token);
  const [query, setQuery] = useState("");

  const templates = state.status === "ready" ? state.data.templates ?? [] : [];
  const filtered = useMemo(() => {
    if (!query.trim()) return templates;
    const q = query.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [templates, query]);

  if (state.status === "loading") return <PublicLoading />;
  if (state.status === "inactive") return <PublicInactive />;
  if (state.status === "error") return <PublicError retry={state.retry} />;

  const { data } = state;
  return (
    <PublicShell data={data}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-8 pb-2">
        <p className="sp-eyebrow mb-2">{data.facility.name}</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            textTransform: "uppercase",
            fontSize: "clamp(20px, 3vw, 32px)",
            letterSpacing: "0.06em",
            lineHeight: 1.05,
            color: "var(--ink)",
            marginBottom: 8,
          }}
        >
          Create a graphic
        </h1>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--fg-2)", fontSize: 14, maxWidth: 420, marginBottom: 18 }}>
          Pick a template, fill in the details, and send it to the Signature
          social team to post.
        </p>
        {templates.length > 6 && (
          <div className="relative max-w-md">
            <Search className="absolute" style={{ left: 14, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "var(--fg-3)", zIndex: 1 }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              aria-label="Search templates"
              className="sp-input"
              style={{ padding: "10px 14px 10px 38px" }}
            />
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        {templates.length === 0 ? (
          <p className="text-center py-16" style={{ fontSize: 14, color: "var(--fg-2)" }}>
            No templates are available yet — check back soon.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16" style={{ fontSize: 14, color: "var(--fg-2)" }}>
            No templates match “{query}”.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate({ name: "publicTemplate", token, templateId: t.id })}
                aria-label={t.category ? `${t.name} — ${t.category}` : t.name}
                className="group text-left overflow-hidden transition-all flex flex-col"
                style={{
                  background: "var(--lift)",
                  border: "1px solid var(--hairline)",
                  borderRadius: "var(--radius-card-sm)",
                  boxShadow: "var(--shadow-e1)",
                }}
              >
                <div
                  className="w-full overflow-hidden"
                  style={{ aspectRatio: `${t.canvasWidth} / ${t.canvasHeight}`, background: "var(--paper-warm)" }}
                >
                  <TemplateThumbnailBase template={t} brandKit={data.brandKit} />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {t.category && <p className="sp-eyebrow mb-1">{t.category}</p>}
                      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase" as const, fontSize: 15, letterSpacing: "0.04em", color: "var(--ink)" }}>
                        {t.name}
                      </h2>
                    </div>
                    <span
                      className="flex items-center justify-center flex-shrink-0 rounded-full transition-transform group-hover:translate-x-0.5"
                      style={{ width: 30, height: 30, background: "var(--peach)" }}
                    >
                      <ArrowRight style={{ width: 14, height: 14, color: "var(--ink)" }} />
                    </span>
                  </div>
                  {t.description && (
                    <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--fg-2)", marginTop: 6 }}>{t.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
