import React from "react";
import type { TemplateSchema } from "@/lib/types";
import { useBrand } from "@/lib/brand/BrandContext";
import { SchemaRenderer } from "./SchemaRenderer";

/** Card-sized live preview of a template (no usage instrumentation). */
export function TemplateThumbnail({ template }: { template: TemplateSchema }) {
  const { kit, locations } = useBrand();
  return (
    <div className="w-full h-full pointer-events-none">
      <SchemaRenderer
        schema={template}
        values={{}}
        brandKit={kit}
        locations={locations}
        instrument={false}
      />
    </div>
  );
}
