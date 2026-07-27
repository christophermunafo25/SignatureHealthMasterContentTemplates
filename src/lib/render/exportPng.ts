import { toPng } from "html-to-image";
import type { TemplateSchema } from "../types";
import { buildFontEmbedCss, ensureSchemaFontsLoaded } from "./fonts";

export type ExportOutcome = "downloaded" | "shared" | "canceled";

/** Export a rendered schema node to PNG and hand it to the user.
 *
 * Ported from the reference Generator's handleDownload:
 *  - dimensions come from the SCHEMA, never a literal
 *  - toPng runs twice with a short pause (Safari image-decode warm-up)
 *  - mobile tries navigator.share with a File, falling back to a download
 * Custom uploaded fonts are embedded via fontEmbedCSS; Google fonts render
 * from the document font cache (skipFonts), matching the proven export path.
 */
export async function exportSchemaPng(
  schema: TemplateSchema,
  node: HTMLElement,
): Promise<ExportOutcome> {
  await ensureSchemaFontsLoaded(schema);
  const fontEmbedCss = buildFontEmbedCss(schema);
  const options = {
    width: schema.canvasWidth,
    height: schema.canvasHeight,
    pixelRatio: 1,
    canvasWidth: schema.canvasWidth,
    canvasHeight: schema.canvasHeight,
    skipFonts: !fontEmbedCss,
    ...(fontEmbedCss ? { fontEmbedCSS: fontEmbedCss } : {}),
  };

  await toPng(node, options);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const dataUrl = await toPng(node, options);

  // One Blob serves both branches; browsers handle multi-megabyte base64
  // hrefs inconsistently, so the data URL is dropped as early as possible.
  const blob = await (await fetch(dataUrl)).blob();

  const fileName = `${schema.name.replace(/[^a-zA-Z0-9_-]+/g, "_") || "graphic"}.png`;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile && navigator.share) {
    try {
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: schema.name });
        return "shared";
      }
    } catch (e) {
      // Closing the share sheet is a decision, not a failure — don't force
      // a download the person just declined.
      if (e instanceof DOMException && e.name === "AbortError") return "canceled";
      // Anything else (e.g. the render outlived the tap's transient
      // activation → NotAllowedError) falls back to a plain download.
      console.log("Share failed, falling back to download", e);
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = objectUrl;
  link.click();
  // Mobile browsers start blob downloads ASYNCHRONOUSLY after click() —
  // revoking on the next tick aborts them (failed or zero-byte files on
  // iOS Safari). Keep the URL alive well past any plausible start.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  return "downloaded";
}
