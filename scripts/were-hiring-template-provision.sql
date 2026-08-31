-- "We're Hiring!" recruiting template: ONE-TIME PROVISIONING SCRIPT.
--
-- This is TENANT DATA, so it deliberately does NOT live in supabase/migrations/
-- (same rule as signature-facilities-provision.sql). Run once against the
-- Signature project, in the SQL editor or via psql.
--
-- Source design: Figma file lnTQCEbOVYdhljSCszlAaA, frame 1-5 (1080x1080).
-- Layering (bottom -> top):
--   backgroundUrl  = full-frame render (the complete design, default state)
--   z1 background_photo   editable image over the left photo area (725x1080)
--   z2 photo_shade        static transparent-to-black fade re-painted over
--                         member-uploaded photos (matches the baked fade)
--   z3 live_with_purpose  static "Live with purpose." mark over the photo
--   z4 role_pill          static orange pill covering the baked
--                         "INSERT ROLE HERE" text
--   z5 role               editable text on the pill (Montserrat, #003061,
--                         centered, uppercase, measured shrink-to-fit)
--
-- Re-running is safe: the insert is skipped if the company already has a
-- template with this name.

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
    where company_id = target_company and name = 'We''re Hiring!'
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
    'We''re Hiring!',
    'Square recruiting post. Swap the background photo and enter the role you''re hiring for - everything else stays locked to brand.',
    'Recruiting',
    array['hiring','recruiting','careers'],
    'published',
    1080, 1080, preset_id,
    asset_dir || '1788203198000-were-hiring-background.png',
    'We''re hiring a {role}! Looking for your next opportunity? Join the Signature HealthCARE team - apply today at signaturehealthcarejobs.com/jobs. #LiveWithPurpose #Hiring'
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
    0, 0, 725, 1080, 1,
    null, null, null, null,
    null, null, null, null,
    null, null, null, null, null,
    null, null, null, 'cover', null, true ),
  ( tpl, 1, 'role', 'Role', 'text',
    499, 529, 329, 53, 5,
    null, null, null, null,
    'Montserrat', 400, 24, 12,
    '#003061', 'center', 'middle', true, -0.48,
    1.2, 60, true, null, 'Insert role here', true ),
  ( tpl, 2, 'photo_shade', 'Photo shade', 'image',
    0, 536, 725, 544, 2,
    true, asset_base || asset_dir || '1788203198000-were-hiring-photo-shade.png',
    null, null,
    null, null, null, null,
    null, null, null, null, null,
    null, null, null, 'cover', null, false ),
  ( tpl, 3, 'live_with_purpose', 'Live with purpose', 'image',
    107, 902, 256, 96, 3,
    true, asset_base || asset_dir || '1788203198000-were-hiring-live-with-purpose.png',
    null, null,
    null, null, null, null,
    null, null, null, null, null,
    null, null, null, 'contain', null, false ),
  ( tpl, 4, 'role_pill', 'Role pill', 'shape',
    499, 529, 329, 53, 4,
    true, null, 'rect', '{"tl":10,"tr":10,"br":10,"bl":10}'::jsonb,
    null, null, null, null,
    '#f9ac30', null, null, null, null,
    null, null, null, null, null, false );

  raise notice 'Provisioned "We''re Hiring!" template % for company %', tpl, target_company;
end $$;
