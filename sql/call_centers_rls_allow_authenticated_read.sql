-- Allow all authenticated users to read call centers (needed for slack channel lookup)
drop policy if exists call_centers_select_authenticated on public.call_centers;
create policy call_centers_select_authenticated
on public.call_centers
for select
to authenticated
using (true);
