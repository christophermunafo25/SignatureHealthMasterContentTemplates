import type { BrandKit } from "./types";

/** Expose the active tenant's brand kit as --brand-* CSS variables.
 *
 * The platform chrome is styled by the SocialPaint design system
 * (src/styles/socialpaint.css) and is NOT re-themed per tenant — tenant
 * brand expression lives in the template graphics, the brand-kit pickers,
 * and --brand-* accents on template-adjacent surfaces. */
const touched = new Set<string>();

export function applyBrandTheme(kit: BrandKit | null): void {
  const root = document.documentElement;
  // Reset anything a previously selected tenant set.
  for (const name of touched) root.style.removeProperty(name);
  touched.clear();
  if (!kit) return;

  for (const color of kit.colors) {
    const brandVar = `--brand-${color.key}`;
    root.style.setProperty(brandVar, color.hex);
    touched.add(brandVar);
  }
  if (kit.headingFont) {
    root.style.setProperty("--brand-font-heading", `"${kit.headingFont.family}", sans-serif`);
    touched.add("--brand-font-heading");
  }
  if (kit.bodyFont) {
    root.style.setProperty("--brand-font-body", `"${kit.bodyFont.family}", sans-serif`);
    touched.add("--brand-font-body");
  }
}

/** Starting type styles offered by onboarding — pre-filled with the
 * Signature HealthCare brand spec (Montserrat headlines, Lora body);
 * editable without limit. */
export const DEFAULT_TYPE_STYLES = [
  { key: "heading", name: "Heading", font: { source: "google" as const, family: "Montserrat" }, weight: 700, uppercase: true, colorKey: "text", autoFit: true },
  { key: "subhead", name: "Subhead", font: { source: "google" as const, family: "Montserrat" }, weight: 600, colorKey: "text" },
  { key: "body", name: "Body", font: { source: "google" as const, family: "Lora" }, weight: 400, colorKey: "text", maxLength: 200 },
];

/** Starting palette offered by onboarding — pre-filled with the Signature
 * HealthCare brand colors (Pantone 541 C / 7475 C / 1375 C / 5185 C /
 * 7499 C); the user can still override per company. */
export const DEFAULT_PALETTE = [
  { key: "primary", name: "Primary", hex: "#003B71" },
  { key: "secondary", name: "Secondary", hex: "#44797B" },
  { key: "accent", name: "Accent", hex: "#FF9E18" },
  { key: "text", name: "Text", hex: "#4C3041" },
  { key: "background", name: "Background", hex: "#F1E4B2" },
];
