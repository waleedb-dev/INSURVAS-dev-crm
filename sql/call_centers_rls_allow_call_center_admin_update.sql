-- Allow call center admins to read and update call centers.
-- Existing system_admin policies remain in place.

drop policy if exists call_centers_select_call_center_admin on public.call_centers;
create policy call_centers_select_call_center_admin
on public.call_centers
for select
to authenticated
using (public.has_role('call_center_admin'));

drop policy if exists call_centers_update_call_center_admin on public.call_centers;
create policy call_centers_update_call_center_admin
on public.call_centers
for update
to authenticated
using (public.has_role('call_center_admin'))
with check (public.has_role('call_center_admin'));
