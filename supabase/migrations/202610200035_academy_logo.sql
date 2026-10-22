-- Logo da academia (perfil da academia com banner). A imagem, já reprocessada pelo servidor (WebP, sem metadados), fica numa tabela
-- própria SEM política de leitura: ninguém lê a tabela direto. A logo é identidade pública da academia (como o nome no link de
-- entrada), então a leitura é uma função que devolve só a imagem; quem grava é o gestor da academia (ou o super admin), com auditoria.
-- Mesma abordagem do feed (ADR-022): bytea no banco, sem serviço novo.

create table public.academy_logos (
  academy_id uuid primary key references public.academies(id) on delete cascade,
  image bytea not null check (length(image) between 100 and 400000),
  updated_at timestamptz not null default now()
);
alter table public.academy_logos enable row level security; -- sem políticas: negar por padrão
revoke all on public.academy_logos from public, anon, authenticated;

create function public.set_academy_logo(p_academy_id uuid, p_image bytea) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.academies where id = p_academy_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  -- O servidor sempre regrava em WebP: aqui só se confere o tamanho e a assinatura do arquivo (RIFF....WEBP).
  if p_image is null or length(p_image) not between 100 and 400000
     or substring(p_image from 1 for 4) <> '\x52494646'::bytea or substring(p_image from 9 for 4) <> '\x57454250'::bytea then
    raise exception 'VALIDATION_ERROR: image' using errcode = '22023';
  end if;
  insert into public.academy_logos (academy_id, image) values (p_academy_id, p_image)
    on conflict (academy_id) do update set image = excluded.image, updated_at = now();
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'academy.logo', 'academies', p_academy_id, jsonb_build_object('bytes', length(p_image)));
end;
$$;

create function public.remove_academy_logo(p_academy_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_academy_manager(p_academy_id)) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  delete from public.academy_logos where academy_id = p_academy_id;
  if found then
    insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
      values (p_academy_id, v_actor, 'academy.logo_removed', 'academies', p_academy_id, '{}'::jsonb);
  end if;
end;
$$;

-- Leitura pública (identidade da academia): a imagem e a data da última troca (para o navegador renovar o cache).
create function public.academy_logo(p_academy_id uuid) returns bytea
language sql stable security definer set search_path = '' as $$
  select l.image from public.academy_logos l where l.academy_id = p_academy_id;
$$;

create function public.academy_logo_version(p_academy_id uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select l.updated_at from public.academy_logos l where l.academy_id = p_academy_id;
$$;

revoke all on function public.set_academy_logo(uuid, bytea), public.remove_academy_logo(uuid), public.academy_logo(uuid), public.academy_logo_version(uuid) from public, anon, authenticated;
grant execute on function public.set_academy_logo(uuid, bytea), public.remove_academy_logo(uuid) to authenticated;
grant execute on function public.academy_logo(uuid), public.academy_logo_version(uuid) to anon, authenticated;
