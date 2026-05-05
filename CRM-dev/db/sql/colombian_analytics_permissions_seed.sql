-- Colombian analytics page permissions + role mapping (sales_manager).
-- Publisher managers do not receive these via role; assign `user_permissions` per user when needed.
-- Run after public.permissions and public.role_permissions exist.
-- Safe to run multiple times.

insert into public.permissions (key, resource, action, description) values
  ('page.colombian_score_board.access', 'colombian_score_board', 'access', 'Can access Colombian Score Board'),
  ('page.colombian_center_performance.access', 'colombian_center_performance', 'access', 'Can access Colombian Center Performance'),
  ('page.colombian_thresholds.access', 'colombian_thresholds', 'access', 'Can access Colombian Thresholds')
on conflict (key) do update set
  resource = excluded.resource,
  action = excluded.action,
  description = excluded.description,
  is_active = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key in ('sales_manager')
  and p.key in (
    'page.colombian_score_board.access',
    'page.colombian_center_performance.access',
    'page.colombian_thresholds.access'
  )
on conflict (role_id, permission_id) do nothing;
