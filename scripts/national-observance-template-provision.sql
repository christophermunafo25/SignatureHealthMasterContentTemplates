-- "National Observance" template: ONE-TIME PROVISIONING SCRIPT.
--
-- TENANT DATA - deliberately NOT in supabase/migrations/ (same rule as
-- signature-facilities-provision.sql). Run once against the Signature
-- project, in the SQL editor or via psql.
--
-- Source design: Figma file lnTQCEbOVYdhljSCszlAaA, frame 51-143
-- "08 National Observance" (1080x1080).
--
-- The editable photo is FULL-BLEED, so an uploaded photo hides the entire
-- baked sample; every other layer is re-painted above it as a field:
--   backgroundUrl = full-frame render (complete design, default state)
--   z1  background_photo   editable full-canvas image
--   z2  shade_black        static black fade (bottom 720px)
--   z3  shade_navy         static navy fade (bottom 720px)
--   z4  date_pill          static orange pill (rounded 28)
--   z5  observance_dates   editable text on the pill (Montserrat Medium 22)
--   z6  headline_line1     editable text ("Happy" / "Celebrating" ...)
--   z7  observance_name    editable text (Montserrat SemiBold 96, shrink-to-fit)
--   z8  divider            static orange rule
--   z9  message            editable multiline (Montserrat 26/1.4)
--   z10 live_with_purpose  static mark
--
-- Re-running is safe: skipped if the company already has a template with
-- this name.

do $$
declare
  target_company uuid;
  preset_id text;
  tpl uuid;
  asset_base text := 'https://ypbaqgcgbknbwvomtfrz.supabase.co/storage/v1/object/public/template-backgrounds/';
  asset_dir text;
begin
  select id into target_company from companies where slug = 'signature-healthcare';
  if target_company is null then
    raise exception 'Company not found. Check the slug before running this.';
  end if;
  asset_dir := target_company::text || '/';

  if exists (
    select 1 from templates
    where company_id = target_company and name = 'National Observance'
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
    'National Observance',
    'Square observance post with a full-bleed photo. Set the dates, the observance name, and a short message from your team.',
    'Observances',
    array['observance','awareness','celebration'],
    'published',
    1080, 1080, preset_id,
    asset_dir || '1788211055000-national-observance-full.png',
    '{headline_line1} {observance_name}! {message} #LiveWithPurpose'
  ) returning id into tpl;

  insert into template_fields (
    template_id, sort_order, field_key, label, type,
    x, y, width, height, z_index,
    is_static, static_value, shape, corner_radius,
    font_family, font_weight, font_size_px, min_font_size_px,
    color_hex, align, vertical_align, uppercase, letter_spacing_px,
    line_height, max_length, fixed_width, object_fit, placeholder, required
  ) values
  ( tpl, 0, 'background_photo', 'Background Photo', 'image',
    0, 0, 1080, 1080, 1,
    null, null, null, null,
    null, null, null, null,
    null, null, null, null, null,
    null, null, null, 'cover', null, true ),
  ( tpl, 1, 'observance_dates', 'Observance Dates', 'text',
    80, 496, 240, 56, 5,
    null, null, null, null,
    'Montserrat', 500, 22, 12,
    '#003061', 'center', 'middle', true, 0.44,
    1, 20, true, null, 'May 6 - 12', true ),
  ( tpl, 2, 'headline_line1', 'Headline First Line', 'text',
    76, 576, 620, 56, 6,
    null, null, null, null,
    'Montserrat', 400, 56, 28,
    '#ffffff', 'left', 'middle', null, -1.68,
    1, 24, true, null, 'Happy', true ),
  ( tpl, 3, 'observance_name', 'Observance Name', 'text',
    76, 642, 928, 96, 7,
    null, null, null, null,
    'Montserrat', 600, 96, 44,
    '#ffffff', 'left', 'middle', null, -4.608,
    1, 32, true, null, 'Nurses Week', true ),
  ( tpl, 4, 'message', 'Message', 'multiline',
    80, 806, 620, 124, 9,
    null, null, null, null,
    'Montserrat', 400, 26, null,
    '#ffffff', 'left', 'top', null, -0.26,
    1.4, 130, null, null, 'To every nurse on our team: thank you for the skill and the heart you bring to this work.', true ),
  ( tpl, 5, 'shade_black', 'Photo shade (black)', 'image',
    0, 360, 1080, 720, 2,
    true, asset_base || asset_dir || '1788211055000-national-observance-shade-black.png',
    null, null,
    null, null, null, null,
    null, null, null, null, null,
    null, null, null, 'cover', null, false ),
  ( tpl, 6, 'shade_navy', 'Photo shade (navy)', 'image',
    0, 360, 1080, 720, 3,
    true, asset_base || asset_dir || '1788211055000-national-observance-shade-navy.png',
    null, null,
    null, null, null, null,
    null, null, null, null, null,
    null, null, null, 'cover', null, false ),
  ( tpl, 7, 'date_pill', 'Date pill', 'shape',
    80, 496, 240, 56, 4,
    true, null, 'rect', '{"tl":28,"tr":28,"br":28,"bl":28}'::jsonb,
    null, null, null, null,
    '#f9ac30', null, null, null, null,
    null, null, null, null, null, false ),
  ( tpl, 8, 'divider', 'Divider', 'shape',
    80, 770, 100, 6, 8,
    true, null, 'rect', null,
    null, null, null, null,
    '#f9ac30', null, null, null, null,
    null, null, null, null, null, false ),
  ( tpl, 9, 'live_with_purpose', 'Live with purpose', 'image',
    813, 944, 180, 67.5, 10,
    true, asset_base || asset_dir || '1788211055000-national-observance-lwp.png',
    null, null,
    null, null, null, null,
    null, null, null, null, null,
    null, null, null, 'contain', null, false );

  raise notice 'Provisioned "National Observance" template % for company %', tpl, target_company;
end $$;
