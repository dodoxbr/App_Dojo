-- US-009: curricula (trail of techniques per level) and skill assessments.
-- Skill mastery and attendance are independent dimensions (docs/04). The student only DECLARES studied/practicing;
-- only an authorised teacher (assess_skills) or the manager sets "validated". No graduation rule here (US-010).
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, P0002 NOT_FOUND, 23505 CONFLICT, 22023 VALIDATION_ERROR.

create table public.curricula (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  title text not null check (length(btrim(title)) between 2 and 120),
  level text check (level is null or length(btrim(level)) between 2 and 40),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, academy_id)
);
create unique index curricula_active_title_idx on public.curricula (academy_id, public.normalize_text(title)) where is_active;

create table public.curriculum_items (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  curriculum_id uuid not null,
  technique_id uuid not null references public.techniques(id),
  required boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  -- An item can only belong to a curriculum of the SAME academy.
  constraint curriculum_items_curriculum_fk foreign key (curriculum_id, academy_id)
    references public.curricula (id, academy_id) on delete cascade,
  unique (curriculum_id, technique_id)
);
create index curriculum_items_technique_idx on public.curriculum_items (academy_id, technique_id);

create table public.skill_assessments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  user_id uuid not null references auth.users(id),
  technique_id uuid not null references public.techniques(id),
  status text not null default 'not_started' check (status in ('not_started', 'studied', 'practicing', 'validated')),
  status_source text not null check (status_source in ('self', 'teacher')),
  assessed_by uuid references auth.users(id),
  assessed_at timestamptz,
  note text check (note is null or length(note) <= 500),
  updated_at timestamptz not null default now(),
  unique (academy_id, user_id, technique_id),
  -- "validated" can only come from a teacher, with who and when.
  constraint skill_validated_by_teacher_chk check (
    status <> 'validated' or (status_source = 'teacher' and assessed_by is not null and assessed_at is not null)
  )
);
create index skill_assessments_user_idx on public.skill_assessments (user_id, academy_id);

alter table public.curricula enable row level security;
alter table public.curriculum_items enable row level security;
alter table public.skill_assessments enable row level security;

create policy curricula_read on public.curricula for select to authenticated
  using (public.is_platform_admin() or public.is_academy_member(academy_id));
create policy curriculum_items_read on public.curriculum_items for select to authenticated
  using (public.is_platform_admin() or public.is_academy_member(academy_id));
-- Own progress; teachers who may assess or view progress (the manager and platform admin always may).
create policy skill_assessments_read on public.skill_assessments for select to authenticated using (
  user_id = (select auth.uid())
  or public.has_academy_permission(academy_id, 'assess_skills')
  or public.has_academy_permission(academy_id, 'view_progress')
);
grant select on public.curricula, public.curriculum_items, public.skill_assessments to authenticated;

-- Curriculum configuration (manager / platform admin) -------------------------------------------------

create function public.create_curriculum(p_academy_id uuid, p_title text, p_level text, p_idempotency_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_title text := btrim(coalesce(p_title, ''));
  v_level text := nullif(btrim(coalesce(p_level, '')), '');
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;
  select entity_id into v_id from public.audit_events
    where actor_user_id = v_actor and action = 'curriculum.create' and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;

  if not exists (select 1 from public.academies where id = p_academy_id) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if length(v_title) not between 2 and 120 then raise exception 'VALIDATION_ERROR: title' using errcode = '22023'; end if;
  if v_level is not null and length(v_level) not between 2 and 40 then raise exception 'VALIDATION_ERROR: level' using errcode = '22023'; end if;

  insert into public.curricula (academy_id, title, level) values (p_academy_id, v_title, v_level) returning id into v_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (p_academy_id, v_actor, 'curriculum.create', 'curricula', v_id, jsonb_build_object('title', v_title, 'level', v_level), p_idempotency_key);
  return v_id;
end;
$$;

create function public.update_curriculum(p_curriculum_id uuid, p_title text, p_level text, p_is_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.curricula%rowtype;
  v_title text := btrim(coalesce(p_title, ''));
  v_level text := nullif(btrim(coalesce(p_level, '')), '');
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_c from public.curricula where id = p_curriculum_id;
  if not found or not (public.is_platform_admin() or public.is_academy_manager(v_c.academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(v_title) not between 2 and 120 then raise exception 'VALIDATION_ERROR: title' using errcode = '22023'; end if;
  if v_level is not null and length(v_level) not between 2 and 40 then raise exception 'VALIDATION_ERROR: level' using errcode = '22023'; end if;

  update public.curricula set title = v_title, level = v_level, is_active = coalesce(p_is_active, true) where id = p_curriculum_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_c.academy_id, v_actor, 'curriculum.update', 'curricula', p_curriculum_id,
      jsonb_build_object('before', jsonb_build_object('title', v_c.title, 'level', v_c.level, 'is_active', v_c.is_active),
                         'after', jsonb_build_object('title', v_title, 'level', v_level, 'is_active', coalesce(p_is_active, true))));
end;
$$;

-- A technique is usable by an academy when it is global or belongs to that academy.
create function public.add_curriculum_item(p_curriculum_id uuid, p_technique_id uuid, p_required boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.curricula%rowtype;
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_c from public.curricula where id = p_curriculum_id;
  if not found or not (public.is_platform_admin() or public.is_academy_manager(v_c.academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.techniques t where t.id = p_technique_id and (t.academy_id is null or t.academy_id = v_c.academy_id)) then
    raise exception 'VALIDATION_ERROR: technique' using errcode = '22023';
  end if;
  select id into v_id from public.curriculum_items where curriculum_id = p_curriculum_id and technique_id = p_technique_id;
  if v_id is not null then return v_id; end if; -- already in the trail

  insert into public.curriculum_items (academy_id, curriculum_id, technique_id, required, position)
    values (v_c.academy_id, p_curriculum_id, p_technique_id, coalesce(p_required, true),
            coalesce((select max(i.position) + 1 from public.curriculum_items i where i.curriculum_id = p_curriculum_id), 1))
    returning id into v_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_c.academy_id, v_actor, 'curriculum.item_add', 'curriculum_items', v_id,
      jsonb_build_object('curriculum_id', p_curriculum_id, 'technique_id', p_technique_id));
  return v_id;
end;
$$;

-- Adds every global technique that appears in the given level of the imported spreadsheet (technique_sources).
create function public.add_curriculum_items_from_level(p_curriculum_id uuid, p_level text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.curricula%rowtype;
  v_start int;
  v_count int;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_c from public.curricula where id = p_curriculum_id;
  if not found or not (public.is_platform_admin() or public.is_academy_manager(v_c.academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.technique_sources s where s.level = p_level) then
    raise exception 'VALIDATION_ERROR: level' using errcode = '22023';
  end if;

  select coalesce(max(position), 0) into v_start from public.curriculum_items where curriculum_id = p_curriculum_id;
  with picked as (
    select t.id, row_number() over (order by t.category, t.name) as rn
    from public.techniques t
    where t.academy_id is null
      and exists (select 1 from public.technique_sources s where s.technique_id = t.id and s.level = p_level)
      and not exists (select 1 from public.curriculum_items i where i.curriculum_id = p_curriculum_id and i.technique_id = t.id)
  ), ins as (
    insert into public.curriculum_items (academy_id, curriculum_id, technique_id, required, position)
      select v_c.academy_id, p_curriculum_id, id, true, v_start + rn from picked
      returning 1
  )
  select count(*)::int into v_count from ins;

  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_c.academy_id, v_actor, 'curriculum.items_from_level', 'curricula', p_curriculum_id,
      jsonb_build_object('level', p_level, 'added', v_count));
  return v_count;
end;
$$;

create function public.remove_curriculum_item(p_item_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_i public.curriculum_items%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_i from public.curriculum_items where id = p_item_id;
  if not found or not (public.is_platform_admin() or public.is_academy_manager(v_i.academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  delete from public.curriculum_items where id = p_item_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_i.academy_id, v_actor, 'curriculum.item_remove', 'curriculum_items', p_item_id,
      jsonb_build_object('curriculum_id', v_i.curriculum_id, 'technique_id', v_i.technique_id));
end;
$$;

create function public.set_curriculum_item_required(p_item_id uuid, p_required boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_i public.curriculum_items%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_i from public.curriculum_items where id = p_item_id;
  if not found or not (public.is_platform_admin() or public.is_academy_manager(v_i.academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_i.required = coalesce(p_required, true) then return; end if;
  update public.curriculum_items set required = coalesce(p_required, true) where id = p_item_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_i.academy_id, v_actor, 'curriculum.item_required', 'curriculum_items', p_item_id,
      jsonb_build_object('required', coalesce(p_required, true)));
end;
$$;

-- Skill progress -------------------------------------------------------------------------------------

-- The student declares studied / practicing / not_started on a technique of the academy's active trail.
-- It never produces "validated" and never overwrites a teacher's validation.
create function public.declare_skill(p_academy_id uuid, p_technique_id uuid, p_status text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_current public.skill_assessments%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_academy_member(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('not_started', 'studied', 'practicing') then
    raise exception 'VALIDATION_ERROR: status' using errcode = '22023';
  end if;
  if not exists (select 1 from public.curriculum_items i join public.curricula c on c.id = i.curriculum_id
                 where i.academy_id = p_academy_id and i.technique_id = p_technique_id and c.is_active) then
    raise exception 'VALIDATION_ERROR: technique not in the trail' using errcode = '22023';
  end if;

  select * into v_current from public.skill_assessments
    where academy_id = p_academy_id and user_id = v_actor and technique_id = p_technique_id;
  if found then
    if v_current.status = 'validated' then raise exception 'CONFLICT: validated by teacher' using errcode = '23505'; end if;
    update public.skill_assessments set status = p_status, status_source = 'self', updated_at = now() where id = v_current.id;
  else
    insert into public.skill_assessments (academy_id, user_id, technique_id, status, status_source)
      values (p_academy_id, v_actor, p_technique_id, p_status, 'self');
  end if;
  return p_status;
end;
$$;

-- A teacher (assess_skills) or the manager sets the status of a member. Nobody validates themselves.
create function public.assess_skill(
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
    if v_prev.metadata ->> 'user_id' <> p_user_id::text or v_prev.metadata ->> 'technique_id' <> p_technique_id::text then
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

revoke all on function public.create_curriculum(uuid, text, text, uuid), public.update_curriculum(uuid, text, text, boolean),
  public.add_curriculum_item(uuid, uuid, boolean), public.add_curriculum_items_from_level(uuid, text),
  public.remove_curriculum_item(uuid), public.set_curriculum_item_required(uuid, boolean),
  public.declare_skill(uuid, uuid, text), public.assess_skill(uuid, uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_curriculum(uuid, text, text, uuid), public.update_curriculum(uuid, text, text, boolean),
  public.add_curriculum_item(uuid, uuid, boolean), public.add_curriculum_items_from_level(uuid, text),
  public.remove_curriculum_item(uuid), public.set_curriculum_item_required(uuid, boolean),
  public.declare_skill(uuid, uuid, text), public.assess_skill(uuid, uuid, uuid, text, text, uuid)
  to authenticated;
