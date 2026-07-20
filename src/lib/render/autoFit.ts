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
