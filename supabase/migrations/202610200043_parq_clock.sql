-- PAR-Q: a data do registro é a hora real (clock_timestamp), para a "última resposta" nunca empatar. Idempotente com a 042.
alter table public.parq_responses alter column created_at set default clock_timestamp();
