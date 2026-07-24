-- Decorative shapes: a new field type plus the shape kind. Fill reuses the
-- existing color_hex / color_key / text_gradient columns; rects honor
-- corner_radius. Shapes are always static (is_static = true).
alter type field_type add value if not exists 'shape';

alter table template_fields
  add column if not exists shape text
    check (shape in ('rect', 'ellipse', 'triangle', 'star'));
