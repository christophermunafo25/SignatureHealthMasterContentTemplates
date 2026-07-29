import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw, Send } from "lucide-react";
import type { FieldValues } from "@/lib/types";
import { mergeCaption } from "@/lib/caption";
import { submitPublicContent } from "@/lib/publicClient";
import { useRouter } from "../../router";
import { type SchemaRendererHandle } from "../SchemaRenderer";
import { TemplateFillLayout, missingRequiredFields } from "../TemplateFillLayout";
import { HOME_REF, type PublicFacility } from "@/lib/publicClient";
import { FacilityCombobox } from "../FacilityCombobox";
import { PublicError, PublicInactive, PublicLoading, PublicShell, portalRoute, usePublicPortal, useSelectedFacility } from "./PublicApp";
import { PublicSubmitted } from "./PublicSubmitted";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Required facility picker inside the submit panel: a compact selected row
 * once chosen, the searchable roster otherwise. Selection is remembered for
 * the next submission but NEVER gates browsing. */
function FacilityField({
  facilities,
  facility,
  onSelect,
  onClear,
}: {
  facilities: PublicFacility[];
  facility: PublicFacility | null;
  onSelect(f: PublicFacility): void;
  onClear(): void;
}) {
  if (facility) {
    return (
      <div
        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5"
        style={{ border: "1px solid var(--hairline)", background: "var(--paper)" }}
      >
        <span className="min-w-0">
          <span className="block truncate" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            {facility.shortName}
            {facility.state && <span style={{ fontWeight: 400, fontSize: 11, color: "var(--fg-4)" }}> · {facility.state}</span>}
          </span>
          {facility.name !== facility.shortName && (
            <span className="block truncate" style={{ fontSize: 11, color: "var(--fg-3)" }}>{facility.name}</span>
          )}
        </span>
        <button onClick={onClear} style={{ fontSize: 11, color: "var(--fg-3)", whiteSpace: "nowrap" }}>
          Change
        </button>
      </div>
    );
  }
  return (
    <FacilityCombobox
      facilities={facilities}
      onSelect={onSelect}
      placeholder="Search your facility…"
      emptyHint={
        <span>
          No facility matches that search. Don't see yours? Contact the
          Signature marketing team and they'll add it.
        </span>
      }
    />
  );
}

/** Anonymous facility fill page: TemplateFillLayout with a submitter panel
 * and a Submit-for-review primary action instead of a download. The graphic
 * goes to the Signature social team's review queue, not to the facility's
 * downloads folder. */
export function PublicTemplateUse({ token, templateId }: { token: string; templateId: string }) {
  const { navigate } = useRouter();
  // The stored facility id rides the fetch so the server-side open event is
  // attributed; the renderer below must NOT instrument.
  const [storedFacilityId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`shc-portal-facility:${token}`);
    } catch {
      return null;
    }
  });
  const state = usePublicPortal(token, { templateId, facilityId: storedFacilityId ?? undefined });

  const [values, setValues] = useState<FieldValues>({});
  const [caption, setCaption] = useState<string | null>(null);
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const rendererRef = useRef<SchemaRendererHandle>(null);

  const template = state.status === "ready" ? state.data.template ?? null : null;
  const { facility, select, clear } = useSelectedFacility(
    token,
    state.status === "ready" ? state.data.facilities : null,
  );
  const missingRequired = useMemo(
    () => (template ? missingRequiredFields(template, values) : []),
    [template, values],
  );

  const isHome = token === HOME_REF;
  if (state.status === "loading") return <PublicLoading />;
  if (state.status === "inactive") return <PublicInactive adminLink={isHome} />;
  if (state.status === "error") return <PublicError retry={state.retry} />;
  if (!template) {
    return (
      <PublicShell data={state.data}>
        <p className="text-center py-24" style={{ fontSize: 13, color: "var(--fg-3)" }}>Template not found.</p>
      </PublicShell>
    );
  }

  const { data } = state;

  if (submitted) {
    return (
      <PublicShell data={data}>
        <PublicSubmitted
          template={template}
          brandKit={data.brandKit}
          values={values}
          facilityName={facility?.name ?? "your facility"}
          submitterEmail={submitterEmail.trim() || undefined}
          onCreateAnother={() => navigate(portalRoute(token))}
        />
      </PublicShell>
    );
  }

  // Everything a submission still needs — template fields plus the three
  // universal requirements (facility, name, email).
  const blockers = [
    ...missingRequired.map((f) => f.label),
    ...(facility ? [] : ["your facility"]),
    ...(submitterName.trim().length > 1 ? [] : ["your name"]),
    ...(EMAIL_RE.test(submitterEmail.trim()) ? [] : ["your email"]),
  ];
  const canSubmit = !submitting && blockers.length === 0;

  const handleSubmit = async () => {
    if (!canSubmit || !rendererRef.current) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Best-effort preview of what the facility saw — the submission's
      // authoritative artifact is re-rendered from values + snapshot.
      let previewBlob: Blob | null = null;
      try {
        previewBlob = await rendererRef.current.renderBlob();
      } catch (e) {
        console.warn("Preview render failed; submitting without one", e);
      }
      await submitPublicContent(token, {
        facilityId: facility!.id,
        templateId: template.id,
        submitterName: submitterName.trim(),
        submitterEmail: submitterEmail.trim(),
        values,
        caption: caption ?? mergeCaption(template, values),
        previewBlob,
      });
      setSubmitted(true);
    } catch (e) {
      console.error("Submit failed", e);
      setSubmitError("Couldn't send this for review. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicShell data={data} adminLink={isHome}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6">
        <button
          onClick={() => navigate(portalRoute(token))}
          className="flex items-center gap-1.5 mb-5"
          style={{ fontSize: 13, color: "var(--fg-2)" }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          All templates
        </button>

        <TemplateFillLayout
          template={template}
          brandKit={data.brandKit}
          values={values}
          onChange={(fieldKey, v) => setValues((prev) => ({ ...prev, [fieldKey]: v }))}
          caption={caption}
          onCaptionEdit={setCaption}
          rendererRef={rendererRef}
          instrument={false}
          allowCaptionCopy={false}
          previewHint="What the social team receives"
          actions={
            <>
              <div>
                <span className="sp-eyebrow block mb-1">Your facility</span>
                <FacilityField
                  facilities={data.facilities}
                  facility={facility}
                  onSelect={select}
                  onClear={clear}
                />
              </div>
              <div>
                <label className="sp-eyebrow block mb-1" htmlFor="submitter-name">Your name</label>
                <input
                  id="submitter-name"
                  className="sp-input"
                  placeholder="So the social team knows who sent it"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="sp-eyebrow block mb-1" htmlFor="submitter-email">Email</label>
                <input
                  id="submitter-email"
                  type="email"
                  className="sp-input"
                  placeholder="you@facility.com"
                  value={submitterEmail}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                aria-describedby={blockers.length > 0 ? "submit-blocked-reason" : undefined}
                className="sp-btn sp-btn-primary w-full"
                style={{ padding: "11px 14px" }}
              >
                {submitting ? <RefreshCw className="animate-spin" style={{ width: 14, height: 14 }} /> : <Send style={{ width: 14, height: 14 }} />}
                {submitting ? "Sending…" : "Submit for review"}
              </button>
              <p className="text-center" style={{ fontSize: 11, color: "var(--fg-4)" }}>
                The Signature social team reviews and posts submissions.
              </p>
              {blockers.length > 0 && (
                <p
                  id="submit-blocked-reason"
                  role="status"
                  aria-live="polite"
                  className="text-center"
                  style={{ fontSize: 12, color: "var(--fg-3)" }}
                >
                  Still needed: {blockers.join(", ")}
                </p>
              )}
              {submitError && (
                <p role="alert" className="flex items-center gap-1.5 justify-center" style={{ fontSize: 12, color: "var(--danger)" }}>
                  <AlertTriangle style={{ width: 13, height: 13 }} />
                  {submitError}
                </p>
              )}
            </>
          }
        />
      </div>
    </PublicShell>
  );
}
