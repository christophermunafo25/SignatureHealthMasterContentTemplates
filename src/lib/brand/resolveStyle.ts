import type { BrandKit, BrandTypeStyle, TemplateField } from "../types";

/** The styling a field actually renders with after the brand rules engine
 * applies: any property the bound type style DEFINES wins over the field's
 * own value; undefined properties fall through to the field. */
export interface ResolvedFieldStyle {
  fontFamily?: string;
  fontWeight?: number;
  fontSizePx?: number;
  minFontSizePx?: number;
  uppercase?: boolean;
  letterSpacingPx?: number;
  lineHeight?: number;
  colorKey?: string;
  colorHex?: string;
  textGradient?: import("../types").TextGradient;
  maxLength?: number;
  textSizing?: "free" | "shrink" | "fill";
  /** The style that supplied the locked properties, if any. */
  boundStyle?: BrandTypeStyle;
}

/** Legacy booleans → the explicit mode. Both flags meant "shrink"; the field
 *  they sat on is what migration 0030 backfilled. This is the read-side
 *  fallback for anything the backfill did not reach (a locally cached draft,
 *  a row restored from a pre-migration backup). */
function legacyTextSizing(v: {
  textSizing?: "free" | "shrink" | "fill";
  autoFit?: boolean;
  fixedWidth?: boolean;
}): "free" | "shrink" | "fill" | undefined {
  if (v.textSizing) return v.textSizing;
  return v.autoFit || v.fixedWidth ? "shrink" : undefined;
}

export function getTypeStyle(kit: BrandKit | null, key: string | undefined): BrandTypeStyle | undefined {
  if (!kit || !key) return undefined;
  return kit.typeStyles?.find((s) => s.key === key);
}

export function resolveFieldStyle(field: TemplateField, kit: BrandKit | null): ResolvedFieldStyle {
  const style = getTypeStyle(kit, field.typeStyleKey);
  return {
    fontFamily: style?.font?.family ?? field.fontFamily,
    fontWeight: style?.weight ?? field.fontWeight,
    fontSizePx: style?.fontSizePx ?? field.fontSizePx,
    minFontSizePx: field.minFontSizePx,
    uppercase: style?.uppercase ?? field.uppercase,
    letterSpacingPx: style?.letterSpacingPx ?? field.letterSpacingPx,
    lineHeight: style?.lineHeight ?? field.lineHeight,
    colorKey: style?.colorKey ?? field.colorKey,
    colorHex: field.colorHex,
    textGradient: field.textGradient,
    maxLength: style?.maxLength ?? field.maxLength,
    textSizing: (style && legacyTextSizing(style)) ?? legacyTextSizing(field),
    boundStyle: style,
  };
}

/** Which field-level controls a bound style locks (for the builder UI). */
export function lockedProperties(style: BrandTypeStyle | undefined): Set<string> {
  const locked = new Set<string>();
  if (!style) return locked;
  if (style.font) locked.add("fontFamily");
  if (style.weight !== undefined) locked.add("weight");
  if (style.fontSizePx !== undefined) locked.add("fontSizePx");
  if (style.uppercase !== undefined) locked.add("uppercase");
  if (style.letterSpacingPx !== undefined) locked.add("letterSpacingPx");
  if (style.lineHeight !== undefined) locked.add("lineHeight");
  if (style.colorKey !== undefined) locked.add("colorKey");
  if (style.maxLength !== undefined) locked.add("maxLength");
  if (legacyTextSizing(style) !== undefined) locked.add("textSizing");
  return locked;
}

/** Human-readable rule sentences for a type style — how marketing sees the
 * rules they've encoded ("Heading is always uppercase"). */
export function ruleSentences(style: BrandTypeStyle, kit: BrandKit | null): string[] {
  const rules: string[] = [];
  const colorName = kit?.colors.find((c) => c.key === style.colorKey)?.name;
  if (style.font) {
    rules.push(
      `${style.name} is always ${style.font.family}${style.weight ? ` ${weightName(style.weight)}` : ""}${colorName ? ` in ${colorName}` : ""}.`,
    );
  } else if (colorName) {
    rules.push(`${style.name} is always ${colorName}.`);
  }
  if (style.uppercase) rules.push(`${style.name} is always UPPERCASE.`);
  if (style.fontSizePx !== undefined) rules.push(`${style.name} is fixed at ${style.fontSizePx}px.`);
  if (style.maxLength !== undefined) rules.push(`${style.name} never exceeds ${style.maxLength} characters.`);
  const sizing = legacyTextSizing(style);
  if (sizing === "shrink") rules.push(`${style.name} shrinks to fit its box.`);
  if (sizing === "fill") rules.push(`${style.name} is sized to fill its box.`);
  if (sizing === "free") rules.push(`${style.name} keeps its set size — the box grows with content.`);
  return rules;
}

function weightName(w: number): string {
  if (w >= 700) return "Bold";
  if (w >= 600) return "SemiBold";
  if (w >= 500) return "Medium";
  if (w <= 300) return "Light";
  return "Regular";
}
