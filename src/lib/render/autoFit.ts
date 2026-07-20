import type { TemplateField } from "../types";

/** Shrink-to-fit font sizing, generalized from the reference Generator's
 * fact-row formula `clamp(22, 920 / (len * 0.58), 45)`: the divisor scales
 * with the FIELD's width instead of a hardcoded 920, so it works for any box.
 */
const AVG_CHAR_WIDTH_RATIO = 0.58;

export function fittedFontSize(field: TemplateField, text: string): number {
  const max = field.fontSizePx ?? 45;
  if (!field.autoFit || !text) return max;
  const min = field.minFontSizePx ?? Math.min(18, max);
  const fitted = (field.width * 2) / (Math.max(text.length, 1) * AVG_CHAR_WIDTH_RATIO);
  return Math.max(min, Math.min(max, fitted));
}
