import type { BrandKit } from "./types";

/** Map well-known brand palette keys onto the app's CSS variables so the
 * whole UI themes itself from the active tenant's brand kit. Custom-named
 * palette entries are exposed as --brand-<key> for template chrome. */
const VAR_MAP: Record<string, string[]> = {
  primary: ["--primary", "--ring"],
  secondary: ["--secondary"],
  accent: ["--accent"],
  text: ["--foreground"],
  background: ["--background"],
};

const touched = new Set<string>();

export function applyBrandTheme(kit: BrandKit | null): void {
  const root = document.documentElement;
  // Reset anything a previously selected tenant set (neutral default returns).
  for (const name of touched) root.style.removeProperty(name);
  touched.clear();
  if (!kit) return;

  for (const color of kit.colors) {
    for (const varName of VAR_MAP[color.key] ?? []) {
      root.style.setProperty(varName, color.hex);
      touched.add(varName);
    }
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

/** Sensible starting palette offered by onboarding — the user overrides these;
 * nothing brand-specific ships. */
export const DEFAULT_PALETTE = [
  { key: "primary", name: "Primary", hex: "#2F3B4C" },
  { key: "secondary", name: "Secondary", hex: "#E7EAEF" },
  { key: "accent", name: "Accent", hex: "#C9A227" },
  { key: "text", name: "Text", hex: "#1A1F26" },
  { key: "background", name: "Background", hex: "#F6F7F9" },
];
