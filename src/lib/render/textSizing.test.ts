import { describe, expect, it } from "vitest";
import type { LineMeasurer } from "./autoFit";
import { fitTextWith, wrapLines } from "./autoFit";

// The upstream suite also drives these modes through computeLayout, which
// asserts the RECTS each mode produces (free hugs its wrapped height, shrink
// keeps the authored box, stacks keep a constant gap between a hugging child
// and a fixed one). computeLayout arrives with layout groups, so those cases
// land in that phase; everything here exercises the fit itself, which is what
// this phase replaces.

/** Deterministic fake glyphs: every character is half the font size wide.
 *  Injecting the measurer is the whole point of the engine's shape — the same
 *  code runs against the browser canvas, the export, and this. */
const measure: LineMeasurer = (text, font) => {
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? "16");
  return text.length * size * 0.5;
};

// At 48px each char is 24px wide → 25 chars per line in a 600px box; the
// 192px box holds exactly 4 lines at lineHeight 1.
const words = "brand voice tools ship faster when every member can make the graphic themselves";
const entryOfLines = (n: number) => {
  let out = words;
  while (out.length < n * 25 - 12) out = `${out} ${words}`;
  return out.slice(0, n * 25 - 12).trimEnd();
};

describe("Free: the font size never changes, however long the entry", () => {
  const fit = (text: string) =>
    fitTextWith(
      measure,
      { multiline: true, width: 600, height: 192, fontSizePx: 48, lineHeight: 1 },
      text,
    );

  it("keeps the set size for everything from empty to far past the box", () => {
    for (const text of ["", "hello", "twelve chars", entryOfLines(3), "x".repeat(60), entryOfLines(30)]) {
      expect(fit(text).fontSizePx).toBe(48);
    }
  });

  it("is the default when no mode is set at all", () => {
    expect(fit(entryOfLines(30)).overflows).toBe(false);
  });
});

describe("Shrink, single-line: width binds, degrades smoothly", () => {
  const fit = (text: string, width = 600) =>
    fitTextWith(
      measure,
      { multiline: false, width, height: 90, fontSizePx: 48, textSizing: "shrink" },
      text,
    );

  it("holds the set size until the text would escape", () => {
    expect(fit("short").fontSizePx).toBe(48); // 5×24=120 ≤ 600
    expect(fit("a".repeat(25)).fontSizePx).toBe(48); // exactly 600
  });

  it("shrinks exactly at the box edge, then smoothly", () => {
    const sizes = [26, 30, 40, 60].map((n) => fit("a".repeat(n)).fontSizePx);
    expect(sizes[0]).toBeLessThan(48);
    // Monotonic, gradual — never a collapse to the floor.
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]);
    expect(sizes[1]).toBe(Math.floor((48 * 25) / 30)); // exact ratio fit
    expect(fit("a".repeat(60)).overflows).toBe(false); // 20px ≥ the 18 floor
  });

  it("floors at the minimum and flags the overflow", () => {
    const r = fit("a".repeat(120));
    expect(r.fontSizePx).toBe(18);
    expect(r.overflows).toBe(true);
  });
});

describe("Shrink, multiline: the box height binds, wrapped at the box width", () => {
  const fit = (text: string, over: Partial<Parameters<typeof fitTextWith>[1]> = {}) =>
    fitTextWith(
      measure,
      {
        multiline: true,
        width: 600,
        height: 192,
        fontSizePx: 48,
        lineHeight: 1,
        textSizing: "shrink",
        ...over,
      },
      text,
    );

  it("holds the set size while the wrapped block fits — including a FULL box", () => {
    for (const n of [1, 2, 3, 4]) {
      const r = fit(entryOfLines(n));
      expect(r.fontSizePx).toBe(48);
      expect(r.overflows).toBe(false);
    }
  });

  it("five lines: steps down a little and fills without spilling", () => {
    const text = entryOfLines(5);
    const r = fit(text);
    expect(r.fontSizePx).toBeLessThan(48);
    expect(r.fontSizePx).toBeGreaterThan(38); // a step, not a collapse
    const lines = wrapLines(text, 600, { lineHeight: 1 }, r.fontSizePx, measure).length;
    expect(lines * r.fontSizePx).toBeLessThanOrEqual(192);
  });

  it("degrades smoothly toward ten lines — never one jump to the floor", () => {
    const sizes = [5, 6, 7, 8, 10].map((n) => fit(entryOfLines(n)).fontSizePx);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]);
      expect(sizes[i]).toBeGreaterThanOrEqual(18);
    }
    expect(new Set(sizes).size).toBeGreaterThan(2); // gradual, distinct steps
  });

  it("content beyond the floor sits at the floor and reports the overflow", () => {
    // Nothing clips: the text paints past the box and the surface warns. A
    // member's entry is never silently truncated.
    const direct = fit(entryOfLines(30), { minFontSizePx: 18 });
    expect(direct.fontSizePx).toBe(18);
    expect(direct.overflows).toBe(true);
  });

  it("the size at rest (empty entry) is the admin's set size", () => {
    expect(fit("").fontSizePx).toBe(48);
  });

  it("a single unbreakable word shrinks until it fits the width", () => {
    // 30 chars × 24px = 720 > 600 at 48px; fits whole at 40 (30 × 20 = 600).
    const r = fit("w".repeat(30));
    expect(r.fontSizePx).toBe(40);
    expect(r.overflows).toBe(false);
  });

  it("hard line breaks are respected by the fit", () => {
    // 8 short paragraphs: 8 lines even though each is narrow → must shrink
    // to 24px (8 × 24 = 192) despite tiny line widths.
    const r = fit(Array.from({ length: 8 }, (_, i) => `p${i}`).join("\n"));
    expect(r.fontSizePx).toBe(24);
  });

  it("empty lines occupy line boxes consistently in sizing and height", () => {
    const text = "a\n\nb"; // 3 line boxes
    expect(wrapLines(text, 600, {}, 48, measure)).toEqual(["a", "", "b"]);
    const r = fit(text);
    expect(r.fontSizePx).toBe(48); // 3 × 48 = 144 ≤ 192
    const five = fit("a\n\n\n\n\nb"); // 6 line boxes → must shrink to 32
    expect(five.fontSizePx).toBe(32);
  });

  it("uppercase and letter spacing participate in the measurement", () => {
    const plain = fit(entryOfLines(4));
    const spaced = fit(entryOfLines(4), { letterSpacingPx: 6 });
    expect(spaced.fontSizePx).toBeLessThan(plain.fontSizePx);
  });
});

describe("shrink respects BOTH axes", () => {
  const base = { multiline: false, lineHeight: 1, textSizing: "shrink" as const };

  it("shrinks a line that fits the width but not the height", () => {
    // 5 chars at 200px = 500px wide (fits 1000), but the line box is 200px
    // tall in a 60px box — it must come down to 60. This height half is what
    // the old fixed-width path never checked.
    const fit = fitTextWith(
      measure,
      { ...base, width: 1000, height: 60, fontSizePx: 200, minFontSizePx: 8 },
      "Tall!",
    );
    expect(fit.fontSizePx).toBeLessThanOrEqual(60);
    expect(fit.overflows).toBe(false);
  });

  it("still shrinks on width when height is generous", () => {
    // 40 chars at 48px = 960px, box 600 wide → must come down to ~30.
    const fit = fitTextWith(
      measure,
      { ...base, width: 600, height: 1000, fontSizePx: 48, minFontSizePx: 8 },
      "x".repeat(40),
    );
    expect(fit.fontSizePx).toBe(30);
  });

  it("never grows past the set size, however roomy the box", () => {
    const fit = fitTextWith(
      measure,
      { ...base, width: 4000, height: 4000, fontSizePx: 48, minFontSizePx: 8 },
      "Hi",
    );
    expect(fit.fontSizePx).toBe(48);
  });

  it("reports overflow when even the floor cannot fit", () => {
    const fit = fitTextWith(
      measure,
      { ...base, width: 10, height: 10, fontSizePx: 48, minFontSizePx: 20 },
      "far too long for this",
    );
    expect(fit.fontSizePx).toBe(20);
    expect(fit.overflows).toBe(true);
  });
});

describe("fill sizes text to the box", () => {
  const base = { multiline: false, lineHeight: 1, textSizing: "fill" as const };

  it("grows a short line well past its set size", () => {
    // "Hi" is 2 chars → width allows size 300 (2 * 0.5 * 300 = 300px);
    // height 200 is the binding constraint at lineHeight 1.
    const fit = fitTextWith(
      measure,
      { ...base, width: 300, height: 200, fontSizePx: 20, minFontSizePx: 8 },
      "Hi",
    );
    expect(fit.fontSizePx).toBe(200);
    expect(fit.overflows).toBe(false);
  });

  it("is bound by whichever axis runs out first", () => {
    // 10 chars: width 300 allows 60px (10 * 0.5 * 60 = 300); height allows 500.
    const fit = fitTextWith(
      measure,
      { ...base, width: 300, height: 500, fontSizePx: 20, minFontSizePx: 8 },
      "x".repeat(10),
    );
    expect(fit.fontSizePx).toBe(60);
  });

  it("shrinks as well as grows — long content still fits", () => {
    const fit = fitTextWith(
      measure,
      { ...base, width: 300, height: 100, fontSizePx: 200, minFontSizePx: 8 },
      "x".repeat(50),
    );
    expect(fit.fontSizePx).toBe(12); // 50 * 0.5 * 12 = 300
    expect(fit.overflows).toBe(false);
  });

  it("honours the floor and reports overflow below it", () => {
    const fit = fitTextWith(
      measure,
      { ...base, width: 50, height: 50, fontSizePx: 20, minFontSizePx: 30 },
      "x".repeat(20),
    );
    expect(fit.fontSizePx).toBe(30);
    expect(fit.overflows).toBe(true);
  });

  it("fills a multiline box by wrapping, not by overflowing", () => {
    const fit = fitTextWith(
      measure,
      {
        multiline: true,
        lineHeight: 1,
        textSizing: "fill",
        width: 600,
        height: 192,
        fontSizePx: 10,
        minFontSizePx: 8,
      },
      entryOfLines(4),
    );
    // Bigger than the set 10px, and the wrapped block still fits the box.
    expect(fit.fontSizePx).toBeGreaterThan(10);
    const lines = wrapLines(
      entryOfLines(4),
      600,
      { lineHeight: 1 },
      fit.fontSizePx,
      measure,
    ).length;
    expect(lines * fit.fontSizePx).toBeLessThanOrEqual(192);
  });
});

describe("a fractional authored size survives when it already fits", () => {
  // Figma imports routinely land fractional sizes (22.7px on the Sigiversary
  // Circle subtitle, in the published set). Flooring one that fits would
  // shrink text with no reason to shrink — a visible change to a live
  // template for nothing. Below the ceiling the search stays whole-pixel.
  const base = { multiline: false, lineHeight: 1, width: 373, height: 28, minFontSizePx: 11 };

  it("returns 22.7, not 22, when the text fits at 22.7", () => {
    const r = fitTextWith(measure, { ...base, fontSizePx: 22.7, textSizing: "shrink" }, "Ana Ruiz");
    expect(r.fontSizePx).toBe(22.7);
    expect(r.overflows).toBe(false);
  });

  it("still steps down to whole pixels once it genuinely has to", () => {
    const r = fitTextWith(measure, { ...base, fontSizePx: 22.7, textSizing: "shrink" }, "x".repeat(40));
    expect(r.fontSizePx).toBeLessThan(22.7);
    expect(Number.isInteger(r.fontSizePx)).toBe(true);
  });

  it("leaves whole-pixel sizes exactly as they were", () => {
    expect(
      fitTextWith(measure, { ...base, fontSizePx: 24, textSizing: "shrink" }, "Ana Ruiz").fontSizePx,
    ).toBe(24);
  });
});
