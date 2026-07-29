-- Auth hardening (v2.1 workstream D). Invite-only tenancy and a floor on
-- admin count. UI-side: the signup view is removed from AuthPage and the
-- dashboard's "Allow new users to sign up" must be OFF (removing the UI
-- does not close the API).

-- D1: company creation stops being self-service. Under invite-only
-- tenancy, new companies are provisioned by the operator (service role);
-- a stray authenticated account must not be able to mint a tenant.
revoke execute on function public.create_company_with_admin(text, text) from authenticated;

-- D3: a company can never lose its last admin. PeopleAdmin disables
-- self-demotion in the UI, but RLS permits it via a direct API call, and
-- recovery from a zero-admin company is a service-role query.
create or replace function public.prevent_last_admin_removal()
  returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  remaining int;
begin
  -- Only guard transitions that remove an admin membership.
  if tg_op = 'DELETE' then
    if old.role <> 'admin' then return old; end if;
  elsif tg_op = 'UPDATE' then
    if old.role <> 'admin' or new.role = 'admin' then return new; end if;
  end if;

  select count(*) into remaining
    from memberships
   where company_id = old.company_id
     and role = 'admin'
     and user_id <> old.user_id;

  if remaining = 0 then
    raise exception 'A company must keep at least one admin. Promote someone else first.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists prevent_last_admin_removal on memberships;
create trigger prevent_last_admin_removal
  before update or delete on memberships
  for each row execute function public.prevent_last_admin_removal();
