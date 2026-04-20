-- Allow authenticated users to read active users for dropdowns
-- This is needed for Daily Deal Flow agent dropdowns

drop policy if exists users_select_active_authenticated on public.users;
create policy users_select_active_authenticated
on public.users
for select
to authenticated
using (status = 'active');
