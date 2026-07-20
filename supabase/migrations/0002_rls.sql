-- Row Level Security.
--
-- v1 ships with auth STUBBED (dev tenant/role switcher in the client), so the
-- ACTIVE policies below are permissive dev policies. The REAL company-scoped
-- policies are written and ready — they are commented out and marked
-- TODO(auth). Enabling real security is:
--
--   1. Turn on Supabase Auth and point the users table at auth.users
--      (users.id = auth.users.id).
--   2. Delete every `dev_all_*` policy in this file.
--   3. Uncomment every block marked TODO(auth).
--   4. Rotate the anon key.
--
-- See docs/ARCHITECTURE.md → "Enabling RLS".

-- ---------------------------------------------------------------------------
-- Helper functions (used by the real policies; harmless while auth is stubbed)
-- ---------------------------------------------------------------------------

create function current_company_ids() returns setof uuid
  language sql stable security definer set search_path = public as $$
    select company_id from memberships where user_id = auth.uid()
  $$;

create function is_company_admin(cid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (
      select 1 from memberships
      where user_id = auth.uid() and company_id = cid and role = 'admin'
    )
  $$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table companies               enable row level security;
alter table users                   enable row level security;
alter table memberships             enable row level security;
alter table brand_assets            enable row level security;
alter table brand_kits              enable row level security;
alter table locations               enable row level security;
alter table canvas_presets          enable row level security;
alter table templates               enable row level security;
alter table template_fields         enable row level security;
alter table usage_events            enable row level security;
alter table integration_connections enable row level security;

-- ---------------------------------------------------------------------------
-- DEV policies (ACTIVE) — permissive pass-through for the stubbed-auth client.
-- Delete these when enabling real auth. TODO(auth)
-- ---------------------------------------------------------------------------

create policy dev_all_companies       on companies       for all using (true) with check (true);
create policy dev_all_users           on users           for all using (true) with check (true);
create policy dev_all_memberships     on memberships     for all using (true) with check (true);
create policy dev_all_brand_assets    on brand_assets    for all using (true) with check (true);
create policy dev_all_brand_kits      on brand_kits      for all using (true) with check (true);
create policy dev_all_locations       on locations       for all using (true) with check (true);
create policy dev_all_canvas_presets  on canvas_presets  for all using (true) with check (true);
create policy dev_all_templates       on templates       for all using (true) with check (true);
create policy dev_all_template_fields on template_fields for all using (true) with check (true);
create policy dev_all_usage_events    on usage_events    for all using (true) with check (true);
-- NOTE: no dev policy on integration_connections — even in dev the client has
-- no access; Edge Functions use the service role, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- REAL policies (commented, ready to enable). TODO(auth)
-- ---------------------------------------------------------------------------

-- -- companies: members read their own companies; only admins update.
-- create policy member_read_companies on companies for select
--   using (id in (select current_company_ids()));
-- create policy admin_update_companies on companies for update
--   using (is_company_admin(id)) with check (is_company_admin(id));
-- -- Company creation (onboarding) goes through a security-definer RPC that
-- -- creates company + admin membership atomically for auth.uid().

-- -- users: each user reads/updates only their own row.
-- create policy self_read_users on users for select using (id = auth.uid());
-- create policy self_update_users on users for update
--   using (id = auth.uid()) with check (id = auth.uid());

-- -- memberships: members see memberships of their companies; admins manage them.
-- create policy member_read_memberships on memberships for select
--   using (company_id in (select current_company_ids()));
-- create policy admin_write_memberships on memberships for all
--   using (is_company_admin(company_id)) with check (is_company_admin(company_id));

-- -- brand_assets / brand_kits / locations: company-wide read (members need
-- -- them to render templates); admin-only writes.
-- create policy member_read_brand_assets on brand_assets for select
--   using (company_id in (select current_company_ids()));
-- create policy admin_write_brand_assets on brand_assets for all
--   using (is_company_admin(company_id)) with check (is_company_admin(company_id));

-- create policy member_read_brand_kits on brand_kits for select
--   using (company_id in (select current_company_ids()));
-- create policy admin_write_brand_kits on brand_kits for all
--   using (is_company_admin(company_id)) with check (is_company_admin(company_id));

-- create policy member_read_locations on locations for select
--   using (company_id in (select current_company_ids()));
-- create policy admin_write_locations on locations for all
--   using (is_company_admin(company_id)) with check (is_company_admin(company_id));

-- -- canvas_presets: global read-only reference data.
-- create policy anyone_read_canvas_presets on canvas_presets for select using (true);

-- -- templates: members see only published templates of their companies;
-- -- admins see and manage all of their company's templates.
-- create policy member_read_templates on templates for select
--   using (
--     company_id in (select current_company_ids())
--     and (status = 'published' or is_company_admin(company_id))
--   );
-- create policy admin_write_templates on templates for insert
--   with check (is_company_admin(company_id));
-- create policy admin_update_templates on templates for update
--   using (is_company_admin(company_id)) with check (is_company_admin(company_id));
-- create policy admin_delete_templates on templates for delete
--   using (is_company_admin(company_id));

-- -- template_fields: visibility follows the parent template.
-- create policy member_read_template_fields on template_fields for select
--   using (exists (
--     select 1 from templates t
--     where t.id = template_id
--       and t.company_id in (select current_company_ids())
--       and (t.status = 'published' or is_company_admin(t.company_id))
--   ));
-- create policy admin_write_template_fields on template_fields for all
--   using (exists (
--     select 1 from templates t
--     where t.id = template_id and is_company_admin(t.company_id)
--   ))
--   with check (exists (
--     select 1 from templates t
--     where t.id = template_id and is_company_admin(t.company_id)
--   ));

-- -- usage_events: any member inserts events for their company; only admins
-- -- read (dashboard). No updates or deletes from the client.
-- create policy member_insert_usage_events on usage_events for insert
--   with check (
--     company_id in (select current_company_ids())
--     and (user_id is null or user_id = auth.uid())
--   );
-- create policy admin_read_usage_events on usage_events for select
--   using (is_company_admin(company_id));

-- -- integration_connections: intentionally NO policies — client access is
-- -- fully denied; Edge Functions use the service role.
