-- Diário: horário do treino ("treino das 07:00"). O dia continua em `trained_at` (meio-dia UTC, para não deslocar o dia);
-- o horário é a hora local de quem treinou, guardada à parte: início e, opcionalmente, término.
-- Registros antigos ficam sem horário (colunas aceitam nulo); a tela nova exige o início.
-- Continua valendo: o diário é privado e um registro NÃO é presença (regras 6 e 8 do CLAUDE.md).

alter table public.training_logs
  add column start_time time,
  add column end_time time,
  add constraint training_logs_time_order check (end_time is null or (start_time is not null and end_time > start_time));

drop function public.save_training_log(uuid, timestamptz, text, uuid[], uuid, uuid);

create function public.save_training_log(
  p_academy_id uuid, p_trained_at timestamptz, p_notes text, p_technique_ids uuid[], p_client_key uuid,
  p_log_id uuid default null, p_start_time time default null, p_end_time time default null)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_notes text := coalesce(p_notes, '');
  v_ids uuid[];
  v_id uuid;
begin
  if v_user is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if p_client_key is null then raise exception 'VALIDATION_ERROR: client_key' using errcode = '22023'; end if;
  if length(v_notes) > 10000 then raise exception 'VALIDATION_ERROR: notes' using errcode = '22023'; end if;
  if p_trained_at is null or p_trained_at > now() + interval '1 day' then
    raise exception 'VALIDATION_ERROR: trained_at' using errcode = '22023';
  end if;
  if p_end_time is not null and (p_start_time is null or p_end_time <= p_start_time) then
    raise exception 'VALIDATION_ERROR: time' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_technique_ids, '{}')) as x;
  if cardinality(v_ids) > 50 then raise exception 'VALIDATION_ERROR: techniques' using errcode = '22023'; end if;

  if p_log_id is null then
    select id into v_id from public.training_logs where user_id = v_user and client_key = p_client_key;
    if found then return v_id; end if; -- same request repeated
    insert into public.training_logs (academy_id, user_id, notes, trained_at, client_key, start_time, end_time)
      values (p_academy_id, v_user, v_notes, p_trained_at, p_client_key, p_start_time, p_end_time) returning id into v_id;
  else
    update public.training_logs
      set academy_id = p_academy_id, notes = v_notes, trained_at = p_trained_at, start_time = p_start_time, end_time = p_end_time,
          updated_at = now()
      where id = p_log_id and user_id = v_user returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    delete from public.training_log_techniques where log_id = v_id;
  end if;

  insert into public.training_log_techniques (log_id, technique_id) select v_id, unnest(v_ids);
  return v_id;
end;
$$;

revoke all on function public.save_training_log(uuid, timestamptz, text, uuid[], uuid, uuid, time, time) from public, anon, authenticated;
grant execute on function public.save_training_log(uuid, timestamptz, text, uuid[], uuid, uuid, time, time) to authenticated;
