-- PAR-Q obrigatório por academia (pedido do dono do produto, 2026-10-22): "vencido tem que bloquear; na minha academia bloqueia; aí eu
-- respondo de novo e volta a liberar". Cada academia liga ou desliga (padrão: desligado). Ligado, quem não tem um PAR-Q válido
-- (nunca respondeu ou passou de 12 meses) NÃO consegue pedir check-in nas aulas dela; ao responder de novo, libera na hora.
-- O bloqueio é do pedido de presença do próprio aluno; o professor continua podendo validar presença (decisão dele) e o PAR-Q
-- com "sim" segue exigindo atestado (informativo). Regra legal do DF ainda não confirmada (docs/11).

alter table public.academies add column parq_required boolean not null default false;

create function public.set_parq_required(p_academy_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_old boolean;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select parq_required into v_old from public.academies where id = p_academy_id;
  if not found then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_old = coalesce(p_on, false) then return; end if;
  update public.academies set parq_required = coalesce(p_on, false) where id = p_academy_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'academy.parq_required', 'academies', p_academy_id, jsonb_build_object('from', v_old, 'to', coalesce(p_on, false)));
end;
$$;

-- O motivo do bloqueio de uma pessoa numa academia: null = liberado; 'missing' = nunca respondeu; 'expired' = vencido.
create function public.parq_block_reason(p_academy_id uuid, p_user_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_required boolean;
  v_last timestamptz;
begin
  select parq_required into v_required from public.academies where id = p_academy_id;
  if not coalesce(v_required, false) then return null; end if;
  select max(r.created_at) into v_last from public.parq_responses r where r.user_id = p_user_id;
  if v_last is null then return 'missing'; end if;
  if v_last + make_interval(days => public.parq_validity_days()) < now() then return 'expired'; end if;
  return null;
end;
$$;

-- O que bloqueia a pessoa logada (para os avisos das telas): uma linha por academia em que ela é aluna aprovada e está bloqueada.
create function public.my_parq_blocks()
returns table (academy_id uuid, academy_name text, reason text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  return query
    select m.academy_id, a.name, public.parq_block_reason(m.academy_id, v_actor)
    from public.memberships m join public.academies a on a.id = m.academy_id
    where m.user_id = v_actor and m.status = 'approved' and m.role = 'student'
      and public.parq_block_reason(m.academy_id, v_actor) is not null
    order by a.name;
end;
$$;

-- O pedido de check-in passa a conferir o PAR-Q (só muda o pedido do próprio aluno; a definição atual da função é reaproveitada).
do $$
declare
  v_def text;
  v_marker text := 'if v_s.status <> ''scheduled'' then raise exception ''VALIDATION_ERROR: session cancelled'' using errcode = ''22023''; end if;';
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'request_check_in';
  if v_def is null or position(v_marker in v_def) = 0 then raise exception 'request_check_in nao encontrada'; end if;
  execute replace(v_def, v_marker, v_marker || E'\n  if public.parq_block_reason(v_s.academy_id, v_actor) is not null then raise exception ''VALIDATION_ERROR: parq required'' using errcode = ''22023''; end if;');
end;
$$;

revoke all on function public.set_parq_required(uuid, boolean), public.parq_block_reason(uuid, uuid), public.my_parq_blocks() from public, anon, authenticated;
grant execute on function public.set_parq_required(uuid, boolean), public.my_parq_blocks() to authenticated;
