-- Holidays ready-to-post set (26 graphics): ONE-TIME PROVISIONING SCRIPT.
--
-- TENANT DATA - deliberately NOT in supabase/migrations/ (same rule as
-- halloween-templates-provision.sql). Run once against the Signature
-- project, in the SQL editor or via psql.
--
-- These are finished graphics with NO template_fields rows: facilities pick
-- one, review the caption, answer the release form, and submit. The portal
-- serves them because published means visible (no fillable filter).
--
-- Source: "Holidays Social Media Graphics V1" from Signature (Sept 28),
-- 28 numbered 940x788 PNGs. Two are held back:
--   #9  "Happy New Year 2026" - the year is already past; wait for 2027.
--   #25 National Skilled Nursing Home Week 2026 - past, and it shows
--       identifiable residents, which every facility would see.
--
-- BEFORE RUNNING: upload the 26 files to the template-backgrounds bucket
-- under the company's prefix, with exactly the object names listed in the
-- storage guard below (source files: scripts/assets/holidays/, 940x788 PNG -
-- upload as-is, never resized or re-encoded). The guard refuses to insert
-- anything while any of the 26 is missing.
--
-- Re-running is safe: idempotent per template name - a template that
-- already exists for the company is skipped, never duplicated.
--
-- publish_now controls the initial status: true -> 'published' (live in the
-- facility portal immediately), false -> 'draft' (publish later with the
-- toggle in Admin -> Templates). The whole year goes live at once by
-- request; off-season ones can be toggled to draft individually.

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

  -- Storage guard: all 26 objects must already be uploaded, or nothing
  -- gets inserted (a published template with a missing background would
  -- render facilities a blank canvas).
  foreach file_name in array array[
    'holidays-thanksgiving-autumn-garland.png',
    'holidays-thanksgiving-peeking-turkey.png',
    'holidays-thanksgiving-pumpkin-corners.png',
    'holidays-thanksgiving-day-turkey.png',
    'holidays-thanksgiving-blessed.png',
    'holidays-christmas-gifts.png',
    'holidays-christmas-evergreen-lights.png',
    'holidays-christmas-gold-ornaments.png',
    'holidays-christmas-midnight-stars.png',
    'holidays-new-year-fireworks.png',
    'holidays-new-year-gold-ring.png',
    'holidays-kwanzaa-joyous.png',
    'holidays-hanukkah-menorah.png',
    'holidays-valentines-love-letters.png',
    'holidays-valentines-ribbon-heart.png',
    'holidays-valentines-two-hearts.png',
    'holidays-valentines-heart-confetti.png',
    'holidays-easter-egg-pattern.png',
    'holidays-easter-bright-lettering.png',
    'holidays-easter-hanging-eggs.png',
    'holidays-easter-botanical.png',
    'holidays-easter-he-is-risen.png',
    'holidays-mothers-day-bouquet.png',
    'holidays-july-4th-usa.png',
    'holidays-independence-day-flag.png',
    'holidays-presidents-day-flag.png'
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
      -- Thanksgiving
      ( 'Thanksgiving Autumn Garland',
        'holidays-thanksgiving-autumn-garland.png',
        'Navy card with a garland of pumpkins, leaves, and berries under We Wish You a Happy Thanksgiving.',
        'Happy Thanksgiving from all of us at Signature HealthCARE! We are grateful for our residents, their families, and our stakeholders. #LiveWithPurpose',
        array['thanksgiving','holiday','seasonal'] ),
      ( 'Thanksgiving Peeking Turkey',
        'holidays-thanksgiving-peeking-turkey.png',
        'Orange card with a cartoon turkey peeking in: Wishing you a Thanksgiving filled with love.',
        'May your heart be as full as your plate this holiday season. Happy Thanksgiving! #LiveWithPurpose',
        array['thanksgiving','holiday','seasonal'] ),
      ( 'Thanksgiving Pumpkin Corners',
        'holidays-thanksgiving-pumpkin-corners.png',
        'Cream card with pumpkins in each corner and bold Happy Thanksgiving type.',
        'Wishing you a harvest of blessings, good times, and happiness this Thanksgiving. #LiveWithPurpose',
        array['thanksgiving','holiday','seasonal'] ),
      ( 'Thanksgiving Day Turkey',
        'holidays-thanksgiving-day-turkey.png',
        'Cartoon turkey under Happy Thanksgiving Day lettering and autumn leaves.',
        'Happy Thanksgiving Day from your friends at Signature HealthCARE! #LiveWithPurpose',
        array['thanksgiving','holiday','seasonal'] ),
      ( 'Thanksgiving Blessed',
        'holidays-thanksgiving-blessed.png',
        'Navy card with a line-drawn pumpkin and leaves: Have a Blessed Thanksgiving.',
        'Have a blessed Thanksgiving! We are thankful for every resident, family member, and stakeholder in our community. #LiveWithPurpose',
        array['thanksgiving','holiday','seasonal'] ),

      -- Christmas (Gifts and Evergreen Lights also wish a Happy New Year)
      ( 'Christmas Gifts',
        'holidays-christmas-gifts.png',
        'Navy card framed in gold beside wrapped gifts: Merry Christmas and Happy New Year.',
        'Merry Christmas and Happy New Year from all of us at Signature HealthCARE! #LiveWithPurpose',
        array['christmas','new-year','holiday','seasonal'] ),
      ( 'Christmas Evergreen Lights',
        'holidays-christmas-evergreen-lights.png',
        'Evergreen branches and string lights over gold Merry Christmas and a Happy New Year type.',
        'We wish you and your family a Merry Christmas and a Happy New Year! #LiveWithPurpose',
        array['christmas','new-year','holiday','seasonal'] ),
      ( 'Christmas Gold Ornaments',
        'holidays-christmas-gold-ornaments.png',
        'Gold and glass ornaments hanging over a cream Merry Christmas card.',
        'Merry Christmas! Wishing our residents, families, and stakeholders a season full of joy. #LiveWithPurpose',
        array['christmas','holiday','seasonal'] ),
      ( 'Christmas Midnight Stars',
        'holidays-christmas-midnight-stars.png',
        'Dark navy card with gold stars, snowflakes, and a wrapped gift: Merry Christmas.',
        'Wishing you a joyful Christmas filled with love, laughter, warmth, and cherished memories. Happy holidays! #LiveWithPurpose',
        array['christmas','holiday','seasonal'] ),

      -- New Year
      ( 'New Year Fireworks',
        'holidays-new-year-fireworks.png',
        'Gold fireworks on a dark background around Happy New Year.',
        'Happy New Year from all of us at Signature HealthCARE! Here''s to a year of health, hope, and purpose. #LiveWithPurpose',
        array['new-year','holiday','seasonal'] ),
      ( 'New Year Gold Ring',
        'holidays-new-year-gold-ring.png',
        'Navy card with a gold ring of stars around Happy New Year.',
        'Cheers to a new year! Wishing our residents, families, and stakeholders a happy and healthy year ahead. #LiveWithPurpose',
        array['new-year','holiday','seasonal'] ),

      -- Kwanzaa and Hanukkah
      ( 'Kwanzaa Joyous',
        'holidays-kwanzaa-joyous.png',
        'Orange card with dancers, a kinara, and harvest gifts: Have a Joyous Kwanzaa.',
        'Have a joyous Kwanzaa! Wishing everyone celebrating a season of unity, family, and community. #LiveWithPurpose',
        array['kwanzaa','holiday','seasonal'] ),
      ( 'Hanukkah Menorah',
        'holidays-hanukkah-menorah.png',
        'Navy card with a menorah ringed by Happy Hanukkah lettering.',
        'Happy Hanukkah! Wishing everyone celebrating eight nights of light, peace, and joy. #LiveWithPurpose',
        array['hanukkah','holiday','seasonal'] ),

      -- Valentine's Day
      ( 'Valentine''s Love Letters',
        'holidays-valentines-love-letters.png',
        'Navy card with a pink mailbox Sending Love under Happy Valentine''s Day, February 14.',
        'Sending love to our residents, families, and stakeholders this Valentine''s Day! #LiveWithPurpose',
        array['valentines-day','holiday','seasonal'] ),
      ( 'Valentine''s Ribbon Heart',
        'holidays-valentines-ribbon-heart.png',
        'Red ribbon looped into a heart over Happy Valentine''s Day.',
        'Happy Valentine''s Day from all of us at Signature HealthCARE! #LiveWithPurpose',
        array['valentines-day','holiday','seasonal'] ),
      ( 'Valentine''s Two Hearts',
        'holidays-valentines-two-hearts.png',
        'Two red hearts on a white card: Happy Valentine''s Day.',
        'Happy Valentine''s Day! Today we celebrate the love and care that fill our community every day. #LiveWithPurpose',
        array['valentines-day','holiday','seasonal'] ),
      ( 'Valentine''s Heart Confetti',
        'holidays-valentines-heart-confetti.png',
        'Heart made of pink confetti hearts on navy with a Happy Valentine''s Day banner.',
        'Happy Valentine''s Day! Wishing you a day full of love and kindness. #LiveWithPurpose',
        array['valentines-day','holiday','seasonal'] ),

      -- Easter
      ( 'Easter Egg Pattern',
        'holidays-easter-egg-pattern.png',
        'White card over a hand-drawn egg pattern: Happy Easter.',
        'Happy Easter! Wishing you a season filled with renewal, hope, and new beginnings. #LiveWithPurpose',
        array['easter','holiday','seasonal'] ),
      ( 'Easter Bright Lettering',
        'holidays-easter-bright-lettering.png',
        'Mint card with colorful Happy Easter! script and painted eggs.',
        'Happy Easter from all of us at Signature HealthCARE! #LiveWithPurpose',
        array['easter','holiday','seasonal'] ),
      ( 'Easter Hanging Eggs',
        'holidays-easter-hanging-eggs.png',
        'Navy card with painted eggs hanging from a vine over orange Happy Easter script.',
        'Happy Easter! Wishing our residents and their families a bright and joyful spring. #LiveWithPurpose',
        array['easter','holiday','seasonal'] ),
      ( 'Easter Botanical',
        'holidays-easter-botanical.png',
        'Navy card with white line-drawn spring flowers around Happy Easter.',
        'Wishing everyone a happy and peaceful Easter. #LiveWithPurpose',
        array['easter','holiday','seasonal'] ),
      ( 'Easter He Is Risen',
        'holidays-easter-he-is-risen.png',
        'Floral cross over "He Is Risen," Matthew 28:6.',
        'He is risen! (Matthew 28:6) Happy Easter from all of us at Signature HealthCARE. #LiveWithPurpose',
        array['easter','holiday','seasonal'] ),

      -- Mother's Day
      ( 'Mother''s Day Bouquet',
        'holidays-mothers-day-bouquet.png',
        'Navy card with a flower bouquet: Happy Mother''s Day.',
        'Happy Mother''s Day to all the moms in our community, and to everyone who cares like one. #LiveWithPurpose',
        array['mothers-day','holiday','seasonal'] ),

      -- Independence Day
      ( '4th of July USA',
        'holidays-july-4th-usa.png',
        'Red, white, and blue ribbons around 4th of July, Independence Day, USA.',
        'Happy 4th of July! Wishing everyone a safe and happy Independence Day. #LiveWithPurpose',
        array['4th-of-july','independence-day','holiday','seasonal'] ),
      ( 'Independence Day Flag',
        'holidays-independence-day-flag.png',
        'American flag against red, white, and blue bokeh: Happy Independence Day.',
        'Happy Independence Day from all of us at Signature HealthCARE! #LiveWithPurpose',
        array['4th-of-july','independence-day','holiday','seasonal'] ),

      -- Presidents' Day
      ( 'Presidents'' Day Flag',
        'holidays-presidents-day-flag.png',
        'American flag at sunset over Happy President''s Day script.',
        'Happy Presidents'' Day from all of us at Signature HealthCARE! #LiveWithPurpose',
        array['presidents-day','holiday','seasonal'] )
    ) as v(name, file, description, caption, tags)
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
      r.tags, tpl_status::template_status,
      940, 788, null,
      target_company::text || '/' || r.file, r.caption
    ) returning id into tpl;

    raise notice 'Provisioned "%" as % (status %).', r.name, tpl, tpl_status;
  end loop;
end $$;
