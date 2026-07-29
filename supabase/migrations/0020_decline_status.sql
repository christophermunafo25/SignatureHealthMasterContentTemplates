-- v2.1 workstream H: the declined status. Alone in this migration —
-- `alter type ... add value` cannot share a transaction with statements
-- that use the new value on some Postgres versions.
alter type submission_status add value 'declined';
