/** Shrink-to-fit font sizing, generalized from the reference Generator's
 * fact-row formula `clamp(22, 920 / (len * 0.58), 45)`: the divisor scales
 * with the box width instead of a hardcoded 920, so it works for any box.
 * Takes RESOLVED values so brand-rule bindings are already applied. */
const AVG_CHAR_WIDTH_RATIO = 0.58;

interface FitInput {
  width: number;
  fontSizePx?: number;
  minFontSizePx?: number;
  autoFit?: boolean;
}

export function fittedFontSize(input: FitInput, text: string): number {
  const max = input.fontSizePx ?? 45;
  if (!input.autoFit || !text) return max;
  const min = input.minFontSizePx ?? Math.min(18, max);
  const fitted = (input.width * 2) / (Math.max(text.length, 1) * AVG_CHAR_WIDTH_RATIO);
  return Math.max(min, Math.min(max, fitted));
}

// ---------------------------------------------------------------------------
// Fixed-width fit — the box width is a HARD constraint. Unlike the estimate
// above, this measures the actual glyphs in the field's font via a canvas
// context, so single-line text shrinks exactly at the point it would escape.
// ---------------------------------------------------------------------------

interface FixedFitInput {
  width: number;
  fontSizePx?: number;
  minFontSizePx?: number;
  fontFamily?: string;
  fontWeight?: number;
  letterSpacingPx?: number;
  uppercase?: boolean;
}

let measureCtx: CanvasRenderingContext2D | null = null;

export function fixedWidthFontSize(input: FixedFitInput, text: string): number {
  const base = input.fontSizePx ?? 45;
  if (!text) return base;
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) {
    // No canvas (never in practice) — fall back to the estimate.
    return fittedFontSize({ ...input, autoFit: true }, text);
  }
  const sample = input.uppercase ? text.toUpperCase() : text;
  const family = input.fontFamily ? `"${input.fontFamily}", sans-serif` : "sans-serif";
  measureCtx.font = `${input.fontWeight ?? 400} ${base}px ${family}`;
  // letter-spacing is a per-gap constant that does NOT scale with font size
  const spacing = (input.letterSpacingPx ?? 0) * Math.max(0, sample.length - 1);
  const glyphs = measureCtx.measureText(sample).width;
  if (glyphs + spacing <= input.width) return base;
  const min = input.minFontSizePx ?? 8;
  const avail = Math.max(4, input.width - spacing);
  return Math.max(min, Math.floor(base * (avail / glyphs)));
}
