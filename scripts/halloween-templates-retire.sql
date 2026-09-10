-- Halloween ready-to-post set (5 graphics): RETIRE SCRIPT.
--
-- WHY: seasonal graphics should leave the facility-facing library once the
-- holiday has passed. Run this on November 1. The public portal only serves
-- templates with status = 'published', so flipping the rows to 'draft'
-- removes them from every facility's view without deleting anything.
-- Historical submissions that reference the templates keep their foreign
-- keys, and the designs stay intact in Admin -> Templates as drafts.
--
-- Bring them back next year with the publish toggle in Admin -> Templates.
-- Do NOT re-run halloween-templates-provision.sql to restore them.
--
-- This is TENANT DATA, so it deliberately does NOT live in
-- supabase/migrations/ (same rule as halloween-templates-provision.sql).
-- Run once against the Signature project, in the SQL editor or via psql.
--
-- Re-running is safe: the update only touches published rows with these
-- names, and reports "nothing to do" once they have already been retired.

do $$
declare
  target_company uuid;
  retired integer;
begin
  select id into target_company from companies where slug = 'signature-healthcare';
  if target_company is null then
    raise exception 'Company not found. Check the slug before running this.';
  end if;

  update templates
  set status = 'draft'
  where company_id = target_company
    and name = any(array[
      'Halloween Ghost Pattern',
      'Halloween Pumpkins and Bats',
      'Halloween Trick or Treat',
      'Halloween Witch Pumpkin',
      'Halloween Haunted Houses'
    ])
    and status = 'published';
  get diagnostics retired = row_count;

  if retired = 0 then
    raise notice 'No Halloween templates are published for company % - nothing to do.', target_company;
    return;
  end if;

  raise notice 'Retired % Halloween template(s) for company %', retired, target_company;
end $$;
