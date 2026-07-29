-- Account profiles: invited users complete a real account-setup step
-- (name, title, photo, password) instead of a bare set-password screen.
-- The existing self_update_users policy (0006) already lets a user update
-- their own row; read_users already exposes co-members' rows to the
-- People page.

alter table users
  add column first_name text,
  add column last_name  text,
  add column title      text,
  add column avatar_url text;

-- Avatars: public-read bucket (plain <img> URLs in the sidebar and People
-- page), writes scoped to the caller's own "{user_id}/..." prefix.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy self_write_avatars on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy self_update_avatars on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy self_delete_avatars on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
