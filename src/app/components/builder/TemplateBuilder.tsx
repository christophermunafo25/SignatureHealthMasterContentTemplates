import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Figma,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  Upload,
} from "lucide-react";
import type {
  CanvasPreset,
  DesignImportResult,
  FieldType,
  NewTemplateInput,
  TemplateField,
  TemplateSchema,
} from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { newId } from "@/lib/stores/local/db";
import { retagCaption, suggestFieldKey } from "@/lib/caption";
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning";
import { useRouter } from "../../router";
import { ColorControl } from "../ColorControl";
import { SchemaRenderer, schemaBackgroundCss } from "../SchemaRenderer";
import { GradientEditor } from "./GradientEditor";
import { FieldOverlayEditor } from "./FieldOverlayEditor";
import { FieldInspector } from "./FieldInspector";
import { CaptionEditor } from "./CaptionEditor";
import { FigmaImportDialog } from "./FigmaImportDialog";
import { FigmaFieldPicker } from "./FigmaFieldPicker";
import { ElementPalette } from "./ElementPalette";
import { FieldListPanel } from "./FieldListPanel";
import { FieldContextMenu, type MenuAction } from "./FieldContextMenu";
import { WIZARD_STEPS, WizardStepper, type WizardStep } from "./WizardStepper";
import {
  PALETTE_ITEMS,
  clipboardHasFields,
  copyToClipboard,
  duplicateFields,
  fieldFromPalette,
  isTypingTarget,
  pasteFromClipboard,
  setLayerOrder,
} from "./fieldOps";
import { composeFigmaBackground } from "@/lib/figma/composeLayers";

/** Admin Template Builder: a guided wizard. Pick the source (PNG upload or
 * Figma import), then Step 1 Name → Step 2 Fields (element palette + canvas +
 * field list + inspector) → Step 3 Caption (optional) → Step 4 Tags & details
 * (optional) → Publish. Save draft is available at every step; completed
 * steps are jumpable from the persistent progress indicator. */
export function TemplateBuilder({ templateId }: { templateId: string | null }) {
  const { company } = useAuth();
  const { kit } = useBrand();
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /** True once a creation path was chosen — "Start blank" needs no
   * background, so backgroundUrl alone can't gate the wizard anymore. */
  const [started, setStarted] = useState<boolean>(Boolean(templateId));
  const [step, setStep] = useState<WizardStep>("name");
  const [visited, setVisited] = useState<Set<WizardStep>>(() => new Set(["name"]));
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [figmaOpen, setFigmaOpen] = useState(false);
  /** Snapshot of the last loaded/saved draft — anything else is unsaved. */
  const savedSnapshotRef = useRef<string>("");
  const [pendingImport, setPendingImport] = useState<DesignImportResult | null>(null);
  const [recomposing, setRecomposing] = useState(false);
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  /** Field whose label should open for naming (a just-added element);
   * cleared as soon as the selection moves elsewhere. */
  const [focusLabelFieldId, setFocusLabelFieldId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    fieldId: string | null;
    canvasPoint: { x: number; y: number };
  } | null>(null);

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
          savedSnapshotRef.current = JSON.stringify(rest);
          // Editing an existing template: every step is already completed.
          setVisited(new Set<WizardStep>(["name", "fields", "caption", "details"]));
          setStep("fields");
        }
      })
      .catch((e) => console.error("Template load failed", e))
      .finally(() => setLoaded(true));
  }, [templateId]);

  const sourceChosen = started || Boolean(draft.backgroundUrl);
  const nameComplete = Boolean(draft.name.trim());
  const fieldsComplete = draft.fields.length > 0;

  const complete = useMemo(() => {
    const s = new Set<WizardStep>();
    if (nameComplete) s.add("name");
    if (fieldsComplete) s.add("fields");
    if (visited.has("caption")) s.add("caption");
    if (visited.has("details")) s.add("details");
    return s;
  }, [nameComplete, fieldsComplete, visited]);

  const canGo = useCallback(
    (target: WizardStep): boolean => {
      if (!sourceChosen) return false;
      if (target === "name") return true;
      if (!nameComplete) return false;
      if (target === "fields") return true;
      return fieldsComplete;
    },
    [sourceChosen, nameComplete, fieldsComplete],
  );

  const goTo = useCallback((target: WizardStep) => {
    setStep(target);
    setVisited((v) => new Set(v).add(target));
    setMenu(null);
  }, []);

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === step);
  const nextStep = WIZARD_STEPS[stepIndex + 1]?.key;
  const prevStep = WIZARD_STEPS[stepIndex - 1]?.key;

  // -------------------------------------------------------------------------
  // Field operations
  // -------------------------------------------------------------------------

  const setFields = useCallback(
    (fields: TemplateField[]) => setDraft((d) => ({ ...d, fields })),
    [],
  );

  const selectedFields = draft.fields.filter((f) => selectedIds.includes(f.id));
  const singleSelected = selectedFields.length === 1 ? selectedFields[0] : null;

  /** Patch one field; when the patch re-derives the merge tag, rewrite the
   * caption template so existing {old_key} references follow the rename. */
  const patchField = useCallback((id: string, patch: Partial<TemplateField>) => {
    setDraft((d) => {
      const prev = d.fields.find((f) => f.id === id);
      const fields = d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f));
      const captionTemplate =
        prev && patch.fieldKey && patch.fieldKey !== prev.fieldKey
          ? retagCaption(d.captionTemplate, prev.fieldKey, patch.fieldKey)
          : d.captionTemplate;
      return { ...d, fields, captionTemplate };
    });
  }, []);

  const maxZ = (fields: TemplateField[]) => fields.reduce((m, f) => Math.max(m, f.zIndex ?? 0), 0);

  /** Secondary path: a raw drawn box becomes a text field. */
  const addDrawnField = (rect: { x: number; y: number; width: number; height: number }) => {
    const label = `Field ${draft.fields.length + 1}`;
    const field: TemplateField = {
      id: newId(),
      label,
      fieldKey: suggestFieldKey(label, draft.fields),
      type: "text",
      ...rect,
      zIndex: maxZ(draft.fields) + 1,
      fontFamily: kit?.headingFont?.family,
      fontSizePx: Math.max(18, Math.min(90, Math.round(rect.height * 0.55))),
      colorKey: kit?.colors.find((c) => c.key === "text")?.key ?? kit?.colors[0]?.key,
      align: "left",
      autoFit: true,
    };
    setFields([...draft.fields, field]);
    setSelectedIds([field.id]);
    setFocusLabelFieldId(field.id);
  };

  /** Primary path: a palette element dropped (or clicked) onto the canvas —
   * pre-sized, pre-typed, and immediately open for naming. */
  const addPaletteField = (type: FieldType, at?: { x: number; y: number }) => {
    const item = PALETTE_ITEMS.find((p) => p.type === type);
    if (!item) return;
    const point = at ?? { x: draft.canvasWidth / 2, y: draft.canvasHeight / 2 };
    const field = fieldFromPalette(item, point, draft.fields, kit, {
      width: draft.canvasWidth,
      height: draft.canvasHeight,
    });
    setFields([...draft.fields, field]);
    setSelectedIds([field.id]);
    setFocusLabelFieldId(field.id);
  };

  // The naming focus applies only while the just-added field stays the sole
  // selection; any other selection clears it.
  useEffect(() => {
    if (!focusLabelFieldId) return;
    if (selectedIds.length !== 1 || selectedIds[0] !== focusLabelFieldId) {
      setFocusLabelFieldId(null);
    }
  }, [selectedIds, focusLabelFieldId]);

  const deleteFields = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      const idSet = new Set(ids);
      setDraft((d) => ({ ...d, fields: d.fields.filter((f) => !idSet.has(f.id)) }));
      setSelectedIds((sel) => sel.filter((id) => !idSet.has(id)));
    },
    [],
  );

  const copyFields = useCallback(
    (ids: string[]) => copyToClipboard(draft.fields.filter((f) => ids.includes(f.id))),
    [draft.fields],
  );

  const cutFields = useCallback(
    (ids: string[]) => {
      copyFields(ids);
      deleteFields(ids);
    },
    [copyFields, deleteFields],
  );

  const pasteFields = useCallback(
    (at?: { x: number; y: number }) => {
      const pasted = pasteFromClipboard(draft.fields, at);
      if (!pasted.length) return;
      setFields([...draft.fields, ...pasted]);
      setSelectedIds(pasted.map((f) => f.id));
    },
    [draft.fields, setFields],
  );

  const duplicateSelected = useCallback(
    (ids: string[]) => {
      const targets = draft.fields.filter((f) => ids.includes(f.id));
      const dups = duplicateFields(targets, draft.fields);
      if (!dups.length) return;
      setFields([...draft.fields, ...dups]);
      setSelectedIds(dups.map((f) => f.id));
    },
    [draft.fields, setFields],
  );

  const reorderLayer = useCallback(
    (ids: string[], where: "front" | "back") => setFields(setLayerOrder(draft.fields, ids, where)),
    [draft.fields, setFields],
  );

  // Keyboard shortcuts on the Fields step: ⌘/Ctrl C, X, V, D, Delete, Escape.
  // Never fire while typing in an input.
  useEffect(() => {
    if (step !== "fields" || mode !== "edit") return;
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "c" && selectedIds.length) {
        e.preventDefault();
        copyFields(selectedIds);
      } else if (mod && key === "x" && selectedIds.length) {
        e.preventDefault();
        cutFields(selectedIds);
      } else if (mod && key === "v" && clipboardHasFields()) {
        e.preventDefault();
        pasteFields();
      } else if (mod && key === "d" && selectedIds.length) {
        e.preventDefault();
        duplicateSelected(selectedIds);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length) {
        e.preventDefault();
        deleteFields(selectedIds);
      } else if (e.key === "Escape") {
        setSelectedIds([]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, mode, selectedIds, copyFields, cutFields, pasteFields, duplicateSelected, deleteFields]);

  // -------------------------------------------------------------------------
  // Source, save, publish
  // -------------------------------------------------------------------------

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
      setDraft((d) => {
        const next = { ...d, status: saved.status };
        savedSnapshotRef.current = JSON.stringify(next);
        return next;
      });
      return saved;
    } catch (e) {
      console.error("Save failed", e);
      setError(e instanceof Error ? e.message : "Save failed.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Warn on close/reload while the draft differs from what's saved.
  const dirty =
    Boolean(draft.backgroundUrl || draft.fields.length || draft.name.trim()) &&
    JSON.stringify(draft) !== savedSnapshotRef.current;
  useUnsavedChangesWarning(dirty);

  /** Publish: processing indicator → success marker → back to the Builder
   * page (create new / edit existing). */
  const publish = async () => {
    setPublishState("publishing");
    const saved = await save("published");
    if (!saved) {
      setPublishState("idle"); // save() already surfaced the error
      return;
    }
    setPublishState("success");
    window.setTimeout(() => navigate({ name: "adminTemplates" }), 1400);
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

  // -------------------------------------------------------------------------
  // Context menu actions
  // -------------------------------------------------------------------------

  const menuActions: MenuAction[] = useMemo(() => {
    if (!menu) return [];
    if (menu.fieldId === null) {
      return [
        {
          label: "Paste here",
          shortcut: "⌘V",
          disabled: !clipboardHasFields(),
          onSelect: () => pasteFields(menu.canvasPoint),
        },
      ];
    }
    const ids = selectedIds.includes(menu.fieldId) ? selectedIds : [menu.fieldId];
    return [
      { label: "Copy", shortcut: "⌘C", onSelect: () => copyFields(ids) },
      { label: "Cut", shortcut: "⌘X", onSelect: () => cutFields(ids) },
      {
        label: "Paste",
        shortcut: "⌘V",
        disabled: !clipboardHasFields(),
        onSelect: () => pasteFields(),
      },
      { label: "Duplicate", shortcut: "⌘D", onSelect: () => duplicateSelected(ids) },
      { label: "Bring to front", onSelect: () => reorderLayer(ids, "front") },
      { label: "Send to back", onSelect: () => reorderLayer(ids, "back") },
      { label: "Delete", shortcut: "⌫", destructive: true, onSelect: () => deleteFields(ids) },
    ];
  }, [menu, selectedIds, copyFields, cutFields, pasteFields, duplicateSelected, reorderLayer, deleteFields]);

  if (!loaded) {
    return <p className="text-center py-24 text-sm" style={{ color: "var(--muted-foreground)" }}>Loading…</p>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {publishState !== "idle" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(26,23,26,0.55)", backdropFilter: "blur(2px)" }}
          role="status"
          aria-live="polite"
        >
          <div
            className="w-full max-w-xs p-7 text-center space-y-3"
            style={{ background: "var(--lift)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-e4)" }}
          >
            {publishState === "publishing" ? (
              <>
                <RefreshCw
                  className="animate-spin mx-auto"
                  style={{ width: 28, height: 28, color: "var(--solar)" }}
                />
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase" as const, fontSize: 17, color: "var(--ink)" }}>
                  Publishing…
                </p>
                <p style={{ fontSize: 12, color: "var(--fg-3)" }}>
                  Saving "{draft.name.trim() || "Untitled template"}" and making it live for your team.
                </p>
              </>
            ) : (
              <>
                <span
                  className="mx-auto flex items-center justify-center"
                  style={{ width: 44, height: 44, borderRadius: 999, background: "var(--mint)" }}
                >
                  <Check style={{ width: 22, height: 22, color: "var(--ink)" }} />
                </span>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase" as const, fontSize: 17, color: "var(--ink)" }}>
                  Template published
                </p>
                <p style={{ fontSize: 12, color: "var(--fg-3)" }}>
                  "{draft.name.trim() || "Untitled template"}" is live. Taking you back to the
                  Builder…
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {figmaOpen && (
        <FigmaImportDialog
          onClose={() => setFigmaOpen(false)}
          onImported={(result) => {
            setFigmaOpen(false);
            setPendingImport(result); // admin picks which elements become fields
          }}
        />
      )}

      {menu && (
        <FieldContextMenu x={menu.x} y={menu.y} actions={menuActions} onClose={() => setMenu(null)} />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => navigate({ name: "adminTemplates" })}
          style={{ fontSize: 13, color: "var(--fg-2)", display: "flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Builder
        </button>
        <span
          className="flex-1 min-w-[200px] truncate"
          style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase" as const, fontSize: 18, letterSpacing: "-0.3px", color: draft.name.trim() ? "var(--ink)" : "var(--fg-4)" }}
        >
          {draft.name.trim() || "Untitled template"}
        </span>
        <span
          className="sp-eyebrow px-2 py-1 rounded-md" style={{ background: "rgba(35,31,35,0.04)" }}
        >
          {draft.canvasWidth}×{draft.canvasHeight} · {draft.status}
          {recomposing ? " · lifting elements off background…" : ""}
        </span>
        {sourceChosen && (
          <button onClick={() => void save()} disabled={saving} className="sp-btn sp-btn-ghost">
            <Save className="w-3.5 h-3.5" />
            Save draft
          </button>
        )}
      </div>

      {error && (
        <p className="mb-4 text-sm rounded-xl px-4 py-3" style={{ background: "var(--fill-danger-bg)", color: "var(--destructive)" }}>
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
              let z = maxZ(existing);
              const merged = fields.map((f) => {
                const fieldKey = suggestFieldKey(f.label, existing);
                const next = { ...f, fieldKey, zIndex: ++z };
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
            // A brand-new import starts at Step 1 (Name); an existing
            // template that pulled in more fields goes straight to Fields.
            goTo(draft.name.trim() ? "fields" : "name");
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
      ) : !sourceChosen ? (
        /* Source pick: two co-equal creation paths */
        <div className="max-w-3xl mx-auto py-10 space-y-5">
          <div className="text-center space-y-1 mb-2">
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase" as const, fontSize: 18, letterSpacing: "-0.3px", color: "var(--ink)" }}>
              Start your template
            </h2>
            <p style={{ fontSize: 13, color: "var(--fg-2)" }}>
              Build from scratch, or import a designed frame — both end at the
              same place: locked design, editable fields.
              {presets[0] && ` Canvas: ${presets[0].label}.`}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
            {/* Path A — blank canvas */}
            <button
              onClick={() => {
                setStarted(true);
                goTo("name");
              }}
              className="p-8 text-center transition-all flex flex-col items-center justify-center gap-3"
              style={{
                border: "1.5px dashed var(--hairline-strong)",
                borderRadius: "var(--radius-card-sm)",
                background: "var(--lift)",
                minHeight: 220,
                cursor: "pointer",
              }}
            >
              <Plus className="w-6 h-6" style={{ color: "var(--solar)" }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>Start blank</p>
              <p style={{ fontSize: 12, color: "var(--fg-2)", maxWidth: 240 }}>
                Build the design from scratch on an empty canvas — drag on
                text, images, and fixed elements.
              </p>
            </button>
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
        <>
          <WizardStepper current={step} complete={complete} canGo={canGo} onGo={goTo} />

          {step === "name" && (
            <div className="max-w-xl mx-auto py-8">
              <div className="sp-card p-6 space-y-4">
                <div className="space-y-1">
                  <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase" as const, fontSize: 18, letterSpacing: "-0.3px", color: "var(--ink)" }}>
                    What should this template be called?
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--fg-2)" }}>
                    Members see this name in their template gallery. You'll name
                    each editable field next — field names become the caption's
                    merge tags.
                  </p>
                </div>
                <input
                  autoFocus
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nameComplete) goTo("fields");
                  }}
                  placeholder="e.g. Employee anniversary post"
                  className="sp-input"
                  style={{ fontSize: 16, padding: "12px 14px" }}
                />
              </div>
            </div>
          )}

          {step === "fields" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-3 space-y-4 w-full max-w-xl mx-auto lg:max-w-none">
                {mode === "edit" && <ElementPalette onAdd={(type) => addPaletteField(type)} />}
                <FieldListPanel
                  fields={draft.fields}
                  selectedIds={selectedIds}
                  onSelect={setSelectedIds}
                  onReorder={setFields}
                  onContextMenu={(e, fieldId) => {
                    e.preventDefault();
                    if (!selectedIds.includes(fieldId)) setSelectedIds([fieldId]);
                    setMenu({ x: e.clientX, y: e.clientY, fieldId, canvasPoint: { x: 0, y: 0 } });
                  }}
                />
              </div>

              <div className="lg:col-span-5 space-y-3 w-full max-w-xl mx-auto lg:max-w-none">
                <div className="sp-card p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap-reverse mb-3">
                    <p style={{ fontSize: 12, color: "var(--fg-3)", flex: "1 1 260px", minWidth: 0 }}>
                      {mode === "edit"
                        ? "Drag elements from the palette onto the canvas. Drag to move, handles resize, top handle rotates. Right-click for copy/paste."
                        : "Member preview — placeholder content, locked styling."}
                    </p>
                    <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid var(--hairline-strong)" }}>
                      {(["edit", "preview"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          className="flex items-center gap-1.5 px-3 py-1.5 capitalize"
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
                  </div>
                  {mode === "edit" ? (
                    <FieldOverlayEditor
                      canvasWidth={draft.canvasWidth}
                      canvasHeight={draft.canvasHeight}
                      backgroundUrl={draft.backgroundUrl}
                      backgroundCss={schemaBackgroundCss(draft)}
                      fields={draft.fields}
                      selectedIds={selectedIds}
                      onSelect={setSelectedIds}
                      onChange={setFields}
                      onDraw={addDrawnField}
                      onDropElement={(type, at) => addPaletteField(type, at)}
                      onContextMenu={(pos, fieldId, canvasPoint) =>
                        setMenu({ x: pos.x, y: pos.y, fieldId, canvasPoint })
                      }
                    />
                  ) : (
                    <SchemaRenderer
                      schema={previewSchema}
                      values={{}}
                      brandKit={kit}
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
                    Import more fields from Figma
                  </button>
                )}
              </div>

              <div className="lg:col-span-4 space-y-4 w-full max-w-xl mx-auto lg:max-w-none">
                {singleSelected ? (
                  <div className="sp-card p-4">
                    <FieldInspector
                      field={singleSelected}
                      allFields={draft.fields}
                      canvasWidth={draft.canvasWidth}
                      canvasHeight={draft.canvasHeight}
                      focusLabelFieldId={focusLabelFieldId}
                      onChange={(patch) => patchField(singleSelected.id, patch)}
                      onDelete={() => deleteFields([singleSelected.id])}
                      onBringToFront={() => reorderLayer([singleSelected.id], "front")}
                      onSendToBack={() => reorderLayer([singleSelected.id], "back")}
                    />
                  </div>
                ) : selectedFields.length > 1 ? (
                  <div className="sp-card p-4 space-y-3">
                    <h3 className="sp-panel-title">{selectedFields.length} fields selected</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="sp-btn sp-btn-ghost" onClick={() => copyFields(selectedIds)}>Copy</button>
                      <button className="sp-btn sp-btn-ghost" onClick={() => duplicateSelected(selectedIds)}>Duplicate</button>
                      <button className="sp-btn sp-btn-ghost" onClick={() => reorderLayer(selectedIds, "front")}>To front</button>
                      <button className="sp-btn sp-btn-ghost" onClick={() => reorderLayer(selectedIds, "back")}>To back</button>
                    </div>
                    <button
                      className="sp-btn sp-btn-ghost w-full"
                      style={{ color: "var(--destructive)" }}
                      onClick={() => deleteFields(selectedIds)}
                    >
                      Delete {selectedFields.length} fields
                    </button>
                  </div>
                ) : (
                  <div className="sp-card p-4 space-y-4">
                    <h3 className="sp-panel-title">Canvas</h3>
                    <p style={{ fontSize: 12, color: "var(--fg-3)" }}>
                      {draft.fields.length === 0
                        ? "Drag your first element from the palette onto the canvas. Style the template background below."
                        : "Select a field to edit it — or style the template background here."}
                    </p>
                    <div className="space-y-2">
                      <label className="sp-eyebrow block">Background color</label>
                      <ColorControl
                        ariaLabel="Template background color"
                        value={draft.backgroundColor ?? "#ffffff"}
                        onChange={(hex) => setDraft((d) => ({ ...d, backgroundColor: hex }))}
                      />
                    </div>
                    <GradientEditor
                      label="Gradient background"
                      gradient={draft.backgroundGradient}
                      defaultStops={[
                        { position: 0, color: kit?.colors[0]?.hex ?? "#CAFF5F" },
                        { position: 1, color: kit?.colors[1]?.hex ?? "#122407" },
                      ]}
                      onChange={(backgroundGradient) => setDraft((d) => ({ ...d, backgroundGradient }))}
                    />
                    <div className="space-y-2">
                      <label className="sp-eyebrow block">Background image</label>
                      <label
                        className="flex items-center justify-center gap-2 cursor-pointer py-2.5"
                        style={{
                          border: "1.5px dashed var(--hairline-strong)",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "var(--fg-2)",
                        }}
                      >
                        {uploading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--solar)" }} />
                        ) : (
                          <Upload className="w-3.5 h-3.5" style={{ color: "var(--solar)" }} />
                        )}
                        {uploading ? "Uploading…" : draft.backgroundUrl ? "Replace image" : "Upload image"}
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
                      {draft.backgroundUrl && (
                        <button
                          onClick={() => setDraft((d) => ({ ...d, backgroundUrl: "" }))}
                          style={{ fontSize: 11, color: "var(--destructive)" }}
                        >
                          Remove image
                        </button>
                      )}
                      <p style={{ fontSize: 10.5, color: "var(--fg-4)" }}>
                        An image covers the gradient, which covers the color.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "caption" && (
            <div className="max-w-2xl mx-auto py-8">
              <div className="sp-card p-6 space-y-4">
                <div className="space-y-1">
                  <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase" as const, fontSize: 18, letterSpacing: "-0.3px", color: "var(--ink)" }}>
                    Suggested caption
                    <span style={{ fontSize: 12, color: "var(--fg-4)", fontWeight: 400 }}> · optional</span>
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--fg-2)" }}>
                    Members get this caption next to the finished graphic, with
                    the tags filled from what they typed. Click a tag chip to
                    insert it.
                  </p>
                </div>
                <CaptionEditor
                  value={draft.captionTemplate}
                  fields={draft.fields}
                  onChange={(captionTemplate) => setDraft((d) => ({ ...d, captionTemplate }))}
                />
              </div>
            </div>
          )}

          {step === "details" && (
            <div className="max-w-2xl mx-auto py-8 space-y-4">
              <div className="sp-card p-6 space-y-4">
                <div className="space-y-1">
                  <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase" as const, fontSize: 18, letterSpacing: "-0.3px", color: "var(--ink)" }}>
                    Tags & details
                    <span style={{ fontSize: 12, color: "var(--fg-4)", fontWeight: 400 }}> · optional</span>
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--fg-2)" }}>
                    Shown on the template's card in the members' gallery.
                  </p>
                </div>
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
                  {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploading
                    ? "Uploading…"
                    : draft.backgroundUrl
                      ? "Replace background PNG"
                      : "Add a background PNG (optional)"}
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
              <div className="sp-card p-6 space-y-3">
                <p style={{ fontSize: 13, color: "var(--fg-2)" }}>
                  "{draft.name.trim() || "Untitled template"}" · {draft.fields.length} field
                  {draft.fields.length !== 1 ? "s" : ""} ·{" "}
                  {draft.captionTemplate ? "caption set" : "no caption"}
                </p>
                <button
                  onClick={() => void publish()}
                  disabled={saving || publishState !== "idle" || draft.fields.length === 0}
                  className="sp-btn sp-btn-primary w-full"
                  style={{ padding: "11px 14px" }}
                >
                  <Send className="w-3.5 h-3.5" />
                  {draft.status === "published" ? "Publish changes" : "Publish template"}
                </button>
              </div>
            </div>
          )}

          {/* Back / Next */}
          <div className="flex items-center justify-between mt-6">
            {prevStep ? (
              <button onClick={() => goTo(prevStep)} className="sp-btn sp-btn-ghost">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            ) : (
              <span />
            )}
            {nextStep && (
              <button
                onClick={() => goTo(nextStep)}
                disabled={!canGo(nextStep)}
                className="sp-btn sp-btn-primary"
              >
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
