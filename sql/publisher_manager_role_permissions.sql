-- Publisher Manager role + dashboard permissions (lead pipeline + transfer leads read for center).
-- Prerequisites: public.roles, public.permissions, public.role_permissions from permissions_module.sql.
-- Safe to run multiple times.

insert into public.roles (key, name, description, is_system)
values (
  'publisher_manager',
  'Publisher Manager',
  'Receives and resolves support tickets raised by call center admins (publisher management).',
  true
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'publisher_manager'
  and p.key in (
    'page.lead_pipeline.access',
    'action.lead_pipeline.update',
    'page.transfer_leads.access',
    'action.transfer_leads.view_call_center'
  )
on conflict (role_id, permission_id) do nothing;
