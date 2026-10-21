-- US-018: photo feed of the academy (replaces the WhatsApp group of the trainings). Owner decisions (2026-10-20): every adult approved
-- member posts; every approved member of the academy sees; photos live 30 days; a photo with a minor only with the guardian's photo
-- consent. The photo is stored ALREADY PROCESSED (metadata removed, resized, re-encoded as JPEG by the server) in this table instead
-- of the Storage service (ADR-022): deleting the row deletes the file for real, and the access rule is the same RLS as the rest.
-- The platform admin does not see the feed. Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, 22023 VALIDATION_ERROR.

create function public.feed_retention_days() returns int
language sql immutable set search_path = '' as $$ select 30; $$;

create function public.is_approved_member(p_academy_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
    where m.academy_id = p_academy_id and m.user_id = (select auth.uid()) and m.status = 'approved');
$$;

create table public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  author_user_id uuid not null references auth.users(id) on delete cascade,
  caption text check (caption is null or length(caption) <= 500),
  image bytea not null check (octet_length(image) between 1 and 800000),
  mime text not null check (mime = 'image/jpeg'),
  width int not null check (width between 1 and 4000),
  height int not null check (height between 1 and 4000),
  has_minors boolean not null default false,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  hidden_reason text check (hidden_reason is null or length(hidden_reason) <= 200),
  client_key uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (author_user_id, client_key)
);
create index feed_posts_academy_idx on public.feed_posts (academy_id, created_at desc);
create index feed_posts_expiry_idx on public.feed_posts (expires_at);
alter table public.feed_posts enable row level security;
-- Members see visible posts that have not expired; the author and the manager also see hidden ones.
create policy feed_posts_read on public.feed_posts for select to authenticated using (
  expires_at > now() and (
    (status = 'visible' and public.is_approved_member(academy_id))
    or author_user_id = (select auth.uid())
    or public.is_academy_manager(academy_id)));
grant select on public.feed_posts to authenticated;

create table public.feed_post_tags (
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (post_id, user_id)
);
create index feed_post_tags_user_idx on public.feed_post_tags (user_id);
alter table public.feed_post_tags enable row level security;

create table public.feed_reports (
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (length(btrim(reason)) between 3 and 300),
  created_at timestamptz not null default now(),
  primary key (post_id, reporter_user_id)
);
alter table public.feed_reports enable row level security;

-- Who can be tagged: the approved members of the academy; for a minor, whether the guardian allowed photos.
create function public.list_feed_people(p_academy_id uuid)
returns table (user_id uuid, person_name text, is_minor boolean, photo_ok boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_approved_member(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select m.user_id, p.display_name, not public.is_adult(m.user_id),
           public.is_adult(m.user_id) or exists (
             select 1 from public.guardian_consents c
             where c.academy_id = m.academy_id and c.minor_user_id = m.user_id and c.status = 'verified'
               and c.revoked_at is null and c.consent_photos)
    from public.memberships m join public.profiles p on p.id = m.user_id
    where m.academy_id = p_academy_id and m.status = 'approved'
    order by p.display_name;
end;
$$;

-- Same photo rule used when posting and when a hidden post is restored.
create function public.minors_without_photo_consent(p_academy_id uuid, p_user_ids uuid[]) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from unnest(p_user_ids) as t(uid)
  where not public.is_adult(t.uid) and not exists (
    select 1 from public.guardian_consents c
    where c.academy_id = p_academy_id and c.minor_user_id = t.uid and c.status = 'verified' and c.revoked_at is null and c.consent_photos);
$$;

-- Posting. The server already stripped the metadata and re-encoded the picture; the database re-checks size and the JPEG signature.
create function public.create_feed_post(
  p_academy_id uuid, p_caption text, p_image bytea, p_width int, p_height int, p_has_minors boolean, p_tag_ids uuid[], p_client_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_caption text := nullif(btrim(coalesce(p_caption, '')), '');
  v_tags uuid[] := coalesce(array(select distinct t from unnest(coalesce(p_tag_ids, '{}')) as t), '{}');
  v_existing public.feed_posts%rowtype;
  v_id uuid;
  v_minors int;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  -- Only adult approved members post (a minor has no login; a guardian posts as themselves).
  if not (public.is_approved_member(p_academy_id) and public.is_adult(v_actor)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
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
  -- Minors: the poster declares them, they must be tagged, and each one needs the guardian's photo consent.
  select count(*)::int into v_minors from unnest(v_tags) as t(uid) where not public.is_adult(t.uid);
  if coalesce(p_has_minors, false) and v_minors = 0 then raise exception 'VALIDATION_ERROR: tag minors' using errcode = '22023'; end if;
  if public.minors_without_photo_consent(p_academy_id, v_tags) > 0 then raise exception 'VALIDATION_ERROR: photo consent' using errcode = '22023'; end if;
  if (select count(*) from public.feed_posts where author_user_id = v_actor and created_at > now() - interval '1 day') >= 20 then
    raise exception 'VALIDATION_ERROR: daily limit' using errcode = '22023';
  end if;

  insert into public.feed_posts (academy_id, author_user_id, caption, image, mime, width, height, has_minors, client_key, expires_at)
    values (p_academy_id, v_actor, v_caption, p_image, 'image/jpeg', p_width, p_height, coalesce(p_has_minors, false) or v_minors > 0, p_client_key,
            now() + make_interval(days => public.feed_retention_days()))
    returning id into v_id;
  insert into public.feed_post_tags (post_id, user_id) select v_id, t from unnest(v_tags) as t;
  -- The audit trail never holds the picture or the caption.
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'feed.post', 'feed_posts', v_id, jsonb_build_object('tags', cardinality(v_tags), 'minors', v_minors));
  return v_id;
end;
$$;

-- The feed page (newest first). Pictures are served separately, by id, under the same access rule.
create function public.list_feed(p_academy_id uuid, p_before timestamptz default null, p_limit int default 20)
returns table (id uuid, author_name text, caption text, created_at timestamptz, expires_at timestamptz, has_minors boolean, status text,
               hidden_reason text, width int, height int, tags jsonb, mine boolean, can_manage boolean, reported_by_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_manager boolean;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_approved_member(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  v_manager := public.is_academy_manager(p_academy_id);
  return query
    select f.id, pa.display_name, f.caption, f.created_at, f.expires_at, f.has_minors, f.status, f.hidden_reason, f.width, f.height,
           coalesce((select jsonb_agg(jsonb_build_object('id', t.user_id, 'name', pt.display_name) order by pt.display_name)
                       from public.feed_post_tags t join public.profiles pt on pt.id = t.user_id where t.post_id = f.id), '[]'::jsonb),
           f.author_user_id = v_actor, v_manager or f.author_user_id = v_actor,
           exists (select 1 from public.feed_reports r where r.post_id = f.id and r.reporter_user_id = v_actor)
    from public.feed_posts f join public.profiles pa on pa.id = f.author_user_id
    where f.academy_id = p_academy_id and f.expires_at > now()
      and (f.status = 'visible' or f.author_user_id = v_actor or v_manager)
      and (p_before is null or f.created_at < p_before)
    order by f.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

-- The author or the manager removes the post for real (picture included).
create function public.delete_feed_post(p_post_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_p public.feed_posts%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.feed_posts where id = p_post_id;
  if not found or not (v_p.author_user_id = v_actor or public.is_academy_manager(v_p.academy_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  delete from public.feed_posts where id = p_post_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_p.academy_id, v_actor, 'feed.delete', 'feed_posts', p_post_id, jsonb_build_object('by_author', v_p.author_user_id = v_actor));
end;
$$;

-- Any other member can report a post: it is hidden for everyone but the author and the manager until the manager decides.
create function public.report_feed_post(p_post_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_p public.feed_posts%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.feed_posts where id = p_post_id and expires_at > now();
  if not found or v_p.author_user_id = v_actor or not public.is_approved_member(v_p.academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if length(v_reason) not between 3 and 300 then raise exception 'VALIDATION_ERROR: reason' using errcode = '22023'; end if;
  insert into public.feed_reports (post_id, reporter_user_id, reason) values (p_post_id, v_actor, v_reason) on conflict do nothing;
  update public.feed_posts set status = 'hidden', hidden_reason = 'reported' where id = p_post_id and status = 'visible';
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_p.academy_id, v_actor, 'feed.report', 'feed_posts', p_post_id, '{}'::jsonb);
end;
$$;

-- The manager reads why a post was reported (reporter names are not shown).
create function public.list_feed_reports(p_post_id uuid) returns table (reason text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_academy uuid;
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select academy_id into v_academy from public.feed_posts where id = p_post_id;
  if v_academy is null or not public.is_academy_manager(v_academy) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query select r.reason, r.created_at from public.feed_reports r where r.post_id = p_post_id order by r.created_at;
end;
$$;

-- The manager puts a hidden post back (reports are cleared) -- only if every tagged minor still has the photo consent.
create function public.restore_feed_post(p_post_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_p public.feed_posts%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.feed_posts where id = p_post_id and expires_at > now();
  if not found or not public.is_academy_manager(v_p.academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if public.minors_without_photo_consent(v_p.academy_id, array(select user_id from public.feed_post_tags where post_id = p_post_id)) > 0 then
    raise exception 'VALIDATION_ERROR: photo consent' using errcode = '22023';
  end if;
  delete from public.feed_reports where post_id = p_post_id;
  update public.feed_posts set status = 'visible', hidden_reason = null where id = p_post_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_p.academy_id, v_actor, 'feed.restore', 'feed_posts', p_post_id, '{}'::jsonb);
end;
$$;

-- Revoking the guardian's consent also hides the posts that show that minor (and still suspends the membership, as in 021).
create or replace function public.revoke_guardian_consent(p_consent_id uuid) returns void
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
  update public.feed_posts set status = 'hidden', hidden_reason = 'consent revoked'
    where academy_id = v_c.academy_id and id in (select post_id from public.feed_post_tags where user_id = v_c.minor_user_id);
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_c.academy_id, v_actor, 'guardian.revoke', 'guardian_consents', p_consent_id, jsonb_build_object('minor_user_id', v_c.minor_user_id));
end;
$$;

-- Retention: every night the expired posts are deleted for real. (They already disappear from the feed the moment they expire.)
create function public.purge_expired_feed_posts() returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_deleted int;
begin
  with gone as (delete from public.feed_posts where expires_at <= now() returning 1)
  select count(*)::int into v_deleted from gone;
  return v_deleted;
end;
$$;
select cron.schedule('purge-feed', '30 9 * * *', 'select public.purge_expired_feed_posts()');

revoke all on function public.feed_retention_days(), public.list_feed_people(uuid),
  public.minors_without_photo_consent(uuid, uuid[]), public.create_feed_post(uuid, text, bytea, int, int, boolean, uuid[], uuid),
  public.list_feed(uuid, timestamptz, int), public.delete_feed_post(uuid), public.report_feed_post(uuid, text),
  public.list_feed_reports(uuid), public.restore_feed_post(uuid), public.purge_expired_feed_posts() from public, anon, authenticated;
grant execute on function public.list_feed_people(uuid), public.create_feed_post(uuid, text, bytea, int, int, boolean, uuid[], uuid),
  public.list_feed(uuid, timestamptz, int), public.delete_feed_post(uuid), public.report_feed_post(uuid, text),
  public.list_feed_reports(uuid), public.restore_feed_post(uuid) to authenticated;
