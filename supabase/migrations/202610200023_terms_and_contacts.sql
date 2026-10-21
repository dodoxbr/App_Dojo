-- US-016: terms accepted at sign-up and the registration form (ficha de cadastro). Terms text is a DRAFT pending legal review
-- (docs/11). The ficha holds personal data (full name, phone, address): private table, read only by the person, the legal
-- guardian (for a minor) and the manager of an academy where the person has a membership (every manager read is audited).
-- Without a complete ficha nobody asks to join, is added to an academy, or gets a place requested for them.
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, 22023 VALIDATION_ERROR.

create table public.terms_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  document text not null check (document in ('terms_of_use', 'privacy_policy')),
  version text not null check (length(version) between 3 and 40),
  accepted_at timestamptz not null default now(),
  primary key (user_id, document, version)
);
alter table public.terms_acceptances enable row level security;
create policy terms_acceptances_self_read on public.terms_acceptances for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.terms_acceptances to authenticated;

-- The sign-up form sends the accepted terms version in the metadata; the trigger records it (dependents never accept alone:
-- their guardian accepts for themselves and gives the consent of 021).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_birth date;
  v_terms text;
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
  v_terms := left(trim(coalesce(new.raw_user_meta_data ->> 'terms_version', '')), 40);
  if length(v_terms) >= 3 and coalesce(new.raw_user_meta_data ->> 'dependent', '') <> 'true' then
    insert into public.terms_acceptances (user_id, document, version)
      values (new.id, 'terms_of_use', v_terms), (new.id, 'privacy_policy', v_terms);
  end if;
  return new;
end;
$$;

-- Older accounts (or accounts that did not accept at sign-up) accept the current version here. Repeating is harmless.
create function public.accept_terms(p_version text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_version text := btrim(coalesce(p_version, ''));
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if length(v_version) not between 3 and 40 then raise exception 'VALIDATION_ERROR: version' using errcode = '22023'; end if;
  insert into public.terms_acceptances (user_id, document, version)
    values (v_actor, 'terms_of_use', v_version), (v_actor, 'privacy_policy', v_version)
    on conflict do nothing;
end;
$$;

-- The latest version the caller accepted (null if never). The screens compare it with the current version.
create function public.my_terms_version() returns text
language sql stable security definer set search_path = '' as $$
  select max(version) from public.terms_acceptances
  where user_id = (select auth.uid()) and document = 'terms_of_use';
$$;

create table public.profile_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 2 and 160),
  phone text not null check (phone ~ '^[0-9]{10,11}$'),
  postal_code text not null check (postal_code ~ '^[0-9]{8}$'),
  street text not null check (length(btrim(street)) between 2 and 160),
  number text not null check (length(btrim(number)) between 1 and 20),
  complement text check (complement is null or length(complement) <= 80),
  neighborhood text not null check (length(btrim(neighborhood)) between 2 and 80),
  city text not null check (length(btrim(city)) between 2 and 80),
  state text not null check (state ~ '^[A-Z]{2}$'),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.profile_contacts enable row level security;
create policy profile_contacts_self_read on public.profile_contacts for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.profile_contacts to authenticated;

create function public.has_contact(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profile_contacts where user_id = p_user_id);
$$;

-- The person fills their own ficha; the legal guardian fills the minor's. Phone and CEP are stored as digits.
create function public.save_contact(
  p_user_id uuid, p_full_name text, p_phone text, p_postal_code text, p_street text, p_number text,
  p_complement text, p_neighborhood text, p_city text, p_state text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_cep text := regexp_replace(coalesce(p_postal_code, ''), '\D', '', 'g');
  v_state text := upper(btrim(coalesce(p_state, '')));
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (p_user_id = v_actor or public.is_legal_guardian_of(p_user_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_full_name, ''))) not between 2 and 160 then raise exception 'VALIDATION_ERROR: full_name' using errcode = '22023'; end if;
  if v_phone !~ '^[0-9]{10,11}$' then raise exception 'VALIDATION_ERROR: phone' using errcode = '22023'; end if;
  if v_cep !~ '^[0-9]{8}$' then raise exception 'VALIDATION_ERROR: postal_code' using errcode = '22023'; end if;
  if v_state !~ '^[A-Z]{2}$' then raise exception 'VALIDATION_ERROR: state' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_street, ''))) not between 2 and 160 or length(btrim(coalesce(p_number, ''))) not between 1 and 20
     or length(btrim(coalesce(p_neighborhood, ''))) not between 2 and 80 or length(btrim(coalesce(p_city, ''))) not between 2 and 80
     or length(coalesce(p_complement, '')) > 80 then
    raise exception 'VALIDATION_ERROR: address' using errcode = '22023';
  end if;

  insert into public.profile_contacts (user_id, full_name, phone, postal_code, street, number, complement, neighborhood, city, state, updated_by)
    values (p_user_id, btrim(p_full_name), v_phone, v_cep, btrim(p_street), btrim(p_number), nullif(btrim(coalesce(p_complement, '')), ''),
            btrim(p_neighborhood), btrim(p_city), v_state, v_actor)
    on conflict (user_id) do update set
      full_name = excluded.full_name, phone = excluded.phone, postal_code = excluded.postal_code, street = excluded.street,
      number = excluded.number, complement = excluded.complement, neighborhood = excluded.neighborhood, city = excluded.city,
      state = excluded.state, updated_by = excluded.updated_by, updated_at = now();
  -- No personal data in the audit trail: only who changed whose ficha.
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (null, v_actor, 'contact.save', 'profile_contacts', p_user_id, jsonb_build_object('user_id', p_user_id));
end;
$$;

-- Own ficha, or the ficha of the minor the caller is the legal guardian of. Empty result = not filled in yet.
create function public.get_contact(p_user_id uuid) returns table (
  full_name text, phone text, postal_code text, street text, number text, complement text,
  neighborhood text, city text, state text, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (p_user_id = (select auth.uid()) or public.is_legal_guardian_of(p_user_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query select c.full_name, c.phone, c.postal_code, c.street, c.number, c.complement, c.neighborhood, c.city, c.state, c.updated_at
    from public.profile_contacts c where c.user_id = p_user_id;
end;
$$;

-- The academy manager reads the ficha of a person who has a membership there. Every read is audited.
create function public.get_member_contact(p_academy_id uuid, p_user_id uuid) returns table (
  full_name text, phone text, postal_code text, street text, number text, complement text,
  neighborhood text, city text, state text, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_academy_manager(p_academy_id)
     or not exists (select 1 from public.memberships m where m.academy_id = p_academy_id and m.user_id = p_user_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'contact.view', 'profile_contacts', p_user_id, jsonb_build_object('user_id', p_user_id));
  return query select c.full_name, c.phone, c.postal_code, c.street, c.number, c.complement, c.neighborhood, c.city, c.state, c.updated_at
    from public.profile_contacts c where c.user_id = p_user_id;
end;
$$;

-- Manager only: which people of the academy already have the ficha filled in (no personal data).
create function public.contact_status(p_academy_id uuid) returns table (user_id uuid, has_contact boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query select m.user_id, public.has_contact(m.user_id)
    from public.memberships m where m.academy_id = p_academy_id and m.status in ('pending', 'approved', 'suspended');
end;
$$;

-- Gates: the ficha is required to ask to join, to be added by the manager, and to have a place requested for a minor.
-- Only change from 019/021: the 'contact required' check.
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
  if not public.has_contact(v_actor) then raise exception 'VALIDATION_ERROR: contact required' using errcode = '22023'; end if;

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
  if not public.has_contact(v_user) then raise exception 'VALIDATION_ERROR: contact required' using errcode = '22023'; end if;

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

create or replace function public.request_dependent_membership(p_minor_id uuid, p_academy_id uuid, p_photos boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_m public.memberships%rowtype;
  v_id uuid;
  v_consent public.guardian_consents%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_legal_guardian_of(p_minor_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.academies where id = p_academy_id) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.has_contact(p_minor_id) then raise exception 'VALIDATION_ERROR: contact required' using errcode = '22023'; end if;

  select * into v_consent from public.guardian_consents where academy_id = p_academy_id and minor_user_id = p_minor_id;
  if not found then
    insert into public.guardian_consents (academy_id, minor_user_id, guardian_user_id, consent_photos, consent_text_version)
      values (p_academy_id, p_minor_id, v_actor, coalesce(p_photos, false), 'rascunho-2026-10');
  elsif v_consent.revoked_at is not null then
    -- A new consent after a revocation must be verified again by the manager.
    update public.guardian_consents
      set status = 'pending', verified_by = null, verified_at = null, document_checked = false, verification_note = null,
          consent_at = now(), consent_photos = coalesce(p_photos, false), consent_text_version = 'rascunho-2026-10', revoked_at = null
      where id = v_consent.id;
  end if;

  select * into v_m from public.memberships where academy_id = p_academy_id and user_id = p_minor_id;
  if found then
    if v_m.status in ('pending', 'approved') then return v_m.id; end if;
    update public.memberships set status = 'pending', role = 'student', reviewed_by = null, reviewed_at = null where id = v_m.id;
    v_id := v_m.id;
  else
    insert into public.memberships (academy_id, user_id) values (p_academy_id, p_minor_id) returning id into v_id;
  end if;

  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'guardian.consent', 'memberships', v_id,
            jsonb_build_object('minor_user_id', p_minor_id, 'photos', coalesce(p_photos, false), 'text_version', 'rascunho-2026-10'));
  return v_id;
end;
$$;

revoke all on function public.accept_terms(text), public.my_terms_version(), public.has_contact(uuid),
  public.save_contact(uuid, text, text, text, text, text, text, text, text, text), public.get_contact(uuid),
  public.get_member_contact(uuid, uuid), public.contact_status(uuid) from public, anon, authenticated;
grant execute on function public.accept_terms(text), public.my_terms_version(),
  public.save_contact(uuid, text, text, text, text, text, text, text, text, text), public.get_contact(uuid),
  public.get_member_contact(uuid, uuid), public.contact_status(uuid) to authenticated;
