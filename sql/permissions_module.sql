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

-- 2) Permission seed (4 pages/modules + action checks)
insert into public.permissions (key, resource, action, description) values
  ('page.daily_deal_flow.access', 'daily_deal_flow', 'access', 'Can access Daily Deal Flow page'),
  ('action.daily_deal_flow.process', 'daily_deal_flow', 'process', 'Can process records in Daily Deal Flow'),
  ('page.assigning.access', 'assigning', 'access', 'Can access Assigning page'),
  ('action.assigning.assign', 'assigning', 'assign', 'Can assign leads/records'),
  ('page.lead_pipeline.access', 'lead_pipeline', 'access', 'Can access Lead Pipeline page'),
  ('action.lead_pipeline.update', 'lead_pipeline', 'update', 'Can update lead pipeline states'),
  ('page.commissions.access', 'commissions', 'access', 'Can access Commissions page'),
  ('action.commissions.approve', 'commissions', 'approve', 'Can approve commissions'),
  ('page.transfer_leads.access', 'transfer_leads', 'access', 'Can access Transfer Leads page'),
  ('action.transfer_leads.create', 'transfer_leads', 'create', 'Can create new transfer lead records')
on conflict (key) do update
set
  resource = excluded.resource,
  action = excluded.action,
  description = excluded.description,
  is_active = true;

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

    ('sales_manager', 'page.daily_deal_flow.access'),
    ('sales_manager', 'action.daily_deal_flow.process'),
    ('sales_manager', 'page.assigning.access'),
    ('sales_manager', 'action.assigning.assign'),
    ('sales_manager', 'page.lead_pipeline.access'),
    ('sales_manager', 'action.lead_pipeline.update'),
    ('sales_manager', 'page.commissions.access'),

    ('sales_agent_licensed', 'page.daily_deal_flow.access'),
    ('sales_agent_licensed', 'action.daily_deal_flow.process'),
    ('sales_agent_licensed', 'page.lead_pipeline.access'),
    ('sales_agent_licensed', 'action.lead_pipeline.update'),

    ('sales_agent_unlicensed', 'page.daily_deal_flow.access'),
    ('sales_agent_unlicensed', 'page.lead_pipeline.access'),
    ('sales_agent_unlicensed', 'action.lead_pipeline.update'),

    ('call_center_admin', 'page.assigning.access'),
    ('call_center_admin', 'action.assigning.assign'),
    ('call_center_admin', 'page.lead_pipeline.access'),
    ('call_center_admin', 'page.transfer_leads.access'),
    ('call_center_admin', 'action.transfer_leads.create'),

    ('call_center_agent', 'page.lead_pipeline.access'),
    ('call_center_agent', 'page.transfer_leads.access'),
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

