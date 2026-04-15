-- Departments (publisher-management scope). Prerequisite: public.users exists.
-- Run after authentication_module.sql. Safe to run multiple times.

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  publisher_manager_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.departments.publisher_manager_user_id is
  'User (Publisher Manager role) who receives new tickets for this department.';

comment on table public.departments is
  'Publisher-management departments. For now one row: all new tickets assign to publisher_manager_user_id.';

drop trigger if exists trg_departments_updated_at on public.departments;
create trigger trg_departments_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

create index if not exists departments_publisher_manager_user_id_idx
  on public.departments (publisher_manager_user_id);

alter table public.departments enable row level security;

drop policy if exists departments_select_authenticated on public.departments;
create policy departments_select_authenticated
on public.departments
for select
to authenticated
using (true);

drop policy if exists departments_write_system_admin on public.departments;
create policy departments_write_system_admin
on public.departments
for all
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));

grant select on public.departments to authenticated;

-- One department for publisher management (assign publisher_manager_user_id via admin / SQL when ready).
insert into public.departments (name, publisher_manager_user_id)
select 'publisher management', null
where not exists (select 1 from public.departments);

-- Rename legacy seed row from earlier migrations.
update public.departments
set name = 'publisher management'
where lower(trim(name)) = 'default';
