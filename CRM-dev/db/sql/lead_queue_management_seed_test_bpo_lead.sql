-- Seed one real Transfer Portal test lead + queue item for flow testing.
-- Safe: inserts only into `leads`, `lead_queue_items`, `lead_queue_events`.
-- Re-runnable: removes prior `queue-test-%` records first.

begin;

-- Cleanup previous queue test data
delete from public.lead_queue_events
where queue_item_id in (
  select id from public.lead_queue_items where submission_id like 'queue-test-%'
);

delete from public.lead_queue_items
where submission_id like 'queue-test-%';

delete from public.leads
where submission_id like 'queue-test-%';

with refs as (
  select
    p.id as transfer_pipeline_id,
    ps.id as transfer_stage_id
  from public.pipelines p
  left join public.pipeline_stages ps
    on ps.pipeline_id = p.id and ps.name = 'Transfer API'
  where p.name = 'Transfer Portal'
  limit 1
),
actor as (
  -- Prefer a call center user as submitter; fallback to any user.
  select
    u.id as user_id,
    u.call_center_id
  from public.users u
  left join public.roles r on r.id = u.role_id
  where r.key in ('call_center_agent', 'call_center_admin')
  order by u.created_at desc nulls last
  limit 1
),
fallback_actor as (
  select
    u.id as user_id,
    u.call_center_id
  from public.users u
  order by u.created_at desc nulls last
  limit 1
),
picked_actor as (
  select * from actor
  union all
  select * from fallback_actor
  where not exists (select 1 from actor)
  limit 1
),
new_lead as (
  insert into public.leads (
    submission_id,
    lead_unique_id,
    lead_source,
    first_name,
    last_name,
    phone,
    state,
    city,
    zip_code,
    carrier,
    product_type,
    monthly_premium,
    coverage_amount,
    stage,
    pipeline_id,
    stage_id,
    is_draft,
    call_center_id,
    submitted_by,
    created_at,
    updated_at
  )
  select
    'queue-test-' || to_char(now(), 'YYYYMMDDHH24MISS'),
    'QUEUE-' || to_char(now(), 'MMDDHH24MISS'),
    'BPO Transfer Lead Source',
    'Queue',
    'Test Lead',
    '9075550199',
    'Alaska',
    'Anchorage',
    '99501',
    'Aflac',
    'Final Expense',
    79.00,
    25000,
    'Transfer API',
    refs.transfer_pipeline_id,
    refs.transfer_stage_id,
    false,
    picked_actor.call_center_id,
    picked_actor.user_id,
    now(),
    now()
  from refs, picked_actor
  returning id, submission_id, first_name, last_name, phone, state, carrier, call_center_id
),
center as (
  select cc.id, cc.name
  from public.call_centers cc
)
insert into public.lead_queue_items (
  lead_id,
  submission_id,
  client_name,
  phone_number,
  call_center_id,
  call_center_name,
  state,
  carrier,
  queue_type,
  status,
  action_required,
  queued_at
)
select
  l.id,
  l.submission_id,
  trim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, '')),
  l.phone,
  l.call_center_id,
  (select c.name from center c where c.id = l.call_center_id limit 1),
  l.state,
  l.carrier,
  'unclaimed_transfer',
  'active',
  'new_sale',
  now()
from new_lead l;

insert into public.lead_queue_events (
  queue_item_id,
  event_type,
  actor_role,
  new_payload,
  meta
)
select
  i.id,
  'queue_created',
  'manager',
  jsonb_build_object('queue_type', i.queue_type, 'status', i.status),
  jsonb_build_object('source', 'queue-test-seed')
from public.lead_queue_items i
where i.submission_id like 'queue-test-%'
  and i.created_at > now() - interval '5 minutes';

commit;
