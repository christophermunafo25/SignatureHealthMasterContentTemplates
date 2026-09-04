import { describe, expect, it } from "vitest";
import {
  CAPTION_STARTERS,
  RELEASE_FORM_VERSION,
  isBlocked,
  platformsForChoice,
  questionNumberForField,
  validateReleaseForm,
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

/** A v3 form that passes: standard scheduling, one uploaded file. */
const valid = (over: Partial<ReleaseForm> = {}): Partial<ReleaseForm> => ({
  version: RELEASE_FORM_VERSION,
  platformChoice: "Facebook",
  platforms: ["Facebook"],
  postText: "Our team celebrated a milestone this week and we are proud of them.",
  needsSpecificSchedule: "No",
  acknowledged: true,
  submittedAt: new Date().toISOString(),
  ...over,
});

const UPLOAD: ReleaseFormContext = { hasGeneratedGraphic: false, assetCount: 1 };
const TEMPLATE: ReleaseFormContext = { hasGeneratedGraphic: true, assetCount: 0 };
const NO_MEDIA: ReleaseFormContext = { hasGeneratedGraphic: false, assetCount: 0 };

const fieldsBlocking = (form: Partial<ReleaseForm>, ctx = UPLOAD) =>
  validateReleaseForm(form, ctx)
    .filter((i) => i.severity === "blocking")
    .map((i) => i.field);

describe("baseline", () => {
  it("accepts a complete standard-scheduling form", () => {
    expect(validateReleaseForm(valid(), UPLOAD)).toEqual([]);
  });

  it("raises no flag issues at all — v3 has no flag path", () => {
    // release_flagged loses its only source with the VP question gone. The
    // severity stays in the type for legacy rows; nothing produces it now.
    const everyWrongAnswer = validateReleaseForm({ version: 3 }, NO_MEDIA);
    expect(everyWrongAnswer.filter((i) => i.severity === "flag")).toEqual([]);
  });
});

describe("Q2 — platforms", () => {
  it("requires at least one platform", () => {
    expect(fieldsBlocking(valid({ platforms: [] }))).toContain("platforms");
  });

  it("expands Both into the two-element storage array", () => {
    // The storage shape stays text[] so submissions.platforms, its index,
    // and the board's platform filter are untouched by the new affordance.
    expect(platformsForChoice("Both")).toEqual(["Facebook", "Instagram"]);
    expect(platformsForChoice("Facebook")).toEqual(["Facebook"]);
    expect(platformsForChoice("Instagram")).toEqual(["Instagram"]);
  });

  it("accepts a Both submission", () => {
    const form = valid({ platformChoice: "Both", platforms: platformsForChoice("Both") });
    expect(validateReleaseForm(form, UPLOAD)).toEqual([]);
  });
});

describe("Q3 — postText", () => {
  it("requires at least a sentence", () => {
    expect(fieldsBlocking(valid({ postText: "Nice" }))).toContain("postText");
  });

  it("blocks all caps", () => {
    expect(
      fieldsBlocking(valid({ postText: "OUR TEAM CELEBRATED A BIG MILESTONE THIS WEEK" })),
    ).toContain("postText");
  });

  it("does not mistake a short acronym-heavy sentence for shouting", () => {
    expect(fieldsBlocking(valid({ postText: "Our CEO and CNO visited the SNF today." }))).toEqual(
      [],
    );
  });

  it("accepts every caption starter as-is", () => {
    // The form suggests these itself, so a starter that trips the length or
    // all-caps rule would have the form rejecting its own suggestion.
    expect(CAPTION_STARTERS.length).toBeGreaterThan(0);
    for (const starter of CAPTION_STARTERS) {
      expect(fieldsBlocking(valid({ postText: starter.text })), starter.label).not.toContain(
        "postText",
      );
    }
  });
});

describe("Q4 — upload", () => {
  it("is required on the direct path", () => {
    expect(fieldsBlocking(valid(), NO_MEDIA)).toContain("assets");
  });

  it("is NOT required on the template path, where the graphic is the media", () => {
    expect(fieldsBlocking(valid(), TEMPLATE)).not.toContain("assets");
  });

  it("accepts the template path with no extra upload at all", () => {
    expect(validateReleaseForm(valid(), TEMPLATE)).toEqual([]);
  });
});

describe("Q5/Q5a/Q5b — the scheduling gate", () => {
  it("requires the gate to be answered", () => {
    expect(fieldsBlocking(valid({ needsSpecificSchedule: undefined }))).toContain(
      "needsSpecificSchedule",
    );
  });

  it("requires a date once a specific slot IS requested", () => {
    expect(fieldsBlocking(valid({ needsSpecificSchedule: "Yes" }))).toContain("requestedPostDate");
  });

  it("refuses a date in the past", () => {
    expect(
      fieldsBlocking(valid({ needsSpecificSchedule: "Yes", requestedPostDate: "2020-01-01" })),
    ).toContain("requestedPostDate");
  });

  it("accepts a requested date with NO time — Q5b is optional", () => {
    const form = valid({ needsSpecificSchedule: "Yes", requestedPostDate: futureDate() });
    expect(validateReleaseForm(form, UPLOAD)).toEqual([]);
  });

  it("accepts a requested date with a time", () => {
    const form = valid({
      needsSpecificSchedule: "Yes",
      requestedPostDate: futureDate(),
      requestedPostTime: "2:00 PM",
    });
    expect(validateReleaseForm(form, UPLOAD)).toEqual([]);
  });

  it("does not require a date under standard scheduling", () => {
    expect(validateReleaseForm(valid({ needsSpecificSchedule: "No" }), UPLOAD)).toEqual([]);
  });

  it("refuses a stale date left behind by a gate flipped back to No", () => {
    // The form clears both on change; validation is the backstop, so a
    // standard-scheduling record can never carry a requested slot.
    expect(
      fieldsBlocking(valid({ needsSpecificSchedule: "No", requestedPostDate: futureDate() })),
    ).toContain("requestedPostDate");
  });

  it("refuses a stale time left behind by a gate flipped back to No", () => {
    expect(
      fieldsBlocking(valid({ needsSpecificSchedule: "No", requestedPostTime: "2:00 PM" })),
    ).toContain("requestedPostTime");
  });
});

describe("Q6 — the submission agreement", () => {
  it("blocks an unconfirmed agreement", () => {
    const issues = validateReleaseForm(valid({ acknowledged: false }), UPLOAD);
    expect(isBlocked(issues)).toBe(true);
    expect(issues.map((i) => i.field)).toContain("acknowledged");
  });
});

describe("questionNumberForField", () => {
  it("matches the numbering the form renders", () => {
    // The modal's "Still needed" line reads from this, so a drift here is a
    // user-visible lie about which question is unanswered.
    expect(questionNumberForField("platforms")).toBe("2");
    expect(questionNumberForField("postText")).toBe("3");
    expect(questionNumberForField("assets")).toBe("4");
    expect(questionNumberForField("needsSpecificSchedule")).toBe("5");
    expect(questionNumberForField("requestedPostDate")).toBe("5a");
    expect(questionNumberForField("requestedPostTime")).toBe("5b");
    expect(questionNumberForField("acknowledged")).toBe("6");
  });

  it("returns null for a field with no numbered question", () => {
    expect(questionNumberForField("submittedAt")).toBeNull();
    expect(questionNumberForField("vpApproved")).toBeNull();
  });
});

describe("legacy documents", () => {
  /** A real v2 record, exactly as it sits in submissions.release_form. It
   * must keep type-checking and reading through the superset interface —
   * every admin surface renders these unchanged. */
  const legacy: ReleaseForm = {
    version: 2,
    platforms: ["Facebook", "Instagram"],
    isEvent: "Yes",
    vpApproved: "No",
    photoRelease: "Yes",
    hasMinors: "Yes",
    minorRelease: "Yes",
    offCampusRelease: "N/A",
    requestedPostDate: "2025-06-02",
    requestedPostTime: "2:30 PM CST",
    postText: "The team celebrated a resident's hundredth birthday.",
    includesMedia: "Yes",
    acknowledged: true,
    submittedAt: "2025-06-01T14:02:00.000Z",
  };

  it("reads every v2 answer back off the superset type", () => {
    expect(legacy.version).toBe(2);
    expect(legacy.vpApproved).toBe("No");
    expect(legacy.minorRelease).toBe("Yes");
    expect(legacy.offCampusRelease).toBe("N/A");
    expect(legacy.includesMedia).toBe("Yes");
    expect(legacy.platforms).toEqual(["Facebook", "Instagram"]);
  });

  it("is distinguishable from v3 by version alone", () => {
    // Every read surface branches on this, so it has to be the whole test.
    expect(legacy.version >= 3).toBe(false);
    expect((valid().version ?? 0) >= 3).toBe(true);
  });
});
