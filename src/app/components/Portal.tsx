import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { TemplateSchema } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../router";
import { TemplateThumbnail } from "./TemplateThumbnail";

/** Member-facing, company-scoped searchable template grid. Generalized from
 * the reference LandingPage: same card-grid design language, driven by the
 * tenant's published templates instead of a hardcoded array. */
export function Portal() {
  const { company, role } = useAuth();
  const { navigate } = useRouter();
  const [query, setQuery] = useState("");
  const [templates, setTemplates] = useState<TemplateSchema[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company) return;
    setLoading(true);
    stores.templates
      .listPublished(company.id)
      .then(setTemplates)
      .catch((e) => console.error("Template load failed", e))
      .finally(() => setLoading(false));
  }, [company]);

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

  return (
    <div>
      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, var(--primary) 0%, var(--secondary-foreground) 130%)" }}
      >
        <div className="relative max-w-7xl mx-auto px-4 py-12">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.22em] mb-2.5"
            style={{ color: "var(--accent)" }}
          >
            {company?.name}
          </p>
          <h1 className="font-extrabold text-white uppercase tracking-tight leading-tight mb-3" style={{ fontSize: "clamp(28px, 5vw, 44px)" }}>
            Choose a Template
          </h1>
          <p className="text-white/75 text-[15px] leading-relaxed mb-8 max-w-md">
            Select a template, fill in the details, and download a ready-to-post on-brand graphic.
          </p>
          <div className="relative max-w-md">
            <Search className="absolute w-[18px] h-[18px] text-white/50" style={{ left: 16, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              className="w-full text-sm text-white rounded-xl outline-none transition-colors"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1.5px solid rgba(255,255,255,0.15)",
                padding: "12px 16px 12px 46px",
              }}
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        {loading ? (
          <p className="text-center py-20 text-sm" style={{ color: "var(--muted-foreground)" }}>
            Loading templates…
          </p>
        ) : templates.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="font-bold uppercase tracking-[0.12em] text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              No templates published yet
            </p>
            {role === "admin" && (
              <button
                onClick={() => navigate({ name: "adminTemplates" })}
                className="text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                Create your first template
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-20 font-bold uppercase tracking-[0.12em] text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            No templates match “{query}”
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="font-extrabold uppercase tracking-[0.16em] text-xs" style={{ color: "var(--foreground)" }}>
                {filtered.length} Template{filtered.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Click a template to get started
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate({ name: "template", templateId: t.id })}
                  className="group text-left rounded-2xl overflow-hidden transition-all flex flex-col bg-white hover:-translate-y-0.5"
                  style={{ border: "1.5px solid var(--border)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
                >
                  <div
                    className="w-full overflow-hidden"
                    style={{ aspectRatio: `${t.canvasWidth} / ${t.canvasHeight}`, background: "var(--secondary)" }}
                  >
                    <TemplateThumbnail template={t} />
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        {t.category && (
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-1" style={{ color: "var(--primary)" }}>
                            {t.category}
                          </p>
                        )}
                        <h2 className="font-extrabold uppercase text-[17px] leading-tight" style={{ color: "var(--foreground)" }}>
                          {t.name}
                        </h2>
                      </div>
                      <div
                        className="flex items-center justify-center flex-shrink-0 rounded-full transition-transform group-hover:translate-x-0.5 w-9 h-9"
                        style={{ background: "var(--accent)" }}
                      >
                        <ArrowRight className="w-4 h-4" style={{ color: "var(--accent-foreground)" }} />
                      </div>
                    </div>
                    {t.description && (
                      <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--muted-foreground)" }}>
                        {t.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {t.fields.map((f) => (
                        <span
                          key={f.id}
                          className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md"
                          style={{ background: "var(--secondary)", color: "var(--secondary-foreground)" }}
                        >
                          {f.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
