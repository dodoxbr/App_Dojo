-- US-020: aviso de marco de treinos. Pedido do professor (2026-10-20): quando o aluno chega a 30 treinos desde a última graduação, o aluno
-- recebe um aviso e o professor vê quem é, a faixa e o resto do perfil. Decisões do dono do produto: contagem desde a última graduação;
-- aviso DENTRO do app (sem push, e-mail nem WhatsApp por enquanto); veem o gestor e os instrutores com a permissão de recomendar graduação.
-- Só conta presença VALIDADA e não revogada (regra 8). O aviso não muda a graduação oficial (regra 7): é só um lembrete para o professor avaliar.
-- Nada é gravado: o marco é calculado na hora (some sozinho quando o gestor registra a nova graduação). O super admin não vê.
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, P0002 NOT_FOUND.

create function public.milestone_threshold() returns int
language sql immutable set search_path = '' as $$ select 30; $$;

-- Gestor, ou instrutor aprovado com a permissão de recomendar graduação. NÃO o super admin.
create function public.can_follow_milestones(p_academy_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_academy_manager(p_academy_id) or exists (
    select 1 from public.memberships m
    join public.academy_role_permissions p on p.academy_id = m.academy_id and p.role = m.role
    where m.academy_id = p_academy_id and m.user_id = (select auth.uid())
      and m.role = 'instructor' and m.status = 'approved' and p.permission = 'recommend_graduation');
$$;

-- Presenças validadas e não revogadas depois do dia da graduação atual (sem graduação registrada: desde o começo). Interna.
create function public.attendances_since_rank(p_academy_id uuid, p_user_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int
  from public.attendances a
  join public.sessions s on s.id = a.session_id
  join public.academies ac on ac.id = a.academy_id
  where a.academy_id = p_academy_id and a.user_id = p_user_id and a.status = 'validated'
    and (s.starts_at at time zone ac.timezone)::date > coalesce(
      (select r.effective_date from public.current_ranks r where r.academy_id = p_academy_id and r.user_id = p_user_id), date '0001-01-01');
$$;

-- Meus avisos: as academias onde eu (aluno) cheguei ao marco.
create function public.my_milestones()
returns table (academy_id uuid, academy_name text, attendances int, belt_code text, degree int, rank_since date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  return query
    select a.id, a.name, n.c, r.belt_code, r.degree, r.effective_date
    from public.memberships m
    join public.academies a on a.id = m.academy_id
    cross join lateral (select public.attendances_since_rank(m.academy_id, m.user_id) as c) n
    left join public.current_ranks r on r.academy_id = m.academy_id and r.user_id = m.user_id
    where m.user_id = (select auth.uid()) and m.status = 'approved' and m.role = 'student' and n.c >= public.milestone_threshold()
    order by a.name;
end;
$$;

-- O responsável legal vê o aviso do filho (academias com consentimento verificado e ativo).
create function public.dependent_milestones(p_minor_id uuid)
returns table (academy_id uuid, academy_name text, attendances int, belt_code text, degree int, rank_since date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_legal_guardian_of(p_minor_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select a.id, a.name, n.c, r.belt_code, r.degree, r.effective_date
    from public.guardian_consents c
    join public.academies a on a.id = c.academy_id
    join public.memberships m on m.academy_id = c.academy_id and m.user_id = c.minor_user_id and m.status = 'approved'
    cross join lateral (select public.attendances_since_rank(c.academy_id, c.minor_user_id) as c) n
    left join public.current_ranks r on r.academy_id = c.academy_id and r.user_id = c.minor_user_id
    where c.minor_user_id = p_minor_id and c.status = 'verified' and c.revoked_at is null and n.c >= public.milestone_threshold()
    order by a.name;
end;
$$;

-- Do lado da academia: quantos alunos estão no marco, em cada academia que eu acompanho.
create function public.my_staff_milestones() returns table (academy_id uuid, academy_name text, students int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  return query
    select a.id, a.name, (select count(*)::int from public.memberships s
                           where s.academy_id = a.id and s.status = 'approved' and s.role = 'student'
                             and public.attendances_since_rank(a.id, s.user_id) >= public.milestone_threshold())
    from public.academies a
    where public.can_follow_milestones(a.id)
    order by a.name;
end;
$$;

-- A lista de quem chegou ao marco (gestor ou instrutor com permissão de graduação).
create function public.list_milestone_students(p_academy_id uuid)
returns table (user_id uuid, person_name text, is_minor boolean, belt_code text, degree int, rank_since date, attendances int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.can_follow_milestones(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select m.user_id, p.display_name, not public.is_adult(m.user_id), r.belt_code, r.degree, r.effective_date, n.c
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    cross join lateral (select public.attendances_since_rank(m.academy_id, m.user_id) as c) n
    left join public.current_ranks r on r.academy_id = m.academy_id and r.user_id = m.user_id
    where m.academy_id = p_academy_id and m.status = 'approved' and m.role = 'student' and n.c >= public.milestone_threshold()
    order by n.c desc, p.display_name;
end;
$$;

-- O perfil do aluno para o professor: quem é, faixa e grau, presenças desde a última graduação e, SÓ com a permissão de ver saúde,
-- as observações de saúde (leitura auditada, como nas demais telas de saúde; a auditoria nunca guarda o texto).
create function public.student_milestone_summary(p_academy_id uuid, p_user_id uuid)
returns table (person_name text, is_minor boolean, belt_code text, degree int, rank_since date, attendances int, threshold int,
               health_visible boolean, health_notes text)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_health boolean;
  v_notes text;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.can_follow_milestones(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.memberships m where m.academy_id = p_academy_id and m.user_id = p_user_id and m.status = 'approved' and m.role = 'student') then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  v_health := public.can_view_health(p_academy_id);
  if v_health then
    select c.health_notes into v_notes from public.profile_contacts c where c.user_id = p_user_id and c.health_notes is not null;
    if v_notes is not null then
      insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
        values (p_academy_id, v_actor, 'health.view', 'profile_contacts', p_user_id, jsonb_build_object('scope', 'person'));
    end if;
  end if;
  return query
    select p.display_name, not public.is_adult(p_user_id), r.belt_code, r.degree, r.effective_date,
           public.attendances_since_rank(p_academy_id, p_user_id), public.milestone_threshold(), v_health, v_notes
    from public.profiles p
    left join public.current_ranks r on r.academy_id = p_academy_id and r.user_id = p_user_id
    where p.id = p_user_id;
end;
$$;

revoke all on function public.milestone_threshold(), public.can_follow_milestones(uuid), public.attendances_since_rank(uuid, uuid),
  public.my_milestones(), public.dependent_milestones(uuid), public.my_staff_milestones(), public.list_milestone_students(uuid),
  public.student_milestone_summary(uuid, uuid) from public, anon, authenticated;
grant execute on function public.my_milestones(), public.dependent_milestones(uuid), public.my_staff_milestones(),
  public.list_milestone_students(uuid), public.student_milestone_summary(uuid, uuid) to authenticated;
