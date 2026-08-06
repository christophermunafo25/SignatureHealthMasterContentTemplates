-- v2.2: submissions arrive two ways. 'template' is the existing brand
-- template flow (schema_snapshot frozen, values filled). 'direct' is a
-- facility uploading their own photo/video with proposed copy — no
-- template, no schema, no field values.

create type submission_kind as enum ('template', 'direct');

alter table submissions
  add column kind submission_kind not null default 'template';

-- A direct submission has no template. These three columns were written
-- assuming one always existed.
alter table submissions alter column schema_snapshot drop not null;
alter table submissions alter column template_name set default '';

create index submissions_kind on submissions (company_id, kind, created_at desc);
