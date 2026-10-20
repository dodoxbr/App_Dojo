-- The academy's master may graduate themselves (decision of the product owner, 2026-10-20).
-- Only the academy manager (or the platform admin) can reach these operations anyway; the self-promotion /
-- self-correction block from migration 016 is removed. Every grant and correction stays audited and append-only.
-- (Replaces grant_promotion and correct_promotion from 016; signatures and grants are unchanged.)

create or replace function public.grant_promotion(
  p_academy_id uuid, p_user_id uuid, p_belt_code text, p_degree int, p_effective_date date, p_reason text,
  p_idempotency_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_belt text := btrim(coalesce(p_belt_code, ''));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_cur public.promotions%rowtype;
  v_prev public.audit_events%rowtype;
  v_eval jsonb;
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;

  select * into v_prev from public.audit_events
    where actor_user_id = v_actor and action = 'promotion.grant' and idempotency_key = p_idempotency_key;
  if found then
    if v_prev.metadata ->> 'user_id' <> p_user_id::text
       or public.normalize_text(v_prev.metadata -> 'to' ->> 'belt_code') <> public.normalize_text(v_belt)
       or (v_prev.metadata -> 'to' ->> 'degree')::int <> p_degree
       or v_prev.metadata ->> 'effective_date' <> p_effective_date::text then
      raise exception 'VALIDATION_ERROR: idempotency_key reused' using errcode = '22023';
    end if;
    return v_prev.entity_id;
  end if;

  if length(v_belt) not between 1 and 40 or p_degree is null or p_degree not between 0 and 20 then
    raise exception 'VALIDATION_ERROR: rank' using errcode = '22023';
  end if;
  if length(v_reason) not between 3 and 500 then raise exception 'VALIDATION_ERROR: reason' using errcode = '22023'; end if;
  if p_effective_date is null or p_effective_date > current_date then raise exception 'VALIDATION_ERROR: effective_date' using errcode = '22023'; end if;
  if not exists (select 1 from public.memberships m where m.academy_id = p_academy_id and m.user_id = p_user_id and m.status = 'approved') then
    raise exception 'VALIDATION_ERROR: not a member' using errcode = '22023';
  end if;

  -- One decision at a time per member.
  perform pg_advisory_xact_lock(hashtextextended(p_academy_id::text || p_user_id::text, 0));
  select * into v_cur from public.promotions p
    where p.academy_id = p_academy_id and p.user_id = p_user_id
      and not exists (select 1 from public.promotions c where c.corrects_promotion_id = p.id)
    order by p.effective_date desc, p.created_at desc limit 1;
  if not found then raise exception 'VALIDATION_ERROR: no current rank (register the initial rank first)' using errcode = '22023'; end if;
  if public.normalize_text(v_cur.belt_code) = public.normalize_text(v_belt) and v_cur.degree = p_degree then
    raise exception 'VALIDATION_ERROR: same rank' using errcode = '22023';
  end if;
  if p_effective_date < v_cur.effective_date then raise exception 'VALIDATION_ERROR: effective_date before current rank' using errcode = '22023'; end if;

  -- What the system recommended at the moment of the decision (kept for transparency; it does not block the manager).
  v_eval := public.evaluate_promotion(p_academy_id, p_user_id);

  insert into public.promotions (academy_id, user_id, belt_code, degree, event_type, effective_date, reason, created_by,
                                 previous_belt_code, previous_degree)
    values (p_academy_id, p_user_id, v_belt, p_degree, 'promotion', p_effective_date, v_reason, v_actor,
            v_cur.belt_code, v_cur.degree) returning id into v_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (p_academy_id, v_actor, 'promotion.grant', 'promotions', v_id,
      jsonb_build_object('user_id', p_user_id,
        'from', jsonb_build_object('belt_code', v_cur.belt_code, 'degree', v_cur.degree),
        'to', jsonb_build_object('belt_code', v_belt, 'degree', p_degree),
        'effective_date', p_effective_date, 'reason', v_reason,
        'recommended_at_grant', coalesce((v_eval ->> 'eligible')::boolean, false),
        'rule_version', v_eval -> 'rule' -> 'version'),
      p_idempotency_key);
  return v_id;
end;
$$;

create or replace function public.correct_promotion(
  p_promotion_id uuid, p_belt_code text, p_degree int, p_effective_date date, p_reason text, p_idempotency_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_belt text := btrim(coalesce(p_belt_code, ''));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_t public.promotions%rowtype;
  v_prev public.audit_events%rowtype;
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;
  select * into v_t from public.promotions where id = p_promotion_id;
  -- Same error for "missing" and "not yours".
  if not found or not (public.is_platform_admin() or public.is_academy_manager(v_t.academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_prev from public.audit_events
    where actor_user_id = v_actor and action = 'promotion.correct' and idempotency_key = p_idempotency_key;
  if found then
    if v_prev.metadata ->> 'corrects' <> p_promotion_id::text
       or public.normalize_text(v_prev.metadata -> 'to' ->> 'belt_code') <> public.normalize_text(v_belt)
       or (v_prev.metadata -> 'to' ->> 'degree')::int <> p_degree
       or v_prev.metadata ->> 'effective_date' <> p_effective_date::text then
      raise exception 'VALIDATION_ERROR: idempotency_key reused' using errcode = '22023';
    end if;
    return v_prev.entity_id;
  end if;

  if length(v_belt) not between 1 and 40 or p_degree is null or p_degree not between 0 and 20 then
    raise exception 'VALIDATION_ERROR: rank' using errcode = '22023';
  end if;
  if length(v_reason) not between 3 and 500 then raise exception 'VALIDATION_ERROR: reason' using errcode = '22023'; end if;
  if p_effective_date is null or p_effective_date > current_date or p_effective_date < current_date - 36500 then
    raise exception 'VALIDATION_ERROR: effective_date' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_t.academy_id::text || v_t.user_id::text, 0));
  if exists (select 1 from public.promotions c where c.corrects_promotion_id = p_promotion_id) then
    raise exception 'CONFLICT: already corrected' using errcode = '23505';
  end if;
  if public.normalize_text(v_t.belt_code) = public.normalize_text(v_belt) and v_t.degree = p_degree and v_t.effective_date = p_effective_date then
    raise exception 'VALIDATION_ERROR: no change' using errcode = '22023';
  end if;

  insert into public.promotions (academy_id, user_id, belt_code, degree, event_type, effective_date, reason, created_by,
                                 previous_belt_code, previous_degree, corrects_promotion_id)
    values (v_t.academy_id, v_t.user_id, v_belt, p_degree, 'correction', p_effective_date, v_reason, v_actor,
            v_t.belt_code, v_t.degree, p_promotion_id) returning id into v_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (v_t.academy_id, v_actor, 'promotion.correct', 'promotions', v_id,
      jsonb_build_object('user_id', v_t.user_id, 'corrects', p_promotion_id,
        'from', jsonb_build_object('belt_code', v_t.belt_code, 'degree', v_t.degree, 'effective_date', v_t.effective_date),
        'to', jsonb_build_object('belt_code', v_belt, 'degree', p_degree),
        'effective_date', p_effective_date, 'reason', v_reason),
      p_idempotency_key);
  return v_id;
end;
$$;
