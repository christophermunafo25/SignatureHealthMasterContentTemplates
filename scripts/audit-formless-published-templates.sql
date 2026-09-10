-- Audit: published templates with no form fields.
--
-- "Published means visible" (the ready-to-post change) deletes the
-- isFillable filter from the public portal, so a published template whose
-- elements are all static (or facility_logo) stops being hidden. Run this
-- BEFORE deploying that change: every row it returns becomes visible to
-- facilities after that deploy. Resolve anything unexpected — unpublish it
-- or finish its fields — before the deploy goes out.
--
-- Run read-only against the linked project:
--   psql "$DATABASE_URL" -f scripts/audit-formless-published-templates.sql

select t.id, t.name, t.category, t.updated_at, count(f.id) as element_count
from templates t
left join template_fields f on f.template_id = t.id
where t.status = 'published'
  and not exists (
    select 1 from template_fields ff
    where ff.template_id = t.id
      and coalesce(ff.is_static, false) = false
      and ff.type <> 'facility_logo'
  )
group by t.id
order by t.updated_at desc;
