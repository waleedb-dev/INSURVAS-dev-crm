-- Disposition wizard: config tables + note templates + audit events + call_results columns.
-- Meaningful keys (flow_key, node_key, option_key, template_key) separate from display labels.

-- ---------------------------------------------------------------------------
-- Note templates (referenced by template_key string from options / node metadata)
-- ---------------------------------------------------------------------------
create table if not exists public.disposition_note_templates (
  template_key text primary key,
  template_body text not null,
  append_manual_to_final boolean not null default false,
  description text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- One flow per pipeline stage name (Transfer Portal disposition / stage name)
-- ---------------------------------------------------------------------------
create table if not exists public.disposition_flows (
  id bigserial primary key,
  flow_key text not null unique,
  pipeline_stage_name text not null,
  flow_label text not null,
  root_node_key text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipeline_stage_name, flow_key)
);

create index if not exists idx_disposition_flows_stage on public.disposition_flows (pipeline_stage_name)
where is_active = true;

-- ---------------------------------------------------------------------------
-- Wizard nodes (choice | carrier_multi | text)
-- ---------------------------------------------------------------------------
create table if not exists public.disposition_flow_nodes (
  id bigserial primary key,
  flow_id bigint not null references public.disposition_flows (id) on delete cascade,
  node_key text not null,
  node_type text not null check (node_type = any (array['choice'::text, 'carrier_multi'::text, 'text'::text])),
  node_label text not null,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique (flow_id, node_key)
);

create index if not exists idx_disposition_flow_nodes_flow on public.disposition_flow_nodes (flow_id);

-- ---------------------------------------------------------------------------
-- Options for choice nodes (terminal when next_node_key is null)
-- ---------------------------------------------------------------------------
create table if not exists public.disposition_flow_options (
  id bigserial primary key,
  node_id bigint not null references public.disposition_flow_nodes (id) on delete cascade,
  option_key text not null,
  option_label text not null,
  sort_order integer not null default 0,
  next_node_key text,
  template_key text,
  quick_tag_label text,
  requires_manual_note boolean not null default false,
  unique (node_id, option_key)
);

-- ---------------------------------------------------------------------------
-- Audit trail per save (optional history)
-- ---------------------------------------------------------------------------
create table if not exists public.disposition_events (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null,
  lead_id uuid not null references public.leads (id) on delete cascade,
  flow_key text not null,
  path_json jsonb not null default '[]'::jsonb,
  generated_note text,
  manual_note text,
  final_note text,
  quick_tag_label text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_disposition_events_lead on public.disposition_events (lead_id);
create index if not exists idx_disposition_events_submission on public.disposition_events (submission_id);

-- ---------------------------------------------------------------------------
-- call_results: structured disposition + notes split
-- ---------------------------------------------------------------------------
alter table public.call_results
  add column if not exists disposition_path jsonb,
  add column if not exists generated_note text,
  add column if not exists manual_note text,
  add column if not exists quick_disposition_tag text;

-- ---------------------------------------------------------------------------
-- Grants + RLS (aligned with call_results: authenticated CRM users)
-- ---------------------------------------------------------------------------
grant select on public.disposition_note_templates to authenticated;
grant select on public.disposition_flows to authenticated;
grant select on public.disposition_flow_nodes to authenticated;
grant select on public.disposition_flow_options to authenticated;
grant select, insert on public.disposition_events to authenticated;

alter table public.disposition_note_templates enable row level security;
alter table public.disposition_flows enable row level security;
alter table public.disposition_flow_nodes enable row level security;
alter table public.disposition_flow_options enable row level security;
alter table public.disposition_events enable row level security;

drop policy if exists disposition_note_templates_select on public.disposition_note_templates;
create policy disposition_note_templates_select
on public.disposition_note_templates for select to authenticated using (true);

drop policy if exists disposition_flows_select on public.disposition_flows;
create policy disposition_flows_select
on public.disposition_flows for select to authenticated using (true);

drop policy if exists disposition_flow_nodes_select on public.disposition_flow_nodes;
create policy disposition_flow_nodes_select
on public.disposition_flow_nodes for select to authenticated using (true);

drop policy if exists disposition_flow_options_select on public.disposition_flow_options;
create policy disposition_flow_options_select
on public.disposition_flow_options for select to authenticated using (true);

drop policy if exists disposition_events_insert on public.disposition_events;
create policy disposition_events_insert
on public.disposition_events for insert to authenticated with check (true);

drop policy if exists disposition_events_select on public.disposition_events;
create policy disposition_events_select
on public.disposition_events for select to authenticated using (true);
