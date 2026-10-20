-- Strict idempotency: the same key may only repeat the SAME request. Reusing a key with the same target but a
-- different decision/status used to return the earlier result silently; it is now a VALIDATION_ERROR.
-- (Replaces decide_membership from 005 and assess_skill from 013; signatures and grants are unchanged.)

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

create or replace function public.assess_skill(
  p_academy_id uuid, p_user_id uuid, p_technique_id uuid, p_status text, p_note text, p_idempotency_key uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_current public.skill_assessments%rowtype;
  v_prev public.audit_events%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.has_academy_permission(p_academy_id, 'assess_skills') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;
  if p_status is null or p_status not in ('not_started', 'studied', 'practicing', 'validated') then
    raise exception 'VALIDATION_ERROR: status' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 500 then raise exception 'VALIDATION_ERROR: note' using errcode = '22023'; end if;

  select * into v_prev from public.audit_events
    where actor_user_id = v_actor and action = 'skill.assess' and idempotency_key = p_idempotency_key;
  if found then
    if v_prev.metadata ->> 'user_id' <> p_user_id::text or v_prev.metadata ->> 'technique_id' <> p_technique_id::text
       or v_prev.metadata ->> 'to' <> p_status then
      raise exception 'VALIDATION_ERROR: idempotency_key reused' using errcode = '22023';
    end if;
    return v_prev.metadata ->> 'to';
  end if;

  if p_status = 'validated' and p_user_id = v_actor then raise exception 'FORBIDDEN: self validation' using errcode = '42501'; end if;
  if not exists (select 1 from public.memberships m where m.academy_id = p_academy_id and m.user_id = p_user_id and m.status = 'approved') then
    raise exception 'VALIDATION_ERROR: not a member' using errcode = '22023';
  end if;
  if not exists (select 1 from public.curriculum_items i join public.curricula c on c.id = i.curriculum_id
                 where i.academy_id = p_academy_id and i.technique_id = p_technique_id and c.is_active) then
    raise exception 'VALIDATION_ERROR: technique not in the trail' using errcode = '22023';
  end if;

  select * into v_current from public.skill_assessments
    where academy_id = p_academy_id and user_id = p_user_id and technique_id = p_technique_id;
  if found and v_current.status = 'validated' and p_status <> 'validated' and (v_note is null or length(v_note) < 3) then
    raise exception 'VALIDATION_ERROR: reason required to remove a validation' using errcode = '22023';
  end if;
  if found and v_current.status = p_status and v_current.status_source = 'teacher' then return p_status; end if;

  if found then
    update public.skill_assessments
      set status = p_status, status_source = 'teacher', assessed_by = v_actor, assessed_at = now(), note = v_note, updated_at = now()
      where id = v_current.id returning id into v_id;
  else
    insert into public.skill_assessments (academy_id, user_id, technique_id, status, status_source, assessed_by, assessed_at, note)
      values (p_academy_id, p_user_id, p_technique_id, p_status, 'teacher', v_actor, now(), v_note) returning id into v_id;
  end if;

  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (p_academy_id, v_actor, 'skill.assess', 'skill_assessments', v_id,
      jsonb_build_object('user_id', p_user_id, 'technique_id', p_technique_id,
                         'from', coalesce(v_current.status, 'none'), 'to', p_status, 'note', v_note),
      p_idempotency_key);
  return p_status;
end;
$$;
