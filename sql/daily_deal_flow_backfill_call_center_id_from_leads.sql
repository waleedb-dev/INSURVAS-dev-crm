-- Populate missing daily_deal_flow.call_center_id from leads via submission_id,
-- then align lead_vendor to call_centers.name.

update public.daily_deal_flow ddf
set
  call_center_id = l.call_center_id,
  updated_at = now()
from public.leads l
where ddf.submission_id = l.submission_id
  and ddf.call_center_id is null
  and l.call_center_id is not null;

update public.daily_deal_flow ddf
set
  lead_vendor = cc.name,
  updated_at = now()
from public.call_centers cc
where ddf.call_center_id = cc.id
  and ddf.lead_vendor is distinct from cc.name;
