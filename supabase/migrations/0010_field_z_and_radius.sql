-- Round 4: canvas layer order decoupled from form order, and image corner
-- radius. sort_order stays the member FORM order; z_index is paint order.
alter table template_fields
  add column if not exists z_index int,
  add column if not exists corner_radius jsonb; -- { tl, tr, br, bl } px
