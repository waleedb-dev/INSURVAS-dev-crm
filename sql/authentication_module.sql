-- AUTHENTICATION MODULE (single-role model)
-- - No user_roles table
-- - Role assignment lives in public.users.role_id
-- - No sales_teams table
--
-- Safe to run multiple times.

create extension if not exists pgcrypto;

-- 1) Reference tables
create table if not exists public.call_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) App users profile (1:1 with auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  status text not null default 'invited' check (status in ('active','inactive','invited','suspended')),
  call_center_id uuid references public.call_centers(id) on delete set null,
  role_id uuid references public.roles(id) on delete set null,
  manager_user_id uuid references public.users(id) on delete set null,
  is_licensed boolean not null default false,
  license_number text,
  slack_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Indexes
create index if not exists idx_users_status on public.users(status);
create index if not exists idx_users_call_center on public.users(call_center_id);
create index if not exists idx_users_role_id on public.users(role_id);

-- 4) updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- 5) Fixed role seed
insert into public.roles (key, name, description) values
  ('call_center_agent', 'Call Center Agent', 'Submit and manage own leads'),
  ('call_center_admin', 'Call Center Admin', 'Manage center operations and agents'),
  ('sales_manager', 'Sales Manager', 'Manage sales operations and assignments'),
  ('sales_agent_licensed', 'Sales Agent (Licensed)', 'Licensed sales agent'),
  ('sales_agent_unlicensed', 'Sales Agent (Unlicensed)', 'Unlicensed sales agent'),
  ('system_admin', 'System Administrator', 'Full platform access'),
  ('hr', 'HR', 'User lifecycle and people operations'),
  ('accounting', 'Accounting', 'Commission and finance visibility')
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description;

-- 6) RLS helper functions (all SECURITY DEFINER to bypass RLS and avoid recursion)
create or replace function public.is_active_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = p_user_id and u.status = 'active'
  );
$$;

create or replace function public.has_role(p_role_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = p_role_key
  );
$$;

create or replace function public.has_any_role(p_role_keys text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (p_role_keys)
  );
$$;

create or replace function public.get_user_call_center_id(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.call_center_id from public.users u where u.id = p_user_id;
$$;

grant execute on function public.get_user_call_center_id(uuid) to authenticated;

-- 7) RLS and policies
-- IMPORTANT: all policies on public.users MUST use SECURITY DEFINER helper
-- functions (has_role, has_any_role, get_user_call_center_id) instead of
-- inline subqueries on public.users, to avoid infinite RLS recursion.
alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.call_centers enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own
on public.users
for select
to authenticated
using (id = auth.uid());

drop policy if exists users_select_admin_hr on public.users;
create policy users_select_admin_hr
on public.users
for select
to authenticated
using (public.has_any_role(array['system_admin', 'hr']));

drop policy if exists users_select_system_admin_all on public.users;
create policy users_select_system_admin_all
on public.users
for select
to authenticated
using (public.has_role('system_admin'));

drop policy if exists users_select_call_center_admin_same_center on public.users;
create policy users_select_call_center_admin_same_center
on public.users
for select
to authenticated
using (
  public.has_role('call_center_admin')
  and public.get_user_call_center_id(auth.uid()) is not null
  and public.get_user_call_center_id(auth.uid()) = call_center_id
);

drop policy if exists users_select_publisher_manager on public.users;
create policy users_select_publisher_manager
on public.users
for select
to authenticated
using (public.has_role('publisher_manager'));

drop policy if exists users_update_own on public.users;
create policy users_update_own
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists users_update_admin_hr on public.users;
create policy users_update_admin_hr
on public.users
for update
to authenticated
using (public.has_any_role(array['system_admin', 'hr']))
with check (public.has_any_role(array['system_admin', 'hr']));

drop policy if exists users_insert_own on public.users;
create policy users_insert_own
on public.users
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists users_insert_admin_hr on public.users;
create policy users_insert_admin_hr
on public.users
for insert
to authenticated
with check (public.has_any_role(array['system_admin', 'hr']));

drop policy if exists roles_select_all_authenticated on public.roles;
create policy roles_select_all_authenticated
on public.roles
for select
to authenticated
using (true);

-- 8) Default role assignment for new users and backfill
create or replace function public.assign_default_role_to_user()
returns trigger
language plpgsql
as $$
declare
  default_role_id uuid;
begin
  if new.role_id is null then
    select id into default_role_id from public.roles where key = 'call_center_agent' limit 1;
    if default_role_id is not null then
      new.role_id := default_role_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_default_role on public.users;
create trigger trg_assign_default_role
before insert on public.users
for each row execute function public.assign_default_role_to_user();

-- Backfill any existing user rows missing a role
update public.users
set role_id = (
  select id from public.roles where key = 'call_center_agent' limit 1
)
where role_id is null;

