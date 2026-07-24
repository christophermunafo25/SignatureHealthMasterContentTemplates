/** Downscale an image data URL so its long edge is at most `maxEdge` px.
 *
 * Phone photos run 5–12MB and 4000+px; templates render at schema canvas
 * size (1440 today), so anything past ~2048px contributes no visible quality
 * while the base64 original, the crop result, and the double toPng export
 * each hold a full copy in memory — a plausible mobile-Safari tab crash.
 *
 * Alpha is preserved: PNG/WEBP sources re-encode as PNG (some templates rely
 * on transparent uploads); everything else becomes JPEG at 0.92. Images
 * already within bounds pass through untouched.
 */
export async function downscaleImage(dataUrl: string, maxEdge: number): Promise<string> {
  const img = await loadImage(dataUrl);
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
  if (longEdge <= maxEdge) return dataUrl;

  const scale = maxEdge / longEdge;
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);

  const hasAlpha = /^data:image\/(png|webp)/i.test(dataUrl);
  return hasAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.92);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = src;
  });
}
