-- US-014: challenges between members of an academy ("Gymrats"-style). See docs/features/F2-desafios.md.
-- Principles: opt-in; adults only; the diary is never read; points are defined by the creator (no defaults);
-- self-reported entries count right away and are flagged "verified" when they fall inside a lesson the person
-- attended with a VALIDATED attendance. Writes only through the operations below.
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, P0002 NOT_FOUND, 23505 CONFLICT, 22023 VALIDATION_ERROR.

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  created_by uuid not null references auth.users(id),
  title text not null check (length(btrim(title)) between 2 and 120),
  description text check (description is null or length(description) <= 1000),
  -- attendance: automatic, from validated attendance | training: the person reports day and time | technique_reps: reps of one technique
  metric text not null check (metric in ('attendance', 'training', 'technique_reps')),
  points_per_unit int not null check (points_per_unit between 1 and 1000),
  technique_id uuid references public.techniques(id),
  max_units_per_day int check (max_units_per_day is null or max_units_per_day between 1 and 10000),
  starts_on date not null,
  ends_on date not null,
  min_participants int not null check (min_participants between 3 and 50),
  activated_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text check (cancelled_reason is null or length(cancelled_reason) <= 500),
  created_at timestamptz not null default now(),
  unique (id, academy_id),
  constraint challenges_dates_chk check (ends_on >= starts_on and ends_on <= starts_on + 366),
  constraint challenges_technique_chk check ((metric = 'technique_reps') = (technique_id is not null))
);
create index challenges_academy_idx on public.challenges (academy_id, ends_on desc);

create table public.challenge_participants (
  challenge_id uuid not null,
  academy_id uuid not null,
  user_id uuid not null references auth.users(id),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (challenge_id, user_id),
  constraint challenge_participants_fk foreign key (challenge_id, academy_id) references public.challenges (id, academy_id) on delete cascade
);
create index challenge_participants_user_idx on public.challenge_participants (user_id);

create table public.challenge_entries (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  challenge_id uuid not null,
  user_id uuid not null references auth.users(id),
  occurred_at timestamptz not null,
  units int not null check (units between 1 and 10000),
  note text check (note is null or length(note) <= 200),
  client_key uuid,
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint challenge_entries_fk foreign key (challenge_id, academy_id) references public.challenges (id, academy_id) on delete cascade
);
create unique index challenge_entries_client_key_idx on public.challenge_entries (user_id, client_key) where client_key is not null;
create index challenge_entries_idx on public.challenge_entries (challenge_id, user_id, occurred_at);

alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.challenge_entries enable row level security;

-- Members read the challenges of their academy; a person reads only their own participation and entries.
create policy challenges_read on public.challenges for select to authenticated
  using (public.is_platform_admin() or public.is_academy_member(academy_id));
create policy challenge_participants_self_read on public.challenge_participants for select to authenticated
  using (user_id = (select auth.uid()));
create policy challenge_entries_self_read on public.challenge_entries for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.challenges, public.challenge_participants, public.challenge_entries to authenticated;

-- Helpers (not callable by clients) ---------------------------------------------------------------------------

create function public.challenge_state(p_challenge_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when c.cancelled_at is not null then 'cancelled'
    when (now() at time zone a.timezone)::date > c.ends_on then case when c.activated_at is not null then 'finished' else 'expired' end
    when c.activated_at is null then 'open'
    when (now() at time zone a.timezone)::date < c.starts_on then 'scheduled'
    else 'active' end
  from public.challenges c join public.academies a on a.id = c.academy_id
  where c.id = p_challenge_id;
$$;

-- An entry is "verified" when it falls inside a lesson (+/- 1 hour) of the same person with a VALIDATED attendance.
create function public.entry_is_verified(p_user_id uuid, p_academy_id uuid, p_occurred_at timestamptz) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.attendances a join public.sessions s on s.id = a.session_id
    where a.user_id = p_user_id and a.academy_id = p_academy_id and a.status = 'validated'
      and p_occurred_at between s.starts_at - interval '1 hour' and s.ends_at + interval '1 hour');
$$;

-- Operations ---------------------------------------------------------------------------------------------------

create function public.create_challenge(
  p_academy_id uuid, p_title text, p_description text, p_metric text, p_points_per_unit int, p_technique_id uuid,
  p_max_units_per_day int, p_starts_on date, p_ends_on date, p_min_participants int, p_join boolean, p_idempotency_key uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_tz text;
  v_today date;
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_academy_member(p_academy_id) or public.is_platform_admin()) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not public.is_adult(v_actor) then raise exception 'VALIDATION_ERROR: adult required' using errcode = '22023'; end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;
  select entity_id into v_id from public.audit_events
    where actor_user_id = v_actor and action = 'challenge.create' and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;

  select timezone into v_tz from public.academies where id = p_academy_id;
  if v_tz is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  v_today := (now() at time zone v_tz)::date;

  if length(v_title) not between 2 and 120 then raise exception 'VALIDATION_ERROR: title' using errcode = '22023'; end if;
  if v_description is not null and length(v_description) > 1000 then raise exception 'VALIDATION_ERROR: description' using errcode = '22023'; end if;
  if p_metric is null or p_metric not in ('attendance', 'training', 'technique_reps') then raise exception 'VALIDATION_ERROR: metric' using errcode = '22023'; end if;
  if p_points_per_unit is null or p_points_per_unit not between 1 and 1000 then raise exception 'VALIDATION_ERROR: points' using errcode = '22023'; end if;
  if (p_metric = 'technique_reps') <> (p_technique_id is not null) then raise exception 'VALIDATION_ERROR: technique' using errcode = '22023'; end if;
  if p_technique_id is not null and not exists (
      select 1 from public.techniques t where t.id = p_technique_id and (t.academy_id is null or t.academy_id = p_academy_id)) then
    raise exception 'VALIDATION_ERROR: technique' using errcode = '22023';
  end if;
  if p_metric = 'attendance' and p_max_units_per_day is not null then raise exception 'VALIDATION_ERROR: cap' using errcode = '22023'; end if;
  if p_max_units_per_day is not null and p_max_units_per_day not between 1 and 10000 then raise exception 'VALIDATION_ERROR: cap' using errcode = '22023'; end if;
  if p_min_participants is null or p_min_participants not between 3 and 50 then raise exception 'VALIDATION_ERROR: min_participants' using errcode = '22023'; end if;
  if p_starts_on is null or p_ends_on is null or p_starts_on < v_today or p_ends_on < p_starts_on or p_ends_on > p_starts_on + 366 then
    raise exception 'VALIDATION_ERROR: dates' using errcode = '22023';
  end if;
  -- Premise (docs/11): at most 3 unfinished challenges per creator, to avoid flooding the academy.
  if (select count(*) from public.challenges c
      where c.created_by = v_actor and c.academy_id = p_academy_id and c.cancelled_at is null and c.ends_on >= v_today) >= 3 then
    raise exception 'VALIDATION_ERROR: too many open challenges' using errcode = '22023';
  end if;

  insert into public.challenges (academy_id, created_by, title, description, metric, points_per_unit, technique_id,
                                 max_units_per_day, starts_on, ends_on, min_participants)
    values (p_academy_id, v_actor, v_title, v_description, p_metric, p_points_per_unit, p_technique_id,
            p_max_units_per_day, p_starts_on, p_ends_on, p_min_participants) returning id into v_id;
  if coalesce(p_join, true) and public.is_academy_member(p_academy_id) then
    insert into public.challenge_participants (challenge_id, academy_id, user_id) values (v_id, p_academy_id, v_actor);
  end if;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (p_academy_id, v_actor, 'challenge.create', 'challenges', v_id,
      jsonb_build_object('title', v_title, 'metric', p_metric, 'min_participants', p_min_participants), p_idempotency_key);
  return v_id;
end;
$$;

-- Opt-in. Reaching the minimum activates the challenge: it starts right away (docs/features/F2-desafios.md).
create function public.join_challenge(p_challenge_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.challenges%rowtype;
  v_state text;
  v_count int;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_c from public.challenges where id = p_challenge_id;
  if not found or not public.is_academy_member(v_c.academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not public.is_adult(v_actor) then raise exception 'VALIDATION_ERROR: adult required' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_challenge_id::text, 0));
  v_state := public.challenge_state(p_challenge_id);
  if v_state in ('cancelled', 'finished', 'expired') then raise exception 'VALIDATION_ERROR: challenge closed' using errcode = '22023'; end if;

  insert into public.challenge_participants (challenge_id, academy_id, user_id) values (p_challenge_id, v_c.academy_id, v_actor)
    on conflict (challenge_id, user_id) do update set left_at = null, joined_at = case when public.challenge_participants.left_at is null then public.challenge_participants.joined_at else now() end;

  select count(*) into v_count from public.challenge_participants where challenge_id = p_challenge_id and left_at is null;
  if v_c.activated_at is null and v_count >= v_c.min_participants then
    update public.challenges set activated_at = now() where id = p_challenge_id;
    insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
      values (v_c.academy_id, v_actor, 'challenge.activate', 'challenges', p_challenge_id, jsonb_build_object('participants', v_count));
  end if;
  return public.challenge_state(p_challenge_id);
end;
$$;

create function public.leave_challenge(p_challenge_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  update public.challenge_participants set left_at = now()
    where challenge_id = p_challenge_id and user_id = (select auth.uid()) and left_at is null;
end;
$$;

-- The person reports the DAY and TIME they trained (academy time zone). It counts right away.
create function public.add_challenge_entry(
  p_challenge_id uuid, p_local_date date, p_local_time time, p_units int, p_note text, p_client_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.challenges%rowtype;
  v_tz text;
  v_ts timestamptz;
  v_units int;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if p_client_key is null then raise exception 'VALIDATION_ERROR: client_key' using errcode = '22023'; end if;
  select * into v_c from public.challenges where id = p_challenge_id;
  if not found or not exists (select 1 from public.challenge_participants p
                              where p.challenge_id = p_challenge_id and p.user_id = v_actor and p.left_at is null) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select id into v_id from public.challenge_entries where user_id = v_actor and client_key = p_client_key;
  if v_id is not null then return v_id; end if; -- same request repeated

  if public.challenge_state(p_challenge_id) <> 'active' then raise exception 'VALIDATION_ERROR: challenge not active' using errcode = '22023'; end if;
  if v_c.metric = 'attendance' then raise exception 'VALIDATION_ERROR: automatic metric' using errcode = '22023'; end if;
  if v_note is not null and length(v_note) > 200 then raise exception 'VALIDATION_ERROR: note' using errcode = '22023'; end if;
  v_units := case when v_c.metric = 'training' then 1 else p_units end;
  if v_units is null or v_units not between 1 and 10000 then raise exception 'VALIDATION_ERROR: units' using errcode = '22023'; end if;
  if p_local_date is null or p_local_time is null then raise exception 'VALIDATION_ERROR: when' using errcode = '22023'; end if;

  select timezone into v_tz from public.academies where id = v_c.academy_id;
  v_ts := (p_local_date + p_local_time) at time zone v_tz;
  if v_ts > now() + interval '5 minutes' or p_local_date < v_c.starts_on or p_local_date > v_c.ends_on then
    raise exception 'VALIDATION_ERROR: when' using errcode = '22023';
  end if;

  -- Anti-abuse: a hard bound of 20 entries per person per day, plus the creator's optional daily cap.
  if (select count(*) from public.challenge_entries e
      where e.challenge_id = p_challenge_id and e.user_id = v_actor and e.voided_at is null
        and (e.occurred_at at time zone v_tz)::date = p_local_date) >= 20 then
    raise exception 'VALIDATION_ERROR: daily limit' using errcode = '22023';
  end if;
  if v_c.max_units_per_day is not null and (
      select coalesce(sum(e.units), 0) from public.challenge_entries e
      where e.challenge_id = p_challenge_id and e.user_id = v_actor and e.voided_at is null
        and (e.occurred_at at time zone v_tz)::date = p_local_date) + v_units > v_c.max_units_per_day then
    raise exception 'VALIDATION_ERROR: daily cap' using errcode = '22023';
  end if;

  insert into public.challenge_entries (academy_id, challenge_id, user_id, occurred_at, units, note, client_key)
    values (v_c.academy_id, p_challenge_id, v_actor, v_ts, v_units, v_note, p_client_key) returning id into v_id;
  return v_id;
end;
$$;

-- The person voids their own entry; the creator and the academy manager may void any (moderation).
create function public.void_challenge_entry(p_entry_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_e public.challenge_entries%rowtype;
  v_creator uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_e from public.challenge_entries where id = p_entry_id;
  if found then select created_by into v_creator from public.challenges where id = v_e.challenge_id; end if;
  if not found or not (v_e.user_id = v_actor or v_creator = v_actor or public.is_academy_manager(v_e.academy_id) or public.is_platform_admin()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_e.voided_at is not null then return; end if;
  update public.challenge_entries set voided_at = now(), voided_by = v_actor where id = p_entry_id;
  if v_e.user_id <> v_actor then
    insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
      values (v_e.academy_id, v_actor, 'challenge.void_entry', 'challenge_entries', p_entry_id,
        jsonb_build_object('challenge_id', v_e.challenge_id, 'user_id', v_e.user_id));
  end if;
end;
$$;

create function public.cancel_challenge(p_challenge_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.challenges%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_c from public.challenges where id = p_challenge_id;
  if not found or not (v_c.created_by = v_actor or public.is_academy_manager(v_c.academy_id) or public.is_platform_admin()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(v_reason) not between 3 and 500 then raise exception 'VALIDATION_ERROR: reason' using errcode = '22023'; end if;
  if v_c.cancelled_at is not null then return; end if;
  if public.challenge_state(p_challenge_id) in ('finished', 'expired') then raise exception 'VALIDATION_ERROR: challenge closed' using errcode = '22023'; end if;
  update public.challenges set cancelled_at = now(), cancelled_reason = v_reason where id = p_challenge_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_c.academy_id, v_actor, 'challenge.cancel', 'challenges', p_challenge_id, jsonb_build_object('reason', v_reason));
end;
$$;

-- Challenges of an academy with the number of participants (never who) and the caller's own status.
create function public.list_challenges(p_academy_id uuid)
returns table (id uuid, title text, description text, metric text, points_per_unit int, technique_id uuid, technique_name text,
               max_units_per_day int, starts_on date, ends_on date, min_participants int, participants int, state text,
               joined boolean, created_by_me boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_academy_member(p_academy_id) or public.is_platform_admin()) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select c.id, c.title, c.description, c.metric, c.points_per_unit, c.technique_id, t.name, c.max_units_per_day, c.starts_on, c.ends_on,
           c.min_participants,
           (select count(*)::int from public.challenge_participants p where p.challenge_id = c.id and p.left_at is null),
           public.challenge_state(c.id),
           exists (select 1 from public.challenge_participants p where p.challenge_id = c.id and p.user_id = (select auth.uid()) and p.left_at is null),
           c.created_by = (select auth.uid())
    from public.challenges c left join public.techniques t on t.id = c.technique_id
    where c.academy_id = p_academy_id
    order by c.ends_on desc, c.created_at desc;
end;
$$;

-- Full ranking, for participants, the creator and the academy manager. Hidden until the challenge is active.
create function public.challenge_ranking(p_challenge_id uuid)
returns table (rank bigint, user_id uuid, display_name text, points bigint, entries bigint, verified_entries bigint, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.challenges%rowtype;
  v_tz text;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_c from public.challenges where id = p_challenge_id;
  if not found or not (
      exists (select 1 from public.challenge_participants p where p.challenge_id = p_challenge_id and p.user_id = v_actor and p.left_at is null)
      or v_c.created_by = v_actor or public.is_academy_manager(v_c.academy_id) or public.is_platform_admin()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if public.challenge_state(p_challenge_id) not in ('active', 'finished') then return; end if;
  select timezone into v_tz from public.academies where id = v_c.academy_id;

  return query
    with members as (
      select p.user_id as uid from public.challenge_participants p where p.challenge_id = p_challenge_id and p.left_at is null
    ), scored as (
      select m.uid,
        case when v_c.metric = 'attendance' then
          (select count(*) from public.attendances a join public.sessions s on s.id = a.session_id
           where a.user_id = m.uid and a.academy_id = v_c.academy_id and a.status = 'validated'
             and (s.starts_at at time zone v_tz)::date between v_c.starts_on and v_c.ends_on)
        else
          (select coalesce(sum(e.units), 0) from public.challenge_entries e
           where e.challenge_id = p_challenge_id and e.user_id = m.uid and e.voided_at is null)
        end as units,
        case when v_c.metric = 'attendance' then
          (select count(*) from public.attendances a join public.sessions s on s.id = a.session_id
           where a.user_id = m.uid and a.academy_id = v_c.academy_id and a.status = 'validated'
             and (s.starts_at at time zone v_tz)::date between v_c.starts_on and v_c.ends_on)
        else
          (select count(*) from public.challenge_entries e
           where e.challenge_id = p_challenge_id and e.user_id = m.uid and e.voided_at is null)
        end as n_entries,
        case when v_c.metric = 'attendance' then
          (select count(*) from public.attendances a join public.sessions s on s.id = a.session_id
           where a.user_id = m.uid and a.academy_id = v_c.academy_id and a.status = 'validated'
             and (s.starts_at at time zone v_tz)::date between v_c.starts_on and v_c.ends_on)
        else
          (select count(*) from public.challenge_entries e
           where e.challenge_id = p_challenge_id and e.user_id = m.uid and e.voided_at is null
             and public.entry_is_verified(e.user_id, e.academy_id, e.occurred_at))
        end as n_verified
      from members m
    )
    select rank() over (order by sc.units * v_c.points_per_unit desc)::bigint,
           sc.uid, pr.display_name, (sc.units * v_c.points_per_unit)::bigint, sc.n_entries::bigint, sc.n_verified::bigint, sc.uid = v_actor
    from scored sc join public.profiles pr on pr.id = sc.uid
    order by 1, pr.display_name;
end;
$$;

-- The caller's own entries, with the "verified" flag (inside a lesson with a validated attendance).
create function public.my_challenge_entries(p_challenge_id uuid)
returns table (id uuid, occurred_at timestamptz, units int, note text, verified boolean, voided boolean)
language sql stable security definer set search_path = '' as $$
  select e.id, e.occurred_at, e.units, e.note, public.entry_is_verified(e.user_id, e.academy_id, e.occurred_at), e.voided_at is not null
  from public.challenge_entries e
  where e.challenge_id = p_challenge_id and e.user_id = (select auth.uid())
  order by e.occurred_at desc;
$$;

-- Moderation view: every entry of a challenge, for its creator and the academy manager only.
create function public.list_challenge_entries(p_challenge_id uuid)
returns table (id uuid, user_id uuid, display_name text, occurred_at timestamptz, units int, note text, verified boolean, voided boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_c public.challenges%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_c from public.challenges where challenges.id = p_challenge_id;
  if not found or not (v_c.created_by = (select auth.uid()) or public.is_academy_manager(v_c.academy_id) or public.is_platform_admin()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
    select e.id, e.user_id, pr.display_name, e.occurred_at, e.units, e.note,
           public.entry_is_verified(e.user_id, e.academy_id, e.occurred_at), e.voided_at is not null
    from public.challenge_entries e join public.profiles pr on pr.id = e.user_id
    where e.challenge_id = p_challenge_id
    order by e.occurred_at desc;
end;
$$;

revoke all on function public.challenge_state(uuid), public.entry_is_verified(uuid, uuid, timestamptz),
  public.create_challenge(uuid, text, text, text, int, uuid, int, date, date, int, boolean, uuid),
  public.join_challenge(uuid), public.leave_challenge(uuid),
  public.add_challenge_entry(uuid, date, time, int, text, uuid), public.void_challenge_entry(uuid),
  public.cancel_challenge(uuid, text), public.list_challenges(uuid), public.challenge_ranking(uuid), public.list_challenge_entries(uuid), public.my_challenge_entries(uuid)
  from public, anon, authenticated;
grant execute on function public.create_challenge(uuid, text, text, text, int, uuid, int, date, date, int, boolean, uuid),
  public.join_challenge(uuid), public.leave_challenge(uuid),
  public.add_challenge_entry(uuid, date, time, int, text, uuid), public.void_challenge_entry(uuid),
  public.cancel_challenge(uuid, text), public.list_challenges(uuid), public.challenge_ranking(uuid), public.list_challenge_entries(uuid), public.my_challenge_entries(uuid)
  to authenticated;
