-- Queue Management (safe additive migration)
-- Creates new queue tables only; does not alter existing operational tables.

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'queue_type_enum') then
    create type public.queue_type_enum as enum ('unclaimed_transfer', 'ba_active', 'la_active');
  end if;

  if not exists (select 1 from pg_type where typname = 'queue_status_enum') then
    create type public.queue_status_enum as enum ('active', 'completed', 'dropped', 'cancelled', 'expired');
  end if;

  if not exists (select 1 from pg_type where typname = 'queue_role_enum') then
    create type public.queue_role_enum as enum ('manager', 'ba', 'la');
  end if;

  if not exists (select 1 from pg_type where typname = 'queue_action_required_enum') then
    create type public.queue_action_required_enum as enum (
      'new_sale',
      'carrier_requirement',
      'payment_fix',
      'pending_file',
      'unknown'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'queue_event_type_enum') then
    create type public.queue_event_type_enum as enum (
      'queue_created',
      'manager_assigned',
      'eta_sent',
      'ready_clicked',
      'la_ready',
      'transfer_sent',
      'call_dropped',
      'reassigned',
      'status_changed',
      'comment_added'
    );
  end if;
end
$$;

create table if not exists public.lead_queue_items (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid null references public.leads(id) on delete set null,
  submission_id text null,
  verification_session_id uuid null references public.verification_sessions(id) on delete set null,
  ddf_id uuid null references public.daily_deal_flow(id) on delete set null,
  policy_id text null,
  client_name text null,
  phone_number text null,
  call_center_id uuid null references public.call_centers(id) on delete set null,
  call_center_name text null,
  state text null,
  carrier text null,
  queue_type public.queue_type_enum not null default 'unclaimed_transfer',
  status public.queue_status_enum not null default 'active',
  current_owner_user_id uuid null references public.users(id) on delete set null,
  current_owner_role public.queue_role_enum null,
  assigned_ba_id uuid null references public.users(id) on delete set null,
  assigned_la_id uuid null references public.users(id) on delete set null,
  manager_assigned_by uuid null references public.users(id) on delete set null,
  la_ready_at timestamptz null,
  la_ready_by uuid null references public.users(id) on delete set null,
  ba_ready_at timestamptz null,
  ba_ready_by uuid null references public.users(id) on delete set null,
  ba_transfer_sent_at timestamptz null,
  queued_at timestamptz not null default now(),
  claimed_at timestamptz null,
  eta_minutes integer null check (eta_minutes is null or eta_minutes >= 0),
  ba_verification_percent numeric(5,2) null check (
    ba_verification_percent is null
    or (ba_verification_percent >= 0 and ba_verification_percent <= 100)
  ),
  action_required public.queue_action_required_enum not null default 'unknown',
  imo_id text null,
  agency_id text null,
  attempted_application boolean not null default false,
  last_attempt_agent_id uuid null references public.users(id) on delete set null,
  last_attempt_imo_id text null,
  last_disposition text null,
  take_next boolean not null default false,
  priority_score integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_lead_queue_active_submission
  on public.lead_queue_items(submission_id)
  where status = 'active' and submission_id is not null;

create index if not exists idx_lqi_queue_type_status
  on public.lead_queue_items(queue_type, status);

create index if not exists idx_lqi_assigned_ba
  on public.lead_queue_items(assigned_ba_id)
  where status = 'active';

create index if not exists idx_lqi_assigned_la
  on public.lead_queue_items(assigned_la_id)
  where status = 'active';

create index if not exists idx_lqi_owner
  on public.lead_queue_items(current_owner_user_id)
  where status = 'active';

create index if not exists idx_lqi_call_center
  on public.lead_queue_items(call_center_id, status);

create index if not exists idx_lqi_created_at
  on public.lead_queue_items(created_at desc);

create table if not exists public.lead_queue_events (
  id uuid primary key default gen_random_uuid(),
  queue_item_id uuid not null references public.lead_queue_items(id) on delete cascade,
  event_type public.queue_event_type_enum not null,
  actor_user_id uuid null references public.users(id) on delete set null,
  actor_role public.queue_role_enum null,
  old_payload jsonb null,
  new_payload jsonb null,
  meta jsonb null,
  slack_message_id text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lqe_queue_created
  on public.lead_queue_events(queue_item_id, created_at desc);

create table if not exists public.lead_queue_comments (
  id uuid primary key default gen_random_uuid(),
  queue_item_id uuid not null references public.lead_queue_items(id) on delete cascade,
  author_user_id uuid not null references public.users(id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  visibility text not null default 'manager_and_assigned',
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at_lead_queue_items()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_lead_queue_items on public.lead_queue_items;
create trigger trg_set_updated_at_lead_queue_items
before update on public.lead_queue_items
for each row
execute function public.set_updated_at_lead_queue_items();

create or replace view public.v_queue_source_snapshot as
select
  l.id as lead_id,
  l.submission_id,
  l.policy_id,
  trim(concat(coalesce(l.first_name,''), ' ', coalesce(l.last_name,''))) as client_name,
  l.phone as phone_number,
  l.call_center_id,
  cc.name as call_center_name,
  l.state,
  l.carrier,
  l.updated_at as lead_updated_at
from public.leads l
left join public.call_centers cc on cc.id = l.call_center_id;

commit;
