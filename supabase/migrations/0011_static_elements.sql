-- Static elements: placed on the graphic by the admin but not member-editable.
-- No form entry, no caption tag; content is fixed in static_value (text, or
-- an image URL for image elements).
alter table template_fields
  add column if not exists is_static boolean,
  add column if not exists static_value text;
