-- Supabase Auth module seed script
-- Safe to run multiple times.

-- 1) Seed fixed role catalog
insert into public.roles (key, name, description) values
  ('call_center_agent', 'Call Center Agent', 'Submit and manage own leads'),
  ('call_center_admin', 'Call Center Admin', 'Manage center operations and agents'),
  ('sales_manager', 'Sales Manager', 'Manage sales team and assignments'),
  ('sales_agent_licensed', 'Sales Agent (Licensed)', 'Licensed sales agent'),
  ('sales_agent_unlicensed', 'Sales Agent (Unlicensed)', 'Unlicensed sales agent'),
  ('system_admin', 'System Administrator', 'Full platform access'),
  ('hr', 'HR', 'User lifecycle and people operations'),
  ('accounting', 'Accounting', 'Commission and finance visibility')
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description;

-- 2) Optional: assign roles to existing auth users by email
-- Replace emails below with real accounts before running this block.
with role_map(email, role_key) as (
  values
    ('admin@example.com', 'system_admin'),
    ('hr@example.com', 'hr'),
    ('accounting@example.com', 'accounting')
)
insert into public.user_roles (user_id, role_id, assigned_by)
select
  au.id as user_id,
  r.id as role_id,
  null::uuid as assigned_by
from role_map rm
join auth.users au
  on lower(au.email) = lower(rm.email)
join public.roles r
  on r.key = rm.role_key
on conflict (user_id, role_id) do nothing;
