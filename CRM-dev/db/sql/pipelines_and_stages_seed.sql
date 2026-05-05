-- Pipelines
create table if not exists public.pipelines (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pipeline stages
create table if not exists public.pipeline_stages (
  id bigserial primary key,
  pipeline_id bigint not null references public.pipelines(id) on delete cascade,
  name text not null,
  position integer not null,
  show_in_reports boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipeline_id, name),
  unique (pipeline_id, position)
);

-- Grants for browser client access
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.pipelines to authenticated;
grant select, insert, update, delete on public.pipeline_stages to authenticated;
grant usage, select on sequence public.pipelines_id_seq to authenticated;
grant usage, select on sequence public.pipeline_stages_id_seq to authenticated;

-- RLS policies for browser client access
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;

drop policy if exists pipelines_select_all_authenticated on public.pipelines;
create policy pipelines_select_all_authenticated
on public.pipelines
for select
to authenticated
using (true);

drop policy if exists pipelines_insert_all_authenticated on public.pipelines;
create policy pipelines_insert_all_authenticated
on public.pipelines
for insert
to authenticated
with check (true);

drop policy if exists pipelines_update_all_authenticated on public.pipelines;
create policy pipelines_update_all_authenticated
on public.pipelines
for update
to authenticated
using (true)
with check (true);

drop policy if exists pipelines_delete_all_authenticated on public.pipelines;
create policy pipelines_delete_all_authenticated
on public.pipelines
for delete
to authenticated
using (true);

drop policy if exists pipeline_stages_select_all_authenticated on public.pipeline_stages;
create policy pipeline_stages_select_all_authenticated
on public.pipeline_stages
for select
to authenticated
using (true);

drop policy if exists pipeline_stages_insert_all_authenticated on public.pipeline_stages;
create policy pipeline_stages_insert_all_authenticated
on public.pipeline_stages
for insert
to authenticated
with check (true);

drop policy if exists pipeline_stages_update_all_authenticated on public.pipeline_stages;
create policy pipeline_stages_update_all_authenticated
on public.pipeline_stages
for update
to authenticated
using (true)
with check (true);

drop policy if exists pipeline_stages_delete_all_authenticated on public.pipeline_stages;
create policy pipeline_stages_delete_all_authenticated
on public.pipeline_stages
for delete
to authenticated
using (true);

-- Seed pipelines
insert into public.pipelines (name)
values
  ('Chargeback Pipeline'),
  ('Customer Pipeline'),
  ('Marketing Pipeline'),
  ('Transfer Portal')
on conflict (name) do update
set updated_at = now();

-- Seed stages
insert into public.pipeline_stages (pipeline_id, name, position, show_in_reports)
select p.id, s.name, s.position, true
from public.pipelines p
join (
  values
    -- Chargeback Pipeline
    ('Chargeback Pipeline', 'FDPF Pending Reason', 1),
    ('Chargeback Pipeline', 'FDPF Insufficient Funds', 2),
    ('Chargeback Pipeline', 'FDPF Incorrect Banking Info', 3),
    ('Chargeback Pipeline', 'FDPF Unauthorized Draft', 4),
    ('Chargeback Pipeline', 'Pending Failed Payment Fix', 5),
    ('Chargeback Pipeline', 'Pending Lapse', 6),
    ('Chargeback Pipeline', 'Chargeback Failed Payment', 7),
    ('Chargeback Pipeline', 'Chargeback Cancellation', 8),
    ('Chargeback Pipeline', 'Pending Chargeback Fix', 9),
    ('Chargeback Pipeline', 'Chargeback Fixed', 10),
    ('Chargeback Pipeline', 'Chargeback DQ', 11),

    -- Customer Pipeline
    ('Customer Pipeline', 'Issued - Pending First Draft', 1),
    ('Customer Pipeline', 'Premium Paid - Commission Pending', 2),
    ('Customer Pipeline', 'ACTIVE PLACED - Paid as Earned', 3),
    ('Customer Pipeline', 'ACTIVE PLACED - Paid as Advanced', 4),
    ('Customer Pipeline', 'ACTIVE - 3 Months +', 5),
    ('Customer Pipeline', 'ACTIVE - 6 months +', 6),
    ('Customer Pipeline', 'ACTIVE - 9 months', 7),
    ('Customer Pipeline', 'ACTIVE - Past Charge-Back Period', 8),

    -- Marketing Pipeline
    ('Marketing Pipeline', 'Form API', 1),
    ('Marketing Pipeline', 'Call API', 2),
    ('Marketing Pipeline', 'No Pickup - Needs Connection', 3),
    ('Marketing Pipeline', 'Pickup - Needs Call Back', 4),
    ('Marketing Pipeline', 'Qualified - Needs Conversion', 5),
    ('Marketing Pipeline', 'Disqualified - Don''t Call', 6),
    ('Marketing Pipeline', 'Transferred - Don''t Touch', 7),

    -- Transfer Portal
    ('Transfer Portal', 'Transfer API', 1),
    ('Transfer Portal', 'Chargeback Fix API', 2),
    ('Transfer Portal', 'Incomplete Transfer', 3),
    ('Transfer Portal', 'Returned To Center - DQ', 4),
    ('Transfer Portal', 'Previously Sold BPO', 5),
    ('Transfer Portal', 'DQ''d Can''t be sold', 6),
    ('Transfer Portal', 'Needs BPO Callback', 7),
    ('Transfer Portal', 'Application Withdrawn', 8),
    ('Transfer Portal', 'Declined Underwriting', 9),
    ('Transfer Portal', 'Pending Approval', 10),
    ('Transfer Portal', 'Pending Manual Action', 11),
    ('Transfer Portal', 'GI DQ', 12),
    ('Transfer Portal', 'Fulfilled Carrier Requirement', 13),
    ('Transfer Portal', 'Pending Failed Payment Fix', 14),
    ('Transfer Portal', 'New Submission', 15),
    ('Transfer Portal', 'Chargeback DQ', 16)
) as s(pipeline_name, name, position)
  on s.pipeline_name = p.name
on conflict (pipeline_id, name) do update
set
  position = excluded.position,
  show_in_reports = excluded.show_in_reports,
  updated_at = now();
