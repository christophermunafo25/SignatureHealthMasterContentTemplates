-- Real auth: Supabase Auth becomes the identity source, dev-permissive RLS
-- is replaced by the production company-scoped policies (previously staged
-- under TODO(auth) in 0002/0003).

-- ---------------------------------------------------------------------------
-- auth.users → public.users mirror
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Onboarding RPC: create a company + admin membership atomically.
-- The only way to create a company under real RLS.
-- ---------------------------------------------------------------------------

create or replace function public.create_company_with_admin(p_name text, p_slug text)
  returns public.companies
  language plpgsql security definer set search_path = public as $$
declare
  c public.companies;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into companies (name, slug) values (p_name, p_slug) returning * into c;
  insert into memberships (user_id, company_id, role) values (auth.uid(), c.id, 'admin');
  return c;
end $$;

revoke all on function public.create_company_with_admin(text, text) from public;
grant execute on function public.create_company_with_admin(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Drop the dev pass-through policies
-- ---------------------------------------------------------------------------

drop policy if exists dev_all_companies       on companies;
drop policy if exists dev_all_users           on users;
drop policy if exists dev_all_memberships     on memberships;
drop policy if exists dev_all_brand_assets    on brand_assets;
drop policy if exists dev_all_brand_kits      on brand_kits;
drop policy if exists dev_all_locations       on locations;
drop policy if exists dev_all_canvas_presets  on canvas_presets;
drop policy if exists dev_all_templates       on templates;
drop policy if exists dev_all_template_fields on template_fields;
drop policy if exists dev_all_usage_events    on usage_events;
drop policy if exists dev_all_storage_objects on storage.objects;

-- ---------------------------------------------------------------------------
-- Production policies (helper functions current_company_ids /
-- is_company_admin were created in 0002 and are security definer, so they
-- bypass RLS and cannot recurse).
-- ---------------------------------------------------------------------------

-- companies: members read their own; admins update; creation via RPC only.
create policy member_read_companies on companies for select
  using (id in (select current_company_ids()));
create policy admin_update_companies on companies for update
  using (is_company_admin(id)) with check (is_company_admin(id));

-- users: read self + people in your companies (People page); update self.
create policy read_users on users for select
  using (
    id = auth.uid()
    or id in (
      select m.user_id from memberships m
      where m.company_id in (select current_company_ids())
    )
  );
create policy self_update_users on users for update
  using (id = auth.uid()) with check (id = auth.uid());

-- memberships: read your own rows; admins read + manage their company's.
create policy read_memberships on memberships for select
  using (user_id = auth.uid() or is_company_admin(company_id));
create policy admin_insert_memberships on memberships for insert
  with check (is_company_admin(company_id));
create policy admin_update_memberships on memberships for update
  using (is_company_admin(company_id)) with check (is_company_admin(company_id));
create policy admin_delete_memberships on memberships for delete
  using (is_company_admin(company_id) or user_id = auth.uid()); -- admins remove people; anyone can leave

-- brand_assets / brand_kits / locations: company-wide read, admin writes.
create policy member_read_brand_assets on brand_assets for select
  using (company_id in (select current_company_ids()));
create policy admin_write_brand_assets on brand_assets for all
  using (is_company_admin(company_id)) with check (is_company_admin(company_id));

create policy member_read_brand_kits on brand_kits for select
  using (company_id in (select current_company_ids()));
create policy admin_write_brand_kits on brand_kits for all
  using (is_company_admin(company_id)) with check (is_company_admin(company_id));

create policy member_read_locations on locations for select
  using (company_id in (select current_company_ids()));
create policy admin_write_locations on locations for all
  using (is_company_admin(company_id)) with check (is_company_admin(company_id));

-- canvas_presets: global read-only reference data.
create policy anyone_read_canvas_presets on canvas_presets for select using (true);

-- templates: members see published; admins see and manage all of theirs.
create policy member_read_templates on templates for select
  using (
    company_id in (select current_company_ids())
    and (status = 'published' or is_company_admin(company_id))
  );
create policy admin_insert_templates on templates for insert
  with check (is_company_admin(company_id));
create policy admin_update_templates on templates for update
  using (is_company_admin(company_id)) with check (is_company_admin(company_id));
create policy admin_delete_templates on templates for delete
  using (is_company_admin(company_id));

-- template_fields: visibility follows the parent template.
create policy member_read_template_fields on template_fields for select
  using (exists (
    select 1 from templates t
    where t.id = template_id
      and t.company_id in (select current_company_ids())
      and (t.status = 'published' or is_company_admin(t.company_id))
  ));
create policy admin_write_template_fields on template_fields for all
  using (exists (
    select 1 from templates t
    where t.id = template_id and is_company_admin(t.company_id)
  ))
  with check (exists (
    select 1 from templates t
    where t.id = template_id and is_company_admin(t.company_id)
  ));

-- usage_events: members insert for their company; admins read.
create policy member_insert_usage_events on usage_events for insert
  with check (
    company_id in (select current_company_ids())
    and (user_id is null or user_id = auth.uid())
  );
create policy admin_read_usage_events on usage_events for select
  using (is_company_admin(company_id));

-- integration_connections: still NO client policies — Edge Functions only.

-- ---------------------------------------------------------------------------
-- Storage: tenant-scoped writes via the "{company_id}/" path prefix.
-- Buckets stay public-read (exported PNGs need plain <img> URLs).
-- ---------------------------------------------------------------------------

create policy tenant_insert_storage on storage.objects for insert
  with check (
    bucket_id in ('brand-assets', 'template-backgrounds')
    and (storage.foldername(name))[1]::uuid in (select current_company_ids())
  );
create policy tenant_update_storage on storage.objects for update
  using (
    bucket_id in ('brand-assets', 'template-backgrounds')
    and (storage.foldername(name))[1]::uuid in (select current_company_ids())
  );
create policy tenant_delete_storage on storage.objects for delete
  using (
    bucket_id in ('brand-assets', 'template-backgrounds')
    and is_company_admin((storage.foldername(name))[1]::uuid)
  );
create policy public_read_storage on storage.objects for select
  using (bucket_id in ('brand-assets', 'template-backgrounds'));
