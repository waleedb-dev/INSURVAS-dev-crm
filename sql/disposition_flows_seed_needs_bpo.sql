-- Seed: Needs BPO Callback disposition wizard (idempotent upserts).

insert into public.disposition_note_templates (template_key, template_body, description)
values
  (
    'nbpo_iv_banking_no_info',
    '{{client_name}} didn''t have their Banking information on them',
    'IV → Couldn''t verify → Banking → Didn''t have info'
  ),
  (
    'nbpo_iv_banking_carrier',
    '{{client_name}}''s banking information couldn''t be validated by {{carriers}} carrier(s)',
    'IV → Couldn''t verify → Banking → Carrier validation'
  ),
  (
    'nbpo_iv_ssn_no_info',
    '{{client_name}} didn''t know their SSN',
    'IV → Couldn''t verify → SSN → Didn''t have info'
  ),
  (
    'nbpo_iv_ssn_carrier',
    '{{client_name}}''s SSN couldn''t be validated by {{carriers}} carrier(s)',
    'IV → Couldn''t verify → SSN → Carrier validation'
  ),
  (
    'nbpo_iv_address_no_info',
    '{{client_name}} couldn''t validate their address',
    'IV → Couldn''t verify → Address → Didn''t have info'
  ),
  (
    'nbpo_iv_address_carrier',
    '{{client_name}}''s address could not be validated by {{carriers}} carrier(s)',
    'IV → Couldn''t verify → Address → Carrier validation'
  ),
  (
    'nbpo_wouldnt_verify',
    '{{client_name}} wouldn''t verify their {{field_label}} information',
    'IV → Wouldn''t verify → field'
  ),
  (
    'nbpo_timing_manual',
    '',
    'Timing issue — agent manual note only'
  ),
  (
    'nbpo_signature_stub',
    '{{client_name}} — signature issue (complete details in manual note below)',
    'Placeholder until full signature branch is configured'
  )
on conflict (template_key) do update
set
  template_body = excluded.template_body,
  description = excluded.description;

insert into public.disposition_flows (flow_key, pipeline_stage_name, flow_label, root_node_key, sort_order)
values ('needs_bpo_callback', 'Needs BPO Callback', 'Needs BPO Callback', 'nbpo_category', 0)
on conflict (flow_key) do update
set
  pipeline_stage_name = excluded.pipeline_stage_name,
  flow_label = excluded.flow_label,
  root_node_key = excluded.root_node_key,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Nodes
insert into public.disposition_flow_nodes (flow_id, node_key, node_type, node_label, sort_order, metadata)
select f.id, v.node_key, v.node_type, v.node_label, v.sort_order, v.metadata::jsonb
from public.disposition_flows f
cross join (
  values
    ('nbpo_category', 'choice', 'Quick disposition', 0, '{}'),
    ('nbpo_iv_path', 'choice', 'Information verification', 0, '{}'),
    ('nbpo_iv_field', 'choice', 'What couldn''t be verified?', 0, '{}'),
    ('nbpo_iv_banking_sub', 'choice', 'Banking — what happened?', 0, '{}'),
    ('nbpo_iv_banking_carriers', 'carrier_multi', 'Select carrier(s) attempted', 0, '{"template_key_after_carriers":"nbpo_iv_banking_carrier"}'),
    ('nbpo_iv_ssn_sub', 'choice', 'SSN — what happened?', 0, '{}'),
    ('nbpo_iv_ssn_carriers', 'carrier_multi', 'Select carrier(s) attempted', 0, '{"template_key_after_carriers":"nbpo_iv_ssn_carrier"}'),
    ('nbpo_iv_address_sub', 'choice', 'Address — what happened?', 0, '{}'),
    ('nbpo_iv_address_carriers', 'carrier_multi', 'Select carrier(s) attempted', 0, '{"template_key_after_carriers":"nbpo_iv_address_carrier"}'),
    ('nbpo_wouldnt_field', 'choice', 'What wouldn''t they verify?', 0, '{}'),
    ('nbpo_signature_root', 'choice', 'Signature issue', 0, '{}'),
    ('nbpo_timing_note', 'text', 'Timing issue — describe what happened', 0, '{"requires_manual":true}')
) as v(node_key, node_type, node_label, sort_order, metadata)
where f.flow_key = 'needs_bpo_callback'
on conflict (flow_id, node_key) do update
set
  node_type = excluded.node_type,
  node_label = excluded.node_label,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata;

-- Options: category
insert into public.disposition_flow_options (node_id, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
select n.id, v.option_key, v.option_label, v.sort_order, v.next_node_key, v.template_key, v.quick_tag_label, v.requires_manual_note
from public.disposition_flow_nodes n
join public.disposition_flows f on f.id = n.flow_id
join (
  values
    ('nbpo_category', 'information_verification_issue', 'Information Verification Issue', 0, 'nbpo_iv_path', null::text, 'Information Verification Issue'::text, false),
    ('nbpo_category', 'signature_issues', 'Signature Issues', 1, 'nbpo_signature_root', null::text, 'Signature Issues'::text, false),
    ('nbpo_category', 'timing_issue', 'Timing issue (client had to go)', 2, 'nbpo_timing_note', null::text, 'Manual Note'::text, false),
    ('nbpo_category', 'not_interested', 'Not Interested', 3, null::text, null::text, 'Manual Note'::text, true),
    ('nbpo_category', 'pricing_issue', 'Pricing Issue', 4, null::text, null::text, 'Manual Note'::text, true),
    ('nbpo_category', 'manual_disposition', 'Manual Disposition', 5, null::text, null::text, 'Manual Note'::text, true)
) as v(node_key, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
  on n.node_key = v.node_key
where f.flow_key = 'needs_bpo_callback'
on conflict (node_id, option_key) do update
set
  option_label = excluded.option_label,
  sort_order = excluded.sort_order,
  next_node_key = excluded.next_node_key,
  template_key = excluded.template_key,
  quick_tag_label = excluded.quick_tag_label,
  requires_manual_note = excluded.requires_manual_note;

-- IV path: couldn't / wouldn't
insert into public.disposition_flow_options (node_id, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
select n.id, v.option_key, v.option_label, v.sort_order, v.next_node_key, v.template_key, v.quick_tag_label, v.requires_manual_note
from public.disposition_flow_nodes n
join public.disposition_flows f on f.id = n.flow_id
join (
  values
    ('nbpo_iv_path', 'couldnt_verify', 'Couldn''t Verify', 0, 'nbpo_iv_field', null::text, null::text, false),
    ('nbpo_iv_path', 'wouldnt_verify', 'Wouldn''t Verify', 1, 'nbpo_wouldnt_field', null::text, null::text, false)
) as v(node_key, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
  on n.node_key = v.node_key
where f.flow_key = 'needs_bpo_callback'
on conflict (node_id, option_key) do update
set
  option_label = excluded.option_label,
  sort_order = excluded.sort_order,
  next_node_key = excluded.next_node_key,
  template_key = excluded.template_key,
  quick_tag_label = excluded.quick_tag_label,
  requires_manual_note = excluded.requires_manual_note;

-- Field (couldn't verify)
insert into public.disposition_flow_options (node_id, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
select n.id, v.option_key, v.option_label, v.sort_order, v.next_node_key, v.template_key, v.quick_tag_label, v.requires_manual_note
from public.disposition_flow_nodes n
join public.disposition_flows f on f.id = n.flow_id
join (
  values
    ('nbpo_iv_field', 'banking', 'Banking', 0, 'nbpo_iv_banking_sub', null::text, null::text, false),
    ('nbpo_iv_field', 'ssn', 'SSN', 1, 'nbpo_iv_ssn_sub', null::text, null::text, false),
    ('nbpo_iv_field', 'address', 'Address', 2, 'nbpo_iv_address_sub', null::text, null::text, false)
) as v(node_key, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
  on n.node_key = v.node_key
where f.flow_key = 'needs_bpo_callback'
on conflict (node_id, option_key) do update
set
  option_label = excluded.option_label,
  sort_order = excluded.sort_order,
  next_node_key = excluded.next_node_key,
  template_key = excluded.template_key,
  quick_tag_label = excluded.quick_tag_label,
  requires_manual_note = excluded.requires_manual_note;

-- Banking sub
insert into public.disposition_flow_options (node_id, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
select n.id, v.option_key, v.option_label, v.sort_order, v.next_node_key, v.template_key, v.quick_tag_label, v.requires_manual_note
from public.disposition_flow_nodes n
join public.disposition_flows f on f.id = n.flow_id
join (
  values
    ('nbpo_iv_banking_sub', 'didnt_have_info', 'Didn''t have the info', 0, null::text, 'nbpo_iv_banking_no_info'::text, 'Information Verification Issue'::text, false),
    ('nbpo_iv_banking_sub', 'carrier_couldnt_validate', 'Carrier couldn''t validate the info', 1, 'nbpo_iv_banking_carriers', null::text, null::text, false)
) as v(node_key, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
  on n.node_key = v.node_key
where f.flow_key = 'needs_bpo_callback'
on conflict (node_id, option_key) do update
set
  option_label = excluded.option_label,
  sort_order = excluded.sort_order,
  next_node_key = excluded.next_node_key,
  template_key = excluded.template_key,
  quick_tag_label = excluded.quick_tag_label,
  requires_manual_note = excluded.requires_manual_note;

-- SSN sub
insert into public.disposition_flow_options (node_id, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
select n.id, v.option_key, v.option_label, v.sort_order, v.next_node_key, v.template_key, v.quick_tag_label, v.requires_manual_note
from public.disposition_flow_nodes n
join public.disposition_flows f on f.id = n.flow_id
join (
  values
    ('nbpo_iv_ssn_sub', 'didnt_have_info', 'Didn''t have the info', 0, null::text, 'nbpo_iv_ssn_no_info'::text, 'Information Verification Issue'::text, false),
    ('nbpo_iv_ssn_sub', 'carrier_couldnt_validate', 'Carrier couldn''t validate the info', 1, 'nbpo_iv_ssn_carriers', null::text, null::text, false)
) as v(node_key, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
  on n.node_key = v.node_key
where f.flow_key = 'needs_bpo_callback'
on conflict (node_id, option_key) do update
set
  option_label = excluded.option_label,
  sort_order = excluded.sort_order,
  next_node_key = excluded.next_node_key,
  template_key = excluded.template_key,
  quick_tag_label = excluded.quick_tag_label,
  requires_manual_note = excluded.requires_manual_note;

-- Address sub
insert into public.disposition_flow_options (node_id, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
select n.id, v.option_key, v.option_label, v.sort_order, v.next_node_key, v.template_key, v.quick_tag_label, v.requires_manual_note
from public.disposition_flow_nodes n
join public.disposition_flows f on f.id = n.flow_id
join (
  values
    ('nbpo_iv_address_sub', 'didnt_have_info', 'Didn''t have the info', 0, null::text, 'nbpo_iv_address_no_info'::text, 'Information Verification Issue'::text, false),
    ('nbpo_iv_address_sub', 'carrier_couldnt_validate', 'Carrier couldn''t validate the info', 1, 'nbpo_iv_address_carriers', null::text, null::text, false)
) as v(node_key, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
  on n.node_key = v.node_key
where f.flow_key = 'needs_bpo_callback'
on conflict (node_id, option_key) do update
set
  option_label = excluded.option_label,
  sort_order = excluded.sort_order,
  next_node_key = excluded.next_node_key,
  template_key = excluded.template_key,
  quick_tag_label = excluded.quick_tag_label,
  requires_manual_note = excluded.requires_manual_note;

-- Wouldn't verify — field (all use same template + field_label from option label)
insert into public.disposition_flow_options (node_id, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
select n.id, v.option_key, v.option_label, v.sort_order, v.next_node_key, v.template_key, v.quick_tag_label, v.requires_manual_note
from public.disposition_flow_nodes n
join public.disposition_flows f on f.id = n.flow_id
join (
  values
    ('nbpo_wouldnt_field', 'wouldnt_banking', 'Banking', 0, null::text, 'nbpo_wouldnt_verify'::text, 'Information Verification Issue'::text, false),
    ('nbpo_wouldnt_field', 'wouldnt_ssn', 'SSN', 1, null::text, 'nbpo_wouldnt_verify'::text, 'Information Verification Issue'::text, false),
    ('nbpo_wouldnt_field', 'wouldnt_address', 'Address', 2, null::text, 'nbpo_wouldnt_verify'::text, 'Information Verification Issue'::text, false),
    ('nbpo_wouldnt_field', 'wouldnt_health', 'Health History', 3, null::text, 'nbpo_wouldnt_verify'::text, 'Information Verification Issue'::text, false),
    ('nbpo_wouldnt_field', 'wouldnt_any', 'Any information', 4, null::text, 'nbpo_wouldnt_verify'::text, 'Information Verification Issue'::text, false)
) as v(node_key, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
  on n.node_key = v.node_key
where f.flow_key = 'needs_bpo_callback'
on conflict (node_id, option_key) do update
set
  option_label = excluded.option_label,
  sort_order = excluded.sort_order,
  next_node_key = excluded.next_node_key,
  template_key = excluded.template_key,
  quick_tag_label = excluded.quick_tag_label,
  requires_manual_note = excluded.requires_manual_note;

-- Signature root (stub → template + manual encouraged)
insert into public.disposition_flow_options (node_id, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
select n.id, v.option_key, v.option_label, v.sort_order, v.next_node_key, v.template_key, v.quick_tag_label, v.requires_manual_note
from public.disposition_flow_nodes n
join public.disposition_flows f on f.id = n.flow_id
join (
  values
    ('nbpo_signature_root', 'signature_stub', 'Continue (add details in notes)', 0, null::text, 'nbpo_signature_stub'::text, 'Signature Issues'::text, true)
) as v(node_key, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
  on n.node_key = v.node_key
where f.flow_key = 'needs_bpo_callback'
on conflict (node_id, option_key) do update
set
  option_label = excluded.option_label,
  sort_order = excluded.sort_order,
  next_node_key = excluded.next_node_key,
  template_key = excluded.template_key,
  quick_tag_label = excluded.quick_tag_label,
  requires_manual_note = excluded.requires_manual_note;
