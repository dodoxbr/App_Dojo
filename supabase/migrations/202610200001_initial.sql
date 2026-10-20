-- BASELINE INITIAL: identities, tenants, memberships, techniques and private logs.
-- Critical admin mutations and attendance/promotion APIs are intentionally NOT implemented.
create extension if not exists pgcrypto;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (length(trim(display_name)) between 2 and 120),
 created_at timestamptz not null default now()
);
create table public.academies (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 2 and 160),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 owner_user_id uuid not null references auth.users(id),
 theme_primary text not null default '#163A64' check (theme_primary ~ '^#[0-9A-Fa-f]{6}$'),
 theme_secondary text not null default '#FFFFFF' check (theme_secondary ~ '^#[0-9A-Fa-f]{6}$'),
 logo_path text,
 created_at timestamptz not null default now()
);
create type public.membership_status as enum ('pending','approved','rejected','suspended','ended');
create type public.membership_role as enum ('student','instructor','manager');
create table public.memberships (
 id uuid primary key default gen_random_uuid(),
 academy_id uuid not null references public.academies(id),
 user_id uuid not null references auth.users(id),
 role public.membership_role not null default 'student',
 status public.membership_status not null default 'pending',
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(academy_id,user_id)
);
create table public.techniques (
 id uuid primary key default gen_random_uuid(),
 academy_id uuid references public.academies(id),
 name text not null check (length(trim(name)) > 1),
 category text not null,
 level text,
 description text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.training_logs (
 id uuid primary key default gen_random_uuid(),
 academy_id uuid references public.academies(id),
 user_id uuid not null references auth.users(id),
 notes text not null default '',
 trained_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create table public.training_log_techniques (
 log_id uuid not null references public.training_logs(id) on delete cascade,
 technique_id uuid not null references public.techniques(id),
 primary key(log_id,technique_id)
);

-- RLS is deny-by-default. No client can create tenants or approve memberships yet.
alter table public.profiles enable row level security;
alter table public.academies enable row level security;
alter table public.memberships enable row level security;
alter table public.techniques enable row level security;
alter table public.training_logs enable row level security;
alter table public.training_log_techniques enable row level security;

create policy profile_self_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profile_self_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profile_self_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Public academy directory only; sensitive academy fields must not be added to this table without revisiting SELECT exposure.
create policy academy_directory on public.academies for select to authenticated using (true);

create policy membership_self_read on public.memberships for select to authenticated using (user_id = (select auth.uid()));
-- Requests only as a student, with pending status. Approval is a future server-side RPC.
create policy membership_self_request on public.memberships for insert to authenticated
 with check (user_id = (select auth.uid()) and role = 'student' and status = 'pending' and reviewed_by is null and reviewed_at is null);

-- Global techniques are visible; academy-specific techniques only to approved members.
create policy techniques_read on public.techniques for select to authenticated using (
 academy_id is null or exists (
   select 1 from public.memberships m where m.academy_id = techniques.academy_id
   and m.user_id = (select auth.uid()) and m.status = 'approved'
 )
);

create policy logs_self_select on public.training_logs for select to authenticated using (user_id = (select auth.uid()));
create policy logs_self_insert on public.training_logs for insert to authenticated
 with check (user_id = (select auth.uid()) and (academy_id is null or exists (
  select 1 from public.memberships m where m.academy_id = training_logs.academy_id
  and m.user_id = (select auth.uid()) and m.status = 'approved'
 )));
create policy logs_self_update on public.training_logs for update to authenticated
 using (user_id = (select auth.uid()))
 with check (user_id = (select auth.uid()) and (academy_id is null or exists (
  select 1 from public.memberships m where m.academy_id = training_logs.academy_id
  and m.user_id = (select auth.uid()) and m.status = 'approved'
 )));
create policy logs_self_delete on public.training_logs for delete to authenticated using (user_id = (select auth.uid()));

create policy log_techniques_read on public.training_log_techniques for select to authenticated using (
 exists (select 1 from public.training_logs l where l.id = log_id and l.user_id = (select auth.uid()))
);
create policy log_techniques_insert on public.training_log_techniques for insert to authenticated with check (
 exists (select 1 from public.training_logs l where l.id = log_id and l.user_id = (select auth.uid()))
 and exists (select 1 from public.techniques t where t.id = technique_id and
  (t.academy_id is null or exists (select 1 from public.memberships m where m.academy_id = t.academy_id and m.user_id = (select auth.uid()) and m.status = 'approved')))
);
create policy log_techniques_delete on public.training_log_techniques for delete to authenticated using (
 exists (select 1 from public.training_logs l where l.id = log_id and l.user_id = (select auth.uid()))
);

create index memberships_user_idx on public.memberships(user_id,status);
create index memberships_academy_idx on public.memberships(academy_id,status);
create index logs_user_date_idx on public.training_logs(user_id,trained_at desc);
create index techniques_academy_idx on public.techniques(academy_id,category);
