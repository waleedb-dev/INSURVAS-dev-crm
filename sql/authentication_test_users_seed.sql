-- Test users seed for fixed-role auth model
--
-- Prerequisite:
-- 1) Run sql/authentication_module_schema.sql
-- 2) Create these users in Supabase Auth (Dashboard -> Authentication -> Users)
--    using the exact emails below (recommended same password for all, e.g. Test@123456)
--
-- system_admin@testcrm.local
-- sales_manager@testcrm.local
-- sales_agent_licensed@testcrm.local
-- sales_agent_unlicensed@testcrm.local
-- call_center_admin@testcrm.local
-- call_center_agent@testcrm.local
-- hr@testcrm.local
-- accounting@testcrm.local

-- Ensure base org records exist for scoped roles
insert into public.call_centers (name, is_active)
values
  ('Center Alpha', true),
  ('Center Beta', true)
on conflict (name) do update
set is_active = excluded.is_active;

insert into public.sales_teams (name, is_active)
values
  ('Sales Team North', true),
  ('Sales Team South', true)
on conflict (name) do update
set is_active = excluded.is_active;

-- If some Auth users do not exist yet, this script will skip them.
-- A missing-users report is returned at the end.

-- Seed app profiles + role assignments
with seed_users as (
  select *
  from (
    values
      ('system_admin@testcrm.local', 'System Admin', 'system_admin', false, null::text, null::text),
      ('sales_manager@testcrm.local', 'Sales Manager', 'sales_manager', false, null::text, 'Sales Team North'),
      ('sales_agent_licensed@testcrm.local', 'Licensed Sales Agent', 'sales_agent_licensed', true, null::text, 'Sales Team North'),
      ('sales_agent_unlicensed@testcrm.local', 'Unlicensed Sales Agent', 'sales_agent_unlicensed', false, null::text, 'Sales Team North'),
      ('call_center_admin@testcrm.local', 'Call Center Admin', 'call_center_admin', false, 'Center Alpha', null::text),
      ('call_center_agent@testcrm.local', 'Call Center Agent', 'call_center_agent', false, 'Center Alpha', null::text),
      ('hr@testcrm.local', 'HR User', 'hr', false, null::text, null::text),
      ('accounting@testcrm.local', 'Accounting User', 'accounting', false, null::text, null::text)
  ) as t(email, full_name, role_key, is_licensed, call_center_name, sales_team_name)
),
resolved as (
  select
    au.id as user_id,
    su.email,
    su.full_name,
    su.role_key,
    su.is_licensed,
    cc.id as call_center_id,
    st.id as sales_team_id,
    r.id as role_id
  from seed_users su
  join auth.users au on lower(au.email) = lower(su.email)
  join public.roles r on r.key = su.role_key
  left join public.call_centers cc on cc.name = su.call_center_name
  left join public.sales_teams st on st.name = su.sales_team_name
),
upsert_profiles as (
  insert into public.users (
    id,
    full_name,
    status,
    call_center_id,
    sales_team_id,
    is_licensed,
    created_at,
    updated_at
  )
  select
    user_id,
    full_name,
    'active',
    call_center_id,
    sales_team_id,
    is_licensed,
    now(),
    now()
  from resolved
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    status = 'active',
    call_center_id = excluded.call_center_id,
    sales_team_id = excluded.sales_team_id,
    is_licensed = excluded.is_licensed,
    updated_at = now()
  returning id
)
insert into public.user_roles (user_id, role_id, assigned_by, assigned_at, revoked_at)
select
  r.user_id,
  r.role_id,
  null::uuid,
  now(),
  null
from resolved r
on conflict (user_id, role_id) do update
set revoked_at = null;

-- Revoke any extra active roles so each test user has exactly one active role
with seed_users as (
  select *
  from (
    values
      ('system_admin@testcrm.local', 'system_admin'),
      ('sales_manager@testcrm.local', 'sales_manager'),
      ('sales_agent_licensed@testcrm.local', 'sales_agent_licensed'),
      ('sales_agent_unlicensed@testcrm.local', 'sales_agent_unlicensed'),
      ('call_center_admin@testcrm.local', 'call_center_admin'),
      ('call_center_agent@testcrm.local', 'call_center_agent'),
      ('hr@testcrm.local', 'hr'),
      ('accounting@testcrm.local', 'accounting')
  ) as t(email, role_key)
),
expected as (
  select au.id as user_id, r.id as role_id
  from seed_users su
  join auth.users au on lower(au.email) = lower(su.email)
  join public.roles r on r.key = su.role_key
)
update public.user_roles ur
set revoked_at = now()
from expected e
where ur.user_id = e.user_id
  and ur.role_id <> e.role_id
  and ur.revoked_at is null;

-- Wire manager relationships for clearer test behavior
update public.users u
set manager_user_id = m.id,
    updated_at = now()
from public.users m
join auth.users mu on mu.id = m.id
join auth.users uu on lower(uu.email) in ('sales_agent_licensed@testcrm.local', 'sales_agent_unlicensed@testcrm.local')
where lower(mu.email) = 'sales_manager@testcrm.local'
  and uu.id = u.id;

update public.users u
set manager_user_id = m.id,
    updated_at = now()
from public.users m
join auth.users mu on mu.id = m.id
join auth.users uu on lower(uu.email) = 'call_center_agent@testcrm.local'
where lower(mu.email) = 'call_center_admin@testcrm.local'
  and uu.id = u.id;

-- Set team manager pointer
update public.sales_teams st
set manager_user_id = u.id
from public.users u
join auth.users au on au.id = u.id
where st.name = 'Sales Team North'
  and lower(au.email) = 'sales_manager@testcrm.local';

-- Report missing Auth users (if any)
with expected(email) as (
  values
    ('system_admin@testcrm.local'),
    ('sales_manager@testcrm.local'),
    ('sales_agent_licensed@testcrm.local'),
    ('sales_agent_unlicensed@testcrm.local'),
    ('call_center_admin@testcrm.local'),
    ('call_center_agent@testcrm.local'),
    ('hr@testcrm.local'),
    ('accounting@testcrm.local')
)
select e.email as missing_auth_user_email
from expected e
left join auth.users au on lower(au.email) = lower(e.email)
where au.id is null
order by e.email;
