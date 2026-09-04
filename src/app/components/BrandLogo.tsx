import React from "react";
import navyLogo from "@/assets/signature-healthcare-logo.png";
import reverseLogo from "@/assets/signature-healthcare-logo-reverse.png";

/** The official lockup. `variant` names the INK, not the surface:
 *   "navy"    → navy + amber art, for light surfaces
 *   "reverse" → near-white art, for the mesh and the brand gradient
 * Picking the wrong one renders an invisible logo, so every call site
 * states it explicitly rather than inferring from context.
 *
 * The art is 1516×889 (1.705:1). Size by height only — width follows. */
export function BrandLogo({
  height = 28,
  variant = "navy",
}: {
  height?: number;
  variant?: "navy" | "reverse";
}) {
  return (
    <img
      src={variant === "reverse" ? reverseLogo : navyLogo}
      alt="Signature HealthCARE"
      style={{ height, width: "auto", display: "block" }}
    />
  );
}
