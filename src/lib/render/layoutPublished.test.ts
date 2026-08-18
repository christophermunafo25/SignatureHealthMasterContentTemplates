import { describe, expect, it } from "vitest";
import type { TemplateField, TemplateSchema } from "../types";
import type { LineMeasurer } from "./autoFit";
import { fitTextWith } from "./autoFit";
import { authoredRect, computeLayout, renderedText } from "./layout";
import { resolveFieldStyle } from "../brand/resolveStyle";
import published from "./__fixtures__/publishedTemplates.json";

// The eight templates the 69 facilities actually use, pulled from the live
// portal read path and frozen here. None of them has groups, so every one
// must come out of the layout pass exactly where the renderer put it before
// the pass existed.
//
// This is the concrete half of the identity guarantee — the other suite
// proves the rule on synthetic fields, this one proves it on the real set.

const measure: LineMeasurer = (text, font) => {
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? "16");
  return text.length * size * 0.5;
};

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

const isText = (f: TemplateField) =>
  f.type === "text" || f.type === "multiline" || f.type === "select";

const templates = published as unknown as Array<{
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  fields: TemplateField[];
}>;

// A spread of member entries, including ones long enough to drive shrink.
const SAMPLES = ["", "Ana Ruiz", "Wilhelmina Featherstonehaugh-Marchetti", "A".repeat(70)];

describe("the published set renders where it always did", () => {
  it("covers every published template", () => {
    expect(templates.length).toBeGreaterThanOrEqual(8);
  });

  for (const t of templates) {
    describe(t.name, () => {
      for (const sample of SAMPLES) {
        const label = sample === "" ? "(empty)" : `"${sample.slice(0, 18)}"`;

        it(`positions every field at its authored rect with ${label}`, () => {
          const values = Object.fromEntries(t.fields.map((f) => [f.fieldKey, sample]));
          const schema = { ...t, fields: t.fields } as unknown as TemplateSchema;
          const r = computeLayout(schema, values, null, measure);
          for (const f of t.fields) {
            const rect = r.fieldRects.get(f.id)!;
            const authored = authoredRect(f);
            expect(rect.x).toBeCloseTo(authored.x, 6);
            expect(rect.width).toBeCloseTo(authored.width, 6);
            // Free-mode text hugs its wrapped height by design; every other
            // field keeps the authored box outright.
            const hugs = isText(f) && (f.textSizing ?? "free") === "free";
            if (!hugs) {
              expect(rect.y).toBeCloseTo(authored.y, 6);
              expect(rect.height).toBeCloseTo(authored.height, 6);
            }
          }
        });

        it(`sizes every text field as the old inline path did with ${label}`, () => {
          const values = Object.fromEntries(t.fields.map((f) => [f.fieldKey, sample]));
          const schema = { ...t, fields: t.fields } as unknown as TemplateSchema;
          const r = computeLayout(schema, values, null, measure);
          for (const f of t.fields.filter(isText)) {
            expect(r.fontSizes.get(f.id)).toBe(
              legacySize(f, renderedText(f, values[f.fieldKey])),
            );
          }
        });
      }
    });
  }
});
