// Shared field operations for the Template Builder's Fields step: palette
// element defaults, canvas layer (z) ordering, and the copy/paste clipboard.
// The fields ARRAY order is the member form order; paint order is zIndex —
// two separate concerns, never conflated.

import type { BrandKit, FieldType, TemplateField } from "@/lib/types";
import { newId } from "@/lib/stores/local/db";
import { suggestFieldKey } from "@/lib/caption";

export interface PaletteItem {
  type: FieldType;
  label: string;
  width: number;
  height: number;
}

/** The draggable element palette. Dropping one creates a pre-sized, pre-typed
 * field that immediately opens for naming. */
export const PALETTE_ITEMS: PaletteItem[] = [
  { type: "text", label: "Text", width: 480, height: 90 },
  { type: "multiline", label: "Multiline text", width: 520, height: 220 },
  { type: "image", label: "Image", width: 420, height: 420 },
  { type: "select", label: "Dropdown", width: 480, height: 90 },
];

/** dataTransfer MIME key for palette drags. */
export const PALETTE_MIME = "application/x-sp-element";

const maxZ = (fields: TemplateField[]) =>
  fields.reduce((m, f) => Math.max(m, f.zIndex ?? 0), 0);

/** Build a new field of the given palette type centered at a canvas point,
 * clamped inside the canvas, painted on top of everything existing. */
export function fieldFromPalette(
  item: PaletteItem,
  at: { x: number; y: number },
  existing: TemplateField[],
  kit: BrandKit | null,
  canvas: { width: number; height: number },
): TemplateField {
  const width = Math.min(item.width, canvas.width);
  const height = Math.min(item.height, canvas.height);
  const x = Math.round(Math.max(0, Math.min(canvas.width - width, at.x - width / 2)));
  const y = Math.round(Math.max(0, Math.min(canvas.height - height, at.y - height / 2)));
  const isText = item.type !== "image";
  return {
    id: newId(),
    label: item.label,
    fieldKey: suggestFieldKey(item.label, existing),
    type: item.type,
    x,
    y,
    width,
    height,
    zIndex: maxZ(existing) + 1,
    ...(isText
      ? {
          fontFamily: kit?.headingFont?.family,
          fontSizePx: Math.max(18, Math.min(90, Math.round(height * 0.5))),
          colorKey: kit?.colors.find((c) => c.key === "text")?.key ?? kit?.colors[0]?.key,
          align: "left" as const,
          autoFit: true,
        }
      : {}),
    ...(item.type === "select" ? { options: [] } : {}),
  };
}

/** A label not already used by any field ("Photo" → "Photo copy" → "Photo copy 2"). */
function uniqueLabel(base: string, fields: TemplateField[]): string {
  const taken = new Set(fields.map((f) => f.label));
  if (!taken.has(base)) return base;
  let candidate = `${base} copy`;
  let n = 2;
  while (taken.has(candidate)) candidate = `${base} copy ${n++}`;
  return candidate;
}

/** Paint order: zIndex ascending, ties by array (form) order. */
export function paintOrder(fields: TemplateField[]): TemplateField[] {
  return fields
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (a.f.zIndex ?? 0) - (b.f.zIndex ?? 0) || a.i - b.i)
    .map((e) => e.f);
}

/** Move the given fields to the front or back of the paint order, then
 * renormalize every zIndex to 0..n-1 (never negative — a negative z would
 * paint behind the background image). Array (form) order is untouched. */
export function setLayerOrder(
  fields: TemplateField[],
  ids: string[],
  where: "front" | "back",
): TemplateField[] {
  const idSet = new Set(ids);
  const ordered = paintOrder(fields);
  const moved = ordered.filter((f) => idSet.has(f.id));
  const rest = ordered.filter((f) => !idSet.has(f.id));
  const next = where === "front" ? [...rest, ...moved] : [...moved, ...rest];
  const z = new Map(next.map((f, i) => [f.id, i]));
  return fields.map((f) => ({ ...f, zIndex: z.get(f.id)! }));
}

// ---------------------------------------------------------------------------
// Clipboard — module-level so it survives step navigation within the session.
// ---------------------------------------------------------------------------

let clipboard: TemplateField[] = [];
let pasteGeneration = 0;

export function copyToClipboard(fields: TemplateField[]): void {
  if (!fields.length) return;
  clipboard = structuredClone(fields);
  pasteGeneration = 0;
}

export function clipboardHasFields(): boolean {
  return clipboard.length > 0;
}

/** Materialize the clipboard as brand-new fields: fresh ids, unique labels
 * and merge tags (never a duplicate tag), painted on top. Without `at`, each
 * successive paste lands at a growing small offset; with `at` (context-menu
 * paste), the group's top-left lands at that canvas point. */
export function pasteFromClipboard(
  existing: TemplateField[],
  at?: { x: number; y: number },
): TemplateField[] {
  if (!clipboard.length) return [];
  pasteGeneration += 1;
  const offset = 16 * pasteGeneration;
  const minX = Math.min(...clipboard.map((f) => f.x));
  const minY = Math.min(...clipboard.map((f) => f.y));
  let z = maxZ(existing);
  const accumulated = [...existing];
  return clipboard.map((src) => {
    const label = uniqueLabel(src.label, accumulated);
    const field: TemplateField = {
      ...structuredClone(src),
      id: newId(),
      label,
      fieldKey: suggestFieldKey(label, accumulated),
      x: at ? Math.round(at.x + (src.x - minX)) : src.x + offset,
      y: at ? Math.round(at.y + (src.y - minY)) : src.y + offset,
      zIndex: ++z,
      sourceNodeId: undefined, // a pasted copy is not backed by the Figma node
    };
    accumulated.push(field);
    return field;
  });
}

/** Duplicate in place (⌘D): copy + paste in one step without touching the
 * persistent clipboard. */
export function duplicateFields(
  targets: TemplateField[],
  existing: TemplateField[],
): TemplateField[] {
  let z = maxZ(existing);
  const accumulated = [...existing];
  return targets.map((src) => {
    const label = uniqueLabel(src.label, accumulated);
    const field: TemplateField = {
      ...structuredClone(src),
      id: newId(),
      label,
      fieldKey: suggestFieldKey(label, accumulated),
      x: src.x + 16,
      y: src.y + 16,
      zIndex: ++z,
      sourceNodeId: undefined,
    };
    accumulated.push(field);
    return field;
  });
}

/** True when a keyboard event originates from a typing context — shortcuts
 * must never fire while the admin is typing in an input. */
export function isTypingTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}
