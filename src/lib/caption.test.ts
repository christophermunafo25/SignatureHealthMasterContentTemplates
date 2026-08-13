import { describe, expect, it } from "vitest";
import { mergeCaption } from "./caption";
import type { TemplateField, TemplateSchema } from "./types";

const field = (patch: Partial<TemplateField> & Pick<TemplateField, "fieldKey" | "type">): TemplateField => ({
  id: patch.fieldKey,
  label: patch.fieldKey,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...patch,
});

const template = (fields: TemplateField[], captionTemplate: string): TemplateSchema => ({
  id: "t1",
  companyId: "c1",
  name: "Test",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1440,
  canvasHeight: 1440,
  backgroundUrl: "",
  fields,
  captionTemplate,
  createdAt: "",
  updatedAt: "",
});

const FACILITY = { name: "Signature HealthCARE of Memphis", shortName: "Memphis", logoUrl: null };

describe("mergeCaption with a facility_logo tag", () => {
  const tpl = template(
    [field({ fieldKey: "name", type: "text" }), field({ fieldKey: "facility", type: "facility_logo" })],
    "{name} is celebrating at {facility}!",
  );

  it("resolves the tag to the facility short name when a facility is in context", () => {
    expect(mergeCaption(tpl, { name: "Pat" }, FACILITY)).toBe("Pat is celebrating at Memphis!");
  });

  it("renders a readable blank when no facility is in context", () => {
    expect(mergeCaption(tpl, { name: "Pat" })).toBe("Pat is celebrating at ____!");
    expect(mergeCaption(tpl, { name: "Pat" }, null)).toBe("Pat is celebrating at ____!");
  });

  it("never reads a member value for the facility tag", () => {
    // A stray value under the same key must not leak into the caption.
    expect(mergeCaption(tpl, { name: "Pat", facility: "hacked" }, FACILITY)).toBe(
      "Pat is celebrating at Memphis!",
    );
  });
});

describe("mergeCaption existing behavior (unchanged)", () => {
  it("merges member values and blanks empty ones", () => {
    const tpl = template([field({ fieldKey: "name", type: "text" })], "Hello {name} and {name}");
    expect(mergeCaption(tpl, { name: "Sam" })).toBe("Hello Sam and Sam");
    expect(mergeCaption(tpl, {})).toBe("Hello ____ and ____");
  });

  it("keeps image tags raw and static text fixed", () => {
    const tpl = template(
      [
        field({ fieldKey: "photo", type: "image" }),
        field({ fieldKey: "sig", type: "text", static: true, staticValue: "Signature" }),
      ],
      "{photo} by {sig}",
    );
    expect(mergeCaption(tpl, { photo: "data:image/png;base64,x" })).toBe("{photo} by Signature");
  });
});
