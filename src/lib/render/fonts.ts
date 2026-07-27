import type { BrandAsset, BrandKit, FontRef, TemplateSchema } from "../types";
import { resolveFieldStyle } from "../brand/resolveStyle";

/** Curated Google Fonts list offered in Brand Studio / onboarding. */
export const GOOGLE_FONTS = [
  "Archivo", "Bebas Neue", "Cabin", "DM Sans", "Fira Sans", "Inter",
  "Josefin Sans", "Karla", "Lato", "Libre Baskerville", "Lora", "Manrope",
  "Merriweather", "Montserrat", "Mulish", "Nunito", "Open Sans", "Oswald",
  "Outfit", "Playfair Display", "Plus Jakarta Sans", "Poppins", "Raleway",
  "Roboto", "Roboto Slab", "Rubik", "Sora", "Source Sans 3", "Space Grotesk",
  "Work Sans",
] as const;

const loadedGoogleFamilies = new Set<string>();
const registeredCustomAssets = new Set<string>();
const customFaceCss = new Map<string, string>(); // family → @font-face css (data-URL src)

/** Load Google font families via the css2 API (link injection).
 *
 * One <link> PER family, never a batch: callers pass every family a schema
 * references, which can include uploaded custom families or Figma-imported
 * names Google doesn't know — and css2 answers 400 for the ENTIRE request if
 * any one family is invalid. Batched, one custom font silently killed every
 * Google font that shared its link. Families already registered as custom
 * @font-faces are skipped outright. */
export function loadGoogleFonts(families: string[]): void {
  const fresh = families.filter(
    (f) => f && !loadedGoogleFamilies.has(f) && !customFaceCss.has(f),
  );
  for (const family of fresh) {
    loadedGoogleFamilies.add(family);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=" +
      `${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;600;700;800` +
      "&display=swap";
    document.head.appendChild(link);
  }
}

/** Register an uploaded font file as a runtime @font-face with a data-URL src,
 * making the family usable everywhere the app renders text AND embeddable in
 * PNG exports (via buildFontEmbedCss). */
export async function registerCustomFont(asset: BrandAsset): Promise<void> {
  if (registeredCustomAssets.has(asset.id)) return;
  registeredCustomAssets.add(asset.id);
  const family = asset.metadata.family ?? asset.name.replace(/\.[^.]+$/, "");
  try {
    const dataUrl = asset.url.startsWith("data:")
      ? asset.url
      : await (async () => {
          const blob = await (await fetch(asset.url)).blob();
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        })();
    const format = asset.metadata.format ?? "woff2";
    const css = `@font-face {
  font-family: "${family}";
  src: url("${dataUrl}") format("${format}");
  font-weight: ${asset.metadata.weight ?? 400};
  font-style: ${asset.metadata.style ?? "normal"};
}`;
    const style = document.createElement("style");
    style.dataset.customFont = asset.id;
    style.textContent = css;
    document.head.appendChild(style);
    customFaceCss.set(family, css);
    await document.fonts.load(`16px "${family}"`).catch(() => undefined);
  } catch (e) {
    registeredCustomAssets.delete(asset.id);
    console.error("Custom font registration failed", asset.name, e);
  }
}

/** Load every font a brand kit references (Google + custom).
 *
 * EVERY uploaded font asset registers, not just the heading/body picks:
 * fields and type styles reference uploaded families directly, and a family
 * without a registered @font-face renders as fallback sans-serif everywhere
 * and embeds nothing at export. Registration was previously session-local to
 * the upload — after a reload, only heading/body customs came back. */
export async function loadBrandFonts(kit: BrandKit, fontAssets: BrandAsset[]): Promise<void> {
  const refs = [kit.headingFont, kit.bodyFont].filter((r): r is FontRef => Boolean(r));
  loadGoogleFonts(refs.filter((r) => r.source === "google").map((r) => r.family));
  await Promise.all(fontAssets.map((asset) => registerCustomFont(asset)));
}

/** Families a schema's fields actually render with — resolved through the
 * brand rules engine when a kit is given, so type-style-bound fonts count
 * too (f.fontFamily alone misses them). */
export function schemaFontFamilies(schema: TemplateSchema, kit?: BrandKit | null): string[] {
  return [
    ...new Set(
      schema.fields
        .map((f) => (kit !== undefined ? resolveFieldStyle(f, kit).fontFamily : f.fontFamily))
        .filter((f): f is string => Boolean(f)),
    ),
  ];
}

/** family + weights → schema-usable weights per family. */
function schemaFamilyWeights(schema: TemplateSchema, kit?: BrandKit | null): Map<string, number[]> {
  const weights = new Map<string, Set<number>>();
  for (const f of schema.fields) {
    const style = kit !== undefined ? resolveFieldStyle(f, kit) : f;
    if (!style.fontFamily) continue;
    const set = weights.get(style.fontFamily) ?? new Set<number>();
    set.add(style.fontWeight ?? 400);
    weights.set(style.fontFamily, set);
  }
  return new Map([...weights].map(([fam, set]) => [fam, [...set].sort((a, b) => a - b)]));
}

/** Wait until every family used by the schema is ready — called before export
 * so the rasterized PNG uses the correct typefaces. */
export async function ensureSchemaFontsLoaded(
  schema: TemplateSchema,
  kit?: BrandKit | null,
): Promise<void> {
  await Promise.all(
    schemaFontFamilies(schema, kit).map((family) =>
      document.fonts.load(`16px "${family}"`).catch(() => undefined),
    ),
  );
  await document.fonts.ready;
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/** family:weights → css2 @font-face blocks with binaries inlined as data URLs. */
const googleEmbedCss = new Map<string, string | null>();

async function buildGoogleEmbedCss(family: string, weights: number[]): Promise<string | null> {
  const key = `${family}:${weights.join(",")}`;
  if (googleEmbedCss.has(key)) return googleEmbedCss.get(key)!;
  try {
    const cssUrl =
      "https://fonts.googleapis.com/css2?family=" +
      `${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${weights.join(";")}` +
      "&display=swap";
    const res = await fetch(cssUrl);
    if (!res.ok) throw new Error(`css2 ${res.status}`);
    let css = await res.text();
    const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
    await Promise.all(
      urls.map(async (u) => {
        const dataUrl = await blobToDataUrl(await (await fetch(u)).blob());
        css = css.split(u).join(dataUrl);
      }),
    );
    googleEmbedCss.set(key, css);
    return css;
  } catch (e) {
    console.error("Google font embed failed", family, e);
    googleEmbedCss.set(key, null); // unknown family (e.g. a system font) — don't refetch
    return null;
  }
}

/** CSS passed to html-to-image's fontEmbedCSS: EVERY family the schema
 * renders with, embedded as data-URL @font-faces — uploaded faces from the
 * registry, Google faces fetched and inlined (only the weights in use).
 *
 * Embedding everything is load-bearing: the snapshot SVG rasterizes in an
 * isolated context on Safari and Firefox, with NO access to the document's
 * font cache — the old skipFonts path only ever worked on Chromium, which is
 * why exports downloaded from phones fell back to system fonts. */
export async function buildExportFontEmbedCss(
  schema: TemplateSchema,
  kit?: BrandKit | null,
): Promise<string | undefined> {
  const parts = await Promise.all(
    [...schemaFamilyWeights(schema, kit)].map(([family, weights]) => {
      const custom = customFaceCss.get(family);
      return custom ? Promise.resolve(custom) : buildGoogleEmbedCss(family, weights);
    }),
  );
  const css = parts.filter((c): c is string => Boolean(c)).join("\n");
  return css || undefined;
}
