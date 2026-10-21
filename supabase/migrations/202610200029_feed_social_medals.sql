-- US-019: reactions, moderated comments and medals. Owner decisions (2026-10-20): ONE reaction type ("Osu"); comments by adult members with
-- report + manager deletes; medals only from what is already verified (validated, non-revoked attendance; finished attendance challenge),
-- a symbol inside the app with no financial value; a minor earns medals but never reacts or comments (the guardian follows).
-- Reactions and comments live and die with the photo (30 days, cascade). The audit trail never holds the comment text.
-- Medals are COMPUTED on demand from attendance (nothing stored): a revoked attendance removes the medal by itself.
-- The thresholds are TEST VALUES (docs/11) until the product owner fixes the final list.
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, P0002 NOT_FOUND, 22023 VALIDATION_ERROR.

create table public.feed_reactions (
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index feed_reactions_user_idx on public.feed_reactions (user_id);
alter table public.feed_reactions enable row level security;

create table public.feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 300),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  client_key uuid not null,
  created_at timestamptz not null default now(),
  unique (author_user_id, client_key)
);
create index feed_comments_post_idx on public.feed_comments (post_id, created_at);
alter table public.feed_comments enable row level security;

create table public.feed_comment_reports (
  comment_id uuid not null references public.feed_comments(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (length(btrim(reason)) between 3 and 300),
  created_at timestamptz not null default now(),
  primary key (comment_id, reporter_user_id)
);
alter table public.feed_comment_reports enable row level security;
-- No policies and no grants: reactions, comments and reports are read and written only through the operations below.

-- Interaction rule shared by reacting and commenting: an adult approved member, on a visible post of the academy that has not expired.
create function public.feed_post_open_for(p_post_id uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_p public.feed_posts%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.feed_posts where id = p_post_id and expires_at > now();
  if not found or v_p.status <> 'visible' or not (public.is_approved_member(v_p.academy_id) and public.is_adult(v_actor)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v_p.academy_id;
end;
$$;

-- Who may READ the comments of a post: the same people who read the post, except the guardian (who sees only the picture).
create function public.feed_post_readable_by_member(p_post_id uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_p public.feed_posts%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.feed_posts where id = p_post_id and expires_at > now();
  if not found or not public.is_approved_member(v_p.academy_id)
     or not (v_p.status = 'visible' or v_p.author_user_id = v_actor or public.is_academy_manager(v_p.academy_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v_p.academy_id;
end;
$$;

-- Reaction: on/off, one per person per post. Returns true when the reaction is now on.
create function public.toggle_feed_reaction(p_post_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_deleted int;
begin
  perform public.feed_post_open_for(p_post_id);
  delete from public.feed_reactions where post_id = p_post_id and user_id = v_actor;
  get diagnostics v_deleted = row_count;
  if v_deleted > 0 then return false; end if;
  insert into public.feed_reactions (post_id, user_id) values (p_post_id, v_actor) on conflict do nothing;
  return true;
end;
$$;

create function public.add_feed_comment(p_post_id uuid, p_body text, p_client_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_academy uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_existing public.feed_comments%rowtype;
  v_id uuid;
begin
  v_academy := public.feed_post_open_for(p_post_id);
  if p_client_key is null then raise exception 'VALIDATION_ERROR: client_key' using errcode = '22023'; end if;
  select * into v_existing from public.feed_comments where author_user_id = v_actor and client_key = p_client_key;
  if found then
    if v_existing.post_id <> p_post_id then raise exception 'VALIDATION_ERROR: client_key reused' using errcode = '22023'; end if;
    return v_existing.id;
  end if;
  if length(v_body) not between 1 and 300 then raise exception 'VALIDATION_ERROR: body' using errcode = '22023'; end if;
  if (select count(*) from public.feed_comments where author_user_id = v_actor and created_at > now() - interval '1 day') >= 30 then
    raise exception 'VALIDATION_ERROR: daily limit' using errcode = '22023';
  end if;
  insert into public.feed_comments (post_id, author_user_id, body, client_key) values (p_post_id, v_actor, v_body, p_client_key) returning id into v_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_academy, v_actor, 'feed.comment', 'feed_comments', v_id, jsonb_build_object('post_id', p_post_id));
  return v_id;
end;
$$;

-- The comments of a post (oldest first). A reported comment is shown only to its author and to the manager.
create function public.list_feed_comments(p_post_id uuid)
returns table (id uuid, author_name text, body text, created_at timestamptz, status text, mine boolean, can_manage boolean, reported_by_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_academy uuid;
  v_manager boolean;
begin
  v_academy := public.feed_post_readable_by_member(p_post_id);
  v_manager := public.is_academy_manager(v_academy);
  return query
    select c.id, p.display_name, c.body, c.created_at, c.status, c.author_user_id = v_actor, v_manager or c.author_user_id = v_actor,
           exists (select 1 from public.feed_comment_reports r where r.comment_id = c.id and r.reporter_user_id = v_actor)
    from public.feed_comments c join public.profiles p on p.id = c.author_user_id
    where c.post_id = p_post_id and (c.status = 'visible' or c.author_user_id = v_actor or v_manager)
    order by c.created_at;
end;
$$;

-- The author or the manager removes the comment for real.
create function public.delete_feed_comment(p_comment_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.feed_comments%rowtype;
  v_academy uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_c from public.feed_comments where id = p_comment_id;
  if not found then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select academy_id into v_academy from public.feed_posts where id = v_c.post_id;
  if not (v_c.author_user_id = v_actor or public.is_academy_manager(v_academy)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  delete from public.feed_comments where id = p_comment_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_academy, v_actor, 'feed.comment_delete', 'feed_comments', p_comment_id, jsonb_build_object('by_author', v_c.author_user_id = v_actor));
end;
$$;

-- Any other member reports a comment: it is hidden for everyone but its author and the manager until the manager decides.
create function public.report_feed_comment(p_comment_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_c public.feed_comments%rowtype;
  v_academy uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_c from public.feed_comments where id = p_comment_id;
  if not found then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  v_academy := public.feed_post_readable_by_member(v_c.post_id);
  if v_c.author_user_id = v_actor then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if length(v_reason) not between 3 and 300 then raise exception 'VALIDATION_ERROR: reason' using errcode = '22023'; end if;
  insert into public.feed_comment_reports (comment_id, reporter_user_id, reason) values (p_comment_id, v_actor, v_reason) on conflict do nothing;
  update public.feed_comments set status = 'hidden' where id = p_comment_id and status = 'visible';
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_academy, v_actor, 'feed.comment_report', 'feed_comments', p_comment_id, '{}'::jsonb);
end;
$$;

create function public.list_comment_reports(p_comment_id uuid) returns table (reason text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_academy uuid;
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select f.academy_id into v_academy from public.feed_comments c join public.feed_posts f on f.id = c.post_id where c.id = p_comment_id;
  if v_academy is null or not public.is_academy_manager(v_academy) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query select r.reason, r.created_at from public.feed_comment_reports r where r.comment_id = p_comment_id order by r.created_at;
end;
$$;

create function public.restore_feed_comment(p_comment_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_academy uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select f.academy_id into v_academy from public.feed_comments c join public.feed_posts f on f.id = c.post_id where c.id = p_comment_id;
  if v_academy is null or not public.is_academy_manager(v_academy) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  delete from public.feed_comment_reports where comment_id = p_comment_id;
  update public.feed_comments set status = 'visible' where id = p_comment_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_academy, v_actor, 'feed.comment_restore', 'feed_comments', p_comment_id, '{}'::jsonb);
end;
$$;

-- list_feed (028) with the reaction count, "I reacted" and the number of visible comments.
drop function public.list_feed(uuid, timestamptz, int);
create function public.list_feed(p_academy_id uuid, p_before timestamptz default null, p_limit int default 20)
returns table (id uuid, author_name text, caption text, created_at timestamptz, expires_at timestamptz, has_minors boolean, status text,
               hidden_reason text, width int, height int, tags jsonb, mine boolean, can_manage boolean, reported_by_me boolean, social_ok boolean,
               reactions int, reacted_by_me boolean, comments int)
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
           exists (select 1 from public.feed_reports r where r.post_id = f.id and r.reporter_user_id = v_actor),
           not exists (select 1 from public.feed_post_tags t
                       where t.post_id = f.id and not public.is_adult(t.user_id)
                         and not exists (select 1 from public.guardian_consents c
                                         where c.academy_id = f.academy_id and c.minor_user_id = t.user_id and c.status = 'verified'
                                           and c.revoked_at is null and c.consent_social)),
           (select count(*)::int from public.feed_reactions x where x.post_id = f.id),
           exists (select 1 from public.feed_reactions x where x.post_id = f.id and x.user_id = v_actor),
           (select count(*)::int from public.feed_comments k where k.post_id = f.id and k.status = 'visible')
    from public.feed_posts f join public.profiles pa on pa.id = f.author_user_id
    where f.academy_id = p_academy_id and f.expires_at > now()
      and (f.status = 'visible' or f.author_user_id = v_actor or v_manager)
      and (p_before is null or f.created_at < p_before)
    order by f.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

-- Medals ---------------------------------------------------------------------------------------------------------

-- Catalog of medals and thresholds. TEST VALUES (docs/11): the final list is a product decision.
create function public.medal_catalog() returns table (code text, title text, kind text, threshold int)
language sql immutable set search_path = '' as $$
  select * from (values
    ('attendance_10', '10 presenças', 'attendance', 10),
    ('attendance_25', '25 presenças', 'attendance', 25),
    ('attendance_50', '50 presenças', 'attendance', 50),
    ('attendance_100', '100 presenças', 'attendance', 100),
    ('streak_4', '4 semanas seguidas', 'streak', 4),
    ('streak_12', '12 semanas seguidas', 'streak', 12),
    ('challenge_winner', 'Vencedor de desafio de presença', 'challenge', 1)
  ) as t(code, title, kind, threshold);
$$;

-- The medals one person has in one academy, from VALIDATED, non-revoked attendance only. Internal: the callers below check access.
create function public.medals_of(p_academy_id uuid, p_user_id uuid) returns table (code text, title text, earned_on date, challenge_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
begin
  select timezone into v_tz from public.academies where id = p_academy_id;
  return query
    with att as (
      select (s.starts_at at time zone v_tz)::date as d, row_number() over (order by s.starts_at, a.id) as rn
      from public.attendances a join public.sessions s on s.id = a.session_id
      where a.academy_id = p_academy_id and a.user_id = p_user_id and a.status = 'validated'
    ), weeks as (
      select distinct date_trunc('week', d::timestamp)::date as w from att
    ), islands as (
      select w, w - (row_number() over (order by w))::int * 7 as grp from weeks
    ), runs as (
      select min(w) as start_w, count(*)::int as n from islands group by grp
    )
    select c.code, c.title, (select d from att where rn = c.threshold), null::uuid
      from public.medal_catalog() c where c.kind = 'attendance' and (select count(*) from att) >= c.threshold
    union all
    select c.code, c.title, (select min(r.start_w + (c.threshold - 1) * 7 + 6) from runs r where r.n >= c.threshold), null::uuid
      from public.medal_catalog() c where c.kind = 'streak' and exists (select 1 from runs r where r.n >= c.threshold)
    union all
    select c.code, c.title || ': ' || w.title, w.ends_on, w.cid
      from public.medal_catalog() c
      join (
        select ch.id as cid, ch.title, ch.ends_on, p.user_id,
               (select count(*) from public.attendances a join public.sessions s on s.id = a.session_id
                 where a.user_id = p.user_id and a.academy_id = ch.academy_id and a.status = 'validated'
                   and (s.starts_at at time zone v_tz)::date between ch.starts_on and ch.ends_on) as n,
               rank() over (partition by ch.id order by (select count(*) from public.attendances a2 join public.sessions s2 on s2.id = a2.session_id
                 where a2.user_id = p.user_id and a2.academy_id = ch.academy_id and a2.status = 'validated'
                   and (s2.starts_at at time zone v_tz)::date between ch.starts_on and ch.ends_on) desc) as r
        from public.challenges ch join public.challenge_participants p on p.challenge_id = ch.id and p.left_at is null
        where ch.academy_id = p_academy_id and ch.metric = 'attendance' and public.challenge_state(ch.id) = 'finished'
      ) w on w.user_id = p_user_id and w.r = 1 and w.n > 0
      where c.kind = 'challenge'
    order by 3 desc, 1;
end;
$$;

-- My own medals in an academy where I am an approved member.
create function public.my_medals(p_academy_id uuid) returns table (code text, title text, earned_on date, challenge_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_approved_member(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query select * from public.medals_of(p_academy_id, (select auth.uid()));
end;
$$;

-- The medal board of the academy: the ADULT members for every member; the manager also sees the minors'.
create function public.list_academy_medals(p_academy_id uuid)
returns table (user_id uuid, person_name text, code text, title text, earned_on date, challenge_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_manager boolean;
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_approved_member(p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  v_manager := public.is_academy_manager(p_academy_id);
  return query
    select m.user_id, p.display_name, x.code, x.title, x.earned_on, x.challenge_id
    from public.memberships m join public.profiles p on p.id = m.user_id
    cross join lateral public.medals_of(p_academy_id, m.user_id) x
    where m.academy_id = p_academy_id and m.status = 'approved' and (v_manager or public.is_adult(m.user_id))
    order by p.display_name, x.earned_on desc;
end;
$$;

-- The legal guardian sees the minor's medals in each academy with a verified, active consent.
create function public.dependent_medals(p_minor_id uuid)
returns table (academy_id uuid, academy_name text, code text, title text, earned_on date, challenge_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_legal_guardian_of(p_minor_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select a.id, a.name, x.code, x.title, x.earned_on, x.challenge_id
    from public.guardian_consents c join public.academies a on a.id = c.academy_id
    cross join lateral public.medals_of(c.academy_id, p_minor_id) x
    where c.minor_user_id = p_minor_id and c.status = 'verified' and c.revoked_at is null
    order by a.name, x.earned_on desc;
end;
$$;

revoke all on function public.feed_post_open_for(uuid), public.feed_post_readable_by_member(uuid), public.toggle_feed_reaction(uuid),
  public.add_feed_comment(uuid, text, uuid), public.list_feed_comments(uuid), public.delete_feed_comment(uuid),
  public.report_feed_comment(uuid, text), public.list_comment_reports(uuid), public.restore_feed_comment(uuid),
  public.list_feed(uuid, timestamptz, int), public.medal_catalog(), public.medals_of(uuid, uuid), public.my_medals(uuid),
  public.list_academy_medals(uuid), public.dependent_medals(uuid) from public, anon, authenticated;
grant execute on function public.toggle_feed_reaction(uuid), public.add_feed_comment(uuid, text, uuid), public.list_feed_comments(uuid),
  public.delete_feed_comment(uuid), public.report_feed_comment(uuid, text), public.list_comment_reports(uuid),
  public.restore_feed_comment(uuid), public.list_feed(uuid, timestamptz, int), public.my_medals(uuid),
  public.list_academy_medals(uuid), public.dependent_medals(uuid) to authenticated;
