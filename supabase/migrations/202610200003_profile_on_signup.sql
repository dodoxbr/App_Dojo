-- US-002: the profile is created server-side on signup; clients can no longer INSERT profiles
-- and may only change their own display_name.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 120);
  if length(v_name) < 2 then
    v_name := 'Novo usuário';
  end if;
  insert into public.profiles (id, display_name) values (new.id, v_name);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy profile_self_insert on public.profiles;
revoke insert on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
