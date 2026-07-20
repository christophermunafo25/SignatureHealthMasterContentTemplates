import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ArrowLeft, Eye, Figma, Pencil, RefreshCw, Save, Send, Upload } from "lucide-react";
import type { CanvasPreset, NewTemplateInput, TemplateField, TemplateSchema } from "@/lib/types";
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
            setDraft((d) => ({
              ...d,
              backgroundUrl: result.backgroundUrl,
              canvasWidth: result.canvasWidth,
              canvasHeight: result.canvasHeight,
              fields: [...d.fields, ...result.suggestedFields],
            }));
            setFigmaOpen(false);
          }}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => navigate({ name: "adminTemplates" })}
          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Templates
        </button>
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Template name"
          className="font-extrabold text-lg bg-transparent outline-none flex-1 min-w-[200px]"
          style={{ color: "var(--foreground)" }}
        />
        <span
          className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
          style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
        >
          {draft.canvasWidth}×{draft.canvasHeight} · {draft.status}
        </span>
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          {(["edit", "preview"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-2"
              style={
                mode === m
                  ? { background: "var(--primary)", color: "var(--primary-foreground)" }
                  : { background: "white", color: "var(--muted-foreground)" }
              }
            >
              {m === "edit" ? <Pencil className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {m}
            </button>
          ))}
        </div>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="flex items-center gap-2 font-bold uppercase text-[11px] tracking-wider px-4 py-2.5 rounded-xl border-2 disabled:opacity-50"
          style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
        >
          <Save className="w-3.5 h-3.5" />
          Save draft
        </button>
        <button
          onClick={() => void save("published")}
          disabled={saving || !draft.backgroundUrl || draft.fields.length === 0}
          className="flex items-center gap-2 font-bold uppercase text-[11px] tracking-wider px-4 py-2.5 rounded-xl shadow-md disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
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

      {!draft.backgroundUrl ? (
        /* Step 1: background */
        <div className="max-w-xl mx-auto py-10 space-y-4">
          <div className="text-center space-y-1 mb-2">
            <h2 className="font-extrabold uppercase text-base" style={{ color: "var(--foreground)" }}>
              Start with your design
            </h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Upload a PNG of the finished design — you'll map the editable areas on top of it.
              {presets[0] && ` Canvas: ${presets[0].label}.`}
            </p>
          </div>
          <div
            {...getRootProps()}
            className="border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all flex flex-col items-center gap-3"
            style={{
              borderColor: isDragActive ? "var(--primary)" : "var(--border)",
              background: isDragActive ? "var(--secondary)" : "white",
            }}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
            ) : (
              <Upload className="w-6 h-6" style={{ color: "var(--primary)" }} />
            )}
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
              {uploading ? "Uploading…" : "Click or drag a PNG here"}
            </p>
          </div>
          {stores.designImport.isConfigured() && (
            <button
              onClick={() => setFigmaOpen(true)}
              className="w-full flex items-center justify-center gap-2 border-2 font-bold uppercase text-xs tracking-[0.18em] py-3.5 rounded-xl"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <Figma className="w-4 h-4" />
              Import from Figma instead
            </button>
          )}
        </div>
      ) : (
        /* Step 2+: mapping, caption, details */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border p-4" style={{ borderColor: "var(--border)" }}>
              {mode === "edit" ? (
                <>
                  <p className="text-[11px] mb-3" style={{ color: "var(--muted-foreground)" }}>
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
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Figma className="w-3.5 h-3.5" />
                Import fields from Figma
              </button>
            )}
          </div>

          <div className="lg:col-span-5 space-y-4">
            {selectedField ? (
              <div className="bg-white rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
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
                className="rounded-2xl border-2 border-dashed p-6 text-center text-sm"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >
                {draft.fields.length === 0
                  ? "Draw your first field box on the image."
                  : "Select a field box to edit its settings."}
              </div>
            )}

            <div className="bg-white rounded-2xl border p-5 space-y-3" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-extrabold uppercase text-sm" style={{ color: "var(--foreground)" }}>
                Suggested caption
              </h3>
              <CaptionEditor
                value={draft.captionTemplate}
                fields={draft.fields}
                onChange={(captionTemplate) => setDraft((d) => ({ ...d, captionTemplate }))}
              />
            </div>

            <div className="bg-white rounded-2xl border p-5 space-y-3" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-extrabold uppercase text-sm" style={{ color: "var(--foreground)" }}>Details</h3>
              <input
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Short description shown on the portal card"
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--border)", background: "var(--input-background)", color: "var(--foreground)" }}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={draft.category}
                  onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                  placeholder="Category"
                  className="rounded-xl border px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--input-background)", color: "var(--foreground)" }}
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
                  className="rounded-xl border px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--input-background)", color: "var(--foreground)" }}
                />
              </div>
              <label
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider cursor-pointer"
                style={{ color: "var(--muted-foreground)" }}
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
