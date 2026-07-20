import type { FontAssetMetadata } from "../types";

const FORMAT_BY_EXT: Record<string, FontAssetMetadata["format"]> = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
};

export const FONT_ACCEPT = ".woff2,.woff,.ttf,.otf";
const MAX_FONT_BYTES = 5 * 1024 * 1024;

/** Validate an uploaded font file and derive @font-face metadata.
 * Returns an error string, or the metadata on success. */
export function validateFontFile(
  file: File,
): { ok: true; metadata: FontAssetMetadata } | { ok: false; error: string } {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const format = FORMAT_BY_EXT[ext];
  if (!format) {
    return { ok: false, error: `Unsupported font format ".${ext}" — use .woff2, .woff, .ttf, or .otf.` };
  }
  if (file.size > MAX_FONT_BYTES) {
    return { ok: false, error: "Font file is too large (max 5 MB)." };
  }
  const base = file.name.replace(/\.[^.]+$/, "");
  const italic = /italic/i.test(base);
  const weight = /bold/i.test(base) ? 700 : /light/i.test(base) ? 300 : /medium/i.test(base) ? 500 : 400;
  const family = base
    .replace(/[-_]?(regular|italic|bold|light|medium|black|thin|var(iable)?)/gi, "")
    .replace(/[-_]+/g, " ")
    .trim() || base;
  return { ok: true, metadata: { family, weight, style: italic ? "italic" : "normal", format } };
}
