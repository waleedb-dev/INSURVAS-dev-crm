-- FULL CLEAN SWIPE (DESTRUCTIVE)
-- Drops and recreates the public schema.
-- Run only when you intentionally want to wipe all app data/objects in public.

drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant create on schema public to postgres, service_role;

alter default privileges in schema public
grant all on tables to postgres, service_role;

alter default privileges in schema public
grant all on sequences to postgres, service_role;

alter default privileges in schema public
grant all on functions to postgres, service_role;

