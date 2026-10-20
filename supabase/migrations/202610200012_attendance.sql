-- US-008: attendance (manual and QR share one core). Only a VALIDATED, non-revoked attendance counts
-- (CLAUDE.md rule 8). A QR token only creates a PENDING request; a teacher always confirms (docs/04).
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, 23505 CONFLICT, 22023 VALIDATION_ERROR.

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  session_id uuid not null,
  user_id uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'validated', 'revoked')),
  source text not null check (source in ('manual', 'qr', 'teacher')),
  requested_at timestamptz not null default now(),
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  revoked_reason text,
  -- An attendance can only point to a session of the SAME academy.
  constraint attendances_session_academy_fk foreign key (session_id, academy_id) references public.sessions (id, academy_id),
  -- One attendance per person and session.
  unique (session_id, user_id),
  constraint attendances_state_chk check (
    (status = 'pending' and validated_by is null and revoked_by is null)
    or (status = 'validated' and validated_by is not null and validated_at is not null and revoked_by is null)
    or (status = 'revoked' and revoked_by is not null and revoked_at is not null and length(btrim(revoked_reason)) >= 3)
  )
);
create index attendances_user_idx on public.attendances (user_id, status);
create index attendances_session_idx on public.attendances (session_id, status);

-- Only the hash of a token is stored; the plain token is shown once to the teacher (QR code).
create table public.check_in_tokens (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  session_id uuid not null,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint check_in_tokens_session_fk foreign key (session_id, academy_id) references public.sessions (id, academy_id)
);
create index check_in_tokens_session_idx on public.check_in_tokens (session_id, expires_at);

alter table public.attendances enable row level security;
alter table public.check_in_tokens enable row level security; -- no policies, no grants: never readable by clients

-- May the caller validate/revoke attendance of this session? Manager / platform admin, or the class' responsible
-- instructor while approved AND holding the validate_attendance permission (the manager can remove it).
create function public.can_validate_session(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sessions s join public.classes c on c.id = s.class_id
    where s.id = p_session_id and (
      public.is_platform_admin()
      or public.is_academy_manager(s.academy_id)
      or (c.instructor_user_id = (select auth.uid())
          and exists (select 1 from public.memberships m
                      where m.academy_id = s.academy_id and m.user_id = (select auth.uid())
                        and m.status = 'approved' and m.role = 'instructor')
          and public.has_academy_permission(s.academy_id, 'validate_attendance'))
    ));
$$;

-- Reads: own attendance; people who can validate that session; the academy manager; platform admin.
create policy attendances_read on public.attendances for select to authenticated using (
  user_id = (select auth.uid())
  or public.is_platform_admin()
  or public.is_academy_manager(academy_id)
  or public.can_validate_session(session_id)
);
grant select on public.attendances to authenticated;

-- Roster: instructors holding view_roster see approved members (and their names) of their academy.
create policy membership_roster_read on public.memberships for select to authenticated
  using (status = 'approved' and public.has_academy_permission(academy_id, 'view_roster'));
create policy profile_roster_read on public.profiles for select to authenticated using (
  exists (select 1 from public.memberships m
          where m.user_id = profiles.id and m.status = 'approved'
            and public.has_academy_permission(m.academy_id, 'view_roster'))
);

-- Names of people who have an attendance in a session the caller may validate (without opening the whole roster).
create policy profile_attendance_read on public.profiles for select to authenticated using (
  exists (select 1 from public.attendances a
          where a.user_id = profiles.id and public.can_validate_session(a.session_id))
);

-- Operations -----------------------------------------------------------------------------------

create function public.create_check_in_token(p_session_id uuid) returns table (token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_s public.sessions%rowtype;
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_expires timestamptz;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_s from public.sessions where id = p_session_id;
  if not found or not public.can_validate_session(p_session_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_s.status <> 'scheduled' then raise exception 'VALIDATION_ERROR: session cancelled' using errcode = '22023'; end if;
  if now() < v_s.starts_at - interval '1 hour' or now() > v_s.ends_at + interval '1 hour' then
    raise exception 'VALIDATION_ERROR: window' using errcode = '22023';
  end if;

  v_expires := least(now() + interval '15 minutes', v_s.ends_at + interval '1 hour');
  delete from public.check_in_tokens c where c.expires_at < now() - interval '1 day';
  insert into public.check_in_tokens (academy_id, session_id, token_hash, expires_at, created_by)
    values (v_s.academy_id, p_session_id, sha256(convert_to(v_token, 'UTF8')), v_expires, v_actor);
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_s.academy_id, v_actor, 'check_in_token.create', 'sessions', p_session_id,
      jsonb_build_object('expires_at', v_expires)); -- never the token itself
  return query select v_token, v_expires;
end;
$$;

create function public.request_check_in(p_session_id uuid, p_token text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_s public.sessions%rowtype;
  v_a public.attendances%rowtype;
  v_source text := 'manual';
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_s from public.sessions where id = p_session_id;
  -- Same error for "missing" and "not a member of that academy".
  if not found or not public.is_academy_member(v_s.academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_s.status <> 'scheduled' then raise exception 'VALIDATION_ERROR: session cancelled' using errcode = '22023'; end if;
  if now() < v_s.starts_at - interval '1 hour' or now() > v_s.ends_at + interval '1 hour' then
    raise exception 'VALIDATION_ERROR: window' using errcode = '22023';
  end if;

  if p_token is not null then
    if not exists (select 1 from public.check_in_tokens t
                   where t.session_id = p_session_id and t.expires_at > now()
                     and t.token_hash = sha256(convert_to(p_token, 'UTF8'))) then
      raise exception 'VALIDATION_ERROR: token' using errcode = '22023';
    end if;
    v_source := 'qr';
  end if;

  select * into v_a from public.attendances where session_id = p_session_id and user_id = v_actor;
  if found then
    if v_a.status = 'revoked' then raise exception 'CONFLICT: revoked' using errcode = '23505'; end if;
    return v_a.id; -- pending or validated: same request repeated
  end if;

  insert into public.attendances (academy_id, session_id, user_id, source)
    values (v_s.academy_id, p_session_id, v_actor, v_source) returning id into v_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_s.academy_id, v_actor, 'attendance.request', 'attendances', v_id,
      jsonb_build_object('session_id', p_session_id, 'source', v_source));
  return v_id;
end;
$$;

create function public.validate_attendance(p_session_id uuid, p_user_id uuid, p_idempotency_key uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_s public.sessions%rowtype;
  v_a public.attendances%rowtype;
  v_prev public.audit_events%rowtype;
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;
  select * into v_s from public.sessions where id = p_session_id;
  if not found or not public.can_validate_session(p_session_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select * into v_prev from public.audit_events
    where actor_user_id = v_actor and action = 'attendance.validate' and idempotency_key = p_idempotency_key;
  if found then
    if v_prev.metadata ->> 'session_id' <> p_session_id::text or v_prev.metadata ->> 'user_id' <> p_user_id::text then
      raise exception 'VALIDATION_ERROR: idempotency_key reused' using errcode = '22023';
    end if;
    return 'validated';
  end if;

  if v_s.status <> 'scheduled' then raise exception 'VALIDATION_ERROR: session cancelled' using errcode = '22023'; end if;
  if not exists (select 1 from public.memberships m
                 where m.academy_id = v_s.academy_id and m.user_id = p_user_id and m.status = 'approved') then
    raise exception 'VALIDATION_ERROR: not a member' using errcode = '22023';
  end if;

  select * into v_a from public.attendances where session_id = p_session_id and user_id = p_user_id;
  if found then
    if v_a.status = 'revoked' then raise exception 'CONFLICT: revoked' using errcode = '23505'; end if;
    if v_a.status = 'validated' then return 'validated'; end if;
    update public.attendances set status = 'validated', validated_by = v_actor, validated_at = now() where id = v_a.id;
    v_id := v_a.id;
  else
    insert into public.attendances (academy_id, session_id, user_id, source, status, validated_by, validated_at)
      values (v_s.academy_id, p_session_id, p_user_id, 'teacher', 'validated', v_actor, now()) returning id into v_id;
  end if;

  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (v_s.academy_id, v_actor, 'attendance.validate', 'attendances', v_id,
      jsonb_build_object('session_id', p_session_id, 'user_id', p_user_id, 'previous', coalesce(v_a.status, 'none')),
      p_idempotency_key);
  return 'validated';
end;
$$;

create function public.revoke_attendance(p_attendance_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_a public.attendances%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_a from public.attendances where id = p_attendance_id;
  if not found or not public.can_validate_session(v_a.session_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if length(v_reason) not between 3 and 500 then raise exception 'VALIDATION_ERROR: reason' using errcode = '22023'; end if;
  if v_a.status = 'revoked' then return; end if;

  update public.attendances
    set status = 'revoked', revoked_by = v_actor, revoked_at = now(), revoked_reason = v_reason
    where id = p_attendance_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_a.academy_id, v_actor, 'attendance.revoke', 'attendances', p_attendance_id,
      jsonb_build_object('session_id', v_a.session_id, 'user_id', v_a.user_id, 'previous', v_a.status, 'reason', v_reason));
end;
$$;

revoke all on function public.can_validate_session(uuid), public.create_check_in_token(uuid),
  public.request_check_in(uuid, text), public.validate_attendance(uuid, uuid, uuid),
  public.revoke_attendance(uuid, text) from public, anon, authenticated;
grant execute on function public.can_validate_session(uuid), public.create_check_in_token(uuid),
  public.request_check_in(uuid, text), public.validate_attendance(uuid, uuid, uuid),
  public.revoke_attendance(uuid, text) to authenticated;
