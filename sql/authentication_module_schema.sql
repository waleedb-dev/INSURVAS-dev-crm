-- Supabase Auth + fixed-role RBAC schema (PostgreSQL)
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

-- 1) Core profile table (1:1 with auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  status text not null default 'invited' check (status in ('active','inactive','invited','suspended')),
  call_center_id uuid,
  sales_team_id uuid,
  manager_user_id uuid references public.users(id) on delete set null,
  is_licensed boolean not null default false,
  license_number text,
  slack_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional org tables
create table if not exists public.call_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  manager_user_id uuid references public.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Add org foreign keys if missing
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_call_center_id_fkey'
  ) then
    alter table public.users
      add constraint users_call_center_id_fkey
      foreign key (call_center_id) references public.call_centers(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'users_sales_team_id_fkey'
  ) then
    alter table public.users
      add constraint users_sales_team_id_fkey
      foreign key (sales_team_id) references public.sales_teams(id) on delete set null;
  end if;
end $$;

-- 2) Roles
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references public.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, role_id)
);

-- 3) Helpful indexes
create index if not exists idx_users_status on public.users(status);
create index if not exists idx_users_call_center on public.users(call_center_id);
create index if not exists idx_users_sales_team on public.users(sales_team_id);
create index if not exists idx_user_roles_user on public.user_roles(user_id);
create index if not exists idx_user_roles_role on public.user_roles(role_id);

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

-- 5) Seed roles
insert into public.roles (key, name, description) values
  ('call_center_agent', 'Call Center Agent', 'Submit and manage own leads'),
  ('call_center_admin', 'Call Center Admin', 'Manage center operations and agents'),
  ('sales_manager', 'Sales Manager', 'Manage sales team and assignments'),
  ('sales_agent_licensed', 'Sales Agent (Licensed)', 'Licensed sales agent'),
  ('sales_agent_unlicensed', 'Sales Agent (Unlicensed)', 'Unlicensed sales agent'),
  ('system_admin', 'System Administrator', 'Full platform access'),
  ('hr', 'HR', 'User lifecycle and people operations'),
  ('accounting', 'Accounting', 'Commission and finance visibility')
on conflict (key) do nothing;

-- 6) RLS helper functions
create or replace function public.is_active_user(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.users u
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
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.revoked_at is null
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
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.revoked_at is null
      and r.key = any (p_role_keys)
  );
$$;

-- 7) Enable RLS on authz tables
alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.call_centers enable row level security;
alter table public.sales_teams enable row level security;

-- Example policy: users can read own profile
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
using (public.has_any_role(array['system_admin','hr']));

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
using (public.has_any_role(array['system_admin','hr']))
with check (public.has_any_role(array['system_admin','hr']));

drop policy if exists roles_select_all_authenticated on public.roles;
create policy roles_select_all_authenticated
on public.roles
for select
to authenticated
using (true);

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_roles_select_admin_hr on public.user_roles;
create policy user_roles_select_admin_hr
on public.user_roles
for select
to authenticated
using (public.has_any_role(array['system_admin','hr']));

drop policy if exists user_roles_write_admin_hr on public.user_roles;
create policy user_roles_write_admin_hr
on public.user_roles
for all
to authenticated
using (public.has_any_role(array['system_admin','hr']))
with check (public.has_any_role(array['system_admin','hr']));
