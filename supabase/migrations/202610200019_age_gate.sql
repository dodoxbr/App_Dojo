-- US-013 (part 1): age gate. The system must know who is an adult before people meet in an academy; minors are blocked
-- until the guardian flow exists (docs/06: "bloquear cadastro autônomo de menor até fluxo completo existir").
-- The birth date is personal data: it lives in its own table, readable only by its owner. Managers and teachers
-- only ever learn "adult or not" through is_adult(). Age of majority = 18 (premise to confirm, docs/11).
-- Error codes: 28000 UNAUTHENTICATED, 23505 CONFLICT, 22023 VALIDATION_ERROR.

create table public.profile_private (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date not null check (birth_date >= date '1900-01-01'),
  created_at timestamptz not null default now()
);
alter table public.profile_private enable row level security;
create policy profile_private_self_read on public.profile_private for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.profile_private to authenticated;

create function public.is_adult(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profile_private p
                 where p.user_id = p_user_id and p.birth_date <= (current_date - interval '18 years')::date);
$$;

-- 'adult' | 'minor' | 'unknown' for the caller (used to guide the screens).
create function public.my_age_status() returns text
language sql stable security definer set search_path = '' as $$
  select case when not exists (select 1 from public.profile_private where user_id = (select auth.uid())) then 'unknown'
              when public.is_adult((select auth.uid())) then 'adult' else 'minor' end;
$$;

-- One-time declaration for accounts created before the birth date was asked. It cannot be changed afterwards.
create function public.set_my_birth_date(p_birth_date date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if p_birth_date is null or p_birth_date < date '1900-01-01' or p_birth_date > current_date then
    raise exception 'VALIDATION_ERROR: birth_date' using errcode = '22023';
  end if;
  if exists (select 1 from public.profile_private where user_id = v_actor) then
    raise exception 'CONFLICT: birth date already declared' using errcode = '23505';
  end if;
  insert into public.profile_private (user_id, birth_date) values (v_actor, p_birth_date);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_birth date;
begin
  v_name := left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 120);
  if length(v_name) < 2 then
    v_name := 'Novo usuário';
  end if;
  insert into public.profiles (id, display_name) values (new.id, v_name);
  -- Birth date comes from the sign-up form; an invalid or future value is simply ignored (age stays unknown).
  begin
    v_birth := (new.raw_user_meta_data ->> 'birth_date')::date;
  exception when others then
    v_birth := null;
  end;
  if v_birth is not null and v_birth between date '1900-01-01' and current_date then
    insert into public.profile_private (user_id, birth_date) values (new.id, v_birth);
  end if;
  return new;
end;
$$;

create or replace function public.request_membership(p_academy_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_m public.memberships%rowtype;
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not exists (select 1 from public.academies where id = p_academy_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.is_adult(v_actor) then raise exception 'VALIDATION_ERROR: adult required' using errcode = '22023'; end if;

  select * into v_m from public.memberships where academy_id = p_academy_id and user_id = v_actor;
  if found then
    if v_m.status in ('pending', 'approved') then return v_m.id; end if;
    if v_m.status <> 'ended' then raise exception 'CONFLICT: membership closed' using errcode = '23505'; end if;
    update public.memberships
      set status = 'pending', role = 'student', reviewed_by = null, reviewed_at = null
      where id = v_m.id;
    v_id := v_m.id;
  else
    insert into public.memberships (academy_id, user_id) values (p_academy_id, v_actor) returning id into v_id;
  end if;

  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'membership.request', 'memberships', v_id, jsonb_build_object('user_id', v_actor));
  return v_id;
end;
$$;

create or replace function public.decide_membership(
  p_membership_id uuid, p_decision text, p_reason text, p_idempotency_key uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_m public.memberships%rowtype;
  v_prev public.audit_events%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'VALIDATION_ERROR: decision' using errcode = '22023';
  end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;
  if length(coalesce(p_reason, '')) > 500 then raise exception 'VALIDATION_ERROR: reason' using errcode = '22023'; end if;

  select * into v_m from public.memberships where id = p_membership_id;
  -- Same error for "missing" and "not yours": do not reveal other tenants' ids.
  if not found or not (public.is_platform_admin() or public.is_academy_manager(v_m.academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_prev from public.audit_events
    where actor_user_id = v_actor and action = 'membership.decide' and idempotency_key = p_idempotency_key;
  if found then
    if v_prev.entity_id <> p_membership_id or v_prev.metadata ->> 'decision' <> p_decision then
      raise exception 'VALIDATION_ERROR: idempotency_key reused' using errcode = '22023';
    end if;
    return v_prev.metadata ->> 'decision';
  end if;

  if v_m.status <> 'pending' then raise exception 'CONFLICT: not pending' using errcode = '23505'; end if;
  if p_decision = 'approved' and not public.is_adult(v_m.user_id) then
    raise exception 'VALIDATION_ERROR: adult required' using errcode = '22023';
  end if;

  update public.memberships
    set status = p_decision::public.membership_status, reviewed_by = v_actor, reviewed_at = now()
    where id = p_membership_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (v_m.academy_id, v_actor, 'membership.decide', 'memberships', p_membership_id,
      jsonb_build_object('decision', p_decision, 'reason', nullif(trim(coalesce(p_reason, '')), ''), 'user_id', v_m.user_id),
      p_idempotency_key);
  return p_decision;
end;
$$;

create or replace function public.add_member(p_academy_id uuid, p_email text, p_role text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_user uuid;
  v_m public.memberships%rowtype;
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('student', 'instructor') then
    raise exception 'VALIDATION_ERROR: role' using errcode = '22023';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(coalesce(p_email, '')));
  if v_user is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.is_adult(v_user) then raise exception 'VALIDATION_ERROR: adult required' using errcode = '22023'; end if;

  select * into v_m from public.memberships where academy_id = p_academy_id and user_id = v_user;
  if found then
    if v_m.role = 'manager' then raise exception 'CONFLICT: manager' using errcode = '23505'; end if;
    if v_m.status = 'approved' and v_m.role = p_role::public.membership_role then return v_m.id; end if;
    update public.memberships
      set role = p_role::public.membership_role, status = 'approved', reviewed_by = v_actor, reviewed_at = now()
      where id = v_m.id;
    v_id := v_m.id;
  else
    insert into public.memberships (academy_id, user_id, role, status, reviewed_by, reviewed_at)
      values (p_academy_id, v_user, p_role::public.membership_role, 'approved', v_actor, now())
      returning id into v_id;
  end if;

  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'membership.add', 'memberships', v_id,
      jsonb_build_object('user_id', v_user, 'role', p_role, 'previous_status', v_m.status, 'previous_role', v_m.role));
  return v_id;
end;
$$;

revoke all on function public.is_adult(uuid), public.my_age_status(), public.set_my_birth_date(date) from public, anon, authenticated;
grant execute on function public.my_age_status(), public.set_my_birth_date(date) to authenticated;
