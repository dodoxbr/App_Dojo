-- US-013b: the owner decided the limit is 7 dependents per guardian (was 10, an anti-abuse premise).
-- Only change from 021: the limit. The error message stays 'dependents limit'.
create or replace function public.create_dependent(p_display_name text, p_birth_date date, p_relationship text, p_idempotency_key uuid) returns uuid
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

  if (select count(*) from public.guardianships where guardian_user_id = v_actor and kind = 'legal') >= 7 then
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
