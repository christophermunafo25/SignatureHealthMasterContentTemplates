// Deno-compatible copy of src/lib/releaseForm.ts for the submit-content
// Edge Function. KEEP IN SYNC with that file — it is the single source of
// truth for the form shape, question copy, and validation rules. The
// client validates for UX; this validates for truth.
//

export const RELEASE_FORM_VERSION = 1 as const;

export type YesNo = "Yes" | "No";
export type YesNoNa = "N/A" | "Yes" | "No";

export type ReleasePlatform = "Facebook" | "Instagram";

export interface ReleaseForm {
  version: typeof RELEASE_FORM_VERSION;
  /** Q2 — at least one required. */
  platforms: ReleasePlatform[];
  /** Q3 — "No" flags the submission but does not block it. */
  vpApproved: YesNo;
  /** Q4 — "No" BLOCKS. */
  photoRelease: YesNo;
  /** Q5 — "No" BLOCKS. */
  minorRelease: YesNoNa;
  /** Q6 — "No" BLOCKS. */
  offCampusRelease: YesNoNa;
  /** Q7 — YYYY-MM-DD, today or later. */
  requestedPostDate: string;
  /** Q8 — free text, e.g. "2:30 PM CST". */
  requestedPostTime: string;
  /** Q9 — the post copy. Mirrored into submissions.caption. */
  postText: string;
  /** Q10 */
  includesMedia: YesNo;
  /** Q12 — must be true. */
  acknowledged: boolean;
  submittedAt: string;
}

// ── Question copy (from the client's live Microsoft form) ─────────────────

/** Intro block shown above the form on both intake paths. */
export const RELEASE_INTRO: { lead: string; rules: string[] } = {
  lead:
    "Please stagger your posts to be scheduled throughout the week if you have more than one you want published.",
  rules: [
    "Please do not submit multiple photos that look exactly the same. Choose the best photos.",
    "Quality is better than quantity.",
    "All desks must be clean with documents turned over, and computer screens must be turned off or on sleep mode. If your desk pictures do not follow our guidelines, they will not be posted. We want to protect everyone's privacy.",
    "We are no longer allowed to post stakeholders or residents with toy guns. Including, but not limited to: things like NERF guns, Super Soakers, etc.",
    "If your photos are blurry, if residents are not properly clothed, if the resident's Simply Me chart is visible in the photos, then we will not be able to post the photos. If your photos do not meet our guidelines, we will be unable to post them.",
    "Please do not write in all caps.",
  ],
};

export const MEDIA_RELEASE_FORMS_URL =
  "https://signaturehealthcarellc.sharepoint.com/sites/THEAgency/Media%20Release%20Forms/Forms/AllItems.aspx";

export interface ReleaseQuestion {
  /** Paper-form question number (2–12) — the numbering facilities know. */
  number: number;
  label: string;
  helper?: string;
}

/** Question copy keyed by ReleaseForm field (plus the Q11 dropzone, which
 * has no form field of its own — files land in `assets`). */
export const RELEASE_QUESTIONS: Record<
  | "platforms"
  | "vpApproved"
  | "photoRelease"
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
  vpApproved: {
    number: 3,
    label: "Did your Vice President of Operations approve this event?",
  },
  photoRelease: {
    number: 4,
    label:
      "Do you have a photo release on file for ALL residents & stakeholders in these photos?",
    helper:
      "If you do not have a signed permission form, please use a different photo or get permission BEFORE uploading the images.",
  },
  minorRelease: {
    number: 5,
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

export const RELEASE_PLATFORMS: ReleasePlatform[] = ["Facebook", "Instagram"];

/** A fresh, unanswered form. */
export function emptyReleaseForm(): Partial<ReleaseForm> {
  return { version: RELEASE_FORM_VERSION, platforms: [], postText: "", acknowledged: false };
}

// ── Validation ────────────────────────────────────────────────────────────

export interface ReleaseFormContext {
  /** Template path: the rendered graphic satisfies Q10/Q11. */
  hasGeneratedGraphic: boolean;
  assetCount: number;
}

export interface ReleaseFormIssue {
  field: keyof ReleaseForm | "assets";
  message: string;
  /** blocking = the submission is refused; flag = saved and marked for review. */
  severity: "blocking" | "flag";
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

export function validateReleaseForm(
  form: Partial<ReleaseForm>,
  ctx: ReleaseFormContext,
): ReleaseFormIssue[] {
  const issues: ReleaseFormIssue[] = [];
  const blocking = (field: ReleaseFormIssue["field"], message: string) =>
    issues.push({ field, message, severity: "blocking" });

  if (!form.platforms || form.platforms.length === 0) {
    blocking("platforms", "Choose at least one platform.");
  }
  if (form.photoRelease === "No") {
    blocking(
      "photoRelease",
      "We can't post photos without a signed release on file. Please use a different photo or get permission first.",
    );
  }
  if (form.minorRelease === "No") {
    blocking(
      "minorRelease",
      "We can't post photos of minors without a signed consent form on file. Please use a different photo or get permission first.",
    );
  }
  if (form.offCampusRelease === "No") {
    blocking(
      "offCampusRelease",
      "We can't post off-campus photos without a signed consent release on file. Please use a different photo or get permission first.",
    );
  }
  if (form.vpApproved === "No") {
    issues.push({
      field: "vpApproved",
      message: "This will be sent for review without VP of Operations approval.",
      severity: "flag",
    });
  }
  if (!form.requestedPostDate || form.requestedPostDate < todayLocal()) {
    blocking("requestedPostDate", "Pick today or a future date.");
  }
  if (!form.requestedPostTime?.trim()) {
    blocking("requestedPostTime", "Tell us what time you'd like this posted.");
  }
  const postText = form.postText ?? "";
  if (postText.trim().length < 10) {
    blocking("postText", "Write out what you'd like the post to say (at least a sentence).");
  } else if (isAllCaps(postText)) {
    blocking("postText", "Please don't submit your request in all caps.");
  }
  if (form.includesMedia === "Yes" && ctx.assetCount === 0 && !ctx.hasGeneratedGraphic) {
    blocking("assets", "Add the photo or video you want included.");
  }
  if (form.includesMedia === "No" && !ctx.hasGeneratedGraphic && ctx.assetCount === 0) {
    blocking("assets", "A post needs a graphic, photo, or video.");
  }
  if (form.includesMedia !== "Yes" && form.includesMedia !== "No") {
    blocking("includesMedia", "Tell us whether you're uploading a photo or video.");
  }
  if (form.acknowledged !== true) {
    blocking("acknowledged", "Please read and acknowledge the posting guidelines.");
  }
  // The three release questions must be answered, not merely not-"No".
  if (form.photoRelease !== "Yes" && form.photoRelease !== "No") {
    blocking("photoRelease", "Answer the photo release question.");
  }
  if (!form.minorRelease) blocking("minorRelease", "Answer the minor release question.");
  if (!form.offCampusRelease) {
    blocking("offCampusRelease", "Answer the off-campus release question.");
  }
  if (form.vpApproved !== "Yes" && form.vpApproved !== "No") {
    blocking("vpApproved", "Answer the VP of Operations approval question.");
  }
  return issues;
}

export const isBlocked = (issues: ReleaseFormIssue[]): boolean =>
  issues.some((i) => i.severity === "blocking");

export const flagsOf = (issues: ReleaseFormIssue[]): ReleaseFormIssue[] =>
  issues.filter((i) => i.severity === "flag");

// ── Shared file constants ─────────────────────────────────────────────────
// MUST exactly match the bucket's allowed_mime_types in migration 0028 and
// the map inside supabase/functions/public-upload.

export const MAX_UPLOAD_FILES = 10;
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB

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
    return `"${file.name}" is over 200 MB. Compress it or trim the video and try again.`;
  }
  return null;
}
