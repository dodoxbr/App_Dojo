-- ADR-009: least privilege. RLS remains the row-level boundary; grants limit the verbs.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select on public.academies to authenticated;
grant select, insert on public.memberships to authenticated;
grant select on public.techniques to authenticated;
grant select, insert, update, delete on public.training_logs to authenticated;
grant select, insert, delete on public.training_log_techniques to authenticated;
