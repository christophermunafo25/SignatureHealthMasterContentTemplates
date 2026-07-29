-- v2.1 workstream F: one shared portal link per company + a facility
-- roster. Converts the per-facility-link model (0016) — no production
-- data exists in either table, so this is a straight conversion.

-- One shared portal token per company.
alter table companies
  add column portal_token                  text unique,
  add column portal_token_previous         text unique,
  add column portal_token_previous_expires timestamptz,
  add column portal_enabled                boolean not null default false;
create index companies_portal_token on companies (portal_token)
  where portal_token is not null;
create index companies_portal_token_prev on companies (portal_token_previous)
  where portal_token_previous is not null;

-- facility_links becomes the facility roster: the token, expiry, and tag
-- filtering move up to the company or go away entirely.
alter table facility_links rename to facilities;
alter table facilities rename column facility_name to name;
alter table facilities
  drop column token,
  drop column expires_at,
  drop column template_tags,
  drop column last_used_at,
  add column short_name text not null default '',
  add column state      text,
  add column region     text,
  add column sort_order int not null default 100;
alter table facilities add constraint facilities_name_unique unique (company_id, name);
drop index if exists facility_links_by_company;
create index facilities_by_company on facilities (company_id, active, sort_order);

-- Policies follow a renamed table; rename for legibility and add member
-- read so admin screens can label submissions.
alter policy admin_manage_facility_links on facilities rename to admin_manage_facilities;
create policy member_read_facilities on facilities for select
  using (company_id in (select current_company_ids()));

-- Submissions and usage events follow the rename.
alter table submissions   rename column facility_link_id to facility_id;
alter table usage_events  rename column facility_link_id to facility_id;

-- Token generation never happens client-side.
create or replace function public.rotate_portal_token(p_company_id uuid, p_grace_days int default 14)
  returns text
  language plpgsql security definer set search_path = public, extensions as $$
declare
  fresh text;
begin
  if not is_company_admin(p_company_id) then
    raise exception 'Admin access required.';
  end if;
  fresh := encode(extensions.gen_random_bytes(24), 'base64');
  fresh := replace(replace(replace(fresh, '+', '-'), '/', '_'), '=', '');
  update companies
     set portal_token_previous         = portal_token,
         portal_token_previous_expires = case
           when portal_token is null then null
           else now() + make_interval(days => p_grace_days) end,
         portal_token                  = fresh
   where id = p_company_id;
  return fresh;
end $$;
revoke all on function public.rotate_portal_token(uuid, int) from public;
grant execute on function public.rotate_portal_token(uuid, int) to authenticated;
