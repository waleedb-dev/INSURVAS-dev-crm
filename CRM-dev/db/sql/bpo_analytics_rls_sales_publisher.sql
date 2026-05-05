-- BPO and Colombian analytics dashboards: allow read paths for users who hold the
-- corresponding `page.*.access` permission (via role_permissions or user_permissions),
-- plus sales_manager on center_thresholds for backwards compatibility with existing seeds.
--
-- Prerequisite: public.has_permission, public.has_role (from permissions_module.sql +
-- authentication_module.sql).
--
-- Safe to run multiple times.

-- ── daily_deal_flow: SELECT ─────────────────────────────────────────────────

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

-- ── center_thresholds: SELECT ───────────────────────────────────────────────
-- Existing write policies are system_admin-only in center_thresholds.sql.

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

-- INSERT/UPDATE/DELETE on center_thresholds remain system_admin-only in
-- center_thresholds.sql. Non-admins get read-only threshold data for dashboards.
