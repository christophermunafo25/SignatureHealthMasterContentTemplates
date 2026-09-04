-- "We're Hiring!" recruiting template: RETIRE SCRIPT.
--
-- WHY: the client's recruiting team owns hiring posts, so this template should
-- no longer appear in the facility-facing library (client feedback, round 1,
-- September 2026). The public portal only serves templates with
-- status = 'published', so flipping the row to 'draft' removes it from every
-- facility's view without deleting anything. Historical submissions that
-- reference the template keep their foreign key, and the design stays
-- intact in Admin -> Templates as a draft.
--
-- This is TENANT DATA, so it deliberately does NOT live in supabase/migrations/
-- (same rule as were-hiring-template-provision.sql). Run once against the
-- Signature project, in the SQL editor or via psql.
--
-- Bringing it back is a one-line status flip: the publish toggle in
-- Admin -> Templates, or `update templates set status = 'published' ...`.
-- Do NOT re-run were-hiring-template-provision.sql to restore it.
--
-- Re-running is safe: the update only touches a published row with this
-- name, and reports "nothing to do" once it has already been retired.

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
    and name = 'We''re Hiring!'
    and status = 'published';
  get diagnostics retired = row_count;

  if retired = 0 then
    raise notice '"We''re Hiring!" is not published for company % - nothing to do.', target_company;
    return;
  end if;

  raise notice 'Retired "We''re Hiring!" (% row unpublished) for company %', retired, target_company;
end $$;
