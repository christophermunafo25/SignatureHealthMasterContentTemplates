import { describe, expect, it } from "vitest";
import {
  PALETTE_ITEMS,
  applyClipboardStyle,
  cascadePoint,
  fieldFromPalette,
  clearStyleClipboard,
  clipboardHasStyle,
  copyStyle,
  isSvgSource,
  logoFieldFromAsset,
  svgIntrinsicSize,
} from "./fieldOps";
import type { TemplateField } from "@/lib/types";

const asset = {
  id: "asset-1",
  name: "Signature-Primary.png",
  url: "https://cdn.example.com/logo.png",
};
const canvas = { width: 1440, height: 1440 };
const center = { x: 720, y: 720 };

describe("logoFieldFromAsset", () => {
  it("always defaults to contain — a logo never crops", () => {
    const f = logoFieldFromAsset(asset, { width: 800, height: 400 }, center, [], canvas);
    expect(f.objectFit).toBe("contain");
  });

  it("lands fixed with the artwork as its static value", () => {
    const f = logoFieldFromAsset(asset, null, center, [], canvas);
    expect(f.type).toBe("image");
    expect(f.static).toBe(true);
    expect(f.staticValue).toBe(asset.url);
  });

  it("sizes the box to the artwork's aspect ratio (landscape)", () => {
    const f = logoFieldFromAsset(asset, { width: 800, height: 400 }, center, [], canvas);
    expect(f.width).toBe(360);
    expect(f.height).toBe(180);
    expect(f.aspectRatio).toBe(2);
  });

  it("sizes the box to the artwork's aspect ratio (portrait)", () => {
    const f = logoFieldFromAsset(asset, { width: 300, height: 600 }, center, [], canvas);
    expect(f.width).toBe(180);
    expect(f.height).toBe(360);
  });

  it("falls back to a square box when the natural size is unknown", () => {
    const f = logoFieldFromAsset(asset, null, center, [], canvas);
    expect(f.width).toBe(360);
    expect(f.height).toBe(360);
    expect(f.aspectRatio).toBeUndefined();
  });

  it("clamps into a small canvas without distorting the ratio", () => {
    const small = { width: 200, height: 400 };
    const f = logoFieldFromAsset(asset, { width: 800, height: 400 }, center, [], small);
    expect(f.width).toBeLessThanOrEqual(small.width);
    expect(f.height).toBeLessThanOrEqual(small.height);
    expect(f.width / f.height).toBeCloseTo(2, 1);
    expect(f.x).toBeGreaterThanOrEqual(0);
    expect(f.y).toBeGreaterThanOrEqual(0);
  });

  it("centers on the drop point, clamped inside the canvas", () => {
    const f = logoFieldFromAsset(asset, { width: 400, height: 400 }, { x: 0, y: 0 }, [], canvas);
    expect(f.x).toBe(0);
    expect(f.y).toBe(0);
  });

  it("labels from the asset filename, deduplicated against existing fields", () => {
    const f = logoFieldFromAsset(asset, null, center, [], canvas);
    expect(f.label).toBe("Signature-Primary");
    const existing = [{ ...f }] as TemplateField[];
    const f2 = logoFieldFromAsset(asset, null, center, existing, canvas);
    expect(f2.label).toBe("Signature-Primary copy");
  });
});

describe("style clipboard", () => {
  const headline: TemplateField = {
    id: "src",
    label: "Headline",
    fieldKey: "headline",
    type: "text",
    x: 10,
    y: 20,
    width: 500,
    height: 100,
    fontFamily: "Neuething Sans",
    fontWeight: 800,
    fontSizePx: 96,
    uppercase: false,
    letterSpacingPx: -1.9,
    lineHeight: 1.2,
    align: "left",
    textSizing: "shrink",
    colorHex: "#F1F1F1",
    textGradient: {
      angle: 135,
      stops: [
        { position: 0, color: "#FF4D12" },
        { position: 1, color: "#FF8235" },
      ],
    },
  };
  const plain: TemplateField = {
    id: "dst",
    label: "Body",
    fieldKey: "body",
    type: "multiline",
    x: 700,
    y: 800,
    width: 400,
    height: 200,
    fontFamily: "Inter Tight",
    fontWeight: 400,
    fontSizePx: 36,
    colorHex: "#121212",
  };

  it("pastes the look, never content or geometry", () => {
    copyStyle(headline);
    const styled = applyClipboardStyle(plain);
    expect(styled.fontFamily).toBe("Neuething Sans");
    expect(styled.fontWeight).toBe(800);
    expect(styled.fontSizePx).toBe(96);
    expect(styled.textGradient?.stops[1].color).toBe("#FF8235");
    // untouched identity + geometry
    expect(styled.id).toBe("dst");
    expect(styled.label).toBe("Body");
    expect(styled.fieldKey).toBe("body");
    expect(styled.type).toBe("multiline");
    expect([styled.x, styled.y, styled.width, styled.height]).toEqual([700, 800, 400, 200]);
  });

  it("clears what the source lacks — adopt the look, don't merge", () => {
    const gradFree: TemplateField = { ...plain, id: "s2", textGradient: { angle: 0, stops: [] } };
    copyStyle(plain);
    const styled = applyClipboardStyle(gradFree);
    expect(styled.textGradient).toBeUndefined();
  });

  it("applies only the type-appropriate subset across kinds", () => {
    copyStyle(headline);
    const image: TemplateField = {
      id: "img",
      label: "Photo",
      fieldKey: "photo",
      type: "image",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      objectFit: "cover",
      cornerRadius: { tl: 8, tr: 8, br: 8, bl: 8 },
    };
    const styled = applyClipboardStyle(image);
    expect(styled.fontFamily).toBeUndefined();
    // source had no image-facing props — the look transfers as "no radius, default fit"
    expect(styled.cornerRadius).toBeUndefined();
    expect(styled.objectFit).toBeUndefined();
    expect(styled.width).toBe(100);
  });

  it("shape fill adopts a text style's color and gradient", () => {
    copyStyle(headline);
    const shape: TemplateField = {
      id: "sh",
      label: "Rect",
      fieldKey: "rect",
      type: "shape",
      shape: "rect",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      colorHex: "#d9d9d9",
      static: true,
    };
    const styled = applyClipboardStyle(shape);
    expect(styled.colorHex).toBe("#F1F1F1");
    expect(styled.textGradient?.angle).toBe(135);
    expect(styled.static).toBe(true);
    expect(styled.shape).toBe("rect");
  });

  it("empty clipboard is a no-op", () => {
    clearStyleClipboard();
    expect(clipboardHasStyle()).toBe(false);
    expect(applyClipboardStyle(plain)).toEqual(plain);
  });
});

describe("svgIntrinsicSize", () => {
  it("prefers absolute width/height attributes", () => {
    expect(
      svgIntrinsicSize('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"></svg>'),
    ).toEqual({ width: 240, height: 80 });
    expect(svgIntrinsicSize('<svg width="240px" height="80px"></svg>')).toEqual({
      width: 240,
      height: 80,
    });
  });

  it("falls back to the viewBox when width/height are missing or relative", () => {
    expect(svgIntrinsicSize('<svg viewBox="0 0 400 100"><rect/></svg>')).toEqual({
      width: 400,
      height: 100,
    });
    // Percentages size against the container, not the artwork.
    expect(svgIntrinsicSize('<svg width="100%" height="100%" viewBox="0,0,50,200"/>')).toEqual({
      width: 50,
      height: 200,
    });
  });

  it("returns null when the document declares nothing trustworthy", () => {
    expect(svgIntrinsicSize('<svg xmlns="http://www.w3.org/2000/svg"><circle r="48"/></svg>')).toBe(
      null,
    );
    expect(svgIntrinsicSize("not svg at all")).toBe(null);
    expect(svgIntrinsicSize('<svg viewBox="0 0 0 100"/>')).toBe(null);
  });
});

describe("isSvgSource", () => {
  it("matches svg files, urls with query strings, and data urls", () => {
    expect(isSvgSource("logo.svg")).toBe(true);
    expect(isSvgSource("https://cdn.example.com/a/logo.SVG?token=x")).toBe(true);
    expect(isSvgSource("data:image/svg+xml;utf8,<svg/>")).toBe(true);
    expect(isSvgSource("logo.png")).toBe(false);
    expect(isSvgSource("https://cdn.example.com/svg-icons/logo.png")).toBe(false);
  });
});

describe("cascadePoint", () => {
  const canvas = { width: 1440, height: 1440 };
  const center = { x: 720, y: 720 };
  const at = (x: number, y: number, over: Partial<TemplateField> = {}): TemplateField => ({
    id: `c${x}-${y}`,
    label: "F",
    fieldKey: `c${x}_${y}`,
    type: "text",
    x,
    y,
    width: 100,
    height: 100,
    ...over,
  });

  it("leaves an empty spot alone", () => {
    expect(cascadePoint(center, [], canvas)).toEqual(center);
  });

  it("steps off an occupied spot, and again for each repeat", () => {
    // A top-left field at (670,670) with a 100×100 box is centered on 720,720.
    const first = at(670, 670);
    const second = { ...at(710, 710), id: "second" };
    expect(cascadePoint(center, [first], canvas)).toEqual({ x: 760, y: 760 });
    expect(cascadePoint(center, [first, second], canvas)).toEqual({ x: 800, y: 800 });
  });

  it("matches center-anchored fields on their own coordinates", () => {
    const centered = at(720, 720, { anchor: "center" });
    expect(cascadePoint(center, [centered], canvas)).toEqual({ x: 760, y: 760 });
  });

  it("gives up rather than walking off the canvas", () => {
    const corner = { x: 1430, y: 1430 };
    const occupied = at(1380, 1380); // centered on 1430,1430
    expect(cascadePoint(corner, [occupied], canvas)).toEqual(corner);
  });

  it("ignores elements that are merely nearby", () => {
    expect(cascadePoint(center, [at(600, 600)], canvas)).toEqual(center);
  });
});

describe("cascadePoint with a box size (clamping)", () => {
  const canvas = { width: 1440, height: 1440 };
  const size = { width: 480, height: 90 };
  const boxAt = (cx: number, cy: number): TemplateField => ({
    id: `b${cx}-${cy}`,
    label: "B",
    fieldKey: `b${cx}_${cy}`,
    type: "text",
    x: cx - size.width / 2,
    y: cy - size.height / 2,
    width: size.width,
    height: size.height,
  });

  it("gives up once the BOX would clamp, instead of proposing points that all land together", () => {
    // Fill the diagonal from the centre until the next step would clamp.
    const placed: TemplateField[] = [];
    const centre = { x: 720, y: 720 };
    let gaveUp = false;
    for (let i = 0; i < 40 && !gaveUp; i++) {
      const p = cascadePoint(centre, placed, canvas, size);
      if (i > 0 && p.x === centre.x && p.y === centre.y) {
        // Returning the original point IS the give-up signal.
        gaveUp = true;
        break;
      }
      // Until then, every point it hands back must be genuinely free.
      expect(placed.some((f) => f.x + f.width / 2 === p.x && f.y + f.height / 2 === p.y)).toBe(
        false,
      );
      placed.push(boxAt(p.x, p.y));
    }
    // It must stop while the box still fits, not walk off the canvas.
    expect(gaveUp).toBe(true);
    for (const f of placed) {
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.x + f.width).toBeLessThanOrEqual(canvas.width);
    }
  });

  it("still steps off an occupied centre when there is room", () => {
    expect(cascadePoint({ x: 720, y: 720 }, [boxAt(720, 720)], canvas, size)).toEqual({
      x: 760,
      y: 760,
    });
  });
});

// Two cases upstream cannot have: it has no facility_logo field type, and it
// unlinked field-level brand colour bindings that Signature keeps.

describe("style clipboard, Signature specifics", () => {
  const headline: TemplateField = {
    id: "src",
    label: "Headline",
    fieldKey: "headline",
    type: "text",
    x: 0,
    y: 0,
    width: 500,
    height: 100,
    colorKey: "navy",
    colorHex: "#003b71",
    opacity: 80,
    cornerRadius: { tl: 4, tr: 4, br: 4, bl: 4 },
  };

  it("carries the brand colour binding, not just the resolved hex", () => {
    // Upstream drops colorKey because it unlinked field-level bindings. Here a
    // paste that kept only the hex would silently downgrade a palette-bound
    // field to a literal — and it would stop following a brand recolour.
    clearStyleClipboard();
    copyStyle(headline);
    const target: TemplateField = {
      ...headline,
      id: "dst",
      fieldKey: "other",
      colorKey: "teal",
      colorHex: "#44797b",
    };
    expect(applyClipboardStyle(target).colorKey).toBe("navy");
  });

  it("treats facility_logo as image style — no typography reaches it", () => {
    clearStyleClipboard();
    copyStyle(headline);
    const logo: TemplateField = {
      id: "fl",
      label: "Facility logo",
      fieldKey: "facility_logo",
      type: "facility_logo",
      x: 0,
      y: 0,
      width: 320,
      height: 160,
      objectFit: "contain",
    };
    const styled = applyClipboardStyle(logo);
    expect(styled.fontFamily).toBeUndefined();
    expect(styled.colorKey).toBeUndefined();
    expect(styled.textSizing).toBeUndefined();
    // The image-facing subset does transfer.
    expect(styled.opacity).toBe(80);
    expect(styled.cornerRadius).toEqual({ tl: 4, tr: 4, br: 4, bl: 4 });
    // Type and geometry are never touched.
    expect(styled.type).toBe("facility_logo");
    expect(styled.width).toBe(320);
  });
});

describe("repeated palette clicks land as a cascade, not a stack", () => {
  // The integration the cascade exists for: clicking a tile aims at the same
  // canvas centre every time. Without it the second element lands exactly on
  // the first and the click reads as "nothing happened".
  const add = (fields: TemplateField[], id: string): TemplateField => {
    const item = PALETTE_ITEMS.find((p) => p.id === id)!;
    const size = {
      width: Math.min(item.width, canvas.width),
      height: Math.min(item.height, canvas.height),
    };
    return fieldFromPalette(item, cascadePoint(center, fields, canvas, size), fields, null, canvas);
  };

  it("five clicks on Text give five distinct positions", () => {
    const fields: TemplateField[] = [];
    for (let i = 0; i < 5; i++) fields.push(add(fields, "text"));
    const seen = new Set(fields.map((f) => `${f.x},${f.y}`));
    expect(fields).toHaveLength(5);
    expect(seen.size).toBe(5);
    // Each step is down AND right of the last — Finder-style, not scattered.
    for (let i = 1; i < fields.length; i++) {
      expect(fields[i].x).toBeGreaterThan(fields[i - 1].x);
      expect(fields[i].y).toBeGreaterThan(fields[i - 1].y);
    }
  });

  it("every cascaded element still lands fully inside the canvas", () => {
    const fields: TemplateField[] = [];
    for (let i = 0; i < 12; i++) fields.push(add(fields, "text"));
    for (const f of fields) {
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x + f.width).toBeLessThanOrEqual(canvas.width);
      expect(f.y + f.height).toBeLessThanOrEqual(canvas.height);
    }
  });
});
