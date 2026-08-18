import { describe, expect, it } from "vitest";
import type { TemplateField, TemplateSchema } from "../types";
import type { LineMeasurer } from "./autoFit";
import { fitTextWith } from "./autoFit";
import { authoredRect, computeLayout, renderedText } from "./layout";
import { resolveFieldStyle } from "../brand/resolveStyle";

// THE non-negotiable constraint of the layout-groups phase: a template with
// no groups must render byte-identically to before, because that is every
// published template the 69 facilities use today.
//
// "Identical" is checked against the arithmetic the renderer did inline
// before the pass existed — authored rect for position and size, fitText for
// the font size — rather than against the pass reimplemented, which would
// only prove it agrees with itself.

const measure: LineMeasurer = (text, font) => {
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? "16");
  return text.length * size * 0.5;
};

let n = 0;
const f = (over: Partial<TemplateField>): TemplateField => ({
  id: `f${n++}`,
  label: over.label ?? "Field",
  fieldKey: over.fieldKey ?? `k${n}`,
  type: "text",
  x: 40,
  y: 60,
  width: 400,
  height: 100,
  fontSizePx: 40,
  ...over,
});

/** What the renderer computed inline, before the layout pass owned it. */
const legacySize = (field: TemplateField, text: string): number =>
  fitTextWith(
    measure,
    {
      ...resolveFieldStyle(field, null),
      multiline: field.type === "multiline",
      width: field.width,
      height: field.height,
    },
    text,
  ).fontSizePx;

describe("no groups ⇒ the pre-groups rendering path, exactly", () => {
  const canvas = { canvasWidth: 1440, canvasHeight: 1440 };

  const cases: Array<[string, TemplateField, Record<string, string>]> = [
    ["plain text, top-left anchored", f({ fieldKey: "a" }), { a: "Ana Ruiz" }],
    [
      "centre-anchored text",
      f({ fieldKey: "b", anchor: "center", x: 720, y: 400 }),
      { b: "Centred" },
    ],
    [
      "shrink at the box edge",
      f({ fieldKey: "c", textSizing: "shrink", minFontSizePx: 12 }),
      { c: "x".repeat(40) },
    ],
    [
      "shrink past the floor",
      f({ fieldKey: "d", textSizing: "shrink", minFontSizePx: 18 }),
      { d: "y".repeat(200) },
    ],
    ["fill", f({ fieldKey: "e", textSizing: "fill", minFontSizePx: 8 }), { e: "Hi" }],
    [
      "multiline, wrapping",
      f({ fieldKey: "g", type: "multiline", height: 200, lineHeight: 1 }),
      { g: "a fairly long entry that will certainly wrap more than once here" },
    ],
    ["rotated", f({ fieldKey: "h", rotation: 30 }), { h: "Tilted" }],
    ["image", f({ fieldKey: "i", type: "image", objectFit: "cover" }), {}],
    ["shape", f({ fieldKey: "j", type: "shape", shape: "rect", static: true }), {}],
    ["facility logo", f({ fieldKey: "k", type: "facility_logo" }), {}],
    ["empty value falls back to the label", f({ fieldKey: "l", label: "Name" }), {}],
    ["static text uses its staticValue", f({ fieldKey: "m", static: true, staticValue: "Fixed" }), {}],
  ];

  it.each(cases)("%s: rect is the authored rect", (_name, field, values) => {
    const schema = { fields: [field], ...canvas } as unknown as TemplateSchema;
    const r = computeLayout(schema, values, null, measure);
    const rect = r.fieldRects.get(field.id)!;
    const authored = authoredRect(field);
    // Free-mode text hugs its content height by design — that is the one
    // documented difference, and it matches where the flex renderer painted
    // the block inside the authored box. Everything else is untouched.
    const hugs =
      (field.type === "text" || field.type === "multiline" || field.type === "select") &&
      (field.textSizing ?? "free") === "free";
    expect(rect.x).toBe(authored.x);
    expect(rect.width).toBe(authored.width);
    if (!hugs) {
      expect(rect.y).toBe(authored.y);
      expect(rect.height).toBe(authored.height);
    }
  });

  it.each(cases)("%s: font size matches the old inline computation", (_name, field, values) => {
    const schema = { fields: [field], ...canvas } as unknown as TemplateSchema;
    const r = computeLayout(schema, values, null, measure);
    const size = r.fontSizes.get(field.id);
    const isText =
      field.type === "text" || field.type === "multiline" || field.type === "select";
    if (!isText) {
      expect(size).toBeUndefined();
      return;
    }
    expect(size).toBe(legacySize(field, renderedText(field, values[field.fieldKey])));
  });

  it("warns only where content genuinely overflows at the floor", () => {
    // One case above ("shrink past the floor") is deliberately unfittable.
    // Every other field must pass silently — a warning on an ordinary
    // template would be noise the admin learns to ignore.
    const schema = {
      fields: cases.map(([, field]) => field),
      ...canvas,
    } as unknown as TemplateSchema;
    const values = Object.assign({}, ...cases.map(([, , v]) => v));
    const { warnings } = computeLayout(schema, values, null, measure);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/minimum size/);
  });

  it("is silent when nothing overflows", () => {
    const schema = {
      fields: cases.filter(([name]) => !name.includes("past the floor")).map(([, fl]) => fl),
      ...canvas,
    } as unknown as TemplateSchema;
    const values = Object.assign({}, ...cases.map(([, , v]) => v));
    expect(computeLayout(schema, values, null, measure).warnings).toEqual([]);
  });

  it("an explicitly empty layoutGroups array behaves as no groups", () => {
    const field = f({ fieldKey: "z" });
    const bare = { fields: [field], ...canvas } as unknown as TemplateSchema;
    const empty = { fields: [field], layoutGroups: [], ...canvas } as unknown as TemplateSchema;
    expect(computeLayout(empty, { z: "Same" }, null, measure).fieldRects.get(field.id)).toEqual(
      computeLayout(bare, { z: "Same" }, null, measure).fieldRects.get(field.id),
    );
  });
});
