-- v2.1 workstream H: decline metadata, edit stamping, and the
-- facility-filter index for server-side dashboard queries.
alter table submissions
  add column decline_reason text,
  add column edited_by  uuid references users(id) on delete set null,
  add column edited_at  timestamptz,
  add column posted_at  timestamptz;

create index submissions_facility on submissions (company_id, facility_id, created_at desc);
