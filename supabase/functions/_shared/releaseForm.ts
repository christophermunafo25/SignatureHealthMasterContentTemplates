// Deno-compatible copy of src/lib/releaseForm.ts for the submit-content
// Edge Function. KEEP IN SYNC with that file — it is the single source of
// truth for the form shape, question copy, and validation rules. The
// client validates for UX; this validates for truth.
//

// v3: the client's six-question Social Media Submission Form. The six v2
// consent questions collapse into one agreement (Q6), and the posting
// date/time pair is now gated behind Q5. v1/v2 documents stay readable —
// their fields live on as optional, deprecated members of ReleaseForm.
export const RELEASE_FORM_VERSION = 3 as const;

export type YesNo = "Yes" | "No";
export type YesNoNa = "N/A" | "Yes" | "No";

export type ReleasePlatform = "Facebook" | "Instagram";

/** Q2 — what the user actually picked. "Both" expands into `platforms`. */
export type PlatformChoice = "Facebook" | "Instagram" | "Both";

/** One document type for every version — a superset, not a discriminated
 * union, so every read surface reads one type and `tsc` can still find each
 * caller of a field v3 stopped writing. `version` selects the branch. */
export interface ReleaseForm {
  /** 1 | 2 = legacy, 3 = current. */
  version: number;

  // ── v3 ──────────────────────────────────────────────────────────────────
  /** Q2 — the literal choice the user made, preserved for the record. */
  platformChoice?: PlatformChoice;
  /** Q2 derived — "Both" expands to both. Drives submissions.platforms. */
  platforms: ReleasePlatform[];
  /** Q3 — the post copy. Mirrored into submissions.caption. */
  postText: string;
  /** Q5 — gates Q5a/Q5b. Defaults to "No". */
  needsSpecificSchedule?: YesNo;
  /** Q5a — YYYY-MM-DD, today or later. Only when needsSpecificSchedule = Yes. */
  requestedPostDate?: string;
  /** Q5b — OPTIONAL free text even when a date is requested. */
  requestedPostTime?: string;
  /** Q6 — must be true. */
  acknowledged: boolean;
  submittedAt: string;

  // ── v1/v2 legacy — read-only, never written by v3 ────────────────────────
  /** @deprecated v2 only — Q3a. */ isEvent?: YesNo;
  /** @deprecated v2 only — Q3b. Sourced release_flagged. */ vpApproved?: YesNo;
  /** @deprecated v2 only — Q4. */ photoRelease?: YesNo;
  /** @deprecated v2 only — Q5a. */ hasMinors?: YesNo;
  /** @deprecated v2 only — Q5b. */ minorRelease?: YesNoNa;
  /** @deprecated v2 only — Q6. */ offCampusRelease?: YesNoNa;
  /** @deprecated v2 only — Q10. */ includesMedia?: YesNo;
}

// ── Question copy (from the client's live Microsoft form) ─────────────────

/** The three-paragraph intro shown above the form on both intake paths. */
export const SUBMISSION_INTRO: { lead: string; beforeSubmitting: string; timing: string } = {
  lead:
    "Have something great happening at your facility? Send us your photos, videos, and story details, and The Agency will help share them on social media.",
  // Rendered with "Before submitting:" bold and inline.
  beforeSubmitting:
    "Please select your best photos rather than uploading multiple similar images. Photos and videos should be clear, appropriate for social media, and follow the submission requirements outlined in this form.",
  timing:
    "Requests are typically reviewed and posted the day they are submitted or within 24 hours. If your content is time-sensitive, you can request a specific posting date below.",
};

/** Q4 — the tinted reminders panel above the dropzone. */
export const PHOTO_REMINDERS: string[] = [
  "Choose your best photos rather than uploading several similar images.",
  "Images should be clear and appropriate for social media.",
  "Residents should be appropriately dressed.",
  "Do not submit images containing visible resident charts, Simply Me charts, private information, or other confidential information.",
  "Do not submit photos of residents or stakeholders with guns or gun-like items, including toy guns, NERF guns, Super Soakers, etc.",
  "Make sure everyone pictured has the appropriate consent/release on file before uploading.",
];

export const PHOTO_REMINDERS_CLOSING =
  "Content that does not meet posting guidelines may not be published.";

/** The unnumbered section above Q6. v3 collapses every v2 consent question
 * into this one attestation — there is no "No" to answer any more. */
export const SUBMISSION_AGREEMENT: { lead: string; preamble: string; items: string[] } = {
  lead: "Before submitting, please review the following requirements.",
  preamble: "By submitting this content, I confirm that:",
  items: [
    "All residents, stakeholders, minors, and other individuals pictured have the appropriate photo/media releases or consent forms on file, as applicable.",
    "Any required off-campus consent/release is on file.",
    "I have reviewed the photos and videos and confirmed that they do not contain private, confidential, protected, or inappropriate information or imagery.",
    "The submitted content follows Signature HealthCARE's social media and photo submission guidelines.",
    "All events/activities have been approved by our facility CEO.",
    "I understand that content may be edited for grammar, clarity, length, formatting, or social media style.",
    "I understand that submission does not guarantee publication and that content may be delayed or declined if it does not meet posting guidelines.",
  ],
};

/** Shown under the Q5a/Q5b pair. */
export const SCHEDULE_NOTE =
  "Requested dates and times are not guaranteed. The Agency will make every effort to accommodate time-sensitive requests.";

/** Q3 — the callout below the textarea. */
export const POST_TEXT_REMINDER =
  "Helpful reminder: Please use complete sentences and normal capitalization. The Agency may make minor edits for grammar, clarity, length, formatting, and social media style.";

/** What facilities call the central social media team. Every facing surface
 * reads from here — never hardcode the name in a component. */
export const AGENCY_NAME = "The Agency";

export const AGENCY_EMAIL = "theagency@SignaturehealthcareLLC.com";

/** Q2 footnote, split so the address renders as a mailto: link. */
export const PLATFORM_FOOTNOTE: { before: string; after: string } = {
  before: "If your facility is interested in an Instagram account, please contact ",
  after: ".",
};

/** Q4 — the size affordance beside the dropzone. */
export const MAX_UPLOAD_LABEL = "250MB";

export const MEDIA_RELEASE_FORMS_URL =
  "https://signaturehealthcarellc.sharepoint.com/sites/THEAgency/Media%20Release%20Forms/Forms/AllItems.aspx";

export interface ReleaseQuestion {
  /** The question number facilities see on the form (1–6). */
  number: number;
  /** Sub-letter for the gated schedule pair: 5 gates 5a and 5b. */
  suffix?: "a" | "b";
  label: string;
  helper?: string;
}

/** "5a", "5b", "4" — for display and anchor ids. */
export const questionNumber = (q: ReleaseQuestion): string =>
  `${q.number}${q.suffix ?? ""}`;

/** Question copy keyed by ReleaseForm field, plus the two questions that
 * have no field of their own: Q1 (facility lives on the submission, not the
 * form document) and Q4 (files land in `assets`). */
export const RELEASE_QUESTIONS: Record<
  | "facility"
  | "platforms"
  | "postText"
  | "upload"
  | "needsSpecificSchedule"
  | "requestedPostDate"
  | "requestedPostTime"
  | "acknowledged",
  ReleaseQuestion
> = {
  facility: {
    number: 1,
    label: "Facility Name",
  },
  platforms: {
    number: 2,
    label: "Where would you like this posted?",
    helper: "Select all that apply.",
  },
  postText: {
    number: 3,
    label: "What would you like your post to say?",
    helper: "Please provide the caption you would like us to use for your post.",
  },
  upload: {
    number: 4,
    label: "Upload your photos or videos.",
    helper: "Upload the best photos or videos from your event or activity.",
  },
  needsSpecificSchedule: {
    number: 5,
    label: "Does this need to be posted on a specific date or at a specific time?",
  },
  requestedPostDate: {
    number: 5,
    suffix: "a",
    label: "Requested posting date",
  },
  requestedPostTime: {
    number: 5,
    suffix: "b",
    label: "Requested posting time",
    helper: "Include AM or PM.",
  },
  acknowledged: {
    number: 6,
    label: "Submission Agreement",
    helper:
      "I have reviewed the Social Media Submission Agreement above and confirm that this submission meets these requirements.",
  },
};

/** v1/v2 question copy, FROZEN. v3 asks none of these, but the review
 * panel, Form Records, and the CSV export must render a historical document
 * exactly as it read the day it was submitted. Treat this as audit copy:
 * never reword it, never renumber it, never delete a key. */
export const LEGACY_RELEASE_QUESTIONS: Record<
  | "platforms"
  | "isEvent"
  | "vpApproved"
  | "photoRelease"
  | "hasMinors"
  | "minorRelease"
  | "offCampusRelease"
  | "requestedPostDate"
  | "requestedPostTime"
  | "postText"
  | "includesMedia"
  | "upload"
  | "acknowledged",
  ReleaseQuestion
> = {
  platforms: {
    number: 2,
    label: "What platform is this for?",
    helper:
      "Not all facilities have IG. If interested, please contact the Agency at theagency@signaturehealthcarellc.com.",
  },
  isEvent: {
    number: 3,
    suffix: "a",
    label: "Is this submission for an event?",
  },
  vpApproved: {
    number: 3,
    suffix: "b",
    label: "Did your Vice President of Operations approve this event?",
  },
  photoRelease: {
    number: 4,
    label:
      "Do you have a photo release on file for ALL residents & stakeholders in these photos?",
    helper:
      "If you do not have a signed permission form, please use a different photo or get permission BEFORE uploading the images.",
  },
  hasMinors: {
    number: 5,
    suffix: "a",
    label: "Are there any minors in this submission?",
  },
  minorRelease: {
    number: 5,
    suffix: "b",
    label: "Do ALL minors in the pictures have proper media releases and consent forms?",
    helper:
      "If you do not have a signed consent form, please use a different photo or get permission BEFORE uploading the images.",
  },
  offCampusRelease: {
    number: 6,
    label:
      "Do you have an off-campus consent release on file for ALL residents and stakeholders in these photos?",
  },
  requestedPostDate: {
    number: 7,
    label: "When would you like this posted?",
    helper: "By default, requests are posted the day of submission or within 24 hours.",
  },
  requestedPostTime: {
    number: 8,
    label: "What time would you like this posted?",
    helper:
      "Please indicate what time you would like this posted. Please include AM or PM. All entries default to EST, so if you are in CST, please indicate that as well, so we can adjust times accordingly.",
  },
  postText: {
    number: 9,
    label: "What would you like your post to say?",
    helper:
      "Please note: Do not capitalize every word, or submit your request in all caps. Please use complete sentences with correct grammar when submitting.",
  },
  includesMedia: {
    number: 10,
    label: "Are you uploading a photo/video to be included in the post?",
  },
  upload: {
    number: 11,
    label: "Upload file here.",
    helper:
      "This includes any media such as images, graphics, flyers, videos, etc. If you're requesting a Stakeholder Spotlight post, please don't forget to include a photo of the stakeholder! Please keep in mind: if your photos are blurry, if residents are not properly clothed, if the resident's Simply Me chart is visible in the photos, we will not be able to post the photos.",
  },
  acknowledged: {
    number: 12,
    label: "Posting Guideline Rules Acknowledgement",
    helper:
      "By checking Yes, you have read and understood the rules of our posting guidelines. If your request does not comply with the above rules and guidelines, it may not be posted. Requests are sent for approval prior to posting.",
  },
};

/** True when a stored document uses the v3 questionnaire. Every admin read
 * surface branches on this — legacy rows must never be re-rendered as v3. */
export const isV3Form = (form: { version?: number } | null | undefined): boolean =>
  (form?.version ?? 0) >= 3;

/** The single confirm control on Q6. */
export const AGREEMENT_CONFIRM_LABEL = "Yes, I confirm.";

/** Q5's two radio labels, in the order the client's form shows them. */
export const SCHEDULE_CHOICES: ReadonlyArray<{ value: YesNo; label: string }> = [
  { value: "No", label: "No — standard scheduling is fine." },
  { value: "Yes", label: "Yes — I have a specific date/time request." },
];

/** Storage vocabulary — what lands in submissions.platforms. */
export const RELEASE_PLATFORMS: ReleasePlatform[] = ["Facebook", "Instagram"];

/** Q2's three options. "Both" is a UI affordance: storage stays an array so
 * submissions.platforms, its index, and the board filters are untouched. */
export const PLATFORM_CHOICES: PlatformChoice[] = ["Facebook", "Instagram", "Both"];

export const platformsForChoice = (choice: PlatformChoice): ReleasePlatform[] =>
  choice === "Both" ? ["Facebook", "Instagram"] : [choice];

/** A fresh, unanswered form. Q5 is pre-selected in the client's form, so
 * match it — "No" is the overwhelmingly common answer. */
export function emptyReleaseForm(): Partial<ReleaseForm> {
  return {
    version: RELEASE_FORM_VERSION,
    platforms: [],
    postText: "",
    needsSpecificSchedule: "No",
    acknowledged: false,
  };
}

// ── Validation ────────────────────────────────────────────────────────────

export interface ReleaseFormContext {
  /** Template path: the rendered graphic satisfies Q4. */
  hasGeneratedGraphic: boolean;
  assetCount: number;
}

export interface ReleaseFormIssue {
  field: keyof ReleaseForm | "assets";
  message: string;
  /** blocking = the submission is refused; flag = saved and marked for
   * review. v3 raises no flags — the severity and flagsOf() stay for
   * legacy rows and for whatever The Agency wants to triage on next. */
  severity: "blocking" | "flag";
}

/** The question number a validation issue points at, or null when the field
 * has no numbered question. Shared so the modal's "Still needed" line can
 * never drift from the real numbering. */
export function questionNumberForField(field: ReleaseFormIssue["field"]): string | null {
  switch (field) {
    case "platforms":
      return questionNumber(RELEASE_QUESTIONS.platforms);
    case "postText":
      return questionNumber(RELEASE_QUESTIONS.postText);
    case "assets":
      return questionNumber(RELEASE_QUESTIONS.upload);
    case "needsSpecificSchedule":
      return questionNumber(RELEASE_QUESTIONS.needsSpecificSchedule);
    case "requestedPostDate":
      return questionNumber(RELEASE_QUESTIONS.requestedPostDate);
    case "requestedPostTime":
      return questionNumber(RELEASE_QUESTIONS.requestedPostTime);
    case "acknowledged":
      return questionNumber(RELEASE_QUESTIONS.acknowledged);
    default:
      return null;
  }
}

/** Local YYYY-MM-DD for "today or later" checks. */
function todayLocal(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** All-caps detector: no lowercase letters anywhere, and enough letters
 * (15+) that it can't be an acronym-heavy but legitimate sentence. */
function isAllCaps(text: string): boolean {
  if (!/^[^a-z]*$/.test(text)) return false;
  const letters = text.match(/[A-Z]/g);
  return (letters?.length ?? 0) >= 15;
}

/** v3 rules. Nothing re-validates a stored legacy document — v1/v2 forms are
 * read, never re-submitted — so there is deliberately no v2 branch here. */
export function validateReleaseForm(
  form: Partial<ReleaseForm>,
  ctx: ReleaseFormContext,
): ReleaseFormIssue[] {
  const issues: ReleaseFormIssue[] = [];
  const blocking = (field: ReleaseFormIssue["field"], message: string) =>
    issues.push({ field, message, severity: "blocking" });

  // Q2
  if (!form.platforms || form.platforms.length === 0) {
    blocking("platforms", "Tell us where you'd like this posted.");
  }

  // Q3 — the all-caps rule stays blocking: v3 has no flag path, and Q3's
  // reminder still asks for normal capitalization.
  const postText = form.postText ?? "";
  if (postText.trim().length < 10) {
    blocking("postText", "Write out what you'd like the post to say (at least a sentence).");
  } else if (isAllCaps(postText)) {
    blocking("postText", "Please don't submit your request in all caps.");
  }

  // Q4 — now required. On the template path the rendered graphic IS the
  // media, so an upload is never demanded there.
  if (ctx.assetCount === 0 && !ctx.hasGeneratedGraphic) {
    blocking("assets", "Add the photos or videos you'd like us to post.");
  }

  // Q5 gates Q5a/Q5b. The gate is always required; the date only when the
  // gate is "Yes"; the time never. A "No" gate must NOT leave a stale
  // answer behind — the form clears both, and this refuses anything else
  // that sends one.
  if (form.needsSpecificSchedule !== "Yes" && form.needsSpecificSchedule !== "No") {
    blocking(
      "needsSpecificSchedule",
      "Tell us whether this needs to go up on a specific date or time.",
    );
  } else if (form.needsSpecificSchedule === "Yes") {
    if (!form.requestedPostDate || form.requestedPostDate < todayLocal()) {
      blocking("requestedPostDate", "Pick today or a future date.");
    }
  } else {
    if (form.requestedPostDate) {
      blocking(
        "requestedPostDate",
        "Standard scheduling is fine, so the requested date shouldn't be set.",
      );
    }
    if (form.requestedPostTime) {
      blocking(
        "requestedPostTime",
        "Standard scheduling is fine, so the requested time shouldn't be set.",
      );
    }
  }

  // Q6
  if (form.acknowledged !== true) {
    blocking("acknowledged", "Please confirm the Social Media Submission Agreement.");
  }

  return issues;
}

export const isBlocked = (issues: ReleaseFormIssue[]): boolean =>
  issues.some((i) => i.severity === "blocking");

export const flagsOf = (issues: ReleaseFormIssue[]): ReleaseFormIssue[] =>
  issues.filter((i) => i.severity === "flag");

// ── Shared file constants ─────────────────────────────────────────────────
// MUST exactly match the bucket's allowed_mime_types in migration 0028 and
// the bucket's file_size_limit as raised by migration 0033.

export const MAX_UPLOAD_FILES = 10;
export const MAX_UPLOAD_BYTES = 250 * 1024 * 1024; // 250 MB

/** mime → extension. */
export const ALLOWED_UPLOAD_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

/** Human reason a file can't be uploaded, or null when it's acceptable. */
export function uploadRejectReason(file: File): string | null {
  if (!ALLOWED_UPLOAD_MIME[file.type]) {
    return `"${file.name}" isn't a supported file type. Use a photo, video, PDF, Word, or PowerPoint file.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}" is over 250 MB. Compress it or trim the video and try again.`;
  }
  return null;
}
