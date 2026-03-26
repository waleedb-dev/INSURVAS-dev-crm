-- Cleanup ALL leads + related verification/call-flow data.
-- This script targets every row in public.leads by default.
--
-- Safety pattern:
-- 1) Run the PREVIEW queries first.
-- 2) Run the DELETE transaction.
-- 3) Verify counts, then COMMIT. Otherwise ROLLBACK.
--
-- Optional: If you want partial cleanup, add a WHERE clause in each target_leads CTE.
-- Example:
--   where l.created_at < now() - interval '90 days'
-- or
--   where lower(coalesce(l.lead_source, '')) like '%monday%'

-- =========================================================
-- PREVIEW (no deletes)
-- =========================================================
with target_leads as (
  select l.id, l.submission_id
  from public.leads l
)
select
  (select count(*) from target_leads) as lead_rows,
  (select count(*) from public.verification_sessions vs join target_leads t on t.submission_id = vs.submission_id) as verification_sessions_rows,
  (select count(*) from public.verification_items vi join public.verification_sessions vs on vs.id = vi.session_id join target_leads t on t.submission_id = vs.submission_id) as verification_items_rows,
  (select count(*) from public.call_results cr join target_leads t on t.id = cr.lead_id or t.submission_id = cr.submission_id) as call_results_rows,
  (select count(*) from public.call_update_logs cul join target_leads t on t.id = cul.lead_id or t.submission_id = cul.submission_id) as call_update_logs_rows,
  (select count(*) from public.app_fix_tasks aft join target_leads t on t.id = aft.lead_id or t.submission_id = aft.submission_id) as app_fix_tasks_rows,
  (select count(*) from public.app_fix_banking_updates afbu join target_leads t on t.id = afbu.lead_id or t.submission_id = afbu.submission_id) as app_fix_banking_updates_rows,
  (select count(*) from public.app_fix_carrier_requirements afcr join target_leads t on t.id = afcr.lead_id or t.submission_id = afcr.submission_id) as app_fix_carrier_requirements_rows,
  (select count(*) from public.daily_deal_flow ddf join target_leads t on t.submission_id = ddf.submission_id) as daily_deal_flow_rows,
  (select count(*) from public.lead_notes ln join target_leads t on t.id = ln.lead_id) as lead_notes_rows;

-- =========================================================
-- DELETE TRANSACTION
-- =========================================================
begin;

with target_leads as (
  select l.id, l.submission_id
  from public.leads l
)
delete from public.daily_deal_flow ddf
using target_leads t
where ddf.submission_id = t.submission_id;

with target_leads as (
  select l.id, l.submission_id
  from public.leads l
)
delete from public.verification_sessions vs
using target_leads t
where vs.submission_id = t.submission_id;

with target_leads as (
  select l.id, l.submission_id
  from public.leads l
)
delete from public.call_update_logs cul
using target_leads t
where cul.lead_id = t.id
   or cul.submission_id = t.submission_id;

with target_leads as (
  select l.id, l.submission_id
  from public.leads l
)
delete from public.call_results cr
using target_leads t
where cr.lead_id = t.id
   or cr.submission_id = t.submission_id;

with target_leads as (
  select l.id, l.submission_id
  from public.leads l
)
delete from public.app_fix_tasks aft
using target_leads t
where aft.lead_id = t.id
   or aft.submission_id = t.submission_id;

with target_leads as (
  select l.id, l.submission_id
  from public.leads l
)
delete from public.leads l
using target_leads t
where l.id = t.id;

-- verify remaining leads in this txn
select count(*) as remaining_leads
from public.leads;

-- choose one:
-- commit;
rollback;
