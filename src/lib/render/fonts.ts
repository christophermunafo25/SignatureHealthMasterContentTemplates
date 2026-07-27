import type { BrandAsset, BrandKit, FontRef, TemplateSchema } from "../types";

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

/** Families a schema's fields actually use. */
export function schemaFontFamilies(schema: TemplateSchema): string[] {
  return [...new Set(schema.fields.map((f) => f.fontFamily).filter((f): f is string => Boolean(f)))];
}

/** Wait until every family used by the schema is ready — called before export
 * so the rasterized PNG uses the correct typefaces. */
export async function ensureSchemaFontsLoaded(schema: TemplateSchema): Promise<void> {
  await Promise.all(
    schemaFontFamilies(schema).map((family) =>
      document.fonts.load(`16px "${family}"`).catch(() => undefined),
    ),
  );
  await document.fonts.ready;
}

/** CSS passed to html-to-image's fontEmbedCSS so custom (uploaded) fonts are
 * embedded in the export. Google fonts render from the document font cache
 * (the reference app's proven skipFonts path); custom faces need embedding. */
export function buildFontEmbedCss(schema: TemplateSchema): string | undefined {
  const css = schemaFontFamilies(schema)
    .map((family) => customFaceCss.get(family))
    .filter((c): c is string => Boolean(c))
    .join("\n");
  return css || undefined;
}
