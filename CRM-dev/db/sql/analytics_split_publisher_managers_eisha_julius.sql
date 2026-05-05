-- Split BPO vs Colombian analytics for publisher_manager users who need different menus.
-- App gates with `canAccessPage` + `user_permissions` / `role_permissions` (see lib/auth/permissions.ts).
--
-- After this:
--   eisha.m@unlimitedinsurance.io     → Score Board, Center Performance, Center Thresholds (US BPO)
--   julio.m@unlimitedinsurance.io     → Colombian Score Board, Performance, Thresholds only
--   publisher.manager.dev@insurvas.local → all six (local dev convenience)

-- 1) Stop granting all analytics to every publisher_manager via role (per-user control below).
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.key = 'publisher_manager'
  and p.key in (
    'page.bpo_score_board.access',
    'page.bpo_center_performance.access',
    'page.center_thresholds.access',
    'page.colombian_score_board.access',
    'page.colombian_center_performance.access',
    'page.colombian_thresholds.access'
  );

-- 2) Clear any overlapping user rows from earlier experiments
delete from public.user_permissions up
using public.users u, public.permissions p
where up.user_id = u.id
  and up.permission_id = p.id
  and u.email = 'eisha.m@unlimitedinsurance.io'
  and p.key in (
    'page.colombian_score_board.access',
    'page.colombian_center_performance.access',
    'page.colombian_thresholds.access'
  );

delete from public.user_permissions up
using public.users u, public.permissions p
where up.user_id = u.id
  and up.permission_id = p.id
  and u.email = 'julio.m@unlimitedinsurance.io'
  and p.key in (
    'page.bpo_score_board.access',
    'page.bpo_center_performance.access',
    'page.center_thresholds.access'
  );

-- 3) Eisha — BPO analytics only
insert into public.user_permissions (user_id, permission_id)
select u.id, p.id
from public.users u
cross join public.permissions p
where u.email = 'eisha.m@unlimitedinsurance.io'
  and p.key in (
    'page.bpo_score_board.access',
    'page.bpo_center_performance.access',
    'page.center_thresholds.access'
  )
on conflict (user_id, permission_id) do nothing;

-- 4) Julius (account email julio.m@…) — Colombian analytics only
insert into public.user_permissions (user_id, permission_id)
select u.id, p.id
from public.users u
cross join public.permissions p
where u.email = 'julio.m@unlimitedinsurance.io'
  and p.key in (
    'page.colombian_score_board.access',
    'page.colombian_center_performance.access',
    'page.colombian_thresholds.access'
  )
on conflict (user_id, permission_id) do nothing;

-- 5) Dev publisher manager — keep full analytics locally
insert into public.user_permissions (user_id, permission_id)
select u.id, p.id
from public.users u
cross join public.permissions p
where u.email = 'publisher.manager.dev@insurvas.local'
  and p.key in (
    'page.bpo_score_board.access',
    'page.bpo_center_performance.access',
    'page.center_thresholds.access',
    'page.colombian_score_board.access',
    'page.colombian_center_performance.access',
    'page.colombian_thresholds.access'
  )
on conflict (user_id, permission_id) do nothing;
