import type { TemplateField } from "./types";

/** True when the member form should render an input for this element.
 *
 * Static elements are baked into the graphic. facility_logo elements resolve
 * automatically from the facility in context — they are excluded by TYPE
 * rather than marked static, so the inspector's "Fixed element" checkbox
 * keeps meaning exactly one thing. */
export function isFormField(field: TemplateField): boolean {
  return !field.static && field.type !== "facility_logo";
}
