-- US-003: platform admin, academy creators, audit trail, instructor permissions and
-- server-side operations. Clients never write these tables directly (ADR-009).
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, P0002 NOT_FOUND, 23505 CONFLICT, 22023 VALIDATION_ERROR.

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.academy_creators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid references public.academies(id),
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key uuid,
  created_at timestamptz not null default now()
);
create unique index audit_events_idempotency_idx
  on public.audit_events (actor_user_id, action, idempotency_key) where idempotency_key is not null;
create index audit_events_academy_idx on public.audit_events (academy_id, created_at desc);

-- Presence of a row = permission granted to the role. Catalog is a proposal (docs/features/US-003.md).
create table public.academy_role_permissions (
  academy_id uuid not null references public.academies(id) on delete cascade,
  role public.membership_role not null check (role = 'instructor'),
  permission text not null check (permission in
    ('view_roster','validate_attendance','assess_skills','recommend_graduation','view_progress')),
  primary key (academy_id, role, permission)
);

alter table public.platform_admins enable row level security;
alter table public.academy_creators enable row level security;
alter table public.audit_events enable row level security;
alter table public.academy_role_permissions enable row level security;

-- Helpers: security definer to avoid RLS recursion; they only answer about the caller.
create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;
create function public.is_academy_member(p_academy_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
    where m.academy_id = p_academy_id and m.user_id = (select auth.uid()) and m.status = 'approved');
$$;
create function public.is_academy_manager(p_academy_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
    where m.academy_id = p_academy_id and m.user_id = (select auth.uid())
      and m.role = 'manager' and m.status = 'approved');
$$;
create function public.has_academy_permission(p_academy_id uuid, p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_platform_admin()
    or public.is_academy_manager(p_academy_id)
    or exists (
      select 1 from public.memberships m
      join public.academy_role_permissions p
        on p.academy_id = m.academy_id and p.role = m.role
      where m.academy_id = p_academy_id and m.user_id = (select auth.uid())
        and m.role = 'instructor' and m.status = 'approved' and p.permission = p_permission);
$$;

-- WCAG 2.x relative luminance and contrast ratio for '#RRGGBB'.
create function public.relative_luminance(p_hex text) returns double precision
language plpgsql immutable set search_path = '' as $$
declare
  v double precision; lin double precision[] := '{}'; i int;
begin
  for i in 0..2 loop
    v := (('x' || substr(p_hex, 2 + i * 2, 2))::bit(8)::int)::double precision / 255.0;
    lin := lin || (case when v <= 0.03928 then v / 12.92 else power((v + 0.055) / 1.055, 2.4) end);
  end loop;
  return 0.2126 * lin[1] + 0.7152 * lin[2] + 0.0722 * lin[3];
end;
$$;
create function public.contrast_ratio(p_a text, p_b text) returns double precision
language sql immutable set search_path = '' as $$
  select (greatest(public.relative_luminance(p_a), public.relative_luminance(p_b)) + 0.05)
       / (least(public.relative_luminance(p_a), public.relative_luminance(p_b)) + 0.05);
$$;

-- Read policies (all writes go through the operations below).
create policy academy_creators_read on public.academy_creators for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_admin());
create policy audit_events_read on public.audit_events for select to authenticated
  using (public.is_platform_admin() or (academy_id is not null and public.is_academy_manager(academy_id)));
create policy role_permissions_read on public.academy_role_permissions for select to authenticated
  using (public.is_platform_admin() or public.is_academy_member(academy_id));
create policy membership_platform_admin_read on public.memberships for select to authenticated
  using (public.is_platform_admin());
create policy membership_manager_read on public.memberships for select to authenticated
  using (public.is_academy_manager(academy_id));

-- Operations ---------------------------------------------------------------------------------

create function public.grant_academy_creator(p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_user uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  insert into public.academy_creators (user_id, granted_by) values (v_user, v_actor)
    on conflict (user_id) do update set granted_by = v_actor, granted_at = now(), revoked_at = null;
  insert into public.audit_events (actor_user_id, action, entity, entity_id)
    values (v_actor, 'academy_creator.grant', 'academy_creators', v_user);
  return v_user;
end;
$$;

create function public.revoke_academy_creator(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.academy_creators set revoked_at = now() where user_id = p_user_id and revoked_at is null;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  insert into public.audit_events (actor_user_id, action, entity, entity_id)
    values (v_actor, 'academy_creator.revoke', 'academy_creators', p_user_id);
end;
$$;

create function public.create_academy(p_name text, p_slug text, p_idempotency_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or exists (
      select 1 from public.academy_creators c where c.user_id = v_actor and c.revoked_at is null)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;

  select entity_id into v_id from public.audit_events
    where actor_user_id = v_actor and action = 'academy.create' and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;

  if length(v_name) not between 2 and 160 then raise exception 'VALIDATION_ERROR: name' using errcode = '22023'; end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'VALIDATION_ERROR: slug' using errcode = '22023'; end if;
  if exists (select 1 from public.academies where slug = v_slug) then raise exception 'CONFLICT: slug' using errcode = '23505'; end if;

  insert into public.academies (name, slug, owner_user_id) values (v_name, v_slug, v_actor) returning id into v_id;
  insert into public.memberships (academy_id, user_id, role, status, reviewed_by, reviewed_at)
    values (v_id, v_actor, 'manager', 'approved', v_actor, now());
  insert into public.academy_role_permissions (academy_id, role, permission)
    select v_id, 'instructor', p from unnest(array['view_roster','validate_attendance']) as p;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (v_id, v_actor, 'academy.create', 'academies', v_id, jsonb_build_object('slug', v_slug), p_idempotency_key);
  return v_id;
end;
$$;

create function public.update_academy_settings(
  p_academy_id uuid, p_name text, p_theme_primary text, p_theme_secondary text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_name text := trim(coalesce(p_name, ''));
  v_before jsonb;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(v_name) not between 2 and 160 then raise exception 'VALIDATION_ERROR: name' using errcode = '22023'; end if;
  if coalesce(p_theme_primary, '') !~ '^#[0-9A-Fa-f]{6}$' or coalesce(p_theme_secondary, '') !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'VALIDATION_ERROR: color' using errcode = '22023';
  end if;
  if public.contrast_ratio(p_theme_primary, p_theme_secondary) < 4.5 then
    raise exception 'VALIDATION_ERROR: contrast' using errcode = '22023';
  end if;

  select jsonb_build_object('name', name, 'theme_primary', theme_primary, 'theme_secondary', theme_secondary)
    into v_before from public.academies where id = p_academy_id;
  if v_before is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  update public.academies set name = v_name, theme_primary = upper(p_theme_primary), theme_secondary = upper(p_theme_secondary)
    where id = p_academy_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'academy.update_settings', 'academies', p_academy_id,
      jsonb_build_object('before', v_before,
        'after', jsonb_build_object('name', v_name, 'theme_primary', upper(p_theme_primary), 'theme_secondary', upper(p_theme_secondary))));
end;
$$;

create function public.set_instructor_permission(p_academy_id uuid, p_permission text, p_granted boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_permission is null or p_permission not in
     ('view_roster','validate_attendance','assess_skills','recommend_graduation','view_progress') then
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

-- Grants (ADR-009): reads only; execute only for authenticated, never PUBLIC/anon.
grant select on public.academy_creators, public.audit_events, public.academy_role_permissions to authenticated;

revoke all on function public.is_platform_admin(), public.is_academy_member(uuid), public.is_academy_manager(uuid),
  public.has_academy_permission(uuid, text), public.relative_luminance(text), public.contrast_ratio(text, text),
  public.grant_academy_creator(text), public.revoke_academy_creator(uuid), public.create_academy(text, text, uuid),
  public.update_academy_settings(uuid, text, text, text), public.set_instructor_permission(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.is_platform_admin(), public.is_academy_member(uuid), public.is_academy_manager(uuid),
  public.has_academy_permission(uuid, text),
  public.grant_academy_creator(text), public.revoke_academy_creator(uuid), public.create_academy(text, text, uuid),
  public.update_academy_settings(uuid, text, text, text), public.set_instructor_permission(uuid, text, boolean)
  to authenticated;
