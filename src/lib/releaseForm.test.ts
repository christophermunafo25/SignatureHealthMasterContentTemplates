import { describe, expect, it } from "vitest";
import {
  isBlocked,
  validateReleaseForm,
  RELEASE_FORM_VERSION,
  type ReleaseForm,
  type ReleaseFormContext,
} from "./releaseForm";

/** Tomorrow, so the "today or later" rule never fails for clock reasons. */
function futureDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** A form that passes validation: no event, no minors, nothing gated open. */
const valid = (over: Partial<ReleaseForm> = {}): Partial<ReleaseForm> => ({
  version: RELEASE_FORM_VERSION,
  platforms: ["Facebook"],
  isEvent: "No",
  photoRelease: "Yes",
  hasMinors: "No",
  offCampusRelease: "Yes",
  requestedPostDate: futureDate(),
  requestedPostTime: "2:30 PM CST",
  postText: "Our team celebrated a milestone this week and we are proud of them.",
  includesMedia: "Yes",
  acknowledged: true,
  submittedAt: new Date().toISOString(),
  ...over,
});

const UPLOAD: ReleaseFormContext = { hasGeneratedGraphic: false, assetCount: 1 };
const TEMPLATE: ReleaseFormContext = { hasGeneratedGraphic: true, assetCount: 0 };

const fieldsBlocking = (form: Partial<ReleaseForm>, ctx = UPLOAD) =>
  validateReleaseForm(form, ctx)
    .filter((i) => i.severity === "blocking")
    .map((i) => i.field);

describe("baseline", () => {
  it("accepts a complete non-event, no-minors form", () => {
    expect(fieldsBlocking(valid())).toEqual([]);
  });
});

describe("Q3a/Q3b — event gate", () => {
  it("requires the gate to be answered", () => {
    expect(fieldsBlocking(valid({ isEvent: undefined }))).toContain("isEvent");
  });

  it("requires the VP answer once it IS an event", () => {
    expect(fieldsBlocking(valid({ isEvent: "Yes" }))).toContain("vpApproved");
  });

  it("accepts an event with VP approval", () => {
    expect(fieldsBlocking(valid({ isEvent: "Yes", vpApproved: "Yes" }))).toEqual([]);
  });

  it("flags — but does not block — an event without VP approval", () => {
    const issues = validateReleaseForm(valid({ isEvent: "Yes", vpApproved: "No" }), UPLOAD);
    expect(isBlocked(issues)).toBe(false);
    expect(issues.filter((i) => i.severity === "flag").map((i) => i.field)).toEqual([
      "vpApproved",
    ]);
  });

  it("does not require or flag the VP answer when it is not an event", () => {
    const issues = validateReleaseForm(valid({ isEvent: "No" }), UPLOAD);
    expect(isBlocked(issues)).toBe(false);
    expect(issues).toEqual([]);
  });

  it("refuses a stale VP answer left behind by a gate flipped to No", () => {
    // The form clears this on change; validation is the backstop, so a
    // non-event can never carry a VP answer into the record.
    expect(fieldsBlocking(valid({ isEvent: "No", vpApproved: "No" }))).toContain("vpApproved");
  });
});

describe("Q5a/Q5b — minors gate", () => {
  it("requires the gate to be answered", () => {
    expect(fieldsBlocking(valid({ hasMinors: undefined }))).toContain("hasMinors");
  });

  it("requires the release answer once minors are present", () => {
    expect(fieldsBlocking(valid({ hasMinors: "Yes" }))).toContain("minorRelease");
  });

  it("accepts minors WITH releases on file", () => {
    expect(fieldsBlocking(valid({ hasMinors: "Yes", minorRelease: "Yes" }))).toEqual([]);
  });

  it("BLOCKS minors without releases on file", () => {
    // The safeguarding rule: gating Q5 must not create a path around it.
    const issues = validateReleaseForm(valid({ hasMinors: "Yes", minorRelease: "No" }), UPLOAD);
    expect(isBlocked(issues)).toBe(true);
    expect(issues.some((i) => i.field === "minorRelease" && i.severity === "blocking")).toBe(true);
  });

  it("does not require the release answer when there are no minors", () => {
    expect(validateReleaseForm(valid({ hasMinors: "No" }), UPLOAD)).toEqual([]);
  });

  it("refuses a stale release answer left behind by a gate flipped to No", () => {
    expect(fieldsBlocking(valid({ hasMinors: "No", minorRelease: "No" }))).toContain(
      "minorRelease",
    );
  });
});

describe("Q10 — includesMedia", () => {
  it("is required on the upload path", () => {
    expect(fieldsBlocking(valid({ includesMedia: undefined }))).toContain("includesMedia");
  });

  it("is NOT required on the template path, where the graphic is the media", () => {
    // Q10 is auto-answered and hidden there, so blocking on it would strand
    // the user on a question they cannot see.
    expect(fieldsBlocking(valid({ includesMedia: undefined }), TEMPLATE)).not.toContain(
      "includesMedia",
    );
  });

  it("still blocks an upload-path submission with no media at all", () => {
    expect(
      fieldsBlocking(valid({ includesMedia: "Yes" }), { hasGeneratedGraphic: false, assetCount: 0 }),
    ).toContain("assets");
  });
});

describe("ungated rules still apply", () => {
  it("blocks a missing photo release regardless of the gates", () => {
    expect(fieldsBlocking(valid({ photoRelease: "No" }))).toContain("photoRelease");
  });

  it("blocks an unacknowledged form", () => {
    expect(fieldsBlocking(valid({ acknowledged: false }))).toContain("acknowledged");
  });
});
