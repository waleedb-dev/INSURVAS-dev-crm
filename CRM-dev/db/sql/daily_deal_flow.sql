-- Daily Deal Flow schema aligned to latest BPO game workflow.

drop trigger if exists auto_fetch_recording_trigger on public.daily_deal_flow;
drop trigger if exists sync_to_firestore_webhook on public.daily_deal_flow;
drop table if exists public.daily_deal_flow cascade;

create table public.daily_deal_flow (
  id uuid not null default gen_random_uuid (),
  submission_id text not null,
  client_phone_number text null,
  lead_vendor text null,
  date date null default current_date,
  insured_name text null,
  buffer_agent text null,
  agent text null,
  licensed_agent_account text null,
  status text null,
  call_result text null,
  carrier text null,
  product_type text null,
  draft_date date null,
  monthly_premium numeric(10, 2) null,
  face_amount numeric(12, 2) null,
  from_callback boolean null default false,
  notes text null,
  policy_number text null,
  carrier_audit text null,
  product_type_carrier text null,
  level_or_gi text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  is_callback boolean null default false,
  is_retention_call boolean null default false,
  placement_status text null,
  ghl_location_id text null,
  ghl_opportunity_id text null,
  ghlcontactid text null,
  sync_status text null,
  retention_agent text null,
  retention_agent_id uuid null,
  is_reviewed boolean null default false,
  la_callback text null,
  initial_quote text null,
  constraint daily_deal_flow_pkey primary key (id),
  constraint daily_deal_flow_submission_id_date_key unique (submission_id, date),
  constraint daily_deal_flow_retention_agent_id_fkey foreign key (retention_agent_id) references auth.users (id),
  constraint daily_deal_flow_placement_status_check check (
    (
      placement_status = any (
        array[
          'Good Standing'::text,
          'Not Placed'::text,
          'Pending Failed Payment Fix'::text,
          'FDPF Pending Reason'::text,
          'FDPF Insufficient Funds'::text,
          'FDPF Incorrect Banking Info'::text,
          'FDPF Unauthorized Draft'::text
        ]
      )
    )
  )
) tablespace pg_default;

create index if not exists idx_daily_deal_flow_submission_id on public.daily_deal_flow using btree (submission_id) tablespace pg_default;
create index if not exists idx_daily_deal_flow_date on public.daily_deal_flow using btree (date) tablespace pg_default;
create index if not exists idx_daily_deal_flow_agent on public.daily_deal_flow using btree (agent) tablespace pg_default;
create index if not exists idx_daily_deal_flow_status on public.daily_deal_flow using btree (status) tablespace pg_default;
create index if not exists idx_daily_deal_flow_ghl_location_id on public.daily_deal_flow using btree (ghl_location_id) tablespace pg_default;
create index if not exists idx_daily_deal_flow_ghl_opportunity_id on public.daily_deal_flow using btree (ghl_opportunity_id) tablespace pg_default;

create trigger auto_fetch_recording_trigger
after insert on public.daily_deal_flow for each row
when (
  new.client_phone_number is not null
  and new.client_phone_number <> ''::text
)
execute function fetch_recording_for_new_entry ();

create trigger sync_to_firestore_webhook
after update on public.daily_deal_flow for each row
execute function supabase_functions.http_request (
  'https://gqhcjqxcvhgwsqfqgekh.supabase.co/functions/v1/bpo-game-sync',
  'POST',
  '{"Content-type":"application/json"}',
  '{}',
  '5000'
);
