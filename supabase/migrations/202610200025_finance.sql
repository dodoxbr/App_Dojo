-- US-017: manual financial control. The manager defines a plan per student (amount and due day: no default value), generates the
-- monthly charges (or creates one-off charges) and MARKS them by hand (paid, cancelled, waived). The platform does not receive or
-- process money, has no payment gateway, no CPF and no billing data. Every change is an immutable event. Money is in cents (BRL).
-- Who sees what: the manager sees the academy; a person sees their own charges; the legal guardian AND the financial responsible
-- see the minor's charges; instructors and the platform admin do not see finance.
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, 23505 CONFLICT, 22023 VALIDATION_ERROR.

create table public.member_plans (
  academy_id uuid not null references public.academies(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents int not null check (amount_cents between 1 and 10000000),
  due_day int not null check (due_day between 1 and 28),
  starts_on date not null,
  active boolean not null default true,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (academy_id, user_id)
);
alter table public.member_plans enable row level security;
create policy member_plans_read on public.member_plans for select to authenticated
  using (user_id = (select auth.uid()) or public.is_academy_manager(academy_id));
grant select on public.member_plans to authenticated;

create table public.charges (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('monthly', 'other')),
  reference_month date check (reference_month is null or extract(day from reference_month) = 1),
  description text check (description is null or length(btrim(description)) between 2 and 120),
  amount_cents int not null check (amount_cents between 1 and 10000000),
  due_date date not null,
  status text not null default 'open' check (status in ('open', 'paid', 'cancelled', 'waived')),
  paid_on date,
  paid_method text check (paid_method is null or paid_method in ('cash', 'pix', 'card', 'transfer', 'other')),
  status_note text check (status_note is null or length(status_note) <= 500),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint charges_kind_chk check (
    (kind = 'monthly' and reference_month is not null) or (kind = 'other' and description is not null)),
  constraint charges_paid_chk check ((status = 'paid') = (paid_on is not null and paid_method is not null))
);
-- One monthly charge per person and month, whatever its status (cancelling does not make it come back).
create unique index charges_monthly_idx on public.charges (academy_id, user_id, reference_month) where kind = 'monthly';
create index charges_academy_due_idx on public.charges (academy_id, due_date);
create index charges_user_idx on public.charges (user_id, due_date);
alter table public.charges enable row level security;
create policy charges_read on public.charges for select to authenticated
  using (user_id = (select auth.uid()) or public.is_academy_manager(academy_id));
grant select on public.charges to authenticated;

-- Append-only history of every change of a charge.
create table public.charge_events (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.charges(id) on delete cascade,
  academy_id uuid not null references public.academies(id),
  actor_user_id uuid not null references auth.users(id),
  event text not null check (event in ('created', 'paid', 'cancelled', 'waived', 'reopened')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index charge_events_charge_idx on public.charge_events (charge_id, created_at);
alter table public.charge_events enable row level security;
create trigger charge_events_immutable before update on public.charge_events
  for each row execute function public.prevent_mutation();

-- Today's date in the academy's time zone.
create function public.academy_today(p_academy_id uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce((select timezone from public.academies where id = p_academy_id), 'America/Sao_Paulo'))::date;
$$;

-- Plan of a student (only active approved students are billed).
create function public.set_member_plan(p_academy_id uuid, p_user_id uuid, p_amount_cents int, p_due_day int, p_starts_on date, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_today date := public.academy_today(p_academy_id);
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_academy_manager(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_amount_cents is null or p_amount_cents not between 1 and 10000000 then raise exception 'VALIDATION_ERROR: amount' using errcode = '22023'; end if;
  if p_due_day is null or p_due_day not between 1 and 28 then raise exception 'VALIDATION_ERROR: due_day' using errcode = '22023'; end if;
  if p_starts_on is null or p_starts_on not between v_today - 366 and v_today + 366 then raise exception 'VALIDATION_ERROR: starts_on' using errcode = '22023'; end if;
  if not exists (select 1 from public.memberships m
                 where m.academy_id = p_academy_id and m.user_id = p_user_id and m.role = 'student' and m.status = 'approved') then
    raise exception 'VALIDATION_ERROR: not a student' using errcode = '22023';
  end if;
  insert into public.member_plans (academy_id, user_id, amount_cents, due_day, starts_on, active, updated_by)
    values (p_academy_id, p_user_id, p_amount_cents, p_due_day, p_starts_on, coalesce(p_active, true), v_actor)
    on conflict (academy_id, user_id) do update set
      amount_cents = excluded.amount_cents, due_day = excluded.due_day, starts_on = excluded.starts_on,
      active = excluded.active, updated_by = excluded.updated_by, updated_at = now();
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'finance.plan', 'member_plans', p_user_id,
            jsonb_build_object('user_id', p_user_id, 'amount_cents', p_amount_cents, 'due_day', p_due_day, 'active', coalesce(p_active, true)));
end;
$$;

-- Generates the monthly charges of every active plan. Repeating the month (or the key) never duplicates.
create function public.generate_monthly_charges(p_academy_id uuid, p_month date, p_idempotency_key uuid) returns int
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

  with new_charges as (
    insert into public.charges (academy_id, user_id, kind, reference_month, amount_cents, due_date, created_by)
      select mp.academy_id, mp.user_id, 'monthly', p_month, mp.amount_cents, p_month + (mp.due_day - 1), v_actor
      from public.member_plans mp
      join public.memberships m on m.academy_id = mp.academy_id and m.user_id = mp.user_id and m.role = 'student' and m.status = 'approved'
      where mp.academy_id = p_academy_id and mp.active
        and mp.starts_on <= (p_month + interval '1 month' - interval '1 day')::date
      on conflict (academy_id, user_id, reference_month) where kind = 'monthly' do nothing
      returning id, amount_cents, due_date
  ), ev as (
    insert into public.charge_events (charge_id, academy_id, actor_user_id, event, data)
      select id, p_academy_id, v_actor, 'created', jsonb_build_object('amount_cents', amount_cents, 'due_date', due_date, 'month', p_month)
      from new_charges
      returning 1
  )
  select count(*)::int into v_created from new_charges;

  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (p_academy_id, v_actor, 'finance.generate', 'charges', null, jsonb_build_object('month', p_month, 'created', v_created), p_idempotency_key);
  return v_created;
end;
$$;

-- One-off charge (enrollment fee, uniform, exam...).
create function public.create_charge(p_academy_id uuid, p_user_id uuid, p_description text, p_amount_cents int, p_due_date date, p_idempotency_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_today date := public.academy_today(p_academy_id);
  v_desc text := btrim(coalesce(p_description, ''));
  v_prev public.audit_events%rowtype;
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_academy_manager(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;
  if length(v_desc) not between 2 and 120 then raise exception 'VALIDATION_ERROR: description' using errcode = '22023'; end if;
  if p_amount_cents is null or p_amount_cents not between 1 and 10000000 then raise exception 'VALIDATION_ERROR: amount' using errcode = '22023'; end if;
  if p_due_date is null or p_due_date not between v_today - 366 and v_today + 366 then raise exception 'VALIDATION_ERROR: due_date' using errcode = '22023'; end if;
  if not exists (select 1 from public.memberships m where m.academy_id = p_academy_id and m.user_id = p_user_id and m.status in ('approved', 'pending', 'suspended')) then
    raise exception 'VALIDATION_ERROR: not a member' using errcode = '22023';
  end if;

  select * into v_prev from public.audit_events
    where actor_user_id = v_actor and action = 'finance.create_charge' and idempotency_key = p_idempotency_key;
  if found then
    if v_prev.academy_id <> p_academy_id or v_prev.metadata ->> 'user_id' <> p_user_id::text or v_prev.metadata ->> 'description' <> v_desc
       or (v_prev.metadata ->> 'amount_cents')::int <> p_amount_cents or v_prev.metadata ->> 'due_date' <> p_due_date::text then
      raise exception 'VALIDATION_ERROR: idempotency_key reused' using errcode = '22023';
    end if;
    return v_prev.entity_id;
  end if;

  insert into public.charges (academy_id, user_id, kind, description, amount_cents, due_date, created_by)
    values (p_academy_id, p_user_id, 'other', v_desc, p_amount_cents, p_due_date, v_actor) returning id into v_id;
  insert into public.charge_events (charge_id, academy_id, actor_user_id, event, data)
    values (v_id, p_academy_id, v_actor, 'created', jsonb_build_object('amount_cents', p_amount_cents, 'due_date', p_due_date, 'description', v_desc));
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (p_academy_id, v_actor, 'finance.create_charge', 'charges', v_id,
            jsonb_build_object('user_id', p_user_id, 'description', v_desc, 'amount_cents', p_amount_cents, 'due_date', p_due_date), p_idempotency_key);
  return v_id;
end;
$$;

-- The manager marks that the payment was received (by hand, outside the platform).
create function public.mark_charge_paid(p_charge_id uuid, p_method text, p_paid_on date, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.charges%rowtype;
  v_today date;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_c from public.charges where id = p_charge_id;
  if not found or not public.is_academy_manager(v_c.academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  v_today := public.academy_today(v_c.academy_id);
  if p_method is null or p_method not in ('cash', 'pix', 'card', 'transfer', 'other') then raise exception 'VALIDATION_ERROR: method' using errcode = '22023'; end if;
  if p_paid_on is null or p_paid_on > v_today or p_paid_on < v_today - 730 then raise exception 'VALIDATION_ERROR: paid_on' using errcode = '22023'; end if;
  if v_note is not null and length(v_note) > 500 then raise exception 'VALIDATION_ERROR: note' using errcode = '22023'; end if;
  if v_c.status = 'paid' and v_c.paid_method = p_method and v_c.paid_on = p_paid_on then return; end if;
  if v_c.status <> 'open' then raise exception 'CONFLICT: not open' using errcode = '23505'; end if;

  update public.charges set status = 'paid', paid_on = p_paid_on, paid_method = p_method, status_note = v_note, updated_at = now() where id = p_charge_id;
  insert into public.charge_events (charge_id, academy_id, actor_user_id, event, data)
    values (p_charge_id, v_c.academy_id, v_actor, 'paid', jsonb_build_object('method', p_method, 'paid_on', p_paid_on, 'note', v_note));
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_c.academy_id, v_actor, 'finance.paid', 'charges', p_charge_id, jsonb_build_object('user_id', v_c.user_id, 'method', p_method));
end;
$$;

-- Shared by cancel / waive / reopen. Not callable by clients.
create function public.charge_transition(p_charge_id uuid, p_from text[], p_to text, p_event text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.charges%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_c from public.charges where id = p_charge_id;
  if not found or not public.is_academy_manager(v_c.academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if length(v_reason) not between 3 and 500 then raise exception 'VALIDATION_ERROR: reason' using errcode = '22023'; end if;
  if v_c.status = p_to then return; end if;
  if not (v_c.status = any (p_from)) then raise exception 'CONFLICT: wrong state' using errcode = '23505'; end if;

  update public.charges
    set status = p_to, paid_on = null, paid_method = null, status_note = v_reason, updated_at = now()
    where id = p_charge_id;
  insert into public.charge_events (charge_id, academy_id, actor_user_id, event, data)
    values (p_charge_id, v_c.academy_id, v_actor, p_event, jsonb_build_object('reason', v_reason, 'previous_status', v_c.status));
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_c.academy_id, v_actor, 'finance.' || p_event, 'charges', p_charge_id, jsonb_build_object('user_id', v_c.user_id, 'previous_status', v_c.status));
end;
$$;

create function public.cancel_charge(p_charge_id uuid, p_reason text) returns void
language sql security definer set search_path = '' as $$
  select public.charge_transition(p_charge_id, array['open'], 'cancelled', 'cancelled', p_reason);
$$;
create function public.waive_charge(p_charge_id uuid, p_reason text) returns void
language sql security definer set search_path = '' as $$
  select public.charge_transition(p_charge_id, array['open'], 'waived', 'waived', p_reason);
$$;
-- Correction: a charge marked by mistake goes back to open (the history keeps everything).
create function public.reopen_charge(p_charge_id uuid, p_reason text) returns void
language sql security definer set search_path = '' as $$
  select public.charge_transition(p_charge_id, array['paid', 'cancelled', 'waived'], 'open', 'reopened', p_reason);
$$;

-- Charges whose due date falls in the month (manager). "overdue" = still open after the due date, by the academy's date.
create function public.list_academy_charges(p_academy_id uuid, p_month date)
returns table (id uuid, user_id uuid, student_name text, kind text, description text, reference_month date, amount_cents int, due_date date,
               status text, overdue boolean, paid_on date, paid_method text, status_note text, financial_name text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := public.academy_today(p_academy_id);
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_academy_manager(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_month is null or extract(day from p_month) <> 1 then raise exception 'VALIDATION_ERROR: month' using errcode = '22023'; end if;
  return query
    select c.id, c.user_id, p.display_name, c.kind, c.description, c.reference_month, c.amount_cents, c.due_date, c.status,
           c.status = 'open' and c.due_date < v_today, c.paid_on, c.paid_method, c.status_note,
           (select pg.display_name from public.guardianships g join public.profiles pg on pg.id = g.guardian_user_id
             where g.minor_user_id = c.user_id order by (g.kind = 'financial') desc limit 1)
    from public.charges c join public.profiles p on p.id = c.user_id
    where c.academy_id = p_academy_id and c.due_date >= p_month and c.due_date < (p_month + interval '1 month')::date
    order by c.due_date, p.display_name;
end;
$$;

create function public.finance_summary(p_academy_id uuid, p_month date)
returns table (charges int, billed_cents bigint, received_cents bigint, open_cents bigint, overdue_cents bigint,
               waived_cents bigint, cancelled_cents bigint, paid_count int, overdue_count int)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := public.academy_today(p_academy_id);
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_academy_manager(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_month is null or extract(day from p_month) <> 1 then raise exception 'VALIDATION_ERROR: month' using errcode = '22023'; end if;
  return query
    select count(*)::int,
           coalesce(sum(c.amount_cents) filter (where c.status in ('open', 'paid')), 0)::bigint,
           coalesce(sum(c.amount_cents) filter (where c.status = 'paid'), 0)::bigint,
           coalesce(sum(c.amount_cents) filter (where c.status = 'open'), 0)::bigint,
           coalesce(sum(c.amount_cents) filter (where c.status = 'open' and c.due_date < v_today), 0)::bigint,
           coalesce(sum(c.amount_cents) filter (where c.status = 'waived'), 0)::bigint,
           coalesce(sum(c.amount_cents) filter (where c.status = 'cancelled'), 0)::bigint,
           (count(*) filter (where c.status = 'paid'))::int,
           (count(*) filter (where c.status = 'open' and c.due_date < v_today))::int
    from public.charges c
    where c.academy_id = p_academy_id and c.due_date >= p_month and c.due_date < (p_month + interval '1 month')::date;
end;
$$;

-- Approved students with their plan (manager).
create function public.list_member_plans(p_academy_id uuid)
returns table (user_id uuid, student_name text, is_minor boolean, financial_name text, amount_cents int, due_day int, starts_on date, active boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_academy_manager(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select m.user_id, p.display_name, not public.is_adult(m.user_id),
           (select pg.display_name from public.guardianships g join public.profiles pg on pg.id = g.guardian_user_id
             where g.minor_user_id = m.user_id order by (g.kind = 'financial') desc limit 1),
           mp.amount_cents, mp.due_day, mp.starts_on, mp.active
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    left join public.member_plans mp on mp.academy_id = m.academy_id and mp.user_id = m.user_id
    where m.academy_id = p_academy_id and m.role = 'student' and m.status = 'approved'
    order by p.display_name;
end;
$$;

-- Everything the manager needs about one student: charges (newest first) and the change history.
create function public.student_finance(p_academy_id uuid, p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := public.academy_today(p_academy_id);
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_academy_manager(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.memberships m where m.academy_id = p_academy_id and m.user_id = p_user_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'name', (select display_name from public.profiles where id = p_user_id),
    'plan', (select jsonb_build_object('amount_cents', mp.amount_cents, 'due_day', mp.due_day, 'starts_on', mp.starts_on, 'active', mp.active)
               from public.member_plans mp where mp.academy_id = p_academy_id and mp.user_id = p_user_id),
    'financial', (select jsonb_build_object('name', pg.display_name, 'kind', g.kind, 'relationship', g.relationship)
                    from public.guardianships g join public.profiles pg on pg.id = g.guardian_user_id
                   where g.minor_user_id = p_user_id order by (g.kind = 'financial') desc limit 1),
    'charges', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'kind', c.kind, 'description', c.description, 'reference_month', c.reference_month, 'amount_cents', c.amount_cents,
        'due_date', c.due_date, 'status', c.status, 'overdue', c.status = 'open' and c.due_date < v_today, 'paid_on', c.paid_on,
        'paid_method', c.paid_method, 'status_note', c.status_note) order by c.due_date desc)
      from public.charges c where c.academy_id = p_academy_id and c.user_id = p_user_id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object(
        'charge_id', e.charge_id, 'event', e.event, 'at', e.created_at, 'actor', pa.display_name, 'data', e.data) order by e.created_at desc)
      from public.charge_events e join public.charges c on c.id = e.charge_id join public.profiles pa on pa.id = e.actor_user_id
      where c.academy_id = p_academy_id and c.user_id = p_user_id), '[]'::jsonb));
end;
$$;

-- Own charges, or the charges of a minor for whom the caller is the legal guardian or the financial responsible.
create function public.my_charges(p_user_id uuid default null)
returns table (id uuid, user_id uuid, person_name text, academy_id uuid, academy_name text, kind text, description text,
               reference_month date, amount_cents int, due_date date, status text, overdue boolean, paid_on date, paid_method text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_target uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  v_target := coalesce(p_user_id, v_actor);
  if v_target <> v_actor and not (
      exists (select 1 from public.guardianships g where g.minor_user_id = v_target and g.guardian_user_id = v_actor) and not public.is_adult(v_target)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
    select c.id, c.user_id, p.display_name, c.academy_id, a.name, c.kind, c.description, c.reference_month, c.amount_cents, c.due_date, c.status,
           c.status = 'open' and c.due_date < public.academy_today(c.academy_id), c.paid_on, c.paid_method
    from public.charges c join public.academies a on a.id = c.academy_id join public.profiles p on p.id = c.user_id
    where c.user_id = v_target
    order by c.due_date desc;
end;
$$;

revoke all on function public.academy_today(uuid), public.charge_transition(uuid, text[], text, text, text),
  public.set_member_plan(uuid, uuid, int, int, date, boolean), public.generate_monthly_charges(uuid, date, uuid),
  public.create_charge(uuid, uuid, text, int, date, uuid), public.mark_charge_paid(uuid, text, date, text),
  public.cancel_charge(uuid, text), public.waive_charge(uuid, text), public.reopen_charge(uuid, text),
  public.list_academy_charges(uuid, date), public.finance_summary(uuid, date), public.list_member_plans(uuid),
  public.student_finance(uuid, uuid), public.my_charges(uuid) from public, anon, authenticated;
grant execute on function public.set_member_plan(uuid, uuid, int, int, date, boolean), public.generate_monthly_charges(uuid, date, uuid),
  public.create_charge(uuid, uuid, text, int, date, uuid), public.mark_charge_paid(uuid, text, date, text),
  public.cancel_charge(uuid, text), public.waive_charge(uuid, text), public.reopen_charge(uuid, text),
  public.list_academy_charges(uuid, date), public.finance_summary(uuid, date), public.list_member_plans(uuid),
  public.student_finance(uuid, uuid), public.my_charges(uuid) to authenticated;
