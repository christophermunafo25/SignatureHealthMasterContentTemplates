import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ExternalLink, FileText, Film, Presentation, X } from "lucide-react";
import type { PublicFacility } from "@/lib/publicClient";
import {
  AGENCY_EMAIL,
  AGREEMENT_CONFIRM_LABEL,
  ALLOWED_UPLOAD_MIME,
  MAX_UPLOAD_FILES,
  MAX_UPLOAD_LABEL,
  MEDIA_RELEASE_FORMS_URL,
  PHOTO_REMINDERS,
  PHOTO_REMINDERS_CLOSING,
  PLATFORM_CHOICES,
  PLATFORM_FOOTNOTE,
  POST_TEXT_REMINDER,
  RELEASE_QUESTIONS,
  SCHEDULE_CHOICES,
  SCHEDULE_NOTE,
  SUBMISSION_AGREEMENT,
  SUBMISSION_INTRO,
  platformsForChoice,
  uploadRejectReason,
  type ReleaseForm as ReleaseFormDoc,
  type ReleaseFormIssue,
  type YesNo,
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
  /** Template path: the rendered graphic IS the media, so Q4 shows it and
   * uploads stay optional. Direct path: Q4 requires at least one file. */
  hasGeneratedGraphic: boolean;
  /** Object URL of the rendered graphic, shown in Q4 on the template path so
   * the user can see what is being attached. */
  graphicPreviewUrl?: string | null;
  assets: PendingAsset[];
  onAssetsChange(next: PendingAsset[]): void;
  /** Show validation messages only after a submit attempt. */
  showIssues: boolean;
  issues: ReleaseFormIssue[];
  /** Q4 dropzone is disabled while an upload is in flight. */
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

function QuestionPanel({
  number,
  suffix,
  label,
  helper,
  issue,
  children,
  anchorId,
}: {
  number?: number;
  /** "a"/"b" for the gated schedule pair — renders as "Question 05a". */
  suffix?: "a" | "b";
  label: string;
  helper?: string;
  issue?: ReleaseFormIssue | null;
  children: React.ReactNode;
  anchorId?: string;
}) {
  return (
    <div id={anchorId} className="p-4 space-y-2.5" style={panel}>
      <div className="min-w-0">
        {number !== undefined && (
          <p className="sp-eyebrow">
            Question {String(number).padStart(2, "0")}
            {suffix ?? ""}
          </p>
        )}
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

/** Radio row over explicit value/label pairs — Q5's labels are sentences,
 * not the stored value. */
function ChoiceRow<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | undefined;
  onChange(v: T): void;
}) {
  return (
    <RadioGroup
      value={value ?? ""}
      onValueChange={(v) => onChange(v as T)}
      className="flex flex-col gap-2"
      aria-label={name}
    >
      {options.map((o) => (
        <label
          key={o.value}
          className="flex items-center gap-2"
          style={{ fontSize: 13, color: "var(--fg-1)", cursor: "pointer" }}
        >
          <RadioGroupItem value={o.value} id={`${name}-${o.value}`} />
          {o.label}
        </label>
      ))}
    </RadioGroup>
  );
}

/** The Social Media Submission Form body — used inline by the direct path
 * and inside the modal by the template path. Owns NO submission logic;
 * question copy comes from src/lib/releaseForm.ts, never duplicated here. */
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
  graphicPreviewUrl,
  assets,
  onAssetsChange,
  showIssues,
  issues,
  uploading,
}: ReleaseFormProps) {
  // The two supporting intro paragraphs collapse behind a disclosure on
  // mobile; the lead paragraph is always visible.
  const [introOpen, setIntroOpen] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  // v3 has no answer that is wrong on its own — the six consent gates are
  // gone — so nothing surfaces an error before a submit attempt.
  const issueFor = (field: ReleaseFormIssue["field"]): ReleaseFormIssue | null =>
    showIssues ? (issues.find((i) => i.field === field) ?? null) : null;

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

  return (
    <div className="space-y-4">
      {/* Intro — three paragraphs from the client's form */}
      <div className="p-4" style={panel}>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--fg-1)" }}>{SUBMISSION_INTRO.lead}</p>
        <button
          type="button"
          className="flex items-center justify-between w-full sm:hidden mt-3"
          onClick={() => setIntroOpen((o) => !o)}
          aria-expanded={introOpen}
          style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
        >
          Read before submitting
          <ChevronDown
            style={{ width: 15, height: 15, transform: introOpen ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
          />
        </button>
        <div className={`${introOpen ? "block mt-3" : "hidden"} sm:block sm:mt-2 space-y-2`}>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--fg-1)" }}>
            <b style={{ fontWeight: 600, color: "var(--ink)" }}>Before submitting:</b>{" "}
            {SUBMISSION_INTRO.beforeSubmitting}
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--fg-2)" }}>{SUBMISSION_INTRO.timing}</p>
        </div>
      </div>

      {/* Q1 — facility */}
      <QuestionPanel anchorId="rf-facility" number={Q.facility.number} label={Q.facility.label}>
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
            placeholder="Select your facility"
            emptyHint={
              <span>
                No facility matches that search. Don&rsquo;t see yours? Contact the
                Signature marketing team and they&rsquo;ll add it.
              </span>
            }
          />
        )}
        {showIssues && !facility && (
          <p role="alert" style={{ fontSize: 12, color: "var(--danger)" }}>Pick your facility.</p>
        )}
      </QuestionPanel>

      {/* Information — unnumbered. The client's form doesn't ask, but
          submitter_email is NOT NULL and the decline flow emails it. */}
      <div className="p-4 space-y-3" style={panel}>
        <p className="sp-eyebrow">Information</p>
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

      {/* Q2 — where to post. Checkboxes to match the client's form, but
          single-select: every combination collapses to one of three states,
          and "Both" is the third. */}
      <QuestionPanel
        anchorId="rf-platforms"
        number={Q.platforms.number}
        label={Q.platforms.label}
        helper={Q.platforms.helper}
        issue={issueFor("platforms")}
      >
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {PLATFORM_CHOICES.map((c) => (
            <label key={c} className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--fg-1)", cursor: "pointer" }}>
              <Checkbox
                checked={form.platformChoice === c}
                onCheckedChange={(on) =>
                  onChange(
                    on
                      ? { platformChoice: c, platforms: platformsForChoice(c) }
                      : { platformChoice: undefined, platforms: [] },
                  )
                }
              />
              {c}
            </label>
          ))}
        </div>
        <p style={{ fontSize: 12, lineHeight: 1.55, color: "var(--fg-3)" }}>
          {PLATFORM_FOOTNOTE.before}
          <a
            href={`mailto:${AGENCY_EMAIL}`}
            style={{ color: "var(--solar)", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            {AGENCY_EMAIL}
          </a>
          {PLATFORM_FOOTNOTE.after}
        </p>
      </QuestionPanel>

      {/* Q3 — the post copy (this IS the caption) */}
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
          placeholder="Enter your answer"
          value={form.postText ?? ""}
          onChange={(e) => onChange({ postText: e.target.value })}
          aria-label={Q.postText.label}
          style={{ resize: "vertical" }}
        />
        <p
          className="rounded-lg px-3 py-2"
          style={{ fontSize: 12, lineHeight: 1.55, color: "var(--fg-2)", background: "var(--accent-wash)" }}
        >
          {POST_TEXT_REMINDER}
        </p>
      </QuestionPanel>

      {/* Q4 — upload. Required on the direct path; on the template path the
          rendered graphic is already attached, so uploads are extras. */}
      <QuestionPanel
        anchorId="rf-assets"
        number={Q.upload.number}
        label={hasGeneratedGraphic ? "Your graphic — add anything else here" : Q.upload.label}
        helper={hasGeneratedGraphic ? undefined : Q.upload.helper}
        issue={issueFor("assets")}
      >
        {hasGeneratedGraphic && (
          <div
            className="flex items-center gap-3 p-3"
            style={{
              background: "var(--accent-wash)",
              border: "1px solid var(--hairline)",
              borderRadius: "var(--radius-input)",
            }}
          >
            {graphicPreviewUrl ? (
              <img
                src={graphicPreviewUrl}
                alt="The graphic being attached to your submission"
                style={{
                  width: 56,
                  height: 56,
                  objectFit: "cover",
                  borderRadius: 6,
                  border: "1px solid var(--hairline)",
                  flexShrink: 0,
                }}
              />
            ) : null}
            <div className="min-w-0">
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                Your graphic is attached
              </p>
              <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>
                It goes with this submission automatically. Adding photos or
                videos below is optional.
              </p>
            </div>
          </div>
        )}

        {/* Photo reminders — the guidance that used to live in the posting
            rules intro, moved next to the upload it governs. */}
        <div
          className="p-3 space-y-2"
          style={{ background: "var(--accent-wash)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-input)" }}
        >
          <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>Photo reminders:</p>
          <ul className="space-y-1.5" style={{ paddingLeft: 18, listStyle: "disc" }}>
            {PHOTO_REMINDERS.map((rule) => (
              <li key={rule} style={{ fontSize: 12, lineHeight: 1.55, color: "var(--fg-2)" }}>
                {rule}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.55, color: "var(--solar)" }}>
            {PHOTO_REMINDERS_CLOSING}
          </p>
          {/* Reminder 6 asks for consent on file; this is where to get one. */}
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
        </div>

        <div
          {...getRootProps({
            role: "button",
            "aria-label": `Upload up to ${MAX_UPLOAD_FILES} photos, videos, or documents, 250 MB each`,
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
            Photos, videos, PDFs, Word, PowerPoint · up to {MAX_UPLOAD_FILES} files · Max file size: {MAX_UPLOAD_LABEL}
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

      {/* Q5 — scheduling gate. Choosing "No" clears any date/time already
          entered, so a user who changes their mind can't leave a stale
          request behind. */}
      <QuestionPanel
        anchorId="rf-needsSpecificSchedule"
        number={Q.needsSpecificSchedule.number}
        label={Q.needsSpecificSchedule.label}
        issue={issueFor("needsSpecificSchedule")}
      >
        <ChoiceRow
          name="needsSpecificSchedule"
          options={SCHEDULE_CHOICES}
          value={form.needsSpecificSchedule}
          onChange={(v: YesNo) =>
            onChange(
              v === "Yes"
                ? { needsSpecificSchedule: v }
                : { needsSpecificSchedule: v, requestedPostDate: undefined, requestedPostTime: undefined },
            )
          }
        />
      </QuestionPanel>

      {form.needsSpecificSchedule === "Yes" && (
        <>
          {/* Q5a — required once a slot is requested */}
          <QuestionPanel
            anchorId="rf-requestedPostDate"
            number={Q.requestedPostDate.number}
            suffix={Q.requestedPostDate.suffix}
            label={Q.requestedPostDate.label}
            issue={issueFor("requestedPostDate")}
          >
            <input
              type="date"
              className="sp-input"
              placeholder="Please select a date"
              value={form.requestedPostDate ?? ""}
              min={new Date().toLocaleDateString("en-CA")}
              onChange={(e) => onChange({ requestedPostDate: e.target.value })}
              aria-label={Q.requestedPostDate.label}
            />
          </QuestionPanel>

          {/* Q5b — OPTIONAL, even with a date requested */}
          <QuestionPanel
            anchorId="rf-requestedPostTime"
            number={Q.requestedPostTime.number}
            suffix={Q.requestedPostTime.suffix}
            label={Q.requestedPostTime.label}
            helper={Q.requestedPostTime.helper}
            issue={issueFor("requestedPostTime")}
          >
            <input
              type="text"
              className="sp-input"
              placeholder="Enter time (e.g., 2:00 PM)"
              value={form.requestedPostTime ?? ""}
              onChange={(e) => onChange({ requestedPostTime: e.target.value })}
              aria-label={Q.requestedPostTime.label}
            />
          </QuestionPanel>

          <p className="px-1" style={{ fontSize: 12, lineHeight: 1.55, color: "var(--fg-3)" }}>
            {SCHEDULE_NOTE}
          </p>
        </>
      )}

      {/* Social Media Submission Agreement — unnumbered, and the whole
          reason v3 needs no consent gates. */}
      <div className="p-4 space-y-2.5" style={panel}>
        <p className="sp-panel-title">Social Media Submission Agreement</p>
        <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.55, color: "var(--ink)" }}>
          {SUBMISSION_AGREEMENT.lead}
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--fg-1)" }}>
          {SUBMISSION_AGREEMENT.preamble}
        </p>
        <ul className="space-y-2">
          {SUBMISSION_AGREEMENT.items.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2
                aria-hidden
                style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2, color: "var(--mint)" }}
              />
              <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--fg-2)" }}>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Q6 — the single confirm */}
      <QuestionPanel
        anchorId="rf-acknowledged"
        number={Q.acknowledged.number}
        label={Q.acknowledged.label}
        helper={Q.acknowledged.helper}
        issue={issueFor("acknowledged")}
      >
        <label
          className="flex items-center gap-2.5"
          style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", cursor: "pointer" }}
        >
          <Checkbox
            checked={form.acknowledged === true}
            onCheckedChange={(on) => onChange({ acknowledged: on === true })}
          />
          <span className="flex items-center gap-1.5">
            {form.acknowledged === true && (
              <Check aria-hidden style={{ width: 13, height: 13, color: "var(--mint)" }} />
            )}
            {AGREEMENT_CONFIRM_LABEL}
          </span>
        </label>
      </QuestionPanel>
    </div>
  );
}
