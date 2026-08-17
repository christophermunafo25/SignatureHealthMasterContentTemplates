import { describe, expect, it } from "vitest";
import { canvasFontShorthand } from "@/lib/render/autoFit";

// The upstream suite also covers the css2 axis query (googleAxisQuery) and
// composing a shorthand from a catalogue FontStyle. Both belong to the font
// system — fontCatalog, variable-font cuts, the fontStyle/fontStretch columns
// — and land with that phase. What is here is the half this phase depends on:
// the shorthand every measurement is made with.

describe("the canvas font shorthand composes in the correct order", () => {
  it("puts style, weight and stretch before the size and the family last", () => {
    expect(
      canvasFontShorthand({
        fontStyle: "italic",
        fontWeight: 700,
        fontStretch: "expanded",
        fontSizePx: 45,
        fontFamily: "Archivo",
      }),
    ).toBe('italic 700 expanded 45px "Archivo", sans-serif');
  });

  it("never emits a percentage, which would invalidate the whole shorthand", () => {
    // `italic 700 125% 45px X` is rejected outright by the canvas, leaving the
    // context on its previous font — a silent revert to the wrong face, which
    // would throw off every measured fit without erroring anywhere.
    const shorthand = canvasFontShorthand({
      fontStretch: "ultra-expanded",
      fontSizePx: 45,
      fontFamily: "Neuething Sans",
    });
    expect(shorthand).not.toMatch(/%/);
    expect(shorthand).toBe('400 ultra-expanded 45px "Neuething Sans", sans-serif');
  });

  it("drops a stretch value that is not a real keyword", () => {
    expect(canvasFontShorthand({ fontStretch: "125%", fontSizePx: 45, fontFamily: "X" })).toBe(
      '400 45px "X", sans-serif',
    );
    expect(canvasFontShorthand({ fontStretch: "sideways", fontSizePx: 45 })).toBe(
      "400 45px sans-serif",
    );
  });

  it("omits normal stretch and upright style rather than spelling them out", () => {
    expect(
      canvasFontShorthand({
        fontStyle: "normal",
        fontWeight: 500,
        fontStretch: "normal",
        fontSizePx: 32,
        fontFamily: "Inter",
      }),
    ).toBe('500 32px "Inter", sans-serif');
  });

  it("composes a legacy field exactly as it did before the schema grew", () => {
    // The old line was `${fontWeight ?? 400} ${size}px ${family}`. A field
    // carrying only fontWeight must still produce that string, character for
    // character, or every measurement shifts.
    expect(canvasFontShorthand({ fontWeight: 700, fontSizePx: 45, fontFamily: "Montserrat" })).toBe(
      '700 45px "Montserrat", sans-serif',
    );
    expect(canvasFontShorthand({ fontSizePx: 45, fontFamily: "Montserrat" })).toBe(
      '400 45px "Montserrat", sans-serif',
    );
    expect(canvasFontShorthand({ fontSizePx: 45 })).toBe("400 45px sans-serif");
  });
});
