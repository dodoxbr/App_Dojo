-- US-013 (part 2): guardians and minors. The adult GUARDIAN creates and answers for the minor's account (dependent): the
-- dependent has no login, e-mail or password, so only the guardian acts on their behalf. To enter an academy the minor needs
-- a guardian CONSENT that the academy manager VERIFIED in person (document checked, nothing stored). Draft consent text:
-- needs legal review (docs/11). The financial responsible defaults to the legal guardian; another adult may take that role
-- through an invite code and then sees no attendance or rank. Guardians never read the diary. Minors stay out of challenges.
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, 23505 CONFLICT, 22023 VALIDATION_ERROR.

create table public.guardianships (
  id uuid primary key default gen_random_uuid(),
  minor_user_id uuid not null references auth.users(id) on delete cascade,
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('legal', 'financial')),
  relationship text not null check (length(btrim(relationship)) between 2 and 40),
  created_at timestamptz not null default now(),
  unique (minor_user_id, guardian_user_id),
  constraint guardianships_not_self_chk check (guardian_user_id <> minor_user_id)
);
-- One legal guardian and at most one separate financial responsible per minor.
create unique index guardianships_one_legal_idx on public.guardianships (minor_user_id) where kind = 'legal';
create unique index guardianships_one_financial_idx on public.guardianships (minor_user_id) where kind = 'financial';
create index guardianships_guardian_idx on public.guardianships (guardian_user_id);
alter table public.guardianships enable row level security;
create policy guardianships_read on public.guardianships for select to authenticated
  using (guardian_user_id = (select auth.uid()) or public.is_platform_admin());
grant select on public.guardianships to authenticated;

-- Consent of the legal guardian for one academy, verified by that academy's manager.
create table public.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  minor_user_id uuid not null references auth.users(id) on delete cascade,
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'verified')),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  document_checked boolean not null default false,
  verification_note text check (verification_note is null or length(verification_note) <= 500),
  consent_at timestamptz not null default now(),
  consent_photos boolean not null default false,
  consent_text_version text not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (academy_id, minor_user_id),
  constraint guardian_consents_verified_chk check (status <> 'verified' or (verified_by is not null and verified_at is not null and document_checked))
);
create index guardian_consents_minor_idx on public.guardian_consents (minor_user_id);
alter table public.guardian_consents enable row level security;
create policy guardian_consents_read on public.guardian_consents for select to authenticated using (
  guardian_user_id = (select auth.uid()) or public.is_academy_manager(academy_id) or public.is_platform_admin());
grant select on public.guardian_consents to authenticated;

-- Invite codes for the financial responsible. Only the hash is stored; never readable by clients.
create table public.guardian_invites (
  id uuid primary key default gen_random_uuid(),
  minor_user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  code_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.guardian_invites enable row level security;

-- May this person be a member of the academy? Adults yes; minors only with a verified, non-revoked guardian consent.
create function public.can_join_academy(p_academy_id uuid, p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_adult(p_user_id) or exists (
    select 1 from public.guardian_consents c
    join public.guardianships g on g.minor_user_id = c.minor_user_id and g.guardian_user_id = c.guardian_user_id and g.kind = 'legal'
    where c.academy_id = p_academy_id and c.minor_user_id = p_user_id and c.status = 'verified' and c.revoked_at is null
      and public.is_adult(c.guardian_user_id));
$$;

-- Is the caller the LEGAL guardian of a (still minor) dependent?
create function public.is_legal_guardian_of(p_minor_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.guardianships g
                 where g.minor_user_id = p_minor_id and g.guardian_user_id = (select auth.uid()) and g.kind = 'legal')
     and not public.is_adult(p_minor_id);
$$;

-- The adult guardian creates the dependent account: no e-mail, no password, no identity -> nobody can sign in as them.
create function public.create_dependent(p_display_name text, p_birth_date date, p_relationship text, p_idempotency_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_display_name, ''));
  v_rel text := btrim(coalesce(p_relationship, ''));
  v_prev public.audit_events%rowtype;
  v_id uuid := gen_random_uuid();
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;
  if not public.is_adult(v_actor) then raise exception 'VALIDATION_ERROR: adult required' using errcode = '22023'; end if;
  if length(v_name) not between 2 and 120 then raise exception 'VALIDATION_ERROR: display_name' using errcode = '22023'; end if;
  if length(v_rel) not between 2 and 40 then raise exception 'VALIDATION_ERROR: relationship' using errcode = '22023'; end if;
  -- Only minors can be dependents; an adult must have their own account.
  if p_birth_date is null or p_birth_date > current_date or p_birth_date <= (current_date - interval '18 years')::date then
    raise exception 'VALIDATION_ERROR: birth_date' using errcode = '22023';
  end if;

  select * into v_prev from public.audit_events
    where actor_user_id = v_actor and action = 'guardian.create_dependent' and idempotency_key = p_idempotency_key;
  if found then
    if v_prev.metadata ->> 'display_name' <> v_name or v_prev.metadata ->> 'birth_date' <> p_birth_date::text
       or v_prev.metadata ->> 'relationship' <> v_rel then
      raise exception 'VALIDATION_ERROR: idempotency_key reused' using errcode = '22023';
    end if;
    return v_prev.entity_id;
  end if;

  -- Anti-abuse (premise): at most 10 dependents per guardian.
  if (select count(*) from public.guardianships where guardian_user_id = v_actor and kind = 'legal') >= 10 then
    raise exception 'VALIDATION_ERROR: dependents limit' using errcode = '22023';
  end if;

  -- The signup trigger creates the profile and the private birth date from the metadata.
  insert into auth.users (instance_id, id, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
            jsonb_build_object('provider', 'dependent', 'providers', jsonb_build_array()),
            jsonb_build_object('display_name', v_name, 'birth_date', p_birth_date, 'dependent', true), now(), now());
  insert into public.guardianships (minor_user_id, guardian_user_id, kind, relationship) values (v_id, v_actor, 'legal', v_rel);
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (null, v_actor, 'guardian.create_dependent', 'dependents', v_id,
            jsonb_build_object('display_name', v_name, 'birth_date', p_birth_date, 'relationship', v_rel), p_idempotency_key);
  return v_id;
end;
$$;

-- The legal guardian asks for the minor's place in an academy and gives the consent (draft text). Photos stay OFF by default.
create function public.request_dependent_membership(p_minor_id uuid, p_academy_id uuid, p_photos boolean) returns uuid
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

-- The manager checked the guardian's identity document and relationship IN PERSON. Nothing is stored but who and when.
create function public.verify_guardian_consent(p_consent_id uuid, p_document_checked boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.guardian_consents%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_c from public.guardian_consents where id = p_consent_id;
  if not found or not (public.is_platform_admin() or public.is_academy_manager(v_c.academy_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if coalesce(p_document_checked, false) is not true then raise exception 'VALIDATION_ERROR: document must be checked' using errcode = '22023'; end if;
  if v_note is not null and length(v_note) > 500 then raise exception 'VALIDATION_ERROR: note' using errcode = '22023'; end if;
  if v_c.revoked_at is not null then raise exception 'CONFLICT: consent revoked' using errcode = '23505'; end if;
  if v_c.status = 'verified' then return; end if;
  update public.guardian_consents
    set status = 'verified', verified_by = v_actor, verified_at = now(), document_checked = true, verification_note = v_note
    where id = p_consent_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_c.academy_id, v_actor, 'guardian.verify', 'guardian_consents', p_consent_id,
            jsonb_build_object('minor_user_id', v_c.minor_user_id, 'guardian_user_id', v_c.guardian_user_id));
end;
$$;

-- Revoking the consent suspends the minor's membership in that academy right away.
create function public.revoke_guardian_consent(p_consent_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.guardian_consents%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_c from public.guardian_consents where id = p_consent_id;
  if not found or v_c.guardian_user_id <> v_actor then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_c.revoked_at is not null then return; end if;
  update public.guardian_consents set revoked_at = now() where id = p_consent_id;
  update public.memberships set status = 'suspended'
    where academy_id = v_c.academy_id and user_id = v_c.minor_user_id and status = 'approved';
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_c.academy_id, v_actor, 'guardian.revoke', 'guardian_consents', p_consent_id, jsonb_build_object('minor_user_id', v_c.minor_user_id));
end;
$$;

-- The legal guardian invites another adult to be the financial responsible (code shown once, valid 7 days).
create function public.create_financial_invite(p_minor_id uuid) returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_code text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_expires timestamptz := now() + interval '7 days';
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_legal_guardian_of(p_minor_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  delete from public.guardian_invites i where i.minor_user_id = p_minor_id and i.used_at is null;
  insert into public.guardian_invites (minor_user_id, created_by, code_hash, expires_at)
    values (p_minor_id, v_actor, sha256(convert_to(v_code, 'UTF8')), v_expires);
  return query select v_code, v_expires;
end;
$$;

-- The invited adult types the code and becomes the financial responsible (replaces a previous one). No access to progress.
create function public.accept_financial_invite(p_code text, p_relationship text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_rel text := btrim(coalesce(p_relationship, ''));
  v_i public.guardian_invites%rowtype;
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_adult(v_actor) then raise exception 'VALIDATION_ERROR: adult required' using errcode = '22023'; end if;
  if length(v_rel) not between 2 and 40 then raise exception 'VALIDATION_ERROR: relationship' using errcode = '22023'; end if;
  select * into v_i from public.guardian_invites
    where code_hash = sha256(convert_to(upper(btrim(coalesce(p_code, ''))), 'UTF8')) and used_at is null and expires_at > now();
  -- One generic error for wrong, used or expired codes, or a person who is no longer a minor.
  if not found or public.is_adult(v_i.minor_user_id) or exists (
       select 1 from public.guardianships g where g.minor_user_id = v_i.minor_user_id and g.guardian_user_id = v_actor and g.kind = 'legal') then
    raise exception 'VALIDATION_ERROR: invalid code' using errcode = '22023';
  end if;
  update public.guardian_invites set used_at = now() where id = v_i.id;
  delete from public.guardianships where minor_user_id = v_i.minor_user_id and kind = 'financial';
  insert into public.guardianships (minor_user_id, guardian_user_id, kind, relationship)
    values (v_i.minor_user_id, v_actor, 'financial', v_rel) returning id into v_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (null, v_actor, 'guardian.financial', 'guardianships', v_id,
            jsonb_build_object('minor_user_id', v_i.minor_user_id, 'invited_by', v_i.created_by));
  return v_id;
end;
$$;

-- Staff only: which members are minors, and whether the guardian paperwork is complete.
create function public.member_age_flags(p_academy_id uuid) returns table (user_id uuid, is_minor boolean, guardian_ready boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.has_academy_permission(p_academy_id, 'view_roster') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select m.user_id, not public.is_adult(m.user_id), public.can_join_academy(p_academy_id, m.user_id)
    from public.memberships m where m.academy_id = p_academy_id and m.status in ('pending', 'approved', 'suspended');
end;
$$;

-- Manager's list of guardian consents of the academy, with names (profiles are private).
create function public.list_academy_guardian_consents(p_academy_id uuid)
returns table (id uuid, minor_user_id uuid, minor_name text, guardian_name text, relationship text, status text,
               consent_active boolean, consent_photos boolean, membership_status text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select c.id, c.minor_user_id, pm.display_name, pg.display_name, g.relationship, c.status,
           c.revoked_at is null, c.consent_photos,
           (select m.status::text from public.memberships m where m.academy_id = c.academy_id and m.user_id = c.minor_user_id), c.created_at
    from public.guardian_consents c
    join public.guardianships g on g.minor_user_id = c.minor_user_id and g.guardian_user_id = c.guardian_user_id and g.kind = 'legal'
    join public.profiles pm on pm.id = c.minor_user_id join public.profiles pg on pg.id = c.guardian_user_id
    where c.academy_id = p_academy_id order by c.created_at desc;
end;
$$;

-- The guardian's own dependents (legal or financial). Age is exposed only as "still a minor or not".
create function public.list_my_dependents()
returns table (minor_user_id uuid, minor_name text, kind text, relationship text, minor_is_adult boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  return query
    select g.minor_user_id, p.display_name, g.kind, g.relationship, public.is_adult(g.minor_user_id)
    from public.guardianships g join public.profiles p on p.id = g.minor_user_id
    where g.guardian_user_id = (select auth.uid()) order by p.display_name;
end;
$$;

-- What the LEGAL guardian may follow: consent state per academy and, once verified, attendance / rank / agenda. NOT the diary.
-- Access ends when the minor turns 18.
create function public.guardian_overview(p_minor_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_legal_guardian_of(p_minor_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select jsonb_build_object(
    'minor', (select jsonb_build_object('id', p_minor_id, 'display_name', display_name) from public.profiles where id = p_minor_id),
    'academies', coalesce(jsonb_agg(jsonb_build_object(
      'consent_id', c.id, 'academy_id', a.id, 'name', a.name,
      'consent_status', c.status, 'consent_active', c.revoked_at is null, 'consent_photos', c.consent_photos,
      'membership_status', (select m.status from public.memberships m where m.academy_id = a.id and m.user_id = p_minor_id),
      'validated_attendances_30_days', case when c.status = 'verified' and c.revoked_at is null then
         (select count(*) from public.attendances t join public.sessions s on s.id = t.session_id
           where t.academy_id = a.id and t.user_id = p_minor_id and t.status = 'validated' and s.starts_at >= now() - interval '30 days') end,
      'rank', case when c.status = 'verified' and c.revoked_at is null then
         (select jsonb_build_object('belt_code', cr.belt_code, 'degree', cr.degree, 'since', cr.effective_date)
            from public.current_ranks cr where cr.academy_id = a.id and cr.user_id = p_minor_id) end,
      'next_sessions', case when c.status = 'verified' and c.revoked_at is null then
         coalesce((select jsonb_agg(jsonb_build_object('title', k.title, 'starts_at', s.starts_at, 'ends_at', s.ends_at) order by s.starts_at)
                     from (select * from public.sessions s0 where s0.academy_id = a.id and s0.status = 'scheduled' and s0.starts_at >= now()
                           order by s0.starts_at limit 5) s join public.classes k on k.id = s.class_id), '[]'::jsonb) end
    ) order by a.name), '[]'::jsonb))
  into v_result
  from public.guardian_consents c join public.academies a on a.id = c.academy_id
  where c.minor_user_id = p_minor_id;
  return v_result;
end;
$$;

-- A minor can only be approved with a verified guardian consent (adults as before). Only change from 019: the age check.
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
  if p_decision = 'approved' and not public.can_join_academy(v_m.academy_id, v_m.user_id) then
    raise exception 'VALIDATION_ERROR: guardian required' using errcode = '22023';
  end if;

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

revoke all on function public.can_join_academy(uuid, uuid), public.is_legal_guardian_of(uuid),
  public.create_dependent(text, date, text, uuid), public.request_dependent_membership(uuid, uuid, boolean),
  public.verify_guardian_consent(uuid, boolean, text), public.revoke_guardian_consent(uuid),
  public.create_financial_invite(uuid), public.accept_financial_invite(text, text),
  public.member_age_flags(uuid), public.list_academy_guardian_consents(uuid), public.list_my_dependents(), public.guardian_overview(uuid)
  from public, anon, authenticated;
grant execute on function public.create_dependent(text, date, text, uuid), public.request_dependent_membership(uuid, uuid, boolean),
  public.verify_guardian_consent(uuid, boolean, text), public.revoke_guardian_consent(uuid),
  public.create_financial_invite(uuid), public.accept_financial_invite(text, text),
  public.member_age_flags(uuid), public.list_academy_guardian_consents(uuid), public.list_my_dependents(), public.guardian_overview(uuid)
  to authenticated;
