-- Root-URL public portal (opt-in). When exactly one company sets
-- portal_public, the anonymous facility portal is also served at the bare
-- production URL — no shared token in the address. Off by default; the
-- portal_enabled kill switch still gates every anonymous read and write.
alter table companies
  add column portal_public boolean not null default false;
