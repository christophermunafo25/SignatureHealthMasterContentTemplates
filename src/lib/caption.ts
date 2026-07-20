import type { FieldValues, TemplateField, TemplateSchema } from "./types";

/**
 * Fill a caption template's {field_key} placeholders from entered values.
 * Location fields resolve through locationNames (id → display name).
 * Unfilled placeholders render as a readable blank ("____") rather than
 * leaking the raw tag.
 */
export function mergeCaption(
  template: TemplateSchema,
  values: FieldValues,
  locationNames: Record<string, string> = {},
): string {
  return template.captionTemplate.replace(/\{([a-zA-Z0-9_]+)\}/g, (raw, key: string) => {
    const field = template.fields.find((f) => f.fieldKey === key);
    const value = values[key];
    if (!value) return "____";
    if (field?.type === "location") return locationNames[value] ?? "____";
    if (field?.type === "image") return raw; // images have no caption text
    return value;
  });
}

/** Suggest a unique snake_case field key from a label ("Team Name" → team_name). */
export function suggestFieldKey(label: string, taken: TemplateField[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field";
  let key = base;
  let n = 2;
  while (taken.some((f) => f.fieldKey === key)) key = `${base}_${n++}`;
  return key;
}
