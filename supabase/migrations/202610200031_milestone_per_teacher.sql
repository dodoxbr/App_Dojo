-- US-020 (ajuste): cada professor decide o seu número de treinos (pedido do dono do produto, 2026-10-21: "cada prof e acad tem seus jeitos").
-- Regras: o padrão continua 30 (milestone_threshold()). Cada gestor ou instrutor com permissão de graduação pode definir o próprio número
-- (1 a 1000) ou desligar o aviso. O número vale para os alunos que ele acompanha: o gestor acompanha todos os alunos da academia; o instrutor,
-- os que tiveram presença validada em turma dele desde a última graduação. O aluno (e o responsável) recebem o aviso quando alguém dos
-- professores das turmas em que ele treinou desde a última graduação tem o aviso ligado e o número foi atingido.
-- Só presença validada e não revogada conta (regra 8). O super admin não vê nada disso.
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, 22023 VALIDATION_ERROR, P0002 NOT_FOUND.

create table public.milestone_settings (
  academy_id uuid not null references public.academies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  threshold int not null check (threshold between 1 and 1000),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (academy_id, user_id)
);
alter table public.milestone_settings enable row level security;
-- Sem políticas e sem grants: lido e gravado só pelas operações abaixo.

-- O número de quem acompanha (null = aviso desligado). Interna.
create function public.teacher_threshold(p_academy_id uuid, p_user_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select case when coalesce(s.enabled, true) then coalesce(s.threshold, public.milestone_threshold()) end
  from (select 1) x
  left join public.milestone_settings s on s.academy_id = p_academy_id and s.user_id = p_user_id;
$$;

-- Os professores das turmas em que o aluno teve presença validada depois da graduação atual. Interna.
create function public.teachers_since_rank(p_academy_id uuid, p_student_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct c.instructor_user_id
  from public.attendances a
  join public.sessions s on s.id = a.session_id
  join public.classes c on c.id = s.class_id
  join public.academies ac on ac.id = a.academy_id
  where a.academy_id = p_academy_id and a.user_id = p_student_id and a.status = 'validated' and c.instructor_user_id is not null
    and (s.starts_at at time zone ac.timezone)::date > coalesce(
      (select r.effective_date from public.current_ranks r where r.academy_id = p_academy_id and r.user_id = p_student_id), date '0001-01-01');
$$;

-- O aluno chegou ao número de algum dos professores dele? (aviso do aluno e do responsável). Interna.
create function public.student_at_milestone(p_academy_id uuid, p_student_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.teachers_since_rank(p_academy_id, p_student_id) t(uid)
    where public.teacher_threshold(p_academy_id, t.uid) is not null
      and public.attendances_since_rank(p_academy_id, p_student_id) >= public.teacher_threshold(p_academy_id, t.uid));
$$;

-- Este professor acompanha este aluno e o número dele foi atingido? O gestor acompanha todos; o instrutor, os das turmas dele. Interna.
create function public.staff_sees_milestone(p_academy_id uuid, p_staff_id uuid, p_student_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.teacher_threshold(p_academy_id, p_staff_id) is not null
    and public.attendances_since_rank(p_academy_id, p_student_id) >= public.teacher_threshold(p_academy_id, p_staff_id)
    and (exists (select 1 from public.memberships m where m.academy_id = p_academy_id and m.user_id = p_staff_id and m.role = 'manager' and m.status = 'approved')
         or exists (select 1 from public.teachers_since_rank(p_academy_id, p_student_id) t(uid) where t.uid = p_staff_id));
$$;

-- Meus avisos (aluno).
create or replace function public.my_milestones()
returns table (academy_id uuid, academy_name text, attendances int, belt_code text, degree int, rank_since date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  return query
    select a.id, a.name, public.attendances_since_rank(m.academy_id, m.user_id), r.belt_code, r.degree, r.effective_date
    from public.memberships m
    join public.academies a on a.id = m.academy_id
    left join public.current_ranks r on r.academy_id = m.academy_id and r.user_id = m.user_id
    where m.user_id = (select auth.uid()) and m.status = 'approved' and m.role = 'student' and public.student_at_milestone(m.academy_id, m.user_id)
    order by a.name;
end;
$$;

-- Aviso do filho, para o responsável legal (consentimento verificado e ativo).
create or replace function public.dependent_milestones(p_minor_id uuid)
returns table (academy_id uuid, academy_name text, attendances int, belt_code text, degree int, rank_since date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_legal_guardian_of(p_minor_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select a.id, a.name, public.attendances_since_rank(c.academy_id, c.minor_user_id), r.belt_code, r.degree, r.effective_date
    from public.guardian_consents c
    join public.academies a on a.id = c.academy_id
    join public.memberships m on m.academy_id = c.academy_id and m.user_id = c.minor_user_id and m.status = 'approved'
    left join public.current_ranks r on r.academy_id = c.academy_id and r.user_id = c.minor_user_id
    where c.minor_user_id = p_minor_id and c.status = 'verified' and c.revoked_at is null and public.student_at_milestone(c.academy_id, c.minor_user_id)
    order by a.name;
end;
$$;

create or replace function public.my_staff_milestones() returns table (academy_id uuid, academy_name text, students int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  return query
    select a.id, a.name, (select count(*)::int from public.memberships s
                           where s.academy_id = a.id and s.status = 'approved' and s.role = 'student'
                             and public.staff_sees_milestone(a.id, (select auth.uid()), s.user_id))
    from public.academies a
    where public.can_follow_milestones(a.id)
    order by a.name;
end;
$$;

create or replace function public.list_milestone_students(p_academy_id uuid)
returns table (user_id uuid, person_name text, is_minor boolean, belt_code text, degree int, rank_since date, attendances int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.can_follow_milestones(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select m.user_id, p.display_name, not public.is_adult(m.user_id), r.belt_code, r.degree, r.effective_date,
           public.attendances_since_rank(m.academy_id, m.user_id)
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    left join public.current_ranks r on r.academy_id = m.academy_id and r.user_id = m.user_id
    where m.academy_id = p_academy_id and m.status = 'approved' and m.role = 'student'
      and public.staff_sees_milestone(m.academy_id, (select auth.uid()), m.user_id)
    order by 7 desc, p.display_name;
end;
$$;

-- O perfil: "threshold" agora é o número de quem consulta.
create or replace function public.student_milestone_summary(p_academy_id uuid, p_user_id uuid)
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
           public.attendances_since_rank(p_academy_id, p_user_id), public.teacher_threshold(p_academy_id, v_actor), v_health, v_notes
    from public.profiles p
    left join public.current_ranks r on r.academy_id = p_academy_id and r.user_id = p_user_id
    where p.id = p_user_id;
end;
$$;

-- Minha configuração (gestor ou instrutor com permissão de graduação). threshold null = aviso desligado... aqui: enabled false.
create function public.get_my_milestone_setting(p_academy_id uuid) returns table (threshold int, enabled boolean, is_default boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.can_follow_milestones(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select coalesce(s.threshold, public.milestone_threshold()), coalesce(s.enabled, true), s.user_id is null
    from (select 1) x left join public.milestone_settings s on s.academy_id = p_academy_id and s.user_id = (select auth.uid());
end;
$$;

create function public.set_my_milestone_setting(p_academy_id uuid, p_threshold int, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.can_follow_milestones(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_threshold is null or p_threshold not between 1 and 1000 or p_enabled is null then raise exception 'VALIDATION_ERROR: threshold' using errcode = '22023'; end if;
  insert into public.milestone_settings (academy_id, user_id, threshold, enabled) values (p_academy_id, v_actor, p_threshold, p_enabled)
    on conflict (academy_id, user_id) do update set threshold = excluded.threshold, enabled = excluded.enabled, updated_at = now();
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'milestone.setting', 'milestone_settings', null, jsonb_build_object('threshold', p_threshold, 'enabled', p_enabled));
end;
$$;

revoke all on function public.teacher_threshold(uuid, uuid), public.teachers_since_rank(uuid, uuid), public.student_at_milestone(uuid, uuid),
  public.staff_sees_milestone(uuid, uuid, uuid), public.my_milestones(), public.dependent_milestones(uuid), public.my_staff_milestones(),
  public.list_milestone_students(uuid), public.student_milestone_summary(uuid, uuid), public.get_my_milestone_setting(uuid),
  public.set_my_milestone_setting(uuid, int, boolean) from public, anon, authenticated;
grant execute on function public.my_milestones(), public.dependent_milestones(uuid), public.my_staff_milestones(),
  public.list_milestone_students(uuid), public.student_milestone_summary(uuid, uuid), public.get_my_milestone_setting(uuid),
  public.set_my_milestone_setting(uuid, int, boolean) to authenticated;
