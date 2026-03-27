-- Add transfer lead edit/delete permission and grant to non–call-center roles that manage transfer leads.
-- Safe to run multiple times (idempotent inserts).

insert into public.permissions (key, resource, action, description) values
  ('action.transfer_leads.edit', 'transfer_leads', 'edit', 'Can edit or delete existing transfer lead records (intake form and lead view)')
on conflict (key) do update
set
  resource = excluded.resource,
  action = excluded.action,
  description = excluded.description,
  is_active = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key in (
    'system_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed'
  )
  and p.key = 'action.transfer_leads.edit'
on conflict (role_id, permission_id) do nothing;
