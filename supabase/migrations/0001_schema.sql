-- Multi-tenant brand template portal — core schema.
-- Ships EMPTY of tenant data: no companies, no brands, no templates.
-- All rows are created at runtime via onboarding, Brand Studio, and the Template Builder.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------

create table companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

-- Kept even though auth is stubbed in v1: real Supabase Auth maps auth.users
-- onto this table later without a schema change. TODO(auth)
create table users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text,
  created_at  timestamptz not null default now()
);

create type member_role as enum ('admin', 'member');

create table memberships (
  user_id     uuid not null references users(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  role        member_role not null default 'member',
  created_at  timestamptz not null default now(),
  primary key (user_id, company_id)
);

-- ---------------------------------------------------------------------------
-- Brand
-- ---------------------------------------------------------------------------

create type asset_kind as enum ('logo', 'font', 'image');

create table brand_assets (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  kind         asset_kind not null,
  name         text not null,
  storage_path text not null,
  -- fonts: { "family": string, "weight": number, "style": string, "format": string }
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index brand_assets_by_company on brand_assets (company_id, kind);

create table brand_kits (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  -- [{ "key": "primary", "name": "Primary", "hex": "#0F172A" }, ...]
  colors                jsonb not null default '[]',
  -- { "source": "google" | "custom", "family": string, "assetId"?: uuid }
  heading_font          jsonb,
  body_font             jsonb,
  primary_logo_asset_id uuid references brand_assets(id) on delete set null,
  is_active             boolean not null default true,
  updated_at            timestamptz not null default now()
);
create unique index brand_kits_one_active on brand_kits (company_id) where is_active;

create table locations (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  name              text not null,
  logo_storage_path text,
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now()
);
create index locations_by_company on locations (company_id);

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------

-- Non-tenant reference data; the only table seed.sql may populate.
create table canvas_presets (
  id      text primary key,
  label   text not null,
  width   int not null check (width > 0),
  height  int not null check (height > 0),
  enabled boolean not null default true
);

create type template_status as enum ('draft', 'published');

create table templates (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references companies(id) on delete cascade,
  name                    text not null,
  description             text not null default '',
  category                text not null default '',
  tags                    text[] not null default '{}',
  status                  template_status not null default 'draft',
  -- Always read by the app from these columns — never hardcoded. v1 creation
  -- UI locks to the square-1440 preset; any size renders and exports.
  canvas_width            int not null check (canvas_width > 0),
  canvas_height           int not null check (canvas_height > 0),
  background_storage_path text,
  -- Merge template referencing template_fields.field_key: "{name} hit {years} years!"
  caption_template        text not null default '',
  created_by              uuid references users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index templates_by_company on templates (company_id, status);

create type field_type as enum ('text', 'multiline', 'image', 'select', 'location');

create table template_fields (
  id                uuid primary key default gen_random_uuid(),
  template_id       uuid not null references templates(id) on delete cascade,
  sort_order        int not null default 0,
  -- Stable human slug used in {merge_tags}; survives field re-creation.
  field_key         text not null,
  label             text not null,
  type              field_type not null,
  -- Placement in canvas pixel space (top-left of box unless anchor=center).
  x                 numeric not null,
  y                 numeric not null,
  width             numeric not null,
  height            numeric not null,
  rotation          numeric,
  anchor            text check (anchor in ('topLeft', 'center')),
  -- Locked styling. color_key references the brand kit palette, not free hex,
  -- so a palette change propagates to every template.
  font_family       text,
  font_size_px      numeric,
  min_font_size_px  numeric,
  color_key         text,
  align             text check (align in ('left', 'center', 'right')),
  uppercase         boolean,
  letter_spacing_px numeric,
  line_height       numeric,
  -- Guardrails
  max_length        int,
  auto_fit          boolean,
  object_fit        text check (object_fit in ('cover', 'contain')),
  aspect_ratio      numeric,
  options           text[],
  placeholder       text,
  required          boolean not null default false,
  unique (template_id, field_key)
);
create index template_fields_by_template on template_fields (template_id, sort_order);

-- ---------------------------------------------------------------------------
-- Usage + integrations
-- ---------------------------------------------------------------------------

create type usage_action as enum ('open', 'download');

create table usage_events (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  template_id uuid not null references templates(id) on delete cascade,
  action      usage_action not null,
  user_id     uuid references users(id) on delete set null, -- nullable while auth is stubbed
  created_at  timestamptz not null default now()
);
create index usage_events_summary on usage_events (company_id, template_id, action, created_at);

-- Tokens are written/read ONLY by Edge Functions using the service role.
-- No client-facing RLS policy ever grants access to this table.
create table integration_connections (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  provider      text not null check (provider in ('figma')),
  access_token  text not null,
  refresh_token text,
  scope         text,
  connected_by  uuid references users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (company_id, provider)
);
