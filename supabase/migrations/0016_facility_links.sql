-- Facility links: unguessable per-facility tokens for the anonymous portal.
-- Anonymous clients NEVER talk to Postgres directly — the public Edge
-- Functions read this table with the service role. RLS stays closed to anon.

create table facility_links (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  -- Unguessable public token, generated server-side by the database default:
  -- 24 random bytes (192 bits of entropy) as URL-safe base64. NEVER a slug
  -- of the facility name.
  token         text not null unique
                default replace(replace(encode(extensions.gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'),
  facility_name text not null,
  -- Optional: restrict which templates this facility sees. Empty = all published.
  template_tags text[] not null default '{}',
  active        boolean not null default true,
  expires_at    timestamptz,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index facility_links_by_company on facility_links (company_id, active);

alter table facility_links enable row level security;
-- Admins manage their own company's links. No anon policy: the Edge Function
-- reads this table with the service role.
create policy admin_manage_facility_links on facility_links for all
  using (is_company_admin(company_id))
  with check (is_company_admin(company_id));

-- Per-facility attribution on analytics.
alter table usage_events add column facility_link_id uuid
  references facility_links(id) on delete set null;

-- Fixed-window rate limiting for the public endpoints. Service-role only:
-- RLS enabled with no policies, so no client role can touch it.
create table rate_limits (
  bucket       text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);
alter table rate_limits enable row level security;
