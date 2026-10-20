-- US-005: technique catalog (global + per academy), aliases, review, provenance and accent-insensitive search.
-- Error codes: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, P0002 NOT_FOUND, 23505 CONFLICT, 22023 VALIDATION_ERROR.

create extension if not exists unaccent with schema extensions;

-- unaccent() is only STABLE; the wrapper is declared IMMUTABLE so it can back a unique index.
-- Safe here: the dictionary is fixed and we only normalize short labels.
create function public.normalize_text(p_text text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select lower(btrim(regexp_replace(
    extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_text, '')), '\s+', ' ', 'g')));
$$;

alter table public.techniques
  add column source text,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users(id);

-- One technique per (scope, normalized name, normalized category). Global scope uses the zero uuid.
create unique index techniques_scope_name_category_idx on public.techniques (
  coalesce(academy_id, '00000000-0000-0000-0000-000000000000'::uuid),
  public.normalize_text(name),
  public.normalize_text(category)
);

create table public.technique_aliases (
  id uuid primary key default gen_random_uuid(),
  technique_id uuid not null references public.techniques(id) on delete cascade,
  alias text not null check (length(btrim(alias)) between 2 and 120),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index technique_aliases_unique_idx on public.technique_aliases (technique_id, public.normalize_text(alias));

-- Where each technique came from (sheet/row of the reviewed spreadsheet). Also feeds the curriculum (US-009).
create table public.technique_sources (
  id uuid primary key,
  technique_id uuid not null references public.techniques(id) on delete cascade,
  source text not null,
  sheet text not null,
  source_row int not null,
  source_col int not null,
  source_number int,
  raw_name text not null,
  level text,
  belt text
);
create index technique_sources_technique_idx on public.technique_sources (technique_id);

alter table public.technique_aliases enable row level security;
alter table public.technique_sources enable row level security;

create policy techniques_platform_admin_read on public.techniques for select to authenticated
  using (public.is_platform_admin());
-- Aliases are visible exactly when their technique is (the sub-select applies the techniques RLS).
create policy technique_aliases_read on public.technique_aliases for select to authenticated
  using (exists (select 1 from public.techniques t where t.id = technique_aliases.technique_id));
create policy technique_sources_read on public.technique_sources for select to authenticated
  using (public.is_platform_admin());

grant select on public.technique_aliases, public.technique_sources to authenticated;

-- Search ------------------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: RLS decides which techniques the caller can see.
create function public.search_techniques(
  p_query text default null, p_category text default null, p_limit int default 50, p_offset int default 0)
returns table (id uuid, academy_id uuid, name text, category text, level text, reviewed boolean, matched_alias text)
language sql stable set search_path = '' as $$
  with q as (
    select public.normalize_text(p_query) as n,
           '%' || replace(replace(replace(public.normalize_text(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' as contains,
           public.normalize_text(p_query) = '' as empty
  )
  select t.id, t.academy_id, t.name, t.category, t.level, t.reviewed_at is not null, a.alias
  from public.techniques t
  cross join q
  left join lateral (
    select ta.alias from public.technique_aliases ta
    where not q.empty and ta.technique_id = t.id and public.normalize_text(ta.alias) like q.contains
    order by ta.alias limit 1
  ) a on true
  where (p_category is null or public.normalize_text(t.category) = public.normalize_text(p_category))
    and (q.empty or public.normalize_text(t.name) like q.contains or a.alias is not null)
  order by
    case when q.empty then 3
         when public.normalize_text(t.name) = q.n then 0
         when public.normalize_text(t.name) like (replace(replace(replace(q.n, '\', '\\'), '%', '\%'), '_', '\_') || '%') then 1
         when public.normalize_text(t.name) like q.contains then 2
         else 4 end,
    public.normalize_text(t.name)
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Operations --------------------------------------------------------------------------------

create function public.create_technique(
  p_academy_id uuid, p_name text, p_category text, p_level text, p_description text, p_idempotency_key uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_category text := btrim(coalesce(p_category, ''));
  v_level text := nullif(btrim(coalesce(p_level, '')), '');
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  -- Global techniques: platform admin only. Academy techniques: that academy's manager (or platform admin).
  if not (public.is_platform_admin() or (p_academy_id is not null and public.is_academy_manager(p_academy_id))) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_idempotency_key is null then raise exception 'VALIDATION_ERROR: idempotency_key' using errcode = '22023'; end if;

  select entity_id into v_id from public.audit_events
    where actor_user_id = v_actor and action = 'technique.create' and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;

  if p_academy_id is not null and not exists (select 1 from public.academies where id = p_academy_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if length(v_name) not between 2 and 160 then raise exception 'VALIDATION_ERROR: name' using errcode = '22023'; end if;
  if length(v_category) not between 2 and 80 then raise exception 'VALIDATION_ERROR: category' using errcode = '22023'; end if;
  if v_level is not null and length(v_level) > 40 then raise exception 'VALIDATION_ERROR: level' using errcode = '22023'; end if;
  if v_description is not null and length(v_description) > 4000 then raise exception 'VALIDATION_ERROR: description' using errcode = '22023'; end if;

  insert into public.techniques (academy_id, name, category, level, description, created_by)
    values (p_academy_id, v_name, v_category, v_level, v_description, v_actor) returning id into v_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (p_academy_id, v_actor, 'technique.create', 'techniques', v_id,
      jsonb_build_object('name', v_name, 'category', v_category), p_idempotency_key);
  return v_id;
end;
$$;

create function public.update_technique(
  p_technique_id uuid, p_name text, p_category text, p_level text, p_description text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_t public.techniques%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_category text := btrim(coalesce(p_category, ''));
  v_level text := nullif(btrim(coalesce(p_level, '')), '');
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_t from public.techniques where id = p_technique_id;
  if not found or not (public.is_platform_admin() or (v_t.academy_id is not null and public.is_academy_manager(v_t.academy_id))) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(v_name) not between 2 and 160 then raise exception 'VALIDATION_ERROR: name' using errcode = '22023'; end if;
  if length(v_category) not between 2 and 80 then raise exception 'VALIDATION_ERROR: category' using errcode = '22023'; end if;
  if v_level is not null and length(v_level) > 40 then raise exception 'VALIDATION_ERROR: level' using errcode = '22023'; end if;
  if v_description is not null and length(v_description) > 4000 then raise exception 'VALIDATION_ERROR: description' using errcode = '22023'; end if;

  -- Editing content invalidates the previous review.
  update public.techniques
    set name = v_name, category = v_category, level = v_level, description = v_description,
        reviewed_at = null, reviewed_by = null
    where id = p_technique_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_t.academy_id, v_actor, 'technique.update', 'techniques', p_technique_id,
      jsonb_build_object('before', jsonb_build_object('name', v_t.name, 'category', v_t.category, 'level', v_t.level),
                         'after', jsonb_build_object('name', v_name, 'category', v_category, 'level', v_level)));
end;
$$;

create function public.review_technique(p_technique_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_t public.techniques%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_t from public.techniques where id = p_technique_id;
  if not found or not (public.is_platform_admin() or (v_t.academy_id is not null and public.is_academy_manager(v_t.academy_id))) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.techniques set reviewed_at = now(), reviewed_by = v_actor where id = p_technique_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id)
    values (v_t.academy_id, v_actor, 'technique.review', 'techniques', p_technique_id);
end;
$$;

create function public.add_technique_alias(p_technique_id uuid, p_alias text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_t public.techniques%rowtype;
  v_alias text := btrim(coalesce(p_alias, ''));
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_t from public.techniques where id = p_technique_id;
  if not found or not (public.is_platform_admin() or (v_t.academy_id is not null and public.is_academy_manager(v_t.academy_id))) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(v_alias) not between 2 and 120 then raise exception 'VALIDATION_ERROR: alias' using errcode = '22023'; end if;
  insert into public.technique_aliases (technique_id, alias, created_by) values (p_technique_id, v_alias, v_actor)
    returning id into v_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_t.academy_id, v_actor, 'technique.alias_add', 'technique_aliases', v_id,
      jsonb_build_object('technique_id', p_technique_id, 'alias', v_alias));
  return v_id;
end;
$$;

create function public.remove_technique_alias(p_alias_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_a public.technique_aliases%rowtype;
  v_t public.techniques%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_a from public.technique_aliases where id = p_alias_id;
  if found then select * into v_t from public.techniques where id = v_a.technique_id; end if;
  if not found or not (public.is_platform_admin() or (v_t.academy_id is not null and public.is_academy_manager(v_t.academy_id))) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  delete from public.technique_aliases where id = p_alias_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_t.academy_id, v_actor, 'technique.alias_remove', 'technique_aliases', p_alias_id,
      jsonb_build_object('technique_id', v_a.technique_id, 'alias', v_a.alias));
end;
$$;

revoke all on function public.normalize_text(text), public.search_techniques(text, text, int, int),
  public.create_technique(uuid, text, text, text, text, uuid), public.update_technique(uuid, text, text, text, text),
  public.review_technique(uuid), public.add_technique_alias(uuid, text), public.remove_technique_alias(uuid)
  from public, anon, authenticated;
grant execute on function public.normalize_text(text), public.search_techniques(text, text, int, int),
  public.create_technique(uuid, text, text, text, text, uuid), public.update_technique(uuid, text, text, text, text),
  public.review_technique(uuid), public.add_technique_alias(uuid, text), public.remove_technique_alias(uuid)
  to authenticated;
