-- ---------------------------------------------------------------------------
-- Security definer: visibility without RLS recursion between tickets <-> followers
-- ---------------------------------------------------------------------------
create or replace function public.ticket_user_has_access(p_ticket_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and (
        t.publisher_id = p_user_id
        or t.assignee_id = p_user_id
        or exists (
          select 1
          from public.ticket_followers tf
          where tf.ticket_id = t.id
            and tf.user_id = p_user_id
        )
        or (
          exists (
            select 1
            from public.users u_viewer
            join public.roles r on r.id = u_viewer.role_id
            where u_viewer.id = p_user_id
              and r.key = 'call_center_admin'
              and u_viewer.call_center_id is not null
          )
          and (
            -- Ticket with no linked lead: check via call_center_id or publisher's center
            (t.lead_id is null and exists (
              select 1
              from public.users u_pub
              join public.users u_viewer on u_viewer.id = p_user_id
              where u_pub.id = t.publisher_id
                and u_pub.call_center_id is not null
                and u_pub.call_center_id = u_viewer.call_center_id
            ))
            or
            -- Ticket with linked lead: check via lead's call_center_id
            (t.lead_id is not null and exists (
              select 1
              from public.leads l
              join public.users u_pub on u_pub.id = t.publisher_id
              join public.users u_viewer on u_viewer.id = p_user_id
              where l.id = t.lead_id
                and l.call_center_id is not null
                and l.call_center_id = u_viewer.call_center_id
                and u_pub.call_center_id is not null
                and u_pub.call_center_id = l.call_center_id
            ))
          )
        )
      )
  )
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_user_id
      and r.key = 'system_admin'
  )
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_user_id
      and r.key = 'publisher_manager'
  );
$$;

grant execute on function public.ticket_user_has_access(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Auto-assign: routing rules (lead-linked only), then publisher_manager
-- ---------------------------------------------------------------------------
create or replace function public.tickets_apply_default_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_country text;
  v_region text;
  v_language text;
  v_rule_user uuid;
  v_manager uuid;
begin
  if new.assignee_id is not null then
    return new;
  end if;

  -- Routing rules only apply when a lead is linked
  if new.lead_id is not null then
    select lower(trim(cc.country)), lower(trim(cc.region)), lower(trim(l.language))
    into v_country, v_region, v_language
    from public.leads l
    left join public.call_centers cc on cc.id = l.call_center_id
    where l.id = new.lead_id;

    select r.assignee_user_id
    into v_rule_user
    from public.ticket_routing_rules r
    where r.is_active
      and (
        (r.rule_kind = 'country' and v_country is not null and v_country = lower(trim(r.match_value)))
        or (r.rule_kind = 'region' and v_region is not null and v_region = lower(trim(r.match_value)))
        or (r.rule_kind = 'language' and v_language is not null and v_language = lower(trim(r.match_value)))
      )
    order by r.priority asc, r.created_at asc
    limit 1;

    if v_rule_user is not null then
      new.assignee_id := v_rule_user;
      return new;
    end if;
  end if;

  -- Fallback: assign to a publisher_manager user
  -- Prefer one in the same call center if ticket has call_center_id
  select u.id
  into v_manager
  from public.users u
  join public.roles r on r.id = u.role_id
  where r.key = 'publisher_manager'
  order by
    case when new.call_center_id is not null and u.call_center_id = new.call_center_id then 0 else 1 end,
    u.created_at asc
  limit 1;

  if v_manager is not null then
    new.assignee_id := v_manager;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tickets_apply_routing on public.tickets;

create trigger trg_tickets_apply_routing
before insert on public.tickets
for each row execute function public.tickets_apply_default_assignee();

-- ---------------------------------------------------------------------------
-- Enforce solved + assignee change (column-level rules; RLS cannot see OLD/NEW split easily)
-- ---------------------------------------------------------------------------
create or replace function public.tickets_before_update_enforce()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = 'system_admin'
  )
  into is_admin;

  if new.assignee_id is distinct from old.assignee_id and not is_admin then
    raise exception 'Only a system admin may change the ticket assignee';
  end if;

  if new.status = 'solved'::public.ticket_status and old.status is distinct from 'solved'::public.ticket_status then
    if is_admin then
      return new;
    end if;
    if old.assignee_id = auth.uid() and new.assignee_id is not distinct from old.assignee_id then
      return new;
    end if;
    raise exception 'Only the assignee or a system admin may set status to solved';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tickets_before_update_enforce on public.tickets;

create trigger trg_tickets_before_update_enforce
before update on public.tickets
for each row execute function public.tickets_before_update_enforce();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.tickets to authenticated;

grant select, insert, update, delete on public.ticket_comments to authenticated;

grant select, insert, update, delete on public.ticket_followers to authenticated;

-- Routing table: no grants to authenticated (maintain via service role / SQL).

alter table public.tickets enable row level security;

alter table public.ticket_comments enable row level security;

alter table public.ticket_followers enable row level security;

alter table public.ticket_routing_rules enable row level security;

-- ---------------------------------------------------------------------------
-- tickets policies
-- ---------------------------------------------------------------------------
drop policy if exists tickets_select_participants on public.tickets;

create policy tickets_select_participants
on public.tickets
for select
to authenticated
using (public.ticket_user_has_access(id, auth.uid()));

-- Publisher = call center admin only: same center as the lead (or system_admin).
-- When lead_id is null, verify via ticket's call_center_id instead.
drop policy if exists tickets_insert_publishers on public.tickets;

create policy tickets_insert_publishers
on public.tickets
for insert
to authenticated
with check (
  publisher_id = auth.uid()
  and (
    public.has_role('system_admin')
    or (
      public.has_role('call_center_admin')
      and exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and u.call_center_id is not null
          and (
            (lead_id is null and call_center_id is not null and call_center_id = u.call_center_id)
            or
            (lead_id is not null and exists (
              select 1
              from public.leads l
              where l.id = lead_id
                and l.call_center_id is not null
                and l.call_center_id = u.call_center_id
            ))
          )
      )
    )
  )
);

drop policy if exists tickets_update_assignee on public.tickets;

create policy tickets_update_assignee
on public.tickets
for update
to authenticated
using (assignee_id = auth.uid())
with check (true);

drop policy if exists tickets_update_admin on public.tickets;

create policy tickets_update_admin
on public.tickets
for update
to authenticated
using (public.has_role('system_admin'))
with check (true);

-- ---------------------------------------------------------------------------
-- ticket_comments policies
-- ---------------------------------------------------------------------------
drop policy if exists ticket_comments_select on public.ticket_comments;

create policy ticket_comments_select
on public.ticket_comments
for select
to authenticated
using (public.ticket_user_has_access(ticket_id, auth.uid()));

drop policy if exists ticket_comments_insert on public.ticket_comments;

create policy ticket_comments_insert
on public.ticket_comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.ticket_user_has_access(ticket_id, auth.uid())
);

drop policy if exists ticket_comments_delete_own_or_admin on public.ticket_comments;

create policy ticket_comments_delete_own_or_admin
on public.ticket_comments
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.has_role('system_admin')
);

-- ---------------------------------------------------------------------------
-- ticket_followers policies
-- ---------------------------------------------------------------------------
drop policy if exists ticket_followers_select on public.ticket_followers;

create policy ticket_followers_select
on public.ticket_followers
for select
to authenticated
using (public.ticket_user_has_access(ticket_id, auth.uid()));

drop policy if exists ticket_followers_insert_assignee on public.ticket_followers;

create policy ticket_followers_insert_assignee
on public.ticket_followers
for insert
to authenticated
with check (
  public.has_role('system_admin')
  or public.has_role('publisher_manager')
  or exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and t.assignee_id = auth.uid()
  )
);

drop policy if exists ticket_followers_delete_assignee on public.ticket_followers;

create policy ticket_followers_delete_assignee
on public.ticket_followers
for delete
to authenticated
using (
  public.has_role('system_admin')
  or public.has_role('publisher_manager')
  or exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and t.assignee_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- ticket_routing_rules: service role / postgres only (no authenticated policies)
-- ---------------------------------------------------------------------------
-- END tickets_module.sql

-- BEGIN callback_requests.sql
create table if not exists public.callback_requests (
  id uuid not null default gen_random_uuid(),
  submission_id text not null,
  lead_vendor text not null,
  request_type text not null,
  notes text not null,
  customer_name text null,
  phone_number text null,
  status text null default 'pending'::text,
  requested_by uuid null,
  requested_at timestamp with time zone null default now(),
  completed_at timestamp with time zone null,
  completed_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint callback_requests_pkey primary key (id),
  constraint callback_requests_completed_by_fkey foreign key (completed_by) references auth.users (id),
  constraint callback_requests_requested_by_fkey foreign key (requested_by) references auth.users (id),
  constraint callback_requests_request_type_check check (
    request_type = any (
      array[
        'new_application'::text,
        'updating_billing'::text,
        'carrier_requirements'::text
      ]
    )
  ),
  constraint callback_requests_status_check check (
    status = any (
      array[
        'pending'::text,
        'in_progress'::text,
        'completed'::text,
        'cancelled'::text
      ]
    )
  )
);

create index if not exists idx_callback_requests_submission_id
  on public.callback_requests using btree (submission_id);

create index if not exists idx_callback_requests_lead_vendor
  on public.callback_requests using btree (lead_vendor);

create index if not exists idx_callback_requests_status
  on public.callback_requests using btree (status);

create index if not exists idx_callback_requests_requested_at
  on public.callback_requests using btree (requested_at desc);

grant select, insert, update on public.callback_requests to authenticated;

alter table public.callback_requests enable row level security;

drop policy if exists callback_requests_select on public.callback_requests;

create policy callback_requests_select
on public.callback_requests
for select
to authenticated
using (
  requested_by = auth.uid()
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (array['system_admin', 'call_center_admin']::text[])
  )
);

drop policy if exists callback_requests_insert on public.callback_requests;

create policy callback_requests_insert
on public.callback_requests
for insert
to authenticated
with check (
  requested_by = auth.uid()
  or requested_by is null
);

drop policy if exists callback_requests_update on public.callback_requests;

create policy callback_requests_update
on public.callback_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (array['system_admin', 'call_center_admin']::text[])
  )
)
with check (
  exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (array['system_admin', 'call_center_admin']::text[])
  )
);

-- END callback_requests.sql

-- BEGIN lead_queue_management.sql
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

-- END lead_queue_management.sql

-- BEGIN lead_queue_management_permissions.sql
-- Table/API privileges for signed-in users
grant usage on schema public to authenticated;

grant select, insert, update, delete
  on table public.lead_queue_items
  to authenticated;

grant select, insert
  on table public.lead_queue_events
  to authenticated;

grant select, insert
  on table public.lead_queue_comments
  to authenticated;

grant select
  on table public.v_queue_source_snapshot
  to authenticated;

-- RLS
alter table public.lead_queue_items enable row level security;

alter table public.lead_queue_events enable row level security;

alter table public.lead_queue_comments enable row level security;

-- Dev-first permissive policies for authenticated users on queue tables.
-- These can be tightened to role-specific checks in the next iteration.
drop policy if exists lead_queue_items_authenticated_all on public.lead_queue_items;

create policy lead_queue_items_authenticated_all
  on public.lead_queue_items
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists lead_queue_events_authenticated_read on public.lead_queue_events;

create policy lead_queue_events_authenticated_read
  on public.lead_queue_events
  for select
  to authenticated
  using (true);

drop policy if exists lead_queue_events_authenticated_insert on public.lead_queue_events;

create policy lead_queue_events_authenticated_insert
  on public.lead_queue_events
  for insert
  to authenticated
  with check (true);

drop policy if exists lead_queue_comments_authenticated_read on public.lead_queue_comments;

create policy lead_queue_comments_authenticated_read
  on public.lead_queue_comments
  for select
  to authenticated
  using (true);

drop policy if exists lead_queue_comments_authenticated_insert on public.lead_queue_comments;

create policy lead_queue_comments_authenticated_insert
  on public.lead_queue_comments
  for insert
  to authenticated
  with check (true);

-- END lead_queue_management_permissions.sql

-- BEGIN center_thresholds.sql
-- ============================================
-- CENTER THRESHOLDS TABLE & POLICIES
-- ============================================

-- Create center_thresholds table
CREATE TABLE IF NOT EXISTS public.center_thresholds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  center_name text NOT NULL,
  lead_vendor text NOT NULL,
  tier text NULL DEFAULT 'C'::text,
  daily_transfer_target integer NULL DEFAULT 10,
  daily_sales_target integer NULL DEFAULT 5,
  max_dq_percentage numeric(5, 2) NULL DEFAULT 20.00,
  min_approval_ratio numeric(5, 2) NULL DEFAULT 20.00,
  transfer_weight integer NULL DEFAULT 40,
  approval_ratio_weight integer NULL DEFAULT 35,
  dq_weight integer NULL DEFAULT 25,
  is_active boolean NULL DEFAULT true,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL,
  slack_webhook_url text NULL,
  slack_channel text NULL,
  slack_manager_id text NULL,
  underwriting_threshold integer NULL DEFAULT 5,
  slack_channel_id text NULL,
  CONSTRAINT center_thresholds_pkey PRIMARY KEY (id),
  CONSTRAINT center_thresholds_center_name_key UNIQUE (center_name),
  CONSTRAINT center_thresholds_lead_vendor_key UNIQUE (lead_vendor),
  CONSTRAINT center_thresholds_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id),
  CONSTRAINT center_thresholds_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users (id),
  CONSTRAINT center_thresholds_tier_check CHECK (
    tier = ANY (ARRAY['A'::text, 'B'::text, 'C'::text])
  )
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_center_thresholds_lead_vendor ON public.center_thresholds USING btree (lead_vendor) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_center_thresholds_tier ON public.center_thresholds USING btree (tier) TABLESPACE pg_default;

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_center_thresholds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_center_thresholds_updated_at ON public.center_thresholds;

CREATE TRIGGER set_center_thresholds_updated_at
  BEFORE UPDATE ON public.center_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION update_center_thresholds_updated_at();

-- ============================================
-- RLS POLICIES FOR SYSTEM_ADMIN
-- ============================================

-- Enable RLS
ALTER TABLE public.center_thresholds ENABLE ROW LEVEL SECURITY;

-- Grant basic permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.center_thresholds TO authenticated;

-- Policy: SELECT for system_admin
DROP POLICY IF EXISTS center_thresholds_select_system_admin ON public.center_thresholds;

CREATE POLICY center_thresholds_select_system_admin
ON public.center_thresholds
FOR SELECT
TO authenticated
USING (public.has_role('system_admin'));

-- Policy: SELECT for publisher_manager
DROP POLICY IF EXISTS center_thresholds_select_publisher_manager ON public.center_thresholds;

CREATE POLICY center_thresholds_select_publisher_manager
ON public.center_thresholds
FOR SELECT
TO authenticated
USING (public.has_role('publisher_manager'));

-- Policy: SELECT for sales_manager
DROP POLICY IF EXISTS center_thresholds_select_sales_manager ON public.center_thresholds;

CREATE POLICY center_thresholds_select_sales_manager
ON public.center_thresholds
FOR SELECT
TO authenticated
USING (public.has_role('sales_manager'));

-- Policy: INSERT for system_admin
DROP POLICY IF EXISTS center_thresholds_insert_system_admin ON public.center_thresholds;

CREATE POLICY center_thresholds_insert_system_admin
ON public.center_thresholds
FOR INSERT
TO authenticated
WITH CHECK (public.has_role('system_admin'));

-- Policy: UPDATE for system_admin
DROP POLICY IF EXISTS center_thresholds_update_system_admin ON public.center_thresholds;

CREATE POLICY center_thresholds_update_system_admin
ON public.center_thresholds
FOR UPDATE
TO authenticated
USING (public.has_role('system_admin'))
WITH CHECK (public.has_role('system_admin'));

-- Policy: UPDATE for publisher_manager
DROP POLICY IF EXISTS center_thresholds_update_publisher_manager ON public.center_thresholds;

CREATE POLICY center_thresholds_update_publisher_manager
ON public.center_thresholds
FOR UPDATE
TO authenticated
USING (public.has_role('publisher_manager'))
WITH CHECK (public.has_role('publisher_manager'));

-- Policy: UPDATE for sales_manager
DROP POLICY IF EXISTS center_thresholds_update_sales_manager ON public.center_thresholds;

CREATE POLICY center_thresholds_update_sales_manager
ON public.center_thresholds
FOR UPDATE
TO authenticated
USING (public.has_role('sales_manager'))
WITH CHECK (public.has_role('sales_manager'));

-- Policy: DELETE for system_admin
DROP POLICY IF EXISTS center_thresholds_delete_system_admin ON public.center_thresholds;

CREATE POLICY center_thresholds_delete_system_admin
ON public.center_thresholds
FOR DELETE
TO authenticated
USING (public.has_role('system_admin'));

-- END center_thresholds.sql

-- BEGIN add_agent_language.sql
-- ============================================
-- ADD LANGUAGE COLUMN TO AGENTS TABLE
-- ============================================

-- Add language column to agents table
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS language text DEFAULT 'English';

-- Add check constraint for valid languages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'agents_language_check' 
    AND conrelid = 'public.agents'::regclass
  ) THEN
    ALTER TABLE public.agents 
    ADD CONSTRAINT agents_language_check 
    CHECK (language IN ('English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Tagalog', 'Vietnamese', 'Russian', 'Polish'));
  END IF;
END $$;

-- Add index for language lookups
CREATE INDEX IF NOT EXISTS idx_agents_language ON public.agents(language);

-- END add_agent_language.sql

-- BEGIN add_country_to_call_centers.sql
-- Add country column to call_centers table
alter table public.call_centers
add column if not exists country text null;

-- Create index for country filtering
create index if not exists idx_call_centers_country on public.call_centers(country);

-- Update RLS policies to allow country field access (same as other fields)
-- The existing policies should already cover it since they allow all authenticated access

comment on column public.call_centers.country is 'Country where the call center is located (e.g., United States, Pakistan, Philippines)';

-- END add_country_to_call_centers.sql

-- BEGIN add_unlicensed_sales_subtype.sql
-- Subtype for Sales Agent (Unlicensed): buffer vs retention routing in claim workflows.
-- Safe to run multiple times.

alter table public.users
  add column if not exists unlicensed_sales_subtype text;

alter table public.users
  drop constraint if exists users_unlicensed_sales_subtype_check;

alter table public.users
  add constraint users_unlicensed_sales_subtype_check
  check (
    unlicensed_sales_subtype is null
    or unlicensed_sales_subtype in ('buffer_agent', 'retention_agent')
  );

comment on column public.users.unlicensed_sales_subtype is
  'For role sales_agent_unlicensed only: buffer_agent or retention_agent; null for other roles or unset.';

-- END add_unlicensed_sales_subtype.sql

-- BEGIN call_centers_add_status_column.sql
alter table public.call_centers
add column if not exists status text;

alter table public.call_centers
alter column status set default 'active';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'call_centers_status_check'
      and conrelid = 'public.call_centers'::regclass
  ) then
    alter table public.call_centers
    add constraint call_centers_status_check
    check (status in ('active', 'inactive'));
  end if;
end $$;

alter table public.call_centers
alter column status set not null;

-- END call_centers_add_status_column.sql

-- BEGIN call_results_agent_portal_parity.sql
-- Adds Agent Portal parity columns to CRM call_results table.
-- Safe to run multiple times.

alter table public.call_results
  add column if not exists application_submitted boolean,
  add column if not exists status text,
  add column if not exists dq_reason text,
  add column if not exists call_source text,
  add column if not exists buffer_agent text,
  add column if not exists agent_who_took_call text,
  add column if not exists sent_to_underwriting boolean default false,
  add column if not exists licensed_agent_account text,
  add column if not exists carrier text,
  add column if not exists product_type text,
  add column if not exists draft_date date,
  add column if not exists monthly_premium numeric(10, 2),
  add column if not exists coverage_amount numeric(12, 2),
  add column if not exists face_amount numeric(12, 2),
  add column if not exists is_callback boolean default false,
  add column if not exists is_retention_call boolean default false,
  add column if not exists carrier_attempted_1 text,
  add column if not exists carrier_attempted_2 text,
  add column if not exists carrier_attempted_3 text,
  add column if not exists user_id uuid references auth.users(id);

create index if not exists idx_call_results_submission_id on public.call_results(submission_id);

create index if not exists idx_call_results_status on public.call_results(status);

create index if not exists idx_call_results_call_source on public.call_results(call_source);

-- END call_results_agent_portal_parity.sql

-- BEGIN daily_deal_flow_add_call_result_parity.sql
-- Mirror key call_results / transfer portal fields on daily_deal_flow for reporting and DDF edits.
-- Safe to run multiple times.

alter table public.daily_deal_flow
  add column if not exists application_submitted boolean null,
  add column if not exists call_source text null,
  add column if not exists sent_to_underwriting boolean null,
  add column if not exists coverage_amount numeric(12, 2) null,
  add column if not exists carrier_attempted_1 text null,
  add column if not exists carrier_attempted_2 text null,
  add column if not exists carrier_attempted_3 text null;

-- END daily_deal_flow_add_call_result_parity.sql

-- BEGIN daily_deal_flow_add_disposition_fields.sql
alter table public.daily_deal_flow
  add column if not exists dq_reason text,
  add column if not exists new_draft_date date,
  add column if not exists disposition_path jsonb,
  add column if not exists generated_note text,
  add column if not exists manual_note text,
  add column if not exists quick_disposition_tag text;

-- END daily_deal_flow_add_disposition_fields.sql

-- BEGIN daily_deal_flow_sales_admin_insert.sql
-- Allow Sales Admin to create Daily Deal Flow rows from manual lead admission.

drop policy if exists daily_deal_flow_insert_global on public.daily_deal_flow;

create policy daily_deal_flow_insert_global
on public.daily_deal_flow
for insert
to authenticated
with check (
  public.has_any_role(array[
    'system_admin',
    'sales_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
);

-- END daily_deal_flow_sales_admin_insert.sql

-- BEGIN disposition_flows_update_needs_bpo_signature_paths.sql
-- END disposition_flows_update_needs_bpo_signature_paths.sql

-- BEGIN grant_lead_pipeline_update_call_center.sql
-- END grant_lead_pipeline_update_call_center.sql

-- BEGIN grant_transfer_leads_edit_permission.sql
-- END grant_transfer_leads_edit_permission.sql

-- BEGIN lead_queue_items_add_transfer_screening.sql
-- Persist transfer / TCPA screening snapshot when a queue row is created (auto-screening).

alter table public.lead_queue_items
  add column if not exists transfer_screening_json jsonb;

alter table public.lead_queue_items
  add column if not exists transfer_screening_at timestamptz;

-- END lead_queue_items_add_transfer_screening.sql

-- BEGIN leads_add_backup_quote_columns.sql
-- Optional backup quote on transfer / BPO leads (mirrors primary carrier/product/premium/coverage).

alter table public.leads
  add column if not exists has_backup_quote boolean not null default false;

alter table public.leads
  add column if not exists backup_carrier text null;

alter table public.leads
  add column if not exists backup_product_type text null;

alter table public.leads
  add column if not exists backup_monthly_premium text null;

alter table public.leads
  add column if not exists backup_coverage_amount text null;

-- END leads_add_backup_quote_columns.sql

-- BEGIN leads_add_existing_coverage_details.sql
-- Add existing coverage details field for transfer lead application form.
alter table public.leads
  add column if not exists existing_coverage_details text;

-- END leads_add_existing_coverage_details.sql

-- BEGIN leads_add_is_active_column.sql
-- Optional column for `dnc-lookup` edge function: deactivate TCPA-flagged leads.
alter table public.leads
  add column if not exists is_active boolean not null default true;

create index if not exists leads_is_active_idx
  on public.leads using btree (is_active)
  where is_active = true;

-- END leads_add_is_active_column.sql

-- BEGIN leads_add_language_column.sql
-- Add lead language for transfer portal intake (English/Spanish).
alter table public.leads
  add column if not exists language text;

-- END leads_add_language_column.sql

-- BEGIN leads_add_licensed_agent_account.sql
-- Store assigned owner (licensed agent display name) on leads.
alter table public.leads
  add column if not exists licensed_agent_account text;

-- END leads_add_licensed_agent_account.sql

-- BEGIN leads_add_sync_required.sql
-- Add sync_required column to leads table
-- Run this in your Supabase SQL Editor

-- Add the sync_required boolean column with default true
alter table public.leads 
add column if not exists sync_required boolean not null default true;

-- Create index for filtering
create index if not exists leads_sync_required_idx on public.leads (sync_required);

-- Disable sync for all existing leads (one-time migration)
-- Run this if you want to disable sync for all existing leads
-- update public.leads set sync_required = false where sync_required is not false;
-- END leads_add_sync_required.sql

-- BEGIN leads_add_tags_column.sql
-- Add tags support on leads for duplicate labeling and future categorization
alter table public.leads
add column if not exists tags text[] not null default '{}';

-- END leads_add_tags_column.sql

-- BEGIN list_publisher_managers_for_ticket_assign.sql
-- Callable by call centre admins and system admins (creators of lead-scoped tickets) so they can
-- choose an assignee even though RLS on public.users does not expose publisher_manager rows to CC admins.

create or replace function public.list_publisher_managers_for_ticket_assign()
returns table (id uuid, full_name text, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.has_role('call_center_admin') or public.has_role('system_admin')) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  return query
  select
    u.id,
    coalesce(nullif(trim(u.full_name), ''), u.email) as full_name,
    u.email
  from public.users u
  join public.roles r on r.id = u.role_id
  where r.key = 'publisher_manager'
    and u.status = 'active'
  order by 2 asc, 3 asc;
end;
$$;

grant execute on function public.list_publisher_managers_for_ticket_assign() to authenticated;

-- END list_publisher_managers_for_ticket_assign.sql

-- BEGIN publisher_manager_role_permissions.sql
-- END publisher_manager_role_permissions.sql

-- BEGIN ssn_duplicate_stage_rules_precedence.sql
-- Precedence for duplicate / transfer-checker stage resolution.
-- Lower precedence_rank = higher priority when multiple leads match.
--
-- Tier 1 (10–59): business-critical ordering — always wins over tier 2 when resolving conflicts.
-- Tier 2 (100+): all other stages in pipeline order; messages are one of two templates:
--   • "Can be sent, approved." (transfer / chargeback workflow)
--   • "Customer has current policy — approved for transfer." (in-force / billing / lapse paths)

alter table public.ssn_duplicate_stage_rules
  add column if not exists precedence_rank integer not null default 500;

comment on column public.ssn_duplicate_stage_rules.precedence_rank is
  'Lower value = higher priority when several matched leads disagree; used with resolveDuplicatePolicy().';

-- END ssn_duplicate_stage_rules_precedence.sql

-- BEGIN ssn_duplicate_stage_rules.sql
-- SSN duplicate handling rules (DB-driven)
-- This table controls whether a new lead is addable when the same SSN already exists
-- in a specific stage, along with the message shown to the user and mapped GHL stage.

create table if not exists public.ssn_duplicate_stage_rules (
  id bigserial primary key,
  stage_name text not null unique,
  ghl_stage text,
  message text not null,
  is_addable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_ssn_duplicate_stage_rules_updated_at on public.ssn_duplicate_stage_rules;

create trigger trg_ssn_duplicate_stage_rules_updated_at
before update on public.ssn_duplicate_stage_rules
for each row execute function public.set_updated_at();

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.ssn_duplicate_stage_rules to authenticated;

grant usage, select on sequence public.ssn_duplicate_stage_rules_id_seq to authenticated;

alter table public.ssn_duplicate_stage_rules enable row level security;

-- Any authenticated user can read rules (needed during lead submission checks)
drop policy if exists ssn_duplicate_stage_rules_select_authenticated on public.ssn_duplicate_stage_rules;

create policy ssn_duplicate_stage_rules_select_authenticated
on public.ssn_duplicate_stage_rules
for select
to authenticated
using (true);

-- Only system admin can manage rules
drop policy if exists ssn_duplicate_stage_rules_insert_system_admin on public.ssn_duplicate_stage_rules;

create policy ssn_duplicate_stage_rules_insert_system_admin
on public.ssn_duplicate_stage_rules
for insert
to authenticated
with check (public.has_role('system_admin'));

drop policy if exists ssn_duplicate_stage_rules_update_system_admin on public.ssn_duplicate_stage_rules;

create policy ssn_duplicate_stage_rules_update_system_admin
on public.ssn_duplicate_stage_rules
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));

drop policy if exists ssn_duplicate_stage_rules_delete_system_admin on public.ssn_duplicate_stage_rules;

create policy ssn_duplicate_stage_rules_delete_system_admin
on public.ssn_duplicate_stage_rules
for delete
to authenticated
using (public.has_role('system_admin'));

-- END ssn_duplicate_stage_rules.sql

-- BEGIN stage_disposition_map.sql
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

-- END stage_disposition_map.sql

-- BEGIN storage_ticket_attachments_bucket.sql
-- Policy: allow authenticated users to upload files
-- Only call_center_admins creating tickets should be uploading
create policy "Allow authenticated uploads"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'ticket-attachments');

-- Policy: allow authenticated users to read files
create policy "Allow authenticated reads"
on storage.objects
for select
to authenticated
using (bucket_id = 'ticket-attachments');

-- END storage_ticket_attachments_bucket.sql

-- BEGIN ticket_comments_update_policy.sql
-- Allow ticket participants to edit their own comment body (RLS had insert/delete only).
drop policy if exists ticket_comments_update_own on public.ticket_comments;

create policy ticket_comments_update_own
on public.ticket_comments
for update
to authenticated
using (
  user_id = auth.uid()
  and public.ticket_user_has_access(ticket_id, auth.uid())
)
with check (
  user_id = auth.uid()
  and public.ticket_user_has_access(ticket_id, auth.uid())
);

-- END ticket_comments_update_policy.sql

-- BEGIN ticket_user_has_access_add_publisher_manager.sql
-- Restore publisher_manager in ticket_user_has_access.
-- A partial deploy of call-centre visibility dropped the final OR branch; RLS then hid
-- all tickets from publisher_manager users even though the app and roles table expect access.

create or replace function public.ticket_user_has_access(p_ticket_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and (
        t.publisher_id = p_user_id
        or t.assignee_id = p_user_id
        or exists (
          select 1
          from public.ticket_followers tf
          where tf.ticket_id = t.id
            and tf.user_id = p_user_id
        )
        or (
          exists (
            select 1
            from public.users u_viewer
            join public.roles r on r.id = u_viewer.role_id
            where u_viewer.id = p_user_id
              and r.key = 'call_center_admin'
              and u_viewer.call_center_id is not null
          )
          and exists (
            select 1
            from public.leads l
            join public.users u_pub on u_pub.id = t.publisher_id
            join public.users u_viewer on u_viewer.id = p_user_id
            where l.id = t.lead_id
              and l.call_center_id is not null
              and l.call_center_id = u_viewer.call_center_id
              and u_pub.call_center_id is not null
              and u_pub.call_center_id = l.call_center_id
          )
        )
      )
  )
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_user_id
      and r.key = 'system_admin'
  )
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_user_id
      and r.key = 'publisher_manager'
  );
$$;

grant execute on function public.ticket_user_has_access(uuid, uuid) to authenticated;

-- END ticket_user_has_access_add_publisher_manager.sql

-- BEGIN tickets_add_lead_name.sql
-- Add lead_name to tickets and make lead_id nullable
-- Run this in your Supabase SQL Editor

-- Make lead_id nullable (idempotent - safe to run even if already nullable)
alter table public.tickets alter column lead_id drop not null;

-- Add lead_name text column for manual lead name entry
alter table public.tickets add column if not exists lead_name text;

-- Update RLS insert policy to allow tickets without a linked lead
-- (when lead_id is null, we verify via call_center_id instead)
drop policy if exists tickets_insert_publishers on public.tickets;

create policy tickets_insert_publishers
on public.tickets
for insert
to authenticated
with check (
  publisher_id = auth.uid()
  and (
    -- System admin can create any ticket
    public.has_role('system_admin')
    or (
      -- Call center admin: must match call_center_id when lead_id is null,
      -- or match lead's call_center_id when lead_id is provided
      public.has_role('call_center_admin')
      and exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and u.call_center_id is not null
          and (
            -- No lead linked: verify via ticket's call_center_id
            (lead_id is null and call_center_id is not null and call_center_id = u.call_center_id)
            or
            -- Lead linked: verify via lead's call_center_id
            (lead_id is not null and exists (
              select 1
              from public.leads l
              where l.id = lead_id
                and l.call_center_id is not null
                and l.call_center_id = u.call_center_id
            ))
          )
      )
    )
  )
);

-- Grant select on new column (already covered by table grant, but explicit for clarity)
grant select, insert, update on public.tickets to authenticated;

-- END tickets_add_lead_name.sql

-- BEGIN tickets_add_type_priority_attachments.sql
-- Add ticket_type, priority, and attachments to tickets table
-- Run this in your Supabase SQL Editor

-- Ticket type enum (idempotent create)
do $$
begin
  create type public.ticket_type as enum ('general', 'billing', 'technical', 'escalation', 'compliance');
exception
  when duplicate_object then null;
end$$;

-- Add 'lead_inquiry' to existing enum (safe to run multiple times)
-- Note: PostgreSQL allows adding values to enums only at the end
do $$
begin
  alter type public.ticket_type add value if not exists 'lead_inquiry';
exception
  when duplicate_object then null;
end$$;

-- Priority enum
do $$
begin
  create type public.ticket_priority as enum ('low', 'medium', 'high', 'urgent');
exception
  when duplicate_object then null;
end$$;

-- Add columns to tickets table
alter table public.tickets
  add column if not exists ticket_type public.ticket_type null,
  add column if not exists priority public.ticket_priority null default 'medium'::ticket_priority,
  add column if not exists attachments jsonb null default '[]'::jsonb,
  add column if not exists call_center_id uuid null references public.call_centers (id) on delete set null;

-- Index for filtering by call center
create index if not exists tickets_call_center_id_idx on public.tickets (call_center_id);

-- Update RLS insert policy to allow call_center_admin to create tickets
-- (they must be in the same call center as the lead)
drop policy if exists tickets_insert_publishers on public.tickets;

create policy tickets_insert_publishers
on public.tickets
for insert
to authenticated
with check (
  publisher_id = auth.uid()
  and exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and (
        public.has_role('system_admin')
        or (
          public.has_role('call_center_admin')
          and l.call_center_id is not null
          and exists (
            select 1
            from public.users u
            where u.id = auth.uid()
              and u.call_center_id is not null
              and u.call_center_id = l.call_center_id
          )
        )
      )
  )
);

-- Grant select on new columns (already covered by table grant, but explicit for clarity)
grant select, insert, update on public.tickets to authenticated;

-- END tickets_add_type_priority_attachments.sql

-- BEGIN tickets_assignee_department.sql
-- Ticket assignee: default to the department's Publisher Manager (single department row for now).
-- Replaces routing-rule + publisher.manager_user_id logic in tickets_apply_default_assignee.
-- Prerequisite: departments_module.sql (departments.publisher_manager_user_id).

create or replace function public.tickets_apply_default_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pm uuid;
begin
  if new.assignee_id is not null then
    return new;
  end if;

  select d.publisher_manager_user_id
  into v_pm
  from public.departments d
  where d.publisher_manager_user_id is not null
  order by d.created_at asc
  limit 1;

  if v_pm is not null then
    new.assignee_id := v_pm;
  end if;

  return new;
end;
$$;

-- Trigger already exists from tickets_module.sql; ensure it points at this function body.
drop trigger if exists trg_tickets_apply_routing on public.tickets;

create trigger trg_tickets_apply_routing
before insert on public.tickets
for each row execute function public.tickets_apply_default_assignee();

-- END tickets_assignee_department.sql

-- BEGIN tickets_auto_assign_publisher_manager.sql
-- Update auto-assign trigger to assign tickets to publisher_manager role
-- Run this in your Supabase SQL Editor

-- ---------------------------------------------------------------------------
-- Auto-assign: routing rules (lead-linked only), then any publisher_manager
-- ---------------------------------------------------------------------------
create or replace function public.tickets_apply_default_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_country text;
  v_region text;
  v_language text;
  v_rule_user uuid;
  v_manager uuid;
begin
  if new.assignee_id is not null then
    return new;
  end if;

  -- Routing rules only apply when a lead is linked
  if new.lead_id is not null then
    select lower(trim(cc.country)), lower(trim(cc.region)), lower(trim(l.language))
    into v_country, v_region, v_language
    from public.leads l
    left join public.call_centers cc on cc.id = l.call_center_id
    where l.id = new.lead_id;

    select r.assignee_user_id
    into v_rule_user
    from public.ticket_routing_rules r
    where r.is_active
      and (
        (r.rule_kind = 'country' and v_country is not null and v_country = lower(trim(r.match_value)))
        or (r.rule_kind = 'region' and v_region is not null and v_region = lower(trim(r.match_value)))
        or (r.rule_kind = 'language' and v_language is not null and v_language = lower(trim(r.match_value)))
      )
    order by r.priority asc, r.created_at asc
    limit 1;

    if v_rule_user is not null then
      new.assignee_id := v_rule_user;
      return new;
    end if;
  end if;

  -- Fallback: assign to a publisher_manager user
  -- Prefer one in the same call center if ticket has call_center_id
  select u.id
  into v_manager
  from public.users u
  join public.roles r on r.id = u.role_id
  where r.key = 'publisher_manager'
  order by
    case when new.call_center_id is not null and u.call_center_id = new.call_center_id then 0 else 1 end,
    u.created_at asc
  limit 1;

  if v_manager is not null then
    new.assignee_id := v_manager;
  end if;

  return new;
end;
$$;

-- Recreate trigger to ensure it uses the updated function
drop trigger if exists trg_tickets_apply_routing on public.tickets;

create trigger trg_tickets_apply_routing
before insert on public.tickets
for each row execute function public.tickets_apply_default_assignee();

-- END tickets_auto_assign_publisher_manager.sql

-- BEGIN tickets_call_center_visibility.sql
-- Allow call center admins to read (and comment on) support tickets for leads in their center
-- when the ticket was published by any user from that same call center.
-- Keeps publisher_manager / assignee visibility unchanged.

create or replace function public.ticket_user_has_access(p_ticket_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and (
        t.publisher_id = p_user_id
        or t.assignee_id = p_user_id
        or exists (
          select 1
          from public.ticket_followers tf
          where tf.ticket_id = t.id
            and tf.user_id = p_user_id
        )
        or (
          exists (
            select 1
            from public.users u_viewer
            join public.roles r on r.id = u_viewer.role_id
            where u_viewer.id = p_user_id
              and r.key = 'call_center_admin'
              and u_viewer.call_center_id is not null
          )
          and exists (
            select 1
            from public.leads l
            join public.users u_pub on u_pub.id = t.publisher_id
            join public.users u_viewer on u_viewer.id = p_user_id
            where l.id = t.lead_id
              and l.call_center_id is not null
              and l.call_center_id = u_viewer.call_center_id
              and u_pub.call_center_id is not null
              and u_pub.call_center_id = l.call_center_id
          )
        )
      )
  )
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_user_id
      and r.key = 'system_admin'
  )
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_user_id
      and r.key = 'publisher_manager'
  );
$$;

-- END tickets_call_center_visibility.sql

-- BEGIN users_department_id.sql
-- Link users (e.g. Publisher Manager) to a department.
-- Prerequisite: public.departments from departments_module.sql.

alter table public.users
  add column if not exists department_id uuid references public.departments (id) on delete set null;

create index if not exists idx_users_department_id on public.users (department_id);

comment on column public.users.department_id is
  'Department for publisher_manager and related roles (publisher management).';

-- END users_department_id.sql

-- BEGIN call_centers_rls_allow_authenticated_read.sql
-- Allow all authenticated users to read call centers (needed for slack channel lookup)
drop policy if exists call_centers_select_authenticated on public.call_centers;

create policy call_centers_select_authenticated
on public.call_centers
for select
to authenticated
using (true);

-- END call_centers_rls_allow_authenticated_read.sql

-- BEGIN call_centers_rls_allow_call_center_admin_update.sql
-- Allow call center admins to read and update call centers.
-- Existing system_admin policies remain in place.

drop policy if exists call_centers_select_call_center_admin on public.call_centers;

create policy call_centers_select_call_center_admin
on public.call_centers
for select
to authenticated
using (public.has_role('call_center_admin'));

drop policy if exists call_centers_update_call_center_admin on public.call_centers;

create policy call_centers_update_call_center_admin
on public.call_centers
for update
to authenticated
using (public.has_role('call_center_admin'))
with check (public.has_role('call_center_admin'));

-- END call_centers_rls_allow_call_center_admin_update.sql

-- BEGIN daily_deal_flow_rls_scope.sql
-- Scope daily_deal_flow: role-based access, with call-center scoping.

drop policy if exists daily_deal_flow_select_authenticated on public.daily_deal_flow;

drop policy if exists daily_deal_flow_insert_authenticated on public.daily_deal_flow;

drop policy if exists daily_deal_flow_update_authenticated on public.daily_deal_flow;

drop policy if exists daily_deal_flow_delete_authenticated on public.daily_deal_flow;

drop policy if exists daily_deal_flow_select_scoped on public.daily_deal_flow;

drop policy if exists daily_deal_flow_insert_scoped on public.daily_deal_flow;

drop policy if exists daily_deal_flow_update_scoped on public.daily_deal_flow;

drop policy if exists daily_deal_flow_delete_scoped on public.daily_deal_flow;

-- Ensure call_center_id exists for scoping (safe to rerun).
alter table public.daily_deal_flow
add column if not exists call_center_id uuid null references public.call_centers(id);

create index if not exists idx_daily_deal_flow_call_center_id
on public.daily_deal_flow(call_center_id);

-- Helper: current user's call_center_id (null if missing).
create or replace function public.current_user_call_center_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.call_center_id
  from public.users u
  where u.id = auth.uid();
$$;

-- ── SELECT ───────────────────────────────────────────────────────────────────
create policy daily_deal_flow_select_global
on public.daily_deal_flow
for select
to authenticated
using (
  public.has_any_role(array[
    'system_admin',
    'sales_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
);

create policy daily_deal_flow_select_call_center
on public.daily_deal_flow
for select
to authenticated
using (
  public.has_any_role(array['call_center_admin', 'call_center_agent'])
  and call_center_id is not null
  and call_center_id = public.current_user_call_center_id()
);

-- ── INSERT ───────────────────────────────────────────────────────────────────
create policy daily_deal_flow_insert_global
on public.daily_deal_flow
for insert
to authenticated
with check (
  public.has_any_role(array[
    'system_admin',
    'sales_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
);

create policy daily_deal_flow_insert_call_center
on public.daily_deal_flow
for insert
to authenticated
with check (
  public.has_any_role(array['call_center_admin', 'call_center_agent'])
  and call_center_id is not null
  and call_center_id = public.current_user_call_center_id()
);

-- ── UPDATE ───────────────────────────────────────────────────────────────────
create policy daily_deal_flow_update_global
on public.daily_deal_flow
for update
to authenticated
using (
  public.has_any_role(array[
    'system_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
)
with check (
  public.has_any_role(array[
    'system_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
);

create policy daily_deal_flow_update_call_center
on public.daily_deal_flow
for update
to authenticated
using (
  public.has_any_role(array['call_center_admin', 'call_center_agent'])
  and call_center_id is not null
  and call_center_id = public.current_user_call_center_id()
)
with check (
  public.has_any_role(array['call_center_admin', 'call_center_agent'])
  and call_center_id is not null
  and call_center_id = public.current_user_call_center_id()
);

-- ── DELETE ───────────────────────────────────────────────────────────────────
create policy daily_deal_flow_delete_global
on public.daily_deal_flow
for delete
to authenticated
using (
  public.has_any_role(array[
    'system_admin',
    'sales_manager',
    'hr',
    'accounting'
  ])
);

create policy daily_deal_flow_delete_call_center
on public.daily_deal_flow
for delete
to authenticated
using (
  public.has_any_role(array['call_center_admin', 'call_center_agent'])
  and call_center_id is not null
  and call_center_id = public.current_user_call_center_id()
);

-- END daily_deal_flow_rls_scope.sql

-- BEGIN leads_rls_add_sales_read_access.sql
-- Allow sales roles to read all leads (cross-center visibility).
-- Keeps existing behavior for submitter, system_admin, hr, and call-center roles.

drop policy if exists leads_select_own_or_admin_or_call_center on public.leads;

create policy leads_select_own_or_admin_or_call_center
on public.leads
for select
to authenticated
using (
  submitted_by = auth.uid()
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (
        array[
          'system_admin',
          'hr',
          'call_center_admin',
          'call_center_agent',
          'sales_admin',
          'sales_manager',
          'sales_agent_licensed',
          'sales_agent_unlicensed'
        ]::text[]
      )
  )
);

-- END leads_rls_add_sales_read_access.sql

-- BEGIN leads_rls_add_update_access.sql
-- Allow transfer/call workflows to update lead rows under RLS.
-- Mirrors role scope from leads_select_own_or_admin_or_call_center, plus submitter ownership.

alter table public.leads enable row level security;

drop policy if exists leads_update_own_or_admin_or_call_center on public.leads;

create policy leads_update_own_or_admin_or_call_center
on public.leads
for update
to authenticated
using (
  submitted_by = auth.uid()
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (
        array[
          'system_admin',
          'hr',
          'call_center_admin',
          'call_center_agent',
          'sales_admin',
          'sales_manager',
          'sales_agent_licensed',
          'sales_agent_unlicensed'
        ]::text[]
      )
  )
)
with check (
  submitted_by = auth.uid()
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (
        array[
          'system_admin',
          'hr',
          'call_center_admin',
          'call_center_agent',
          'sales_admin',
          'sales_manager',
          'sales_agent_licensed',
          'sales_agent_unlicensed'
        ]::text[]
      )
  )
);

grant update on public.leads to authenticated;

-- END leads_rls_add_update_access.sql

-- BEGIN policies_rls_authenticated.sql
-- Fix: "new row violates row-level security policy for table policies" (42501) on insert/update from the agent portal.
-- The browser uses the Supabase `authenticated` role. Align with other CRM tables (e.g. call_results) that allow
-- authenticated read/write for portal workflows.
--
-- Apply in Supabase: SQL Editor → run this script once (after `public.policies` exists).

alter table public.policies enable row level security;

drop policy if exists policies_rw_authenticated on public.policies;

create policy policies_rw_authenticated
on public.policies
for all
to authenticated
using (true)
with check (true);

grant select, insert, update, delete on table public.policies to authenticated;

-- Serial / identity default for id (safe if the sequence name differs — ignore errors in that case)
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
      and c.relname = 'policies_id_seq'
  ) then
    execute 'grant usage, select on sequence public.policies_id_seq to authenticated';
  end if;
end $$;

-- END policies_rls_authenticated.sql

-- BEGIN tickets_rls_insert_publisher_center_admin.sql
-- One-off: tighten ticket INSERT to call_center_admin (same center as lead) or system_admin.
-- Run after tickets_module.sql if you already deployed the older submitter-based policy.

drop policy if exists tickets_insert_publishers on public.tickets;

create policy tickets_insert_publishers
on public.tickets
for insert
to authenticated
with check (
  publisher_id = auth.uid()
  and exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and (
        public.has_role('system_admin')
        or (
          public.has_role('call_center_admin')
          and l.call_center_id is not null
          and exists (
            select 1
            from public.users u
            where u.id = auth.uid()
              and u.call_center_id is not null
              and u.call_center_id = l.call_center_id
          )
        )
      )
  )
);

-- END tickets_rls_insert_publisher_center_admin.sql

-- BEGIN users_rls_allow_active_read.sql
-- Allow authenticated users to read active users for dropdowns
-- This is needed for Daily Deal Flow agent dropdowns

drop policy if exists users_select_active_authenticated on public.users;

create policy users_select_active_authenticated
on public.users
for select
to authenticated
using (status = 'active');

-- END users_rls_allow_active_read.sql

-- BEGIN users_rls_explicit_system_admin_access.sql
-- Cleanup: these explicit policies are now redundant.
-- system_admin SELECT is covered by users_select_system_admin_all in authentication_module.sql.
-- system_admin UPDATE is covered by users_update_admin_hr in authentication_module.sql.
drop policy if exists users_select_system_admin_explicit on public.users;

drop policy if exists users_update_system_admin_explicit on public.users;

-- END users_rls_explicit_system_admin_access.sql
