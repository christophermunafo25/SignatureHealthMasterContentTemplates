-- Vertical text alignment within the field box (default middle).
alter table template_fields
  add column if not exists vertical_align text
    check (vertical_align in ('top', 'middle', 'bottom'));
