import type { TemplateField, TemplateSchema } from "./types";
import classicPhotoNameBg from "@/assets/hall-of-fame/backgrounds/classic-photo-name.png";
import classicPhotoNameHighlightsBg from "@/assets/hall-of-fame/backgrounds/classic-photo-name-highlights.png";
import blackPhotoNameBg from "@/assets/hall-of-fame/backgrounds/black-photo-name.png";
import blackPhotoNameHighlightsBg from "@/assets/hall-of-fame/backgrounds/black-photo-name-highlights.png";
import ivoryPhotoNameBg from "@/assets/hall-of-fame/backgrounds/ivory-photo-name.png";
import ivoryPhotoNameHighlightsBg from "@/assets/hall-of-fame/backgrounds/ivory-photo-name-highlights.png";
import classicPhoto from "@/assets/hall-of-fame/placeholders/classic-photo.png";
import blackPhotoNamePhoto from "@/assets/hall-of-fame/placeholders/black-photo-name-photo.png";
import blackPhotoNameHighlightsPhoto from "@/assets/hall-of-fame/placeholders/black-photo-name-highlights-photo.png";
import ivoryPhotoNamePhoto from "@/assets/hall-of-fame/placeholders/ivory-photo-name-photo.png";
import ivoryPhotoNameHighlightsPhoto from "@/assets/hall-of-fame/placeholders/ivory-photo-name-highlights-photo.png";

/** Hall of Fame graphics: six FIXED templates (three styles, each in the two
 * layouts Signature asked for) served by the standalone /hall-of-fame pages.
 * Static data, never stored in Supabase, never listed in the facility
 * portal, never submitted. The pages render and export them entirely in the
 * browser through the same SchemaRenderer every portal template uses.
 *
 * Source design: Figma file lLB1ren1rYsPlO39gzbhnf ("SHC Hall of Fame Social
 * Templates"), section "Templates". Each background PNG is a frame's
 * "Background" layer exported at 1x; each field box below is the geometry of
 * the matching "field:<key>" layer in that frame's "Fields" layer, and each
 * photo placeholder is that frame's "field:winner_photo" layer. Change the
 * PNGs and these numbers together. */

export const HOF_PHOTO_KEY = "winner_photo";
export const HOF_NAME_KEY = "winner_name";
export const HOF_HIGHLIGHT_KEYS = ["highlight_1", "highlight_2", "highlight_3"] as const;

export const HOF_NAME_MAX = 30;
export const HOF_HIGHLIGHT_MAX = 45;

/** The name is set in Lora 600. signature.css loads Lora at 400/500/700 only,
 * and the renderer's own font request (weights 400-800 in one call) comes
 * back from Google as a single 400 face for Lora, so these pages load 600
 * themselves. The PNG export embeds exactly the weights in use and is
 * unaffected. */
export const HOF_FONT_STYLESHEET = "https://fonts.googleapis.com/css2?family=Lora:wght@600&display=swap";

/** Footer links. Empty until Signature confirms which privacy policy and
 * terms of use these pages should point at; the footer renders only when set. */
export const HOF_LEGAL_LINKS: ReadonlyArray<{ label: string; href: string }> = [];

/** How the winner's name is set.
 * - "line": one line that shrinks to fit (the renderer's measured
 *   single-line fit), moving to two lines only when that is clearly larger.
 *   For names centered on a plate or under the photo.
 * - "wrap": a fixed-width text box, like the Figma layer: wraps between words
 *   at the design size, and shrinks only when the name needs more than
 *   `maxLines` lines or the box height. Never below `minPx`. */
export type HofNameFit = { mode: "line" } | { mode: "wrap"; maxLines: number; minPx: number };

/** All three highlights share one size: the largest, from the design size
 * down to `minPx`, at which each fits in `maxLines` lines and its box. */
export interface HofHighlightFit {
  maxLines: number;
  minPx: number;
}

export interface HallOfFameTemplate {
  /** Same as schema.id; the library grid keys cards by it. */
  id: string;
  schema: TemplateSchema;
  /** Drawn in the photo slot until a winner photo is uploaded. Render-only:
   * never written into the field values, so the required check still fails. */
  photoPlaceholder: string;
  nameFit: HofNameFit;
  /** Present exactly when the template has highlights. */
  highlightFit?: HofHighlightFit;
}

const INK = "#15110C";
const CREAM = "#FBF3E6";

const STAMP = "2026-10-22T00:00:00.000Z";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function photoField({ x, y, width, height }: Box, archRadius = 0): TemplateField {
  return {
    id: HOF_PHOTO_KEY,
    fieldKey: HOF_PHOTO_KEY,
    label: "Winner photo",
    type: "image",
    x,
    y,
    width,
    height,
    zIndex: 1,
    // The crop dialog locks to the slot's own shape.
    aspectRatio: width / height,
    objectFit: "cover",
    // The modern black arches: a half circle across the top of the slot.
    ...(archRadius ? { cornerRadius: { tl: archRadius, tr: archRadius, br: 0, bl: 0 } } : {}),
    required: true,
  };
}

interface NameStyle {
  fontSizePx: number;
  lineHeight: number;
  color: string;
  align: "left" | "center";
  verticalAlign: "middle" | "bottom";
  /** Floor for the renderer's single-line shrink ("line" names). */
  minFontSizePx?: number;
}

function nameField({ x, y, width, height }: Box, style: NameStyle): TemplateField {
  return {
    id: HOF_NAME_KEY,
    fieldKey: HOF_NAME_KEY,
    label: "Winner's name",
    // One line in the form. hallOfFameFit decides how it is set on the
    // graphic (single line, or wrapped for the "wrap" templates).
    type: "text",
    x,
    y,
    width,
    height,
    zIndex: 2,
    fontFamily: "Lora",
    fontWeight: 600,
    fontSizePx: style.fontSizePx,
    minFontSizePx: style.minFontSizePx,
    colorHex: style.color,
    align: style.align,
    verticalAlign: style.verticalAlign,
    // Figma letter spacing is -1%: -0.01em at this size.
    letterSpacingPx: -style.fontSizePx / 100,
    lineHeight: style.lineHeight,
    maxLength: HOF_NAME_MAX,
    fixedWidth: true,
    placeholder: "Winner's name",
    required: true,
  };
}

interface HighlightStyle {
  fontSizePx: number;
  lineHeight: number;
  color: string;
  verticalAlign: "top" | "middle";
}

const HIGHLIGHT_PLACEHOLDERS = ["First highlight", "Second highlight", "Third highlight"];

/** Three highlight boxes of one size, stacked at `ys`. */
function highlightFields(x: number, ys: [number, number, number], width: number, height: number, style: HighlightStyle): TemplateField[] {
  return ys.map((y, index) => {
    const key = HOF_HIGHLIGHT_KEYS[index];
    return {
      id: key,
      fieldKey: key,
      label: `Highlight ${index + 1}`,
      // One line in the form (45 characters). hallOfFameFit turns these into
      // wrapping text at one shared size on the graphic.
      type: "text",
      x,
      y,
      width,
      height,
      zIndex: 3 + index,
      fontFamily: "Montserrat",
      fontWeight: 500,
      fontSizePx: style.fontSizePx,
      colorHex: style.color,
      align: "left",
      verticalAlign: style.verticalAlign,
      letterSpacingPx: -style.fontSizePx / 100,
      lineHeight: style.lineHeight,
      maxLength: HOF_HIGHLIGHT_MAX,
      fixedWidth: true,
      placeholder: HIGHLIGHT_PLACEHOLDERS[index],
      required: true,
    } satisfies TemplateField;
  });
}

export const HOF_LAYOUTS = [
  { key: "photo-name", title: "Photo and name" },
  { key: "photo-name-highlights", title: "Photo, name and highlights" },
] as const;

type LayoutKey = (typeof HOF_LAYOUTS)[number]["key"];

function schema(
  id: string,
  name: string,
  layout: LayoutKey,
  backgroundUrl: string,
  backgroundColor: string,
  fields: TemplateField[],
): TemplateSchema {
  return {
    id,
    companyId: "hall-of-fame",
    name,
    description: "",
    category: HOF_LAYOUTS.find((l) => l.key === layout)!.title,
    tags: ["hall-of-fame"],
    status: "published",
    canvasWidth: 1080,
    canvasHeight: 1080,
    backgroundUrl,
    // Base fill under the background image, so a slow PNG never paints the
    // renderer's white default first.
    backgroundColor,
    fields,
    captionTemplate: "",
    createdAt: STAMP,
    updatedAt: STAMP,
  };
}

const CLASSIC = { name: "Classic", background: "#CC9F50" };
const BLACK = { name: "Modern black", background: "#131110" };
const IVORY = { name: "Modern ivory", background: "#F7F2E8" };

/** Library order: each style in the photo and name layout, then each style
 * with highlights. */
export const HALL_OF_FAME_TEMPLATES: readonly HallOfFameTemplate[] = [
  {
    id: "classic-photo-name",
    schema: schema("classic-photo-name", CLASSIC.name, "photo-name", classicPhotoNameBg, CLASSIC.background, [
      photoField({ x: 275, y: 351, width: 530, height: 530 }),
      nameField(
        { x: 252, y: 912, width: 576, height: 110 },
        { fontSizePx: 60, lineHeight: 1.1, color: INK, align: "center", verticalAlign: "middle", minFontSizePx: 24 },
      ),
    ]),
    photoPlaceholder: classicPhoto,
    nameFit: { mode: "line" },
  },
  {
    id: "black-photo-name",
    schema: schema("black-photo-name", BLACK.name, "photo-name", blackPhotoNameBg, BLACK.background, [
      photoField({ x: 318, y: 328, width: 444, height: 537 }, 222),
      nameField(
        { x: 150, y: 902, width: 780, height: 110 },
        { fontSizePx: 60, lineHeight: 1.1, color: CREAM, align: "center", verticalAlign: "middle", minFontSizePx: 24 },
      ),
    ]),
    photoPlaceholder: blackPhotoNamePhoto,
    nameFit: { mode: "line" },
  },
  {
    id: "ivory-photo-name",
    schema: schema("ivory-photo-name", IVORY.name, "photo-name", ivoryPhotoNameBg, IVORY.background, [
      photoField({ x: 388, y: 84, width: 580, height: 620 }),
      nameField(
        { x: 84, y: 760, width: 912, height: 200 },
        { fontSizePx: 92, lineHeight: 1.05, color: INK, align: "left", verticalAlign: "bottom" },
      ),
    ]),
    photoPlaceholder: ivoryPhotoNamePhoto,
    nameFit: { mode: "wrap", maxLines: 2, minPx: 48 },
  },
  {
    id: "classic-photo-name-highlights",
    schema: schema(
      "classic-photo-name-highlights",
      CLASSIC.name,
      "photo-name-highlights",
      classicPhotoNameHighlightsBg,
      CLASSIC.background,
      [
        photoField({ x: 77, y: 419, width: 440, height: 440 }),
        nameField(
          { x: 90, y: 892, width: 414, height: 112 },
          { fontSizePx: 52, lineHeight: 1.1, color: INK, align: "center", verticalAlign: "middle", minFontSizePx: 18 },
        ),
        ...highlightFields(696, [426, 632, 838], 292, 146, {
          fontSizePx: 30,
          lineHeight: 1.25,
          color: INK,
          verticalAlign: "middle",
        }),
      ],
    ),
    photoPlaceholder: classicPhoto,
    nameFit: { mode: "line" },
    highlightFit: { maxLines: 3, minPx: 24 },
  },
  {
    id: "black-photo-name-highlights",
    schema: schema(
      "black-photo-name-highlights",
      BLACK.name,
      "photo-name-highlights",
      blackPhotoNameHighlightsBg,
      BLACK.background,
      [
        photoField({ x: 84, y: 311, width: 440, height: 640 }, 220),
        nameField(
          { x: 590, y: 343, width: 406, height: 170 },
          { fontSizePx: 56, lineHeight: 1.05, color: CREAM, align: "left", verticalAlign: "bottom" },
        ),
        // Top-aligned so each highlight's first line sits level with its
        // numeral in the background.
        ...highlightFields(642, [577, 701, 825], 354, 96, {
          fontSizePx: 26,
          lineHeight: 1.3,
          color: CREAM,
          verticalAlign: "top",
        }),
      ],
    ),
    photoPlaceholder: blackPhotoNameHighlightsPhoto,
    nameFit: { mode: "wrap", maxLines: 3, minPx: 28 },
    highlightFit: { maxLines: 2, minPx: 20 },
  },
  {
    id: "ivory-photo-name-highlights",
    schema: schema(
      "ivory-photo-name-highlights",
      IVORY.name,
      "photo-name-highlights",
      ivoryPhotoNameHighlightsBg,
      IVORY.background,
      [
        photoField({ x: 556, y: 84, width: 440, height: 560 }),
        nameField(
          { x: 84, y: 320, width: 420, height: 280 },
          { fontSizePx: 72, lineHeight: 1.05, color: INK, align: "left", verticalAlign: "bottom" },
        ),
        ...highlightFields(150, [744, 830, 916], 846, 60, {
          fontSizePx: 30,
          lineHeight: 1.2,
          color: INK,
          verticalAlign: "middle",
        }),
      ],
    ),
    photoPlaceholder: ivoryPhotoNameHighlightsPhoto,
    nameFit: { mode: "wrap", maxLines: 3, minPx: 36 },
    highlightFit: { maxLines: 1, minPx: 22 },
  },
];

export function hallOfFameTemplate(id: string): HallOfFameTemplate | undefined {
  return HALL_OF_FAME_TEMPLATES.find((t) => t.id === id);
}

/** Download file name: "Hall_of_Fame_Michael_Thomas.png" once a name is in.
 * exportSchemaPng turns everything outside A-Z, 0-9, _ and - into "_", so
 * accents are folded first ("Zoë Ångström" downloads as
 * Hall_of_Fame_Zoe_Angstrom.png) and letters with no plain form are left
 * out rather than turned into stray underscores. */
export function exportNameFor(winnerName: string | undefined): string {
  const plain = (winnerName ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
  return /[A-Za-z0-9]/.test(plain) ? `Hall of Fame ${plain}` : "Hall of Fame";
}
