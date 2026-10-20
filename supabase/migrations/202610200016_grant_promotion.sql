-- US-011: granting a promotion and correcting it (rectification). Events are append-only (migration 014).
-- Nothing is promoted automatically: only the academy manager decides; eligibility is just a recommendation (ADR-005).
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, 23505 CONFLICT, 22023 VALIDATION_ERROR.

alter table public.promotions
  add column previous_belt_code text,
  add column previous_degree int,
  add column corrects_promotion_id uuid references public.promotions(id),
  add constraint promotions_correction_chk check ((event_type = 'correction') = (corrects_promotion_id is not null));
-- An event can be corrected only once (a later correction corrects the correction): no forks.
create unique index promotions_corrects_idx on public.promotions (corrects_promotion_id) where corrects_promotion_id is not null;

-- The current rank of each member: the latest event that was not superseded by a correction.
create view public.current_ranks with (security_invoker = true) as
  select distinct on (p.academy_id, p.user_id)
         p.id, p.academy_id, p.user_id, p.belt_code, p.degree, p.event_type, p.effective_date, p.created_at
  from public.promotions p
  where not exists (select 1 from public.promotions c where c.corrects_promotion_id = p.id)
  order by p.academy_id, p.user_id, p.effective_date desc, p.created_at desc;
grant select on public.current_ranks to authenticated;

-- evaluate_promotion (014) must ignore superseded events when it looks for the current rank.
-- (Only change from 014: the `not exists (... corrects_promotion_id ...)` filter in the rank lookup.)
create or replace function public.evaluate_promotion(p_academy_id uuid, p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_tz text;
  v_today date;
  v_baseline timestamptz;
  v_rank public.promotions%rowtype;
  v_rule public.promotion_rules%rowtype;
  v_c public.rule_criteria%rowtype;
  v_assess public.manual_assessments%rowtype;
  v_results jsonb := '[]'::jsonb;
  v_met boolean;
  v_current numeric;
  v_target numeric;
  v_detail text;
  v_all boolean := true;
  v_required int;
  v_validated int;
  v_active boolean;
  v_rank_json jsonb;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (p_user_id = v_actor
          or public.has_academy_permission(p_academy_id, 'view_progress')
          or public.has_academy_permission(p_academy_id, 'recommend_graduation')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select timezone into v_tz from public.academies where id = p_academy_id;
  if v_tz is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  v_today := (now() at time zone v_tz)::date;

  select * into v_rank from public.promotions
    where academy_id = p_academy_id and user_id = p_user_id
      and not exists (select 1 from public.promotions c where c.corrects_promotion_id = promotions.id)
    order by effective_date desc, created_at desc limit 1;
  if not found then
    return jsonb_build_object('has_rank', false, 'has_rule', false, 'eligible', false, 'recommendation_only', true);
  end if;
  v_rank_json := jsonb_build_object('belt_code', v_rank.belt_code, 'degree', v_rank.degree, 'effective_date', v_rank.effective_date);

  select * into v_rule from public.promotion_rules r
    where r.academy_id = p_academy_id
      and public.normalize_text(r.belt_code) = public.normalize_text(v_rank.belt_code) and r.degree = v_rank.degree
      and r.effective_from <= v_today and (r.effective_to is null or r.effective_to >= v_today)
    order by r.version desc limit 1;
  if not found then
    return jsonb_build_object('has_rank', true, 'rank', v_rank_json, 'has_rule', false, 'eligible', false, 'recommendation_only', true);
  end if;

  v_baseline := v_rank.effective_date::timestamp at time zone v_tz;

  for v_c in select * from public.rule_criteria where rule_id = v_rule.id order by position loop
    v_target := null;
    if v_c.kind = 'min_days' then
      v_current := v_today - v_rank.effective_date;
      v_target := v_c.min_days;
      v_met := v_current >= v_target;
      v_detail := 'dias desde a última graduação';

    elsif v_c.kind = 'attendance' then
      -- Only VALIDATED attendance counts (revoked and pending never do), after the last promotion.
      select case when v_c.distinct_days then count(distinct (s.starts_at at time zone v_tz)::date) else count(*) end
        into v_current
        from public.attendances a join public.sessions s on s.id = a.session_id
        where a.academy_id = p_academy_id and a.user_id = p_user_id and a.status = 'validated'
          and s.starts_at >= v_baseline
          and (v_c.window_days is null or s.starts_at >= now() - make_interval(days => v_c.window_days));
      v_target := v_c.min_attendances;
      v_met := v_current >= v_target;
      v_detail := case when v_c.distinct_days then 'dias com presença validada' else 'presenças validadas' end
                  || coalesce(' nos últimos ' || v_c.window_days || ' dias', '');

    elsif v_c.kind = 'curriculum' then
      select c.is_active into v_active from public.curricula c where c.id = v_c.curriculum_id;
      select count(*) filter (where i.required), count(*) filter (where i.required and sa.status = 'validated')
        into v_required, v_validated
        from public.curriculum_items i
        left join public.skill_assessments sa
          on sa.academy_id = i.academy_id and sa.technique_id = i.technique_id and sa.user_id = p_user_id
        where i.curriculum_id = v_c.curriculum_id;
      v_current := case when v_required = 0 then 0 else floor(100.0 * v_validated / v_required) end;
      v_target := v_c.min_percent;
      v_met := coalesce(v_active, false) and v_required > 0 and v_current >= v_target;
      v_detail := case when not coalesce(v_active, false) then 'currículo inativo'
                       when v_required = 0 then 'currículo sem técnicas obrigatórias'
                       else '% das técnicas obrigatórias validadas pelo professor (' || v_validated || ' de ' || v_required || ')' end;

    else -- manual: the latest decision made after the last promotion
      select * into v_assess from public.manual_assessments m
        where m.academy_id = p_academy_id and m.user_id = p_user_id and m.criterion_key = public.normalize_text(v_c.label)
          and m.assessed_at >= v_baseline
        order by m.seq desc limit 1;
      v_met := found and v_assess.met;
      v_current := case when found and v_assess.met then 1 else 0 end;
      v_target := 1;
      v_detail := case when not found then 'ainda não avaliado após a última graduação'
                       when v_assess.met then 'atende (avaliado em ' || to_char(v_assess.assessed_at at time zone v_tz, 'DD/MM/YYYY') || ')'
                       else 'não atende (avaliado em ' || to_char(v_assess.assessed_at at time zone v_tz, 'DD/MM/YYYY') || ')' end;
    end if;

    v_all := v_all and coalesce(v_met, false);
    v_results := v_results || jsonb_build_object('id', v_c.id, 'label', v_c.label, 'kind', v_c.kind,
      'met', coalesce(v_met, false), 'current', v_current, 'target', v_target, 'detail', v_detail);
  end loop;

  return jsonb_build_object('has_rank', true, 'rank', v_rank_json, 'has_rule', true,
    'rule', jsonb_build_object('id', v_rule.id, 'version', v_rule.version, 'title', v_rule.title, 'effective_from', v_rule.effective_from),
    'eligible', v_all, 'criteria', v_results, 'recommendation_only', true);
end;
$$;

create function public.grant_promotion(
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
  -- Nobody promotes themselves (the platform admin can, e.g. for the academy's own master).
  if p_user_id = v_actor and not public.is_platform_admin() then raise exception 'FORBIDDEN: self promotion' using errcode = '42501'; end if;
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

-- Rectification: a NEW event that supersedes a wrong one. The history is never edited or deleted.
create function public.correct_promotion(
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
  if v_t.user_id = v_actor and not public.is_platform_admin() then raise exception 'FORBIDDEN: self correction' using errcode = '42501'; end if;

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

revoke all on function public.grant_promotion(uuid, uuid, text, int, date, text, uuid),
  public.correct_promotion(uuid, text, int, date, text, uuid) from public, anon, authenticated;
grant execute on function public.grant_promotion(uuid, uuid, text, int, date, text, uuid),
  public.correct_promotion(uuid, text, int, date, text, uuid) to authenticated;
