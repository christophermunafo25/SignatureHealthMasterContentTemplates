import { describe, expect, it } from "vitest";
import {
  HALL_OF_FAME_TEMPLATES,
  HOF_HIGHLIGHT_KEYS,
  HOF_HIGHLIGHT_MAX,
  HOF_LAYOUTS,
  HOF_NAME_KEY,
  HOF_NAME_MAX,
  HOF_PHOTO_KEY,
  exportNameFor,
  hallOfFameTemplate,
} from "./hallOfFame";
import { isFormField } from "./fields";

const field = (key: string, t = HALL_OF_FAME_TEMPLATES[0]) => t.schema.fields.find((f) => f.fieldKey === key);

describe("Hall of Fame templates", () => {
  it("offers three styles in each of the two layouts Signature asked for", () => {
    expect(HALL_OF_FAME_TEMPLATES).toHaveLength(6);
    for (const layout of HOF_LAYOUTS) {
      const inLayout = HALL_OF_FAME_TEMPLATES.filter((t) => t.schema.category === layout.title);
      expect(inLayout.map((t) => t.schema.name)).toEqual(["Classic", "Modern black", "Modern ivory"]);
      const keys = layout.key === "photo-name" ? [HOF_PHOTO_KEY, HOF_NAME_KEY] : [HOF_PHOTO_KEY, HOF_NAME_KEY, ...HOF_HIGHLIGHT_KEYS];
      for (const t of inLayout) expect(t.schema.fields.map((f) => f.fieldKey)).toEqual(keys);
    }
  });

  it("keys every template by one stable id", () => {
    const ids = HALL_OF_FAME_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of HALL_OF_FAME_TEMPLATES) {
      expect(t.schema.id).toBe(t.id);
      expect(t.id).toMatch(/^[a-z-]+$/);
      expect(hallOfFameTemplate(t.id)).toBe(t);
    }
    expect(hallOfFameTemplate("not-a-template")).toBeUndefined();
  });

  it("keeps every field on a 1080x1080 canvas with its background and placeholder", () => {
    for (const { schema, photoPlaceholder } of HALL_OF_FAME_TEMPLATES) {
      expect([schema.canvasWidth, schema.canvasHeight]).toEqual([1080, 1080]);
      expect(schema.backgroundUrl).toBeTruthy();
      expect(schema.backgroundColor).toMatch(/^#[0-9A-F]{6}$/);
      expect(photoPlaceholder).toBeTruthy();
      expect(schema.captionTemplate).toBe("");
      for (const f of schema.fields) {
        expect(f.x).toBeGreaterThanOrEqual(0);
        expect(f.y).toBeGreaterThanOrEqual(0);
        expect(f.x + f.width).toBeLessThanOrEqual(schema.canvasWidth);
        expect(f.y + f.height).toBeLessThanOrEqual(schema.canvasHeight);
      }
    }
  });

  it("makes every input required, guarded, and a real form field", () => {
    for (const t of HALL_OF_FAME_TEMPLATES) {
      const { fields } = t.schema;
      expect(new Set(fields.map((f) => f.fieldKey)).size).toBe(fields.length);
      for (const f of fields) {
        expect(isFormField(f)).toBe(true);
        expect(f.required).toBe(true);
      }
      const photo = field(HOF_PHOTO_KEY, t)!;
      expect(photo.type).toBe("image");
      expect(photo.aspectRatio).toBeCloseTo(photo.width / photo.height, 6);
      const name = field(HOF_NAME_KEY, t)!;
      expect(name.type).toBe("text");
      expect(name.maxLength).toBe(HOF_NAME_MAX);
      expect(name.fixedWidth).toBe(true);
      for (const key of HOF_HIGHLIGHT_KEYS) {
        const highlight = field(key, t);
        if (!highlight) continue;
        // Single-line inputs in the form; the fit wraps them on the graphic.
        expect(highlight.type).toBe("text");
        expect(highlight.maxLength).toBe(HOF_HIGHLIGHT_MAX);
        expect(highlight.fixedWidth).toBe(true);
      }
    }
  });

  it("arches the photo only on the modern black templates", () => {
    for (const t of HALL_OF_FAME_TEMPLATES) {
      const photo = field(HOF_PHOTO_KEY, t)!;
      if (t.id.startsWith("black-")) {
        expect(photo.cornerRadius).toEqual({ tl: photo.width / 2, tr: photo.width / 2, br: 0, bl: 0 });
      } else {
        expect(photo.cornerRadius).toBeUndefined();
      }
    }
  });

  it("gives every template fit settings its boxes can hold", () => {
    for (const t of HALL_OF_FAME_TEMPLATES) {
      const name = field(HOF_NAME_KEY, t)!;
      const leading = name.lineHeight ?? 1.1;
      expect(name.fontSizePx! * leading).toBeLessThanOrEqual(name.height);
      if (t.nameFit.mode === "wrap") {
        expect(t.nameFit.minPx).toBeLessThan(name.fontSizePx!);
        expect(t.nameFit.minPx * leading * t.nameFit.maxLines).toBeLessThanOrEqual(name.height);
      }
      const highlights = HOF_HIGHLIGHT_KEYS.map((k) => field(k, t)).filter((f) => f !== undefined);
      expect(Boolean(t.highlightFit)).toBe(highlights.length > 0);
      if (t.highlightFit) {
        for (const h of highlights) {
          const hLeading = h.lineHeight ?? 1.1;
          expect(h.fontSizePx! * hLeading).toBeLessThanOrEqual(h.height);
          expect(t.highlightFit.minPx * hLeading * t.highlightFit.maxLines).toBeLessThanOrEqual(h.height);
        }
      }
    }
  });

  it("names the download after the winner", () => {
    expect(exportNameFor("  Michael Thomas ")).toBe("Hall of Fame Michael Thomas");
    expect(exportNameFor("Mary  Ellen")).toBe("Hall of Fame Mary Ellen");
    expect(exportNameFor("")).toBe("Hall of Fame");
    expect(exportNameFor(undefined)).toBe("Hall of Fame");
  });

  it("folds accents so the file name keeps every letter it can", () => {
    expect(exportNameFor("Zoë Ångström")).toBe("Hall of Fame Zoe Angstrom");
    expect(exportNameFor("José García-Hernández")).toBe("Hall of Fame Jose Garcia-Hernandez");
    // Nothing with a plain form: no name rather than stray underscores.
    expect(exportNameFor("李娜")).toBe("Hall of Fame");
    expect(exportNameFor("Li 李娜 Na")).toBe("Hall of Fame Li Na");
  });
});
