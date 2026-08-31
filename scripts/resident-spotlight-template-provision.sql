-- "Resident Spotlight" template: ONE-TIME PROVISIONING SCRIPT.
--
-- TENANT DATA - deliberately NOT in supabase/migrations/ (same rule as
-- signature-facilities-provision.sql). Run once against the Signature
-- project, in the SQL editor or via psql.
--
-- Source design: Figma file lnTQCEbOVYdhljSCszlAaA, frame 51-103
-- "06 Resident Spotlight" (1080x1080).
--
-- Layering (bottom -> top):
--   backgroundUrl = full-frame render (complete design with sample content)
--   z1 resident_photo  editable image over the rounded photo card (80,186 470x600, r24)
--   z2/z4/z6           static #f7f7f7 rects covering the baked sample name,
--                      bio, and fun-fact so member text replaces them cleanly
--   z3 resident_name   editable text (Montserrat SemiBold 88, #003061,
--                      measured shrink-to-fit)
--   z5 resident_bio    editable multiline (Montserrat 26/1.4)
--   z7 resident_fact   editable multiline (Montserrat SemiBold 24/1.4)
-- Locked: eyebrow, "Meet", divider, navy footer, Live with purpose mark.
--
-- Re-running is safe: skipped if the company already has a template with
-- this name.

do $$
declare
  target_company uuid;
  preset_id text;
  tpl uuid;
begin
  select id into target_company from companies where slug = 'signature-healthcare';
  if target_company is null then
    raise exception 'Company not found. Check the slug before running this.';
  end if;

  if exists (
    select 1 from templates
    where company_id = target_company and name = 'Resident Spotlight'
  ) then
    raise notice 'Template already provisioned - nothing to do.';
    return;
  end if;

  select id into preset_id from canvas_presets
  where width = 1080 and height = 1080 and enabled
  order by recommended desc, sort_order limit 1;

  insert into templates (
    company_id, name, description, category, tags, status,
    canvas_width, canvas_height, canvas_preset_id,
    background_storage_path, caption_template
  ) values (
    target_company,
    'Resident Spotlight',
    'Square spotlight post. Add the resident''s photo and first name, a short story about them, and a fun fact or conversation prompt.',
    'Spotlight',
    array['resident','spotlight','community'],
    'published',
    1080, 1080, preset_id,
    target_company::text || '/1788209816000-resident-spotlight-background.png',
    'Resident Spotlight: Meet {resident_name}! {resident_bio} {resident_fact} #LiveWithPurpose #ResidentSpotlight'
  ) returning id into tpl;

  insert into template_fields (
    template_id, sort_order, field_key, label, type,
    x, y, width, height, z_index,
    is_static, static_value, shape, corner_radius,
    font_family, font_weight, font_size_px, min_font_size_px,
    color_hex, align, vertical_align, uppercase, letter_spacing_px,
    line_height, max_length, fixed_width, object_fit, placeholder, required
  ) values
  ( tpl, 0, 'resident_photo', 'Resident Photo', 'image',
    80, 186, 470, 600, 1,
    null, null, null, '{"tl":24,"tr":24,"br":24,"bl":24}'::jsonb,
    null, null, null, null,
    null, null, null, null, null,
    null, null, null, 'cover', null, true ),
  ( tpl, 1, 'resident_name', 'Resident First Name', 'text',
    622, 312, 418, 88, 3,
    null, null, null, null,
    'Montserrat', 600, 88, 40,
    '#003061', 'left', 'middle', null, -4.224,
    1, 20, true, null, 'Eleanor', true ),
  ( tpl, 2, 'resident_bio', 'About the Resident', 'multiline',
    626, 482, 374, 192, 5,
    null, null, null, null,
    'Montserrat', 400, 26, null,
    '#003061', 'left', 'top', null, -0.26,
    1.4, 140, null, null, 'She taught third grade for 32 years and still keeps a photo of every class on her wall.', true ),
  ( tpl, 3, 'resident_fact', 'Fun Fact or Prompt', 'multiline',
    626, 686, 374, 148, 7,
    null, null, null, null,
    'Montserrat', 600, 24, null,
    '#003061', 'left', 'top', null, -0.24,
    1.4, 100, null, null, 'Ask her about the 1987 spelling bee.', true ),
  ( tpl, 4, 'name_cover', 'Name cover', 'shape',
    622, 304, 440, 114, 2,
    true, null, 'rect', null,
    null, null, null, null,
    '#f7f7f7', null, null, null, null,
    null, null, null, null, null, false ),
  ( tpl, 5, 'bio_cover', 'Bio cover', 'shape',
    618, 476, 392, 204, 4,
    true, null, 'rect', null,
    null, null, null, null,
    '#f7f7f7', null, null, null, null,
    null, null, null, null, null, false ),
  ( tpl, 6, 'fact_cover', 'Fact cover', 'shape',
    618, 680, 392, 160, 6,
    true, null, 'rect', null,
    null, null, null, null,
    '#f7f7f7', null, null, null, null,
    null, null, null, null, null, false );

  raise notice 'Provisioned "Resident Spotlight" template % for company %', tpl, target_company;
end $$;
