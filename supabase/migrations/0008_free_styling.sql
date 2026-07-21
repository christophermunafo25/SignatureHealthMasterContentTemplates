-- Round 3: admins style fields freely — brand rules/type styles are opt-in.
-- text_gradient stores an optional text fill gradient:
--   { "angle": 90, "stops": [{ "position": 0, "color": "#FF8300" }, ...] }

alter table template_fields
  add column if not exists text_gradient jsonb;
