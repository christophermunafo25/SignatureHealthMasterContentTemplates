import React from "react";
import { CheckCircle2, Files } from "lucide-react";
import type { BrandKit, FacilitySnapshot, FieldValues, TemplateSchema } from "@/lib/types";
import type { ReleaseForm } from "@/lib/releaseForm";
import { SchemaRenderer } from "../SchemaRenderer";
import type { PendingAsset } from "./ReleaseForm";

/** Confirmation state after a facility submission: what was sent, a
 * thumbnail, and plain-language copy about what happens next. Template
 * submissions preview through SchemaRenderer; direct submissions show the
 * first uploaded image (or a file-count summary). */
export function PublicSubmitted({
  template,
  brandKit,
  values,
  assets = [],
  releaseForm,
  facility = null,
  facilityName,
  submitterEmail,
  onCreateAnother,
}: {
  template: TemplateSchema | null;
  brandKit: BrandKit | null;
  values: FieldValues;
  assets?: PendingAsset[];
  releaseForm?: ReleaseForm;
  /** Facility the submission was made as — facility_logo elements in the
   * confirmation thumbnail render from it. */
  facility?: FacilitySnapshot | null;
  facilityName: string;
  submitterEmail?: string;
  onCreateAnother(): void;
}) {
  const firstImage = assets.find((a) => a.mimeType.startsWith("image/") && a.previewUrl);
  // v3 makes a requested slot the exception, not the norm (Q5 defaults to
  // "No"), so the common path is no line at all rather than a placeholder.
  const requested = releaseForm?.requestedPostDate
    ? `You asked for it to go up on ${formatDate(releaseForm.requestedPostDate)}${
        releaseForm.requestedPostTime ? ` at ${releaseForm.requestedPostTime}` : ""
      }.`
    : null;

  return (
    // Light-on-navy: the confirmation sits on the brand wash like every
    // other public screen.
    <div className="max-w-md mx-auto px-5 py-10 text-center space-y-5">
      <CheckCircle2 style={{ width: 40, height: 40, color: "var(--mint)", margin: "0 auto" }} />
      <div className="space-y-2">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: 20,
            color: "#ffffff",
          }}
        >
          Sent for review
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.85)" }}>
          The Agency has your {template ? "graphic" : "content"} from {facilityName}.
          {requested ? <> <b style={{ color: "#ffffff", fontWeight: 600 }}>{requested}</b></> : null}
          {" "}They&rsquo;ll review it and post it on the brand&rsquo;s channels — no
          further action needed on your end.
          {submitterEmail ? ` A confirmation copy is on its way to ${submitterEmail}.` : ""}
        </p>
      </div>

      {template ? (
        <div
          className="mx-auto overflow-hidden rounded-xl"
          style={{
            maxWidth: 280,
            border: "1px solid var(--hairline)",
            background: "var(--surface-sunken)",
            aspectRatio: `${template.canvasWidth} / ${template.canvasHeight}`,
          }}
        >
          <div className="pointer-events-none w-full h-full">
            <SchemaRenderer schema={template} values={values} brandKit={brandKit} instrument={false} facility={facility} />
          </div>
        </div>
      ) : firstImage ? (
        <div
          className="mx-auto overflow-hidden rounded-xl"
          style={{ maxWidth: 280, border: "1px solid var(--hairline)", background: "var(--surface-sunken)" }}
        >
          <img src={firstImage.previewUrl} alt="Your submitted photo" style={{ width: "100%", display: "block" }} />
        </div>
      ) : assets.length > 0 ? (
        <p
          className="mx-auto flex items-center justify-center gap-2 rounded-xl px-4 py-3"
          style={{ maxWidth: 280, border: "1px solid var(--hairline)", background: "var(--lift)", fontSize: 13, color: "var(--fg-2)" }}
        >
          <Files style={{ width: 15, height: 15, color: "var(--fg-3)" }} />
          {assets.length} file{assets.length === 1 ? "" : "s"} attached
        </p>
      ) : null}

      <button className="sp-btn sp-btn-solar" onClick={onCreateAnother}>
        Create another
      </button>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
