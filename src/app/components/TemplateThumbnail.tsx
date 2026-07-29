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
