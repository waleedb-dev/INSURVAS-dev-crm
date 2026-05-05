-- Backfill daily_deal_flow.lead_vendor from call_center_id -> call_centers.name
-- Keeps legacy values only when call_center_id is null or center lookup is missing.

update public.daily_deal_flow ddf
set
  lead_vendor = cc.name,
  updated_at = now()
from public.call_centers cc
where ddf.call_center_id = cc.id
  and (
    ddf.lead_vendor is distinct from cc.name
    or ddf.lead_vendor is null
  );
