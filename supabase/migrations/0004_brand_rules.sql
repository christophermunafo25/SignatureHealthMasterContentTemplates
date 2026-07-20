-- Round 2: brand rules engine + design-system import.
--
-- brand_kits.type_styles — unlimited named type styles ("roles") with locked
-- styling + guardrails. Template fields bind via template_fields.type_style_key;
-- bound properties are enforced at render time, so marketing's rules
-- ("Heading is always uppercase", "Body never exceeds 120 characters")
-- propagate to every template and end users cannot break them.
--
-- brand_kits.guidelines — free-text brand rules imported/accepted from a
-- guidelines.md (do/don't, voice, layout). Displayed in Brand Studio;
-- not machine-enforced unless mapped onto a type style.

alter table brand_kits
  add column if not exists type_styles jsonb not null default '[]',
  add column if not exists guidelines  jsonb not null default '[]';

alter table template_fields
  add column if not exists type_style_key text;
