-- US-016b: (1) the academy's company name and CNPJ become variables of the terms (filled in by the manager when the academy is
-- created, editable later); (2) the ficha gets a REQUIRED emergency contact and OPTIONAL health notes, which are sensitive data
-- and need the person's specific consent. Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, 22023 VALIDATION_ERROR.

-- ---- company and CNPJ of the academy ------------------------------------------------------------------------------
create function public.is_valid_cnpj(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  w1 int[] := array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  w2 int[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  s int;
  r int;
  dv1 int;
  dv2 int;
begin
  if p is null or p !~ '^[0-9]{14}$' or p ~ '^(.)\1{13}$' then return false; end if;
  s := 0;
  for i in 1..12 loop s := s + substr(p, i, 1)::int * w1[i]; end loop;
  r := s % 11;
  dv1 := case when r < 2 then 0 else 11 - r end;
  if dv1 <> substr(p, 13, 1)::int then return false; end if;
  s := 0;
  for i in 1..13 loop s := s + substr(p, i, 1)::int * w2[i]; end loop;
  r := s % 11;
  dv2 := case when r < 2 then 0 else 11 - r end;
  return dv2 = substr(p, 14, 1)::int;
end;
$$;

alter table public.academies
  add column legal_name text check (legal_name is null or length(btrim(legal_name)) between 2 and 200),
  add column cnpj text check (cnpj is null or public.is_valid_cnpj(cnpj));

-- The manager (or the platform admin) fills in or corrects the company data of the academy.
create function public.set_academy_legal(p_academy_id uuid, p_legal_name text, p_cnpj text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_legal_name, ''));
  v_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if length(v_name) not between 2 and 200 then raise exception 'VALIDATION_ERROR: legal_name' using errcode = '22023'; end if;
  if not public.is_valid_cnpj(v_cnpj) then raise exception 'VALIDATION_ERROR: cnpj' using errcode = '22023'; end if;
  update public.academies set legal_name = v_name, cnpj = v_cnpj where id = p_academy_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'academy.legal', 'academies', p_academy_id, jsonb_build_object('cnpj', v_cnpj));
end;
$$;

-- Creates the academy already with its company data (same transaction: a bad CNPJ creates nothing).
create function public.create_academy(p_name text, p_slug text, p_legal_name text, p_cnpj text, p_idempotency_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_legal_name, ''));
  v_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
  v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if length(v_name) not between 2 and 200 then raise exception 'VALIDATION_ERROR: legal_name' using errcode = '22023'; end if;
  if not public.is_valid_cnpj(v_cnpj) then raise exception 'VALIDATION_ERROR: cnpj' using errcode = '22023'; end if;
  v_id := public.create_academy(p_name, p_slug, p_idempotency_key);
  update public.academies set legal_name = v_name, cnpj = v_cnpj where id = v_id;
  return v_id;
end;
$$;

-- Public information used by the terms page of an academy (readable without signing in).
create function public.public_academy_legal(p_slug text) returns table (name text, legal_name text, cnpj text)
language sql stable security definer set search_path = '' as $$
  select a.name, a.legal_name, a.cnpj from public.academies a where a.slug = lower(btrim(coalesce(p_slug, '')));
$$;

-- ---- emergency contact and health notes in the ficha ---------------------------------------------------------------
alter table public.profile_contacts
  add column emergency_name text check (emergency_name is null or length(btrim(emergency_name)) between 2 and 120),
  add column emergency_phone text check (emergency_phone is null or emergency_phone ~ '^[0-9]{10,11}$'),
  add column emergency_relationship text check (emergency_relationship is null or length(btrim(emergency_relationship)) between 2 and 40),
  add column health_notes text check (health_notes is null or length(health_notes) <= 500),
  add column health_consent_at timestamptz,
  add constraint profile_contacts_health_consent_chk check (health_notes is null or health_consent_at is not null);

-- A ficha counts as complete only with the emergency contact (older rows without it must be completed).
create or replace function public.has_contact(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profile_contacts where user_id = p_user_id and emergency_name is not null);
$$;

drop function public.save_contact(uuid, text, text, text, text, text, text, text, text, text);
drop function public.get_contact(uuid);
drop function public.get_member_contact(uuid, uuid);

create function public.save_contact(
  p_user_id uuid, p_full_name text, p_phone text, p_postal_code text, p_street text, p_number text,
  p_complement text, p_neighborhood text, p_city text, p_state text,
  p_emergency_name text, p_emergency_phone text, p_emergency_relationship text, p_health_notes text, p_health_consent boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_cep text := regexp_replace(coalesce(p_postal_code, ''), '\D', '', 'g');
  v_state text := upper(btrim(coalesce(p_state, '')));
  v_emerg_phone text := regexp_replace(coalesce(p_emergency_phone, ''), '\D', '', 'g');
  v_health text := nullif(btrim(coalesce(p_health_notes, '')), '');
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
  if length(btrim(coalesce(p_emergency_name, ''))) not between 2 and 120 or v_emerg_phone !~ '^[0-9]{10,11}$'
     or length(btrim(coalesce(p_emergency_relationship, ''))) not between 2 and 40 then
    raise exception 'VALIDATION_ERROR: emergency contact' using errcode = '22023';
  end if;
  -- Health notes are sensitive data (LGPD art. 11): they need the specific consent of the person (or of the guardian).
  if v_health is not null and (length(v_health) > 500 or coalesce(p_health_consent, false) is not true) then
    raise exception 'VALIDATION_ERROR: health consent' using errcode = '22023';
  end if;

  insert into public.profile_contacts (user_id, full_name, phone, postal_code, street, number, complement, neighborhood, city, state,
                                       emergency_name, emergency_phone, emergency_relationship, health_notes, health_consent_at, updated_by)
    values (p_user_id, btrim(p_full_name), v_phone, v_cep, btrim(p_street), btrim(p_number), nullif(btrim(coalesce(p_complement, '')), ''),
            btrim(p_neighborhood), btrim(p_city), v_state,
            btrim(p_emergency_name), v_emerg_phone, btrim(p_emergency_relationship), v_health,
            case when v_health is null then null else now() end, v_actor)
    on conflict (user_id) do update set
      full_name = excluded.full_name, phone = excluded.phone, postal_code = excluded.postal_code, street = excluded.street,
      number = excluded.number, complement = excluded.complement, neighborhood = excluded.neighborhood, city = excluded.city,
      state = excluded.state, emergency_name = excluded.emergency_name, emergency_phone = excluded.emergency_phone,
      emergency_relationship = excluded.emergency_relationship, health_notes = excluded.health_notes,
      health_consent_at = excluded.health_consent_at, updated_by = excluded.updated_by, updated_at = now();
  -- No personal data in the audit trail: only who changed whose ficha.
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (null, v_actor, 'contact.save', 'profile_contacts', p_user_id, jsonb_build_object('user_id', p_user_id));
end;
$$;

create function public.get_contact(p_user_id uuid) returns table (
  full_name text, phone text, postal_code text, street text, number text, complement text,
  neighborhood text, city text, state text, emergency_name text, emergency_phone text, emergency_relationship text,
  health_notes text, health_consent_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (p_user_id = (select auth.uid()) or public.is_legal_guardian_of(p_user_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query select c.full_name, c.phone, c.postal_code, c.street, c.number, c.complement, c.neighborhood, c.city, c.state,
                      c.emergency_name, c.emergency_phone, c.emergency_relationship, c.health_notes, c.health_consent_at, c.updated_at
    from public.profile_contacts c where c.user_id = p_user_id;
end;
$$;

create function public.get_member_contact(p_academy_id uuid, p_user_id uuid) returns table (
  full_name text, phone text, postal_code text, street text, number text, complement text,
  neighborhood text, city text, state text, emergency_name text, emergency_phone text, emergency_relationship text,
  health_notes text, health_consent_at timestamptz, updated_at timestamptz)
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
  return query select c.full_name, c.phone, c.postal_code, c.street, c.number, c.complement, c.neighborhood, c.city, c.state,
                      c.emergency_name, c.emergency_phone, c.emergency_relationship, c.health_notes, c.health_consent_at, c.updated_at
    from public.profile_contacts c where c.user_id = p_user_id;
end;
$$;

revoke all on function public.is_valid_cnpj(text), public.set_academy_legal(uuid, text, text),
  public.create_academy(text, text, text, text, uuid), public.public_academy_legal(text),
  public.save_contact(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean),
  public.get_contact(uuid), public.get_member_contact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_academy_legal(uuid, text, text), public.create_academy(text, text, text, text, uuid),
  public.save_contact(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean),
  public.get_contact(uuid), public.get_member_contact(uuid, uuid) to authenticated;
grant execute on function public.public_academy_legal(text) to anon, authenticated;
