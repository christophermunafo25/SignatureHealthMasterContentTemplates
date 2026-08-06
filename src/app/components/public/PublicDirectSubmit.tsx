import React, { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw, Send } from "lucide-react";
import { HOME_REF, submitPublicContent, uploadPublicAsset } from "@/lib/publicClient";
import {
  RELEASE_FORM_VERSION,
  emptyReleaseForm,
  isBlocked,
  validateReleaseForm,
  type ReleaseForm as ReleaseFormDoc,
} from "@/lib/releaseForm";
import { useRouter } from "../../router";
import {
  PublicError,
  PublicInactive,
  PublicLoading,
  PublicShell,
  portalRoute,
  usePublicPortal,
  useSelectedFacility,
} from "./PublicApp";
import { PublicSubmitted } from "./PublicSubmitted";
import { ReleaseForm, type PendingAsset } from "./ReleaseForm";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** The Submit-content path: a facility uploads its own media with the full
 * release form — no template involved. */
export function PublicDirectSubmit({ token }: { token: string }) {
  const { navigate } = useRouter();
  const state = usePublicPortal(token);

  const [form, setForm] = useState<Partial<ReleaseFormDoc>>(() => emptyReleaseForm());
  const [assets, setAssets] = useState<PendingAsset[]>([]);
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [showIssues, setShowIssues] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ReleaseFormDoc | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { facility, select, clear } = useSelectedFacility(
    token,
    state.status === "ready" ? state.data.facilities : null,
  );

  const issues = useMemo(
    () => validateReleaseForm(form, { hasGeneratedGraphic: false, assetCount: assets.length }),
    [form, assets.length],
  );

  const isHome = token === HOME_REF;
  if (state.status === "loading") return <PublicLoading />;
  if (state.status === "inactive") return <PublicInactive adminLink={isHome} />;
  if (state.status === "error") return <PublicError retry={state.retry} />;
  const { data } = state;

  if (submitted) {
    return (
      <PublicShell data={data}>
        <PublicSubmitted
          template={null}
          brandKit={data.brandKit}
          values={{}}
          assets={assets}
          releaseForm={submitted}
          facilityName={facility?.name ?? "your facility"}
          submitterEmail={submitterEmail.trim() || undefined}
          onCreateAnother={() => navigate(portalRoute(token))}
        />
      </PublicShell>
    );
  }

  const identityOk =
    facility !== null && submitterName.trim().length > 1 && EMAIL_RE.test(submitterEmail.trim());
  const busy = uploading || submitting;

  const handleSubmit = async () => {
    setSubmitError(null);
    if (isBlocked(issues) || !identityOk) {
      setShowIssues(true);
      // Scroll the first offending question into view.
      const firstField = !identityOk ? null : issues.find((i) => i.severity === "blocking")?.field;
      const anchor = firstField ? document.getElementById(`rf-${firstField}`) : document.getElementById("rf-info");
      anchor?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // 1. Upload every pending file. On failure keep the successful paths,
    //    mark the failed file, surface a retry, and do NOT create the
    //    submission.
    setUploading(true);
    let current = assets;
    try {
      let done = 0;
      const total = current.filter((a) => a.progress !== "done").length;
      for (const a of current) {
        if (a.progress === "done" && a.path) continue;
        done += 1;
        setUploadStatus(`Uploading ${done} of ${total}…`);
        current = current.map((x) => (x.id === a.id ? { ...x, progress: "uploading" as const } : x));
        setAssets(current);
        try {
          const uploaded = await uploadPublicAsset(token, a.file);
          current = current.map((x) =>
            x.id === a.id ? { ...x, progress: "done" as const, path: uploaded.path } : x,
          );
        } catch (e) {
          console.error("Asset upload failed", e);
          current = current.map((x) => (x.id === a.id ? { ...x, progress: "error" as const } : x));
          setAssets(current);
          setSubmitError(`"${a.name}" didn't upload. Check your connection and submit again to retry.`);
          return;
        }
        setAssets(current);
      }
    } finally {
      setUploading(false);
      setUploadStatus(null);
    }

    // 2. Create the submission.
    setSubmitting(true);
    try {
      const releaseForm: ReleaseFormDoc = {
        ...(form as ReleaseFormDoc),
        version: RELEASE_FORM_VERSION,
        submittedAt: new Date().toISOString(),
      };
      await submitPublicContent(token, {
        kind: "direct",
        facilityId: facility!.id,
        submitterName: submitterName.trim(),
        submitterEmail: submitterEmail.trim(),
        releaseForm,
        assets: current
          .filter((a) => a.path)
          .map((a) => ({ path: a.path!, name: a.name, mimeType: a.mimeType, size: a.size })),
        previewBlob: null,
      });
      setSubmitted(releaseForm);
    } catch (e) {
      console.error("Submit failed", e);
      setSubmitError(
        e instanceof Error && e.message && !/failed \(\d+\)/.test(e.message)
          ? e.message
          : "Couldn't send this for review. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicShell data={data} adminLink={isHome}>
      <div className="mx-auto px-5 sm:px-8 py-6" style={{ maxWidth: 640 }}>
        <button
          onClick={() => navigate(portalRoute(token))}
          className="flex items-center gap-1.5 mb-5"
          style={{ fontSize: 13, color: "var(--fg-2)" }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Back
        </button>

        <div id="rf-info" className="mb-5">
          <p className="sp-eyebrow mb-2">{data.company.name}</p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              textTransform: "uppercase",
              fontSize: "clamp(20px, 3vw, 30px)",
              letterSpacing: "0.06em",
              lineHeight: 1.05,
              color: "var(--ink)",
            }}
          >
            Submit content
          </h1>
          <p style={{ fontSize: 13, color: "var(--fg-2)", marginTop: 6, maxWidth: 460 }}>
            Upload your photo or video, answer the release questions, and the
            Signature social team takes it from there.
          </p>
        </div>

        <ReleaseForm
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
          hasGeneratedGraphic={false}
          assets={assets}
          onAssetsChange={setAssets}
          showIssues={showIssues}
          issues={issues}
          uploading={uploading}
        />

        <div className="mt-4 space-y-2">
          <button
            onClick={() => void handleSubmit()}
            disabled={busy}
            className="sp-btn sp-btn-primary w-full"
            style={{ padding: "11px 14px" }}
          >
            {busy ? (
              <RefreshCw className="animate-spin" style={{ width: 14, height: 14 }} />
            ) : (
              <Send style={{ width: 14, height: 14 }} />
            )}
            {uploading ? uploadStatus ?? "Uploading…" : submitting ? "Sending…" : "Submit for review"}
          </button>
          <p className="text-center" style={{ fontSize: 11, color: "var(--fg-4)" }}>
            The Signature social team reviews and posts submissions.
          </p>
          {submitError && (
            <p role="alert" className="flex items-center gap-1.5 justify-center" style={{ fontSize: 12, color: "var(--danger)" }}>
              <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0 }} />
              {submitError}
            </p>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
