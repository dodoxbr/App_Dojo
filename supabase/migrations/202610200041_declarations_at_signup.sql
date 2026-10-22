-- Declarações no cadastro (decisão do dono do produto, 2026-10-22): a autorização de imagem e a declaração de saúde "ficam nos termos":
-- ao criar a conta a pessoa lê e marca que declara/autoriza. A declaração de saúde é obrigatória no cadastro (feita pelo formulário);
-- a autorização de imagem é opcional e vale para o feed fechado de todas as academias de que a pessoa participar (pode ser revogada
-- no perfil, e ao revogar as fotos em que ela está marcada saem do feed). Substitui a autorização por academia da migration 040.
-- Os textos são RASCUNHO até a revisão jurídica. Cada aceite guarda a versão e a data.

alter table public.terms_acceptances drop constraint terms_acceptances_document_check;
alter table public.terms_acceptances add constraint terms_acceptances_document_check
  check (document in ('terms_of_use', 'privacy_policy', 'health_declaration', 'image_authorization'));
alter table public.terms_acceptances add column revoked_at timestamptz;

-- Sai a autorização por academia (040); entra a do cadastro.
drop function public.my_image_consents();
drop function public.give_image_consent(uuid, text);
drop function public.revoke_image_consent(uuid);
drop table public.adult_image_consents;

-- O cadastro envia as marcas nos metadados; o gatilho registra (dependentes nunca aceitam sozinhos: o responsável aceita por si e consente por eles).
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
  v_adult_account boolean := coalesce(new.raw_user_meta_data ->> 'dependent', '') <> 'true';
begin
  v_name := left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 120);
  if length(v_name) < 2 then
    v_name := 'Novo usuário';
  end if;
  insert into public.profiles (id, display_name) values (new.id, v_name);
  begin
    v_birth := (new.raw_user_meta_data ->> 'birth_date')::date;
  exception when others then
    v_birth := null;
  end;
  if v_birth is not null and v_birth between date '1900-01-01' and current_date then
    insert into public.profile_private (user_id, birth_date) values (new.id, v_birth);
  end if;
  v_terms := left(trim(coalesce(new.raw_user_meta_data ->> 'terms_version', '')), 40);
  if length(v_terms) >= 3 and v_adult_account then
    insert into public.terms_acceptances (user_id, document, version)
      values (new.id, 'terms_of_use', v_terms), (new.id, 'privacy_policy', v_terms);
    if coalesce(new.raw_user_meta_data ->> 'health_declaration', '') = 'true' then
      insert into public.terms_acceptances (user_id, document, version) values (new.id, 'health_declaration', v_terms);
    end if;
    if coalesce(new.raw_user_meta_data ->> 'image_authorization', '') = 'true' then
      insert into public.terms_acceptances (user_id, document, version) values (new.id, 'image_authorization', v_terms);
    end if;
  end if;
  return new;
end;
$$;

create function public.has_image_authorization(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.terms_acceptances t
                 where t.user_id = p_user_id and t.document = 'image_authorization' and t.revoked_at is null);
$$;

-- A regra de foto: menor precisa da autorização do responsável; adulto precisa da própria (feita no cadastro ou depois, no perfil).
create or replace function public.minors_without_photo_consent(p_academy_id uuid, p_user_ids uuid[]) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from unnest(p_user_ids) as t(uid)
  where case
    when public.is_adult(t.uid) then not public.has_image_authorization(t.uid)
    else not exists (
      select 1 from public.guardian_consents c
      where c.academy_id = p_academy_id and c.minor_user_id = t.uid and c.status = 'verified' and c.revoked_at is null and c.consent_photos)
  end;
$$;

-- O que a pessoa já declarou (para o perfil mostrar o que falta).
create function public.my_declarations()
returns table (health_declared boolean, health_declared_at timestamptz, image_authorized boolean, image_authorized_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  return query select
    exists (select 1 from public.terms_acceptances t where t.user_id = v_actor and t.document = 'health_declaration' and t.revoked_at is null),
    (select max(t.accepted_at) from public.terms_acceptances t where t.user_id = v_actor and t.document = 'health_declaration' and t.revoked_at is null),
    public.has_image_authorization(v_actor),
    (select max(t.accepted_at) from public.terms_acceptances t where t.user_id = v_actor and t.document = 'image_authorization' and t.revoked_at is null);
end;
$$;

-- Contas antigas (ou quem não declarou no cadastro) declaram aqui. Repetir é inofensivo.
create function public.declare_health(p_version text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_version text := btrim(coalesce(p_version, ''));
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if length(v_version) not between 3 and 40 then raise exception 'VALIDATION_ERROR: version' using errcode = '22023'; end if;
  insert into public.terms_acceptances (user_id, document, version) values (v_actor, 'health_declaration', v_version)
    on conflict (user_id, document, version) do update set revoked_at = null, accepted_at = now();
end;
$$;

-- Autorizar ou revogar a própria imagem (só adulto; menor é pelo responsável). Revogar tira do feed as fotos em que a pessoa está marcada.
create function public.set_image_authorization(p_on boolean, p_version text default 'rascunho-2026-12') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_version text := btrim(coalesce(p_version, ''));
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_adult(v_actor) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if coalesce(p_on, false) then
    if length(v_version) not between 3 and 40 then raise exception 'VALIDATION_ERROR: version' using errcode = '22023'; end if;
    insert into public.terms_acceptances (user_id, document, version) values (v_actor, 'image_authorization', v_version)
      on conflict (user_id, document, version) do update set revoked_at = null, accepted_at = now();
    insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
      values (null, v_actor, 'image.authorize', 'profiles', v_actor, '{}'::jsonb);
  else
    update public.terms_acceptances set revoked_at = now() where user_id = v_actor and document = 'image_authorization' and revoked_at is null;
    if not found then return; end if;
    update public.feed_posts set status = 'hidden', hidden_reason = 'consent revoked'
      where status in ('visible', 'pending') and id in (select post_id from public.feed_post_tags where user_id = v_actor);
    insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
      values (null, v_actor, 'image.revoke', 'profiles', v_actor, '{}'::jsonb);
  end if;
end;
$$;

-- Declaração de saúde do menor, feita pelo responsável ao pedir a vaga (junto do termo de consentimento).
alter table public.guardian_consents add column health_declared_at timestamptz;

-- A função atual vira o miolo (sem acesso direto); a nova, com o parâmetro da saúde, só a chama.
alter function public.request_dependent_membership(uuid, uuid, boolean, boolean, text) rename to request_dependent_membership_core;
revoke all on function public.request_dependent_membership_core(uuid, uuid, boolean, boolean, text) from public, anon, authenticated;
create function public.request_dependent_membership(p_minor_id uuid, p_academy_id uuid, p_photos boolean, p_social boolean default false, p_signature text default null, p_health boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  v_id := public.request_dependent_membership_core(p_minor_id, p_academy_id, p_photos, p_social, p_signature);
  if coalesce(p_health, false) then
    update public.guardian_consents set health_declared_at = now() where academy_id = p_academy_id and minor_user_id = p_minor_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.has_image_authorization(uuid), public.my_declarations(), public.declare_health(text), public.set_image_authorization(boolean, text),
  public.request_dependent_membership(uuid, uuid, boolean, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.my_declarations(), public.declare_health(text), public.set_image_authorization(boolean, text),
  public.request_dependent_membership(uuid, uuid, boolean, boolean, text, boolean) to authenticated;
