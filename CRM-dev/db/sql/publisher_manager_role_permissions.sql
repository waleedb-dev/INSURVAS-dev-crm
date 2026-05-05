-- Publisher Manager role + dashboard permissions.
-- Prerequisites: public.roles, public.permissions, public.role_permissions from permissions_module.sql.
-- Safe to run multiple times.

insert into public.roles (key, name, description, is_system)
values (
  'publisher_manager',
  'Publisher Manager',
  'Receives and resolves support tickets raised by call center admins (publisher management).',
  true
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description;

-- Publisher Manager should have access to the Support queue only.
-- The dashboard currently gates Support queue by role (`publisher_manager`) rather than permission keys,
-- so we intentionally clear all permission-key-based access here.
delete from public.role_permissions rp
using public.roles r
where rp.role_id = r.id
  and r.key = 'publisher_manager';
