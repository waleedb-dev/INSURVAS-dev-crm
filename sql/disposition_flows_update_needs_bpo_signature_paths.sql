-- Align Needs BPO → Signature Issues with app: two carrier_multi steps, texts Y/N, emails Y/N,
-- composed note on last Continue; remove legacy text node nbpo_sig_couldnt_detail.
-- Idempotent: safe to re-run. Apply in Supabase SQL editor or your migration runner after disposition_flows_seed_needs_bpo.sql.

-- New / updated nodes
insert into public.disposition_flow_nodes (flow_id, node_key, node_type, node_label, sort_order, metadata)
select f.id, v.node_key, v.node_type, v.node_label, v.sort_order, v.metadata::jsonb
from public.disposition_flows f
cross join (
  values
    (
      'nbpo_sig_couldnt_carriers_attempted',
      'carrier_multi',
      'Carrier signature attempted',
      0,
      jsonb_build_object('next_node_key_after_carriers', 'nbpo_sig_couldnt_texts_yn')
    ),
    ('nbpo_sig_couldnt_emails_yn', 'choice', 'Can receive emails?', 0, '{}'::jsonb),
    (
      'nbpo_sig_couldnt_carriers_only',
      'carrier_multi',
      'Only carriers available (will need to be attempted on)',
      0,
      '{}'::jsonb
    )
) as v(node_key, node_type, node_label, sort_order, metadata)
where f.flow_key = 'needs_bpo_callback'
on conflict (flow_id, node_key) do update
set
  node_type = excluded.node_type,
  node_label = excluded.node_label,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata;

update public.disposition_flow_nodes n
set node_label = 'Can receive texts?'
from public.disposition_flows f
where f.id = n.flow_id
  and f.flow_key = 'needs_bpo_callback'
  and n.node_key = 'nbpo_sig_couldnt_texts_yn';

update public.disposition_flow_nodes n
set
  node_label = 'Wouldn''t complete signature',
  metadata = jsonb_build_object(
    'disclaimer',
    'No carrier dropdowns — type both lines. Generated note is your text below.',
    'placeholder',
    concat(
      '{{client_name}} was not willing to complete the signature with [carrier attempted].',
      chr(10),
      chr(10),
      'Only carriers available: [list or N/A]'
    )
  )
from public.disposition_flows f
where f.id = n.flow_id
  and f.flow_key = 'needs_bpo_callback'
  and n.node_key = 'nbpo_sig_wouldnt_detail';

-- Signature path entry + quick tags
update public.disposition_flow_options o
set next_node_key = 'nbpo_sig_couldnt_carriers_attempted', quick_tag_label = 'Signature Issues'
from public.disposition_flow_nodes n
join public.disposition_flows f on f.id = n.flow_id
where o.node_id = n.id
  and f.flow_key = 'needs_bpo_callback'
  and n.node_key = 'nbpo_signature_path'
  and o.option_key = 'couldnt_complete_signature';

update public.disposition_flow_options o
set quick_tag_label = 'Signature Issues'
from public.disposition_flow_nodes n
join public.disposition_flows f on f.id = n.flow_id
where o.node_id = n.id
  and f.flow_key = 'needs_bpo_callback'
  and n.node_key = 'nbpo_signature_path'
  and o.option_key = 'wouldnt_complete_signature';

-- Texts Y/N → emails Y/N
update public.disposition_flow_options o
set next_node_key = 'nbpo_sig_couldnt_emails_yn'
from public.disposition_flow_nodes n
join public.disposition_flows f on f.id = n.flow_id
where o.node_id = n.id
  and f.flow_key = 'needs_bpo_callback'
  and n.node_key = 'nbpo_sig_couldnt_texts_yn'
  and o.option_key in ('texts_yes', 'texts_no');

-- Emails Y/N → second carrier picker
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
cross join (
  values
    ('emails_yes', 'Yes', 0, 'nbpo_sig_couldnt_carriers_only'::text, null::text, null::text, false),
    ('emails_no', 'No', 1, 'nbpo_sig_couldnt_carriers_only'::text, null::text, null::text, false)
) as v(option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note)
where f.flow_key = 'needs_bpo_callback'
  and n.node_key = 'nbpo_sig_couldnt_emails_yn'
on conflict (node_id, option_key) do update
set
  option_label = excluded.option_label,
  sort_order = excluded.sort_order,
  next_node_key = excluded.next_node_key,
  template_key = excluded.template_key,
  quick_tag_label = excluded.quick_tag_label,
  requires_manual_note = excluded.requires_manual_note;

-- Remove legacy free-text step (options on this node cascade)
delete from public.disposition_flow_nodes n
using public.disposition_flows f
where n.flow_id = f.id
  and f.flow_key = 'needs_bpo_callback'
  and n.node_key = 'nbpo_sig_couldnt_detail';
