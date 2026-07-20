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
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-extrabold uppercase text-xl" style={{ color: "var(--foreground)" }}>Templates</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Build locked templates your team fills in — published ones appear in the portal.
          </p>
        </div>
        <button
          onClick={() => navigate({ name: "builder", templateId: null })}
          className="flex items-center gap-2 font-bold uppercase text-xs tracking-[0.18em] px-5 py-3 rounded-xl shadow-md"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {loading ? (
        <p className="text-center py-20 text-sm" style={{ color: "var(--muted-foreground)" }}>Loading…</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-24 rounded-3xl border-2 border-dashed" style={{ borderColor: "var(--border)" }}>
          <p className="font-bold uppercase tracking-[0.12em] text-sm mb-2" style={{ color: "var(--foreground)" }}>
            Create your first template
          </p>
          <p className="text-sm max-w-md mx-auto" style={{ color: "var(--muted-foreground)" }}>
            Upload a PNG of an existing design, map the editable fields, and publish it to your team's portal.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl overflow-hidden bg-white flex flex-col"
              style={{ border: "1.5px solid var(--border)" }}
            >
              <button
                onClick={() => navigate({ name: "builder", templateId: t.id })}
                className="w-full overflow-hidden"
                style={{ aspectRatio: `${t.canvasWidth} / ${t.canvasHeight}`, background: "var(--secondary)" }}
              >
                <TemplateThumbnail template={t} />
              </button>
              <div className="p-4 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold uppercase text-sm truncate" style={{ color: "var(--foreground)" }}>
                    {t.name}
                  </p>
                  <span
                    className="inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-1"
                    style={
                      t.status === "published"
                        ? { background: "#E4F4E8", color: "#1C7C3A" }
                        : { background: "var(--secondary)", color: "var(--muted-foreground)" }
                    }
                  >
                    {t.status}
                  </span>
                </div>
                <button onClick={() => void toggleStatus(t)} title={t.status === "published" ? "Unpublish" : "Publish"}>
                  {t.status === "published" ? (
                    <EyeOff className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                  ) : (
                    <Eye className="w-4 h-4" style={{ color: "var(--primary)" }} />
                  )}
                </button>
                <button onClick={() => navigate({ name: "builder", templateId: t.id })} title="Edit">
                  <Pencil className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                </button>
                <button onClick={() => void remove(t)} title="Delete">
                  <Trash2 className="w-4 h-4" style={{ color: "var(--destructive)" }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
