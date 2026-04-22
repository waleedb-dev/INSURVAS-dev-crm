-- BPO analytics page permissions + role mapping (sales_manager, publisher_manager).
-- Run after public.permissions and public.role_permissions exist.
-- Safe to run multiple times.

insert into public.permissions (key, resource, action, description) values
  ('page.bpo_score_board.access', 'bpo_score_board', 'access', 'Can access Score Board'),
  ('page.bpo_center_performance.access', 'bpo_center_performance', 'access', 'Can access Center Performance'),
  ('page.center_thresholds.access', 'center_thresholds', 'access', 'Can access Center Thresholds')
on conflict (key) do update set
  resource = excluded.resource,
  action = excluded.action,
  description = excluded.description,
  is_active = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key in ('sales_manager', 'publisher_manager')
  and p.key in (
    'page.bpo_score_board.access',
    'page.bpo_center_performance.access',
    'page.center_thresholds.access'
  )
on conflict (role_id, permission_id) do nothing;
