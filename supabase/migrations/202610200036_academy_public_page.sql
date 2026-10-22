-- Página pública da academia (/a/{slug}): apresentação, contato, endereço, redes sociais e link do mapa.
-- Dados da EMPRESA (não de pessoas): só aparecem para quem não é membro se o gestor marcar `is_public`. Padrão: oculto.
-- A tabela não tem política de leitura; a leitura pública é uma função que só devolve campos do perfil, e só se estiver publicado.
-- Quem edita: gestor da academia ou super admin, por função validada e auditada. Sem dado de aluno, de menor ou de saúde aqui.

create table public.academy_profiles (
  academy_id uuid primary key references public.academies(id) on delete cascade,
  is_public boolean not null default false,
  tagline text check (tagline is null or length(tagline) <= 120),
  description text check (description is null or length(description) <= 1200),
  modalities text[] not null default '{}' check (cardinality(modalities) <= 12),
  phone text check (phone is null or phone ~ '^[0-9]{10,11}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,11}$'),
  address text check (address is null or length(address) <= 200),
  city text check (city is null or length(city) <= 80),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  maps_url text check (maps_url is null or (maps_url ~ '^https://' and length(maps_url) <= 500)),
  instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  facebook_url text check (facebook_url is null or (facebook_url ~ '^https://' and length(facebook_url) <= 300)),
  youtube_url text check (youtube_url is null or (youtube_url ~ '^https://' and length(youtube_url) <= 300)),
  tiktok text check (tiktok is null or tiktok ~ '^[A-Za-z0-9._]{1,30}$'),
  website_url text check (website_url is null or (website_url ~ '^https://' and length(website_url) <= 300)),
  updated_at timestamptz not null default now()
);
alter table public.academy_profiles enable row level security; -- sem políticas: negar por padrão
revoke all on public.academy_profiles from public, anon, authenticated;

-- Gestor / super admin: lê o perfil para editar.
create function public.get_academy_profile(p_academy_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return coalesce((select to_jsonb(p) - 'academy_id' - 'updated_at' from public.academy_profiles p where p.academy_id = p_academy_id), '{}'::jsonb);
end;
$$;

create function public.save_academy_profile(
  p_academy_id uuid, p_is_public boolean, p_tagline text, p_description text, p_modalities text[], p_phone text, p_whatsapp text,
  p_address text, p_city text, p_state text, p_maps_url text, p_instagram text, p_facebook_url text, p_youtube_url text,
  p_tiktok text, p_website_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_mods text[];
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.academies where id = p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct left(btrim(m), 40)) filter (where btrim(m) <> ''), '{}') into v_mods from unnest(coalesce(p_modalities, '{}')) as m;
  -- Os limites de tamanho e de formato são as restrições da tabela; aqui o erro vira VALIDATION_ERROR (22023) para a tela.
  begin
    insert into public.academy_profiles (academy_id, is_public, tagline, description, modalities, phone, whatsapp, address, city, state,
      maps_url, instagram, facebook_url, youtube_url, tiktok, website_url)
    values (p_academy_id, coalesce(p_is_public, false), nullif(btrim(p_tagline), ''), nullif(btrim(p_description), ''), v_mods,
      nullif(btrim(p_phone), ''), nullif(btrim(p_whatsapp), ''), nullif(btrim(p_address), ''), nullif(btrim(p_city), ''), nullif(btrim(p_state), ''),
      nullif(btrim(p_maps_url), ''), nullif(btrim(p_instagram), ''), nullif(btrim(p_facebook_url), ''), nullif(btrim(p_youtube_url), ''),
      nullif(btrim(p_tiktok), ''), nullif(btrim(p_website_url), ''))
    on conflict (academy_id) do update set
      is_public = excluded.is_public, tagline = excluded.tagline, description = excluded.description, modalities = excluded.modalities,
      phone = excluded.phone, whatsapp = excluded.whatsapp, address = excluded.address, city = excluded.city, state = excluded.state,
      maps_url = excluded.maps_url, instagram = excluded.instagram, facebook_url = excluded.facebook_url, youtube_url = excluded.youtube_url,
      tiktok = excluded.tiktok, website_url = excluded.website_url, updated_at = now();
  exception when check_violation then
    raise exception 'VALIDATION_ERROR: profile' using errcode = '22023';
  end;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'academy.profile', 'academies', p_academy_id, jsonb_build_object('is_public', coalesce(p_is_public, false)));
end;
$$;

-- Leitura pública pelo endereço (slug): só devolve se o gestor publicou. Mesmo erro para "não existe" e "não publicado".
create function public.public_academy_page(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
      'academy_id', a.id, 'name', a.name, 'slug', a.slug,
      'logo_version', (select l.updated_at from public.academy_logos l where l.academy_id = a.id),
      'tagline', p.tagline, 'description', p.description, 'modalities', p.modalities, 'phone', p.phone, 'whatsapp', p.whatsapp,
      'address', p.address, 'city', p.city, 'state', p.state, 'maps_url', p.maps_url, 'instagram', p.instagram,
      'facebook_url', p.facebook_url, 'youtube_url', p.youtube_url, 'tiktok', p.tiktok, 'website_url', p.website_url)
  from public.academies a join public.academy_profiles p on p.academy_id = a.id
  where a.slug = lower(btrim(p_slug)) and p.is_public;
$$;

revoke all on function public.get_academy_profile(uuid), public.save_academy_profile(uuid, boolean, text, text, text[], text, text, text, text, text, text, text, text, text, text, text), public.public_academy_page(text) from public, anon, authenticated;
grant execute on function public.get_academy_profile(uuid), public.save_academy_profile(uuid, boolean, text, text, text[], text, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.public_academy_page(text) to anon, authenticated;
