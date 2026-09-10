import React from "react";
import type { BrandKit, TemplateSchema } from "@/lib/types";
import { useBrand } from "@/lib/brand/BrandContext";
import { SchemaRenderer } from "./SchemaRenderer";

/** Card-sized live preview with an explicit brand kit — usable outside the
 * BrandProvider (the anonymous facility portal). */
export function TemplateThumbnailBase({
  template,
  brandKit,
}: {
  template: TemplateSchema;
  brandKit: BrandKit | null;
}) {
  return (
    <div className="w-full h-full pointer-events-none">
      <SchemaRenderer
        schema={template}
        values={{}}
        brandKit={brandKit}
        instrument={false}
      />
    </div>
  );
}

/** Card-sized live preview of a template (no usage instrumentation). */
export function TemplateThumbnail({ template }: { template: TemplateSchema }) {
  const { kit } = useBrand();
  return <TemplateThumbnailBase template={template} brandKit={kit} />;
}

/** Uniform square preview mat: the artwork sits contained inside a light
 * grey mat, like a framed print — the long edge fills the mat, the short
 * edge letterboxes — so mixed canvas sizes can't ragged a card grid.
 * Shared by the public library, the member portal, and Admin → Templates
 * so the three grids can't drift apart. */
export function TemplateThumbnailMat({
  template,
  children,
}: {
  template: Pick<TemplateSchema, "canvasWidth" | "canvasHeight">;
  children: React.ReactNode;
}) {
  return (
    <div
      className="w-full overflow-hidden flex items-center justify-center"
      style={{
        aspectRatio: "1 / 1",
        background: "var(--surface-sunken)",
        borderRadius: 14,
        padding: 20,
      }}
    >
      <div
        className="overflow-hidden"
        style={{
          aspectRatio: `${template.canvasWidth} / ${template.canvasHeight}`,
          ...(template.canvasWidth >= template.canvasHeight ? { width: "100%" } : { height: "100%" }),
          borderRadius: 10,
          // Light artwork needs an edge against the light mat.
          border: "1px solid var(--hairline)",
          boxShadow: "var(--shadow-e2)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
