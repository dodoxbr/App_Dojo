-- Termo de uso de imagem assinado pelo responsável. Decisão do dono do produto (2026-10-22): só se posta foto de menor com o termo
-- assinado ("hoje o professor faz isso sem nada assinado; com o termo assinado ele fica mais tranquilo"). A assinatura é o nome completo
-- digitado pelo responsável legal, com data e versão do termo; o texto é RASCUNHO até a revisão jurídica (docs/11). A autorização de
-- fotos (consent_photos) só passa a existir junto com a assinatura. A conferência do documento pelo gestor continua obrigatória.

alter table public.guardian_consents
  add column photo_signed_name text check (photo_signed_name is null or length(btrim(photo_signed_name)) between 5 and 120),
  add column photo_signed_at timestamptz,
  add column photo_term_version text;

-- Registros anteriores ao termo assinado ficam identificados como tal (a autorização que já existia continua valendo no ambiente de teste).
update public.guardian_consents
   set photo_signed_name = '(registro anterior ao termo assinado)', photo_signed_at = consent_at, photo_term_version = consent_text_version
 where consent_photos and photo_signed_at is null;

create function public.valid_signature(p_name text) returns boolean
language sql immutable set search_path = '' as $$
  select p_name is not null and length(btrim(p_name)) between 5 and 120 and btrim(p_name) ~ '\s';  -- nome e sobrenome
$$;

-- request_dependent_membership (028) com a assinatura do termo de imagem: obrigatória quando se autoriza fotos.
drop function public.request_dependent_membership(uuid, uuid, boolean, boolean);
create function public.request_dependent_membership(p_minor_id uuid, p_academy_id uuid, p_photos boolean, p_social boolean default false, p_signature text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_m public.memberships%rowtype;
  v_id uuid;
  v_consent public.guardian_consents%rowtype;
  v_photos boolean := coalesce(p_photos, false);
  v_social boolean := coalesce(p_social, false);
  v_sig text := nullif(btrim(coalesce(p_signature, '')), '');
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_legal_guardian_of(p_minor_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.academies where id = p_academy_id) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.has_contact(p_minor_id) then raise exception 'VALIDATION_ERROR: contact required' using errcode = '22023'; end if;
  if v_social and not v_photos then raise exception 'VALIDATION_ERROR: social needs photos' using errcode = '22023'; end if;
  if v_photos and not public.valid_signature(v_sig) then raise exception 'VALIDATION_ERROR: signature' using errcode = '22023'; end if;

  select * into v_consent from public.guardian_consents where academy_id = p_academy_id and minor_user_id = p_minor_id;
  if not found then
    insert into public.guardian_consents (academy_id, minor_user_id, guardian_user_id, consent_photos, consent_social, consent_text_version,
                                          photo_signed_name, photo_signed_at, photo_term_version)
      values (p_academy_id, p_minor_id, v_actor, v_photos, v_social, 'rascunho-2026-11',
              case when v_photos then v_sig end, case when v_photos then now() end, case when v_photos then 'rascunho-2026-12' end);
  elsif v_consent.revoked_at is not null then
    -- Novo consentimento depois de uma revogação: o gestor confere de novo.
    update public.guardian_consents
      set status = 'pending', verified_by = null, verified_at = null, document_checked = false, verification_note = null,
          consent_at = now(), consent_photos = v_photos, consent_social = v_social, consent_text_version = 'rascunho-2026-11', revoked_at = null,
          photo_signed_name = case when v_photos then v_sig end, photo_signed_at = case when v_photos then now() end,
          photo_term_version = case when v_photos then 'rascunho-2026-12' end
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
            jsonb_build_object('minor_user_id', p_minor_id, 'photos', v_photos, 'social', v_social, 'text_version', 'rascunho-2026-11', 'photo_term_signed', v_photos));
  return v_id;
end;
$$;

-- Assinar (ou renovar) o termo de imagem depois do pedido de vaga, para quem não autorizou fotos na primeira vez.
create function public.sign_photo_term(p_minor_id uuid, p_academy_id uuid, p_signature text, p_social boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.guardian_consents%rowtype;
  v_sig text := nullif(btrim(coalesce(p_signature, '')), '');
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_legal_guardian_of(p_minor_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_c from public.guardian_consents where academy_id = p_academy_id and minor_user_id = p_minor_id and revoked_at is null;
  if not found then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not public.valid_signature(v_sig) then raise exception 'VALIDATION_ERROR: signature' using errcode = '22023'; end if;
  update public.guardian_consents
     set consent_photos = true, consent_social = coalesce(p_social, false), photo_signed_name = v_sig, photo_signed_at = now(), photo_term_version = 'rascunho-2026-12'
   where id = v_c.id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'guardian.photo_term', 'guardian_consents', v_c.id, jsonb_build_object('minor_user_id', p_minor_id, 'social', coalesce(p_social, false)));
end;
$$;

-- O responsável vê o estado do termo de imagem de cada academia (assinado por quem e quando).
create function public.photo_term_status(p_minor_id uuid)
returns table (academy_id uuid, signed_name text, signed_at timestamptz, term_version text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_legal_guardian_of(p_minor_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query select c.academy_id, c.photo_signed_name, c.photo_signed_at, c.photo_term_version
    from public.guardian_consents c where c.minor_user_id = p_minor_id and c.revoked_at is null and c.consent_photos;
end;
$$;

-- O gestor vê quem assinou o termo de imagem (nome digitado e data), junto com as outras autorizações.
drop function public.list_academy_guardian_consents(uuid);
create function public.list_academy_guardian_consents(p_academy_id uuid)
returns table (id uuid, minor_user_id uuid, minor_name text, guardian_name text, relationship text, status text,
               consent_active boolean, consent_photos boolean, consent_social boolean, membership_status text, created_at timestamptz,
               photo_signed_name text, photo_signed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select c.id, c.minor_user_id, pm.display_name, pg.display_name, g.relationship, c.status,
           c.revoked_at is null, c.consent_photos, c.consent_social,
           (select m.status::text from public.memberships m where m.academy_id = c.academy_id and m.user_id = c.minor_user_id), c.created_at,
           c.photo_signed_name, c.photo_signed_at
    from public.guardian_consents c
    join public.guardianships g on g.minor_user_id = c.minor_user_id and g.guardian_user_id = c.guardian_user_id and g.kind = 'legal'
    join public.profiles pm on pm.id = c.minor_user_id join public.profiles pg on pg.id = c.guardian_user_id
    where c.academy_id = p_academy_id order by c.created_at desc;
end;
$$;

revoke all on function public.valid_signature(text), public.request_dependent_membership(uuid, uuid, boolean, boolean, text), public.sign_photo_term(uuid, uuid, text, boolean),
  public.photo_term_status(uuid), public.list_academy_guardian_consents(uuid) from public, anon, authenticated;
grant execute on function public.request_dependent_membership(uuid, uuid, boolean, boolean, text), public.sign_photo_term(uuid, uuid, text, boolean),
  public.photo_term_status(uuid), public.list_academy_guardian_consents(uuid) to authenticated;
