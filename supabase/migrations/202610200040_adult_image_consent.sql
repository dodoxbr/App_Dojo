-- Autorização de imagem dos ADULTOS no feed interno. Decisão do dono do produto (2026-10-22): "como é um feed interno é mais tranquilo,
-- mas vamos pedir a permissão das pessoas". Cada adulto autoriza (ou não), por academia, que a imagem dele apareça no feed fechado da
-- academia; só quem autorizou pode ser marcado numa foto (como já era com os menores, por meio do responsável). A autorização é um
-- registro com o nome digitado, a data e a versão do texto (rascunho até a revisão jurídica); pode ser revogada a qualquer momento e,
-- ao revogar, as fotos em que a pessoa está marcada saem do feed. Quem posta pode se marcar sem precisar autorizar (a própria postagem já é o aceite).

create table public.adult_image_consents (
  academy_id uuid not null references public.academies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  signed_name text not null check (length(btrim(signed_name)) between 5 and 120),
  signed_at timestamptz not null default now(),
  term_version text not null,
  revoked_at timestamptz,
  primary key (academy_id, user_id)
);
alter table public.adult_image_consents enable row level security; -- sem políticas: negar por padrão
revoke all on public.adult_image_consents from public, anon, authenticated;

-- As academias da pessoa e se ela já autorizou.
create function public.my_image_consents()
returns table (academy_id uuid, academy_name text, active boolean, signed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  return query
    select m.academy_id, a.name, coalesce(c.revoked_at is null and c.signed_at is not null, false), c.signed_at
    from public.memberships m
    join public.academies a on a.id = m.academy_id
    left join public.adult_image_consents c on c.academy_id = m.academy_id and c.user_id = m.user_id
    where m.user_id = v_actor and m.status = 'approved' and public.is_adult(v_actor)
    order by a.name;
end;
$$;

create function public.give_image_consent(p_academy_id uuid, p_signature text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_sig text := nullif(btrim(coalesce(p_signature, '')), '');
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_approved_member(p_academy_id) and public.is_adult(v_actor)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not public.valid_signature(v_sig) then raise exception 'VALIDATION_ERROR: signature' using errcode = '22023'; end if;
  insert into public.adult_image_consents (academy_id, user_id, signed_name, term_version)
    values (p_academy_id, v_actor, v_sig, 'rascunho-2026-12')
    on conflict (academy_id, user_id) do update set signed_name = excluded.signed_name, signed_at = now(), term_version = excluded.term_version, revoked_at = null;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'image.consent', 'academies', p_academy_id, '{}'::jsonb);
end;
$$;

-- Revogar: as fotos em que a pessoa está marcada saem do feed (o gestor ou o professor decide o que fazer com elas).
create function public.revoke_image_consent(p_academy_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  update public.adult_image_consents set revoked_at = now() where academy_id = p_academy_id and user_id = v_actor and revoked_at is null;
  if not found then return; end if;
  update public.feed_posts set status = 'hidden', hidden_reason = 'consent revoked'
    where academy_id = p_academy_id and status in ('visible', 'pending')
      and id in (select post_id from public.feed_post_tags where user_id = v_actor);
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'image.revoke', 'academies', p_academy_id, '{}'::jsonb);
end;
$$;

-- A regra de foto: menor precisa da autorização do responsável; adulto precisa da própria autorização (conta como "sem autorização").
create or replace function public.minors_without_photo_consent(p_academy_id uuid, p_user_ids uuid[]) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from unnest(p_user_ids) as t(uid)
  where case
    when public.is_adult(t.uid) then not exists (
      select 1 from public.adult_image_consents a where a.academy_id = p_academy_id and a.user_id = t.uid and a.revoked_at is null)
    else not exists (
      select 1 from public.guardian_consents c
      where c.academy_id = p_academy_id and c.minor_user_id = t.uid and c.status = 'verified' and c.revoked_at is null and c.consent_photos)
  end;
$$;

-- Quem posta pode se marcar sem autorização (a postagem já é o aceite dela).
do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_feed_post';
  if v_def is null or position('public.minors_without_photo_consent(p_academy_id, v_tags)' in v_def) = 0 then raise exception 'create_feed_post nao encontrada'; end if;
  execute replace(v_def, 'public.minors_without_photo_consent(p_academy_id, v_tags)', 'public.minors_without_photo_consent(p_academy_id, array_remove(v_tags, v_actor))');
end;
$$;

-- Quem pode ser marcado: o adulto só se tiver autorizado; o menor, se o responsável autorizou fotos.
create or replace function public.list_feed_people(p_academy_id uuid)
returns table (user_id uuid, person_name text, is_minor boolean, photo_ok boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_approved_member(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select m.user_id, p.display_name, not public.is_adult(m.user_id),
           (m.user_id = (select auth.uid())) or public.minors_without_photo_consent(p_academy_id, array[m.user_id]) = 0
    from public.memberships m join public.profiles p on p.id = m.user_id
    where m.academy_id = p_academy_id and m.status = 'approved'
    order by p.display_name;
end;
$$;

revoke all on function public.my_image_consents(), public.give_image_consent(uuid, text), public.revoke_image_consent(uuid) from public, anon, authenticated;
grant execute on function public.my_image_consents(), public.give_image_consent(uuid, text), public.revoke_image_consent(uuid) to authenticated;
