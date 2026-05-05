-- Idempotent seed: Returned To Center - DQ disposition wizard (Supabase-driven copy).
-- Stage name must match pipeline_stages.name / call_results.status (not the shorter disposition label).
-- Run after disposition_flows_schema.sql.

insert into public.disposition_note_templates (template_key, template_body, description)
values
  (
    'rtc_dq_cant_afford',
    '{{client_name}} has existing coverage and indicated they cannot afford additional coverage at this time.',
    'Return to Center - DQ: existing coverage, cannot afford more'
  )
on conflict (template_key) do update
set
  template_body = excluded.template_body,
  description = excluded.description;

insert into public.disposition_flows (flow_key, pipeline_stage_name, flow_label, root_node_key, sort_order)
values (
  'return_to_center_dq',
  'Returned To Center - DQ',
  'Return to Center - DQ',
  'rtc_dq_root',
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
    ('rtc_dq_root', 'choice', 'Why return to center?', 0, '{}'),
    (
      'rtc_dq_should_not_replace_note',
      'text',
      'Required note',
      0,
      '{"disclaimer":"(only select this if we would be doing the client a disservice by replacing their coverage)","placeholder":"Ex: {{client_name}} has existing coverage and we would need to restart a two year waiting period in order to sell a new policy"}'
    )
) as v(node_key, node_type, node_label, sort_order, metadata)
where f.flow_key = 'return_to_center_dq'
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
      'rtc_dq_root',
      'existing_cant_afford',
      'Existing coverage - can''t afford more',
      0,
      null::text,
      'rtc_dq_cant_afford'::text,
      'RTC-DQ - can''t afford more'::text,
      false
    ),
    (
      'rtc_dq_root',
      'existing_should_not_replace',
      'Existing coverage - should NOT replace coverage',
      1,
      'rtc_dq_should_not_replace_note'::text,
      null::text,
      'RTC-DQ - should not replace'::text,
      false
    )
) as v(node_key, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
  on n.node_key = v.node_key
where f.flow_key = 'return_to_center_dq'
on conflict (node_id, option_key) do update
set
  option_label = excluded.option_label,
  sort_order = excluded.sort_order,
  next_node_key = excluded.next_node_key,
  template_key = excluded.template_key,
  quick_tag_label = excluded.quick_tag_label,
  requires_manual_note = excluded.requires_manual_note;
