-- DEBUG: Run this as your logged-in user (or substitute your user UUID)
-- Check your role and call center

select 
  u.id,
  u.full_name,
  u.call_center_id,
  r.key as role_key,
  r.name as role_name,
  cc.name as call_center_name,
  cc.country
from public.users u
left join public.roles r on r.id = u.role_id
left join public.call_centers cc on cc.id = u.call_center_id
where u.id = auth.uid();  -- Run this from the Supabase SQL Editor while logged in

-- Also verify has_role exists and what it returns
select public.has_role('call_center_admin') as has_cc_admin,
       public.has_role('system_admin') as has_sys_admin;
