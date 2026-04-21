-- BPO Score Board / Center Performance / Center Thresholds: allow read paths for
-- sales_manager and publisher_manager (and users granted the page.*.access keys).
--
-- Prerequisite: public.has_permission, public.has_role, public.has_any_role
-- (from permissions_module.sql + authentication_module.sql).
--
-- Safe to run multiple times.

-- ── daily_deal_flow: SELECT ─────────────────────────────────────────────────
-- publisher_manager is not included in daily_deal_flow_select_global; anyone with
-- the BPO page permission keys should also be able to read aggregates.

drop policy if exists daily_deal_flow_select_bpo_analytics on public.daily_deal_flow;

create policy daily_deal_flow_select_bpo_analytics
on public.daily_deal_flow
for select
to authenticated
using (
  public.has_role('publisher_manager')
  or public.has_permission('page.bpo_score_board.access')
  or public.has_permission('page.bpo_center_performance.access')
  or public.has_permission('page.center_thresholds.access')
);

-- ── center_thresholds: SELECT ───────────────────────────────────────────────
-- Existing policies are system_admin-only; Centre Performance needs thresholds
-- for every active centre when building cards.

drop policy if exists center_thresholds_select_bpo_viewers on public.center_thresholds;

create policy center_thresholds_select_bpo_viewers
on public.center_thresholds
for select
to authenticated
using (
  public.has_any_role(array['sales_manager', 'publisher_manager'])
  or public.has_permission('page.bpo_score_board.access')
  or public.has_permission('page.bpo_center_performance.access')
  or public.has_permission('page.center_thresholds.access')
);

-- INSERT/UPDATE/DELETE on center_thresholds remain system_admin-only in
-- center_thresholds.sql. Non-admins get read-only threshold data for dashboards.
