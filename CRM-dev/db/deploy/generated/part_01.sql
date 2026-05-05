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
