-- US-004: membership flow. Writes to memberships happen only through the operations below.
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, P0002 NOT_FOUND, 23505 CONFLICT, 22023 VALIDATION_ERROR.

drop policy membership_self_request on public.memberships;
revoke insert on public.memberships from authenticated;

-- Display names: a manager reads the profiles of people linked to their academy; platform admin reads all (testing phase).
create policy profile_manager_read on public.profiles for select to authenticated using (
  exists (select 1 from public.memberships m
    where m.user_id = profiles.id and public.is_academy_manager(m.academy_id))
);
create policy profile_platform_admin_read on public.profiles for select to authenticated
  using (public.is_platform_admin());

create function public.request_membership(p_academy_id uuid) returns uuid
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

create function public.decide_membership(
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
    if v_prev.entity_id <> p_membership_id then
      raise exception 'VALIDATION_ERROR: idempotency_key reused' using errcode = '22023';
    end if;
    return v_prev.metadata ->> 'decision';
  end if;

  if v_m.status <> 'pending' then raise exception 'CONFLICT: not pending' using errcode = '23505'; end if;

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

create function public.add_member(p_academy_id uuid, p_email text, p_role text) returns uuid
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

create function public.end_membership(p_membership_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_m public.memberships%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if length(coalesce(p_reason, '')) > 500 then raise exception 'VALIDATION_ERROR: reason' using errcode = '22023'; end if;

  select * into v_m from public.memberships where id = p_membership_id;
  if not found or not (public.is_platform_admin() or public.is_academy_manager(v_m.academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_m.role = 'manager' then raise exception 'CONFLICT: manager' using errcode = '23505'; end if;
  if v_m.status = 'ended' then return; end if;
  if v_m.status not in ('approved', 'suspended') then raise exception 'CONFLICT: not active' using errcode = '23505'; end if;

  update public.memberships set status = 'ended', reviewed_by = v_actor, reviewed_at = now() where id = p_membership_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_m.academy_id, v_actor, 'membership.end', 'memberships', p_membership_id,
      jsonb_build_object('user_id', v_m.user_id, 'role', v_m.role, 'reason', nullif(trim(coalesce(p_reason, '')), '')));
end;
$$;

revoke all on function public.request_membership(uuid), public.decide_membership(uuid, text, text, uuid),
  public.add_member(uuid, text, text), public.end_membership(uuid, text) from public, anon, authenticated;
grant execute on function public.request_membership(uuid), public.decide_membership(uuid, text, text, uuid),
  public.add_member(uuid, text, text), public.end_membership(uuid, text) to authenticated;
