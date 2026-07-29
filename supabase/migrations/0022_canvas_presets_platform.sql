-- v2.1 workstream C: canvas sizes grouped by platform.
--
-- NOTE: the previous spec's eleven-row catalog was referenced but not
-- carried into the v2.1 document — this catalog is AUTHORED to the stated
-- intent (platform, format, sort_order, recommended) and is reference
-- data: adjust rows freely once Signature confirms which platforms they
-- post to (open question 7).

alter table canvas_presets
  add column platform    text not null default 'General',
  add column format      text not null default '',
  add column sort_order  int  not null default 100,
  add column recommended boolean not null default false;

-- Replace the placeholder rows with the platform catalog. Templates hold
-- their own width/height, so re-keying presets never reshapes a template.
delete from canvas_presets;
insert into canvas_presets (id, label, width, height, enabled, platform, format, sort_order, recommended) values
  ('square-1440',      'Square (1440×1440)',            1440, 1440, true,  'General',   'Square post',    10, true),
  ('ig-post-1080',     'Instagram Post (1080×1080)',    1080, 1080, true,  'Instagram', 'Square post',    20, true),
  ('ig-portrait-1080', 'Instagram Portrait (1080×1350)',1080, 1350, true,  'Instagram', 'Portrait post',  30, false),
  ('ig-story-1080',    'Instagram Story (1080×1920)',   1080, 1920, true,  'Instagram', 'Story / Reel',   40, false),
  ('fb-post-1200',     'Facebook Post (1200×630)',      1200, 630,  true,  'Facebook',  'Feed post',      50, false),
  ('fb-story-1080',    'Facebook Story (1080×1920)',    1080, 1920, true,  'Facebook',  'Story',          60, false),
  ('fb-cover-820',     'Facebook Cover (820×312)',       820, 312,  false, 'Facebook',  'Page cover',     70, false),
  ('li-post-1200',     'LinkedIn Post (1200×627)',      1200, 627,  true,  'LinkedIn',  'Feed post',      80, false),
  ('li-banner-1584',   'LinkedIn Banner (1584×396)',    1584, 396,  false, 'LinkedIn',  'Page banner',    90, false),
  ('x-post-1600',      'X Post (1600×900)',             1600, 900,  false, 'X',         'Feed post',     100, false),
  ('print-letter-150', 'Print Flyer (1275×1650)',       1275, 1650, false, 'Print',     'Letter flyer',  110, false)
on conflict (id) do nothing;

-- The size a template was built against (dimensions still live on the
-- template itself — deleting a preset never reshapes anything).
alter table templates add column canvas_preset_id text references canvas_presets(id) on delete set null;

-- Per-company allowlist. Empty = every enabled catalog row.
alter table companies add column enabled_preset_ids text[] not null default '{}';
