-- v3: the Social Media Submission Form. Q4 upload is now required and the
-- client's form advertises a 250 MB ceiling (was 200 MB in 0028).
--
-- DEPLOY NOTE: the project's GLOBAL upload size limit (Dashboard → Storage →
-- Settings) must also be raised to at least 250 MB or this bucket limit has
-- no effect.
--
-- Numbered 0033, not 0030: the feat/builder-parity-phase-0 branch already
-- claims 0030–0032, and two migrations sharing a version prefix collide on
-- the primary key of supabase_migrations.schema_migrations.

update storage.buckets
   set file_size_limit = 262144000  -- 250 MB
 where id = 'submissions';

-- v3 asks no VP-approval question, so these two columns are frozen at their
-- v1/v2 meaning. Kept, never dropped: historical rows still read from them
-- and the "Flagged only" filter still surfaces them.
comment on column submissions.vp_approved is
  'LEGACY (release_form v1/v2 only). Null on v3 submissions — v3 has no VP question.';
comment on column submissions.release_flagged is
  'LEGACY (release_form v1/v2 only). Always false on v3 submissions.';
