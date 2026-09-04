import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Send } from "lucide-react";
import type { FieldValues } from "@/lib/types";
import { mergeCaption } from "@/lib/caption";
import { submitPublicContent, uploadPublicAsset } from "@/lib/publicClient";
import {
  RELEASE_FORM_VERSION,
  emptyReleaseForm,
  type ReleaseForm as ReleaseFormDoc,
} from "@/lib/releaseForm";
import { useRouter } from "../../router";
import { FacilityCombobox } from "../FacilityCombobox";
import { type SchemaRendererHandle } from "../SchemaRenderer";
import { TemplateFillLayout, missingRequiredFields, needsFacility } from "../TemplateFillLayout";
import { HOME_REF } from "@/lib/publicClient";
import { PublicError, PublicInactive, PublicLoading, PublicShell, libraryRoute, portalRoute, usePublicPortal, useSelectedFacility } from "./PublicApp";
import { PublicSubmitted } from "./PublicSubmitted";
import { ReleaseFormModal } from "./ReleaseFormModal";
import { type PendingAsset } from "./ReleaseForm";

/** Anonymous facility fill page: TemplateFillLayout with a Submit-for-review
 * primary action. v2.2: clicking Submit opens the release-form modal with
 * the rendered graphic and the caption pre-loaded — facility, name, and
 * email moved INTO the form's Information section. */
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

  // Release-form modal state.
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<ReleaseFormDoc>>(() => emptyReleaseForm());
  const [extraAssets, setExtraAssets] = useState<PendingAsset[]>([]);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ReleaseFormDoc | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const rendererRef = useRef<SchemaRendererHandle>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const template = state.status === "ready" ? state.data.template ?? null : null;
  const { facility, select, clear } = useSelectedFacility(
    token,
    state.status === "ready" ? state.data.facilities : null,
  );
  const missingRequired = useMemo(
    () => (template ? missingRequiredFields(template, values) : []),
    [template, values],
  );

  // Object URLs are cheap but leak — revoke on swap and unmount.
  useEffect(
    () => () => {
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    },
    [previewObjectUrl],
  );

  const isHome = token === HOME_REF;
  if (state.status === "loading") return <PublicLoading />;
  if (state.status === "inactive") return <PublicInactive adminLink={isHome} />;
  if (state.status === "error") return <PublicError retry={state.retry} />;
  if (!template) {
    return (
      <PublicShell data={state.data}>
        <p className="text-center py-24" style={{ fontSize: 15, color: "var(--fg-3)" }}>Template not found.</p>
      </PublicShell>
    );
  }

  const { data } = state;

  // A facility-logo template needs the facility DURING the fill, not at
  // submit time — otherwise the element sits empty until after the graphic
  // has already been rendered. The inline picker writes through the same
  // `select` the release-form modal uses, so the two can never disagree.
  const requiresFacility = needsFacility(template);
  const facilitySnapshot = facility
    ? { name: facility.name, shortName: facility.shortName, logoUrl: facility.logoUrl ?? null }
    : null;

  if (submitted) {
    return (
      <PublicShell data={data}>
        <PublicSubmitted
          template={template}
          brandKit={data.brandKit}
          values={values}
          releaseForm={submitted}
          facility={facilitySnapshot}
          facilityName={facility?.name ?? "your facility"}
          submitterEmail={submitterEmail.trim() || undefined}
          onCreateAnother={() => navigate(portalRoute(token))}
        />
      </PublicShell>
    );
  }

  // Template fields are the only gate to OPENING the form — everything else
  // (facility, identity, release answers) is answered inside the modal.
  const blockers = missingRequired.map((f) => f.label);
  const canOpen = blockers.length === 0;

  const openModal = async () => {
    if (!canOpen || !rendererRef.current) return;
    setSubmitError(null);
    // Render the PNG ONCE when the modal opens: the modal shows exactly what
    // will be sent, and the blob is reused at submit time. Capped at 8s — a
    // hung render (e.g. a blocked font fetch) must never wall off the
    // release form; the submission then just travels without a preview.
    let blob: Blob | null = null;
    try {
      blob = await Promise.race([
        rendererRef.current.renderBlob(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
      if (!blob) console.warn("Preview render timed out; submitting without one");
    } catch (e) {
      console.warn("Preview render failed; submitting without one", e);
    }
    setPreviewBlob(blob);
    setPreviewObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return blob ? URL.createObjectURL(blob) : null;
    });
    // Seed Q3 from the current caption — the rendered graphic is already
    // the media, so Q4 asks for nothing on this path.
    setForm((f) => ({
      ...f,
      postText: caption ?? mergeCaption(template, values, facilitySnapshot),
    }));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    // Editing Q3 IS the caption edit — nothing is lost on cancel.
    if (form.postText !== undefined) setCaption(form.postText);
    submitButtonRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!facility) return;
    setSubmitError(null);

    // Upload any extra release-form files first (the preview blob rides the
    // submit payload itself).
    let current = extraAssets;
    if (current.some((a) => a.progress !== "done")) {
      setUploading(true);
      try {
        let done = 0;
        const total = current.filter((a) => a.progress !== "done").length;
        for (const a of current) {
          if (a.progress === "done" && a.path) continue;
          done += 1;
          setUploadStatus(`Uploading ${done} of ${total}…`);
          current = current.map((x) => (x.id === a.id ? { ...x, progress: "uploading" as const } : x));
          setExtraAssets(current);
          try {
            const uploaded = await uploadPublicAsset(token, a.file);
            current = current.map((x) =>
              x.id === a.id ? { ...x, progress: "done" as const, path: uploaded.path } : x,
            );
          } catch (e) {
            console.error("Asset upload failed", e);
            current = current.map((x) => (x.id === a.id ? { ...x, progress: "error" as const } : x));
            setExtraAssets(current);
            setSubmitError(`"${a.name}" didn't upload. Check your connection and submit again to retry.`);
            return;
          }
          setExtraAssets(current);
        }
      } finally {
        setUploading(false);
        setUploadStatus(null);
      }
    }

    setSubmitting(true);
    try {
      const releaseForm: ReleaseFormDoc = {
        ...(form as ReleaseFormDoc),
        version: RELEASE_FORM_VERSION,
        submittedAt: new Date().toISOString(),
      };
      await submitPublicContent(token, {
        kind: "template",
        facilityId: facility.id,
        templateId: template.id,
        submitterName: submitterName.trim(),
        submitterEmail: submitterEmail.trim(),
        releaseForm,
        assets: current
          .filter((a) => a.path)
          .map((a) => ({ path: a.path!, name: a.name, mimeType: a.mimeType, size: a.size })),
        values,
        caption: releaseForm.postText,
        previewBlob,
      });
      setCaption(releaseForm.postText);
      setModalOpen(false);
      setSubmitted(releaseForm);
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
        {/* Light-on-navy: this page sits on the brand wash */}
        <button
          onClick={() => navigate(libraryRoute(token))}
          className="flex items-center gap-1.5 mb-5"
          style={{ fontSize: 15, color: "rgba(255,255,255,0.85)" }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          All templates
        </button>

        <TemplateFillLayout
          header={
            <div>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontSize: "clamp(19px, 2.6vw, 30px)",
                  lineHeight: 1.1,
                  color: "#ffffff",
                }}
              >
                {template.name}
              </h1>
              {template.description && (
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>{template.description}</p>
              )}
              {requiresFacility && !facility && (
                <div
                  className="p-4 space-y-2.5 mt-4"
                  style={{ background: "var(--lift)", border: "1px solid var(--hairline)", borderRadius: 12 }}
                >
                  <div>
                    <p className="sp-eyebrow">Your facility</p>
                    <p style={{ fontSize: 15, color: "var(--fg-2)", marginTop: 2 }}>
                      This template shows your facility&rsquo;s logo — pick yours to see it
                      in the preview.
                    </p>
                  </div>
                  <FacilityCombobox facilities={data.facilities} onSelect={select} />
                </div>
              )}
              {requiresFacility && facility && (
                <div
                  className="flex items-center justify-between gap-3 px-4 py-2.5 mt-4"
                  style={{ background: "var(--lift)", border: "1px solid var(--hairline)", borderRadius: 12 }}
                >
                  <p className="min-w-0 truncate" style={{ fontSize: 15, color: "var(--ink)" }}>
                    Submitting as <b style={{ fontWeight: 600 }}>{facility.shortName}</b>
                  </p>
                  <button
                    onClick={clear}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--solar)", flexShrink: 0 }}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
          }
          template={template}
          brandKit={data.brandKit}
          values={values}
          onChange={(fieldKey, v) => setValues((prev) => ({ ...prev, [fieldKey]: v }))}
          caption={caption}
          onCaptionEdit={setCaption}
          rendererRef={rendererRef}
          instrument={false}
          allowCaptionCopy={false}
          previewHint="What The Agency receives"
          facility={facilitySnapshot}
          actions={
            <>
              <button
                ref={submitButtonRef}
                onClick={() => void openModal()}
                disabled={!canOpen}
                aria-describedby={blockers.length > 0 ? "submit-blocked-reason" : undefined}
                className="sp-btn sp-btn-primary w-full"
                style={{ padding: "11px 14px" }}
              >
                <Send style={{ width: 14, height: 14 }} />
                Submit for review
              </button>
              <p className="text-center" style={{ fontSize: 12, color: "var(--fg-4)" }}>
                A few last questions come next, then The Agency reviews
                and posts it.
              </p>
              {blockers.length > 0 && (
                <p
                  id="submit-blocked-reason"
                  role="status"
                  aria-live="polite"
                  className="text-center"
                  style={{ fontSize: 13, color: "var(--fg-3)" }}
                >
                  Still needed: {blockers.join(", ")}
                </p>
              )}
              {!modalOpen && submitError && (
                <p role="alert" className="flex items-center gap-1.5 justify-center" style={{ fontSize: 13, color: "var(--danger)" }}>
                  <AlertTriangle style={{ width: 13, height: 13 }} />
                  {submitError}
                </p>
              )}
            </>
          }
        />
      </div>

      {modalOpen && (
        <ReleaseFormModal
          previewUrl={previewObjectUrl}
          facilities={data.facilities}
          facility={facility}
          onSelectFacility={select}
          onClearFacility={clear}
          submitterName={submitterName}
          submitterEmail={submitterEmail}
          onIdentityChange={(patch) => {
            if (patch.submitterName !== undefined) setSubmitterName(patch.submitterName);
            if (patch.submitterEmail !== undefined) setSubmitterEmail(patch.submitterEmail);
          }}
          form={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          assets={extraAssets}
          onAssetsChange={setExtraAssets}
          uploading={uploading}
          submitting={submitting}
          uploadStatus={uploadStatus}
          submitError={submitError}
          onSubmit={() => void handleSubmit()}
          onClose={closeModal}
        />
      )}
    </PublicShell>
  );
}
