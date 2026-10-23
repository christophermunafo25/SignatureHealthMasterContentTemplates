import { describe, expect, it } from "vitest";
import type { TemplateField } from "./types";
import { HOF_HIGHLIGHT_KEYS, HOF_NAME_KEY, HOF_PHOTO_KEY, hallOfFameTemplate, type HallOfFameTemplate } from "./hallOfFame";
import {
  displayText,
  fitHighlightSize,
  fitLineName,
  fitName,
  fitTemplate,
  fitWrappedName,
  trackingPx,
  wrapLineCount,
  type FitMeasurers,
} from "./hallOfFameFit";

// Monospace stand-ins for canvas measureText: every glyph is a fixed share of
// the font size. Caps-heavy names get a wider ratio.
const mono = (ratio: number) => (text: string, size: number) => text.length * size * ratio;
const measurers: FitMeasurers = { name: mono(0.55), highlight: mono(0.6) };
const tracked = (ratio: number, size: number) => (s: string) => s.length * size * ratio + trackingPx(size) * s.length;

const template = (id: string): HallOfFameTemplate => hallOfFameTemplate(id)!;
const field = (id: string, key: string): TemplateField => template(id).schema.fields.find((f) => f.fieldKey === key)!;
const linesAt = (f: TemplateField, text: string, ratio: number, size: number, midWord = true) =>
  wrapLineCount(text, f.width * 0.97, tracked(ratio, size), midWord);

describe("wrapLineCount", () => {
  const tenPx = (s: string) => s.length * 10;

  it("breaks at spaces", () => {
    expect(wrapLineCount("", 100, tenPx)).toBe(0);
    expect(wrapLineCount("aaa bbb", 70, tenPx)).toBe(1);
    expect(wrapLineCount("aaa bbb", 60, tenPx)).toBe(2);
  });

  it("breaks after hyphens the way browsers do", () => {
    expect(wrapLineCount("great-grandmother", 120, tenPx)).toBe(2);
    expect(wrapLineCount("great-grandmother", 170, tenPx)).toBe(1);
  });

  it("splits an overlong word only when allowed", () => {
    expect(wrapLineCount("supercalifragilistic", 100, tenPx)).toBe(2);
    expect(wrapLineCount("supercalifragilistic", 100, tenPx, false)).toBe(Infinity);
  });
});

describe("fitHighlightSize", () => {
  const longOne = "Received the Distinguished Service Award 2024";

  it("keeps short highlights at the design size", () => {
    const f = field("classic-photo-name-highlights", HOF_HIGHLIGHT_KEYS[0]);
    const fit = template("classic-photo-name-highlights").highlightFit!;
    expect(fitHighlightSize(["Photographed 48 states", "", "Published a book"], f, measurers.highlight, fit)).toBe(30);
  });

  // Glyph ratios chosen so the long highlight overflows each box at the
  // design size but fits above the floor.
  it.each([
    ["classic-photo-name-highlights", 0.6],
    ["black-photo-name-highlights", 0.6],
    ["ivory-photo-name-highlights", 0.75],
  ] as const)("shrinks %s's highlights to the largest size that holds the longest one", (id, ratio) => {
    const f = field(id, HOF_HIGHLIGHT_KEYS[0]);
    const fit = template(id).highlightFit!;
    const size = fitHighlightSize(["Published a book", longOne, ""], f, mono(ratio), fit);
    expect(size).toBeLessThan(f.fontSizePx!);
    expect(size).toBeGreaterThan(fit.minPx);
    expect(linesAt(f, longOne, ratio, size)).toBeLessThanOrEqual(fit.maxLines);
    expect(linesAt(f, longOne, ratio, size + 1)).toBeGreaterThan(fit.maxLines);
    // Order and empty slots don't matter: the longest one decides.
    expect(fitHighlightSize([longOne], f, mono(ratio), fit)).toBe(size);
  });

  it("never goes below the floor", () => {
    const f = field("black-photo-name-highlights", HOF_HIGHLIGHT_KEYS[0]);
    const fit = template("black-photo-name-highlights").highlightFit!;
    expect(fitHighlightSize(["x".repeat(45)], f, mono(2), fit)).toBe(fit.minPx);
  });
});

describe("fitName, one line", () => {
  const name = field("classic-photo-name-highlights", HOF_NAME_KEY);

  it("leaves a name that fits at full size alone", () => {
    expect(fitLineName(name, "Michael Thomas", measurers.name)).toBe(name);
    expect(fitName(name, "   ", measurers.name, { mode: "line" })).toBe(name);
  });

  it("moves a long name to two lines when that is meaningfully larger", () => {
    const caps = mono(0.75);
    const text = "MARY ELIZABETH WASHINGTON-HALL";
    const fitted = fitLineName(name, text, caps);
    expect(fitted.type).toBe("multiline");
    // Two lines at this size stay inside the plate, 12px clear top and bottom.
    expect(2 * fitted.fontSizePx! * fitted.lineHeight! + 24).toBeLessThanOrEqual(name.height);
    expect(linesAt(name, text, 0.75, fitted.fontSizePx!, false)).toBe(2);
    expect(fitted.letterSpacingPx).toBe(trackingPx(fitted.fontSizePx!));
    // The fit keeps it inside the box, so the box doesn't clip descenders.
    expect(fitted.fixedWidth).toBe(false);
  });

  it("never splits a single word across lines", () => {
    expect(fitLineName(name, "Bartholomewsonningtonhurst", mono(0.75))).toBe(name);
  });
});

describe("fitName, wrapped", () => {
  const id = "black-photo-name-highlights";
  const name = field(id, HOF_NAME_KEY);
  const fit = template(id).nameFit as { mode: "wrap"; maxLines: number; minPx: number };

  it("wraps between words at the design size, like the Figma text box", () => {
    const fitted = fitName(name, "Michael Thomas", mono(0.6), fit);
    expect(fitted.type).toBe("multiline");
    expect(fitted.fontSizePx).toBe(name.fontSizePx);
    // Bottom-aligned at tight leading: an unclipped box keeps g, p and y whole.
    expect(fitted.fixedWidth).toBe(false);
    expect(linesAt(name, "Michael Thomas", 0.6, name.fontSizePx!, false)).toBe(2);
  });

  it("shrinks only as far as the line limit and the box need", () => {
    const text = "WILHELMINA MCWHORTER-WOODWARD";
    const fitted = fitWrappedName(name, text, mono(0.75), fit);
    const size = fitted.fontSizePx!;
    expect(size).toBeLessThan(name.fontSizePx!);
    expect(size).toBeGreaterThanOrEqual(fit.minPx);
    const lines = linesAt(name, text, 0.75, size, false);
    expect(lines).toBeLessThanOrEqual(fit.maxLines);
    expect(lines * size * name.lineHeight!).toBeLessThanOrEqual(name.height);
    const linesAbove = linesAt(name, text, 0.75, size + 1, false);
    expect(linesAbove > fit.maxLines || linesAbove * (size + 1) * name.lineHeight! > name.height).toBe(true);
  });

  it("falls back to the floor for a word that can't fit", () => {
    const fitted = fitWrappedName(name, "W".repeat(30), mono(1), fit);
    expect(fitted.type).toBe("multiline");
    expect(fitted.fontSizePx).toBe(fit.minPx);
  });

  describe("on the ivory highlights layout (three lines allowed)", () => {
    const ivory = "ivory-photo-name-highlights";
    const ivoryName = field(ivory, HOF_NAME_KEY);
    const ivoryFit = template(ivory).nameFit as { mode: "wrap"; maxLines: number; minPx: number };

    it("uses all three lines at the design size when the name breaks that way", () => {
      const text = "Mary Elizabeth Fitzgerald";
      const fitted = fitWrappedName(ivoryName, text, mono(0.55), ivoryFit);
      expect(fitted.fontSizePx).toBe(ivoryName.fontSizePx);
      expect(linesAt(ivoryName, text, 0.55, ivoryName.fontSizePx!, false)).toBe(3);
    });

    it("keeps fewer lines when another line would buy under 6px", () => {
      const text = "MARY ELIZABETH WASHINGTON-HALL";
      const fitted = fitWrappedName(ivoryName, text, mono(0.75), ivoryFit);
      const size = fitted.fontSizePx!;
      expect(linesAt(ivoryName, text, 0.75, size, false)).toBe(2);
      // Three lines would allow a slightly larger size, breaking at the hyphen.
      expect(linesAt(ivoryName, text, 0.75, size + 3, false)).toBe(3);
    });
  });
});

describe("displayText", () => {
  it("trims and turns every run of whitespace into one space", () => {
    expect(displayText("  Maria  del\tCarmen \u00a0Rodriguez ")).toBe("Maria del Carmen Rodriguez");
    expect(displayText("   ")).toBe("");
    expect(displayText(undefined)).toBe("");
  });

  it("is what the fit measures, so repeated spaces can't widen a line", () => {
    const t = template("ivory-photo-name-highlights");
    const single = fitTemplate(t, { [HOF_NAME_KEY]: "MARIA DEL CARMEN RODRIGUEZ" }, measurers);
    const doubled = fitTemplate(t, { [HOF_NAME_KEY]: "MARIA  DEL  CARMEN  RODRIGUEZ" }, measurers);
    expect(doubled.fields).toEqual(single.fields);
  });
});

describe("fitTemplate", () => {
  it("leaves a name that fits alone on the one-line templates", () => {
    const t = template("classic-photo-name");
    const fitted = fitTemplate(t, { [HOF_NAME_KEY]: "Michael Thomas" }, measurers);
    expect(fitted.fields).toEqual(t.schema.fields);
  });

  it("sets an empty template the way a filled one would be", () => {
    const t = template("ivory-photo-name-highlights");
    const fitted = fitTemplate(t, {}, measurers);
    const name = fitted.fields.find((f) => f.fieldKey === HOF_NAME_KEY)!;
    // Fitted on the "Winner's name" placeholder: wrapped, like a real name.
    expect(name.type).toBe("multiline");
    expect(fitted.fields.find((f) => f.fieldKey === HOF_PHOTO_KEY)).toEqual(
      t.schema.fields.find((f) => f.fieldKey === HOF_PHOTO_KEY),
    );
  });

  it("gives all three highlights one wrapping size", () => {
    const t = template("classic-photo-name-highlights");
    const fitted = fitTemplate(
      t,
      {
        [HOF_NAME_KEY]: "Michael Thomas",
        highlight_1: "Photographed 48 states",
        highlight_2: "Received the Distinguished Service Award 2024",
        highlight_3: "Published a book",
      },
      { name: measurers.name, highlight: mono(0.8) },
    );
    const highlights = fitted.fields.filter((f) => (HOF_HIGHLIGHT_KEYS as readonly string[]).includes(f.fieldKey));
    expect(highlights).toHaveLength(3);
    expect(highlights.every((f) => f.type === "multiline")).toBe(true);
    expect(new Set(highlights.map((f) => f.fontSizePx)).size).toBe(1);
    expect(highlights[0].fontSizePx).toBeLessThan(30);
  });

  it("never changes the source template", () => {
    const t = template("black-photo-name-highlights");
    const before = JSON.stringify(t.schema);
    fitTemplate(t, { [HOF_NAME_KEY]: "WILHELMINA MCWHORTER-WOODWARD", highlight_1: "x".repeat(45) }, measurers);
    expect(JSON.stringify(t.schema)).toBe(before);
  });
});
