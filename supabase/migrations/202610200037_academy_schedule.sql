-- Grade de horários na página pública da academia ("quase um Instagram"): o gestor monta grupos (ex.: "Adulto — Manhã", "Infantil",
-- "Feminino") com linhas de dias da semana e horários. É informação de divulgação da empresa; não cria aula nem presença (isso continua
-- sendo turma/aula). Guardada como JSON no perfil e validada no banco.
-- Formato: [{"title":"Adulto — Manhã","note":"opcional","lines":[{"days":[1,3],"times":["10:00"],"label":"opcional"}]}]
-- days: 1 = segunda … 7 = domingo.

alter table public.academy_profiles
  add column schedule jsonb not null default '[]'::jsonb check (jsonb_typeof(schedule) = 'array' and jsonb_array_length(schedule) <= 12);

create function public.valid_academy_schedule(p_schedule jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  g jsonb; l jsonb; d jsonb; t jsonb;
begin
  if p_schedule is null or jsonb_typeof(p_schedule) <> 'array' or jsonb_array_length(p_schedule) > 12 then return false; end if;
  for g in select * from jsonb_array_elements(p_schedule) loop
    if jsonb_typeof(g) <> 'object' then return false; end if;
    if jsonb_typeof(g -> 'title') <> 'string' or length(btrim(g ->> 'title')) not between 1 and 60 then return false; end if;
    if g ? 'note' and g -> 'note' <> 'null'::jsonb and (jsonb_typeof(g -> 'note') <> 'string' or length(g ->> 'note') > 120) then return false; end if;
    if jsonb_typeof(g -> 'lines') <> 'array' or jsonb_array_length(g -> 'lines') not between 1 and 8 then return false; end if;
    for l in select * from jsonb_array_elements(g -> 'lines') loop
      if jsonb_typeof(l) <> 'object' then return false; end if;
      if jsonb_typeof(l -> 'days') <> 'array' or jsonb_array_length(l -> 'days') not between 1 and 7 then return false; end if;
      for d in select * from jsonb_array_elements(l -> 'days') loop
        if jsonb_typeof(d) <> 'number' or (d #>> '{}') !~ '^[1-7]$' then return false; end if;
      end loop;
      if jsonb_typeof(l -> 'times') <> 'array' or jsonb_array_length(l -> 'times') not between 1 and 8 then return false; end if;
      for t in select * from jsonb_array_elements(l -> 'times') loop
        if jsonb_typeof(t) <> 'string' or (t #>> '{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return false; end if;
      end loop;
      if l ? 'label' and l -> 'label' <> 'null'::jsonb and (jsonb_typeof(l -> 'label') <> 'string' or length(l ->> 'label') > 40) then return false; end if;
    end loop;
  end loop;
  return true;
end;
$$;

create function public.save_academy_schedule(p_academy_id uuid, p_schedule jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.academies where id = p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not public.valid_academy_schedule(p_schedule) then raise exception 'VALIDATION_ERROR: schedule' using errcode = '22023'; end if;
  insert into public.academy_profiles (academy_id, schedule) values (p_academy_id, p_schedule)
    on conflict (academy_id) do update set schedule = excluded.schedule, updated_at = now();
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'academy.schedule', 'academies', p_academy_id, jsonb_build_object('groups', jsonb_array_length(p_schedule)));
end;
$$;

-- A página pública passa a devolver a grade.
create or replace function public.public_academy_page(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
      'academy_id', a.id, 'name', a.name, 'slug', a.slug,
      'logo_version', (select l.updated_at from public.academy_logos l where l.academy_id = a.id),
      'tagline', p.tagline, 'description', p.description, 'modalities', p.modalities, 'phone', p.phone, 'whatsapp', p.whatsapp,
      'address', p.address, 'city', p.city, 'state', p.state, 'maps_url', p.maps_url, 'instagram', p.instagram,
      'facebook_url', p.facebook_url, 'youtube_url', p.youtube_url, 'tiktok', p.tiktok, 'website_url', p.website_url,
      'schedule', p.schedule)
  from public.academies a join public.academy_profiles p on p.academy_id = a.id
  where a.slug = lower(btrim(p_slug)) and p.is_public;
$$;

revoke all on function public.valid_academy_schedule(jsonb), public.save_academy_schedule(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_academy_schedule(uuid, jsonb) to authenticated;
