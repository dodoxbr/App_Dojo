-- US-007: classes (turmas) and sessions (aulas). Writes only through the operations below (ADR-009).
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, P0002 NOT_FOUND, 23505 CONFLICT, 22023 VALIDATION_ERROR.

-- Premise to validate (docs/11): academies use the Brazilian time zone unless changed.
alter table public.academies add column timezone text not null default 'America/Sao_Paulo';

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  title text not null check (length(btrim(title)) between 2 and 120),
  instructor_user_id uuid not null references auth.users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, academy_id)
);
create index classes_academy_idx on public.classes (academy_id, is_active);
create index classes_instructor_idx on public.classes (instructor_user_id);
create unique index classes_active_title_idx on public.classes (academy_id, public.normalize_text(title)) where is_active;

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  class_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  cancelled_reason text,
  cancelled_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint sessions_time_chk check (ends_at > starts_at and ends_at <= starts_at + interval '12 hours'),
  -- A session can only belong to a class of the SAME academy.
  constraint sessions_class_academy_fk foreign key (class_id, academy_id) references public.classes (id, academy_id),
  unique (id, academy_id),
  unique (class_id, starts_at)
);
create index sessions_academy_start_idx on public.sessions (academy_id, starts_at);

alter table public.classes enable row level security;
alter table public.sessions enable row level security;

create policy classes_read on public.classes for select to authenticated
  using (public.is_platform_admin() or public.is_academy_member(academy_id));
create policy sessions_read on public.sessions for select to authenticated
  using (public.is_platform_admin() or public.is_academy_member(academy_id));
grant select on public.classes, public.sessions to authenticated;

-- Manager / platform admin, or the class' responsible instructor while still an approved member.
create function public.can_manage_class(p_class_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.classes c
    where c.id = p_class_id and (
      public.is_platform_admin()
      or public.is_academy_manager(c.academy_id)
      or (c.instructor_user_id = (select auth.uid()) and exists (
            select 1 from public.memberships m
            where m.academy_id = c.academy_id and m.user_id = (select auth.uid())
              and m.status = 'approved' and m.role in ('instructor', 'manager')))
    ));
$$;

create function public.create_class(
  p_academy_id uuid, p_title text, p_instructor_user_id uuid, p_idempotency_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_title text := btrim(coalesce(p_title, ''));
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;

  select entity_id into v_id from public.audit_events
    where actor_user_id = v_actor and action = 'class.create' and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;

  if not exists (select 1 from public.academies where id = p_academy_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if length(v_title) not between 2 and 120 then raise exception 'VALIDATION_ERROR: title' using errcode = '22023'; end if;
  if not exists (select 1 from public.memberships m
      where m.academy_id = p_academy_id and m.user_id = p_instructor_user_id
        and m.status = 'approved' and m.role in ('instructor', 'manager')) then
    raise exception 'VALIDATION_ERROR: instructor' using errcode = '22023';
  end if;

  insert into public.classes (academy_id, title, instructor_user_id) values (p_academy_id, v_title, p_instructor_user_id)
    returning id into v_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (p_academy_id, v_actor, 'class.create', 'classes', v_id,
      jsonb_build_object('title', v_title, 'instructor_user_id', p_instructor_user_id), p_idempotency_key);
  return v_id;
end;
$$;

create function public.update_class(
  p_class_id uuid, p_title text, p_instructor_user_id uuid, p_is_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.classes%rowtype;
  v_title text := btrim(coalesce(p_title, ''));
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_c from public.classes where id = p_class_id;
  if not found or not (public.is_platform_admin() or public.is_academy_manager(v_c.academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(v_title) not between 2 and 120 then raise exception 'VALIDATION_ERROR: title' using errcode = '22023'; end if;
  if not exists (select 1 from public.memberships m
      where m.academy_id = v_c.academy_id and m.user_id = p_instructor_user_id
        and m.status = 'approved' and m.role in ('instructor', 'manager')) then
    raise exception 'VALIDATION_ERROR: instructor' using errcode = '22023';
  end if;

  update public.classes
    set title = v_title, instructor_user_id = p_instructor_user_id, is_active = coalesce(p_is_active, true)
    where id = p_class_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_c.academy_id, v_actor, 'class.update', 'classes', p_class_id,
      jsonb_build_object('before', jsonb_build_object('title', v_c.title, 'instructor_user_id', v_c.instructor_user_id, 'is_active', v_c.is_active),
                         'after', jsonb_build_object('title', v_title, 'instructor_user_id', p_instructor_user_id, 'is_active', coalesce(p_is_active, true))));
end;
$$;

-- Local date/time in the academy time zone -> timestamptz.
create function public.create_session(
  p_class_id uuid, p_date date, p_start time, p_end time, p_idempotency_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.classes%rowtype;
  v_tz text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.can_manage_class(p_class_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;

  select entity_id into v_id from public.audit_events
    where actor_user_id = v_actor and action = 'session.create' and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;

  select * into v_c from public.classes where id = p_class_id;
  if not v_c.is_active then raise exception 'VALIDATION_ERROR: class inactive' using errcode = '22023'; end if;
  if p_date is null or p_start is null or p_end is null or p_end <= p_start then
    raise exception 'VALIDATION_ERROR: time' using errcode = '22023';
  end if;
  if p_date < current_date - 365 or p_date > current_date + 365 then
    raise exception 'VALIDATION_ERROR: date' using errcode = '22023';
  end if;

  select timezone into v_tz from public.academies where id = v_c.academy_id;
  v_starts := (p_date + p_start) at time zone v_tz;
  v_ends := (p_date + p_end) at time zone v_tz;

  insert into public.sessions (academy_id, class_id, starts_at, ends_at, created_by)
    values (v_c.academy_id, p_class_id, v_starts, v_ends, v_actor) returning id into v_id; -- (class, starts_at) unique -> 23505
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (v_c.academy_id, v_actor, 'session.create', 'sessions', v_id,
      jsonb_build_object('class_id', p_class_id, 'starts_at', v_starts, 'ends_at', v_ends), p_idempotency_key);
  return v_id;
end;
$$;

create function public.cancel_session(p_session_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_s public.sessions%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if length(coalesce(p_reason, '')) > 500 then raise exception 'VALIDATION_ERROR: reason' using errcode = '22023'; end if;
  select * into v_s from public.sessions where id = p_session_id;
  -- Same error for "missing" and "not yours".
  if not found or not public.can_manage_class(v_s.class_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_s.status = 'cancelled' then return; end if;

  update public.sessions
    set status = 'cancelled', cancelled_at = now(), cancelled_reason = nullif(btrim(coalesce(p_reason, '')), '')
    where id = p_session_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_s.academy_id, v_actor, 'session.cancel', 'sessions', p_session_id,
      jsonb_build_object('class_id', v_s.class_id, 'reason', nullif(btrim(coalesce(p_reason, '')), '')));
end;
$$;

revoke all on function public.can_manage_class(uuid), public.create_class(uuid, text, uuid, uuid),
  public.update_class(uuid, text, uuid, boolean), public.create_session(uuid, date, time, time, uuid),
  public.cancel_session(uuid, text) from public, anon, authenticated;
grant execute on function public.can_manage_class(uuid), public.create_class(uuid, text, uuid, uuid),
  public.update_class(uuid, text, uuid, boolean), public.create_session(uuid, date, time, time, uuid),
  public.cancel_session(uuid, text) to authenticated;
