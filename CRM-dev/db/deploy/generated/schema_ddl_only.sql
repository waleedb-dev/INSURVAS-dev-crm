-- Auto-generated DDL-only schema pack
-- Source: /sql/*.sql (excluding clean_swipe.sql)
-- DML stripped: INSERT/UPDATE/DELETE/TRUNCATE/COPY
-- BEGIN authentication_module.sql
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
-- END authentication_module.sql

-- BEGIN permissions_module.sql
-- PERMISSIONS MODULE
-- Prerequisites:
-- 1) Run sql/authentication_module.sql first
-- 2) roles, users, and has_role/has_any_role must exist
--
-- Safe to run multiple times.

create extension if not exists pgcrypto;
-- 1) Permission catalog and role mapping
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  resource text not null,
  action text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);
create table if not exists public.user_permissions (
  user_id uuid not null references public.users(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);
create index if not exists idx_permissions_resource_action on public.permissions(resource, action);
create index if not exists idx_role_permissions_role_id on public.role_permissions(role_id);
create index if not exists idx_role_permissions_permission_id on public.role_permissions(permission_id);
create index if not exists idx_user_permissions_user_id on public.user_permissions(user_id);
create index if not exists idx_user_permissions_permission_id on public.user_permissions(permission_id);
-- 3) Role -> permission mapping seed
with mapping(role_key, permission_key) as (
  values
    ('system_admin', 'page.daily_deal_flow.access'),
    ('system_admin', 'action.daily_deal_flow.process'),
    ('system_admin', 'page.assigning.access'),
    ('system_admin', 'action.assigning.assign'),
    ('system_admin', 'page.lead_pipeline.access'),
    ('system_admin', 'action.lead_pipeline.update'),
    ('system_admin', 'page.commissions.access'),
    ('system_admin', 'action.commissions.approve'),
    ('system_admin', 'page.transfer_leads.access'),
    ('system_admin', 'action.transfer_leads.view_all'),
    ('system_admin', 'action.transfer_leads.edit'),
    ('system_admin', 'action.transfer_leads.claim_reclaim_visit'),

    ('sales_manager', 'page.daily_deal_flow.access'),
    ('sales_manager', 'action.daily_deal_flow.process'),
    ('sales_manager', 'page.assigning.access'),
    ('sales_manager', 'action.assigning.assign'),
    ('sales_manager', 'page.lead_pipeline.access'),
    ('sales_manager', 'action.lead_pipeline.update'),
    ('sales_manager', 'page.commissions.access'),
    ('sales_manager', 'page.transfer_leads.access'),
    ('sales_manager', 'action.transfer_leads.view_all'),
    ('sales_manager', 'action.transfer_leads.edit'),
    ('sales_manager', 'action.transfer_leads.claim_reclaim_visit'),

    ('sales_agent_licensed', 'page.daily_deal_flow.access'),
    ('sales_agent_licensed', 'action.daily_deal_flow.process'),
    ('sales_agent_licensed', 'page.lead_pipeline.access'),
    ('sales_agent_licensed', 'action.lead_pipeline.update'),
    ('sales_agent_licensed', 'page.transfer_leads.access'),
    ('sales_agent_licensed', 'action.transfer_leads.view_all'),
    ('sales_agent_licensed', 'action.transfer_leads.edit'),
    ('sales_agent_licensed', 'action.transfer_leads.claim_reclaim_visit'),

    ('sales_agent_unlicensed', 'page.daily_deal_flow.access'),
    ('sales_agent_unlicensed', 'page.lead_pipeline.access'),
    ('sales_agent_unlicensed', 'action.lead_pipeline.update'),
    ('sales_agent_unlicensed', 'page.transfer_leads.access'),
    ('sales_agent_unlicensed', 'action.transfer_leads.view_all'),
    ('sales_agent_unlicensed', 'action.transfer_leads.edit'),
    ('sales_agent_unlicensed', 'action.transfer_leads.claim_reclaim_visit'),

    ('call_center_admin', 'page.daily_deal_flow.access'),
    ('call_center_admin', 'action.daily_deal_flow.process'),
    ('call_center_admin', 'page.assigning.access'),
    ('call_center_admin', 'action.assigning.assign'),
    ('call_center_admin', 'page.lead_pipeline.access'),
    ('call_center_admin', 'action.lead_pipeline.update'),
    ('call_center_admin', 'page.transfer_leads.access'),
    ('call_center_admin', 'action.transfer_leads.view_call_center'),
    ('call_center_admin', 'action.transfer_leads.create'),

    ('call_center_agent', 'page.daily_deal_flow.access'),
    ('call_center_agent', 'action.daily_deal_flow.process'),
    ('call_center_agent', 'page.lead_pipeline.access'),
    ('call_center_agent', 'action.lead_pipeline.update'),
    ('call_center_agent', 'page.transfer_leads.access'),
    ('call_center_agent', 'action.transfer_leads.view_own'),
    ('call_center_agent', 'action.transfer_leads.create'),

    ('accounting', 'page.commissions.access'),
    ('accounting', 'action.commissions.approve')
)
insert into public.role_permissions (role_id, permission_id)
select
  r.id as role_id,
  p.id as permission_id
from mapping m
join public.roles r on r.key = m.role_key
join public.permissions p on p.key = m.permission_key
on conflict (role_id, permission_id) do nothing;
-- 4) Permission helper functions
create or replace function public.has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.permissions p
    where p.is_active = true
      and p.key = p_permission_key
      and (
        exists (
          select 1
          from public.users u
          join public.role_permissions rp on rp.role_id = u.role_id
          where u.id = auth.uid()
            and rp.permission_id = p.id
        )
        or exists (
          select 1
          from public.user_permissions up
          where up.user_id = auth.uid()
            and up.permission_id = p.id
        )
      )
  );
$$;
create or replace function public.has_any_permission(p_permission_keys text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.permissions p
    where p.is_active = true
      and p.key = any (p_permission_keys)
      and (
        exists (
          select 1
          from public.users u
          join public.role_permissions rp on rp.role_id = u.role_id
          where u.id = auth.uid()
            and rp.permission_id = p.id
        )
        or exists (
          select 1
          from public.user_permissions up
          where up.user_id = auth.uid()
            and up.permission_id = p.id
        )
      )
  );
$$;
-- 5) RLS and policies
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permissions enable row level security;
drop policy if exists permissions_select_all_authenticated on public.permissions;
create policy permissions_select_all_authenticated
on public.permissions
for select
to authenticated
using (is_active = true);
drop policy if exists role_permissions_select_own_role on public.role_permissions;
create policy role_permissions_select_own_role
on public.role_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role_id = role_permissions.role_id
  )
);
drop policy if exists role_permissions_select_admin_hr on public.role_permissions;
create policy role_permissions_select_admin_hr
on public.role_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and (r.key = 'system_admin' or r.key = 'hr')
  )
);
drop policy if exists role_permissions_write_system_admin on public.role_permissions;
create policy role_permissions_write_system_admin
on public.role_permissions
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = 'system_admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = 'system_admin'
  )
);
drop policy if exists user_permissions_select_own_user on public.user_permissions;
create policy user_permissions_select_own_user
on public.user_permissions
for select
to authenticated
using (user_id = auth.uid());
drop policy if exists user_permissions_select_admin_hr on public.user_permissions;
create policy user_permissions_select_admin_hr
on public.user_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and (r.key = 'system_admin' or r.key = 'hr')
  )
);
drop policy if exists user_permissions_write_system_admin on public.user_permissions;
create policy user_permissions_write_system_admin
on public.user_permissions
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = 'system_admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = 'system_admin'
  )
);
-- END permissions_module.sql

-- BEGIN departments_module.sql
-- Departments (publisher-management scope). Prerequisite: public.users exists.
-- Run after authentication_module.sql. Safe to run multiple times.

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  publisher_manager_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.departments.publisher_manager_user_id is
  'User (Publisher Manager role) who receives new tickets for this department.';
comment on table public.departments is
  'Publisher-management departments. For now one row: all new tickets assign to publisher_manager_user_id.';
drop trigger if exists trg_departments_updated_at on public.departments;
create trigger trg_departments_updated_at
before update on public.departments
for each row execute function public.set_updated_at();
create index if not exists departments_publisher_manager_user_id_idx
  on public.departments (publisher_manager_user_id);
alter table public.departments enable row level security;
drop policy if exists departments_select_authenticated on public.departments;
create policy departments_select_authenticated
on public.departments
for select
to authenticated
using (true);
drop policy if exists departments_write_system_admin on public.departments;
create policy departments_write_system_admin
on public.departments
for all
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));
grant select on public.departments to authenticated;
-- END departments_module.sql

-- BEGIN carriers_and_bpo_management.sql
-- Carrier Management
create table if not exists public.carriers (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_carriers_updated_at on public.carriers;
create trigger trg_carriers_updated_at
before update on public.carriers
for each row execute function public.set_updated_at();
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.carriers to authenticated;
grant usage, select on sequence public.carriers_id_seq to authenticated;
alter table public.carriers enable row level security;
drop policy if exists carriers_select_system_admin on public.carriers;
create policy carriers_select_system_admin
on public.carriers
for select
to authenticated
using (public.has_role('system_admin'));
drop policy if exists carriers_insert_system_admin on public.carriers;
create policy carriers_insert_system_admin
on public.carriers
for insert
to authenticated
with check (public.has_role('system_admin'));
drop policy if exists carriers_update_system_admin on public.carriers;
create policy carriers_update_system_admin
on public.carriers
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));
drop policy if exists carriers_delete_system_admin on public.carriers;
create policy carriers_delete_system_admin
on public.carriers
for delete
to authenticated
using (public.has_role('system_admin'));
-- Carrier Products
create table if not exists public.products (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.carrier_products (
  carrier_id bigint not null references public.carriers(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (carrier_id, product_id)
);
create index if not exists idx_carrier_products_carrier_id on public.carrier_products(carrier_id);
create index if not exists idx_carrier_products_product_id on public.carrier_products(product_id);
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.carrier_products to authenticated;
grant usage, select on sequence public.products_id_seq to authenticated;
alter table public.products enable row level security;
alter table public.carrier_products enable row level security;
drop policy if exists products_select_system_admin on public.products;
create policy products_select_system_admin
on public.products
for select
to authenticated
using (public.has_role('system_admin'));
drop policy if exists products_insert_system_admin on public.products;
create policy products_insert_system_admin
on public.products
for insert
to authenticated
with check (public.has_role('system_admin'));
drop policy if exists products_update_system_admin on public.products;
create policy products_update_system_admin
on public.products
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));
drop policy if exists products_delete_system_admin on public.products;
create policy products_delete_system_admin
on public.products
for delete
to authenticated
using (public.has_role('system_admin'));
drop policy if exists carrier_products_select_system_admin on public.carrier_products;
create policy carrier_products_select_system_admin
on public.carrier_products
for select
to authenticated
using (public.has_role('system_admin'));
drop policy if exists carrier_products_insert_system_admin on public.carrier_products;
create policy carrier_products_insert_system_admin
on public.carrier_products
for insert
to authenticated
with check (public.has_role('system_admin'));
drop policy if exists carrier_products_update_system_admin on public.carrier_products;
create policy carrier_products_update_system_admin
on public.carrier_products
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));
drop policy if exists carrier_products_delete_system_admin on public.carrier_products;
create policy carrier_products_delete_system_admin
on public.carrier_products
for delete
to authenticated
using (public.has_role('system_admin'));
-- BPO Centres / Call Centers browser access for system admin
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.call_centers to authenticated;
alter table public.call_centers enable row level security;
drop policy if exists call_centers_select_system_admin on public.call_centers;
create policy call_centers_select_system_admin
on public.call_centers
for select
to authenticated
using (public.has_role('system_admin'));
drop policy if exists call_centers_insert_system_admin on public.call_centers;
create policy call_centers_insert_system_admin
on public.call_centers
for insert
to authenticated
with check (public.has_role('system_admin'));
drop policy if exists call_centers_update_system_admin on public.call_centers;
create policy call_centers_update_system_admin
on public.call_centers
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));
drop policy if exists call_centers_delete_system_admin on public.call_centers;
create policy call_centers_delete_system_admin
on public.call_centers
for delete
to authenticated
using (public.has_role('system_admin'));
-- Carrier Additional Information (Requirements, Authorization Format, Limitations)
create table if not exists public.carrier_info (
  id bigserial primary key,
  carrier_id bigint not null references public.carriers(id) on delete cascade,
  group_type text not null check (group_type in ('Carrier Requirements', 'Authorization Format', 'Limitations', 'Information')),
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_carrier_info_carrier_id on public.carrier_info(carrier_id);
create index if not exists idx_carrier_info_group_type on public.carrier_info(group_type);
drop trigger if exists trg_carrier_info_updated_at on public.carrier_info;
create trigger trg_carrier_info_updated_at
before update on public.carrier_info
for each row execute function public.set_updated_at();
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.carrier_info to authenticated;
grant usage, select on sequence public.carrier_info_id_seq to authenticated;
alter table public.carrier_info enable row level security;
drop policy if exists carrier_info_select_system_admin on public.carrier_info;
create policy carrier_info_select_system_admin
on public.carrier_info
for select
to authenticated
using (public.has_role('system_admin'));
drop policy if exists carrier_info_insert_system_admin on public.carrier_info;
create policy carrier_info_insert_system_admin
on public.carrier_info
for insert
to authenticated
with check (public.has_role('system_admin'));
drop policy if exists carrier_info_update_system_admin on public.carrier_info;
create policy carrier_info_update_system_admin
on public.carrier_info
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));
drop policy if exists carrier_info_delete_system_admin on public.carrier_info;
create policy carrier_info_delete_system_admin
on public.carrier_info
for delete
to authenticated
using (public.has_role('system_admin'));
-- END carriers_and_bpo_management.sql

-- BEGIN agent_hierarchy.sql
-- Agent Hierarchy: IMO > Agency > Agent
-- This establishes the organizational structure for the CRM
-- 
-- PREREQUISITE: This script assumes the following tables already exist:
--   - public.carriers (with id, name columns)
--   - public.users (for RLS has_role function)
-- 
-- The carriers table is referenced by agent_carriers junction table but NOT created here.

-- ============================================
-- CORE TABLES: The Hierarchy
-- ============================================

-- 1. IMOs Table (Top Level)
create table if not exists public.imos (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_imos_updated_at on public.imos;
create trigger trg_imos_updated_at
before update on public.imos
for each row execute function public.set_updated_at();
-- 2. Agencies Table (Middle Level - NEW)
create table if not exists public.agencies (
  id bigserial primary key,
  name text not null,
  imo_id bigint not null references public.imos(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agencies_name_imo_unique unique (name, imo_id)
);
create index if not exists idx_agencies_imo_id on public.agencies(imo_id);
drop trigger if exists trg_agencies_updated_at on public.agencies;
create trigger trg_agencies_updated_at
before update on public.agencies
for each row execute function public.set_updated_at();
-- 3. Agents Table (Bottom Level - UPDATED)
-- Note: This assumes agents table exists. If it doesn't, create it fresh.
-- If it exists with different structure, you'll need to migrate data first.
create table if not exists public.agents (
  id bigserial primary key,
  first_name text not null,
  last_name text not null,
  agency_id bigint references public.agencies(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  slack_username text,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Add new columns if agents table already exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'agency_id' AND table_schema = 'public') THEN
      ALTER TABLE public.agents ADD COLUMN agency_id bigint references public.agencies(id) on delete set null;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'user_id' AND table_schema = 'public') THEN
      ALTER TABLE public.agents ADD COLUMN user_id uuid references public.users(id) on delete set null;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'slack_username' AND table_schema = 'public') THEN
      ALTER TABLE public.agents ADD COLUMN slack_username text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'status' AND table_schema = 'public') THEN
      ALTER TABLE public.agents ADD COLUMN status text not null default 'Active' check (status in ('Active', 'Inactive'));
    END IF;
  END IF;
END $$;
create index if not exists idx_agents_agency_id on public.agents(agency_id);
create index if not exists idx_agents_status on public.agents(status);
drop trigger if exists trg_agents_updated_at on public.agents;
create trigger trg_agents_updated_at
before update on public.agents
for each row execute function public.set_updated_at();
-- 4. States Table (Reference Table)
create table if not exists public.states (
  code text primary key,
  name text not null unique
);
-- ============================================
-- JUNCTION TABLES: Agent Relationships
-- ============================================

-- Agent to Carriers (Many-to-Many)
create table if not exists public.agent_carriers (
  agent_id bigint not null references public.agents(id) on delete cascade,
  carrier_id bigint not null references public.carriers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agent_id, carrier_id)
);
create index if not exists idx_agent_carriers_agent_id on public.agent_carriers(agent_id);
create index if not exists idx_agent_carriers_carrier_id on public.agent_carriers(carrier_id);
-- Agent to States (Many-to-Many)
create table if not exists public.agent_states (
  agent_id bigint not null references public.agents(id) on delete cascade,
  state_code text not null references public.states(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agent_id, state_code)
);
create index if not exists idx_agent_states_agent_id on public.agent_states(agent_id);
create index if not exists idx_agent_states_state_code on public.agent_states(state_code);
-- ============================================
-- RLS POLICIES: System Admin Access
-- ============================================

-- IMOs Table Policies
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.imos to authenticated;
grant usage, select on sequence public.imos_id_seq to authenticated;
alter table public.imos enable row level security;
drop policy if exists imos_select_system_admin on public.imos;
create policy imos_select_system_admin
on public.imos
for select
to authenticated
using (public.has_role('system_admin'));
drop policy if exists imos_insert_system_admin on public.imos;
create policy imos_insert_system_admin
on public.imos
for insert
to authenticated
with check (public.has_role('system_admin'));
drop policy if exists imos_update_system_admin on public.imos;
create policy imos_update_system_admin
on public.imos
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));
drop policy if exists imos_delete_system_admin on public.imos;
create policy imos_delete_system_admin
on public.imos
for delete
to authenticated
using (public.has_role('system_admin'));
-- Agencies Table Policies
grant select, insert, update, delete on public.agencies to authenticated;
grant usage, select on sequence public.agencies_id_seq to authenticated;
alter table public.agencies enable row level security;
drop policy if exists agencies_select_system_admin on public.agencies;
create policy agencies_select_system_admin
on public.agencies
for select
to authenticated
using (public.has_role('system_admin'));
drop policy if exists agencies_insert_system_admin on public.agencies;
create policy agencies_insert_system_admin
on public.agencies
for insert
to authenticated
with check (public.has_role('system_admin'));
drop policy if exists agencies_update_system_admin on public.agencies;
create policy agencies_update_system_admin
on public.agencies
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));
drop policy if exists agencies_delete_system_admin on public.agencies;
create policy agencies_delete_system_admin
on public.agencies
for delete
to authenticated
using (public.has_role('system_admin'));
-- Agents Table Policies
grant select, insert, update, delete on public.agents to authenticated;
grant usage, select on sequence public.agents_id_seq to authenticated;
alter table public.agents enable row level security;
drop policy if exists agents_select_system_admin on public.agents;
create policy agents_select_system_admin
on public.agents
for select
to authenticated
using (public.has_role('system_admin'));
drop policy if exists agents_insert_system_admin on public.agents;
create policy agents_insert_system_admin
on public.agents
for insert
to authenticated
with check (public.has_role('system_admin'));
drop policy if exists agents_update_system_admin on public.agents;
create policy agents_update_system_admin
on public.agents
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));
drop policy if exists agents_delete_system_admin on public.agents;
create policy agents_delete_system_admin
on public.agents
for delete
to authenticated
using (public.has_role('system_admin'));
-- States Table Policies (Read-only for most, full access for system admin)
grant select on public.states to authenticated;
grant insert, update, delete on public.states to authenticated;
alter table public.states enable row level security;
drop policy if exists states_select_all on public.states;
create policy states_select_all
on public.states
for select
to authenticated
using (true);
drop policy if exists states_modify_system_admin on public.states;
create policy states_modify_system_admin
on public.states
for all
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));
-- Agent Carriers Junction Table Policies
grant select, insert, update, delete on public.agent_carriers to authenticated;
alter table public.agent_carriers enable row level security;
drop policy if exists agent_carriers_select_system_admin on public.agent_carriers;
create policy agent_carriers_select_system_admin
on public.agent_carriers
for select
to authenticated
using (public.has_role('system_admin'));
drop policy if exists agent_carriers_insert_system_admin on public.agent_carriers;
create policy agent_carriers_insert_system_admin
on public.agent_carriers
for insert
to authenticated
with check (public.has_role('system_admin'));
drop policy if exists agent_carriers_update_system_admin on public.agent_carriers;
create policy agent_carriers_update_system_admin
on public.agent_carriers
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));
drop policy if exists agent_carriers_delete_system_admin on public.agent_carriers;
create policy agent_carriers_delete_system_admin
on public.agent_carriers
for delete
to authenticated
using (public.has_role('system_admin'));
-- Agent States Junction Table Policies
grant select, insert, update, delete on public.agent_states to authenticated;
alter table public.agent_states enable row level security;
drop policy if exists agent_states_select_system_admin on public.agent_states;
create policy agent_states_select_system_admin
on public.agent_states
for select
to authenticated
using (public.has_role('system_admin'));
drop policy if exists agent_states_insert_system_admin on public.agent_states;
create policy agent_states_insert_system_admin
on public.agent_states
for insert
to authenticated
with check (public.has_role('system_admin'));
drop policy if exists agent_states_update_system_admin on public.agent_states;
create policy agent_states_update_system_admin
on public.agent_states
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));
drop policy if exists agent_states_delete_system_admin on public.agent_states;
create policy agent_states_delete_system_admin
on public.agent_states
for delete
to authenticated
using (public.has_role('system_admin'));
-- ============================================
-- SAMPLE DATA (Optional - Uncomment to insert)
-- ============================================

-- -- Insert sample IMOs
-- insert into public.imos (name) values 
--   ('IMO A'),
--   ('IMO B')
-- on conflict (name) do nothing;

-- -- Insert sample Agencies (requires IMO IDs)
-- -- Note: Replace IMO IDs with actual values after insertion
-- -- insert into public.agencies (name, imo_id) values 
-- --   ('Wunder Agency', 1),
-- --   ('Coleman Financial', 1),
-- --   ('Elite Insurance Group', 2)
-- -- on conflict (name, imo_id) do nothing;

-- -- Insert all US states
-- insert into public.states (code, name) values 
--   ('AL', 'Alabama'), ('AK', 'Alaska'), ('AZ', 'Arizona'), ('AR', 'Arkansas'),
--   ('CA', 'California'), ('CO', 'Colorado'), ('CT', 'Connecticut'), ('DE', 'Delaware'),
--   ('FL', 'Florida'), ('GA', 'Georgia'), ('HI', 'Hawaii'), ('ID', 'Idaho'),
--   ('IL', 'Illinois'), ('IN', 'Indiana'), ('IA', 'Iowa'), ('KS', 'Kansas'),
--   ('KY', 'Kentucky'), ('LA', 'Louisiana'), ('ME', 'Maine'), ('MD', 'Maryland'),
--   ('MA', 'Massachusetts'), ('MI', 'Michigan'), ('MN', 'Minnesota'), ('MS', 'Mississippi'),
--   ('MO', 'Missouri'), ('MT', 'Montana'), ('NE', 'Nebraska'), ('NV', 'Nevada'),
--   ('NH', 'New Hampshire'), ('NJ', 'New Jersey'), ('NM', 'New Mexico'), ('NY', 'New York'),
--   ('NC', 'North Carolina'), ('ND', 'North Dakota'), ('OH', 'Ohio'), ('OK', 'Oklahoma'),
--   ('OR', 'Oregon'), ('PA', 'Pennsylvania'), ('RI', 'Rhode Island'), ('SC', 'South Carolina'),
--   ('SD', 'South Dakota'), ('TN', 'Tennessee'), ('TX', 'Texas'), ('UT', 'Utah'),
--   ('VT', 'Vermont'), ('VA', 'Virginia'), ('WA', 'Washington'), ('WV', 'West Virginia'),
--   ('WI', 'Wisconsin'), ('WY', 'Wyoming'), ('DC', 'District of Columbia')
-- on conflict (code) do nothing;
-- END agent_hierarchy.sql

-- BEGIN leads_pipeline_fk_alignment.sql
-- Align leads pipeline/stage references with FK-backed tables.
-- Safe to run multiple times.

-- 1) Add pipeline_id on leads.
alter table public.leads
  add column if not exists pipeline_id bigint null;
-- 4) Add FK + index for pipeline_id.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_pipeline_id_fkey'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_pipeline_id_fkey
      foreign key (pipeline_id) references public.pipelines(id) on delete set null;
  end if;
end $$;
create index if not exists leads_pipeline_id_idx
  on public.leads using btree (pipeline_id) tablespace pg_default;
-- 5) Keep legacy text columns + FK ids in sync during writes.
create or replace function public.leads_sync_pipeline_stage_refs()
returns trigger
language plpgsql
as $$
declare
  v_pipeline_id bigint;
  v_pipeline_name text;
  v_stage_name text;
begin
  -- If stage_id is provided, it dictates both pipeline_id and stage text.
  if new.stage_id is not null then
    select ps.pipeline_id, ps.name
    into v_pipeline_id, v_stage_name
    from public.pipeline_stages ps
    where ps.id = new.stage_id;

    if found then
      new.pipeline_id := v_pipeline_id;
      new.stage := v_stage_name;
    end if;
  end if;

  -- If pipeline_id is still missing but text pipeline exists, resolve id.
  if new.pipeline_id is null and new.pipeline is not null then
    select p.id into v_pipeline_id
    from public.pipelines p
    where p.name = trim(new.pipeline)
    limit 1;
    if found then
      new.pipeline_id := v_pipeline_id;
    end if;
  end if;

  -- Keep pipeline text canonical from pipeline_id.
  if new.pipeline_id is not null then
    select p.name into v_pipeline_name
    from public.pipelines p
    where p.id = new.pipeline_id;
    if found then
      new.pipeline := v_pipeline_name;
    end if;
  end if;

  -- If stage text + pipeline_id are present but stage_id missing, resolve stage_id.
  if new.stage_id is null and new.stage is not null and new.pipeline_id is not null then
    select ps.id, ps.name
    into new.stage_id, v_stage_name
    from public.pipeline_stages ps
    where ps.pipeline_id = new.pipeline_id
      and ps.name = trim(new.stage)
    limit 1;

    if found then
      new.stage := v_stage_name;
    end if;
  end if;

  return new;
end;
$$;
drop trigger if exists trg_leads_sync_pipeline_stage_refs on public.leads;
create trigger trg_leads_sync_pipeline_stage_refs
before insert or update on public.leads
for each row execute function public.leads_sync_pipeline_stage_refs();
-- END leads_pipeline_fk_alignment.sql

-- BEGIN leads_drop_pipeline_text_column.sql
-- Remove legacy text pipeline column from leads after pipeline_id migration.
-- Safe to run multiple times.

-- Keep stage_id/pipeline_id in sync without referencing removed text column.
create or replace function public.leads_sync_pipeline_stage_refs()
returns trigger
language plpgsql
as $$
declare
  v_pipeline_id bigint;
  v_stage_name text;
begin
  -- If stage_id is provided, derive pipeline_id + canonical stage name.
  if new.stage_id is not null then
    select ps.pipeline_id, ps.name
    into v_pipeline_id, v_stage_name
    from public.pipeline_stages ps
    where ps.id = new.stage_id;

    if found then
      new.pipeline_id := v_pipeline_id;
      new.stage := v_stage_name;
    end if;
  end if;

  -- If stage text + pipeline_id are present but stage_id missing, resolve stage_id.
  if new.stage_id is null and new.stage is not null and new.pipeline_id is not null then
    select ps.id, ps.name
    into new.stage_id, v_stage_name
    from public.pipeline_stages ps
    where ps.pipeline_id = new.pipeline_id
      and ps.name = trim(new.stage)
    limit 1;

    if found then
      new.stage := v_stage_name;
    end if;
  end if;

  return new;
end;
$$;
-- Remove legacy text column.
alter table public.leads
  drop column if exists pipeline;
-- END leads_drop_pipeline_text_column.sql

-- BEGIN lead_notes.sql
-- Per-lead notes (Quick Edit Notes tab). Visibility follows the same rules as public.leads SELECT.

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.users (id) on delete set null
);
create index if not exists lead_notes_lead_id_created_at_idx on public.lead_notes (lead_id, created_at desc);
grant select, insert, update, delete on public.lead_notes to authenticated;
alter table public.lead_notes enable row level security;
-- Same visibility as leads: submitter or privileged roles (see leads_select_own_or_admin_or_call_center).
drop policy if exists lead_notes_select on public.lead_notes;
create policy lead_notes_select
on public.lead_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_notes.lead_id
      and (
        l.submitted_by = auth.uid()
        or exists (
          select 1
          from public.users u
          join public.roles r on r.id = u.role_id
          where u.id = auth.uid()
            and r.key = any (array['system_admin', 'hr', 'call_center_admin', 'call_center_agent']::text[])
        )
      )
  )
);
drop policy if exists lead_notes_insert on public.lead_notes;
create policy lead_notes_insert
on public.lead_notes
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.leads l
    where l.id = lead_notes.lead_id
      and (
        l.submitted_by = auth.uid()
        or exists (
          select 1
          from public.users u
          join public.roles r on r.id = u.role_id
          where u.id = auth.uid()
            and r.key = any (array['system_admin', 'hr', 'call_center_admin', 'call_center_agent']::text[])
        )
      )
  )
);
drop policy if exists lead_notes_update on public.lead_notes;
create policy lead_notes_update
on public.lead_notes
for update
to authenticated
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_notes.lead_id
      and (
        l.submitted_by = auth.uid()
        or exists (
          select 1
          from public.users u
          join public.roles r on r.id = u.role_id
          where u.id = auth.uid()
            and r.key = any (array['system_admin', 'hr', 'call_center_admin', 'call_center_agent']::text[])
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.leads l
    where l.id = lead_notes.lead_id
      and (
        l.submitted_by = auth.uid()
        or exists (
          select 1
          from public.users u
          join public.roles r on r.id = u.role_id
          where u.id = auth.uid()
            and r.key = any (array['system_admin', 'hr', 'call_center_admin', 'call_center_agent']::text[])
        )
      )
  )
);
drop policy if exists lead_notes_delete on public.lead_notes;
create policy lead_notes_delete
on public.lead_notes
for delete
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (array['system_admin', 'hr', 'call_center_admin']::text[])
  )
);
-- END lead_notes.sql

-- BEGIN verification_sessions_and_items.sql
-- Verification sessions + items (buffer/LA verification workflow)
-- Adds public.leads.submission_id (stable business key for FK).

-- 1) submission_id on leads: backfill then enforce uniqueness (required for FK target)
alter table public.leads
  add column if not exists submission_id text;
-- New lead rows: mirror id as submission_id when not provided (FK target for verification_sessions)
create or replace function public.leads_set_submission_id_from_id()
returns trigger
language plpgsql
as $$
begin
  if new.submission_id is null then
    new.submission_id := new.id::text;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_leads_set_submission_id_from_id on public.leads;
create trigger trg_leads_set_submission_id_from_id
before insert on public.leads
for each row execute function public.leads_set_submission_id_from_id();
alter table public.leads
  alter column submission_id set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_submission_id_key'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_submission_id_key unique (submission_id);
  end if;
end $$;
-- 2) Parent: sessions
create table if not exists public.verification_sessions (
  id uuid not null default gen_random_uuid (),
  submission_id text not null,
  buffer_agent_id uuid null,
  licensed_agent_id uuid null,
  status text not null default 'pending'::text,
  started_at timestamp with time zone null default now(),
  completed_at timestamp with time zone null,
  transferred_at timestamp with time zone null,
  progress_percentage integer null default 0,
  total_fields integer null default 0,
  verified_fields integer null default 0,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  claimed_at timestamp with time zone null,
  is_retention_call boolean null default false,
  retention_agent_id uuid null,
  retention_notes jsonb null,
  constraint verification_sessions_pkey primary key (id),
  constraint verification_sessions_licensed_agent_id_fkey foreign key (licensed_agent_id) references auth.users (id),
  constraint verification_sessions_submission_id_fkey foreign key (submission_id) references public.leads (submission_id) on delete cascade,
  constraint verification_sessions_buffer_agent_id_fkey foreign key (buffer_agent_id) references auth.users (id),
  constraint verification_sessions_retention_agent_id_fkey foreign key (retention_agent_id) references auth.users (id),
  constraint verification_sessions_progress_percentage_check check (
    (progress_percentage >= 0) and (progress_percentage <= 100)
  ),
  constraint verification_sessions_status_check check (
    status = any (
      array[
        'pending'::text,
        'in_progress'::text,
        'ready_for_transfer'::text,
        'transferred'::text,
        'completed'::text,
        'call_dropped'::text,
        'buffer_done'::text,
        'la_done'::text
      ]
    )
  )
) tablespace pg_default;
create index if not exists idx_verification_sessions_submission_id on public.verification_sessions using btree (submission_id) tablespace pg_default;
create index if not exists idx_verification_sessions_buffer_agent on public.verification_sessions using btree (buffer_agent_id) tablespace pg_default;
create index if not exists idx_verification_sessions_licensed_agent on public.verification_sessions using btree (licensed_agent_id) tablespace pg_default;
create index if not exists idx_verification_sessions_status on public.verification_sessions using btree (status) tablespace pg_default;
create index if not exists idx_verification_sessions_claimed_at on public.verification_sessions using btree (claimed_at) tablespace pg_default;
-- Enforce one verification session per lead (submission_id).
-- If duplicates already exist, keep the most recently updated session and merge items.
with ranked as (
  select
    id,
    submission_id,
    row_number() over (
      partition by submission_id
      order by coalesce(updated_at, created_at) desc, created_at desc, id desc
    ) as rn
  from public.verification_sessions
),
winner_loser as (
  select
    w.id as winner_id,
    l.id as loser_id
  from ranked w
  join ranked l
    on w.submission_id = l.submission_id
  where w.rn = 1 and l.rn > 1
),
move_items as (
  insert into public.verification_items (
    session_id, field_name, field_category, original_value, verified_value,
    is_verified, is_modified, verified_at, verified_by, notes, created_at, updated_at
  )
  select
    wl.winner_id,
    vi.field_name,
    vi.field_category,
    vi.original_value,
    vi.verified_value,
    vi.is_verified,
    vi.is_modified,
    vi.verified_at,
    vi.verified_by,
    vi.notes,
    vi.created_at,
    vi.updated_at
  from winner_loser wl
  join public.verification_items vi
    on vi.session_id = wl.loser_id
  on conflict (session_id, field_name) do update
  set
    field_category = excluded.field_category,
    original_value = excluded.original_value,
    verified_value = excluded.verified_value,
    is_verified = excluded.is_verified,
    is_modified = excluded.is_modified,
    verified_at = excluded.verified_at,
    verified_by = excluded.verified_by,
    notes = excluded.notes,
    updated_at = excluded.updated_at
  returning 1
)
delete from public.verification_sessions s
using ranked r
where s.id = r.id and r.rn > 1;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'verification_sessions_submission_id_key'
      and conrelid = 'public.verification_sessions'::regclass
  ) then
    alter table public.verification_sessions
      add constraint verification_sessions_submission_id_key unique (submission_id);
  end if;
end $$;
drop trigger if exists update_verification_sessions_updated_at on public.verification_sessions;
create trigger update_verification_sessions_updated_at
before update on public.verification_sessions
for each row execute function public.set_updated_at ();
-- 3) Child: items
create table if not exists public.verification_items (
  id uuid not null default gen_random_uuid (),
  session_id uuid not null,
  field_name text not null,
  field_category text null,
  original_value text null,
  verified_value text null,
  is_verified boolean null default false,
  is_modified boolean null default false,
  verified_at timestamp with time zone null,
  verified_by uuid null,
  notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint verification_items_pkey primary key (id),
  constraint verification_items_session_id_field_name_key unique (session_id, field_name),
  constraint verification_items_session_id_fkey foreign key (session_id) references public.verification_sessions (id) on delete cascade,
  constraint verification_items_verified_by_fkey foreign key (verified_by) references auth.users (id)
) tablespace pg_default;
create index if not exists idx_verification_items_session_id on public.verification_items using btree (session_id) tablespace pg_default;
create index if not exists idx_verification_items_field_name on public.verification_items using btree (field_name) tablespace pg_default;
create index if not exists idx_verification_items_is_verified on public.verification_items using btree (is_verified) tablespace pg_default;
drop trigger if exists update_verification_items_updated_at on public.verification_items;
create trigger update_verification_items_updated_at
before update on public.verification_items
for each row execute function public.set_updated_at ();
-- 4) Progress sync (after both tables exist)
create or replace function public.update_verification_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  if tg_op = 'DELETE' then
    sid := old.session_id;
  else
    sid := new.session_id;
  end if;

  update public.verification_sessions vs
  set
    verified_fields = (
      select count(*)::int
      from public.verification_items vi
      where vi.session_id = sid and coalesce(vi.is_verified, false) = true
    ),
    total_fields = (
      select count(*)::int
      from public.verification_items vi
      where vi.session_id = sid
    ),
    progress_percentage = case
      when (
        select count(*) from public.verification_items vi where vi.session_id = sid
      ) = 0 then 0
      else least(
        100,
        greatest(
          0,
          round(
            100.0 * (
              select count(*)::numeric
              from public.verification_items vi
              where vi.session_id = sid and coalesce(vi.is_verified, false) = true
            )
            / nullif(
              (select count(*)::numeric from public.verification_items vi where vi.session_id = sid),
              0
            )
          )::int
        )
      )
    end,
    updated_at = now()
  where vs.id = sid;

  return coalesce(new, old);
end;
$$;
drop trigger if exists update_verification_progress_trigger on public.verification_items;
create trigger update_verification_progress_trigger
after insert or delete or update of is_verified on public.verification_items
for each row execute function public.update_verification_progress ();
-- 5) RLS + grants
alter table public.verification_sessions enable row level security;
alter table public.verification_items enable row level security;
drop policy if exists verification_sessions_select_authenticated on public.verification_sessions;
create policy verification_sessions_select_authenticated
on public.verification_sessions for select to authenticated using (true);
drop policy if exists verification_sessions_write_authenticated on public.verification_sessions;
create policy verification_sessions_write_authenticated
on public.verification_sessions for all to authenticated using (true) with check (true);
drop policy if exists verification_items_select_authenticated on public.verification_items;
create policy verification_items_select_authenticated
on public.verification_items for select to authenticated using (true);
drop policy if exists verification_items_write_authenticated on public.verification_items;
create policy verification_items_write_authenticated
on public.verification_items for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.verification_sessions to authenticated;
grant select, insert, update, delete on public.verification_items to authenticated;
-- 6) Initializer RPC for claim/start flows (idempotent for repeated claims)
create or replace function public.initialize_verification_items(session_id_param uuid, submission_id_param text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_record public.leads%rowtype;
begin
  select *
  into lead_record
  from public.leads
  where submission_id = submission_id_param
  limit 1;

  if not found then
    raise exception 'Lead not found with submission_id: %', submission_id_param;
  end if;

  insert into public.verification_items (session_id, field_name, field_category, original_value)
  values
    -- Personal
    (session_id_param, 'customer_full_name', 'personal', trim(concat(coalesce(lead_record.first_name, ''), ' ', coalesce(lead_record.last_name, '')))),
    (session_id_param, 'date_of_birth', 'personal', lead_record.date_of_birth),
    (session_id_param, 'birth_state', 'personal', lead_record.birth_state),
    (session_id_param, 'age', 'personal', lead_record.age),
    (session_id_param, 'social_security', 'personal', lead_record.social),
    (session_id_param, 'driver_license', 'personal', lead_record.driver_license_number),
    -- Contact
    (session_id_param, 'street_address', 'contact', trim(concat(coalesce(lead_record.street1, ''), ' ', coalesce(lead_record.street2, '')))),
    (session_id_param, 'city', 'contact', lead_record.city),
    (session_id_param, 'state', 'contact', lead_record.state),
    (session_id_param, 'zip_code', 'contact', lead_record.zip_code),
    (session_id_param, 'phone_number', 'contact', lead_record.phone),
    -- Health
    (session_id_param, 'height', 'health', lead_record.height),
    (session_id_param, 'weight', 'health', lead_record.weight),
    (session_id_param, 'doctors_name', 'health', lead_record.doctor_name),
    (session_id_param, 'tobacco_use', 'health', lead_record.tobacco_use),
    (session_id_param, 'health_conditions', 'health', lead_record.health_conditions),
    (session_id_param, 'medications', 'health', lead_record.medications),
    (session_id_param, 'existing_coverage', 'health', lead_record.existing_coverage_last_2_years),
    (session_id_param, 'previous_applications', 'health', lead_record.previous_applications_2_years),
    -- Insurance
    (session_id_param, 'carrier', 'insurance', lead_record.carrier),
    (session_id_param, 'product_type', 'insurance', lead_record.product_type),
    (session_id_param, 'coverage_amount', 'insurance', lead_record.coverage_amount),
    (session_id_param, 'monthly_premium', 'insurance', lead_record.monthly_premium),
    (session_id_param, 'draft_date', 'insurance', lead_record.draft_date),
    (session_id_param, 'future_draft_date', 'insurance', lead_record.future_draft_date),
    -- Banking
    (session_id_param, 'beneficiary_information', 'banking', lead_record.beneficiary_information),
    (session_id_param, 'institution_name', 'banking', lead_record.institution_name),
    (session_id_param, 'beneficiary_routing', 'banking', lead_record.routing_number),
    (session_id_param, 'beneficiary_account', 'banking', lead_record.account_number),
    (session_id_param, 'account_type', 'banking', lead_record.bank_account_type),
    -- Additional
    (session_id_param, 'additional_notes', 'additional', lead_record.additional_information),
    (session_id_param, 'lead_vendor', 'additional', lead_record.lead_source)
  on conflict (session_id, field_name) do update
  set
    field_category = excluded.field_category,
    original_value = excluded.original_value;

  update public.verification_sessions
  set total_fields = (
    select count(*)::int
    from public.verification_items
    where session_id = session_id_param
  )
  where id = session_id_param;
end;
$$;
grant execute on function public.initialize_verification_items(uuid, text) to authenticated;
-- 7) Call-fix + retention parity tables (safe no-op if already present)
create table if not exists public.call_results (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  customer_name text,
  call_status text not null,
  call_reason text,
  notes text,
  new_draft_date date,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint call_results_submission_unique unique (submission_id)
);
drop trigger if exists trg_call_results_updated_at on public.call_results;
create trigger trg_call_results_updated_at
before update on public.call_results
for each row execute function public.set_updated_at();
create table if not exists public.call_update_logs (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null,
  lead_id uuid references public.leads(id) on delete cascade,
  event_type text not null,
  event_details jsonb,
  agent_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.app_fix_tasks (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null,
  lead_id uuid references public.leads(id) on delete cascade,
  task_type text not null check (task_type = any(array['new_sale','fixed_payment','carrier_requirements'])),
  status text not null default 'open',
  assigned_to uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_app_fix_tasks_updated_at on public.app_fix_tasks;
create trigger trg_app_fix_tasks_updated_at
before update on public.app_fix_tasks
for each row execute function public.set_updated_at();
create table if not exists public.app_fix_banking_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.app_fix_tasks(id) on delete cascade,
  submission_id text not null,
  lead_id uuid references public.leads(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.app_fix_carrier_requirements (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.app_fix_tasks(id) on delete cascade,
  submission_id text not null,
  lead_id uuid references public.leads(id) on delete cascade,
  carrier text,
  product_type text,
  coverage_amount text,
  monthly_premium text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.call_results enable row level security;
alter table public.call_update_logs enable row level security;
alter table public.app_fix_tasks enable row level security;
alter table public.app_fix_banking_updates enable row level security;
alter table public.app_fix_carrier_requirements enable row level security;
drop policy if exists call_results_rw_authenticated on public.call_results;
create policy call_results_rw_authenticated
on public.call_results
for all
to authenticated
using (true)
with check (true);
drop policy if exists call_update_logs_rw_authenticated on public.call_update_logs;
create policy call_update_logs_rw_authenticated
on public.call_update_logs
for all
to authenticated
using (true)
with check (true);
drop policy if exists app_fix_tasks_rw_authenticated on public.app_fix_tasks;
create policy app_fix_tasks_rw_authenticated
on public.app_fix_tasks
for all
to authenticated
using (true)
with check (true);
drop policy if exists app_fix_banking_updates_rw_authenticated on public.app_fix_banking_updates;
create policy app_fix_banking_updates_rw_authenticated
on public.app_fix_banking_updates
for all
to authenticated
using (true)
with check (true);
drop policy if exists app_fix_carrier_requirements_rw_authenticated on public.app_fix_carrier_requirements;
create policy app_fix_carrier_requirements_rw_authenticated
on public.app_fix_carrier_requirements
for all
to authenticated
using (true)
with check (true);
grant select, insert, update, delete on public.call_results to authenticated;
grant select, insert, update, delete on public.call_update_logs to authenticated;
grant select, insert, update, delete on public.app_fix_tasks to authenticated;
grant select, insert, update, delete on public.app_fix_banking_updates to authenticated;
grant select, insert, update, delete on public.app_fix_carrier_requirements to authenticated;
-- END verification_sessions_and_items.sql

-- BEGIN daily_deal_flow.sql
-- Daily Deal Flow schema aligned to latest BPO game workflow.

drop trigger if exists auto_fetch_recording_trigger on public.daily_deal_flow;
drop trigger if exists sync_to_firestore_webhook on public.daily_deal_flow;
drop table if exists public.daily_deal_flow cascade;
create table public.daily_deal_flow (
  id uuid not null default gen_random_uuid (),
  submission_id text not null,
  client_phone_number text null,
  lead_vendor text null,
  date date null default current_date,
  insured_name text null,
  buffer_agent text null,
  agent text null,
  licensed_agent_account text null,
  status text null,
  call_result text null,
  carrier text null,
  product_type text null,
  draft_date date null,
  monthly_premium numeric(10, 2) null,
  face_amount numeric(12, 2) null,
  from_callback boolean null default false,
  notes text null,
  policy_number text null,
  carrier_audit text null,
  product_type_carrier text null,
  level_or_gi text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  is_callback boolean null default false,
  is_retention_call boolean null default false,
  placement_status text null,
  ghl_location_id text null,
  ghl_opportunity_id text null,
  ghlcontactid text null,
  sync_status text null,
  retention_agent text null,
  retention_agent_id uuid null,
  is_reviewed boolean null default false,
  la_callback text null,
  initial_quote text null,
  constraint daily_deal_flow_pkey primary key (id),
  constraint daily_deal_flow_submission_id_date_key unique (submission_id, date),
  constraint daily_deal_flow_retention_agent_id_fkey foreign key (retention_agent_id) references auth.users (id),
  constraint daily_deal_flow_placement_status_check check (
    (
      placement_status = any (
        array[
          'Good Standing'::text,
          'Not Placed'::text,
          'Pending Failed Payment Fix'::text,
          'FDPF Pending Reason'::text,
          'FDPF Insufficient Funds'::text,
          'FDPF Incorrect Banking Info'::text,
          'FDPF Unauthorized Draft'::text
        ]
      )
    )
  )
) tablespace pg_default;
create index if not exists idx_daily_deal_flow_submission_id on public.daily_deal_flow using btree (submission_id) tablespace pg_default;
create index if not exists idx_daily_deal_flow_date on public.daily_deal_flow using btree (date) tablespace pg_default;
create index if not exists idx_daily_deal_flow_agent on public.daily_deal_flow using btree (agent) tablespace pg_default;
create index if not exists idx_daily_deal_flow_status on public.daily_deal_flow using btree (status) tablespace pg_default;
create index if not exists idx_daily_deal_flow_ghl_location_id on public.daily_deal_flow using btree (ghl_location_id) tablespace pg_default;
create index if not exists idx_daily_deal_flow_ghl_opportunity_id on public.daily_deal_flow using btree (ghl_opportunity_id) tablespace pg_default;
create trigger auto_fetch_recording_trigger
after insert on public.daily_deal_flow for each row
when (
  new.client_phone_number is not null
  and new.client_phone_number <> ''::text
)
execute function fetch_recording_for_new_entry ();
create trigger sync_to_firestore_webhook
after update on public.daily_deal_flow for each row
execute function supabase_functions.http_request (
  'https://gqhcjqxcvhgwsqfqgekh.supabase.co/functions/v1/bpo-game-sync',
  'POST',
  '{"Content-type":"application/json"}',
  '{}',
  '5000'
);
-- END daily_deal_flow.sql

-- BEGIN disposition_flows_schema.sql
-- Disposition wizard: config tables + note templates + audit events + call_results columns.
-- Meaningful keys (flow_key, node_key, option_key, template_key) separate from display labels.

-- ---------------------------------------------------------------------------
-- Note templates (referenced by template_key string from options / node metadata)
-- ---------------------------------------------------------------------------
create table if not exists public.disposition_note_templates (
  template_key text primary key,
  template_body text not null,
  append_manual_to_final boolean not null default false,
  description text,
  created_at timestamptz not null default now()
);
-- ---------------------------------------------------------------------------
-- One flow per pipeline stage name (Transfer Portal disposition / stage name)
-- ---------------------------------------------------------------------------
create table if not exists public.disposition_flows (
  id bigserial primary key,
  flow_key text not null unique,
  pipeline_stage_name text not null,
  flow_label text not null,
  root_node_key text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipeline_stage_name, flow_key)
);
create index if not exists idx_disposition_flows_stage on public.disposition_flows (pipeline_stage_name)
where is_active = true;
-- ---------------------------------------------------------------------------
-- Wizard nodes (choice | carrier_multi | text)
-- ---------------------------------------------------------------------------
create table if not exists public.disposition_flow_nodes (
  id bigserial primary key,
  flow_id bigint not null references public.disposition_flows (id) on delete cascade,
  node_key text not null,
  node_type text not null check (node_type = any (array['choice'::text, 'carrier_multi'::text, 'text'::text])),
  node_label text not null,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique (flow_id, node_key)
);
create index if not exists idx_disposition_flow_nodes_flow on public.disposition_flow_nodes (flow_id);
-- ---------------------------------------------------------------------------
-- Options for choice nodes (terminal when next_node_key is null)
-- ---------------------------------------------------------------------------
create table if not exists public.disposition_flow_options (
  id bigserial primary key,
  node_id bigint not null references public.disposition_flow_nodes (id) on delete cascade,
  option_key text not null,
  option_label text not null,
  sort_order integer not null default 0,
  next_node_key text,
  template_key text,
  quick_tag_label text,
  requires_manual_note boolean not null default false,
  unique (node_id, option_key)
);
-- ---------------------------------------------------------------------------
-- Audit trail per save (optional history)
-- ---------------------------------------------------------------------------
create table if not exists public.disposition_events (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null,
  lead_id uuid not null references public.leads (id) on delete cascade,
  flow_key text not null,
  path_json jsonb not null default '[]'::jsonb,
  generated_note text,
  manual_note text,
  final_note text,
  quick_tag_label text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists idx_disposition_events_lead on public.disposition_events (lead_id);
create index if not exists idx_disposition_events_submission on public.disposition_events (submission_id);
-- ---------------------------------------------------------------------------
-- call_results: structured disposition + notes split
-- ---------------------------------------------------------------------------
alter table public.call_results
  add column if not exists disposition_path jsonb,
  add column if not exists generated_note text,
  add column if not exists manual_note text,
  add column if not exists quick_disposition_tag text;
-- ---------------------------------------------------------------------------
-- Grants + RLS (aligned with call_results: authenticated CRM users)
-- ---------------------------------------------------------------------------
grant select on public.disposition_note_templates to authenticated;
grant select on public.disposition_flows to authenticated;
grant select on public.disposition_flow_nodes to authenticated;
grant select on public.disposition_flow_options to authenticated;
grant select, insert on public.disposition_events to authenticated;
alter table public.disposition_note_templates enable row level security;
alter table public.disposition_flows enable row level security;
alter table public.disposition_flow_nodes enable row level security;
alter table public.disposition_flow_options enable row level security;
alter table public.disposition_events enable row level security;
drop policy if exists disposition_note_templates_select on public.disposition_note_templates;
create policy disposition_note_templates_select
on public.disposition_note_templates for select to authenticated using (true);
drop policy if exists disposition_flows_select on public.disposition_flows;
create policy disposition_flows_select
on public.disposition_flows for select to authenticated using (true);
drop policy if exists disposition_flow_nodes_select on public.disposition_flow_nodes;
create policy disposition_flow_nodes_select
on public.disposition_flow_nodes for select to authenticated using (true);
drop policy if exists disposition_flow_options_select on public.disposition_flow_options;
create policy disposition_flow_options_select
on public.disposition_flow_options for select to authenticated using (true);
drop policy if exists disposition_events_insert on public.disposition_events;
create policy disposition_events_insert
on public.disposition_events for insert to authenticated with check (true);
drop policy if exists disposition_events_select on public.disposition_events;
create policy disposition_events_select
on public.disposition_events for select to authenticated using (true);
-- END disposition_flows_schema.sql

-- BEGIN tickets_module.sql
-- Support tickets (lead-scoped), comments, followers, routing rules, and RLS.
-- Prerequisite: public.has_role(text), public.users, public.roles, public.leads, public.call_centers.

-- ---------------------------------------------------------------------------
-- Status enum (idempotent)
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.ticket_status as enum ('open', 'in_progress', 'solved');
exception
  when duplicate_object then null;
end$$;
-- ---------------------------------------------------------------------------
-- Routing: ordered rules (lower priority = tried first). Match is case-insensitive trim.
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_routing_rules (
  id uuid primary key default gen_random_uuid(),
  priority integer not null default 100,
  rule_kind text not null check (rule_kind in ('country', 'region', 'language')),
  match_value text not null,
  assignee_user_id uuid not null references public.users (id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ticket_routing_rules_active_priority_idx
  on public.ticket_routing_rules (is_active, priority);
comment on table public.ticket_routing_rules is
  'Maps lead/center country, call_centers.region, or leads.language to default ticket assignee. Maintained by admins.';
-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete restrict,
  lead_name text,
  publisher_id uuid not null references public.users (id) on delete restrict,
  assignee_id uuid references public.users (id) on delete set null,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  status public.ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  call_center_id uuid references public.call_centers (id) on delete set null
);
create index if not exists tickets_lead_id_idx on public.tickets (lead_id);
create index if not exists tickets_publisher_id_idx on public.tickets (publisher_id);
create index if not exists tickets_assignee_id_idx on public.tickets (assignee_id);
create index if not exists tickets_status_idx on public.tickets (status);
create index if not exists tickets_call_center_id_idx on public.tickets (call_center_id);
drop trigger if exists trg_tickets_updated_at on public.tickets;
create trigger trg_tickets_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();
-- ---------------------------------------------------------------------------
-- Comments (body column matches lead_notes naming)
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete restrict,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists ticket_comments_ticket_id_created_at_idx
  on public.ticket_comments (ticket_id, created_at desc);
-- ---------------------------------------------------------------------------
-- Followers
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_followers (
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ticket_id, user_id)
);
create index if not exists ticket_followers_user_id_idx on public.ticket_followers (user_id);
-- ---------------------------------------------------------------------------
-- Security definer: visibility without RLS recursion between tickets <-> followers
-- ---------------------------------------------------------------------------
create or replace function public.ticket_user_has_access(p_ticket_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and (
        t.publisher_id = p_user_id
        or t.assignee_id = p_user_id
        or exists (
          select 1
          from public.ticket_followers tf
          where tf.ticket_id = t.id
            and tf.user_id = p_user_id
        )
        or (
          exists (
            select 1
            from public.users u_viewer
            join public.roles r on r.id = u_viewer.role_id
            where u_viewer.id = p_user_id
              and r.key = 'call_center_admin'
              and u_viewer.call_center_id is not null
          )
          and (
            -- Ticket with no linked lead: check via call_center_id or publisher's center
            (t.lead_id is null and exists (
              select 1
              from public.users u_pub
              join public.users u_viewer on u_viewer.id = p_user_id
              where u_pub.id = t.publisher_id
                and u_pub.call_center_id is not null
                and u_pub.call_center_id = u_viewer.call_center_id
            ))
            or
            -- Ticket with linked lead: check via lead's call_center_id
            (t.lead_id is not null and exists (
              select 1
              from public.leads l
              join public.users u_pub on u_pub.id = t.publisher_id
              join public.users u_viewer on u_viewer.id = p_user_id
              where l.id = t.lead_id
                and l.call_center_id is not null
                and l.call_center_id = u_viewer.call_center_id
                and u_pub.call_center_id is not null
                and u_pub.call_center_id = l.call_center_id
            ))
          )
        )
      )
  )
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_user_id
      and r.key = 'system_admin'
  )
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_user_id
      and r.key = 'publisher_manager'
  );
$$;
grant execute on function public.ticket_user_has_access(uuid, uuid) to authenticated;
-- ---------------------------------------------------------------------------
-- Auto-assign: routing rules (lead-linked only), then publisher_manager
-- ---------------------------------------------------------------------------
create or replace function public.tickets_apply_default_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_country text;
  v_region text;
  v_language text;
  v_rule_user uuid;
  v_manager uuid;
begin
  if new.assignee_id is not null then
    return new;
  end if;

  -- Routing rules only apply when a lead is linked
  if new.lead_id is not null then
    select lower(trim(cc.country)), lower(trim(cc.region)), lower(trim(l.language))
    into v_country, v_region, v_language
    from public.leads l
    left join public.call_centers cc on cc.id = l.call_center_id
    where l.id = new.lead_id;

    select r.assignee_user_id
    into v_rule_user
    from public.ticket_routing_rules r
    where r.is_active
      and (
        (r.rule_kind = 'country' and v_country is not null and v_country = lower(trim(r.match_value)))
        or (r.rule_kind = 'region' and v_region is not null and v_region = lower(trim(r.match_value)))
        or (r.rule_kind = 'language' and v_language is not null and v_language = lower(trim(r.match_value)))
      )
    order by r.priority asc, r.created_at asc
    limit 1;

    if v_rule_user is not null then
      new.assignee_id := v_rule_user;
      return new;
    end if;
  end if;

  -- Fallback: assign to a publisher_manager user
  -- Prefer one in the same call center if ticket has call_center_id
  select u.id
  into v_manager
  from public.users u
  join public.roles r on r.id = u.role_id
  where r.key = 'publisher_manager'
  order by
    case when new.call_center_id is not null and u.call_center_id = new.call_center_id then 0 else 1 end,
    u.created_at asc
  limit 1;

  if v_manager is not null then
    new.assignee_id := v_manager;
  end if;

  return new;
end;
$$;
drop trigger if exists trg_tickets_apply_routing on public.tickets;
create trigger trg_tickets_apply_routing
before insert on public.tickets
for each row execute function public.tickets_apply_default_assignee();
-- ---------------------------------------------------------------------------
-- Enforce solved + assignee change (column-level rules; RLS cannot see OLD/NEW split easily)
-- ---------------------------------------------------------------------------
create or replace function public.tickets_before_update_enforce()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = 'system_admin'
  )
  into is_admin;

  if new.assignee_id is distinct from old.assignee_id and not is_admin then
    raise exception 'Only a system admin may change the ticket assignee';
  end if;

  if new.status = 'solved'::public.ticket_status and old.status is distinct from 'solved'::public.ticket_status then
    if is_admin then
      return new;
    end if;
    if old.assignee_id = auth.uid() and new.assignee_id is not distinct from old.assignee_id then
      return new;
    end if;
    raise exception 'Only the assignee or a system admin may set status to solved';
  end if;

  return new;
end;
$$;
drop trigger if exists trg_tickets_before_update_enforce on public.tickets;
create trigger trg_tickets_before_update_enforce
before update on public.tickets
for each row execute function public.tickets_before_update_enforce();
-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.tickets to authenticated;
grant select, insert, update, delete on public.ticket_comments to authenticated;
grant select, insert, update, delete on public.ticket_followers to authenticated;
-- Routing table: no grants to authenticated (maintain via service role / SQL).

alter table public.tickets enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.ticket_followers enable row level security;
alter table public.ticket_routing_rules enable row level security;
-- ---------------------------------------------------------------------------
-- tickets policies
-- ---------------------------------------------------------------------------
drop policy if exists tickets_select_participants on public.tickets;
create policy tickets_select_participants
on public.tickets
for select
to authenticated
using (public.ticket_user_has_access(id, auth.uid()));
-- Publisher = call center admin only: same center as the lead (or system_admin).
-- When lead_id is null, verify via ticket's call_center_id instead.
drop policy if exists tickets_insert_publishers on public.tickets;
create policy tickets_insert_publishers
on public.tickets
for insert
to authenticated
with check (
  publisher_id = auth.uid()
  and (
    public.has_role('system_admin')
    or (
      public.has_role('call_center_admin')
      and exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and u.call_center_id is not null
          and (
            (lead_id is null and call_center_id is not null and call_center_id = u.call_center_id)
            or
            (lead_id is not null and exists (
              select 1
              from public.leads l
              where l.id = lead_id
                and l.call_center_id is not null
                and l.call_center_id = u.call_center_id
            ))
          )
      )
    )
  )
);
drop policy if exists tickets_update_assignee on public.tickets;
create policy tickets_update_assignee
on public.tickets
for update
to authenticated
using (assignee_id = auth.uid())
with check (true);
drop policy if exists tickets_update_admin on public.tickets;
create policy tickets_update_admin
on public.tickets
for update
to authenticated
using (public.has_role('system_admin'))
with check (true);
-- ---------------------------------------------------------------------------
-- ticket_comments policies
-- ---------------------------------------------------------------------------
drop policy if exists ticket_comments_select on public.ticket_comments;
create policy ticket_comments_select
on public.ticket_comments
for select
to authenticated
using (public.ticket_user_has_access(ticket_id, auth.uid()));
drop policy if exists ticket_comments_insert on public.ticket_comments;
create policy ticket_comments_insert
on public.ticket_comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.ticket_user_has_access(ticket_id, auth.uid())
);
drop policy if exists ticket_comments_delete_own_or_admin on public.ticket_comments;
create policy ticket_comments_delete_own_or_admin
on public.ticket_comments
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.has_role('system_admin')
);
-- ---------------------------------------------------------------------------
-- ticket_followers policies
-- ---------------------------------------------------------------------------
drop policy if exists ticket_followers_select on public.ticket_followers;
create policy ticket_followers_select
on public.ticket_followers
for select
to authenticated
using (public.ticket_user_has_access(ticket_id, auth.uid()));
drop policy if exists ticket_followers_insert_assignee on public.ticket_followers;
create policy ticket_followers_insert_assignee
on public.ticket_followers
for insert
to authenticated
with check (
  public.has_role('system_admin')
  or public.has_role('publisher_manager')
  or exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and t.assignee_id = auth.uid()
  )
);
drop policy if exists ticket_followers_delete_assignee on public.ticket_followers;
create policy ticket_followers_delete_assignee
on public.ticket_followers
for delete
to authenticated
using (
  public.has_role('system_admin')
  or public.has_role('publisher_manager')
  or exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and t.assignee_id = auth.uid()
  )
);
-- ---------------------------------------------------------------------------
-- ticket_routing_rules: service role / postgres only (no authenticated policies)
-- ---------------------------------------------------------------------------
-- END tickets_module.sql

-- BEGIN callback_requests.sql
create table if not exists public.callback_requests (
  id uuid not null default gen_random_uuid(),
  submission_id text not null,
  lead_vendor text not null,
  request_type text not null,
  notes text not null,
  customer_name text null,
  phone_number text null,
  status text null default 'pending'::text,
  requested_by uuid null,
  requested_at timestamp with time zone null default now(),
  completed_at timestamp with time zone null,
  completed_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint callback_requests_pkey primary key (id),
  constraint callback_requests_completed_by_fkey foreign key (completed_by) references auth.users (id),
  constraint callback_requests_requested_by_fkey foreign key (requested_by) references auth.users (id),
  constraint callback_requests_request_type_check check (
    request_type = any (
      array[
        'new_application'::text,
        'updating_billing'::text,
        'carrier_requirements'::text
      ]
    )
  ),
  constraint callback_requests_status_check check (
    status = any (
      array[
        'pending'::text,
        'in_progress'::text,
        'completed'::text,
        'cancelled'::text
      ]
    )
  )
);
create index if not exists idx_callback_requests_submission_id
  on public.callback_requests using btree (submission_id);
create index if not exists idx_callback_requests_lead_vendor
  on public.callback_requests using btree (lead_vendor);
create index if not exists idx_callback_requests_status
  on public.callback_requests using btree (status);
create index if not exists idx_callback_requests_requested_at
  on public.callback_requests using btree (requested_at desc);
grant select, insert, update on public.callback_requests to authenticated;
alter table public.callback_requests enable row level security;
drop policy if exists callback_requests_select on public.callback_requests;
create policy callback_requests_select
on public.callback_requests
for select
to authenticated
using (
  requested_by = auth.uid()
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (array['system_admin', 'call_center_admin']::text[])
  )
);
drop policy if exists callback_requests_insert on public.callback_requests;
create policy callback_requests_insert
on public.callback_requests
for insert
to authenticated
with check (
  requested_by = auth.uid()
  or requested_by is null
);
drop policy if exists callback_requests_update on public.callback_requests;
create policy callback_requests_update
on public.callback_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (array['system_admin', 'call_center_admin']::text[])
  )
)
with check (
  exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (array['system_admin', 'call_center_admin']::text[])
  )
);
-- END callback_requests.sql

-- BEGIN lead_queue_management.sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'queue_type_enum') then
    create type public.queue_type_enum as enum ('unclaimed_transfer', 'ba_active', 'la_active');
  end if;

  if not exists (select 1 from pg_type where typname = 'queue_status_enum') then
    create type public.queue_status_enum as enum ('active', 'completed', 'dropped', 'cancelled', 'expired');
  end if;

  if not exists (select 1 from pg_type where typname = 'queue_role_enum') then
    create type public.queue_role_enum as enum ('manager', 'ba', 'la');
  end if;

  if not exists (select 1 from pg_type where typname = 'queue_action_required_enum') then
    create type public.queue_action_required_enum as enum (
      'new_sale',
      'carrier_requirement',
      'payment_fix',
      'pending_file',
      'unknown'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'queue_event_type_enum') then
    create type public.queue_event_type_enum as enum (
      'queue_created',
      'manager_assigned',
      'eta_sent',
      'ready_clicked',
      'la_ready',
      'transfer_sent',
      'call_dropped',
      'reassigned',
      'status_changed',
      'comment_added'
    );
  end if;
end
$$;
create table if not exists public.lead_queue_items (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid null references public.leads(id) on delete set null,
  submission_id text null,
  verification_session_id uuid null references public.verification_sessions(id) on delete set null,
  ddf_id uuid null references public.daily_deal_flow(id) on delete set null,
  policy_id text null,
  client_name text null,
  phone_number text null,
  call_center_id uuid null references public.call_centers(id) on delete set null,
  call_center_name text null,
  state text null,
  carrier text null,
  queue_type public.queue_type_enum not null default 'unclaimed_transfer',
  status public.queue_status_enum not null default 'active',
  current_owner_user_id uuid null references public.users(id) on delete set null,
  current_owner_role public.queue_role_enum null,
  assigned_ba_id uuid null references public.users(id) on delete set null,
  assigned_la_id uuid null references public.users(id) on delete set null,
  manager_assigned_by uuid null references public.users(id) on delete set null,
  la_ready_at timestamptz null,
  la_ready_by uuid null references public.users(id) on delete set null,
  ba_ready_at timestamptz null,
  ba_ready_by uuid null references public.users(id) on delete set null,
  ba_transfer_sent_at timestamptz null,
  queued_at timestamptz not null default now(),
  claimed_at timestamptz null,
  eta_minutes integer null check (eta_minutes is null or eta_minutes >= 0),
  ba_verification_percent numeric(5,2) null check (
    ba_verification_percent is null
    or (ba_verification_percent >= 0 and ba_verification_percent <= 100)
  ),
  action_required public.queue_action_required_enum not null default 'unknown',
  imo_id text null,
  agency_id text null,
  attempted_application boolean not null default false,
  last_attempt_agent_id uuid null references public.users(id) on delete set null,
  last_attempt_imo_id text null,
  last_disposition text null,
  take_next boolean not null default false,
  priority_score integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_lead_queue_active_submission
  on public.lead_queue_items(submission_id)
  where status = 'active' and submission_id is not null;
create index if not exists idx_lqi_queue_type_status
  on public.lead_queue_items(queue_type, status);
create index if not exists idx_lqi_assigned_ba
  on public.lead_queue_items(assigned_ba_id)
  where status = 'active';
create index if not exists idx_lqi_assigned_la
  on public.lead_queue_items(assigned_la_id)
  where status = 'active';
create index if not exists idx_lqi_owner
  on public.lead_queue_items(current_owner_user_id)
  where status = 'active';
create index if not exists idx_lqi_call_center
  on public.lead_queue_items(call_center_id, status);
create index if not exists idx_lqi_created_at
  on public.lead_queue_items(created_at desc);
create table if not exists public.lead_queue_events (
  id uuid primary key default gen_random_uuid(),
  queue_item_id uuid not null references public.lead_queue_items(id) on delete cascade,
  event_type public.queue_event_type_enum not null,
  actor_user_id uuid null references public.users(id) on delete set null,
  actor_role public.queue_role_enum null,
  old_payload jsonb null,
  new_payload jsonb null,
  meta jsonb null,
  slack_message_id text null,
  created_at timestamptz not null default now()
);
create index if not exists idx_lqe_queue_created
  on public.lead_queue_events(queue_item_id, created_at desc);
create table if not exists public.lead_queue_comments (
  id uuid primary key default gen_random_uuid(),
  queue_item_id uuid not null references public.lead_queue_items(id) on delete cascade,
  author_user_id uuid not null references public.users(id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  visibility text not null default 'manager_and_assigned',
  created_at timestamptz not null default now()
);
create or replace function public.set_updated_at_lead_queue_items()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_set_updated_at_lead_queue_items on public.lead_queue_items;
create trigger trg_set_updated_at_lead_queue_items
before update on public.lead_queue_items
for each row
execute function public.set_updated_at_lead_queue_items();
create or replace view public.v_queue_source_snapshot as
select
  l.id as lead_id,
  l.submission_id,
  l.policy_id,
  trim(concat(coalesce(l.first_name,''), ' ', coalesce(l.last_name,''))) as client_name,
  l.phone as phone_number,
  l.call_center_id,
  cc.name as call_center_name,
  l.state,
  l.carrier,
  l.updated_at as lead_updated_at
from public.leads l
left join public.call_centers cc on cc.id = l.call_center_id;
-- END lead_queue_management.sql

-- BEGIN lead_queue_management_permissions.sql
-- Table/API privileges for signed-in users
grant usage on schema public to authenticated;
grant select, insert, update, delete
  on table public.lead_queue_items
  to authenticated;
grant select, insert
  on table public.lead_queue_events
  to authenticated;
grant select, insert
  on table public.lead_queue_comments
  to authenticated;
grant select
  on table public.v_queue_source_snapshot
  to authenticated;
-- RLS
alter table public.lead_queue_items enable row level security;
alter table public.lead_queue_events enable row level security;
alter table public.lead_queue_comments enable row level security;
-- Dev-first permissive policies for authenticated users on queue tables.
-- These can be tightened to role-specific checks in the next iteration.
drop policy if exists lead_queue_items_authenticated_all on public.lead_queue_items;
create policy lead_queue_items_authenticated_all
  on public.lead_queue_items
  for all
  to authenticated
  using (true)
  with check (true);
drop policy if exists lead_queue_events_authenticated_read on public.lead_queue_events;
create policy lead_queue_events_authenticated_read
  on public.lead_queue_events
  for select
  to authenticated
  using (true);
drop policy if exists lead_queue_events_authenticated_insert on public.lead_queue_events;
create policy lead_queue_events_authenticated_insert
  on public.lead_queue_events
  for insert
  to authenticated
  with check (true);
drop policy if exists lead_queue_comments_authenticated_read on public.lead_queue_comments;
create policy lead_queue_comments_authenticated_read
  on public.lead_queue_comments
  for select
  to authenticated
  using (true);
drop policy if exists lead_queue_comments_authenticated_insert on public.lead_queue_comments;
create policy lead_queue_comments_authenticated_insert
  on public.lead_queue_comments
  for insert
  to authenticated
  with check (true);
-- END lead_queue_management_permissions.sql

-- BEGIN center_thresholds.sql
-- ============================================
-- CENTER THRESHOLDS TABLE & POLICIES
-- ============================================

-- Create center_thresholds table
CREATE TABLE IF NOT EXISTS public.center_thresholds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  center_name text NOT NULL,
  lead_vendor text NOT NULL,
  tier text NULL DEFAULT 'C'::text,
  daily_transfer_target integer NULL DEFAULT 10,
  daily_sales_target integer NULL DEFAULT 5,
  max_dq_percentage numeric(5, 2) NULL DEFAULT 20.00,
  min_approval_ratio numeric(5, 2) NULL DEFAULT 20.00,
  transfer_weight integer NULL DEFAULT 40,
  approval_ratio_weight integer NULL DEFAULT 35,
  dq_weight integer NULL DEFAULT 25,
  is_active boolean NULL DEFAULT true,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL,
  slack_webhook_url text NULL,
  slack_channel text NULL,
  slack_manager_id text NULL,
  underwriting_threshold integer NULL DEFAULT 5,
  slack_channel_id text NULL,
  CONSTRAINT center_thresholds_pkey PRIMARY KEY (id),
  CONSTRAINT center_thresholds_center_name_key UNIQUE (center_name),
  CONSTRAINT center_thresholds_lead_vendor_key UNIQUE (lead_vendor),
  CONSTRAINT center_thresholds_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id),
  CONSTRAINT center_thresholds_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users (id),
  CONSTRAINT center_thresholds_tier_check CHECK (
    tier = ANY (ARRAY['A'::text, 'B'::text, 'C'::text])
  )
) TABLESPACE pg_default;
-- Create indexes
CREATE INDEX IF NOT EXISTS idx_center_thresholds_lead_vendor ON public.center_thresholds USING btree (lead_vendor) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_center_thresholds_tier ON public.center_thresholds USING btree (tier) TABLESPACE pg_default;
-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_center_thresholds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Create trigger
DROP TRIGGER IF EXISTS set_center_thresholds_updated_at ON public.center_thresholds;
CREATE TRIGGER set_center_thresholds_updated_at
  BEFORE UPDATE ON public.center_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION update_center_thresholds_updated_at();
-- ============================================
-- RLS POLICIES FOR SYSTEM_ADMIN
-- ============================================

-- Enable RLS
ALTER TABLE public.center_thresholds ENABLE ROW LEVEL SECURITY;
-- Grant basic permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.center_thresholds TO authenticated;
-- Policy: SELECT for system_admin
DROP POLICY IF EXISTS center_thresholds_select_system_admin ON public.center_thresholds;
CREATE POLICY center_thresholds_select_system_admin
ON public.center_thresholds
FOR SELECT
TO authenticated
USING (public.has_role('system_admin'));
-- Policy: SELECT for publisher_manager
DROP POLICY IF EXISTS center_thresholds_select_publisher_manager ON public.center_thresholds;
CREATE POLICY center_thresholds_select_publisher_manager
ON public.center_thresholds
FOR SELECT
TO authenticated
USING (public.has_role('publisher_manager'));
-- Policy: SELECT for sales_manager
DROP POLICY IF EXISTS center_thresholds_select_sales_manager ON public.center_thresholds;
CREATE POLICY center_thresholds_select_sales_manager
ON public.center_thresholds
FOR SELECT
TO authenticated
USING (public.has_role('sales_manager'));
-- Policy: INSERT for system_admin
DROP POLICY IF EXISTS center_thresholds_insert_system_admin ON public.center_thresholds;
CREATE POLICY center_thresholds_insert_system_admin
ON public.center_thresholds
FOR INSERT
TO authenticated
WITH CHECK (public.has_role('system_admin'));
-- Policy: UPDATE for system_admin
DROP POLICY IF EXISTS center_thresholds_update_system_admin ON public.center_thresholds;
CREATE POLICY center_thresholds_update_system_admin
ON public.center_thresholds
FOR UPDATE
TO authenticated
USING (public.has_role('system_admin'))
WITH CHECK (public.has_role('system_admin'));
-- Policy: UPDATE for publisher_manager
DROP POLICY IF EXISTS center_thresholds_update_publisher_manager ON public.center_thresholds;
CREATE POLICY center_thresholds_update_publisher_manager
ON public.center_thresholds
FOR UPDATE
TO authenticated
USING (public.has_role('publisher_manager'))
WITH CHECK (public.has_role('publisher_manager'));
-- Policy: UPDATE for sales_manager
DROP POLICY IF EXISTS center_thresholds_update_sales_manager ON public.center_thresholds;
CREATE POLICY center_thresholds_update_sales_manager
ON public.center_thresholds
FOR UPDATE
TO authenticated
USING (public.has_role('sales_manager'))
WITH CHECK (public.has_role('sales_manager'));
-- Policy: DELETE for system_admin
DROP POLICY IF EXISTS center_thresholds_delete_system_admin ON public.center_thresholds;
CREATE POLICY center_thresholds_delete_system_admin
ON public.center_thresholds
FOR DELETE
TO authenticated
USING (public.has_role('system_admin'));
-- END center_thresholds.sql

-- BEGIN add_agent_language.sql
-- ============================================
-- ADD LANGUAGE COLUMN TO AGENTS TABLE
-- ============================================

-- Add language column to agents table
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS language text DEFAULT 'English';
-- Add check constraint for valid languages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'agents_language_check' 
    AND conrelid = 'public.agents'::regclass
  ) THEN
    ALTER TABLE public.agents 
    ADD CONSTRAINT agents_language_check 
    CHECK (language IN ('English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Tagalog', 'Vietnamese', 'Russian', 'Polish'));
  END IF;
END $$;
-- Add index for language lookups
CREATE INDEX IF NOT EXISTS idx_agents_language ON public.agents(language);
-- END add_agent_language.sql

-- BEGIN add_country_to_call_centers.sql
-- Add country column to call_centers table
alter table public.call_centers
add column if not exists country text null;
-- Create index for country filtering
create index if not exists idx_call_centers_country on public.call_centers(country);
-- Update RLS policies to allow country field access (same as other fields)
-- The existing policies should already cover it since they allow all authenticated access

comment on column public.call_centers.country is 'Country where the call center is located (e.g., United States, Pakistan, Philippines)';
-- END add_country_to_call_centers.sql

-- BEGIN add_unlicensed_sales_subtype.sql
-- Subtype for Sales Agent (Unlicensed): buffer vs retention routing in claim workflows.
-- Safe to run multiple times.

alter table public.users
  add column if not exists unlicensed_sales_subtype text;
alter table public.users
  drop constraint if exists users_unlicensed_sales_subtype_check;
alter table public.users
  add constraint users_unlicensed_sales_subtype_check
  check (
    unlicensed_sales_subtype is null
    or unlicensed_sales_subtype in ('buffer_agent', 'retention_agent')
  );
comment on column public.users.unlicensed_sales_subtype is
  'For role sales_agent_unlicensed only: buffer_agent or retention_agent; null for other roles or unset.';
-- END add_unlicensed_sales_subtype.sql

-- BEGIN call_centers_add_status_column.sql
alter table public.call_centers
add column if not exists status text;
alter table public.call_centers
alter column status set default 'active';
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'call_centers_status_check'
      and conrelid = 'public.call_centers'::regclass
  ) then
    alter table public.call_centers
    add constraint call_centers_status_check
    check (status in ('active', 'inactive'));
  end if;
end $$;
alter table public.call_centers
alter column status set not null;
-- END call_centers_add_status_column.sql

-- BEGIN call_results_agent_portal_parity.sql
-- Adds Agent Portal parity columns to CRM call_results table.
-- Safe to run multiple times.

alter table public.call_results
  add column if not exists application_submitted boolean,
  add column if not exists status text,
  add column if not exists dq_reason text,
  add column if not exists call_source text,
  add column if not exists buffer_agent text,
  add column if not exists agent_who_took_call text,
  add column if not exists sent_to_underwriting boolean default false,
  add column if not exists licensed_agent_account text,
  add column if not exists carrier text,
  add column if not exists product_type text,
  add column if not exists draft_date date,
  add column if not exists monthly_premium numeric(10, 2),
  add column if not exists coverage_amount numeric(12, 2),
  add column if not exists face_amount numeric(12, 2),
  add column if not exists is_callback boolean default false,
  add column if not exists is_retention_call boolean default false,
  add column if not exists carrier_attempted_1 text,
  add column if not exists carrier_attempted_2 text,
  add column if not exists carrier_attempted_3 text,
  add column if not exists user_id uuid references auth.users(id);
create index if not exists idx_call_results_submission_id on public.call_results(submission_id);
create index if not exists idx_call_results_status on public.call_results(status);
create index if not exists idx_call_results_call_source on public.call_results(call_source);
-- END call_results_agent_portal_parity.sql

-- BEGIN daily_deal_flow_add_call_result_parity.sql
-- Mirror key call_results / transfer portal fields on daily_deal_flow for reporting and DDF edits.
-- Safe to run multiple times.

alter table public.daily_deal_flow
  add column if not exists application_submitted boolean null,
  add column if not exists call_source text null,
  add column if not exists sent_to_underwriting boolean null,
  add column if not exists coverage_amount numeric(12, 2) null,
  add column if not exists carrier_attempted_1 text null,
  add column if not exists carrier_attempted_2 text null,
  add column if not exists carrier_attempted_3 text null;
-- END daily_deal_flow_add_call_result_parity.sql

-- BEGIN daily_deal_flow_add_disposition_fields.sql
alter table public.daily_deal_flow
  add column if not exists dq_reason text,
  add column if not exists new_draft_date date,
  add column if not exists disposition_path jsonb,
  add column if not exists generated_note text,
  add column if not exists manual_note text,
  add column if not exists quick_disposition_tag text;
-- END daily_deal_flow_add_disposition_fields.sql

-- BEGIN daily_deal_flow_sales_admin_insert.sql
-- Allow Sales Admin to create Daily Deal Flow rows from manual lead admission.

drop policy if exists daily_deal_flow_insert_global on public.daily_deal_flow;
create policy daily_deal_flow_insert_global
on public.daily_deal_flow
for insert
to authenticated
with check (
  public.has_any_role(array[
    'system_admin',
    'sales_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
);
-- END daily_deal_flow_sales_admin_insert.sql

-- BEGIN disposition_flows_update_needs_bpo_signature_paths.sql
-- END disposition_flows_update_needs_bpo_signature_paths.sql

-- BEGIN grant_lead_pipeline_update_call_center.sql
-- END grant_lead_pipeline_update_call_center.sql

-- BEGIN grant_transfer_leads_edit_permission.sql
-- END grant_transfer_leads_edit_permission.sql

-- BEGIN lead_queue_items_add_transfer_screening.sql
-- Persist transfer / TCPA screening snapshot when a queue row is created (auto-screening).

alter table public.lead_queue_items
  add column if not exists transfer_screening_json jsonb;
alter table public.lead_queue_items
  add column if not exists transfer_screening_at timestamptz;
-- END lead_queue_items_add_transfer_screening.sql

-- BEGIN leads_add_backup_quote_columns.sql
-- Optional backup quote on transfer / BPO leads (mirrors primary carrier/product/premium/coverage).

alter table public.leads
  add column if not exists has_backup_quote boolean not null default false;
alter table public.leads
  add column if not exists backup_carrier text null;
alter table public.leads
  add column if not exists backup_product_type text null;
alter table public.leads
  add column if not exists backup_monthly_premium text null;
alter table public.leads
  add column if not exists backup_coverage_amount text null;
-- END leads_add_backup_quote_columns.sql

-- BEGIN leads_add_existing_coverage_details.sql
-- Add existing coverage details field for transfer lead application form.
alter table public.leads
  add column if not exists existing_coverage_details text;
-- END leads_add_existing_coverage_details.sql

-- BEGIN leads_add_is_active_column.sql
-- Optional column for `dnc-lookup` edge function: deactivate TCPA-flagged leads.
alter table public.leads
  add column if not exists is_active boolean not null default true;
create index if not exists leads_is_active_idx
  on public.leads using btree (is_active)
  where is_active = true;
-- END leads_add_is_active_column.sql

-- BEGIN leads_add_language_column.sql
-- Add lead language for transfer portal intake (English/Spanish).
alter table public.leads
  add column if not exists language text;
-- END leads_add_language_column.sql

-- BEGIN leads_add_licensed_agent_account.sql
-- Store assigned owner (licensed agent display name) on leads.
alter table public.leads
  add column if not exists licensed_agent_account text;
-- END leads_add_licensed_agent_account.sql

-- BEGIN leads_add_sync_required.sql
-- Add sync_required column to leads table
-- Run this in your Supabase SQL Editor

-- Add the sync_required boolean column with default true
alter table public.leads 
add column if not exists sync_required boolean not null default true;
-- Create index for filtering
create index if not exists leads_sync_required_idx on public.leads (sync_required);
-- Disable sync for all existing leads (one-time migration)
-- Run this if you want to disable sync for all existing leads
-- update public.leads set sync_required = false where sync_required is not false;
-- END leads_add_sync_required.sql

-- BEGIN leads_add_tags_column.sql
-- Add tags support on leads for duplicate labeling and future categorization
alter table public.leads
add column if not exists tags text[] not null default '{}';
-- END leads_add_tags_column.sql

-- BEGIN list_publisher_managers_for_ticket_assign.sql
-- Callable by call centre admins and system admins (creators of lead-scoped tickets) so they can
-- choose an assignee even though RLS on public.users does not expose publisher_manager rows to CC admins.

create or replace function public.list_publisher_managers_for_ticket_assign()
returns table (id uuid, full_name text, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.has_role('call_center_admin') or public.has_role('system_admin')) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  return query
  select
    u.id,
    coalesce(nullif(trim(u.full_name), ''), u.email) as full_name,
    u.email
  from public.users u
  join public.roles r on r.id = u.role_id
  where r.key = 'publisher_manager'
    and u.status = 'active'
  order by 2 asc, 3 asc;
end;
$$;
grant execute on function public.list_publisher_managers_for_ticket_assign() to authenticated;
-- END list_publisher_managers_for_ticket_assign.sql

-- BEGIN publisher_manager_role_permissions.sql
-- END publisher_manager_role_permissions.sql

-- BEGIN ssn_duplicate_stage_rules_precedence.sql
-- Precedence for duplicate / transfer-checker stage resolution.
-- Lower precedence_rank = higher priority when multiple leads match.
--
-- Tier 1 (10–59): business-critical ordering — always wins over tier 2 when resolving conflicts.
-- Tier 2 (100+): all other stages in pipeline order; messages are one of two templates:
--   • "Can be sent, approved." (transfer / chargeback workflow)
--   • "Customer has current policy — approved for transfer." (in-force / billing / lapse paths)

alter table public.ssn_duplicate_stage_rules
  add column if not exists precedence_rank integer not null default 500;
comment on column public.ssn_duplicate_stage_rules.precedence_rank is
  'Lower value = higher priority when several matched leads disagree; used with resolveDuplicatePolicy().';
-- END ssn_duplicate_stage_rules_precedence.sql

-- BEGIN ssn_duplicate_stage_rules.sql
-- SSN duplicate handling rules (DB-driven)
-- This table controls whether a new lead is addable when the same SSN already exists
-- in a specific stage, along with the message shown to the user and mapped GHL stage.

create table if not exists public.ssn_duplicate_stage_rules (
  id bigserial primary key,
  stage_name text not null unique,
  ghl_stage text,
  message text not null,
  is_addable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_ssn_duplicate_stage_rules_updated_at on public.ssn_duplicate_stage_rules;
create trigger trg_ssn_duplicate_stage_rules_updated_at
before update on public.ssn_duplicate_stage_rules
for each row execute function public.set_updated_at();
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.ssn_duplicate_stage_rules to authenticated;
grant usage, select on sequence public.ssn_duplicate_stage_rules_id_seq to authenticated;
alter table public.ssn_duplicate_stage_rules enable row level security;
-- Any authenticated user can read rules (needed during lead submission checks)
drop policy if exists ssn_duplicate_stage_rules_select_authenticated on public.ssn_duplicate_stage_rules;
create policy ssn_duplicate_stage_rules_select_authenticated
on public.ssn_duplicate_stage_rules
for select
to authenticated
using (true);
-- Only system admin can manage rules
drop policy if exists ssn_duplicate_stage_rules_insert_system_admin on public.ssn_duplicate_stage_rules;
create policy ssn_duplicate_stage_rules_insert_system_admin
on public.ssn_duplicate_stage_rules
for insert
to authenticated
with check (public.has_role('system_admin'));
drop policy if exists ssn_duplicate_stage_rules_update_system_admin on public.ssn_duplicate_stage_rules;
create policy ssn_duplicate_stage_rules_update_system_admin
on public.ssn_duplicate_stage_rules
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));
drop policy if exists ssn_duplicate_stage_rules_delete_system_admin on public.ssn_duplicate_stage_rules;
create policy ssn_duplicate_stage_rules_delete_system_admin
on public.ssn_duplicate_stage_rules
for delete
to authenticated
using (public.has_role('system_admin'));
-- END ssn_duplicate_stage_rules.sql

-- BEGIN stage_disposition_map.sql
create table if not exists public.stage_disposition_map (
  id bigserial primary key,
  stage_id bigint not null references public.pipeline_stages (id) on delete cascade,
  disposition text not null,
  created_at timestamptz not null default now(),
  unique (stage_id),
  unique (disposition)
);
comment on table public.stage_disposition_map is 'One-to-one: pipeline_stages.id (Transfer Portal targets below) to canonical disposition label.';
grant select on public.stage_disposition_map to authenticated;
grant usage, select on sequence public.stage_disposition_map_id_seq to authenticated;
alter table public.stage_disposition_map enable row level security;
drop policy if exists stage_disposition_map_select_authenticated on public.stage_disposition_map;
create policy stage_disposition_map_select_authenticated
on public.stage_disposition_map
for select
to authenticated
using (true);
-- END stage_disposition_map.sql

-- BEGIN storage_ticket_attachments_bucket.sql
-- Policy: allow authenticated users to upload files
-- Only call_center_admins creating tickets should be uploading
create policy "Allow authenticated uploads"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'ticket-attachments');
-- Policy: allow authenticated users to read files
create policy "Allow authenticated reads"
on storage.objects
for select
to authenticated
using (bucket_id = 'ticket-attachments');
-- END storage_ticket_attachments_bucket.sql

-- BEGIN ticket_comments_update_policy.sql
-- Allow ticket participants to edit their own comment body (RLS had insert/delete only).
drop policy if exists ticket_comments_update_own on public.ticket_comments;
create policy ticket_comments_update_own
on public.ticket_comments
for update
to authenticated
using (
  user_id = auth.uid()
  and public.ticket_user_has_access(ticket_id, auth.uid())
)
with check (
  user_id = auth.uid()
  and public.ticket_user_has_access(ticket_id, auth.uid())
);
-- END ticket_comments_update_policy.sql

-- BEGIN ticket_user_has_access_add_publisher_manager.sql
-- Restore publisher_manager in ticket_user_has_access.
-- A partial deploy of call-centre visibility dropped the final OR branch; RLS then hid
-- all tickets from publisher_manager users even though the app and roles table expect access.

create or replace function public.ticket_user_has_access(p_ticket_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and (
        t.publisher_id = p_user_id
        or t.assignee_id = p_user_id
        or exists (
          select 1
          from public.ticket_followers tf
          where tf.ticket_id = t.id
            and tf.user_id = p_user_id
        )
        or (
          exists (
            select 1
            from public.users u_viewer
            join public.roles r on r.id = u_viewer.role_id
            where u_viewer.id = p_user_id
              and r.key = 'call_center_admin'
              and u_viewer.call_center_id is not null
          )
          and exists (
            select 1
            from public.leads l
            join public.users u_pub on u_pub.id = t.publisher_id
            join public.users u_viewer on u_viewer.id = p_user_id
            where l.id = t.lead_id
              and l.call_center_id is not null
              and l.call_center_id = u_viewer.call_center_id
              and u_pub.call_center_id is not null
              and u_pub.call_center_id = l.call_center_id
          )
        )
      )
  )
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_user_id
      and r.key = 'system_admin'
  )
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_user_id
      and r.key = 'publisher_manager'
  );
$$;
grant execute on function public.ticket_user_has_access(uuid, uuid) to authenticated;
-- END ticket_user_has_access_add_publisher_manager.sql

-- BEGIN tickets_add_lead_name.sql
-- Add lead_name to tickets and make lead_id nullable
-- Run this in your Supabase SQL Editor

-- Make lead_id nullable (idempotent - safe to run even if already nullable)
alter table public.tickets alter column lead_id drop not null;
-- Add lead_name text column for manual lead name entry
alter table public.tickets add column if not exists lead_name text;
-- Update RLS insert policy to allow tickets without a linked lead
-- (when lead_id is null, we verify via call_center_id instead)
drop policy if exists tickets_insert_publishers on public.tickets;
create policy tickets_insert_publishers
on public.tickets
for insert
to authenticated
with check (
  publisher_id = auth.uid()
  and (
    -- System admin can create any ticket
    public.has_role('system_admin')
    or (
      -- Call center admin: must match call_center_id when lead_id is null,
      -- or match lead's call_center_id when lead_id is provided
      public.has_role('call_center_admin')
      and exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and u.call_center_id is not null
          and (
            -- No lead linked: verify via ticket's call_center_id
            (lead_id is null and call_center_id is not null and call_center_id = u.call_center_id)
            or
            -- Lead linked: verify via lead's call_center_id
            (lead_id is not null and exists (
              select 1
              from public.leads l
              where l.id = lead_id
                and l.call_center_id is not null
                and l.call_center_id = u.call_center_id
            ))
          )
      )
    )
  )
);
-- Grant select on new column (already covered by table grant, but explicit for clarity)
grant select, insert, update on public.tickets to authenticated;
-- END tickets_add_lead_name.sql

-- BEGIN tickets_add_type_priority_attachments.sql
-- Add ticket_type, priority, and attachments to tickets table
-- Run this in your Supabase SQL Editor

-- Ticket type enum (idempotent create)
do $$
begin
  create type public.ticket_type as enum ('general', 'billing', 'technical', 'escalation', 'compliance');
exception
  when duplicate_object then null;
end$$;
-- Add 'lead_inquiry' to existing enum (safe to run multiple times)
-- Note: PostgreSQL allows adding values to enums only at the end
do $$
begin
  alter type public.ticket_type add value if not exists 'lead_inquiry';
exception
  when duplicate_object then null;
end$$;
-- Priority enum
do $$
begin
  create type public.ticket_priority as enum ('low', 'medium', 'high', 'urgent');
exception
  when duplicate_object then null;
end$$;
-- Add columns to tickets table
alter table public.tickets
  add column if not exists ticket_type public.ticket_type null,
  add column if not exists priority public.ticket_priority null default 'medium'::ticket_priority,
  add column if not exists attachments jsonb null default '[]'::jsonb,
  add column if not exists call_center_id uuid null references public.call_centers (id) on delete set null;
-- Index for filtering by call center
create index if not exists tickets_call_center_id_idx on public.tickets (call_center_id);
-- Update RLS insert policy to allow call_center_admin to create tickets
-- (they must be in the same call center as the lead)
drop policy if exists tickets_insert_publishers on public.tickets;
create policy tickets_insert_publishers
on public.tickets
for insert
to authenticated
with check (
  publisher_id = auth.uid()
  and exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and (
        public.has_role('system_admin')
        or (
          public.has_role('call_center_admin')
          and l.call_center_id is not null
          and exists (
            select 1
            from public.users u
            where u.id = auth.uid()
              and u.call_center_id is not null
              and u.call_center_id = l.call_center_id
          )
        )
      )
  )
);
-- Grant select on new columns (already covered by table grant, but explicit for clarity)
grant select, insert, update on public.tickets to authenticated;
-- END tickets_add_type_priority_attachments.sql

-- BEGIN tickets_assignee_department.sql
-- Ticket assignee: default to the department's Publisher Manager (single department row for now).
-- Replaces routing-rule + publisher.manager_user_id logic in tickets_apply_default_assignee.
-- Prerequisite: departments_module.sql (departments.publisher_manager_user_id).

create or replace function public.tickets_apply_default_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pm uuid;
begin
  if new.assignee_id is not null then
    return new;
  end if;

  select d.publisher_manager_user_id
  into v_pm
  from public.departments d
  where d.publisher_manager_user_id is not null
  order by d.created_at asc
  limit 1;

  if v_pm is not null then
    new.assignee_id := v_pm;
  end if;

  return new;
end;
$$;
-- Trigger already exists from tickets_module.sql; ensure it points at this function body.
drop trigger if exists trg_tickets_apply_routing on public.tickets;
create trigger trg_tickets_apply_routing
before insert on public.tickets
for each row execute function public.tickets_apply_default_assignee();
-- END tickets_assignee_department.sql

-- BEGIN tickets_auto_assign_publisher_manager.sql
-- Update auto-assign trigger to assign tickets to publisher_manager role
-- Run this in your Supabase SQL Editor

-- ---------------------------------------------------------------------------
-- Auto-assign: routing rules (lead-linked only), then any publisher_manager
-- ---------------------------------------------------------------------------
create or replace function public.tickets_apply_default_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_country text;
  v_region text;
  v_language text;
  v_rule_user uuid;
  v_manager uuid;
begin
  if new.assignee_id is not null then
    return new;
  end if;

  -- Routing rules only apply when a lead is linked
  if new.lead_id is not null then
    select lower(trim(cc.country)), lower(trim(cc.region)), lower(trim(l.language))
    into v_country, v_region, v_language
    from public.leads l
    left join public.call_centers cc on cc.id = l.call_center_id
    where l.id = new.lead_id;

    select r.assignee_user_id
    into v_rule_user
    from public.ticket_routing_rules r
    where r.is_active
      and (
        (r.rule_kind = 'country' and v_country is not null and v_country = lower(trim(r.match_value)))
        or (r.rule_kind = 'region' and v_region is not null and v_region = lower(trim(r.match_value)))
        or (r.rule_kind = 'language' and v_language is not null and v_language = lower(trim(r.match_value)))
      )
    order by r.priority asc, r.created_at asc
    limit 1;

    if v_rule_user is not null then
      new.assignee_id := v_rule_user;
      return new;
    end if;
  end if;

  -- Fallback: assign to a publisher_manager user
  -- Prefer one in the same call center if ticket has call_center_id
  select u.id
  into v_manager
  from public.users u
  join public.roles r on r.id = u.role_id
  where r.key = 'publisher_manager'
  order by
    case when new.call_center_id is not null and u.call_center_id = new.call_center_id then 0 else 1 end,
    u.created_at asc
  limit 1;

  if v_manager is not null then
    new.assignee_id := v_manager;
  end if;

  return new;
end;
$$;
-- Recreate trigger to ensure it uses the updated function
drop trigger if exists trg_tickets_apply_routing on public.tickets;
create trigger trg_tickets_apply_routing
before insert on public.tickets
for each row execute function public.tickets_apply_default_assignee();
-- END tickets_auto_assign_publisher_manager.sql

-- BEGIN tickets_call_center_visibility.sql
-- Allow call center admins to read (and comment on) support tickets for leads in their center
-- when the ticket was published by any user from that same call center.
-- Keeps publisher_manager / assignee visibility unchanged.

create or replace function public.ticket_user_has_access(p_ticket_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and (
        t.publisher_id = p_user_id
        or t.assignee_id = p_user_id
        or exists (
          select 1
          from public.ticket_followers tf
          where tf.ticket_id = t.id
            and tf.user_id = p_user_id
        )
        or (
          exists (
            select 1
            from public.users u_viewer
            join public.roles r on r.id = u_viewer.role_id
            where u_viewer.id = p_user_id
              and r.key = 'call_center_admin'
              and u_viewer.call_center_id is not null
          )
          and exists (
            select 1
            from public.leads l
            join public.users u_pub on u_pub.id = t.publisher_id
            join public.users u_viewer on u_viewer.id = p_user_id
            where l.id = t.lead_id
              and l.call_center_id is not null
              and l.call_center_id = u_viewer.call_center_id
              and u_pub.call_center_id is not null
              and u_pub.call_center_id = l.call_center_id
          )
        )
      )
  )
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_user_id
      and r.key = 'system_admin'
  )
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_user_id
      and r.key = 'publisher_manager'
  );
$$;
-- END tickets_call_center_visibility.sql

-- BEGIN users_department_id.sql
-- Link users (e.g. Publisher Manager) to a department.
-- Prerequisite: public.departments from departments_module.sql.

alter table public.users
  add column if not exists department_id uuid references public.departments (id) on delete set null;
create index if not exists idx_users_department_id on public.users (department_id);
comment on column public.users.department_id is
  'Department for publisher_manager and related roles (publisher management).';
-- END users_department_id.sql

-- BEGIN call_centers_rls_allow_authenticated_read.sql
-- Allow all authenticated users to read call centers (needed for slack channel lookup)
drop policy if exists call_centers_select_authenticated on public.call_centers;
create policy call_centers_select_authenticated
on public.call_centers
for select
to authenticated
using (true);
-- END call_centers_rls_allow_authenticated_read.sql

-- BEGIN call_centers_rls_allow_call_center_admin_update.sql
-- Allow call center admins to read and update call centers.
-- Existing system_admin policies remain in place.

drop policy if exists call_centers_select_call_center_admin on public.call_centers;
create policy call_centers_select_call_center_admin
on public.call_centers
for select
to authenticated
using (public.has_role('call_center_admin'));
drop policy if exists call_centers_update_call_center_admin on public.call_centers;
create policy call_centers_update_call_center_admin
on public.call_centers
for update
to authenticated
using (public.has_role('call_center_admin'))
with check (public.has_role('call_center_admin'));
-- END call_centers_rls_allow_call_center_admin_update.sql

-- BEGIN daily_deal_flow_rls_scope.sql
-- Scope daily_deal_flow: role-based access, with call-center scoping.

drop policy if exists daily_deal_flow_select_authenticated on public.daily_deal_flow;
drop policy if exists daily_deal_flow_insert_authenticated on public.daily_deal_flow;
drop policy if exists daily_deal_flow_update_authenticated on public.daily_deal_flow;
drop policy if exists daily_deal_flow_delete_authenticated on public.daily_deal_flow;
drop policy if exists daily_deal_flow_select_scoped on public.daily_deal_flow;
drop policy if exists daily_deal_flow_insert_scoped on public.daily_deal_flow;
drop policy if exists daily_deal_flow_update_scoped on public.daily_deal_flow;
drop policy if exists daily_deal_flow_delete_scoped on public.daily_deal_flow;
-- Ensure call_center_id exists for scoping (safe to rerun).
alter table public.daily_deal_flow
add column if not exists call_center_id uuid null references public.call_centers(id);
create index if not exists idx_daily_deal_flow_call_center_id
on public.daily_deal_flow(call_center_id);
-- Helper: current user's call_center_id (null if missing).
create or replace function public.current_user_call_center_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.call_center_id
  from public.users u
  where u.id = auth.uid();
$$;
-- ── SELECT ───────────────────────────────────────────────────────────────────
create policy daily_deal_flow_select_global
on public.daily_deal_flow
for select
to authenticated
using (
  public.has_any_role(array[
    'system_admin',
    'sales_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
);
create policy daily_deal_flow_select_call_center
on public.daily_deal_flow
for select
to authenticated
using (
  public.has_any_role(array['call_center_admin', 'call_center_agent'])
  and call_center_id is not null
  and call_center_id = public.current_user_call_center_id()
);
-- ── INSERT ───────────────────────────────────────────────────────────────────
create policy daily_deal_flow_insert_global
on public.daily_deal_flow
for insert
to authenticated
with check (
  public.has_any_role(array[
    'system_admin',
    'sales_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
);
create policy daily_deal_flow_insert_call_center
on public.daily_deal_flow
for insert
to authenticated
with check (
  public.has_any_role(array['call_center_admin', 'call_center_agent'])
  and call_center_id is not null
  and call_center_id = public.current_user_call_center_id()
);
-- ── UPDATE ───────────────────────────────────────────────────────────────────
create policy daily_deal_flow_update_global
on public.daily_deal_flow
for update
to authenticated
using (
  public.has_any_role(array[
    'system_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
)
with check (
  public.has_any_role(array[
    'system_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
);
create policy daily_deal_flow_update_call_center
on public.daily_deal_flow
for update
to authenticated
using (
  public.has_any_role(array['call_center_admin', 'call_center_agent'])
  and call_center_id is not null
  and call_center_id = public.current_user_call_center_id()
)
with check (
  public.has_any_role(array['call_center_admin', 'call_center_agent'])
  and call_center_id is not null
  and call_center_id = public.current_user_call_center_id()
);
-- ── DELETE ───────────────────────────────────────────────────────────────────
create policy daily_deal_flow_delete_global
on public.daily_deal_flow
for delete
to authenticated
using (
  public.has_any_role(array[
    'system_admin',
    'sales_manager',
    'hr',
    'accounting'
  ])
);
create policy daily_deal_flow_delete_call_center
on public.daily_deal_flow
for delete
to authenticated
using (
  public.has_any_role(array['call_center_admin', 'call_center_agent'])
  and call_center_id is not null
  and call_center_id = public.current_user_call_center_id()
);
-- END daily_deal_flow_rls_scope.sql

-- BEGIN leads_rls_add_sales_read_access.sql
-- Allow sales roles to read all leads (cross-center visibility).
-- Keeps existing behavior for submitter, system_admin, hr, and call-center roles.

drop policy if exists leads_select_own_or_admin_or_call_center on public.leads;
create policy leads_select_own_or_admin_or_call_center
on public.leads
for select
to authenticated
using (
  submitted_by = auth.uid()
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (
        array[
          'system_admin',
          'hr',
          'call_center_admin',
          'call_center_agent',
          'sales_admin',
          'sales_manager',
          'sales_agent_licensed',
          'sales_agent_unlicensed'
        ]::text[]
      )
  )
);
-- END leads_rls_add_sales_read_access.sql

-- BEGIN leads_rls_add_update_access.sql
-- Allow transfer/call workflows to update lead rows under RLS.
-- Mirrors role scope from leads_select_own_or_admin_or_call_center, plus submitter ownership.

alter table public.leads enable row level security;
drop policy if exists leads_update_own_or_admin_or_call_center on public.leads;
create policy leads_update_own_or_admin_or_call_center
on public.leads
for update
to authenticated
using (
  submitted_by = auth.uid()
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (
        array[
          'system_admin',
          'hr',
          'call_center_admin',
          'call_center_agent',
          'sales_admin',
          'sales_manager',
          'sales_agent_licensed',
          'sales_agent_unlicensed'
        ]::text[]
      )
  )
)
with check (
  submitted_by = auth.uid()
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (
        array[
          'system_admin',
          'hr',
          'call_center_admin',
          'call_center_agent',
          'sales_admin',
          'sales_manager',
          'sales_agent_licensed',
          'sales_agent_unlicensed'
        ]::text[]
      )
  )
);
grant update on public.leads to authenticated;
-- END leads_rls_add_update_access.sql

-- BEGIN policies_rls_authenticated.sql
-- Fix: "new row violates row-level security policy for table policies" (42501) on insert/update from the agent portal.
-- The browser uses the Supabase `authenticated` role. Align with other CRM tables (e.g. call_results) that allow
-- authenticated read/write for portal workflows.
--
-- Apply in Supabase: SQL Editor → run this script once (after `public.policies` exists).

alter table public.policies enable row level security;
drop policy if exists policies_rw_authenticated on public.policies;
create policy policies_rw_authenticated
on public.policies
for all
to authenticated
using (true)
with check (true);
grant select, insert, update, delete on table public.policies to authenticated;
-- Serial / identity default for id (safe if the sequence name differs — ignore errors in that case)
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
      and c.relname = 'policies_id_seq'
  ) then
    execute 'grant usage, select on sequence public.policies_id_seq to authenticated';
  end if;
end $$;
-- END policies_rls_authenticated.sql

-- BEGIN tickets_rls_insert_publisher_center_admin.sql
-- One-off: tighten ticket INSERT to call_center_admin (same center as lead) or system_admin.
-- Run after tickets_module.sql if you already deployed the older submitter-based policy.

drop policy if exists tickets_insert_publishers on public.tickets;
create policy tickets_insert_publishers
on public.tickets
for insert
to authenticated
with check (
  publisher_id = auth.uid()
  and exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and (
        public.has_role('system_admin')
        or (
          public.has_role('call_center_admin')
          and l.call_center_id is not null
          and exists (
            select 1
            from public.users u
            where u.id = auth.uid()
              and u.call_center_id is not null
              and u.call_center_id = l.call_center_id
          )
        )
      )
  )
);
-- END tickets_rls_insert_publisher_center_admin.sql

-- BEGIN users_rls_allow_active_read.sql
-- Allow authenticated users to read active users for dropdowns
-- This is needed for Daily Deal Flow agent dropdowns

drop policy if exists users_select_active_authenticated on public.users;
create policy users_select_active_authenticated
on public.users
for select
to authenticated
using (status = 'active');
-- END users_rls_allow_active_read.sql

-- BEGIN users_rls_explicit_system_admin_access.sql
-- Cleanup: these explicit policies are now redundant.
-- system_admin SELECT is covered by users_select_system_admin_all in authentication_module.sql.
-- system_admin UPDATE is covered by users_update_admin_hr in authentication_module.sql.
drop policy if exists users_select_system_admin_explicit on public.users;
drop policy if exists users_update_system_admin_explicit on public.users;
-- END users_rls_explicit_system_admin_access.sql

