-- Feed: o professor é sempre moderador ("como ele sempre faz na academia": respeito vem primeiro, sem zoeira) e foto com criança
-- só aparece depois que o professor ou o gestor aprova. Decisões do dono do produto (2026-10-22):
--  * moderadores do feed = gestor E instrutor aprovado da academia (antes só o gestor): apagam, escondem, devolvem e aprovam;
--  * foto que mostra criança ou adolescente, ou foto postada pelo RESPONSÁVEL (conta de responsável), nasce "pending" e só vira
--    pública quando um moderador aprova; recusa (com motivo) esconde e a foto some em 3 dias;
--  * o responsável legal de um menor com vínculo aprovado pode postar (só com o próprio menor marcado);
--  * a gestão e os instrutores postam direto (já são os moderadores); o consentimento do responsável pela foto continua obrigatório.
-- Os estados do post passam a ser visible | hidden | pending | rejected. Quem vê pending/rejected: o autor e os moderadores.

alter table public.feed_posts drop constraint feed_posts_status_check;
alter table public.feed_posts add constraint feed_posts_status_check check (status in ('visible', 'hidden', 'pending', 'rejected'));

create function public.is_feed_moderator(p_academy_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_academy_manager(p_academy_id)
    or exists (select 1 from public.memberships m
               where m.academy_id = p_academy_id and m.user_id = (select auth.uid()) and m.role = 'instructor' and m.status = 'approved');
$$;

-- Responsável legal de um menor que tem vínculo aprovado na academia (pode postar fotos do próprio menor).
create function public.is_guardian_of_member_minor(p_academy_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.guardianships g
    join public.memberships m on m.user_id = g.minor_user_id and m.academy_id = p_academy_id and m.status = 'approved'
    where g.guardian_user_id = (select auth.uid()) and g.kind = 'legal' and not public.is_adult(g.minor_user_id));
$$;

-- Os moderadores passam a valer onde só o gestor valia (leitura de posts e comentários, apagar, devolver, ver denúncias).
-- A troca é feita sobre a definição atual de cada função, para não copiar texto à mão.
do $$
declare
  v_name text;
  v_def text;
begin
  foreach v_name in array array['delete_feed_post', 'list_feed_reports', 'restore_feed_post', 'list_feed', 'feed_post_readable_by_member',
                                'list_feed_comments', 'delete_feed_comment', 'list_comment_reports', 'restore_feed_comment'] loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_name;
    if v_def is null or position('public.is_academy_manager(' in v_def) = 0 then raise exception 'funcao % nao encontrada ou sem a checagem esperada', v_name; end if;
    execute replace(v_def, 'public.is_academy_manager(', 'public.is_feed_moderator(');
  end loop;
end;
$$;

drop policy feed_posts_read on public.feed_posts;
create policy feed_posts_read on public.feed_posts for select to authenticated using (
  expires_at > now() and (
    (status = 'visible' and public.is_approved_member(academy_id))
    or author_user_id = (select auth.uid())
    or public.is_feed_moderator(academy_id)
    or public.guardian_can_view_post(id)));

-- Postar: membro adulto aprovado OU responsável de um menor com vínculo aprovado. Foto com menor, ou de responsável, fica pendente.
create or replace function public.create_feed_post(
  p_academy_id uuid, p_caption text, p_image bytea, p_width int, p_height int, p_has_minors boolean, p_tag_ids uuid[], p_client_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_caption text := nullif(btrim(coalesce(p_caption, '')), '');
  v_tags uuid[] := coalesce(array(select distinct t from unnest(coalesce(p_tag_ids, '{}')) as t), '{}');
  v_existing public.feed_posts%rowtype;
  v_id uuid;
  v_minors int;
  v_member boolean;
  v_status text;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  v_member := public.is_approved_member(p_academy_id) and public.is_adult(v_actor);
  if not (v_member or public.is_guardian_of_member_minor(p_academy_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_client_key is null then raise exception 'VALIDATION_ERROR: client_key' using errcode = '22023'; end if;
  select * into v_existing from public.feed_posts where author_user_id = v_actor and client_key = p_client_key;
  if found then
    if v_existing.academy_id <> p_academy_id then raise exception 'VALIDATION_ERROR: client_key reused' using errcode = '22023'; end if;
    return v_existing.id;
  end if;
  if v_caption is not null and length(v_caption) > 500 then raise exception 'VALIDATION_ERROR: caption' using errcode = '22023'; end if;
  if p_image is null or octet_length(p_image) not between 1 and 800000 or substring(p_image from 1 for 3) <> '\xffd8ff'::bytea then
    raise exception 'VALIDATION_ERROR: image' using errcode = '22023';
  end if;
  if p_width is null or p_height is null or p_width not between 1 and 4000 or p_height not between 1 and 4000 then
    raise exception 'VALIDATION_ERROR: image size' using errcode = '22023';
  end if;
  if cardinality(v_tags) > 30 then raise exception 'VALIDATION_ERROR: tags' using errcode = '22023'; end if;
  if exists (select 1 from unnest(v_tags) as t(uid)
             where not exists (select 1 from public.memberships m where m.academy_id = p_academy_id and m.user_id = t.uid and m.status = 'approved')) then
    raise exception 'VALIDATION_ERROR: tags' using errcode = '22023';
  end if;
  -- Quem posta só como responsável (sem vínculo próprio) só pode marcar os próprios menores, e precisa marcar pelo menos um.
  if not v_member and (cardinality(v_tags) = 0 or exists (
      select 1 from unnest(v_tags) as t(uid)
      where not exists (select 1 from public.guardianships g where g.guardian_user_id = v_actor and g.minor_user_id = t.uid and g.kind = 'legal'))) then
    raise exception 'VALIDATION_ERROR: guardian tags' using errcode = '22023';
  end if;
  -- Menores: quem posta declara, eles precisam estar marcados e cada um precisa do consentimento de foto do responsável.
  select count(*)::int into v_minors from unnest(v_tags) as t(uid) where not public.is_adult(t.uid);
  if coalesce(p_has_minors, false) and v_minors = 0 then raise exception 'VALIDATION_ERROR: tag minors' using errcode = '22023'; end if;
  if public.minors_without_photo_consent(p_academy_id, v_tags) > 0 then raise exception 'VALIDATION_ERROR: photo consent' using errcode = '22023'; end if;
  if (select count(*) from public.feed_posts where author_user_id = v_actor and created_at > now() - interval '1 day') >= 20 then
    raise exception 'VALIDATION_ERROR: daily limit' using errcode = '22023';
  end if;

  -- Moderadores (gestor e instrutor) publicam direto; os demais esperam a aprovação quando há menor na foto ou quando quem posta é o responsável.
  v_status := case when public.is_feed_moderator(p_academy_id) then 'visible'
                   when coalesce(p_has_minors, false) or v_minors > 0 or not v_member then 'pending'
                   else 'visible' end;
  insert into public.feed_posts (academy_id, author_user_id, caption, image, mime, width, height, has_minors, status, client_key, expires_at)
    values (p_academy_id, v_actor, v_caption, p_image, 'image/jpeg', p_width, p_height, coalesce(p_has_minors, false) or v_minors > 0, v_status, p_client_key,
            now() + make_interval(days => public.feed_retention_days()))
    returning id into v_id;
  insert into public.feed_post_tags (post_id, user_id) select v_id, t from unnest(v_tags) as t;
  -- A trilha de auditoria nunca guarda a foto nem a legenda.
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'feed.post', 'feed_posts', v_id, jsonb_build_object('tags', cardinality(v_tags), 'minors', v_minors, 'status', v_status));
  return v_id;
end;
$$;

-- O moderador aprova (a foto fica pública no feed) ou recusa (com motivo; a foto some em 3 dias). Só posts pendentes.
create function public.moderate_feed_post(p_post_id uuid, p_approve boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_p public.feed_posts%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.feed_posts where id = p_post_id and expires_at > now();
  if not found or not public.is_feed_moderator(v_p.academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_p.status <> 'pending' then raise exception 'VALIDATION_ERROR: not pending' using errcode = '22023'; end if;
  if coalesce(p_approve, false) then
    -- Antes de publicar, o consentimento de foto de cada menor marcado tem de continuar valendo.
    if public.minors_without_photo_consent(v_p.academy_id, array(select user_id from public.feed_post_tags where post_id = p_post_id)) > 0 then
      raise exception 'VALIDATION_ERROR: photo consent' using errcode = '22023';
    end if;
    update public.feed_posts set status = 'visible', hidden_reason = null where id = p_post_id;
  else
    if v_reason is null or length(v_reason) not between 3 and 200 then raise exception 'VALIDATION_ERROR: reason' using errcode = '22023'; end if;
    update public.feed_posts set status = 'rejected', hidden_reason = v_reason, expires_at = least(expires_at, now() + interval '3 days') where id = p_post_id;
  end if;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_p.academy_id, v_actor, case when coalesce(p_approve, false) then 'feed.approve' else 'feed.reject' end, 'feed_posts', p_post_id, '{}'::jsonb);
end;
$$;

-- Quantas fotos esperam aprovação (para o aviso do professor e do gestor).
create function public.pending_feed_count(p_academy_id uuid) returns int
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_feed_moderator(p_academy_id) then return 0; end if;
  return (select count(*)::int from public.feed_posts where academy_id = p_academy_id and status = 'pending' and expires_at > now());
end;
$$;

revoke all on function public.is_feed_moderator(uuid), public.is_guardian_of_member_minor(uuid), public.moderate_feed_post(uuid, boolean, text), public.pending_feed_count(uuid) from public, anon, authenticated;
grant execute on function public.is_feed_moderator(uuid), public.is_guardian_of_member_minor(uuid), public.moderate_feed_post(uuid, boolean, text), public.pending_feed_count(uuid) to authenticated;
