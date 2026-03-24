-- Grant pipeline edit (Quick Edit, drag-drop stage) to call center roles that already have page.lead_pipeline.access.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key in ('call_center_admin', 'call_center_agent')
  and p.key = 'action.lead_pipeline.update'
on conflict (role_id, permission_id) do nothing;
