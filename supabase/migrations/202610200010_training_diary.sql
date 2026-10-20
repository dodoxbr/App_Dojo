-- US-006: private training diary with techniques.
-- Rules: the diary is private by default (CLAUDE.md rule 6) and a training log is NOT attendance (rule 8).
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, P0002 NOT_FOUND, 22023 VALIDATION_ERROR.

alter table public.training_logs
  add column client_key uuid,
  add column updated_at timestamptz not null default now(),
  -- 'private' is the only value until explicit, granular sharing exists (docs/04). A check guards it.
  add column visibility text not null default 'private' check (visibility = 'private'),
  add constraint training_logs_notes_len check (length(notes) <= 10000);

create unique index training_logs_client_key_idx on public.training_logs (user_id, client_key) where client_key is not null;

-- TEST PHASE ONLY: lets the platform admin read all diaries while the product is being tested.
-- Turn it off with `node scripts/set-admin-diary-access.mjs off` (or update the row) BEFORE any real data / pilot.
create table public.platform_settings (
  id boolean primary key default true check (id),
  admin_diary_access boolean not null default true
);
insert into public.platform_settings (id) values (true);
alter table public.platform_settings enable row level security;
create policy platform_settings_read on public.platform_settings for select to authenticated
  using (public.is_platform_admin());
grant select on public.platform_settings to authenticated;

create function public.admin_can_read_diaries() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_platform_admin()
    and coalesce((select s.admin_diary_access from public.platform_settings s where s.id), false);
$$;

create policy logs_admin_read on public.training_logs for select to authenticated
  using (public.admin_can_read_diaries());
create policy log_techniques_admin_read on public.training_log_techniques for select to authenticated
  using (public.admin_can_read_diaries());

-- Atomic create/replace of a log and its techniques. SECURITY INVOKER on purpose: the caller's RLS decides
-- everything (own rows only, approved academy only, visible techniques only).
create function public.save_training_log(
  p_academy_id uuid, p_trained_at timestamptz, p_notes text, p_technique_ids uuid[], p_client_key uuid,
  p_log_id uuid default null)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_notes text := coalesce(p_notes, '');
  v_ids uuid[];
  v_id uuid;
begin
  if v_user is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if p_client_key is null then raise exception 'VALIDATION_ERROR: client_key' using errcode = '22023'; end if;
  if length(v_notes) > 10000 then raise exception 'VALIDATION_ERROR: notes' using errcode = '22023'; end if;
  if p_trained_at is null or p_trained_at > now() + interval '1 day' then
    raise exception 'VALIDATION_ERROR: trained_at' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_technique_ids, '{}')) as x;
  if cardinality(v_ids) > 50 then raise exception 'VALIDATION_ERROR: techniques' using errcode = '22023'; end if;

  if p_log_id is null then
    select id into v_id from public.training_logs where user_id = v_user and client_key = p_client_key;
    if found then return v_id; end if; -- same request repeated
    insert into public.training_logs (academy_id, user_id, notes, trained_at, client_key)
      values (p_academy_id, v_user, v_notes, p_trained_at, p_client_key) returning id into v_id;
  else
    update public.training_logs
      set academy_id = p_academy_id, notes = v_notes, trained_at = p_trained_at, updated_at = now()
      where id = p_log_id and user_id = v_user returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    delete from public.training_log_techniques where log_id = v_id;
  end if;

  insert into public.training_log_techniques (log_id, technique_id) select v_id, unnest(v_ids);
  return v_id;
end;
$$;

revoke all on function public.admin_can_read_diaries(), public.save_training_log(uuid, timestamptz, text, uuid[], uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_can_read_diaries(), public.save_training_log(uuid, timestamptz, text, uuid[], uuid, uuid)
  to authenticated;
