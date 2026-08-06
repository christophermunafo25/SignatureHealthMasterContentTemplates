-- v2.2: the Social Media Update Form. Stored as one jsonb document on the
-- submission (see src/lib/releaseForm.ts for the shape and version), with
-- the high-traffic answers denormalized into columns so the board and the
-- records register filter in the QUERY rather than in JS.

alter table submissions
  add column release_form        jsonb,
  -- Uploaded media: [{ path, name, mimeType, size }]. `path` is a BARE
  -- storage path under {company_id}/ in the private submissions bucket.
  -- Never a signed URL — those expire and would blank the record.
  add column asset_paths         jsonb   not null default '[]'::jsonb,
  add column platforms           text[]  not null default '{}',
  add column requested_post_date date,
  add column requested_post_time text,
  add column vp_approved         boolean,
  add column release_flagged     boolean not null default false;

comment on column submissions.release_flagged is
  'True when an answer needs a human look before posting (currently: VP of Operations did not approve).';

create index submissions_post_date on submissions (company_id, requested_post_date)
  where requested_post_date is not null;
create index submissions_release_form on submissions using gin (release_form jsonb_path_ops);
create index submissions_platforms on submissions using gin (platforms);
