-- Signature HealthCARE facility roster: ONE-TIME PROVISIONING SCRIPT.
--
-- This is TENANT DATA, so it deliberately does NOT live in supabase/migrations/.
-- The platform ships empty of tenant rows (see docs/ARCHITECTURE.md); putting a
-- client's facility list in a migration would seed it into every future tenant.
--
-- Run once against the Signature project, in the SQL editor or via psql, after
-- 0019_shared_portal.sql has been applied AND the Signature company exists
-- (slug 'signature-healthcare' — adjust below if it differs).
--
-- Re-running is safe: `on conflict (company_id, name) do update` refreshes
-- short_name and sort_order without touching `active` or breaking the foreign
-- keys held by existing submissions.

do $$
declare
  target_company uuid;
begin
  -- Resolve the tenant by slug. Adjust if Signature's slug differs.
  select id into target_company from companies where slug = 'signature-healthcare';
  if target_company is null then
    raise exception 'Company not found. Check the slug before running this.';
  end if;
  insert into facilities (company_id, name, short_name, sort_order, active) values
    (target_company, 'Bluegrass Care & Rehabilitation Center', 'Bluegrass', 10, true),
    (target_company, 'Signature HealthCARE of Bowling Green', 'Bowling Green', 20, true),
    (target_company, 'Signature HealthCARE of Bremen', 'Bremen', 30, true),
    (target_company, 'Signature HealthCARE of Carrollton', 'Carrollton', 40, true),
    (target_company, 'Signature HealthCARE of Chapel Hill', 'Chapel Hill', 50, true),
    (target_company, 'Signature HealthCARE of Clarksville', 'Clarksville', 60, true),
    (target_company, 'Signature HealthCARE of Cleveland', 'Cleveland', 70, true),
    (target_company, 'Clinton County Care & Rehabilitation Center', 'Clinton County', 80, true),
    (target_company, 'Signature HealthCARE at Colonial', 'Colonial', 90, true),
    (target_company, 'Danville Centre for Health & Rehabilitation', 'Danville', 100, true),
    (target_company, 'Signature HealthCARE of East Louisville', 'East Louisville', 110, true),
    (target_company, 'Signature HealthCARE of Elizabethton', 'Elizabethton', 120, true),
    (target_company, 'Signature HealthCARE of Elizabethtown', 'Elizabethtown', 130, true),
    (target_company, 'Signature HealthCARE of Erin', 'Erin', 140, true),
    (target_company, 'Signature HealthCARE of Fayette County', 'Fayette County', 150, true),
    (target_company, 'Signature HealthCARE of Fentress County', 'Fentress County', 160, true),
    (target_company, 'Fountain Circle Care & Rehabilitation Center', 'Fountain Circle', 170, true),
    (target_company, 'Signature HealthCARE of Galion', 'Galion', 180, true),
    (target_company, 'Signature HealthCARE of Georgetown', 'Georgetown', 190, true),
    (target_company, 'Signature HealthCARE of Glasgow', 'Glasgow', 200, true),
    (target_company, 'Signature HealthCARE of Greeneville', 'Greeneville', 210, true),
    (target_company, 'Harrodsburg Health & Rehabilitation Center', 'Harrodsburg', 220, true),
    (target_company, 'Signature HealthCARE of Hart County', 'Hart County', 230, true),
    (target_company, 'Signature HealthCARE of Hartford', 'Hartford', 240, true),
    (target_company, 'Signature HealthCARE at Heritage Hall', 'Heritage Hall', 250, true),
    (target_company, 'Hermitage Care & Rehabilitation Center', 'Hermitage', 260, true),
    (target_company, 'Signature HealthCARE at Hillcrest', 'Hillcrest', 270, true),
    (target_company, 'Signature HealthCARE at Jackson Manor', 'Jackson Manor', 280, true),
    (target_company, 'Signature HealthCARE at Jefferson Manor', 'Jefferson Manor', 290, true),
    (target_company, 'Signature HealthCARE at Jefferson Place', 'Jefferson Place', 300, true),
    (target_company, 'Signature HealthCARE of Kinston', 'Kinston', 310, true),
    (target_company, 'Lee County Care & Rehabilitation Center', 'Lee County', 320, true),
    (target_company, 'Liberty Care & Rehabilitation Center', 'Liberty', 330, true),
    (target_company, 'Mayfair Manor', 'Mayfair Manor', 340, true),
    (target_company, 'Signature HealthCARE of McCreary County', 'McCreary County', 350, true),
    (target_company, 'Signature HealthCARE of Memphis', 'Memphis', 360, true),
    (target_company, 'Monroe County Rehab & Wellness Center', 'Monroe County', 370, true),
    (target_company, 'Signature HealthCARE of Monteagle', 'Monteagle', 380, true),
    (target_company, 'Morgantown Care & Rehabilitation Center', 'Morgantown', 390, true),
    (target_company, 'Mountain City Care & Rehabilitation Center', 'Mountain City', 400, true),
    (target_company, 'Signature HealthCARE of Muncie', 'Muncie', 410, true),
    (target_company, 'Signature HealthCARE of Norfolk', 'Norfolk', 420, true),
    (target_company, 'Signature HealthCARE of North Hardin', 'North Hardin', 430, true),
    (target_company, 'Oakview Nursing & Rehabilitation Center', 'Oakview', 440, true),
    (target_company, 'Signature HealthCARE at Parkwood', 'Parkwood', 450, true),
    (target_company, 'Pickett Care & Rehabilitation Center', 'Pickett', 460, true),
    (target_company, 'Signature HealthCARE of Portland', 'Portland', 470, true),
    (target_company, 'Prestonsburg Health Care Center', 'Prestonsburg', 480, true),
    (target_company, 'Signature HealthCARE of Primacy', 'Primacy', 490, true),
    (target_company, 'Princeton Assisted Living and Transitional Care', 'Princeton', 500, true),
    (target_company, 'Signature HealthCARE of Putnam', 'Putnam', 510, true),
    (target_company, 'Signature HealthCARE of Ridgely', 'Ridgely', 520, true),
    (target_company, 'Riverside Care & Rehabilitation Center', 'Riverside', 530, true),
    (target_company, 'Riverview Health Care Center', 'Riverview', 540, true),
    (target_company, 'Signature HealthCARE of Roanoke Rapids', 'Roanoke Rapids', 550, true),
    (target_company, 'Rockcastle Health & Rehabilitation Center', 'Rockcastle', 560, true),
    (target_company, 'Signature HealthCARE at Rockford', 'Rockford', 570, true),
    (target_company, 'Signature HealthCARE of Rockwood', 'Rockwood', 580, true),
    (target_company, 'Signature HealthCARE of Rogersville', 'Rogersville', 590, true),
    (target_company, 'Signature HealthCARE of South Louisville', 'South Louisville', 600, true),
    (target_company, 'Signature HealthCARE of South Pittsburg', 'South Pittsburg', 610, true),
    (target_company, 'Signature HealthCARE of Spencer County', 'Spencer County', 620, true),
    (target_company, 'Spring City Care & Rehab', 'Spring City', 630, true),
    (target_company, 'Standing Stone Care & Rehab', 'Standing Stone', 640, true),
    (target_company, 'Signature HealthCARE at Summerfield', 'Summerfield', 650, true),
    (target_company, 'Signature HealthCARE at Summit Manor', 'Summit Manor', 660, true),
    (target_company, 'Sunrise Manor', 'Sunrise Manor', 670, true),
    (target_company, 'Signature HealthCARE of Terre Haute', 'Terre Haute', 680, true),
    (target_company, 'Westmoreland Care & Rehabilitation Center', 'Westmoreland', 690, true)
  on conflict (company_id, name) do update
    set short_name = excluded.short_name,
        sort_order = excluded.sort_order;
end $$;

-- Verify: expect 69.
-- select count(*) from facilities f
--   join companies c on c.id = f.company_id
--  where c.slug = 'signature-healthcare';
