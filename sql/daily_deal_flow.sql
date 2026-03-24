-- Daily Deal Flow: one row each time a lead is submitted into the flow (from transfer / BPO intake).
-- Surfaced on the Daily Deal Flow dashboard: date, lead id, name, center.

create table if not exists public.daily_deal_flow (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  flow_date date not null default (timezone('utc', now())::date),
  lead_id uuid not null references public.leads (id) on delete cascade,
  lead_unique_id text,
  lead_name text not null,
  center_name text,
  call_center_id uuid references public.call_centers (id) on delete set null
);

create index if not exists daily_deal_flow_flow_date_idx on public.daily_deal_flow (flow_date desc);
create index if not exists daily_deal_flow_lead_id_idx on public.daily_deal_flow (lead_id);

grant select, insert, update, delete on public.daily_deal_flow to authenticated;

alter table public.daily_deal_flow enable row level security;

drop policy if exists daily_deal_flow_select_authenticated on public.daily_deal_flow;
create policy daily_deal_flow_select_authenticated
on public.daily_deal_flow
for select
to authenticated
using (true);

drop policy if exists daily_deal_flow_insert_authenticated on public.daily_deal_flow;
create policy daily_deal_flow_insert_authenticated
on public.daily_deal_flow
for insert
to authenticated
with check (true);

drop policy if exists daily_deal_flow_update_authenticated on public.daily_deal_flow;
create policy daily_deal_flow_update_authenticated
on public.daily_deal_flow
for update
to authenticated
using (true)
with check (true);

drop policy if exists daily_deal_flow_delete_authenticated on public.daily_deal_flow;
create policy daily_deal_flow_delete_authenticated
on public.daily_deal_flow
for delete
to authenticated
using (true);
