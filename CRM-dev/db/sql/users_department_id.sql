-- Link users (e.g. Publisher Manager) to a department.
-- Prerequisite: public.departments from departments_module.sql.

alter table public.users
  add column if not exists department_id uuid references public.departments (id) on delete set null;

create index if not exists idx_users_department_id on public.users (department_id);

comment on column public.users.department_id is
  'Department for publisher_manager and related roles (publisher management).';
