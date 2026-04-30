-- Dummy seed data for queue UI testing
-- Safe: inserts only into new queue tables.
-- Re-runnable: clears previous demo rows by submission_id prefix.

begin;

delete from public.lead_queue_events
where queue_item_id in (
  select id from public.lead_queue_items where submission_id like 'queue-demo-%'
);

delete from public.lead_queue_items
where submission_id like 'queue-demo-%';

insert into public.lead_queue_items (
  submission_id,
  policy_id,
  client_name,
  phone_number,
  call_center_name,
  state,
  carrier,
  queue_type,
  status,
  action_required,
  queued_at,
  ba_verification_percent,
  eta_minutes,
  attempted_application,
  last_disposition
)
values
  (
    'queue-demo-001',
    'POL-1001',
    'John Carter',
    '555-0101',
    'BPO A',
    'Georgia',
    'Aetna',
    'unclaimed_transfer',
    'active',
    'new_sale',
    now() - interval '18 minutes',
    null,
    null,
    false,
    'Needs callback'
  ),
  (
    'queue-demo-002',
    'POL-1002',
    'Sarah Diaz',
    '555-0102',
    'BPO B',
    'Texas',
    'Mutual of Omaha',
    'unclaimed_transfer',
    'active',
    'carrier_requirement',
    now() - interval '7 minutes',
    null,
    null,
    false,
    'Carrier requirement pending'
  ),
  (
    'queue-demo-003',
    'POL-2001',
    'Michael Ross',
    '555-0201',
    'BPO C',
    'Florida',
    'American Amicable',
    'ba_active',
    'active',
    'payment_fix',
    now() - interval '25 minutes',
    42.00,
    null,
    true,
    'Application attempted'
  ),
  (
    'queue-demo-004',
    'POL-3001',
    'Emily Stone',
    '555-0301',
    'BPO D',
    'Ohio',
    'Aflac',
    'la_active',
    'active',
    'pending_file',
    now() - interval '32 minutes',
    null,
    14,
    false,
    'Pending file update'
  );

insert into public.lead_queue_events (
  queue_item_id,
  event_type,
  actor_role,
  old_payload,
  new_payload,
  meta
)
select
  i.id,
  'queue_created',
  'manager',
  null,
  jsonb_build_object('queue_type', i.queue_type, 'status', i.status),
  jsonb_build_object('source', 'dummy-seed')
from public.lead_queue_items i
where i.submission_id like 'queue-demo-%';

commit;
