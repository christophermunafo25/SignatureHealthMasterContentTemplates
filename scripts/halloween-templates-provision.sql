-- Halloween ready-to-post set (5 graphics): ONE-TIME PROVISIONING SCRIPT.
--
-- TENANT DATA - deliberately NOT in supabase/migrations/ (same rule as
-- national-observance-template-provision.sql). Run once against the
-- Signature project, in the SQL editor or via psql.
--
-- These are finished graphics with NO template_fields rows: facilities pick
-- one, review the caption, answer the release form, and submit. The portal
-- serves them because published means visible (no fillable filter).
--
-- BEFORE RUNNING: upload the five files to the template-backgrounds bucket
-- under the company's prefix, with exactly these object names:
--   {company_id}/halloween-ghost-pattern.webp
--   {company_id}/halloween-pumpkins-bats.webp
--   {company_id}/halloween-trick-or-treat.webp
--   {company_id}/halloween-witch-pumpkin.webp
--   {company_id}/halloween-haunted-houses.webp
-- (source files: scripts/assets/halloween/, 940x788 WebP - upload as-is,
-- never resized or re-encoded). The storage guard below refuses to insert
-- anything while any of the five is missing.
--
-- Re-running is safe: idempotent per template name - a template that
-- already exists for the company is skipped, never duplicated.
--
-- publish_now controls the initial status: true -> 'published' (live in the
-- facility portal immediately), false -> 'draft' (publish later with the
-- toggle in Admin -> Templates).

do $$
declare
  target_company uuid;
  publish_now boolean := true;
  tpl_status text;
  file_name text;
  missing text := '';
  tpl uuid;
  r record;
begin
  select id into target_company from companies where slug = 'signature-healthcare';
  if target_company is null then
    raise exception 'Company not found. Check the slug before running this.';
  end if;

  tpl_status := case when publish_now then 'published' else 'draft' end;

  -- Storage guard: all five objects must already be uploaded, or nothing
  -- gets inserted (a published template with a missing background would
  -- render facilities a blank canvas).
  foreach file_name in array array[
    'halloween-ghost-pattern.webp',
    'halloween-pumpkins-bats.webp',
    'halloween-trick-or-treat.webp',
    'halloween-witch-pumpkin.webp',
    'halloween-haunted-houses.webp'
  ] loop
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'template-backgrounds'
        and name = target_company::text || '/' || file_name
    ) then
      missing := missing || ' ' || file_name;
    end if;
  end loop;
  if missing <> '' then
    raise exception 'Missing from template-backgrounds:%. Upload the files, then re-run - nothing was inserted.', missing;
  end if;

  for r in
    select * from (values
      ( 'Halloween Ghost Pattern',
        'halloween-ghost-pattern.webp',
        'Purple ghost and pumpkin pattern behind a Happy Halloween card.',
        'Happy Halloween from all of us at Signature HealthCARE! We hope your day is full of good treats and friendly ghosts. #LiveWithPurpose' ),
      ( 'Halloween Pumpkins and Bats',
        'halloween-pumpkins-bats.webp',
        'Orange pumpkins and paper bats around hand-lettered Happy Halloween type.',
        'Happy Halloween! Wishing our residents and their families a safe and sweet holiday. #LiveWithPurpose' ),
      ( 'Halloween Trick or Treat',
        'halloween-trick-or-treat.webp',
        'Glowing jack-o''-lantern at night with Trick or Treat lettering.',
        'Trick or treat! Happy Halloween from our Signature HealthCARE family to yours. #LiveWithPurpose' ),
      ( 'Halloween Witch Pumpkin',
        'halloween-witch-pumpkin.webp',
        'Jack-o''-lantern in a witch hat under a full moon.',
        'Happy Halloween! Even our pumpkins dressed up for the occasion. #LiveWithPurpose' ),
      ( 'Halloween Haunted Houses',
        'halloween-haunted-houses.webp',
        'Purple dusk sky with haunted houses and Happy Halloween in gold.',
        'Wishing everyone a safe and happy Halloween night. #LiveWithPurpose' )
    ) as v(name, file, description, caption)
  loop
    if exists (
      select 1 from templates
      where company_id = target_company and name = r.name
    ) then
      raise notice '"%" already exists - skipped.', r.name;
      continue;
    end if;

    -- canvas_preset_id stays null: no 940x788 preset exists and the column
    -- is informational. No template_fields rows - the graphic is finished.
    insert into templates (
      company_id, name, description, category, tags, status,
      canvas_width, canvas_height, canvas_preset_id,
      background_storage_path, caption_template
    ) values (
      target_company, r.name, r.description, 'Holidays',
      array['halloween','holiday','seasonal'], tpl_status::template_status,
      940, 788, null,
      target_company::text || '/' || r.file, r.caption
    ) returning id into tpl;

    raise notice 'Provisioned "%" as % (status %).', r.name, tpl, tpl_status;
  end loop;
end $$;
