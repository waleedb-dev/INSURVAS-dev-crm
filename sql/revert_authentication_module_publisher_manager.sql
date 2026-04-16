-- Revert: Remove publisher_manager user select policy
-- Run this to undo the changes from authentication_module.sql

drop policy if exists users_select_publisher_manager on public.users;
