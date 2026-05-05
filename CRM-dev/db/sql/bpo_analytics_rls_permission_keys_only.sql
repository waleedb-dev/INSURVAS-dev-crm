-- Align analytics RLS with permission keys only (no blanket publisher_manager role).
-- `has_permission` already resolves role_permissions + user_permissions, so sales_manager
-- keeps access from seeds; publisher_managers only see data for keys they were granted.

drop policy if exists daily_deal_flow_select_bpo_analytics on public.daily_deal_flow;

create policy daily_deal_flow_select_bpo_analytics
on public.daily_deal_flow
for select
to authenticated
using (
  public.has_permission('page.bpo_score_board.access')
  or public.has_permission('page.bpo_center_performance.access')
  or public.has_permission('page.center_thresholds.access')
  or public.has_permission('page.colombian_score_board.access')
  or public.has_permission('page.colombian_center_performance.access')
  or public.has_permission('page.colombian_thresholds.access')
);

drop policy if exists center_thresholds_select_bpo_viewers on public.center_thresholds;

create policy center_thresholds_select_bpo_viewers
on public.center_thresholds
for select
to authenticated
using (
  public.has_role('sales_manager')
  or public.has_permission('page.bpo_score_board.access')
  or public.has_permission('page.bpo_center_performance.access')
  or public.has_permission('page.center_thresholds.access')
  or public.has_permission('page.colombian_score_board.access')
  or public.has_permission('page.colombian_center_performance.access')
  or public.has_permission('page.colombian_thresholds.access')
);
