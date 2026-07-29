-- submit-content requires a valid submitter email on every submission
-- (client and server) as of 43ca8ad; make the schema enforce what the
-- function guarantees. Safe to apply: the queue held zero rows (and zero
-- null emails) at migration time.
alter table submissions alter column submitter_email set not null;
