-- Owner decisions of 2026-10-20 after US-017:
--  (1) monthly charges can be generated automatically (a daily pg_cron job; each academy turns it on or off);
--  (2) a plan can carry a fixed discount with a reason (siblings, scholarship...), applied to the generated charge;
--  (3) teachers must see the health notes and the emergency contact: new instructor permission 'view_health', ON by default
--      and switchable by the manager. The platform admin does NOT see health data. Every read is audited (count only).
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, 22023 VALIDATION_ERROR.

-- ---- (3) health notes for the teacher -----------------------------------------------------------------------------
alter table public.academy_role_permissions drop constraint academy_role_permissions_permission_check;
alter table public.academy_role_permissions add constraint academy_role_permissions_permission_check check (permission in
  ('view_roster', 'validate_attendance', 'assess_skills', 'recommend_graduation', 'view_progress', 'view_health'));

-- Same function as 004 with the new permission in the accepted list.
create or replace function public.set_instructor_permission(p_academy_id uuid, p_permission text, p_granted boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_permission is null or p_permission not in
     ('view_roster', 'validate_attendance', 'assess_skills', 'recommend_graduation', 'view_progress', 'view_health') then
    raise exception 'VALIDATION_ERROR: permission' using errcode = '22023';
  end if;
  if not exists (select 1 from public.academies where id = p_academy_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if coalesce(p_granted, false) then
    insert into public.academy_role_permissions (academy_id, role, permission)
      values (p_academy_id, 'instructor', p_permission) on conflict do nothing;
  else
    delete from public.academy_role_permissions
      where academy_id = p_academy_id and role = 'instructor' and permission = p_permission;
  end if;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'academy.set_instructor_permission', 'academy_role_permissions', p_academy_id,
      jsonb_build_object('permission', p_permission, 'granted', coalesce(p_granted, false)));
end;
$$;

-- On by default (owner decision): existing academies and every new one.
insert into public.academy_role_permissions (academy_id, role, permission)
  select id, 'instructor', 'view_health' from public.academies on conflict do nothing;

create function public.grant_default_health_view() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.academy_role_permissions (academy_id, role, permission) values (new.id, 'instructor', 'view_health') on conflict do nothing;
  return new;
end;
$$;
create trigger academies_default_health_view after insert on public.academies
  for each row execute function public.grant_default_health_view();

-- The manager, or an approved instructor who holds the permission. NOT the platform admin.
create function public.can_view_health(p_academy_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_academy_manager(p_academy_id) or exists (
    select 1 from public.memberships m
    join public.academy_role_permissions p on p.academy_id = m.academy_id and p.role = m.role
    where m.academy_id = p_academy_id and m.user_id = (select auth.uid())
      and m.role = 'instructor' and m.status = 'approved' and p.permission = 'view_health');
$$;

-- Everyone in the academy who has health notes, with the emergency contact.
create function public.list_health_notes(p_academy_id uuid)
returns table (user_id uuid, person_name text, is_minor boolean, health_notes text, emergency_name text, emergency_phone text, emergency_relationship text)
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.can_view_health(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select count(*)::int into v_count
    from public.memberships m join public.profile_contacts c on c.user_id = m.user_id and c.health_notes is not null
    where m.academy_id = p_academy_id and m.status = 'approved' and m.role = 'student';
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, (select auth.uid()), 'health.view', 'profile_contacts', null, jsonb_build_object('scope', 'academy', 'people', v_count));
  return query
    select m.user_id, p.display_name, not public.is_adult(m.user_id), c.health_notes, c.emergency_name, c.emergency_phone, c.emergency_relationship
    from public.memberships m
    join public.profile_contacts c on c.user_id = m.user_id and c.health_notes is not null
    join public.profiles p on p.id = m.user_id
    where m.academy_id = p_academy_id and m.status = 'approved' and m.role = 'student'
    order by p.display_name;
end;
$$;

-- Health notes of the people who asked for / have attendance in one lesson (what the teacher needs at the mat).
create function public.session_health_notes(p_session_id uuid)
returns table (user_id uuid, person_name text, attendance_status text, health_notes text, emergency_name text, emergency_phone text, emergency_relationship text)
language plpgsql security definer set search_path = '' as $$
declare
  v_academy uuid;
  v_count int;
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select academy_id into v_academy from public.sessions where id = p_session_id;
  if v_academy is null or not public.can_view_health(v_academy) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select count(*)::int into v_count
    from public.attendances a join public.profile_contacts c on c.user_id = a.user_id and c.health_notes is not null
    where a.session_id = p_session_id and a.status in ('pending', 'validated');
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_academy, (select auth.uid()), 'health.view', 'sessions', p_session_id, jsonb_build_object('scope', 'session', 'people', v_count));
  return query
    select a.user_id, p.display_name, a.status, c.health_notes, c.emergency_name, c.emergency_phone, c.emergency_relationship
    from public.attendances a
    join public.profile_contacts c on c.user_id = a.user_id and c.health_notes is not null
    join public.profiles p on p.id = a.user_id
    where a.session_id = p_session_id and a.status in ('pending', 'validated')
    order by p.display_name;
end;
$$;

-- ---- (2) discount in the plan ---------------------------------------------------------------------------------------
alter table public.member_plans
  add column discount_cents int not null default 0 check (discount_cents >= 0),
  add column discount_note text check (discount_note is null or length(btrim(discount_note)) between 2 and 120),
  add constraint member_plans_discount_chk check (discount_cents < amount_cents and (discount_cents = 0 or discount_note is not null));
alter table public.charges add column discount_cents int not null default 0 check (discount_cents >= 0);

drop function public.set_member_plan(uuid, uuid, int, int, date, boolean);
create function public.set_member_plan(
  p_academy_id uuid, p_user_id uuid, p_amount_cents int, p_due_day int, p_starts_on date, p_active boolean,
  p_discount_cents int, p_discount_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_today date := public.academy_today(p_academy_id);
  v_discount int := coalesce(p_discount_cents, 0);
  v_note text := nullif(btrim(coalesce(p_discount_note, '')), '');
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_academy_manager(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_amount_cents is null or p_amount_cents not between 1 and 10000000 then raise exception 'VALIDATION_ERROR: amount' using errcode = '22023'; end if;
  if p_due_day is null or p_due_day not between 1 and 28 then raise exception 'VALIDATION_ERROR: due_day' using errcode = '22023'; end if;
  if p_starts_on is null or p_starts_on not between v_today - 366 and v_today + 366 then raise exception 'VALIDATION_ERROR: starts_on' using errcode = '22023'; end if;
  -- The discount is a fixed amount below the plan value and always has a reason (siblings, scholarship...).
  if v_discount < 0 or v_discount >= p_amount_cents then raise exception 'VALIDATION_ERROR: discount' using errcode = '22023'; end if;
  if v_discount > 0 and (v_note is null or length(v_note) not between 2 and 120) then raise exception 'VALIDATION_ERROR: discount note' using errcode = '22023'; end if;
  if v_discount = 0 then v_note := null; end if;
  if not exists (select 1 from public.memberships m
                 where m.academy_id = p_academy_id and m.user_id = p_user_id and m.role = 'student' and m.status = 'approved') then
    raise exception 'VALIDATION_ERROR: not a student' using errcode = '22023';
  end if;
  insert into public.member_plans (academy_id, user_id, amount_cents, due_day, starts_on, active, discount_cents, discount_note, updated_by)
    values (p_academy_id, p_user_id, p_amount_cents, p_due_day, p_starts_on, coalesce(p_active, true), v_discount, v_note, v_actor)
    on conflict (academy_id, user_id) do update set
      amount_cents = excluded.amount_cents, due_day = excluded.due_day, starts_on = excluded.starts_on, active = excluded.active,
      discount_cents = excluded.discount_cents, discount_note = excluded.discount_note, updated_by = excluded.updated_by, updated_at = now();
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'finance.plan', 'member_plans', p_user_id,
            jsonb_build_object('user_id', p_user_id, 'amount_cents', p_amount_cents, 'due_day', p_due_day, 'active', coalesce(p_active, true),
                               'discount_cents', v_discount));
end;
$$;

drop function public.list_member_plans(uuid);
create function public.list_member_plans(p_academy_id uuid)
returns table (user_id uuid, student_name text, is_minor boolean, financial_name text, amount_cents int, due_day int, starts_on date, active boolean,
               discount_cents int, discount_note text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_academy_manager(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select m.user_id, p.display_name, not public.is_adult(m.user_id),
           (select pg.display_name from public.guardianships g join public.profiles pg on pg.id = g.guardian_user_id
             where g.minor_user_id = m.user_id order by (g.kind = 'financial') desc limit 1),
           mp.amount_cents, mp.due_day, mp.starts_on, mp.active, mp.discount_cents, mp.discount_note
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    left join public.member_plans mp on mp.academy_id = m.academy_id and mp.user_id = m.user_id
    where m.academy_id = p_academy_id and m.role = 'student' and m.status = 'approved'
    order by p.display_name;
end;
$$;

-- ---- (1) automatic monthly charges ------------------------------------------------------------------------------------
alter table public.academies add column auto_charges boolean not null default false;

-- The insert that was inside generate_monthly_charges (021/025), now shared with the daily job. Not callable by clients.
create function public.generate_charges_core(p_academy_id uuid, p_month date, p_actor uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_created int;
begin
  with new_charges as (
    insert into public.charges (academy_id, user_id, kind, reference_month, amount_cents, discount_cents, due_date, created_by)
      select mp.academy_id, mp.user_id, 'monthly', p_month, mp.amount_cents - mp.discount_cents, mp.discount_cents, p_month + (mp.due_day - 1), p_actor
      from public.member_plans mp
      join public.memberships m on m.academy_id = mp.academy_id and m.user_id = mp.user_id and m.role = 'student' and m.status = 'approved'
      where mp.academy_id = p_academy_id and mp.active
        and mp.starts_on <= (p_month + interval '1 month' - interval '1 day')::date
      on conflict (academy_id, user_id, reference_month) where kind = 'monthly' do nothing
      returning id, amount_cents, discount_cents, due_date
  ), ev as (
    insert into public.charge_events (charge_id, academy_id, actor_user_id, event, data)
      select id, p_academy_id, p_actor, 'created',
             jsonb_build_object('amount_cents', amount_cents, 'discount_cents', discount_cents, 'due_date', due_date, 'month', p_month)
      from new_charges
      returning 1
  )
  select count(*)::int into v_created from new_charges;
  return v_created;
end;
$$;

create or replace function public.generate_monthly_charges(p_academy_id uuid, p_month date, p_idempotency_key uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_today date := public.academy_today(p_academy_id);
  v_prev public.audit_events%rowtype;
  v_created int;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_academy_manager(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;
  if p_month is null or extract(day from p_month) <> 1
     or p_month not between (date_trunc('month', v_today) - interval '24 months')::date and (date_trunc('month', v_today) + interval '3 months')::date then
    raise exception 'VALIDATION_ERROR: month' using errcode = '22023';
  end if;

  select * into v_prev from public.audit_events
    where actor_user_id = v_actor and action = 'finance.generate' and idempotency_key = p_idempotency_key;
  if found then
    if v_prev.academy_id <> p_academy_id or v_prev.metadata ->> 'month' <> p_month::text then
      raise exception 'VALIDATION_ERROR: idempotency_key reused' using errcode = '22023';
    end if;
    return (v_prev.metadata ->> 'created')::int;
  end if;

  v_created := public.generate_charges_core(p_academy_id, p_month, v_actor);
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (p_academy_id, v_actor, 'finance.generate', 'charges', null, jsonb_build_object('month', p_month, 'created', v_created), p_idempotency_key);
  return v_created;
end;
$$;

-- The manager turns the daily generation on or off for the academy.
create function public.set_auto_charges(p_academy_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_academy_manager(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.academies set auto_charges = coalesce(p_enabled, false) where id = p_academy_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'finance.auto', 'academies', p_academy_id, jsonb_build_object('enabled', coalesce(p_enabled, false)));
end;
$$;

-- Daily job: for each academy that turned it on, generate the CURRENT month (by the academy's own date). It catches up if a day
-- was missed and never duplicates (unique index). Charges are created in the name of the academy owner; the audit says "auto".
create function public.run_auto_charges() returns int
language plpgsql security definer set search_path = '' as $$
declare
  a record;
  v_month date;
  v_created int;
  v_total int := 0;
begin
  for a in select id, owner_user_id from public.academies where auto_charges loop
    v_month := date_trunc('month', public.academy_today(a.id))::date;
    v_created := public.generate_charges_core(a.id, v_month, a.owner_user_id);
    if v_created > 0 then
      insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
        values (a.id, a.owner_user_id, 'finance.generate', 'charges', null, jsonb_build_object('month', v_month, 'created', v_created, 'auto', true));
      v_total := v_total + v_created;
    end if;
  end loop;
  return v_total;
end;
$$;

create extension if not exists pg_cron;
-- 09:00 UTC = 06:00 in Sao Paulo. Same name = updates the job instead of duplicating it.
select cron.schedule('auto-charges', '0 9 * * *', 'select public.run_auto_charges()');

revoke all on function public.grant_default_health_view(), public.can_view_health(uuid), public.list_health_notes(uuid),
  public.session_health_notes(uuid), public.set_member_plan(uuid, uuid, int, int, date, boolean, int, text), public.list_member_plans(uuid),
  public.generate_charges_core(uuid, date, uuid), public.set_auto_charges(uuid, boolean), public.run_auto_charges()
  from public, anon, authenticated;
grant execute on function public.list_health_notes(uuid), public.session_health_notes(uuid),
  public.set_member_plan(uuid, uuid, int, int, date, boolean, int, text), public.list_member_plans(uuid),
  public.set_auto_charges(uuid, boolean) to authenticated;
