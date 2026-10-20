-- US-012: pilot indicators and attendance dashboard (docs/01). No numeric goals: measurement only.
-- Privacy: technique views are stored as COUNTERS (day, academy, technique) and never identify who looked.
-- Indicators derived from private data (diary, technique views) are shown only for academies with enough members,
-- so that an aggregate cannot expose one person. The diary content is never read, only whether an entry exists.
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, P0002 NOT_FOUND, 22023 VALIDATION_ERROR.

-- Premise to validate with the academy (docs/11): minimum approved members for private-data aggregates.
create function public.min_group_size() returns int
language sql immutable set search_path = '' as $$ select 5 $$;

create table public.technique_views (
  day date not null,
  academy_id uuid not null references public.academies(id),
  technique_id uuid not null references public.techniques(id),
  views int not null default 0 check (views >= 0),
  primary key (day, academy_id, technique_id)
);
alter table public.technique_views enable row level security; -- no policies, no grants: written/read only by the functions below

-- Counts one view for each academy where the caller is an approved member and the technique is usable.
-- Stores no user, no time of day, no search text.
create function public.record_technique_view(p_technique_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  insert into public.technique_views (day, academy_id, technique_id, views)
    select (now() at time zone a.timezone)::date, a.id, p_technique_id, 1
    from public.memberships m
    join public.academies a on a.id = m.academy_id
    where m.user_id = v_actor and m.status = 'approved'
      and exists (select 1 from public.techniques t
                  where t.id = p_technique_id and (t.academy_id is null or t.academy_id = m.academy_id))
    on conflict (day, academy_id, technique_id) do update set views = public.technique_views.views + 1;
end;
$$;

create function public.academy_dashboard(p_academy_id uuid, p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
  v_since timestamptz;
  v_since_day date;
  v_k int := public.min_group_size();
  v_students int;
  v_enough boolean;
  v_activation jsonb;
  v_attendance jsonb;
  v_by_class jsonb;
  v_median numeric;
  v_retention jsonb;
  v_diary jsonb := null;
  v_techniques jsonb := null;
  v_week0 date;
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.has_academy_permission(p_academy_id, 'view_progress') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_days is null or p_days not between 7 and 365 then raise exception 'VALIDATION_ERROR: days' using errcode = '22023'; end if;
  select timezone into v_tz from public.academies where id = p_academy_id;
  if v_tz is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  v_since := now() - make_interval(days => p_days);
  v_since_day := (v_since at time zone v_tz)::date;
  select count(*)::int into v_students from public.memberships where academy_id = p_academy_id and status = 'approved' and role = 'student';
  v_enough := v_students >= v_k;

  -- Activation: where the people who asked (or were added) stand.
  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) into v_activation
    from (select status::text, count(*)::int as n from public.memberships
          where academy_id = p_academy_id and role in ('student', 'instructor') group by status) s;

  -- Attendance: only VALIDATED (and never revoked) counts as presence.
  select jsonb_build_object(
      'sessions_held', count(distinct s.id) filter (where s.status = 'scheduled' and s.ends_at < now()),
      'sessions_cancelled', count(distinct s.id) filter (where s.status = 'cancelled'),
      'validated', count(a.id) filter (where a.status = 'validated'),
      'pending', count(a.id) filter (where a.status = 'pending'),
      'revoked', count(a.id) filter (where a.status = 'revoked'))
    into v_attendance
    from public.sessions s left join public.attendances a on a.session_id = s.id
    where s.academy_id = p_academy_id and s.starts_at >= v_since and s.starts_at <= now();
  v_attendance := v_attendance || jsonb_build_object('avg_validated_per_session',
    case when (v_attendance ->> 'sessions_held')::int > 0
         then round((v_attendance ->> 'validated')::numeric / (v_attendance ->> 'sessions_held')::numeric, 1) end);

  select coalesce(jsonb_agg(jsonb_build_object('class_id', c.id, 'title', c.title, 'sessions_held', x.held, 'validated', x.validated,
           'avg_validated_per_session', case when x.held > 0 then round(x.validated::numeric / x.held, 1) end) order by c.title), '[]'::jsonb)
    into v_by_class
    from public.classes c
    left join lateral (
      select count(distinct s.id) filter (where s.status = 'scheduled' and s.ends_at < now())::int as held,
             count(a.id) filter (where a.status = 'validated')::int as validated
      from public.sessions s left join public.attendances a on a.session_id = s.id
      where s.class_id = c.id and s.starts_at >= v_since and s.starts_at <= now()) x on true
    where c.academy_id = p_academy_id;

  -- Time between the student's request and the teacher's confirmation (manual and QR requests only).
  select percentile_cont(0.5) within group (order by extract(epoch from (a.validated_at - a.requested_at)) / 60.0)
    into v_median
    from public.attendances a join public.sessions s on s.id = a.session_id
    where a.academy_id = p_academy_id and a.status = 'validated' and a.source in ('manual', 'qr') and s.starts_at >= v_since;
  v_attendance := v_attendance || jsonb_build_object('median_minutes_to_validate', case when v_median is not null then round(v_median, 1) end);

  -- Weekly retention over the last complete weeks: of those with a validated attendance in week W, how many were back in W+1.
  v_week0 := date_trunc('week', now() at time zone v_tz)::date;
  with act as (
    select distinct a.user_id, date_trunc('week', s.starts_at at time zone v_tz)::date as wk
    from public.attendances a join public.sessions s on s.id = a.session_id
    where a.academy_id = p_academy_id and a.status = 'validated' and s.starts_at >= now() - interval '70 days'
  ), weeks as (
    select (v_week0 - n)::date as wk from generate_series(14, 56, 7) as n
  )
  select coalesce(jsonb_agg(jsonb_build_object('week_start', w.wk,
           'active', (select count(*) from act where act.wk = w.wk),
           'retained_next_week', (select count(*) from act a1 where a1.wk = w.wk
                                  and exists (select 1 from act a2 where a2.user_id = a1.user_id and a2.wk = w.wk + 7))) order by w.wk), '[]'::jsonb)
    into v_retention from weeks w;

  -- Aggregates from private data: only when the academy is large enough.
  if v_enough then
    v_diary := (select jsonb_build_object('students', v_students,
        'with_entry_last_7_days', count(distinct tl.user_id),
        'percent', round(100.0 * count(distinct tl.user_id) / v_students, 1))
      from public.training_logs tl
      where tl.created_at >= now() - interval '7 days'
        and tl.user_id in (select user_id from public.memberships where academy_id = p_academy_id and status = 'approved' and role = 'student'));
    v_techniques := (select jsonb_build_object('total_views', coalesce(sum(n), 0),
        'top', coalesce(jsonb_agg(jsonb_build_object('technique_id', id, 'name', name, 'category', category, 'views', n) order by n desc, name), '[]'::jsonb))
      from (select t.id, t.name, t.category, sum(v.views)::int as n
            from public.technique_views v join public.techniques t on t.id = v.technique_id
            where v.academy_id = p_academy_id and v.day >= v_since_day
            group by t.id, t.name, t.category order by sum(v.views) desc, t.name limit 10) top);
  end if;

  return jsonb_build_object(
    'period_days', p_days, 'since', v_since, 'generated_at', now(),
    'privacy', jsonb_build_object('min_group_size', v_k, 'enough_members', v_enough, 'students', v_students),
    'activation', v_activation, 'attendance', v_attendance, 'by_class', v_by_class,
    'retention', v_retention, 'diary', v_diary, 'techniques', v_techniques);
end;
$$;

-- Members whose current rank + the academy's rule currently say "eligible". A recommendation list, never a promotion.
create function public.eligible_students(p_academy_id uuid)
returns table (user_id uuid, belt_code text, degree int, rule_version int)
language plpgsql stable security definer set search_path = '' as $$
declare
  r record;
  v jsonb;
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.has_academy_permission(p_academy_id, 'view_progress')
          or public.has_academy_permission(p_academy_id, 'recommend_graduation')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  for r in
    select cr.user_id as uid, cr.belt_code as belt, cr.degree as deg
    from public.current_ranks cr
    join public.memberships m on m.academy_id = cr.academy_id and m.user_id = cr.user_id and m.status = 'approved' and m.role = 'student'
    where cr.academy_id = p_academy_id
  loop
    v := public.evaluate_promotion(p_academy_id, r.uid);
    if coalesce((v ->> 'eligible')::boolean, false) then
      user_id := r.uid; belt_code := r.belt; degree := r.deg; rule_version := (v -> 'rule' ->> 'version')::int;
      return next;
    end if;
  end loop;
end;
$$;

revoke all on function public.min_group_size(), public.record_technique_view(uuid),
  public.academy_dashboard(uuid, int), public.eligible_students(uuid) from public, anon, authenticated;
grant execute on function public.record_technique_view(uuid), public.academy_dashboard(uuid, int),
  public.eligible_students(uuid) to authenticated;
