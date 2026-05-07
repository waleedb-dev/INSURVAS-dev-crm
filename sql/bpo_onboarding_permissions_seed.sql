-- Permission + role mapping for BPO Centre Onboarding dashboard page.
-- Run after public.permissions and public.role_permissions exist.
-- Safe to run multiple times.

insert into public.permissions (key, resource, action, description) values
  ('page.bpo_onboarding.access', 'bpo_onboarding', 'access', 'Can access BPO Centre Onboarding workspace')
on conflict (key) do update set
  resource = excluded.resource,
  action = excluded.action,
  description = excluded.description,
  is_active = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'system_admin'
  and p.key = 'page.bpo_onboarding.access'
on conflict (role_id, permission_id) do nothing;

delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.key <> 'system_admin'
  and p.key = 'page.bpo_onboarding.access';
