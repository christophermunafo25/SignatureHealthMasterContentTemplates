import React, { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { EMPTY_FILTER, isFiltered, organizeLibrary } from "@/lib/templateLibrary";
import { useRouter } from "../router";
import { ErrorState } from "./ErrorState";
import { LibraryFilterBar, LibraryNoMatches, LibrarySections, useLibraryFilter } from "./TemplateLibrary";
import { TemplateThumbnail, TemplateThumbnailMat } from "./TemplateThumbnail";

/** Member-facing, company-scoped searchable template grid. Signature
 * platform chrome: signature warm mesh hero, lift cards on hairlines,
 * sentence case, mono metadata. Tenant brand lives in the thumbnails. */
export function Portal() {
  const { company, role } = useAuth();
  const { navigate } = useRouter();
  const [filter, setFilter] = useLibraryFilter();
  const templatesState = useAsync(
    () => (company ? stores.templates.listPublished(company.id) : Promise.resolve([])),
    [company],
  );
  const templates = templatesState.status === "ready" ? templatesState.data : [];

  const library = useMemo(() => organizeLibrary(templates, filter), [templates, filter]);

  return (
    <div>
      {/* Header — flat on the canvas; comfortable clearance from the sidebar */}
      <div className="max-w-7xl mx-auto px-8 sm:px-12 pt-12 pb-2">
        <p className="sp-eyebrow mb-3">{company?.name}</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "clamp(22px, 3.2vw, 36px)",
            letterSpacing: "-0.02em",
            lineHeight: 0.95,
            color: "var(--ink)",
            marginBottom: 10,
          }}
        >
          Published Templates
        </h1>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--fg-2)", fontSize: 15, maxWidth: 420, marginBottom: 24 }}>
          Pick a template, fill in the details, and download a ready-to-post on-brand graphic.
        </p>
        <LibraryFilterBar
          library={library}
          filter={filter}
          onChange={setFilter}
          totalCount={templates.length}
          tone="onLight"
        />
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-8 sm:px-12 py-10">
        {templatesState.status === "loading" ? (
          <p className="text-center py-20" style={{ fontSize: 13, color: "var(--fg-3)" }}>
            Loading templates…
          </p>
        ) : templatesState.status === "error" ? (
          <ErrorState
            title="We couldn't load your templates."
            detail="Check your connection and try again."
            onRetry={templatesState.retry}
          />
        ) : templates.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p style={{ fontSize: 14, color: "var(--fg-2)" }}>No templates published yet.</p>
            {role === "admin" && (
              <button className="sp-btn sp-btn-primary" onClick={() => navigate({ name: "adminTemplates" })}>
                Create your first template
              </button>
            )}
          </div>
        ) : library.total === 0 ? (
          <LibraryNoMatches filter={filter} onClear={() => setFilter(EMPTY_FILTER)} tone="onLight" />
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="sp-eyebrow">
                {library.total} template{library.total !== 1 ? "s" : ""}
                {isFiltered(filter) ? ` of ${templates.length}` : ""}
              </p>
              <p style={{ fontSize: 12, color: "var(--fg-3)" }}>Click a template to get started</p>
            </div>
            <LibrarySections
              sections={library.sections}
              tone="onLight"
              renderCard={(t) => (
                <button
                  onClick={() => navigate({ name: "template", templateId: t.id })}
                  aria-label={t.category ? `${t.name} — ${t.category}` : t.name}
                  className="group text-left overflow-hidden transition-all flex flex-col"
                  style={{
                    background: "var(--lift)",
                    border: "1px solid var(--hairline)",
                    borderRadius: "var(--radius-card-sm)",
                    boxShadow: "var(--shadow-e1)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-e3)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-e1)"; }}
                >
                  <div className="w-full" style={{ padding: 8 }}>
                    <TemplateThumbnailMat template={t}>
                      <TemplateThumbnail template={t} />
                    </TemplateThumbnailMat>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div>
                        {t.category && <p className="sp-eyebrow mb-1">{t.category}</p>}
                        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em", color: "var(--ink)" }}>
                          {t.name}
                        </h3>
                      </div>
                      <span
                        className="flex items-center justify-center flex-shrink-0 rounded-full transition-transform group-hover:translate-x-0.5"
                        style={{ width: 30, height: 30, background: "var(--peach)" }}
                      >
                        <ArrowRight style={{ width: 14, height: 14, color: "var(--ink)" }} />
                      </span>
                    </div>
                    {t.description && (
                      <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--fg-2)", marginBottom: 10 }}>{t.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {t.fields.map((f) => (
                        <span
                          key={f.id}
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            letterSpacing: "0.3px",
                            color: "var(--fg-2)",
                            background: "rgba(35,31,35,0.05)",
                            padding: "2px 7px",
                            borderRadius: 5,
                          }}
                        >
                          {f.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              )}
            />
          </>
        )}
      </div>
    </div>
  );
}
