import React from "react";
import { CheckCircle2 } from "lucide-react";
import type { BrandKit, FieldValues, TemplateSchema } from "@/lib/types";
import { SchemaRenderer } from "../SchemaRenderer";

/** Confirmation state after a facility submission: what was sent, a
 * thumbnail, and plain-language copy about what happens next. */
export function PublicSubmitted({
  template,
  brandKit,
  values,
  facilityName,
  submitterEmail,
  onCreateAnother,
}: {
  template: TemplateSchema;
  brandKit: BrandKit | null;
  values: FieldValues;
  facilityName: string;
  submitterEmail?: string;
  onCreateAnother(): void;
}) {
  return (
    <div className="max-w-md mx-auto px-5 py-10 text-center space-y-5">
      <CheckCircle2 style={{ width: 40, height: 40, color: "var(--success)", margin: "0 auto" }} />
      <div className="space-y-2">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: 20,
            color: "var(--ink)",
          }}
        >
          Sent for review
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg-2)" }}>
          The Signature social team has your graphic from {facilityName}. They'll
          review it and post it on the brand's channels — no further action
          needed on your end.
          {submitterEmail ? ` A confirmation copy is on its way to ${submitterEmail}.` : ""}
        </p>
      </div>
      <div
        className="mx-auto overflow-hidden rounded-xl"
        style={{
          maxWidth: 280,
          border: "1px solid var(--hairline)",
          background: "var(--paper-warm)",
          aspectRatio: `${template.canvasWidth} / ${template.canvasHeight}`,
        }}
      >
        <div className="pointer-events-none w-full h-full">
          <SchemaRenderer schema={template} values={values} brandKit={brandKit} instrument={false} />
        </div>
      </div>
      <button className="sp-btn sp-btn-primary" onClick={onCreateAnother}>
        Create another
      </button>
    </div>
  );
}
