-- DEPRECATED: replaced by sql/bpo_center_leads_module.sql (centre-as-lead, separate tables).
-- BPO centre onboarding (opportunities, roster, invites, credentials, calls, resources, offboarding).
-- Prerequisites: sql/authentication_module.sql (roles, has_role, users, call_centers).
-- Safe to run multiple times where noted with IF NOT EXISTS / DROP POLICY IF EXISTS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Main onboarding opportunity (separate from sales leads / GHL opportunities)
-- ---------------------------------------------------------------------------

create table if not exists public.bpo_onboarding_opportunities (
  id uuid primary key default gen_random_uuid(),
  center_working_name text not null default '',
  stage text not null default 'pre_onboarding'
    constraint bpo_onboarding_opportunities_stage_chk check (
      stage = any (array[
        'pre_onboarding'::text,
        'ready_for_onboarding_meeting'::text,
        'onboarding_completed'::text,
        'actively_selling'::text,
        'needs_attention'::text,
        'on_pause'::text,
        'dqed'::text
      ])
    ),
  call_center_id uuid null references public.call_centers (id) on delete set null,
  linked_lead_vendor text null,
  expected_start_date date null,
  committed_daily_sales integer null,
  closer_count integer null,
  buyer_details text null,
  daily_sales_generation_notes text null,
  trending_metrics_notes text null,
  owner_manager_contact_notes text null,
  last_disposition_text text null,
  last_call_result text null
    constraint bpo_onboarding_last_call_result_chk check (
      last_call_result is null or last_call_result = any (array['call_completed'::text, 'no_pickup'::text])
    ),
  last_call_result_at timestamptz null,
  form_submitted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users (id),
  updated_by uuid null references auth.users (id)
);

create index if not exists idx_bpo_onboarding_opportunities_stage
  on public.bpo_onboarding_opportunities using btree (stage);

create index if not exists idx_bpo_onboarding_opportunities_call_center_id
  on public.bpo_onboarding_opportunities using btree (call_center_id);

comment on table public.bpo_onboarding_opportunities is
  'BPO centre onboarding pipeline record; link to call_centers once the CRM account exists.';

-- ---------------------------------------------------------------------------
-- Magic-link invites (public form by token)
-- ---------------------------------------------------------------------------

create table if not exists public.bpo_onboarding_invites (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.bpo_onboarding_opportunities (id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users (id),
  constraint bpo_onboarding_invites_token_key unique (token)
);

create index if not exists idx_bpo_onboarding_invites_opportunity_id
  on public.bpo_onboarding_invites using btree (opportunity_id);

-- ---------------------------------------------------------------------------
-- Roster from onboarding form (owner / manager / closer / custom)
-- ---------------------------------------------------------------------------

create table if not exists public.bpo_onboarding_roster_members (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.bpo_onboarding_opportunities (id) on delete cascade,
  full_name text not null,
  email text not null,
  position_key text not null
    constraint bpo_onboarding_roster_position_chk check (
      position_key = any (array['owner'::text, 'manager'::text, 'closer'::text, 'custom'::text])
    ),
  custom_position_label text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint bpo_onboarding_roster_custom_chk check (
    (position_key <> 'custom'::text or (custom_position_label is not null and length(trim(custom_position_label)) > 0))
  )
);

create index if not exists idx_bpo_onboarding_roster_opportunity_id
  on public.bpo_onboarding_roster_members using btree (opportunity_id);

-- ---------------------------------------------------------------------------
-- Credential snapshots (Andra logs Slack / CRM / DID on the opportunity)
-- ---------------------------------------------------------------------------

create table if not exists public.bpo_onboarding_credentials (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.bpo_onboarding_opportunities (id) on delete cascade,
  slack_account_details text null,
  crm_access_details text null,
  did_number text null,
  other_notes text null,
  logged_at timestamptz not null default now(),
  logged_by uuid null references auth.users (id)
);

create index if not exists idx_bpo_onboarding_credentials_opportunity_id
  on public.bpo_onboarding_credentials using btree (opportunity_id);

-- ---------------------------------------------------------------------------
-- Call follow-up tags with timestamp
-- ---------------------------------------------------------------------------

create table if not exists public.bpo_onboarding_call_updates (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.bpo_onboarding_opportunities (id) on delete cascade,
  result text not null
    constraint bpo_onboarding_call_updates_result_chk check (
      result = any (array['call_completed'::text, 'no_pickup'::text])
    ),
  notes text null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid null references auth.users (id)
);

create index if not exists idx_bpo_onboarding_call_updates_opportunity_id
  on public.bpo_onboarding_call_updates using btree (opportunity_id);

create index if not exists idx_bpo_onboarding_call_updates_recorded_at
  on public.bpo_onboarding_call_updates using btree (recorded_at desc);

-- ---------------------------------------------------------------------------
-- Resources (universal or per-centre / per-opportunity metadata)
-- ---------------------------------------------------------------------------

create table if not exists public.bpo_onboarding_resources (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'universal'
    constraint bpo_onboarding_resources_scope_chk check (
      scope = any (array['universal'::text, 'center'::text, 'opportunity'::text])
    ),
  call_center_id uuid null references public.call_centers (id) on delete cascade,
  opportunity_id uuid null references public.bpo_onboarding_opportunities (id) on delete cascade,
  title text not null,
  description text null,
  content_kind text not null default 'link'
    constraint bpo_onboarding_resources_kind_chk check (
      content_kind = any (array['file'::text, 'video'::text, 'link'::text])
    ),
  storage_path text null,
  external_url text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users (id),
  constraint bpo_onboarding_resources_scope_target_chk check (
    (scope = 'universal'::text and call_center_id is null and opportunity_id is null)
    or (scope = 'center'::text and call_center_id is not null)
    or (scope = 'opportunity'::text and opportunity_id is not null)
  )
);

create index if not exists idx_bpo_onboarding_resources_scope
  on public.bpo_onboarding_resources using btree (scope);

create index if not exists idx_bpo_onboarding_resources_call_center_id
  on public.bpo_onboarding_resources using btree (call_center_id);

create index if not exists idx_bpo_onboarding_resources_opportunity_id
  on public.bpo_onboarding_resources using btree (opportunity_id);

-- ---------------------------------------------------------------------------
-- DQED / offboarding audit (confirmation text stored for compliance)
-- ---------------------------------------------------------------------------

create table if not exists public.bpo_onboarding_offboarding_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.bpo_onboarding_opportunities (id) on delete cascade,
  call_center_id uuid null references public.call_centers (id) on delete set null,
  confirmation_phrase text not null,
  summary text not null,
  created_at timestamptz not null default now(),
  performed_by uuid null references auth.users (id)
);

create index if not exists idx_bpo_onboarding_offboarding_opportunity_id
  on public.bpo_onboarding_offboarding_events using btree (opportunity_id);

-- ---------------------------------------------------------------------------
-- updated_at + denormalised last call fields
-- ---------------------------------------------------------------------------

drop trigger if exists trg_bpo_onboarding_opportunities_updated_at on public.bpo_onboarding_opportunities;
create trigger trg_bpo_onboarding_opportunities_updated_at
before update on public.bpo_onboarding_opportunities
for each row execute function public.set_updated_at();

create or replace function public.bpo_onboarding_sync_last_call_from_update()
returns trigger
language plpgsql
as $$
begin
  update public.bpo_onboarding_opportunities
  set
    last_call_result = new.result,
    last_call_result_at = new.recorded_at,
    updated_at = now()
  where id = new.opportunity_id;
  return new;
end;
$$;

drop trigger if exists trg_bpo_onboarding_call_updates_sync on public.bpo_onboarding_call_updates;
create trigger trg_bpo_onboarding_call_updates_sync
after insert on public.bpo_onboarding_call_updates
for each row execute function public.bpo_onboarding_sync_last_call_from_update();

-- ---------------------------------------------------------------------------
-- RLS helper: publisher / system admin
-- ---------------------------------------------------------------------------

create or replace function public.bpo_onboarding_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array['system_admin'::text, 'publisher_manager'::text]);
$$;

grant execute on function public.bpo_onboarding_staff() to authenticated;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.bpo_onboarding_opportunities to authenticated;
grant select, insert, update, delete on public.bpo_onboarding_invites to authenticated;
grant select, insert, update, delete on public.bpo_onboarding_roster_members to authenticated;
grant select, insert, update, delete on public.bpo_onboarding_credentials to authenticated;
grant select, insert, update, delete on public.bpo_onboarding_call_updates to authenticated;
grant select, insert, update, delete on public.bpo_onboarding_resources to authenticated;
grant select, insert, update, delete on public.bpo_onboarding_offboarding_events to authenticated;

alter table public.bpo_onboarding_opportunities enable row level security;
alter table public.bpo_onboarding_invites enable row level security;
alter table public.bpo_onboarding_roster_members enable row level security;
alter table public.bpo_onboarding_credentials enable row level security;
alter table public.bpo_onboarding_call_updates enable row level security;
alter table public.bpo_onboarding_resources enable row level security;
alter table public.bpo_onboarding_offboarding_events enable row level security;

-- Opportunities
drop policy if exists bpo_onboarding_opps_select on public.bpo_onboarding_opportunities;
create policy bpo_onboarding_opps_select
on public.bpo_onboarding_opportunities
for select to authenticated
using (public.bpo_onboarding_staff());

drop policy if exists bpo_onboarding_opps_mutate on public.bpo_onboarding_opportunities;
create policy bpo_onboarding_opps_mutate
on public.bpo_onboarding_opportunities
for all to authenticated
using (public.bpo_onboarding_staff())
with check (public.bpo_onboarding_staff());

-- Invites
drop policy if exists bpo_onboarding_invites_select on public.bpo_onboarding_invites;
create policy bpo_onboarding_invites_select
on public.bpo_onboarding_invites
for select to authenticated
using (public.bpo_onboarding_staff());

drop policy if exists bpo_onboarding_invites_mutate on public.bpo_onboarding_invites;
create policy bpo_onboarding_invites_mutate
on public.bpo_onboarding_invites
for all to authenticated
using (public.bpo_onboarding_staff())
with check (public.bpo_onboarding_staff());

-- Roster
drop policy if exists bpo_onboarding_roster_select on public.bpo_onboarding_roster_members;
create policy bpo_onboarding_roster_select
on public.bpo_onboarding_roster_members
for select to authenticated
using (public.bpo_onboarding_staff());

drop policy if exists bpo_onboarding_roster_mutate on public.bpo_onboarding_roster_members;
create policy bpo_onboarding_roster_mutate
on public.bpo_onboarding_roster_members
for all to authenticated
using (public.bpo_onboarding_staff())
with check (public.bpo_onboarding_staff());

-- Credentials
drop policy if exists bpo_onboarding_creds_select on public.bpo_onboarding_credentials;
create policy bpo_onboarding_creds_select
on public.bpo_onboarding_credentials
for select to authenticated
using (public.bpo_onboarding_staff());

drop policy if exists bpo_onboarding_creds_mutate on public.bpo_onboarding_credentials;
create policy bpo_onboarding_creds_mutate
on public.bpo_onboarding_credentials
for all to authenticated
using (public.bpo_onboarding_staff())
with check (public.bpo_onboarding_staff());

-- Call updates
drop policy if exists bpo_onboarding_calls_select on public.bpo_onboarding_call_updates;
create policy bpo_onboarding_calls_select
on public.bpo_onboarding_call_updates
for select to authenticated
using (public.bpo_onboarding_staff());

drop policy if exists bpo_onboarding_calls_mutate on public.bpo_onboarding_call_updates;
create policy bpo_onboarding_calls_mutate
on public.bpo_onboarding_call_updates
for all to authenticated
using (public.bpo_onboarding_staff())
with check (public.bpo_onboarding_staff());

-- Resources
drop policy if exists bpo_onboarding_res_select on public.bpo_onboarding_resources;
create policy bpo_onboarding_res_select
on public.bpo_onboarding_resources
for select to authenticated
using (public.bpo_onboarding_staff());

drop policy if exists bpo_onboarding_res_mutate on public.bpo_onboarding_resources;
create policy bpo_onboarding_res_mutate
on public.bpo_onboarding_resources
for all to authenticated
using (public.bpo_onboarding_staff())
with check (public.bpo_onboarding_staff());

-- Offboarding
drop policy if exists bpo_onboarding_offb_select on public.bpo_onboarding_offboarding_events;
create policy bpo_onboarding_offb_select
on public.bpo_onboarding_offboarding_events
for select to authenticated
using (public.bpo_onboarding_staff());

drop policy if exists bpo_onboarding_offb_mutate on public.bpo_onboarding_offboarding_events;
create policy bpo_onboarding_offb_mutate
on public.bpo_onboarding_offboarding_events
for all to authenticated
using (public.bpo_onboarding_staff())
with check (public.bpo_onboarding_staff());

-- ---------------------------------------------------------------------------
-- Public RPCs (anon + authenticated): tokenised onboarding form
-- ---------------------------------------------------------------------------

create or replace function public.bpo_onboarding_public_get(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_opp_id uuid;
  v_expires timestamptz;
  v_row public.bpo_onboarding_opportunities%rowtype;
  v_roster jsonb;
begin
  select i.opportunity_id, i.expires_at
  into v_opp_id, v_expires
  from public.bpo_onboarding_invites i
  where i.token = p_token;

  if v_opp_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_expires is not null and v_expires < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select * into v_row from public.bpo_onboarding_opportunities o where o.id = v_opp_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'full_name', m.full_name,
      'email', m.email,
      'position_key', m.position_key,
      'custom_position_label', m.custom_position_label
    ) order by m.sort_order, m.created_at
  ), '[]'::jsonb)
  into v_roster
  from public.bpo_onboarding_roster_members m
  where m.opportunity_id = v_opp_id;

  return jsonb_build_object(
    'ok', true,
    'center_working_name', v_row.center_working_name,
    'form_submitted_at', v_row.form_submitted_at,
    'roster', v_roster
  );
end;
$$;

grant execute on function public.bpo_onboarding_public_get(uuid) to anon, authenticated;

create or replace function public.bpo_onboarding_public_submit(
  p_token uuid,
  p_center_working_name text,
  p_roster jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opp_id uuid;
  v_expires timestamptz;
  v_el jsonb;
  v_pos text;
  v_custom text;
  v_name text;
  v_email text;
  v_sort integer := 0;
begin
  if p_center_working_name is null or length(trim(p_center_working_name)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'center_name_required');
  end if;

  if p_roster is null or jsonb_typeof(p_roster) <> 'array' or jsonb_array_length(p_roster) = 0 then
    return jsonb_build_object('ok', false, 'error', 'roster_required');
  end if;

  select i.opportunity_id, i.expires_at
  into v_opp_id, v_expires
  from public.bpo_onboarding_invites i
  where i.token = p_token;

  if v_opp_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_expires is not null and v_expires < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  -- Validate entire roster before mutating rows (avoids partial roster after delete).
  for v_el in select value from jsonb_array_elements(p_roster)
  loop
    v_sort := v_sort + 1;
    v_name := trim(coalesce(v_el->>'full_name', ''));
    v_email := lower(trim(coalesce(v_el->>'email', '')));
    v_pos := lower(trim(coalesce(v_el->>'position_key', '')));
    v_custom := nullif(trim(coalesce(v_el->>'custom_position_label', '')), '');

    if length(v_name) = 0 or length(v_email) = 0 then
      return jsonb_build_object('ok', false, 'error', 'roster_name_email_required');
    end if;

    if v_pos not in ('owner', 'manager', 'closer', 'custom') then
      return jsonb_build_object('ok', false, 'error', 'roster_invalid_position');
    end if;

    if v_pos = 'custom' and (v_custom is null or length(v_custom) = 0) then
      return jsonb_build_object('ok', false, 'error', 'roster_custom_label_required');
    end if;
  end loop;

  update public.bpo_onboarding_opportunities
  set
    center_working_name = trim(p_center_working_name),
    form_submitted_at = coalesce(form_submitted_at, now()),
    updated_at = now()
  where id = v_opp_id
    and stage <> 'dqed'::text;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found_or_closed');
  end if;

  delete from public.bpo_onboarding_roster_members where opportunity_id = v_opp_id;

  v_sort := 0;
  for v_el in select value from jsonb_array_elements(p_roster)
  loop
    v_sort := v_sort + 1;
    v_name := trim(coalesce(v_el->>'full_name', ''));
    v_email := lower(trim(coalesce(v_el->>'email', '')));
    v_pos := lower(trim(coalesce(v_el->>'position_key', '')));
    v_custom := nullif(trim(coalesce(v_el->>'custom_position_label', '')), '');

    insert into public.bpo_onboarding_roster_members (
      opportunity_id, full_name, email, position_key, custom_position_label, sort_order
    ) values (
      v_opp_id, v_name, v_email, v_pos, case when v_pos = 'custom' then v_custom else null end, v_sort
    );
  end loop;

  return jsonb_build_object('ok', true, 'opportunity_id', v_opp_id);
end;
$$;

grant execute on function public.bpo_onboarding_public_submit(uuid, text, jsonb) to anon, authenticated;
