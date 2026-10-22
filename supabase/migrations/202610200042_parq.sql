-- PAR-Q (questionário de prontidão para atividade física). Pedido do dono do produto (2026-10-22).
-- A pessoa (ou o responsável legal, por um menor) responde 7 perguntas de sim/não, pode escrever uma observação e assina com o nome
-- completo. Qualquer "sim" gera um alerta: recomenda-se avaliação médica antes de treinar e avisar o professor. Vale por 12 meses.
-- É DADO DE SAÚDE (sensível): tabela privada sem política de leitura; só a própria pessoa, o responsável legal e quem tem a
-- permissão de ver saúde (gestor, instrutor com `view_health`) leem, por função, e cada consulta às respostas fica registrada.
-- Hoje o PAR-Q não bloqueia treino nem presença: ele informa. As perguntas são o texto de referência do PAR-Q padrão, em revisão
-- por profissional de saúde (docs/11).

create table public.parq_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  answered_by uuid not null references auth.users(id),
  answers boolean[] not null check (cardinality(answers) = 7),
  has_flag boolean not null,
  notes text check (notes is null or length(notes) <= 500),
  signed_name text not null check (length(btrim(signed_name)) between 5 and 120),
  term_version text not null check (length(term_version) between 3 and 40),
  created_at timestamptz not null default clock_timestamp() -- hora real do registro: duas respostas na mesma transação não empatam
);
create index parq_user_idx on public.parq_responses (user_id, created_at desc);
alter table public.parq_responses enable row level security; -- sem políticas: negar por padrão
revoke all on public.parq_responses from public, anon, authenticated;

create function public.parq_validity_days() returns int
language sql immutable set search_path = '' as $$ select 365; $$;

-- Responder: a própria pessoa (adulta) ou o responsável legal pelo menor. Cada resposta é um registro novo (o histórico fica).
create function public.submit_parq(p_user_id uuid, p_answers boolean[], p_notes text, p_signature text, p_version text default 'rascunho-2026-12') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_sig text := nullif(btrim(coalesce(p_signature, '')), '');
  v_id uuid;
  v_flag boolean;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not ((v_actor = p_user_id and public.is_adult(p_user_id)) or public.is_legal_guardian_of(p_user_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_answers is null or cardinality(p_answers) <> 7 or exists (select 1 from unnest(p_answers) a where a is null) then
    raise exception 'VALIDATION_ERROR: answers' using errcode = '22023';
  end if;
  if v_notes is not null and length(v_notes) > 500 then raise exception 'VALIDATION_ERROR: notes' using errcode = '22023'; end if;
  if not public.valid_signature(v_sig) then raise exception 'VALIDATION_ERROR: signature' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_version, ''))) not between 3 and 40 then raise exception 'VALIDATION_ERROR: version' using errcode = '22023'; end if;
  v_flag := true = any (p_answers);
  insert into public.parq_responses (user_id, answered_by, answers, has_flag, notes, signed_name, term_version)
    values (p_user_id, v_actor, p_answers, v_flag, v_notes, v_sig, btrim(p_version)) returning id into v_id;
  -- A trilha de auditoria guarda só o resultado (nunca as respostas nem a observação).
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (null, v_actor, 'parq.submit', 'parq_responses', v_id, jsonb_build_object('for_user', p_user_id, 'flag', v_flag));
  return v_id;
end;
$$;

-- A última resposta da pessoa (ou do menor, para o responsável).
create function public.my_parq(p_user_id uuid)
returns table (id uuid, created_at timestamptz, valid_until timestamptz, expired boolean, has_flag boolean, answers boolean[], notes text, signed_name text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (v_actor = p_user_id or public.is_legal_guardian_of(p_user_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select r.id, r.created_at, r.created_at + make_interval(days => public.parq_validity_days()),
           r.created_at + make_interval(days => public.parq_validity_days()) < now(), r.has_flag, r.answers, r.notes, r.signed_name
    from public.parq_responses r where r.user_id = p_user_id order by r.created_at desc limit 1;
end;
$$;

-- Quem tem a permissão de ver saúde vê, para cada membro aprovado, só a situação do PAR-Q (sem respostas): respondido, em atenção, vencido.
create function public.list_parq_status(p_academy_id uuid)
returns table (user_id uuid, person_name text, is_minor boolean, answered_at timestamptz, has_flag boolean, expired boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.can_view_health(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select m.user_id, p.display_name, not public.is_adult(m.user_id), l.created_at, l.has_flag,
           l.created_at is not null and l.created_at + make_interval(days => public.parq_validity_days()) < now()
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    left join lateral (select r.created_at, r.has_flag from public.parq_responses r where r.user_id = m.user_id order by r.created_at desc limit 1) l on true
    where m.academy_id = p_academy_id and m.status = 'approved' and m.role = 'student'
    order by p.display_name;
end;
$$;

-- As respostas de um aluno: só com a permissão de ver saúde e só de quem é membro da academia; cada consulta é registrada.
create function public.parq_detail(p_academy_id uuid, p_user_id uuid)
returns table (created_at timestamptz, has_flag boolean, answers boolean[], notes text, signed_name text, answered_by_guardian boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.can_view_health(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.memberships m where m.academy_id = p_academy_id and m.user_id = p_user_id and m.status = 'approved') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'parq.view', 'profiles', p_user_id, '{}'::jsonb);
  return query
    select r.created_at, r.has_flag, r.answers, r.notes, r.signed_name, r.answered_by <> r.user_id
    from public.parq_responses r where r.user_id = p_user_id order by r.created_at desc limit 1;
end;
$$;

revoke all on function public.parq_validity_days(), public.submit_parq(uuid, boolean[], text, text, text), public.my_parq(uuid),
  public.list_parq_status(uuid), public.parq_detail(uuid, uuid) from public, anon, authenticated;
grant execute on function public.submit_parq(uuid, boolean[], text, text, text), public.my_parq(uuid),
  public.list_parq_status(uuid), public.parq_detail(uuid, uuid) to authenticated;
