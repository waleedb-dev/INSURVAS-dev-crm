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

-- Carrier Products
create table if not exists public.products (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.carrier_products (
  carrier_id bigint not null references public.carriers(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (carrier_id, product_id)
);

create index if not exists idx_carrier_products_carrier_id on public.carrier_products(carrier_id);
create index if not exists idx_carrier_products_product_id on public.carrier_products(product_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.carrier_products to authenticated;
grant usage, select on sequence public.products_id_seq to authenticated;

alter table public.products enable row level security;
alter table public.carrier_products enable row level security;

drop policy if exists products_select_system_admin on public.products;
create policy products_select_system_admin
on public.products
for select
to authenticated
using (public.has_role('system_admin'));

drop policy if exists products_insert_system_admin on public.products;
create policy products_insert_system_admin
on public.products
for insert
to authenticated
with check (public.has_role('system_admin'));

drop policy if exists products_update_system_admin on public.products;
create policy products_update_system_admin
on public.products
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));

drop policy if exists products_delete_system_admin on public.products;
create policy products_delete_system_admin
on public.products
for delete
to authenticated
using (public.has_role('system_admin'));

drop policy if exists carrier_products_select_system_admin on public.carrier_products;
create policy carrier_products_select_system_admin
on public.carrier_products
for select
to authenticated
using (public.has_role('system_admin'));

drop policy if exists carrier_products_insert_system_admin on public.carrier_products;
create policy carrier_products_insert_system_admin
on public.carrier_products
for insert
to authenticated
with check (public.has_role('system_admin'));

drop policy if exists carrier_products_update_system_admin on public.carrier_products;
create policy carrier_products_update_system_admin
on public.carrier_products
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));

drop policy if exists carrier_products_delete_system_admin on public.carrier_products;
create policy carrier_products_delete_system_admin
on public.carrier_products
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

-- Carrier Additional Information (Requirements, Authorization Format, Limitations)
create table if not exists public.carrier_info (
  id bigserial primary key,
  carrier_id bigint not null references public.carriers(id) on delete cascade,
  group_type text not null check (group_type in ('Carrier Requirements', 'Authorization Format', 'Limitations', 'Information')),
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_carrier_info_carrier_id on public.carrier_info(carrier_id);
create index if not exists idx_carrier_info_group_type on public.carrier_info(group_type);

drop trigger if exists trg_carrier_info_updated_at on public.carrier_info;
create trigger trg_carrier_info_updated_at
before update on public.carrier_info
for each row execute function public.set_updated_at();

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.carrier_info to authenticated;
grant usage, select on sequence public.carrier_info_id_seq to authenticated;

alter table public.carrier_info enable row level security;

drop policy if exists carrier_info_select_system_admin on public.carrier_info;
create policy carrier_info_select_system_admin
on public.carrier_info
for select
to authenticated
using (public.has_role('system_admin'));

drop policy if exists carrier_info_insert_system_admin on public.carrier_info;
create policy carrier_info_insert_system_admin
on public.carrier_info
for insert
to authenticated
with check (public.has_role('system_admin'));

drop policy if exists carrier_info_update_system_admin on public.carrier_info;
create policy carrier_info_update_system_admin
on public.carrier_info
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));

drop policy if exists carrier_info_delete_system_admin on public.carrier_info;
create policy carrier_info_delete_system_admin
on public.carrier_info
for delete
to authenticated
using (public.has_role('system_admin'));
