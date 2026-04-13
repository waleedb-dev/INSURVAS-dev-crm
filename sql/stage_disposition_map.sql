-- Transfer Portal: extra stages (positions 12–16) + disposition map for call-result / reporting.
-- Run after pipelines_and_stages_seed.sql (Transfer Portal positions 1–11 must exist).

insert into public.pipeline_stages (pipeline_id, name, position, show_in_reports)
select p.id, s.name, s.position, true
from public.pipelines p
join (
  values
    ('Transfer Portal', 'GI DQ', 12),
    ('Transfer Portal', 'Fulfilled Carrier Requirement', 13),
    ('Transfer Portal', 'Pending Failed Payment Fix', 14),
    ('Transfer Portal', 'New Submission', 15),
    ('Transfer Portal', 'Chargeback DQ', 16)
) as s(pipeline_name, name, position)
  on p.name = s.pipeline_name
on conflict (pipeline_id, name) do update
set
  position = excluded.position,
  show_in_reports = excluded.show_in_reports,
  updated_at = now();

create table if not exists public.stage_disposition_map (
  id bigserial primary key,
  stage_id bigint not null references public.pipeline_stages (id) on delete cascade,
  disposition text not null,
  created_at timestamptz not null default now(),
  unique (stage_id),
  unique (disposition)
);

comment on table public.stage_disposition_map is 'One-to-one: pipeline_stages.id (Transfer Portal targets below) to canonical disposition label.';

grant select on public.stage_disposition_map to authenticated;
grant usage, select on sequence public.stage_disposition_map_id_seq to authenticated;

alter table public.stage_disposition_map enable row level security;

drop policy if exists stage_disposition_map_select_authenticated on public.stage_disposition_map;
create policy stage_disposition_map_select_authenticated
on public.stage_disposition_map
for select
to authenticated
using (true);

insert into public.stage_disposition_map (stage_id, disposition)
select ps.id, v.disposition
from (values
  ('Needs BPO Callback', 'Needs BPO Callback'),
  ('DQ''d Can''t be sold', 'DQ''d - Can''t Be Sold'),
  ('GI DQ', 'GI DQ'),
  ('Returned To Center - DQ', 'Return to Center - DQ'),
  ('Incomplete Transfer', 'Incomplete Transfer'),
  ('Fulfilled Carrier Requirement', 'Fulfilled Carrier Requirement'),
  ('Pending Failed Payment Fix', 'Failed payment fix'),
  ('New Submission', 'New Submission'),
  ('Chargeback DQ', 'Chargeback DQ')
) as v(stage_name, disposition)
join public.pipelines p on p.name = 'Transfer Portal'
join public.pipeline_stages ps on ps.pipeline_id = p.id and ps.name = v.stage_name
on conflict (stage_id) do update
set disposition = excluded.disposition;
