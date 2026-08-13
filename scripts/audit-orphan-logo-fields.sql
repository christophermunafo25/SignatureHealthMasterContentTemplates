-- Audit: orphan logo fields left by migration 0009.
--
-- 0009_remove_locations.sql rewrote every `location` field to type='image',
-- so templates built before 21 Jul 2026 may carry a member-uploadable image
-- field sitting where a facility logo used to auto-resolve. Those are
-- candidates for hand-conversion to the new `facility_logo` type (the
-- builder's Type dropdown does it) — NEVER auto-convert: an image field
-- labeled "logo" may be intentional.
--
-- Run read-only against the linked project:
--   psql "$DATABASE_URL" -f scripts/audit-orphan-logo-fields.sql

select
  tf.id          as field_id,
  tf.label,
  tf.field_key,
  t.name         as template_name,
  t.status,
  c.name         as company_name
from template_fields tf
join templates t on t.id = tf.template_id
join companies c on c.id = t.company_id
where tf.type = 'image'
  and (tf.label ilike '%logo%' or tf.field_key ilike '%logo%')
order by c.name, t.name, tf.label;
