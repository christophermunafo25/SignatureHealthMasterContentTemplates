-- Canvas presets: non-tenant reference data (the only "seed" the product
-- ships). Kept as an idempotent migration so hosted projects get it via
-- `db push` — seed.sql only runs on local `db reset`.

insert into canvas_presets (id, label, width, height, enabled) values
  ('square-1440',     'Square (1440×1440)',          1440, 1440, true),
  ('ig-post-1080',    'Instagram Post (1080×1080)',  1080, 1080, false),
  ('ig-story-1080',   'Instagram Story (1080×1920)', 1080, 1920, false),
  ('fb-post-1200',    'Facebook (1200×630)',         1200, 630,  false),
  ('li-post-1200',    'LinkedIn (1200×627)',         1200, 627,  false)
on conflict (id) do nothing;
