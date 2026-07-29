-- Submissions: the facility → social-team review pipeline. A submission is
-- an EDITABLE DOCUMENT (field values + frozen schema/brand snapshots); the
-- PNG is a byproduct regenerated from values at download time.

create type submission_status as enum ('submitted', 'approved', 'posted', 'archived');

create table submissions (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  template_id       uuid references templates(id) on delete set null,
  facility_link_id  uuid references facility_links(id) on delete set null,
  -- Denormalized so the queue still reads correctly after a link or template
  -- is deleted. This is deliberate.
  facility_name     text not null,
  template_name     text not null,
  submitter_name    text not null,
  submitter_email   text,
  -- The editable document. Image values are STORAGE URLs, never data URLs.
  values            jsonb not null default '{}',
  -- Untouched copy of what the facility originally entered, for audit.
  original_values   jsonb not null default '{}',
  caption           text not null default '',
  original_caption  text not null default '',
  -- Frozen at submit time so a later template or brand edit cannot retroactively
  -- change a queued item (see the architecture brief, D3).
  schema_snapshot   jsonb not null,
  brand_snapshot    jsonb not null,
  -- What the facility saw. Email preview + archival record.
  preview_path      text,
  status            submission_status not null default 'submitted',
  reviewed_by       uuid references users(id) on delete set null,
  reviewed_at       timestamptz,
  internal_note     text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index submissions_queue on submissions (company_id, status, created_at desc);

alter table submissions enable row level security;
-- Admins only. Facility staff have no account and no read path back into the
-- queue; anonymous inserts happen through the Edge Function via service role.
create policy admin_read_submissions on submissions for select
  using (is_company_admin(company_id));
create policy admin_update_submissions on submissions for update
  using (is_company_admin(company_id))
  with check (is_company_admin(company_id));
create policy admin_delete_submissions on submissions for delete
  using (is_company_admin(company_id));

alter table companies add column notification_emails text[] not null default '{}';

-- PRIVATE bucket (unlike the two public-read buckets): facility-uploaded
-- photos are not public content. Preview access is via signed URLs only;
-- writes happen through Edge-Function-issued signed upload URLs.
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- Admins may read (and thus sign URLs for) their own company's submission
-- objects — path prefix is "{company_id}/...". No anon policy, no writes.
create policy admin_read_submission_objects on storage.objects for select
  using (
    bucket_id = 'submissions'
    and is_company_admin((storage.foldername(name))[1]::uuid)
  );
