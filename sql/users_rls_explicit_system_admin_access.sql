-- Explicit fallback policies for system_admin on users.
-- Keeps existing policies and adds direct checks via has_role().

drop policy if exists users_select_system_admin_explicit on public.users;
create policy users_select_system_admin_explicit
on public.users
for select
to authenticated
using (public.has_role('system_admin'));

drop policy if exists users_update_system_admin_explicit on public.users;
create policy users_update_system_admin_explicit
on public.users
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));
