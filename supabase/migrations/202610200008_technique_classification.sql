-- Technique type and position (e.g. "Estrangulamento" / "Montada"), with a status so that classifications
-- proposed from public sources are never confused with ones a person validated.
-- Replaces search/create/update_technique to carry the new fields.

alter table public.techniques
  add column technique_type text check (technique_type is null or length(btrim(technique_type)) between 2 and 60),
  add column technique_position text check (technique_position is null or length(btrim(technique_position)) between 2 and 60),
  add column classification_status text check (classification_status in ('proposed', 'validated')),
  add column classification_source text;

alter table public.techniques add constraint techniques_classification_status_chk
  check ((technique_type is null and technique_position is null) or classification_status is not null);

drop function public.search_techniques(text, text, int, int);
create function public.search_techniques(
  p_query text default null, p_category text default null, p_limit int default 50, p_offset int default 0,
  p_type text default null, p_position text default null)
returns table (id uuid, academy_id uuid, name text, category text, level text, reviewed boolean, matched_alias text,
               technique_type text, technique_position text, classification_status text)
language sql stable set search_path = '' as $$
  with q as (
    select public.normalize_text(p_query) as n,
           '%' || replace(replace(replace(public.normalize_text(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' as contains,
           public.normalize_text(p_query) = '' as empty
  )
  select t.id, t.academy_id, t.name, t.category, t.level, t.reviewed_at is not null, a.alias,
         t.technique_type, t.technique_position, t.classification_status
  from public.techniques t
  cross join q
  left join lateral (
    select ta.alias from public.technique_aliases ta
    where not q.empty and ta.technique_id = t.id and public.normalize_text(ta.alias) like q.contains
    order by ta.alias limit 1
  ) a on true
  where (p_category is null or public.normalize_text(t.category) = public.normalize_text(p_category))
    and (p_type is null or public.normalize_text(t.technique_type) = public.normalize_text(p_type))
    and (p_position is null or public.normalize_text(t.technique_position) = public.normalize_text(p_position))
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

drop function public.create_technique(uuid, text, text, text, text, uuid);
create function public.create_technique(
  p_academy_id uuid, p_name text, p_category text, p_level text, p_description text, p_idempotency_key uuid,
  p_type text default null, p_position text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_category text := btrim(coalesce(p_category, ''));
  v_level text := nullif(btrim(coalesce(p_level, '')), '');
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_type text := nullif(btrim(coalesce(p_type, '')), '');
  v_position text := nullif(btrim(coalesce(p_position, '')), '');
  v_id uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
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
  if (v_type is not null and length(v_type) not between 2 and 60) or (v_position is not null and length(v_position) not between 2 and 60) then
    raise exception 'VALIDATION_ERROR: classification' using errcode = '22023';
  end if;

  insert into public.techniques (academy_id, name, category, level, description, created_by,
                                 technique_type, technique_position, classification_status, classification_source)
    values (p_academy_id, v_name, v_category, v_level, v_description, v_actor, v_type, v_position,
            case when v_type is not null or v_position is not null then 'validated' end,
            case when v_type is not null or v_position is not null then 'informado por usuário' end)
    returning id into v_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata, idempotency_key)
    values (p_academy_id, v_actor, 'technique.create', 'techniques', v_id,
      jsonb_build_object('name', v_name, 'category', v_category), p_idempotency_key);
  return v_id;
end;
$$;

drop function public.update_technique(uuid, text, text, text, text);
create function public.update_technique(
  p_technique_id uuid, p_name text, p_category text, p_level text, p_description text,
  p_type text default null, p_position text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_t public.techniques%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_category text := btrim(coalesce(p_category, ''));
  v_level text := nullif(btrim(coalesce(p_level, '')), '');
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_type text := nullif(btrim(coalesce(p_type, '')), '');
  v_position text := nullif(btrim(coalesce(p_position, '')), '');
  v_changed boolean;
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
  if (v_type is not null and length(v_type) not between 2 and 60) or (v_position is not null and length(v_position) not between 2 and 60) then
    raise exception 'VALIDATION_ERROR: classification' using errcode = '22023';
  end if;

  v_changed := v_type is distinct from v_t.technique_type or v_position is distinct from v_t.technique_position;
  -- Editing content invalidates the previous review. A person changing the classification vouches for it.
  update public.techniques
    set name = v_name, category = v_category, level = v_level, description = v_description,
        technique_type = v_type, technique_position = v_position,
        classification_status = case when v_type is null and v_position is null then null
                                     when v_changed then 'validated' else classification_status end,
        classification_source = case when v_type is null and v_position is null then null
                                     when v_changed then 'informado por usuário' else classification_source end,
        reviewed_at = null, reviewed_by = null
    where id = p_technique_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_t.academy_id, v_actor, 'technique.update', 'techniques', p_technique_id,
      jsonb_build_object('before', jsonb_build_object('name', v_t.name, 'category', v_t.category, 'level', v_t.level,
                                                      'type', v_t.technique_type, 'position', v_t.technique_position),
                         'after', jsonb_build_object('name', v_name, 'category', v_category, 'level', v_level,
                                                     'type', v_type, 'position', v_position)));
end;
$$;

-- Reviewing a technique also validates its classification, if any.
create or replace function public.review_technique(p_technique_id uuid) returns void
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
  update public.techniques
    set reviewed_at = now(), reviewed_by = v_actor,
        classification_status = case when technique_type is not null or technique_position is not null then 'validated' end
    where id = p_technique_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id)
    values (v_t.academy_id, v_actor, 'technique.review', 'techniques', p_technique_id);
end;
$$;

revoke all on function public.search_techniques(text, text, int, int, text, text),
  public.create_technique(uuid, text, text, text, text, uuid, text, text),
  public.update_technique(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.search_techniques(text, text, int, int, text, text),
  public.create_technique(uuid, text, text, text, text, uuid, text, text),
  public.update_technique(uuid, text, text, text, text, text, text) to authenticated;
