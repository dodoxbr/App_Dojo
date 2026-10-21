-- Owner decisions (2026-10-20) after US-018:
--  (1) the LEGAL guardian follows the child's training through the photos of the feed in which the child appears (most minors have no
--      phone; the account stays linked to the guardian). The guardian sees only posts that tag their own minor, while the consent is
--      verified, active and allows photos.
--  (2) the academy usually posts the trainings on Instagram, so the guardian's consent now has a SEPARATE authorization for the social
--      networks of the academy (it requires the photo authorization). The platform cannot publish anywhere: it tells the manager and the
--      author which posts may go to the social networks (no minor without that authorization).
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, 22023 VALIDATION_ERROR.

alter table public.guardian_consents
  add column consent_social boolean not null default false,
  add constraint guardian_consents_social_chk check (not consent_social or consent_photos);

-- 3 -> 4 arguments (the new one has a default, so old callers keep working). Consent text version bumped to 2026-11.
drop function public.request_dependent_membership(uuid, uuid, boolean);
create function public.request_dependent_membership(p_minor_id uuid, p_academy_id uuid, p_photos boolean, p_social boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_m public.memberships%rowtype;
  v_id uuid;
  v_consent public.guardian_consents%rowtype;
  v_photos boolean := coalesce(p_photos, false);
  v_social boolean := coalesce(p_social, false);
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_legal_guardian_of(p_minor_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.academies where id = p_academy_id) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.has_contact(p_minor_id) then raise exception 'VALIDATION_ERROR: contact required' using errcode = '22023'; end if;
  if v_social and not v_photos then raise exception 'VALIDATION_ERROR: social needs photos' using errcode = '22023'; end if;

  select * into v_consent from public.guardian_consents where academy_id = p_academy_id and minor_user_id = p_minor_id;
  if not found then
    insert into public.guardian_consents (academy_id, minor_user_id, guardian_user_id, consent_photos, consent_social, consent_text_version)
      values (p_academy_id, p_minor_id, v_actor, v_photos, v_social, 'rascunho-2026-11');
  elsif v_consent.revoked_at is not null then
    -- A new consent after a revocation must be verified again by the manager.
    update public.guardian_consents
      set status = 'pending', verified_by = null, verified_at = null, document_checked = false, verification_note = null,
          consent_at = now(), consent_photos = v_photos, consent_social = v_social, consent_text_version = 'rascunho-2026-11', revoked_at = null
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
            jsonb_build_object('minor_user_id', p_minor_id, 'photos', v_photos, 'social', v_social, 'text_version', 'rascunho-2026-11'));
  return v_id;
end;
$$;

-- The manager sees which authorizations each guardian gave.
drop function public.list_academy_guardian_consents(uuid);
create function public.list_academy_guardian_consents(p_academy_id uuid)
returns table (id uuid, minor_user_id uuid, minor_name text, guardian_name text, relationship text, status text,
               consent_active boolean, consent_photos boolean, consent_social boolean, membership_status text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select c.id, c.minor_user_id, pm.display_name, pg.display_name, g.relationship, c.status,
           c.revoked_at is null, c.consent_photos, c.consent_social,
           (select m.status::text from public.memberships m where m.academy_id = c.academy_id and m.user_id = c.minor_user_id), c.created_at
    from public.guardian_consents c
    join public.guardianships g on g.minor_user_id = c.minor_user_id and g.guardian_user_id = c.guardian_user_id and g.kind = 'legal'
    join public.profiles pm on pm.id = c.minor_user_id join public.profiles pg on pg.id = c.guardian_user_id
    where c.academy_id = p_academy_id order by c.created_at desc;
end;
$$;

-- guardian_overview (021) with the social authorization added to each academy.
create or replace function public.guardian_overview(p_minor_id uuid) returns jsonb
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
      'consent_status', c.status, 'consent_active', c.revoked_at is null, 'consent_photos', c.consent_photos, 'consent_social', c.consent_social,
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

-- (1) The legal guardian may read (and so see the picture of) the visible posts that tag their own minor.
create function public.guardian_can_view_post(p_post_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.feed_post_tags t
    join public.feed_posts f on f.id = t.post_id
    join public.guardianships g on g.minor_user_id = t.user_id and g.kind = 'legal' and g.guardian_user_id = (select auth.uid())
    join public.guardian_consents c on c.minor_user_id = t.user_id and c.academy_id = f.academy_id
      and c.status = 'verified' and c.revoked_at is null and c.consent_photos
    where t.post_id = p_post_id and f.status = 'visible' and f.expires_at > now() and not public.is_adult(t.user_id));
$$;

drop policy feed_posts_read on public.feed_posts;
create policy feed_posts_read on public.feed_posts for select to authenticated using (
  expires_at > now() and (
    (status = 'visible' and public.is_approved_member(academy_id))
    or author_user_id = (select auth.uid())
    or public.is_academy_manager(academy_id)
    or public.guardian_can_view_post(id)));

-- The guardian's view: only posts that show their own minor (other people tagged are not named).
create function public.list_dependent_feed(p_minor_id uuid, p_before timestamptz default null, p_limit int default 20)
returns table (id uuid, academy_name text, author_name text, caption text, created_at timestamptz, expires_at timestamptz, width int, height int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_legal_guardian_of(p_minor_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select f.id, a.name, pa.display_name, f.caption, f.created_at, f.expires_at, f.width, f.height
    from public.feed_posts f
    join public.feed_post_tags t on t.post_id = f.id and t.user_id = p_minor_id
    join public.academies a on a.id = f.academy_id
    join public.profiles pa on pa.id = f.author_user_id
    where f.status = 'visible' and f.expires_at > now()
      and exists (select 1 from public.guardian_consents c
                  where c.minor_user_id = p_minor_id and c.academy_id = f.academy_id and c.status = 'verified' and c.revoked_at is null and c.consent_photos)
      and (p_before is null or f.created_at < p_before)
    order by f.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

-- list_feed (027) with `social_ok`: no tagged minor lacks the social-network authorization.
drop function public.list_feed(uuid, timestamptz, int);
create function public.list_feed(p_academy_id uuid, p_before timestamptz default null, p_limit int default 20)
returns table (id uuid, author_name text, caption text, created_at timestamptz, expires_at timestamptz, has_minors boolean, status text,
               hidden_reason text, width int, height int, tags jsonb, mine boolean, can_manage boolean, reported_by_me boolean, social_ok boolean)
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
                                           and c.revoked_at is null and c.consent_social))
    from public.feed_posts f join public.profiles pa on pa.id = f.author_user_id
    where f.academy_id = p_academy_id and f.expires_at > now()
      and (f.status = 'visible' or f.author_user_id = v_actor or v_manager)
      and (p_before is null or f.created_at < p_before)
    order by f.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

revoke all on function public.request_dependent_membership(uuid, uuid, boolean, boolean), public.list_academy_guardian_consents(uuid),
  public.list_dependent_feed(uuid, timestamptz, int), public.list_feed(uuid, timestamptz, int) from public, anon, authenticated;
grant execute on function public.request_dependent_membership(uuid, uuid, boolean, boolean), public.list_academy_guardian_consents(uuid),
  public.list_dependent_feed(uuid, timestamptz, int), public.list_feed(uuid, timestamptz, int) to authenticated;
