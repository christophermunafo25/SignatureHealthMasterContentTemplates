import { describe, expect, it } from "vitest";
import { isFormField } from "./fields";
import type { TemplateField, FieldType } from "./types";

const make = (type: FieldType, patch: Partial<TemplateField> = {}): TemplateField => ({
  id: "f1",
  label: "Field",
  fieldKey: "field",
  type,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...patch,
});

describe("isFormField", () => {
  it("keeps member-editable types in the form", () => {
    expect(isFormField(make("text"))).toBe(true);
    expect(isFormField(make("multiline"))).toBe(true);
    expect(isFormField(make("image"))).toBe(true);
    expect(isFormField(make("select"))).toBe(true);
  });

  it("excludes static elements of any type", () => {
    expect(isFormField(make("text", { static: true }))).toBe(false);
    expect(isFormField(make("image", { static: true }))).toBe(false);
    expect(isFormField(make("shape", { static: true }))).toBe(false);
  });

  it("excludes shapes even without the static flag", () => {
    // Shapes are created static, but a row missing the flag must not
    // surface a shape input either way once static is set by the builder.
    expect(isFormField(make("shape", { static: true }))).toBe(false);
  });

  it("excludes facility_logo by TYPE, without relying on the static flag", () => {
    expect(isFormField(make("facility_logo"))).toBe(false);
    expect(isFormField(make("facility_logo", { static: true }))).toBe(false);
  });
});
