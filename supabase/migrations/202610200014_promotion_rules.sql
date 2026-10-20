-- US-010: promotion rules (per academy, versioned, combinable criteria) and progress evaluation.
-- NO official graduation numbers live here: each academy registers its own rules (CLAUDE.md rule 2).
-- Eligibility is a RECOMMENDATION only (ADR-005); only validated, non-revoked attendance counts (rule 8).
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, P0002 NOT_FOUND, 23505 CONFLICT, 22023 VALIDATION_ERROR.

create function public.prevent_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'IMMUTABLE: % is append-only', tg_table_name using errcode = '55000';
end;
$$;

-- Official rank events. Append-only: a correction is a new event, never an UPDATE (docs/03).
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  user_id uuid not null references auth.users(id),
  belt_code text not null check (length(btrim(belt_code)) between 1 and 40),
  degree int not null check (degree between 0 and 20),
  event_type text not null check (event_type in ('initial', 'promotion', 'correction')),
  effective_date date not null,
  reason text check (reason is null or length(reason) <= 500),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index promotions_user_idx on public.promotions (academy_id, user_id, effective_date desc, created_at desc);
create trigger promotions_immutable before update or delete on public.promotions
  for each row execute function public.prevent_mutation();

create table public.promotion_rules (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  belt_code text not null check (length(btrim(belt_code)) between 1 and 40),
  degree int not null check (degree between 0 and 20),
  title text check (title is null or length(btrim(title)) between 2 and 120),
  version int not null check (version >= 1),
  effective_from date not null,
  effective_to date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint promotion_rules_dates_chk check (effective_to is null or effective_to >= effective_from),
  unique (id, academy_id)
);
-- One open-ended rule per (academy, rank); versions are unique.
create unique index promotion_rules_open_idx on public.promotion_rules (academy_id, public.normalize_text(belt_code), degree)
  where effective_to is null;
create unique index promotion_rules_version_idx on public.promotion_rules (academy_id, public.normalize_text(belt_code), degree, version);

create table public.rule_criteria (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  rule_id uuid not null,
  position int not null,
  kind text not null check (kind in ('min_days', 'attendance', 'curriculum', 'manual')),
  label text not null check (length(btrim(label)) between 2 and 120),
  min_days int check (min_days between 1 and 3650),
  min_attendances int check (min_attendances between 1 and 5000),
  window_days int check (window_days between 1 and 3650),
  distinct_days boolean not null default false,
  curriculum_id uuid,
  min_percent int check (min_percent between 1 and 100),
  constraint rule_criteria_rule_fk foreign key (rule_id, academy_id) references public.promotion_rules (id, academy_id) on delete cascade,
  constraint rule_criteria_curriculum_fk foreign key (curriculum_id, academy_id) references public.curricula (id, academy_id),
  -- Each kind uses exactly its own parameters.
  constraint rule_criteria_kind_chk check (
    (kind = 'min_days' and min_days is not null and min_attendances is null and window_days is null and curriculum_id is null and min_percent is null)
    or (kind = 'attendance' and min_attendances is not null and min_days is null and curriculum_id is null and min_percent is null)
    or (kind = 'curriculum' and curriculum_id is not null and min_percent is not null and min_days is null and min_attendances is null and window_days is null)
    or (kind = 'manual' and min_days is null and min_attendances is null and window_days is null and curriculum_id is null and min_percent is null)
  ),
  unique (rule_id, position)
);
create unique index rule_criteria_label_idx on public.rule_criteria (rule_id, public.normalize_text(label));

-- Manual criteria (e.g. "Comprometimento"): append-only history; the latest decision after the last promotion counts.
create table public.manual_assessments (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  academy_id uuid not null references public.academies(id),
  user_id uuid not null references auth.users(id),
  criterion_key text not null check (length(criterion_key) between 1 and 120),
  met boolean not null,
  note text check (note is null or length(note) <= 500),
  assessed_by uuid not null references auth.users(id),
  assessed_at timestamptz not null default now()
);
create index manual_assessments_idx on public.manual_assessments (academy_id, user_id, criterion_key, seq desc);
create trigger manual_assessments_immutable before update or delete on public.manual_assessments
  for each row execute function public.prevent_mutation();

alter table public.promotions enable row level security;
alter table public.promotion_rules enable row level security;
alter table public.rule_criteria enable row level security;
alter table public.manual_assessments enable row level security;

-- Members read the academy's rules (transparency); ranks and manual decisions only the person and those who follow progress.
create policy promotion_rules_read on public.promotion_rules for select to authenticated
  using (public.is_platform_admin() or public.is_academy_member(academy_id));
create policy rule_criteria_read on public.rule_criteria for select to authenticated
  using (public.is_platform_admin() or public.is_academy_member(academy_id));
create policy promotions_read on public.promotions for select to authenticated using (
  user_id = (select auth.uid())
  or public.has_academy_permission(academy_id, 'view_progress')
  or public.has_academy_permission(academy_id, 'recommend_graduation')
);
create policy manual_assessments_read on public.manual_assessments for select to authenticated using (
  public.has_academy_permission(academy_id, 'view_progress')
  or public.has_academy_permission(academy_id, 'recommend_graduation')
);
grant select on public.promotions, public.promotion_rules, public.rule_criteria, public.manual_assessments to authenticated;

-- Operations -------------------------------------------------------------------------------------

-- Creates a NEW version of the rule for (belt, degree). The previous open version is closed the day before.
-- p_criteria: [{kind, label, min_days | min_attendances[, window_days, distinct_days] | curriculum_id, min_percent | (manual)}]
create function public.create_promotion_rule(
  p_academy_id uuid, p_belt_code text, p_degree int, p_title text, p_effective_from date, p_criteria jsonb,
  p_idempotency_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_belt text := btrim(coalesce(p_belt_code, ''));
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_open public.promotion_rules%rowtype;
  v_version int := 1;
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;
  select entity_id into v_id from public.audit_events
    where actor_user_id = v_actor and action = 'promotion_rule.create' and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;

  if not exists (select 1 from public.academies where id = p_academy_id) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if length(v_belt) not between 1 and 40 or p_degree is null or p_degree not between 0 and 20 then
    raise exception 'VALIDATION_ERROR: rank' using errcode = '22023';
  end if;
  if v_title is not null and length(v_title) not between 2 and 120 then raise exception 'VALIDATION_ERROR: title' using errcode = '22023'; end if;
  if p_effective_from is null or p_effective_from < current_date - 3650 or p_effective_from > current_date + 3650 then
    raise exception 'VALIDATION_ERROR: effective_from' using errcode = '22023';
  end if;
  if p_criteria is null or jsonb_typeof(p_criteria) <> 'array' or jsonb_array_length(p_criteria) not between 1 and 20 then
    raise exception 'VALIDATION_ERROR: criteria (1 to 20 required)' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_criteria) c where jsonb_typeof(c) <> 'object') then
    raise exception 'VALIDATION_ERROR: criteria' using errcode = '22023';
  end if;

  select * into v_open from public.promotion_rules
    where academy_id = p_academy_id and public.normalize_text(belt_code) = public.normalize_text(v_belt)
      and degree = p_degree and effective_to is null for update;
  if found then
    if p_effective_from <= v_open.effective_from then
      raise exception 'VALIDATION_ERROR: effective_from must be after the current version' using errcode = '22023';
    end if;
    update public.promotion_rules set effective_to = p_effective_from - 1 where id = v_open.id;
    v_version := v_open.version + 1;
  end if;

  insert into public.promotion_rules (academy_id, belt_code, degree, title, version, effective_from, created_by)
    values (p_academy_id, v_belt, p_degree, v_title, v_version, p_effective_from, v_actor) returning id into v_id;

  begin
    insert into public.rule_criteria (academy_id, rule_id, position, kind, label, min_days, min_attendances, window_days,
                                      distinct_days, curriculum_id, min_percent)
      select p_academy_id, v_id, ord::int, c ->> 'kind', btrim(c ->> 'label'),
             (c ->> 'min_days')::int, (c ->> 'min_attendances')::int, (c ->> 'window_days')::int,
             coalesce((c ->> 'distinct_days')::boolean, false), (c ->> 'curriculum_id')::uuid, (c ->> 'min_percent')::int
      from jsonb_array_elements(p_criteria) with ordinality as t(c, ord);
  exception when invalid_text_representation or check_violation or not_null_violation
             or foreign_key_violation or unique_violation or invalid_parameter_value then
    raise exception 'VALIDATION_ERROR: criteria' using errcode = '22023';
  end;

  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (p_academy_id, v_actor, 'promotion_rule.create', 'promotion_rules', v_id,
      jsonb_build_object('belt_code', v_belt, 'degree', p_degree, 'version', v_version,
                         'effective_from', p_effective_from, 'criteria', jsonb_array_length(p_criteria)), p_idempotency_key);
  return v_id;
end;
$$;

-- The academy manager records where a member currently stands. Only once: later changes are promotions/corrections (US-011).
create function public.register_initial_rank(
  p_academy_id uuid, p_user_id uuid, p_belt_code text, p_degree int, p_effective_date date, p_reason text,
  p_idempotency_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_belt text := btrim(coalesce(p_belt_code, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;
  select entity_id into v_id from public.audit_events
    where actor_user_id = v_actor and action = 'rank.initial' and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;

  if length(v_belt) not between 1 and 40 or p_degree is null or p_degree not between 0 and 20 then
    raise exception 'VALIDATION_ERROR: rank' using errcode = '22023';
  end if;
  if p_effective_date is null or p_effective_date > current_date or p_effective_date < current_date - 36500 then
    raise exception 'VALIDATION_ERROR: effective_date' using errcode = '22023';
  end if;
  if v_reason is not null and length(v_reason) > 500 then raise exception 'VALIDATION_ERROR: reason' using errcode = '22023'; end if;
  if not exists (select 1 from public.memberships m where m.academy_id = p_academy_id and m.user_id = p_user_id and m.status = 'approved') then
    raise exception 'VALIDATION_ERROR: not a member' using errcode = '22023';
  end if;
  if exists (select 1 from public.promotions where academy_id = p_academy_id and user_id = p_user_id) then
    raise exception 'CONFLICT: rank already registered' using errcode = '23505';
  end if;

  insert into public.promotions (academy_id, user_id, belt_code, degree, event_type, effective_date, reason, created_by)
    values (p_academy_id, p_user_id, v_belt, p_degree, 'initial', p_effective_date, v_reason, v_actor) returning id into v_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (p_academy_id, v_actor, 'rank.initial', 'promotions', v_id,
      jsonb_build_object('user_id', p_user_id, 'belt_code', v_belt, 'degree', p_degree, 'effective_date', p_effective_date),
      p_idempotency_key);
  return v_id;
end;
$$;

-- A teacher (recommend_graduation) or the manager marks a manual criterion as met / not met for a member.
create function public.assess_manual_criterion(
  p_academy_id uuid, p_user_id uuid, p_label text, p_met boolean, p_note text, p_idempotency_key uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_key text := public.normalize_text(p_label);
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_prev public.audit_events%rowtype;
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.has_academy_permission(p_academy_id, 'recommend_graduation') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_idempotency_key is null or p_met is null then raise exception 'VALIDATION_ERROR: input' using errcode = '22023'; end if;
  if v_note is not null and length(v_note) > 500 then raise exception 'VALIDATION_ERROR: note' using errcode = '22023'; end if;

  select * into v_prev from public.audit_events
    where actor_user_id = v_actor and action = 'criterion.assess' and idempotency_key = p_idempotency_key;
  if found then
    if v_prev.metadata ->> 'user_id' <> p_user_id::text or v_prev.metadata ->> 'criterion' <> v_key
       or (v_prev.metadata ->> 'met')::boolean <> p_met then
      raise exception 'VALIDATION_ERROR: idempotency_key reused' using errcode = '22023';
    end if;
    return (v_prev.metadata ->> 'met')::boolean;
  end if;

  if p_met and p_user_id = v_actor then raise exception 'FORBIDDEN: self assessment' using errcode = '42501'; end if;
  if v_key = '' or not exists (
      select 1 from public.rule_criteria c join public.promotion_rules r on r.id = c.rule_id
      where r.academy_id = p_academy_id and r.effective_to is null and c.kind = 'manual'
        and public.normalize_text(c.label) = v_key) then
    raise exception 'VALIDATION_ERROR: no such manual criterion' using errcode = '22023';
  end if;
  if not exists (select 1 from public.memberships m where m.academy_id = p_academy_id and m.user_id = p_user_id and m.status = 'approved') then
    raise exception 'VALIDATION_ERROR: not a member' using errcode = '22023';
  end if;

  insert into public.manual_assessments (academy_id, user_id, criterion_key, met, note, assessed_by)
    values (p_academy_id, p_user_id, v_key, p_met, v_note, v_actor) returning id into v_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (p_academy_id, v_actor, 'criterion.assess', 'manual_assessments', v_id,
      jsonb_build_object('user_id', p_user_id, 'criterion', v_key, 'met', p_met, 'note', v_note), p_idempotency_key);
  return p_met;
end;
$$;

-- Read-only evaluation of one member against the rule that applies to their current rank. Never promotes anyone.
create function public.evaluate_promotion(p_academy_id uuid, p_user_id uuid) returns jsonb
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

revoke all on function public.prevent_mutation(), public.create_promotion_rule(uuid, text, int, text, date, jsonb, uuid),
  public.register_initial_rank(uuid, uuid, text, int, date, text, uuid),
  public.assess_manual_criterion(uuid, uuid, text, boolean, text, uuid), public.evaluate_promotion(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_promotion_rule(uuid, text, int, text, date, jsonb, uuid),
  public.register_initial_rank(uuid, uuid, text, int, date, text, uuid),
  public.assess_manual_criterion(uuid, uuid, text, boolean, text, uuid), public.evaluate_promotion(uuid, uuid)
  to authenticated;
