-- Storage buckets. All object paths are prefixed "{company_id}/..." so the
-- real policies can scope access by tenant from the path alone.

insert into storage.buckets (id, name, public)
values
  ('brand-assets', 'brand-assets', true),
  ('template-backgrounds', 'template-backgrounds', true)
on conflict (id) do nothing;

-- DEV policies (ACTIVE): authenticated/anon clients can read and write while
-- auth is stubbed. Delete when enabling real auth. TODO(auth)
create policy dev_all_storage_objects on storage.objects
  for all using (bucket_id in ('brand-assets', 'template-backgrounds'))
  with check (bucket_id in ('brand-assets', 'template-backgrounds'));

-- REAL policies (commented, ready to enable). TODO(auth)
-- Buckets stay public-read (exported PNGs need plain <img> URLs); writes are
-- tenant-scoped by the "{company_id}/" path prefix.
--
-- create policy tenant_write_storage on storage.objects for insert
--   with check (
--     bucket_id in ('brand-assets', 'template-backgrounds')
--     and (storage.foldername(name))[1]::uuid in (select current_company_ids())
--   );
-- create policy tenant_update_storage on storage.objects for update
--   using (
--     bucket_id in ('brand-assets', 'template-backgrounds')
--     and (storage.foldername(name))[1]::uuid in (select current_company_ids())
--   );
-- create policy tenant_delete_storage on storage.objects for delete
--   using (
--     bucket_id in ('brand-assets', 'template-backgrounds')
--     and is_company_admin((storage.foldername(name))[1]::uuid)
--   );
