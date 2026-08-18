-- Layout groups: auto-layout stacks and plain groups over the flat fields.
--
-- Deliberately ONE jsonb column on templates rather than a table or columns
-- on template_fields. Saves replace fields wholesale (delete + reinsert mints
-- new row ids), so a group can only reference its children by fieldKey — the
-- one save-stable field identifier. Keeping the whole structure in a single
-- blob means it round-trips verbatim and never has to be re-associated.
--
-- Fields stay flat. Grouping therefore cannot change member form order (the
-- fields array), caption merge tags, or paint order (zIndex) — those are
-- three separate orderings and the stack order is a fourth, held here.
--
-- Null means "no groups", which is the pre-groups rendering path byte for
-- byte. Every existing template is null and stays null until an admin groups
-- something.
alter table templates
  add column if not exists layout_groups jsonb;
