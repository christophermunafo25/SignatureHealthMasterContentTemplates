-- Locations are removed from the platform. Any existing location fields
-- become image fields (they rendered a logo image), then the enum value and
-- the table go away.

update template_fields set type = 'image' where type = 'location';

alter type field_type rename to field_type_old;
create type field_type as enum ('text', 'multiline', 'image', 'select');
alter table template_fields
  alter column type type field_type using type::text::field_type;
drop type field_type_old;

drop table if exists locations; -- policies drop with the table
