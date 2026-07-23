import React, { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import type { TemplateSchema } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../../router";
import { TemplateThumbnail } from "../TemplateThumbnail";

/** Admin template list: drafts + published, publish toggle, edit, delete. */
export function AdminTemplates() {
  const { company } = useAuth();
  const { navigate } = useRouter();
  const [templates, setTemplates] = useState<TemplateSchema[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!company) return;
    setTemplates(await stores.templates.listAll(company.id));
  }, [company]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => console.error("Template list failed", e))
      .finally(() => setLoading(false));
  }, [load]);

  const toggleStatus = async (t: TemplateSchema) => {
    await stores.templates.setStatus(t.id, t.status === "published" ? "draft" : "published");
    await load();
  };

  const remove = async (t: TemplateSchema) => {
    if (!window.confirm(`Delete template "${t.name}"? This cannot be undone.`)) return;
    await stores.templates.delete(t.id);
    await load();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="sp-page-title">Builder</h1>
          <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
            Create a new template or edit an existing one — published templates appear in Templates.
          </p>
        </div>
        <button className="sp-btn sp-btn-primary" onClick={() => navigate({ name: "builder", templateId: null })}>
          <Plus style={{ width: 13, height: 13 }} />
          New template
        </button>
      </div>

      {loading ? (
        <p className="text-center py-20" style={{ fontSize: 13, color: "var(--fg-3)" }}>Loading…</p>
      ) : templates.length === 0 ? (
        <div
          className="text-center py-24"
          style={{ border: "1.5px dashed var(--hairline-strong)", borderRadius: "var(--radius-card)" }}
        >
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase" as const, fontSize: 16, color: "var(--ink)", marginBottom: 6 }}>
            Create your first template
          </p>
          <p className="max-w-md mx-auto" style={{ fontSize: 13, color: "var(--fg-2)" }}>
            Upload a PNG or import a Figma frame, map the editable fields, and publish it for your team.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((t) => (
            <div key={t.id} className="sp-card overflow-hidden flex flex-col" style={{ borderRadius: "var(--radius-card-sm)" }}>
              <button
                onClick={() => navigate({ name: "builder", templateId: t.id })}
                className="w-full overflow-hidden"
                style={{ aspectRatio: `${t.canvasWidth} / ${t.canvasHeight}`, background: "var(--paper-warm)" }}
              >
                <TemplateThumbnail template={t} />
              </button>
              <div className="p-3.5 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{t.name}</p>
                  <span
                    className="sp-eyebrow inline-block mt-0.5"
                    style={t.status === "published" ? { color: "var(--success)" } : undefined}
                  >
                    {t.status}
                  </span>
                </div>
                <button onClick={() => void toggleStatus(t)} title={t.status === "published" ? "Unpublish" : "Publish"}>
                  {t.status === "published" ? (
                    <EyeOff style={{ width: 15, height: 15, color: "var(--fg-3)" }} />
                  ) : (
                    <Eye style={{ width: 15, height: 15, color: "var(--solar)" }} />
                  )}
                </button>
                <button onClick={() => navigate({ name: "builder", templateId: t.id })} title="Edit">
                  <Pencil style={{ width: 15, height: 15, color: "var(--fg-3)" }} />
                </button>
                <button onClick={() => void remove(t)} title="Delete">
                  <Trash2 style={{ width: 15, height: 15, color: "var(--danger)" }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
