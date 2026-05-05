-- Idempotent seed: DQ'd Can't be sold disposition wizard (Supabase-driven).
-- pipeline_stage_name must match pipeline_stages.name (see stage_disposition_map.sql).
-- Uses dollar-quoting so apostrophes in stage names do not need doubling.

insert into public.disposition_note_templates (template_key, template_body, description)
values
  (
    'dq_cbs_tcpa_litigator',
    '{{client_name}} — TCPA litigator.',
    'DQ cannot be sold - TCPA litigator'
  ),
  (
    'dq_cbs_dnc_no_auth',
    '{{client_name}} would not give authorization when read the DNC script',
    'DQ cannot be sold - DNC'
  ),
  (
    'dq_cbs_not_mentally_capable',
    '{{client_name}} is not mentally capable of making financial decisions. You may add more detail in the Notes field before saving.',
    'DQ cannot be sold - not mentally capable'
  )
on conflict (template_key) do update
set
  template_body = excluded.template_body,
  description = excluded.description;

insert into public.disposition_flows (flow_key, pipeline_stage_name, flow_label, root_node_key, sort_order)
values (
  'dq_cant_be_sold',
  $$DQ'd Can't be sold$$,
  $$DQ'd - Can't Be Sold$$,
  'dq_cbs_root',
  0
)
on conflict (flow_key) do update
set
  pipeline_stage_name = excluded.pipeline_stage_name,
  flow_label = excluded.flow_label,
  root_node_key = excluded.root_node_key,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.disposition_flow_nodes (flow_id, node_key, node_type, node_label, sort_order, metadata)
select f.id, v.node_key, v.node_type, v.node_label, v.sort_order, v.metadata::jsonb
from public.disposition_flows f
cross join (
  values
    ('dq_cbs_root', 'choice', $$DQ'd - Can't Be Sold$$, 0, '{}'),
    (
      'dq_cbs_not_financial_note',
      'text',
      'Required note — not financially capable',
      0,
      '{"placeholder":"Explain why {{client_name}} is not financially capable of proceeding (required)."}'
    ),
    (
      'dq_cbs_manual_note',
      'text',
      'Required note — manual DQ reason',
      0,
      '{"placeholder":"Enter the DQ reason (required)."}'
    )
) as v(node_key, node_type, node_label, sort_order, metadata)
where f.flow_key = 'dq_cant_be_sold'
on conflict (flow_id, node_key) do update
set
  node_type = excluded.node_type,
  node_label = excluded.node_label,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata;

insert into public.disposition_flow_options (
  node_id,
  option_key,
  option_label,
  sort_order,
  next_node_key,
  template_key,
  quick_tag_label,
  requires_manual_note
)
select n.id, v.option_key, v.option_label, v.sort_order, v.next_node_key, v.template_key, v.quick_tag_label, v.requires_manual_note
from public.disposition_flow_nodes n
join public.disposition_flows f on f.id = n.flow_id
join (
  values
    (
      'dq_cbs_root',
      'tcpa_litigator',
      'TCPA Litigator',
      0,
      null::text,
      'dq_cbs_tcpa_litigator'::text,
      'DQ-CBS - TCPA litigator'::text,
      false
    ),
    (
      'dq_cbs_root',
      'dnc_wouldnt_authorize',
      $$DNC - Wouldn't Authorize$$,
      1,
      null::text,
      'dq_cbs_dnc_no_auth'::text,
      'DQ-CBS - DNC'::text,
      false
    ),
    (
      'dq_cbs_root',
      'not_mentally_capable',
      'Not mentally capable',
      2,
      null::text,
      'dq_cbs_not_mentally_capable'::text,
      'DQ-CBS - not mentally capable'::text,
      false
    ),
    (
      'dq_cbs_root',
      'not_financially_capable',
      'Not financially capable',
      3,
      'dq_cbs_not_financial_note'::text,
      null::text,
      'DQ-CBS - not financially capable'::text,
      false
    ),
    (
      'dq_cbs_root',
      'manual_notes',
      'Manual notes',
      4,
      'dq_cbs_manual_note'::text,
      null::text,
      'DQ-CBS - manual'::text,
      false
    )
) as v(node_key, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
  on n.node_key = v.node_key
where f.flow_key = 'dq_cant_be_sold'
on conflict (node_id, option_key) do update
set
  option_label = excluded.option_label,
  sort_order = excluded.sort_order,
  next_node_key = excluded.next_node_key,
  template_key = excluded.template_key,
  quick_tag_label = excluded.quick_tag_label,
  requires_manual_note = excluded.requires_manual_note;
