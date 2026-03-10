-- Supabase Auth module teardown script
-- Drops objects created by sql/authentication_module_schema.sql
-- Run carefully in non-production first.

-- 1) Policies
DROP POLICY IF EXISTS user_roles_write_admin_hr ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_admin_hr ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
DROP POLICY IF EXISTS roles_select_all_authenticated ON public.roles;
DROP POLICY IF EXISTS users_update_admin_hr ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;
DROP POLICY IF EXISTS users_select_admin_hr ON public.users;
DROP POLICY IF EXISTS users_select_own ON public.users;

-- 2) Triggers
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;

-- 3) Functions
DROP FUNCTION IF EXISTS public.has_any_role(text[]);
DROP FUNCTION IF EXISTS public.has_role(text);
DROP FUNCTION IF EXISTS public.is_active_user(uuid);
DROP FUNCTION IF EXISTS public.set_updated_at();

-- 4) Tables (children first)
-- Break circular/legacy FK dependencies first
ALTER TABLE IF EXISTS public.sales_teams
  DROP CONSTRAINT IF EXISTS sales_teams_manager_user_id_fkey;

ALTER TABLE IF EXISTS public.users
  DROP CONSTRAINT IF EXISTS users_call_center_id_fkey;

ALTER TABLE IF EXISTS public.users
  DROP CONSTRAINT IF EXISTS users_sales_team_id_fkey;

-- Legacy table from earlier draft (if present)
DROP TABLE IF EXISTS public.auth_audit_logs;

DROP TABLE IF EXISTS public.user_permissions;
DROP TABLE IF EXISTS public.role_permissions;
DROP TABLE IF EXISTS public.user_roles;
DROP TABLE IF EXISTS public.permissions;
DROP TABLE IF EXISTS public.roles;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.sales_teams;
DROP TABLE IF EXISTS public.call_centers;

-- Note:
-- This does not drop Supabase-managed auth.users.
-- It only drops public schema objects for this auth module.
