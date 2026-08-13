-- Facility logos hang off the EXISTING facilities roster (0019) — never a
-- parallel locations table (0009 removed that model; restoring it would fork
-- the roster into two lists that drift). Logos live in the public
-- brand-assets bucket under {company_id}/facilities/{facility_id}/... so the
-- anonymous portal and the Edge Functions can resolve them with plain
-- public URLs that never expire inside a saved snapshot.
alter table facilities add column logo_storage_path text;

-- New auto-resolved element type. Enum addition only — nothing in this
-- migration (or any migration: tenant data never ships in migrations) inserts
-- a row using it, and Postgres won't let a new enum value be used in the
-- transaction that adds it.
alter type field_type add value if not exists 'facility_logo';
