import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { AlertTriangle, ChevronDown, ExternalLink, FileText, Film, Presentation, X } from "lucide-react";
import type { PublicFacility } from "@/lib/publicClient";
import {
  ALLOWED_UPLOAD_MIME,
  MAX_UPLOAD_FILES,
  MEDIA_RELEASE_FORMS_URL,
  RELEASE_INTRO,
  RELEASE_PLATFORMS,
  RELEASE_QUESTIONS,
  uploadRejectReason,
  type ReleaseForm as ReleaseFormDoc,
  type ReleaseFormIssue,
  type YesNo,
  type YesNoNa,
} from "@/lib/releaseForm";
import { FacilityCombobox } from "../FacilityCombobox";
import { Checkbox } from "../ui/checkbox";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

/** One file waiting in the form. `previewUrl` is an object URL for image
 * thumbnails; `path` lands once the upload completes at submit time. */
export interface PendingAsset {
  id: string;
  file: File;
  name: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
  path?: string;
  progress: "pending" | "uploading" | "done" | "error";
}

export interface ReleaseFormProps {
  facilities: PublicFacility[];
  facility: PublicFacility | null;
  onSelectFacility(f: PublicFacility): void;
  onClearFacility(): void;
  submitterName: string;
  submitterEmail: string;
  onIdentityChange(patch: { submitterName?: string; submitterEmail?: string }): void;
  form: Partial<ReleaseFormDoc>;
  onChange(patch: Partial<ReleaseFormDoc>): void;
  /** Template path: hides Q10/Q11's "required" framing and shows the
   * generated graphic as the attached media. Extra uploads stay allowed. */
  hasGeneratedGraphic: boolean;
  assets: PendingAsset[];
  onAssetsChange(next: PendingAsset[]): void;
  /** Show validation messages only after a submit attempt. */
  showIssues: boolean;
  issues: ReleaseFormIssue[];
  /** Q11 dropzone is disabled while an upload is in flight. */
  uploading: boolean;
}

const panel: React.CSSProperties = {
  background: "var(--lift)",
  border: "1px solid var(--hairline)",
  borderRadius: 12,
};

const fmtSize = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function AssetGlyph({ mimeType }: { mimeType: string }) {
  const Icon = mimeType.startsWith("video/")
    ? Film
    : mimeType.includes("presentation") || mimeType.includes("powerpoint")
      ? Presentation
      : FileText;
  return (
    <span
      className="flex items-center justify-center flex-shrink-0"
      style={{ width: 40, height: 40, borderRadius: 8, background: "var(--paper)", border: "1px solid var(--hairline)" }}
    >
      <Icon style={{ width: 16, height: 16, color: "var(--fg-3)" }} />
    </span>
  );
}

/** The panel revealed the moment Q4/Q5/Q6 is answered "No" — the single
 * most important interaction in the form. Submit is blocked; this explains
 * why and where the release forms live. */
function ReleaseBlockedPanel() {
  return (
    <div
      role="alert"
      className="rounded-lg px-3 py-2.5 space-y-1.5"
      style={{ background: "var(--fill-danger-bg, rgba(198,47,36,0.08))", border: "1px solid var(--danger)" }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--danger)" }}>
        We can&rsquo;t post this without a signed release on file.
      </p>
      <p style={{ fontSize: 12, lineHeight: 1.55, color: "var(--fg-1)" }}>
        Please use a different photo, or get permission <b>before</b> uploading
        the images. Media release forms live here:
      </p>
      <a
        href={MEDIA_RELEASE_FORMS_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1"
        style={{ fontSize: 12, color: "var(--solar)", textDecoration: "underline", textUnderlineOffset: 3 }}
      >
        Media Release Forms on SharePoint
        <ExternalLink style={{ width: 11, height: 11 }} />
      </a>
    </div>
  );
}

function QuestionPanel({
  number,
  label,
  helper,
  issue,
  children,
  anchorId,
}: {
  number?: number;
  label: string;
  helper?: string;
  issue?: ReleaseFormIssue | null;
  children: React.ReactNode;
  anchorId?: string;
}) {
  return (
    <div id={anchorId} className="p-4 space-y-2.5" style={panel}>
      <div className="min-w-0">
        {number !== undefined && <p className="sp-eyebrow">Question {String(number).padStart(2, "0")}</p>}
        <p className="block" style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", marginTop: 2 }}>
          {label}
        </p>
        {helper && (
          <p style={{ fontSize: 12, lineHeight: 1.55, color: "var(--fg-3)", marginTop: 4 }}>{helper}</p>
        )}
      </div>
      {children}
      {issue &&
        (issue.severity === "blocking" ? (
          <p role="alert" className="flex items-start gap-1.5" style={{ fontSize: 12, color: "var(--danger)" }}>
            <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
            {issue.message}
          </p>
        ) : (
          <p role="status" style={{ fontSize: 12, color: "var(--solar)" }}>
            {issue.message}
          </p>
        ))}
    </div>
  );
}

function ChoiceRow<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: readonly T[];
  value: T | undefined;
  onChange(v: T): void;
}) {
  return (
    <RadioGroup
      value={value ?? ""}
      onValueChange={(v) => onChange(v as T)}
      className="flex flex-wrap gap-x-5 gap-y-2"
      aria-label={name}
    >
      {options.map((o) => (
        <label key={o} className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--fg-1)", cursor: "pointer" }}>
          <RadioGroupItem value={o} id={`${name}-${o}`} />
          {o}
        </label>
      ))}
    </RadioGroup>
  );
}

/** The Social Media Update Form body — used inline by the direct path and
 * inside the modal by the template path. Owns NO submission logic; question
 * copy comes from src/lib/releaseForm.ts, never duplicated here. */
export function ReleaseForm({
  facilities,
  facility,
  onSelectFacility,
  onClearFacility,
  submitterName,
  submitterEmail,
  onIdentityChange,
  form,
  onChange,
  hasGeneratedGraphic,
  assets,
  onAssetsChange,
  showIssues,
  issues,
  uploading,
}: ReleaseFormProps) {
  // Long intro: collapsed behind a disclosure on mobile, expanded at sm+.
  const [introOpen, setIntroOpen] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  const issueFor = (field: ReleaseFormIssue["field"]): ReleaseFormIssue | null => {
    const found = issues.find((i) => i.field === field) ?? null;
    if (!found) return null;
    // The three release "No" answers and the VP flag surface IMMEDIATELY —
    // waiting for a submit attempt would bury the most important state.
    const immediate =
      (field === "photoRelease" && form.photoRelease === "No") ||
      (field === "minorRelease" && form.minorRelease === "No") ||
      (field === "offCampusRelease" && form.offCampusRelease === "No") ||
      (field === "vpApproved" && form.vpApproved === "No");
    return showIssues || immediate ? found : null;
  };

  const onDrop = useCallback(
    (accepted: File[]) => {
      setDropError(null);
      const next = [...assets];
      for (const file of accepted) {
        if (next.length >= MAX_UPLOAD_FILES) {
          setDropError(`At most ${MAX_UPLOAD_FILES} files per submission.`);
          break;
        }
        const reason = uploadRejectReason(file);
        if (reason) {
          setDropError(reason);
          continue;
        }
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
          progress: "pending",
        });
      }
      onAssetsChange(next);
    },
    [assets, onAssetsChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejections) => {
      const first = rejections[0];
      setDropError(first ? uploadRejectReason(first.file) ?? "We couldn't read that file." : null);
    },
    accept: Object.fromEntries(
      Object.entries(ALLOWED_UPLOAD_MIME).map(([mime, ext]) => [mime, [`.${ext}`]]),
    ),
    disabled: uploading,
  });

  const removeAsset = (id: string) => {
    const target = assets.find((a) => a.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onAssetsChange(assets.filter((a) => a.id !== id));
  };

  const Q = RELEASE_QUESTIONS;
  const releaseNo = (v: YesNo | YesNoNa | undefined) => v === "No";

  return (
    <div className="space-y-4">
      {/* Posting guidelines intro */}
      <div className="p-4" style={panel}>
        <button
          type="button"
          className="flex items-center justify-between w-full sm:hidden"
          onClick={() => setIntroOpen((o) => !o)}
          aria-expanded={introOpen}
          style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
        >
          Read the posting guidelines
          <ChevronDown
            style={{ width: 15, height: 15, transform: introOpen ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
          />
        </button>
        <div className={`${introOpen ? "block mt-3" : "hidden"} sm:block space-y-2`}>
          <p className="hidden sm:block" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            Posting guidelines
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--fg-1)" }}>{RELEASE_INTRO.lead}</p>
          <ul className="space-y-1.5" style={{ paddingLeft: 18, listStyle: "disc" }}>
            {RELEASE_INTRO.rules.map((rule) => (
              <li key={rule} style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--fg-2)" }}>
                {rule}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Information — unnumbered; replaces the old submit-panel identity */}
      <div className="p-4 space-y-3" style={panel}>
        <p className="sp-eyebrow">Information</p>
        <div>
          <span className="block mb-1" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
            Facility Name
          </span>
          {facility ? (
            <div
              className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5"
              style={{ border: "1px solid var(--hairline)", background: "var(--paper)" }}
            >
              <span className="min-w-0">
                <span className="block truncate" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                  {facility.shortName}
                  {facility.state && (
                    <span style={{ fontWeight: 400, fontSize: 11, color: "var(--fg-4)" }}> · {facility.state}</span>
                  )}
                </span>
                {facility.name !== facility.shortName && (
                  <span className="block truncate" style={{ fontSize: 11, color: "var(--fg-3)" }}>{facility.name}</span>
                )}
              </span>
              <button type="button" onClick={onClearFacility} style={{ fontSize: 11, color: "var(--fg-3)", whiteSpace: "nowrap" }}>
                Change
              </button>
            </div>
          ) : (
            <FacilityCombobox
              facilities={facilities}
              onSelect={onSelectFacility}
              placeholder="Search your facility…"
              emptyHint={
                <span>
                  No facility matches that search. Don&rsquo;t see yours? Contact the
                  Signature marketing team and they&rsquo;ll add it.
                </span>
              }
            />
          )}
          {showIssues && !facility && (
            <p role="alert" style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>Pick your facility.</p>
          )}
        </div>
        <div>
          <label className="block mb-1" htmlFor="release-name" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
            Your name
          </label>
          <input
            id="release-name"
            className="sp-input"
            placeholder="So the social team knows who sent it"
            value={submitterName}
            onChange={(e) => onIdentityChange({ submitterName: e.target.value })}
            autoComplete="name"
          />
          {showIssues && submitterName.trim().length < 2 && (
            <p role="alert" style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>Enter your name.</p>
          )}
        </div>
        <div>
          <label className="block mb-1" htmlFor="release-email" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
            Email
          </label>
          <input
            id="release-email"
            type="email"
            className="sp-input"
            placeholder="you@facility.com"
            value={submitterEmail}
            onChange={(e) => onIdentityChange({ submitterEmail: e.target.value })}
            autoComplete="email"
          />
          {showIssues && !/^\S+@\S+\.\S+$/.test(submitterEmail.trim()) && (
            <p role="alert" style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>Enter a valid email.</p>
          )}
        </div>
      </div>

      {/* Q2 — platforms */}
      <QuestionPanel
        anchorId="rf-platforms"
        number={Q.platforms.number}
        label={Q.platforms.label}
        helper={Q.platforms.helper}
        issue={issueFor("platforms")}
      >
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {RELEASE_PLATFORMS.map((p) => {
            const checked = (form.platforms ?? []).includes(p);
            return (
              <label key={p} className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--fg-1)", cursor: "pointer" }}>
                <Checkbox
                  checked={checked}
                  onCheckedChange={(on) => {
                    const cur = form.platforms ?? [];
                    onChange({ platforms: on ? [...cur, p] : cur.filter((x) => x !== p) });
                  }}
                />
                {p}
              </label>
            );
          })}
        </div>
      </QuestionPanel>

      {/* Q3 — VP approval (flag, not block) */}
      <QuestionPanel
        anchorId="rf-vpApproved"
        number={Q.vpApproved.number}
        label={Q.vpApproved.label}
        issue={issueFor("vpApproved")}
      >
        <ChoiceRow name="vpApproved" options={["Yes", "No"] as const} value={form.vpApproved} onChange={(v) => onChange({ vpApproved: v })} />
      </QuestionPanel>

      {/* Q4 — photo release (blocks on No) */}
      <QuestionPanel
        anchorId="rf-photoRelease"
        number={Q.photoRelease.number}
        label={Q.photoRelease.label}
        helper={Q.photoRelease.helper}
        issue={releaseNo(form.photoRelease) ? null : issueFor("photoRelease")}
      >
        <ChoiceRow name="photoRelease" options={["Yes", "No"] as const} value={form.photoRelease} onChange={(v) => onChange({ photoRelease: v })} />
        {releaseNo(form.photoRelease) && <ReleaseBlockedPanel />}
      </QuestionPanel>

      {/* Q5 — minor release (blocks on No) */}
      <QuestionPanel
        anchorId="rf-minorRelease"
        number={Q.minorRelease.number}
        label={Q.minorRelease.label}
        helper={Q.minorRelease.helper}
        issue={releaseNo(form.minorRelease) ? null : issueFor("minorRelease")}
      >
        <ChoiceRow name="minorRelease" options={["N/A", "Yes", "No"] as const} value={form.minorRelease} onChange={(v) => onChange({ minorRelease: v })} />
        {releaseNo(form.minorRelease) && <ReleaseBlockedPanel />}
      </QuestionPanel>

      {/* Q6 — off-campus release (blocks on No) */}
      <QuestionPanel
        anchorId="rf-offCampusRelease"
        number={Q.offCampusRelease.number}
        label={Q.offCampusRelease.label}
        issue={releaseNo(form.offCampusRelease) ? null : issueFor("offCampusRelease")}
      >
        <ChoiceRow name="offCampusRelease" options={["N/A", "Yes", "No"] as const} value={form.offCampusRelease} onChange={(v) => onChange({ offCampusRelease: v })} />
        {releaseNo(form.offCampusRelease) && <ReleaseBlockedPanel />}
      </QuestionPanel>

      {/* Q7 — post date */}
      <QuestionPanel
        anchorId="rf-requestedPostDate"
        number={Q.requestedPostDate.number}
        label={Q.requestedPostDate.label}
        helper={Q.requestedPostDate.helper}
        issue={issueFor("requestedPostDate")}
      >
        <input
          type="date"
          className="sp-input"
          value={form.requestedPostDate ?? ""}
          min={new Date().toLocaleDateString("en-CA")}
          onChange={(e) => onChange({ requestedPostDate: e.target.value })}
          aria-label={Q.requestedPostDate.label}
        />
      </QuestionPanel>

      {/* Q8 — post time */}
      <QuestionPanel
        anchorId="rf-requestedPostTime"
        number={Q.requestedPostTime.number}
        label={Q.requestedPostTime.label}
        helper={Q.requestedPostTime.helper}
        issue={issueFor("requestedPostTime")}
      >
        <input
          type="text"
          className="sp-input"
          placeholder="e.g. 2:30 PM CST"
          value={form.requestedPostTime ?? ""}
          onChange={(e) => onChange({ requestedPostTime: e.target.value })}
          aria-label={Q.requestedPostTime.label}
        />
      </QuestionPanel>

      {/* Q9 — the post copy (this IS the caption) */}
      <QuestionPanel
        anchorId="rf-postText"
        number={Q.postText.number}
        label={Q.postText.label}
        helper={Q.postText.helper}
        issue={issueFor("postText")}
      >
        <textarea
          className="sp-input"
          rows={6}
          value={form.postText ?? ""}
          onChange={(e) => onChange({ postText: e.target.value })}
          aria-label={Q.postText.label}
          style={{ resize: "vertical" }}
        />
      </QuestionPanel>

      {/* Q10 — including media? */}
      <QuestionPanel
        anchorId="rf-includesMedia"
        number={Q.includesMedia.number}
        label={Q.includesMedia.label}
        helper={
          hasGeneratedGraphic
            ? "Your generated graphic is already attached — extra photos or videos are optional."
            : undefined
        }
        issue={issueFor("includesMedia")}
      >
        <ChoiceRow name="includesMedia" options={["Yes", "No"] as const} value={form.includesMedia} onChange={(v) => onChange({ includesMedia: v })} />
      </QuestionPanel>

      {/* Q11 — dropzone */}
      <QuestionPanel
        anchorId="rf-assets"
        number={Q.upload.number}
        label={Q.upload.label}
        helper={Q.upload.helper}
        issue={issueFor("assets")}
      >
        <a
          href={MEDIA_RELEASE_FORMS_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1"
          style={{ fontSize: 12, color: "var(--solar)", textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          Media release forms
          <ExternalLink style={{ width: 11, height: 11 }} />
        </a>
        <div
          {...getRootProps({
            role: "button",
            "aria-label": `Upload up to ${MAX_UPLOAD_FILES} photos, videos, or documents, 200 MB each`,
          })}
          className="text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5"
          style={{
            border: `1.5px dashed ${isDragActive ? "var(--solar)" : "var(--hairline-strong)"}`,
            borderRadius: "var(--radius-input)",
            background: isDragActive ? "var(--accent-wash)" : "var(--lift)",
            padding: 18,
            opacity: uploading ? 0.6 : 1,
          }}
        >
          <input {...getInputProps()} />
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-1)" }}>
            {isDragActive ? "Drop files to add them" : "Click or drag files here"}
          </p>
          <p style={{ fontSize: 11, color: "var(--fg-4)" }}>
            Photos, videos, PDFs, Word, PowerPoint · up to {MAX_UPLOAD_FILES} files · 200 MB each
          </p>
        </div>
        {dropError && (
          <p role="alert" style={{ fontSize: 12, color: "var(--danger)" }}>{dropError}</p>
        )}
        {assets.length > 0 && (
          <ul className="space-y-2">
            {assets.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2"
                style={{ border: "1px solid var(--hairline)", background: "var(--paper)" }}
              >
                {a.previewUrl ? (
                  <img
                    src={a.previewUrl}
                    alt=""
                    className="flex-shrink-0 object-cover"
                    style={{ width: 40, height: 40, borderRadius: 8, border: "1px solid var(--hairline)" }}
                  />
                ) : (
                  <AssetGlyph mimeType={a.mimeType} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate" style={{ fontSize: 13, color: "var(--ink)" }}>{a.name}</span>
                  <span className="block" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                    {fmtSize(a.size)}
                    {a.progress === "uploading" && " · uploading…"}
                    {a.progress === "done" && " · uploaded"}
                    {a.progress === "error" && (
                      <span style={{ color: "var(--danger)" }}> · upload failed</span>
                    )}
                  </span>
                </span>
                {!uploading && (
                  <button
                    type="button"
                    onClick={() => removeAsset(a.id)}
                    aria-label={`Remove ${a.name}`}
                    style={{ color: "var(--fg-3)" }}
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </QuestionPanel>

      {/* Q12 — acknowledgement */}
      <QuestionPanel
        anchorId="rf-acknowledged"
        number={Q.acknowledged.number}
        label={Q.acknowledged.label}
        issue={issueFor("acknowledged")}
      >
        <label className="flex items-start gap-2.5" style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--fg-1)", cursor: "pointer" }}>
          <Checkbox
            checked={form.acknowledged === true}
            onCheckedChange={(on) => onChange({ acknowledged: on === true })}
            style={{ marginTop: 2 }}
          />
          <span>{Q.acknowledged.helper}</span>
        </label>
      </QuestionPanel>
    </div>
  );
}
