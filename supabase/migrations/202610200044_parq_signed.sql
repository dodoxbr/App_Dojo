-- PAR-Q com termo de responsabilidade de saúde e assinatura desenhada (pedido do dono do produto, 2026-10-22).
-- Fluxo: (1) 7 perguntas; qualquer "sim" avisa que será preciso apresentar atestado médico físico (e o gestor/professor marca quando
-- conferir); (2) termo de responsabilidade de saúde (lido até o fim + marcado); (3) assinatura desenhada na tela.
-- Prova do aceite: o servidor guarda a hora (do banco), a assinatura (PNG), o hash (SHA-256) do texto do termo, a versão, quem
-- respondeu (conta autenticada), e o IP e o navegador/aparelho informados pelo servidor do painel. São evidências de uma assinatura
-- eletrônica SIMPLES; não é assinatura ICP-Brasil (docs/features/PARQ.md). Validade do questionário: 12 meses.

alter table public.parq_responses
  drop constraint parq_responses_signed_name_check,
  add constraint parq_responses_signed_name_check check (length(btrim(signed_name)) between 2 and 160),
  add column signature_png bytea check (signature_png is null or (octet_length(signature_png) between 200 and 200000 and substring(signature_png from 1 for 4) = '\x89504e47'::bytea)),
  add column term_hash text check (term_hash is null or term_hash ~ '^[0-9a-f]{64}$'),
  add column client_ip text check (client_ip is null or length(client_ip) <= 64),
  add column user_agent text check (user_agent is null or length(user_agent) <= 300),
  add column certificate_checked_at timestamptz,
  add column certificate_checked_by uuid references auth.users(id);

-- A resposta assinada substitui a versão com nome digitado (042).
drop function public.submit_parq(uuid, boolean[], text, text, text);
create function public.submit_parq(
  p_user_id uuid, p_answers boolean[], p_notes text, p_signature_png bytea, p_term_hash text, p_client_ip text, p_user_agent text,
  p_version text default 'rascunho-2026-12') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_id uuid;
  v_flag boolean;
  v_name text;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not ((v_actor = p_user_id and public.is_adult(p_user_id)) or public.is_legal_guardian_of(p_user_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_answers is null or cardinality(p_answers) <> 7 or exists (select 1 from unnest(p_answers) a where a is null) then
    raise exception 'VALIDATION_ERROR: answers' using errcode = '22023';
  end if;
  if v_notes is not null and length(v_notes) > 500 then raise exception 'VALIDATION_ERROR: notes' using errcode = '22023'; end if;
  if p_signature_png is null or octet_length(p_signature_png) not between 200 and 200000 or substring(p_signature_png from 1 for 4) <> '\x89504e47'::bytea then
    raise exception 'VALIDATION_ERROR: signature' using errcode = '22023';
  end if;
  if p_term_hash is null or p_term_hash !~ '^[0-9a-f]{64}$' then raise exception 'VALIDATION_ERROR: term' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_version, ''))) not between 3 and 40 then raise exception 'VALIDATION_ERROR: version' using errcode = '22023'; end if;
  -- Quem assina é a conta autenticada; o nome gravado é o do perfil de quem assina (o responsável, no caso do menor).
  select display_name into v_name from public.profiles where id = v_actor;
  v_flag := true = any (p_answers);
  insert into public.parq_responses (user_id, answered_by, answers, has_flag, notes, signed_name, term_version, signature_png, term_hash, client_ip, user_agent)
    values (p_user_id, v_actor, p_answers, v_flag, v_notes, coalesce(v_name, 'Sem nome'), btrim(p_version), p_signature_png, p_term_hash,
            left(nullif(btrim(coalesce(p_client_ip, '')), ''), 64), left(nullif(btrim(coalesce(p_user_agent, '')), ''), 300))
    returning id into v_id;
  -- A trilha de auditoria guarda só o resultado (nunca as respostas, a observação nem a assinatura).
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (null, v_actor, 'parq.submit', 'parq_responses', v_id, jsonb_build_object('for_user', p_user_id, 'flag', v_flag));
  return v_id;
end;
$$;

-- my_parq passa a dizer se o atestado já foi conferido e devolve a assinatura para mostrar à própria pessoa.
drop function public.my_parq(uuid);
create function public.my_parq(p_user_id uuid)
returns table (id uuid, created_at timestamptz, valid_until timestamptz, expired boolean, has_flag boolean, answers boolean[], notes text,
               signed_name text, certificate_checked_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (v_actor = p_user_id or public.is_legal_guardian_of(p_user_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select r.id, r.created_at, r.created_at + make_interval(days => public.parq_validity_days()),
           r.created_at + make_interval(days => public.parq_validity_days()) < now(), r.has_flag, r.answers, r.notes, r.signed_name, r.certificate_checked_at
    from public.parq_responses r where r.user_id = p_user_id order by r.created_at desc limit 1;
end;
$$;

-- A situação por membro agora inclui se o atestado médico já foi conferido.
drop function public.list_parq_status(uuid);
create function public.list_parq_status(p_academy_id uuid)
returns table (user_id uuid, person_name text, is_minor boolean, answered_at timestamptz, has_flag boolean, expired boolean, certificate_checked boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.can_view_health(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select m.user_id, p.display_name, not public.is_adult(m.user_id), l.created_at, l.has_flag,
           l.created_at is not null and l.created_at + make_interval(days => public.parq_validity_days()) < now(),
           l.certificate_checked_at is not null
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    left join lateral (select r.created_at, r.has_flag, r.certificate_checked_at from public.parq_responses r where r.user_id = m.user_id order by r.created_at desc limit 1) l on true
    where m.academy_id = p_academy_id and m.status = 'approved' and m.role = 'student'
    order by p.display_name;
end;
$$;

-- O detalhe (respostas, observação, quando e como foi assinado); cada consulta é registrada.
drop function public.parq_detail(uuid, uuid);
create function public.parq_detail(p_academy_id uuid, p_user_id uuid)
returns table (created_at timestamptz, has_flag boolean, answers boolean[], notes text, signed_name text, answered_by_guardian boolean,
               term_version text, term_hash text, client_ip text, user_agent text, certificate_checked_at timestamptz)
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
    select r.created_at, r.has_flag, r.answers, r.notes, r.signed_name, r.answered_by <> r.user_id, r.term_version, r.term_hash, r.client_ip, r.user_agent, r.certificate_checked_at
    from public.parq_responses r where r.user_id = p_user_id order by r.created_at desc limit 1;
end;
$$;

-- O gestor ou o professor com permissão de ver saúde marca que conferiu o atestado médico físico (da última resposta com alerta).
create function public.mark_medical_certificate(p_academy_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.can_view_health(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.memberships m where m.academy_id = p_academy_id and m.user_id = p_user_id and m.status = 'approved') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select r.id into v_id from public.parq_responses r where r.user_id = p_user_id and r.has_flag order by r.created_at desc limit 1;
  if v_id is null then raise exception 'VALIDATION_ERROR: no flag' using errcode = '22023'; end if;
  update public.parq_responses set certificate_checked_at = now(), certificate_checked_by = v_actor where id = v_id and certificate_checked_at is null;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'parq.certificate', 'profiles', p_user_id, '{}'::jsonb);
end;
$$;

revoke all on function public.submit_parq(uuid, boolean[], text, bytea, text, text, text, text), public.my_parq(uuid), public.list_parq_status(uuid),
  public.parq_detail(uuid, uuid), public.mark_medical_certificate(uuid, uuid) from public, anon, authenticated;
grant execute on function public.submit_parq(uuid, boolean[], text, bytea, text, text, text, text), public.my_parq(uuid), public.list_parq_status(uuid),
  public.parq_detail(uuid, uuid), public.mark_medical_certificate(uuid, uuid) to authenticated;
