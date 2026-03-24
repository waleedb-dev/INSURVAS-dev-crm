-- Backfill public.daily_deal_flow from existing public.leads
-- -----------------------------------------------------------------------------
-- Run once in Supabase SQL Editor (or psql as a role that bypasses RLS, e.g. postgres).
-- Inserts one row per lead that does not already appear in daily_deal_flow (matched on lead_id).
--
-- Mapping:
--   flow_date  = UTC date of lead.created_at
--   created_at = lead.created_at (keeps sort order aligned with when the lead was created)
--   lead_id, lead_unique_id, lead_name, call_center_id from leads
--   center_name from call_centers.name when call_center_id is set
--
-- Optional: restrict to BPO / transfer pipeline only — uncomment the line in the WHERE clause.

with inserted as (
  insert into public.daily_deal_flow (
    created_at,
    flow_date,
    lead_id,
    lead_unique_id,
    lead_name,
    center_name,
    call_center_id
  )
  select
    l.created_at,
    (timezone('utc', l.created_at))::date,
    l.id,
    l.lead_unique_id,
    coalesce(
      nullif(trim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, '')), ''),
      'Unnamed lead'
    ),
    cc.name,
    l.call_center_id
  from public.leads l
  left join public.call_centers cc on cc.id = l.call_center_id
  where coalesce(l.is_draft, false) = false
    and not exists (
      select 1
      from public.daily_deal_flow d
      where d.lead_id = l.id
    )
    -- Uncomment the next line to only backfill Transfer / BPO intake leads (matches app insert behavior):
    -- and coalesce(l.pipeline, '') = 'Transfer Portal'
  returning id
)
select count(*)::bigint as backfilled_rows
from inserted;
