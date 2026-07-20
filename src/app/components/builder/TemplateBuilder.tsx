import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ArrowLeft, Eye, Figma, Pencil, RefreshCw, Save, Send, Upload } from "lucide-react";
import type { CanvasPreset, DesignImportResult, NewTemplateInput, TemplateField, TemplateSchema } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { newId } from "@/lib/stores/local/db";
import { suggestFieldKey } from "@/lib/caption";
import { useRouter } from "../../router";
import { SchemaRenderer } from "../SchemaRenderer";
import { FieldOverlayEditor } from "./FieldOverlayEditor";
import { FieldInspector } from "./FieldInspector";
import { CaptionEditor } from "./CaptionEditor";
import { FigmaImportDialog } from "./FigmaImportDialog";
import { FigmaFieldPicker } from "./FigmaFieldPicker";
import { composeFigmaBackground } from "@/lib/figma/composeLayers";

/** Admin Template Builder: upload a PNG background, draw guarded fields on
 * it, write the caption merge template, publish. The manual path is the
 * reliable baseline; Figma import (when configured) just pre-fills the same
 * state for the admin to confirm. */
export function TemplateBuilder({ templateId }: { templateId: string | null }) {
  const { company } = useAuth();
  const { kit, locations } = useBrand();
  const { navigate } = useRouter();

  const [presets, setPresets] = useState<CanvasPreset[]>([]);
  const [loaded, setLoaded] = useState(templateId === null);
  const [savedId, setSavedId] = useState<string | null>(templateId);
  const [draft, setDraft] = useState<NewTemplateInput>(() => ({
    companyId: company?.id ?? "",
    name: "",
    description: "",
    category: "",
    tags: [],
    status: "draft",
    canvasWidth: 1440, // replaced by the selected preset on load — never trusted as a constant
    canvasHeight: 1440,
    backgroundUrl: "",
    fields: [],
    captionTemplate: "",
  }));
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [figmaOpen, setFigmaOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<DesignImportResult | null>(null);
  const [recomposing, setRecomposing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    stores.companies
      .listCanvasPresets()
      .then((list) => {
        setPresets(list);
        // v1: the creation picker is locked to the single enabled preset, but
        // dimensions always flow preset → schema → renderer/export.
        if (!templateId && list[0]) {
          setDraft((d) => ({ ...d, canvasWidth: list[0].width, canvasHeight: list[0].height }));
        }
      })
      .catch((e) => console.error("Preset load failed", e));
  }, [templateId]);

  useEffect(() => {
    if (!templateId) return;
    stores.templates
      .get(templateId)
      .then((t) => {
        if (t) {
          const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = t;
          setDraft(rest);
        }
      })
      .catch((e) => console.error("Template load failed", e))
      .finally(() => setLoaded(true));
  }, [templateId]);

  const selectedField = draft.fields.find((f) => f.id === selectedFieldId) ?? null;

  const setFields = useCallback(
    (fields: TemplateField[]) => setDraft((d) => ({ ...d, fields })),
    [],
  );

  const addField = (rect: { x: number; y: number; width: number; height: number }) => {
    const label = `Field ${draft.fields.length + 1}`;
    const field: TemplateField = {
      id: newId(),
      label,
      fieldKey: suggestFieldKey(label, draft.fields),
      type: "text",
      ...rect,
      fontFamily: kit?.headingFont?.family,
      fontSizePx: Math.max(18, Math.min(90, Math.round(rect.height * 0.55))),
      colorKey: kit?.colors.find((c) => c.key === "text")?.key ?? kit?.colors[0]?.key,
      align: "left",
      autoFit: true,
    };
    setFields([...draft.fields, field]);
    setSelectedFieldId(field.id);
  };

  const onDropBackground = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file || !company) return;
      setUploading(true);
      setError(null);
      try {
        const url = await stores.templates.uploadBackground(company.id, file, file.name);
        setDraft((d) => ({ ...d, backgroundUrl: url }));
      } catch (e) {
        console.error("Background upload failed", e);
        setError("Background upload failed — check your storage configuration.");
      } finally {
        setUploading(false);
      }
    },
    [company],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => void onDropBackground(files),
    accept: { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] },
    maxFiles: 1,
  });

  const save = async (status?: "draft" | "published") => {
    if (!company) return null;
    setSaving(true);
    setError(null);
    try {
      const payload: NewTemplateInput = {
        ...draft,
        companyId: company.id,
        status: status ?? draft.status,
        name: draft.name.trim() || "Untitled template",
      };
      const saved = savedId
        ? await stores.templates.update(savedId, payload)
        : await stores.templates.create(payload);
      setSavedId(saved.id);
      setDraft((d) => ({ ...d, status: saved.status }));
      return saved;
    } catch (e) {
      console.error("Save failed", e);
      setError(e instanceof Error ? e.message : "Save failed.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const previewSchema: TemplateSchema = useMemo(
    () => ({
      ...draft,
      id: savedId ?? "preview",
      createdAt: "",
      updatedAt: "",
    }),
    [draft, savedId],
  );

  if (!loaded) {
    return <p className="text-center py-24 text-sm" style={{ color: "var(--muted-foreground)" }}>Loading…</p>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {figmaOpen && (
        <FigmaImportDialog
          onClose={() => setFigmaOpen(false)}
          onImported={(result) => {
            setFigmaOpen(false);
            setPendingImport(result); // admin picks which elements become fields
          }}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => navigate({ name: "adminTemplates" })}
          style={{ fontSize: 13, color: "var(--fg-2)", display: "flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Templates
        </button>
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Template name"
          className="bg-transparent outline-none flex-1 min-w-[200px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 18, letterSpacing: "-0.3px", color: "var(--ink)" }}
        />
        <span
          className="sp-eyebrow px-2 py-1 rounded-md" style={{ background: "rgba(35,31,35,0.04)" }}
        >
          {draft.canvasWidth}×{draft.canvasHeight} · {draft.status}
          {recomposing ? " · lifting elements off background…" : ""}
        </span>
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--hairline-strong)" }}>
          {(["edit", "preview"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex items-center gap-1.5 px-3 py-2 capitalize"
              style={{
                fontSize: 12,
                ...(mode === m
                  ? { background: "var(--ink)", color: "var(--fg-on-dark-1)" }
                  : { background: "var(--lift)", color: "var(--fg-2)" }),
              }}
            >
              {m === "edit" ? <Pencil className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {m}
            </button>
          ))}
        </div>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="sp-btn sp-btn-ghost"
        >
          <Save className="w-3.5 h-3.5" />
          Save draft
        </button>
        <button
          onClick={() => void save("published")}
          disabled={saving || !draft.backgroundUrl || draft.fields.length === 0}
          className="sp-btn sp-btn-primary"
        >
          <Send className="w-3.5 h-3.5" />
          Publish
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm rounded-xl px-4 py-3" style={{ background: "#FBE9E9", color: "var(--destructive)" }}>
          {error}
        </p>
      )}

      {pendingImport ? (
        <FigmaFieldPicker
          result={pendingImport}
          kit={kit}
          onBack={() => setPendingImport(null)}
          onConfirm={(fields) => {
            const importResult = pendingImport;
            setDraft((d) => {
              const existing = [...d.fields];
              const merged = fields.map((f) => {
                const fieldKey = suggestFieldKey(f.label, existing);
                const next = { ...f, fieldKey };
                existing.push(next);
                return next;
              });
              return {
                ...d,
                backgroundUrl: importResult.backgroundUrl,
                canvasWidth: importResult.canvasWidth,
                canvasHeight: importResult.canvasHeight,
                fields: [...d.fields, ...merged],
              };
            });
            setPendingImport(null);
            setMode("edit");
            // Lift the chosen elements OFF the background: re-render the frame
            // without them and swap in the recomposed PNG. On any failure the
            // flat render stays (fields overlay their baked twins).
            const excludeIds = fields
              .map((f) => f.sourceNodeId)
              .filter((id): id is string => Boolean(id));
            if (company && importResult.sourceUrl && excludeIds.length) {
              setRecomposing(true);
              void (async () => {
                try {
                  const layers = await stores.designImport.renderLayers(
                    company.id,
                    importResult.sourceUrl!,
                    excludeIds,
                  );
                  const blob = await composeFigmaBackground(layers);
                  const bgUrl = await stores.templates.uploadBackground(
                    company.id,
                    blob,
                    "figma-composed.png",
                  );
                  setDraft((d) => ({ ...d, backgroundUrl: bgUrl }));
                  if (layers.warnings.length) {
                    setError(layers.warnings.join(" "));
                  }
                } catch (e) {
                  console.error("Background recomposition failed", e);
                  setError(
                    "Couldn't lift the selected elements off the background — the flat Figma render is in use, so fields may overlap their original artwork. " +
                      (e instanceof Error ? e.message : ""),
                  );
                } finally {
                  setRecomposing(false);
                }
              })();
            }
          }}
        />
      ) : !draft.backgroundUrl ? (
        /* Step 1: two co-equal creation paths */
        <div className="max-w-3xl mx-auto py-10 space-y-5">
          <div className="text-center space-y-1 mb-2">
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 18, letterSpacing: "-0.3px", color: "var(--ink)" }}>
              Start with your design
            </h2>
            <p style={{ fontSize: 13, color: "var(--fg-2)" }}>
              Two ways in — both end at the same place: locked design, editable fields.
              {presets[0] && ` Canvas: ${presets[0].label}.`}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
            {/* Path A — PNG upload */}
            <div
              {...getRootProps()}
              className="border-dashed p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
              style={{
                border: `1.5px dashed ${isDragActive ? "var(--solar)" : "var(--hairline-strong)"}`,
                borderRadius: "var(--radius-card-sm)",
                background: isDragActive ? "rgba(255,63,0,0.05)" : "var(--lift)",
                minHeight: 220,
              }}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "var(--solar)" }} />
              ) : (
                <Upload className="w-6 h-6" style={{ color: "var(--solar)" }} />
              )}
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>Upload a PNG</p>
              <p style={{ fontSize: 12, color: "var(--fg-2)", maxWidth: 240 }}>
                {uploading
                  ? "Uploading…"
                  : "Drop a finished design here, then draw the editable areas on top of it."}
              </p>
            </div>
            {/* Path B — Figma link */}
            <button
              onClick={() => stores.designImport.isConfigured() && setFigmaOpen(true)}
              disabled={!stores.designImport.isConfigured()}
              className="p-8 text-center transition-all flex flex-col items-center justify-center gap-3"
              style={{
                border: "1.5px dashed var(--hairline-strong)",
                borderRadius: "var(--radius-card-sm)",
                background: "var(--lift)",
                minHeight: 220,
                cursor: stores.designImport.isConfigured() ? "pointer" : "default",
                opacity: stores.designImport.isConfigured() ? 1 : 0.55,
              }}
            >
              <Figma className="w-6 h-6" style={{ color: "var(--solar)" }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>Import from Figma</p>
              <p style={{ fontSize: 12, color: "var(--fg-2)", maxWidth: 240 }}>
                {stores.designImport.isConfigured()
                  ? "Paste a frame link — pick which elements become editable fields; the rest is baked into the locked design."
                  : "Requires the Supabase backend with the Figma connection configured (see docs/ARCHITECTURE.md)."}
              </p>
            </button>
          </div>
        </div>
      ) : (
        /* Step 2+: mapping, caption, details */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="sp-card p-4">
              {mode === "edit" ? (
                <>
                  <p className="mb-3" style={{ fontSize: 12, color: "var(--fg-3)" }}>
                    Drag on the image to draw a field box. Drag boxes to move; corner handle resizes.
                  </p>
                  <FieldOverlayEditor
                    canvasWidth={draft.canvasWidth}
                    canvasHeight={draft.canvasHeight}
                    backgroundUrl={draft.backgroundUrl}
                    fields={draft.fields}
                    selectedId={selectedFieldId}
                    onSelect={setSelectedFieldId}
                    onChange={setFields}
                    onDraw={addField}
                  />
                </>
              ) : (
                <SchemaRenderer
                  schema={previewSchema}
                  values={{}}
                  brandKit={kit}
                  locations={locations}
                  instrument={false}
                />
              )}
            </div>
            {stores.designImport.isConfigured() && mode === "edit" && (
              <button
                onClick={() => setFigmaOpen(true)}
                style={{ fontSize: 12, color: "var(--fg-2)", display: "flex", alignItems: "center", gap: 6 }}
              >
                <Figma className="w-3.5 h-3.5" />
                Import fields from Figma
              </button>
            )}
          </div>

          <div className="lg:col-span-5 space-y-4">
            {selectedField ? (
              <div className="sp-card p-4">
                <FieldInspector
                  field={selectedField}
                  allFields={draft.fields}
                  onChange={(patch) =>
                    setFields(draft.fields.map((f) => (f.id === selectedField.id ? { ...f, ...patch } : f)))
                  }
                  onDelete={() => {
                    setFields(draft.fields.filter((f) => f.id !== selectedField.id));
                    setSelectedFieldId(null);
                  }}
                />
              </div>
            ) : (
              <div
                className="p-6 text-center"
                style={{ border: "1.5px dashed var(--hairline-strong)", borderRadius: 12, fontSize: 13, color: "var(--fg-3)" }}
              >
                {draft.fields.length === 0
                  ? "Draw your first field box on the image."
                  : "Select a field box to edit its settings."}
              </div>
            )}

            <div className="sp-card p-4 space-y-3">
              <h3 className="sp-panel-title">Suggested caption</h3>
              <CaptionEditor
                value={draft.captionTemplate}
                fields={draft.fields}
                onChange={(captionTemplate) => setDraft((d) => ({ ...d, captionTemplate }))}
              />
            </div>

            <div className="sp-card p-4 space-y-3">
              <h3 className="sp-panel-title">Details</h3>
              <input
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Short description shown on the portal card"
                className="sp-input"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={draft.category}
                  onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                  placeholder="Category"
                  className="sp-input"
                />
                <input
                  value={draft.tags.join(", ")}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                    }))
                  }
                  placeholder="Tags (comma-separated)"
                  className="sp-input"
                />
              </div>
              <label
                className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 12, color: "var(--fg-2)" }}
              >
                <Upload className="w-3.5 h-3.5" />
                Replace background PNG
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onDropBackground([f]);
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
