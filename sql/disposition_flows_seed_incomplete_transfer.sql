-- Idempotent seed: Incomplete Transfer disposition wizard (options + note templates live in Supabase).
-- Run after disposition_flows_schema.sql and disposition_flows_seed_needs_bpo.sql.

insert into public.disposition_note_templates (template_key, template_body, description)
values
  (
    'inc_xfer_drop_2min',
    'Call with {{client_name}} dropped in the first two minutes of the call',
    'Incomplete Transfer → dropped in first two minutes'
  ),
  (
    'inc_xfer_drop_verify',
    'Call with {{client_name}} dropped while verifying their information',
    'Incomplete Transfer → dropped during verification'
  ),
  (
    'inc_xfer_drop_sig',
    'Call with {{client_name}} dropped during signature with {{carriers}}',
    'Incomplete Transfer → dropped during signature (carrier(s) from wizard)'
  )
on conflict (template_key) do update
set
  template_body = excluded.template_body,
  description = excluded.description;

insert into public.disposition_flows (flow_key, pipeline_stage_name, flow_label, root_node_key, sort_order)
values ('incomplete_transfer', 'Incomplete Transfer', 'Incomplete Transfer', 'inc_xfer_root', 0)
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
    ('inc_xfer_root', 'choice', 'What happened?', 0, '{}'),
    (
      'inc_xfer_sig_carriers',
      'carrier_multi',
      'Carrier name(s)',
      0,
      '{"template_key_after_carriers":"inc_xfer_drop_sig"}'
    )
) as v(node_key, node_type, node_label, sort_order, metadata)
where f.flow_key = 'incomplete_transfer'
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
      'inc_xfer_root',
      'drop_first_2m',
      'Call dropped in first two minutes',
      0,
      null::text,
      'inc_xfer_drop_2min'::text,
      'Dropped — first 2 min'::text,
      false
    ),
    (
      'inc_xfer_root',
      'drop_verify',
      'Call dropped during verification',
      1,
      null::text,
      'inc_xfer_drop_verify'::text,
      'Dropped — verification'::text,
      false
    ),
    (
      'inc_xfer_root',
      'drop_signature',
      'Call dropped during signature',
      2,
      'inc_xfer_sig_carriers'::text,
      null::text,
      'Dropped — signature'::text,
      false
    )
) as v(node_key, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
  on n.node_key = v.node_key
where f.flow_key = 'incomplete_transfer'
on conflict (node_id, option_key) do update
set
  option_label = excluded.option_label,
  sort_order = excluded.sort_order,
  next_node_key = excluded.next_node_key,
  template_key = excluded.template_key,
  quick_tag_label = excluded.quick_tag_label,
  requires_manual_note = excluded.requires_manual_note;
