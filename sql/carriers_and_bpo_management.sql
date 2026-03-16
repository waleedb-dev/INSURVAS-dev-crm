-- Carrier Management
create table if not exists public.carriers (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_carriers_updated_at on public.carriers;
create trigger trg_carriers_updated_at
before update on public.carriers
for each row execute function public.set_updated_at();

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.carriers to authenticated;
grant usage, select on sequence public.carriers_id_seq to authenticated;

alter table public.carriers enable row level security;

drop policy if exists carriers_select_system_admin on public.carriers;
create policy carriers_select_system_admin
on public.carriers
for select
to authenticated
using (public.has_role('system_admin'));

drop policy if exists carriers_insert_system_admin on public.carriers;
create policy carriers_insert_system_admin
on public.carriers
for insert
to authenticated
with check (public.has_role('system_admin'));

drop policy if exists carriers_update_system_admin on public.carriers;
create policy carriers_update_system_admin
on public.carriers
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));

drop policy if exists carriers_delete_system_admin on public.carriers;
create policy carriers_delete_system_admin
on public.carriers
for delete
to authenticated
using (public.has_role('system_admin'));

-- BPO Centres / Call Centers browser access for system admin
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.call_centers to authenticated;

alter table public.call_centers enable row level security;

drop policy if exists call_centers_select_system_admin on public.call_centers;
create policy call_centers_select_system_admin
on public.call_centers
for select
to authenticated
using (public.has_role('system_admin'));

drop policy if exists call_centers_insert_system_admin on public.call_centers;
create policy call_centers_insert_system_admin
on public.call_centers
for insert
to authenticated
with check (public.has_role('system_admin'));

drop policy if exists call_centers_update_system_admin on public.call_centers;
create policy call_centers_update_system_admin
on public.call_centers
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));

drop policy if exists call_centers_delete_system_admin on public.call_centers;
create policy call_centers_delete_system_admin
on public.call_centers
for delete
to authenticated
using (public.has_role('system_admin'));
