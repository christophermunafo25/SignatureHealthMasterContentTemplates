-- Fixed-width text: the box width is a hard constraint — single-line text
-- shrinks (canvas-measured) to fit it, multi-line text wraps at it.
alter table template_fields
  add column if not exists fixed_width boolean;
