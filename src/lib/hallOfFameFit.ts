import type { FieldValues, TemplateField, TemplateSchema } from "./types";
import {
  HOF_HIGHLIGHT_KEYS,
  HOF_NAME_KEY,
  type HallOfFameTemplate,
  type HofHighlightFit,
  type HofNameFit,
} from "./hallOfFame";

/** Text fitting for the Hall of Fame templates. Pure functions: the pages
 * back `MeasureText` with canvas measureText in the real face; tests use a
 * fake. Output is a derived TemplateSchema with adjusted sizes and line
 * modes, so the library thumbnail, the live preview, and the PNG export all
 * render the same layout through the unchanged SchemaRenderer. */

/** Advance width of `text` at `fontSizePx` in one specific face, in px,
 * before letter spacing. */
export type MeasureText = (text: string, fontSizePx: number) => number;

export interface FitMeasurers {
  /** Lora 600 (winner's name). */
  name: MeasureText;
  /** Montserrat 500 (highlights). */
  highlight: MeasureText;
}

/** Canvas and the browser's line breaker disagree by a few px at the edges.
 * Planning against a 3% narrower box means the model never promises fewer
 * lines than the browser draws (0 under-counts across the Chromium corpus;
 * it can over-count by one, which only costs a px of size). */
const SAFE_WIDTH = 0.97;

/** Figma tracks both text styles at -1%, i.e. -0.01em. */
export const trackingPx = (fontSizePx: number) => -fontSizePx / 100;

function widthWithTracking(measure: MeasureText, text: string, fontSizePx: number): number {
  return measure(text, fontSizePx) + trackingPx(fontSizePx) * text.length;
}

interface Token {
  text: string;
  /** True when a space separates this token from the previous one. */
  afterSpace: boolean;
}

/** Break opportunities the browser uses for this text: spaces (the space is
 * dropped at a wrap) and right after a hyphen (the hyphen stays on the line).
 * Written without regex lookbehind, which older iOS Safari can't parse. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const words = text.split(" ");
  words.forEach((word, wordIndex) => {
    let part = "";
    let first = true;
    for (const ch of word) {
      part += ch;
      if (ch === "-") {
        tokens.push({ text: part, afterSpace: wordIndex > 0 && first });
        part = "";
        first = false;
      }
    }
    if (part || first) tokens.push({ text: part, afterSpace: wordIndex > 0 && first });
  });
  return tokens.filter((t) => t.text !== "");
}

/** Greedy line count for `white-space: pre-wrap; word-break: break-word`,
 * which is how the renderer sets multiline fields. With `allowMidWord` off, a
 * token wider than the box returns Infinity instead of being split. */
export function wrapLineCount(
  text: string,
  maxWidth: number,
  width: (s: string) => number,
  allowMidWord = true,
): number {
  const tokens = tokenize(text);
  if (tokens.length === 0) return 0;
  let lines = 1;
  let current = "";
  for (const token of tokens) {
    const candidate = current ? current + (token.afterSpace ? " " : "") + token.text : token.text;
    if (width(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines += 1;
    current = token.text;
    while (width(current) > maxWidth && current.length > 1) {
      if (!allowMidWord) return Infinity;
      let k = current.length;
      while (k > 1 && width(current.slice(0, k)) > maxWidth) k -= 1;
      current = current.slice(k);
      lines += 1;
    }
  }
  return lines;
}

/** The size SchemaRenderer's fixed-width fit will choose for a single-line
 * field (mirrors fixedWidthFontSize in src/lib/render/autoFit.ts). */
export function singleLineSize(text: string, field: TemplateField, measure: MeasureText): number {
  const base = field.fontSizePx ?? 45;
  if (!text) return base;
  const spacing = (field.letterSpacingPx ?? 0) * Math.max(0, text.length - 1);
  const glyphs = measure(text, base);
  if (glyphs + spacing <= field.width) return base;
  const min = field.minFontSizePx ?? 8;
  const avail = Math.max(4, field.width - spacing);
  return Math.max(min, Math.floor(base * (avail / glyphs)));
}

/** Text exactly as the graphic shows it: trimmed, with every run of
 * whitespace as one space. Multiline fields render with `pre-wrap`, which
 * keeps repeated spaces, while the wrap model counts one per gap, so the
 * page renders this, never the raw input. */
export function displayText(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

/** The field as wrapping text at `fontSizePx`, tracked to match. */
function asMultiline(field: TemplateField, fontSizePx: number, lineHeight = field.lineHeight): TemplateField {
  return {
    ...field,
    type: "multiline",
    fontSizePx,
    minFontSizePx: undefined,
    letterSpacingPx: trackingPx(fontSizePx),
    lineHeight,
  };
}

/** A fitted name as wrapping text. The fit already keeps it inside the box,
 * so the box doesn't clip: at the names' tight leading, Lora's descenders
 * (g, j, p, q, y) hang below the last line box, and a bottom-aligned name
 * would lose them to `overflow: hidden` (fixedWidth only toggles that clip
 * for multiline text). */
function asWrappedName(field: TemplateField, fontSizePx: number, lineHeight = field.lineHeight): TemplateField {
  return { ...asMultiline(field, fontSizePx, lineHeight), fixedWidth: false };
}

/** When a name has to shrink, each extra line has to buy at least this much
 * size; otherwise the name keeps fewer lines. */
const LINE_BREAK_MIN_GAIN_PX = 6;

/** A "line" name that breaks onto two lines keeps this much clear above and
 * below the pair, which clears the classic name plates' inner keyline. */
const TWO_LINE_INSET_PX = 12;
const TWO_LINE_LEADING = 1.05;

/** Lines `name` takes at `size` in `field`, never splitting a word
 * (Infinity when a word is wider than the box). */
function nameLines(field: TemplateField, name: string, measure: MeasureText, size: number): number {
  return wrapLineCount(name, field.width * SAFE_WIDTH, (s) => widthWithTracking(measure, s, size), false);
}

/** "line" names: one line at full size when it fits; the renderer's own
 * single-line shrink for moderately long names; two lines when that is at
 * least 6px larger than the single-line size. Never splits inside a word. */
export function fitLineName(field: TemplateField, name: string, measure: MeasureText): TemplateField {
  const base = field.fontSizePx ?? 45;
  const single = singleLineSize(name, field, measure);
  if (single >= base) return field;
  const top = Math.min(base, Math.floor((field.height - 2 * TWO_LINE_INSET_PX) / (2 * TWO_LINE_LEADING)));
  for (let size = top; size >= single + LINE_BREAK_MIN_GAIN_PX; size -= 1) {
    if (nameLines(field, name, measure, size) <= 2) return asWrappedName(field, size, TWO_LINE_LEADING);
  }
  return field;
}

/** "wrap" names: set like the Figma fixed-width text box. At the design size
 * the name wraps between words to however many lines it takes, up to
 * `maxLines`. A name that has to shrink gets the largest size that fits,
 * on the fewest lines that come within 6px of it ("WASHINGTON-HALL" stays
 * whole instead of breaking at its hyphen for 3px). A word too wide for the
 * box even at the floor is the one case the renderer splits mid-word. */
export function fitWrappedName(
  field: TemplateField,
  name: string,
  measure: MeasureText,
  fit: { maxLines: number; minPx: number },
): TemplateField {
  const base = field.fontSizePx ?? 45;
  const lineHeight = field.lineHeight ?? 1.1;
  const holds = (size: number, maxLines: number) => {
    const lines = nameLines(field, name, measure, size);
    return lines <= maxLines && lines * size * lineHeight <= field.height;
  };
  if (holds(base, fit.maxLines)) return asWrappedName(field, base);

  // Largest size below the design size for each line limit, 1..maxLines.
  const largest: Array<number | undefined> = [];
  for (let limit = 1; limit <= fit.maxLines; limit += 1) {
    let found: number | undefined;
    for (let size = base - 1; size >= fit.minPx && found === undefined; size -= 1) {
      if (holds(size, limit)) found = size;
    }
    largest.push(found);
  }
  const sizes = largest.filter((s): s is number => s !== undefined);
  if (sizes.length === 0) return asWrappedName(field, fit.minPx);
  const best = Math.max(...sizes);
  return asWrappedName(field, sizes.find((s) => s >= best - LINE_BREAK_MIN_GAIN_PX) ?? best);
}

export function fitName(field: TemplateField, text: string, measure: MeasureText, fit: HofNameFit): TemplateField {
  const name = displayText(text);
  if (!name) return field;
  return fit.mode === "wrap" ? fitWrappedName(field, name, measure, fit) : fitLineName(field, name, measure);
}

/** One shared size for all three highlights: the largest size, from the
 * field's own size down to the floor, at which every highlight fits in
 * `maxLines` lines and its box. */
export function fitHighlightSize(
  texts: string[],
  field: TemplateField,
  measure: MeasureText,
  fit: HofHighlightFit,
): number {
  const lineHeight = field.lineHeight ?? 1.1;
  const fits = (text: string, size: number) => {
    const lines = wrapLineCount(text, field.width * SAFE_WIDTH, (s) => widthWithTracking(measure, s, size));
    return lines <= fit.maxLines && lines * size * lineHeight <= field.height;
  };
  let size = field.fontSizePx ?? 30;
  for (const raw of texts) {
    const text = displayText(raw);
    if (!text) continue;
    while (size > fit.minPx && !fits(text, size)) size -= 1;
  }
  return size;
}

/** The template as it should render for these values, which should already
 * be `displayText`. Empty text fields are fitted on their placeholder, so an
 * unfilled template (the library thumbnail) is set the way a filled one
 * would be. */
export function fitTemplate(template: HallOfFameTemplate, values: FieldValues, measurers: FitMeasurers): TemplateSchema {
  const { schema, nameFit, highlightFit } = template;
  const shown = (f: TemplateField) => displayText(values[f.fieldKey]) || f.placeholder || "";
  const highlightKeys: readonly string[] = HOF_HIGHLIGHT_KEYS;
  const highlights = schema.fields.filter((f) => highlightKeys.includes(f.fieldKey));
  const highlightSize =
    highlights.length > 0 && highlightFit
      ? fitHighlightSize(highlights.map(shown), highlights[0], measurers.highlight, highlightFit)
      : undefined;
  return {
    ...schema,
    fields: schema.fields.map((f) => {
      if (f.fieldKey === HOF_NAME_KEY) return fitName(f, shown(f), measurers.name, nameFit);
      if (highlightSize !== undefined && highlightKeys.includes(f.fieldKey)) return asMultiline(f, highlightSize);
      return f;
    }),
  };
}
