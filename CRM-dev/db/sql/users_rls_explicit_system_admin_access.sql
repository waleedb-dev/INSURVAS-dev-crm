-- Cleanup: these explicit policies are now redundant.
-- system_admin SELECT is covered by users_select_system_admin_all in authentication_module.sql.
-- system_admin UPDATE is covered by users_update_admin_hr in authentication_module.sql.
drop policy if exists users_select_system_admin_explicit on public.users;
drop policy if exists users_update_system_admin_explicit on public.users;
