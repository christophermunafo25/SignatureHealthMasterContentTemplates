-- Blank-built templates get a canvas base fill (color or linear gradient;
-- a background image still wins), and elements get opacity (0-100).
alter table templates
  add column if not exists background_color text,
  add column if not exists background_gradient jsonb; -- { angle, stops: [{position, color}] }
alter table template_fields
  add column if not exists opacity numeric;
