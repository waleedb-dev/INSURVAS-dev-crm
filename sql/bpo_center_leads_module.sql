-- BPO centre-as-lead: isolated schema (no public.leads, no public.call_centers FKs).
-- Replaces legacy bpo_onboarding_* tables. Safe to run once; drops old onboarding objects.
-- Prerequisites: authentication_module.sql (set_updated_at, has_any_role, auth.users).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tear down previous onboarding module (if present) — CASCADE drops triggers
-- ---------------------------------------------------------------------------

drop table if exists public.bpo_onboarding_offboarding_events cascade;
drop table if exists public.bpo_onboarding_resources cascade;
drop table if exists public.bpo_onboarding_call_updates cascade;
drop table if exists public.bpo_onboarding_credentials cascade;
drop table if exists public.bpo_onboarding_roster_members cascade;
drop table if exists public.bpo_onboarding_invites cascade;
drop table if exists public.bpo_onboarding_opportunities cascade;

drop function if exists public.bpo_onboarding_sync_last_call_from_update();
drop function if exists public.bpo_onboarding_public_get(uuid);
drop function if exists public.bpo_onboarding_public_submit(uuid, text, jsonb);
drop function if exists public.bpo_onboarding_staff();

-- Idempotent: remove prior bpo_center_lead_* if re-running this migration
drop table if exists public.bpo_center_lead_offboarding_events cascade;
drop table if exists public.bpo_center_lead_resources cascade;
drop table if exists public.bpo_center_lead_notes cascade;
drop table if exists public.bpo_center_lead_call_results cascade;
drop table if exists public.bpo_center_lead_credentials cascade;
drop table if exists public.bpo_center_lead_team_members cascade;
drop table if exists public.bpo_center_lead_invites cascade;
drop table if exists public.bpo_center_leads cascade;

drop function if exists public.bpo_center_lead_sync_last_call();
drop function if exists public.bpo_center_lead_public_get(uuid);
drop function if exists public.bpo_center_lead_public_submit(uuid, text, jsonb);
drop function if exists public.bpo_center_lead_staff();

-- ---------------------------------------------------------------------------
-- Core: one row per centre treated as a “lead”
-- ---------------------------------------------------------------------------

create table public.bpo_center_leads (
  id uuid primary key default gen_random_uuid(),
  centre_display_name text not null default '',
  stage text not null default 'pre_onboarding'
    constraint bpo_center_leads_stage_chk check (
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
  linked_crm_centre_label text null,
  lead_vendor_label text null,
  opportunity_source text null,
  expected_start_date date null,
  committed_daily_sales integer null,
  closer_count integer null,
  buyer_details text null,
  daily_sales_generation_notes text null,
  trending_metrics_notes text null,
  owner_manager_contact_notes text null,
  last_disposition_text text null,
  last_call_result text null
    constraint bpo_center_leads_last_call_chk check (
      last_call_result is null or last_call_result = any (array['call_completed'::text, 'no_pickup'::text])
    ),
  last_call_result_at timestamptz null,
  form_submitted_at timestamptz null,
  country text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users (id),
  updated_by uuid null references auth.users (id)
);

create index idx_bpo_center_leads_stage on public.bpo_center_leads (stage);
create index idx_bpo_center_leads_created_at on public.bpo_center_leads (created_at desc);

comment on table public.bpo_center_leads is 'BPO centre modelled as its own lead record; not linked to public.leads.';

-- ---------------------------------------------------------------------------
-- Magic-link intake (sent to external contact)
-- ---------------------------------------------------------------------------

create table public.bpo_center_lead_invites (
  id uuid primary key default gen_random_uuid(),
  center_lead_id uuid not null references public.bpo_center_leads (id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users (id),
  constraint bpo_center_lead_invites_token_key unique (token)
);

create index idx_bpo_center_lead_invites_lead on public.bpo_center_lead_invites (center_lead_id);

-- ---------------------------------------------------------------------------
-- Team: centre admin + members (from intake form or staff edits)
-- ---------------------------------------------------------------------------

create table public.bpo_center_lead_team_members (
  id uuid primary key default gen_random_uuid(),
  center_lead_id uuid not null references public.bpo_center_leads (id) on delete cascade,
  member_kind text not null default 'team_member'
    constraint bpo_center_lead_team_kind_chk check (
      member_kind = any (array['center_admin'::text, 'team_member'::text])
    ),
  full_name text not null,
  email text not null,
  phone text null,
  position_key text not null
    constraint bpo_center_lead_team_position_chk check (
      position_key = any (array['owner'::text, 'manager'::text, 'closer'::text, 'custom'::text])
    ),
  custom_position_label text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint bpo_center_lead_team_custom_chk check (
    (position_key <> 'custom'::text or (custom_position_label is not null and length(trim(custom_position_label)) > 0))
  )
);

create index idx_bpo_center_lead_team_lead on public.bpo_center_lead_team_members (center_lead_id);

create unique index bpo_center_lead_one_admin
  on public.bpo_center_lead_team_members (center_lead_id)
  where member_kind = 'center_admin'::text;

-- ---------------------------------------------------------------------------
-- Credentials log (Slack / CRM / DID snapshots)
-- ---------------------------------------------------------------------------

create table public.bpo_center_lead_credentials (
  id uuid primary key default gen_random_uuid(),
  center_lead_id uuid not null references public.bpo_center_leads (id) on delete cascade,
  slack_account_details text null,
  crm_access_details text null,
  did_number text null,
  other_notes text null,
  logged_at timestamptz not null default now(),
  logged_by uuid null references auth.users (id)
);

create index idx_bpo_center_lead_credentials_lead on public.bpo_center_lead_credentials (center_lead_id);

-- ---------------------------------------------------------------------------
-- Call results (full history; separate from denormalised fields on lead row)
-- ---------------------------------------------------------------------------

create table public.bpo_center_lead_call_results (
  id uuid primary key default gen_random_uuid(),
  center_lead_id uuid not null references public.bpo_center_leads (id) on delete cascade,
  result_code text not null
    constraint bpo_center_lead_call_result_code_chk check (
      result_code = any (array['call_completed'::text, 'no_pickup'::text])
    ),
  notes text null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid null references auth.users (id)
);

create index idx_bpo_center_lead_call_results_lead on public.bpo_center_lead_call_results (center_lead_id);
create index idx_bpo_center_lead_call_results_recorded on public.bpo_center_lead_call_results (recorded_at desc);

-- ---------------------------------------------------------------------------
-- Notes tab (separate table from public.lead_notes)
-- ---------------------------------------------------------------------------

create table public.bpo_center_lead_notes (
  id uuid primary key default gen_random_uuid(),
  center_lead_id uuid not null references public.bpo_center_leads (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users (id),
  updated_by uuid null references auth.users (id)
);

create index idx_bpo_center_lead_notes_lead on public.bpo_center_lead_notes (center_lead_id);

drop trigger if exists trg_bpo_center_lead_notes_updated_at on public.bpo_center_lead_notes;
create trigger trg_bpo_center_lead_notes_updated_at
before update on public.bpo_center_lead_notes
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Resources (universal library vs per–centre-lead)
-- ---------------------------------------------------------------------------

create table public.bpo_center_lead_resources (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'universal'
    constraint bpo_center_lead_res_scope_chk check (
      scope = any (array['universal'::text, 'lead'::text])
    ),
  center_lead_id uuid null references public.bpo_center_leads (id) on delete cascade,
  title text not null,
  description text null,
  content_kind text not null default 'link'
    constraint bpo_center_lead_res_kind_chk check (
      content_kind = any (array['file'::text, 'video'::text, 'link'::text])
    ),
  storage_path text null,
  external_url text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users (id),
  constraint bpo_center_lead_res_scope_fk_chk check (
    (scope = 'universal'::text and center_lead_id is null)
    or (scope = 'lead'::text and center_lead_id is not null)
  )
);

create index idx_bpo_center_lead_resources_scope on public.bpo_center_lead_resources (scope);
create index idx_bpo_center_lead_resources_lead on public.bpo_center_lead_resources (center_lead_id);

-- ---------------------------------------------------------------------------
-- DQED / offboarding audit
-- ---------------------------------------------------------------------------

create table public.bpo_center_lead_offboarding_events (
  id uuid primary key default gen_random_uuid(),
  center_lead_id uuid not null references public.bpo_center_leads (id) on delete cascade,
  confirmation_phrase text not null,
  summary text not null,
  created_at timestamptz not null default now(),
  performed_by uuid null references auth.users (id)
);

create index idx_bpo_center_lead_offb_lead on public.bpo_center_lead_offboarding_events (center_lead_id);

-- ---------------------------------------------------------------------------
-- Lead row: updated_at + last call denormalisation
-- ---------------------------------------------------------------------------

drop trigger if exists trg_bpo_center_leads_updated_at on public.bpo_center_leads;
create trigger trg_bpo_center_leads_updated_at
before update on public.bpo_center_leads
for each row execute function public.set_updated_at();

create or replace function public.bpo_center_lead_sync_last_call()
returns trigger
language plpgsql
as $$
begin
  update public.bpo_center_leads
  set
    last_call_result = new.result_code,
    last_call_result_at = new.recorded_at,
    updated_at = now()
  where id = new.center_lead_id;
  return new;
end;
$$;

drop trigger if exists trg_bpo_center_lead_call_sync on public.bpo_center_lead_call_results;
create trigger trg_bpo_center_lead_call_sync
after insert on public.bpo_center_lead_call_results
for each row execute function public.bpo_center_lead_sync_last_call();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

create or replace function public.bpo_center_lead_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('system_admin'::text);
$$;

grant execute on function public.bpo_center_lead_staff() to authenticated;

grant select, insert, update, delete on public.bpo_center_leads to authenticated;
grant select, insert, update, delete on public.bpo_center_lead_invites to authenticated;
grant select, insert, update, delete on public.bpo_center_lead_team_members to authenticated;
grant select, insert, update, delete on public.bpo_center_lead_credentials to authenticated;
grant select, insert, update, delete on public.bpo_center_lead_call_results to authenticated;
grant select, insert, update, delete on public.bpo_center_lead_notes to authenticated;
grant select, insert, update, delete on public.bpo_center_lead_resources to authenticated;
grant select, insert, update, delete on public.bpo_center_lead_offboarding_events to authenticated;

alter table public.bpo_center_leads enable row level security;
alter table public.bpo_center_lead_invites enable row level security;
alter table public.bpo_center_lead_team_members enable row level security;
alter table public.bpo_center_lead_credentials enable row level security;
alter table public.bpo_center_lead_call_results enable row level security;
alter table public.bpo_center_lead_notes enable row level security;
alter table public.bpo_center_lead_resources enable row level security;
alter table public.bpo_center_lead_offboarding_events enable row level security;

-- Leads
drop policy if exists bcl_leads_select on public.bpo_center_leads;
create policy bcl_leads_select on public.bpo_center_leads for select to authenticated using (public.bpo_center_lead_staff());
drop policy if exists bcl_leads_mutate on public.bpo_center_leads;
create policy bcl_leads_mutate on public.bpo_center_leads for all to authenticated using (public.bpo_center_lead_staff()) with check (public.bpo_center_lead_staff());

-- Invites
drop policy if exists bcl_inv_select on public.bpo_center_lead_invites;
create policy bcl_inv_select on public.bpo_center_lead_invites for select to authenticated using (public.bpo_center_lead_staff());
drop policy if exists bcl_inv_mutate on public.bpo_center_lead_invites;
create policy bcl_inv_mutate on public.bpo_center_lead_invites for all to authenticated using (public.bpo_center_lead_staff()) with check (public.bpo_center_lead_staff());

-- Team
drop policy if exists bcl_team_select on public.bpo_center_lead_team_members;
create policy bcl_team_select on public.bpo_center_lead_team_members for select to authenticated using (public.bpo_center_lead_staff());
drop policy if exists bcl_team_mutate on public.bpo_center_lead_team_members;
create policy bcl_team_mutate on public.bpo_center_lead_team_members for all to authenticated using (public.bpo_center_lead_staff()) with check (public.bpo_center_lead_staff());

-- Credentials
drop policy if exists bcl_cred_select on public.bpo_center_lead_credentials;
create policy bcl_cred_select on public.bpo_center_lead_credentials for select to authenticated using (public.bpo_center_lead_staff());
drop policy if exists bcl_cred_mutate on public.bpo_center_lead_credentials;
create policy bcl_cred_mutate on public.bpo_center_lead_credentials for all to authenticated using (public.bpo_center_lead_staff()) with check (public.bpo_center_lead_staff());

-- Call results
drop policy if exists bcl_call_select on public.bpo_center_lead_call_results;
create policy bcl_call_select on public.bpo_center_lead_call_results for select to authenticated using (public.bpo_center_lead_staff());
drop policy if exists bcl_call_mutate on public.bpo_center_lead_call_results;
create policy bcl_call_mutate on public.bpo_center_lead_call_results for all to authenticated using (public.bpo_center_lead_staff()) with check (public.bpo_center_lead_staff());

-- Notes
drop policy if exists bcl_note_select on public.bpo_center_lead_notes;
create policy bcl_note_select on public.bpo_center_lead_notes for select to authenticated using (public.bpo_center_lead_staff());
drop policy if exists bcl_note_mutate on public.bpo_center_lead_notes;
create policy bcl_note_mutate on public.bpo_center_lead_notes for all to authenticated using (public.bpo_center_lead_staff()) with check (public.bpo_center_lead_staff());

-- Resources
drop policy if exists bcl_res_select on public.bpo_center_lead_resources;
create policy bcl_res_select on public.bpo_center_lead_resources for select to authenticated using (public.bpo_center_lead_staff());
drop policy if exists bcl_res_mutate on public.bpo_center_lead_resources;
create policy bcl_res_mutate on public.bpo_center_lead_resources for all to authenticated using (public.bpo_center_lead_staff()) with check (public.bpo_center_lead_staff());

-- Offboarding
drop policy if exists bcl_offb_select on public.bpo_center_lead_offboarding_events;
create policy bcl_offb_select on public.bpo_center_lead_offboarding_events for select to authenticated using (public.bpo_center_lead_staff());
drop policy if exists bcl_offb_mutate on public.bpo_center_lead_offboarding_events;
create policy bcl_offb_mutate on public.bpo_center_lead_offboarding_events for all to authenticated using (public.bpo_center_lead_staff()) with check (public.bpo_center_lead_staff());

-- ---------------------------------------------------------------------------
-- Public RPCs (intake form)
-- Roster JSON: [{ full_name, email, phone?, position_key, custom_position_label?, is_center_admin }]
-- Exactly one row must have is_center_admin true.
-- ---------------------------------------------------------------------------

create or replace function public.bpo_center_lead_public_get(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_expires timestamptz;
  v_row public.bpo_center_leads%rowtype;
  v_team jsonb;
begin
  select i.center_lead_id, i.expires_at into v_lead_id, v_expires
  from public.bpo_center_lead_invites i
  where i.token = p_token;

  if v_lead_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_expires is not null and v_expires < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select * into v_row from public.bpo_center_leads l where l.id = v_lead_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'full_name', m.full_name,
      'email', m.email,
      'phone', m.phone,
      'position_key', m.position_key,
      'custom_position_label', m.custom_position_label,
      'is_center_admin', (m.member_kind = 'center_admin')
    ) order by m.sort_order, m.created_at
  ), '[]'::jsonb)
  into v_team
  from public.bpo_center_lead_team_members m
  where m.center_lead_id = v_lead_id;

  return jsonb_build_object(
    'ok', true,
    'centre_display_name', v_row.centre_display_name,
    'form_submitted_at', v_row.form_submitted_at,
    'team', v_team
  );
end;
$$;

grant execute on function public.bpo_center_lead_public_get(uuid) to anon, authenticated;

create or replace function public.bpo_center_lead_public_submit(
  p_token uuid,
  p_centre_display_name text,
  p_team jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_expires timestamptz;
  v_el jsonb;
  v_pos text;
  v_custom text;
  v_name text;
  v_email text;
  v_phone text;
  v_admin bool;
  v_admin_count integer := 0;
  v_sort integer := 0;
  v_kind text;
begin
  if p_centre_display_name is null or length(trim(p_centre_display_name)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'centre_name_required');
  end if;

  if p_team is null or jsonb_typeof(p_team) <> 'array' or jsonb_array_length(p_team) = 0 then
    return jsonb_build_object('ok', false, 'error', 'team_required');
  end if;

  select i.center_lead_id, i.expires_at into v_lead_id, v_expires
  from public.bpo_center_lead_invites i
  where i.token = p_token;

  if v_lead_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_expires is not null and v_expires < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  -- Validate team + count admins
  for v_el in select value from jsonb_array_elements(p_team)
  loop
    v_sort := v_sort + 1;
    v_name := trim(coalesce(v_el->>'full_name', ''));
    v_email := lower(trim(coalesce(v_el->>'email', '')));
    v_phone := nullif(trim(coalesce(v_el->>'phone', '')), '');
    v_pos := lower(trim(coalesce(v_el->>'position_key', '')));
    v_custom := nullif(trim(coalesce(v_el->>'custom_position_label', '')), '');
    v_admin := coalesce((v_el->>'is_center_admin')::boolean, false);

    if v_admin then
      v_admin_count := v_admin_count + 1;
    end if;

    if length(v_name) = 0 or length(v_email) = 0 then
      return jsonb_build_object('ok', false, 'error', 'team_name_email_required');
    end if;

    if v_pos not in ('owner', 'manager', 'closer', 'custom') then
      return jsonb_build_object('ok', false, 'error', 'team_invalid_position');
    end if;

    if v_pos = 'custom' and (v_custom is null or length(v_custom) = 0) then
      return jsonb_build_object('ok', false, 'error', 'team_custom_label_required');
    end if;
  end loop;

  if v_admin_count <> 1 then
    return jsonb_build_object('ok', false, 'error', 'team_exactly_one_admin');
  end if;

  update public.bpo_center_leads
  set
    centre_display_name = trim(p_centre_display_name),
    form_submitted_at = coalesce(form_submitted_at, now()),
    updated_at = now()
  where id = v_lead_id
    and stage <> 'dqed'::text;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found_or_closed');
  end if;

  delete from public.bpo_center_lead_team_members where center_lead_id = v_lead_id;

  v_sort := 0;
  for v_el in select value from jsonb_array_elements(p_team)
  loop
    v_sort := v_sort + 1;
    v_name := trim(coalesce(v_el->>'full_name', ''));
    v_email := lower(trim(coalesce(v_el->>'email', '')));
    v_phone := nullif(trim(coalesce(v_el->>'phone', '')), '');
    v_pos := lower(trim(coalesce(v_el->>'position_key', '')));
    v_custom := nullif(trim(coalesce(v_el->>'custom_position_label', '')), '');
    v_admin := coalesce((v_el->>'is_center_admin')::boolean, false);
    v_kind := case when v_admin then 'center_admin'::text else 'team_member'::text end;

    insert into public.bpo_center_lead_team_members (
      center_lead_id, member_kind, full_name, email, phone, position_key, custom_position_label, sort_order
    ) values (
      v_lead_id, v_kind, v_name, v_email, v_phone, v_pos,
      case when v_pos = 'custom' then v_custom else null end,
      v_sort
    );
  end loop;

  return jsonb_build_object('ok', true, 'center_lead_id', v_lead_id);
end;
$$;

grant execute on function public.bpo_center_lead_public_submit(uuid, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public intake without token (e.g. shared /onboarding): creates new lead + team
-- ---------------------------------------------------------------------------

drop function if exists public.bpo_center_lead_public_open_submit(text, jsonb);

create or replace function public.bpo_center_lead_public_open_submit(
  p_centre_display_name text,
  p_team jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_el jsonb;
  v_pos text;
  v_custom text;
  v_name text;
  v_email text;
  v_phone text;
  v_admin bool;
  v_admin_count integer := 0;
  v_sort integer := 0;
  v_kind text;
begin
  if p_centre_display_name is null or length(trim(p_centre_display_name)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'centre_name_required');
  end if;

  if p_team is null or jsonb_typeof(p_team) <> 'array' or jsonb_array_length(p_team) = 0 then
    return jsonb_build_object('ok', false, 'error', 'team_required');
  end if;

  for v_el in select value from jsonb_array_elements(p_team)
  loop
    v_sort := v_sort + 1;
    v_name := trim(coalesce(v_el->>'full_name', ''));
    v_email := lower(trim(coalesce(v_el->>'email', '')));
    v_phone := nullif(trim(coalesce(v_el->>'phone', '')), '');
    v_pos := lower(trim(coalesce(v_el->>'position_key', '')));
    v_custom := nullif(trim(coalesce(v_el->>'custom_position_label', '')), '');
    v_admin := coalesce((v_el->>'is_center_admin')::boolean, false);

    if v_admin then
      v_admin_count := v_admin_count + 1;
    end if;

    if length(v_name) = 0 or length(v_email) = 0 then
      return jsonb_build_object('ok', false, 'error', 'team_name_email_required');
    end if;

    if v_pos not in ('owner', 'manager', 'closer', 'custom') then
      return jsonb_build_object('ok', false, 'error', 'team_invalid_position');
    end if;

    if v_pos = 'custom' and (v_custom is null or length(v_custom) = 0) then
      return jsonb_build_object('ok', false, 'error', 'team_custom_label_required');
    end if;
  end loop;

  if v_admin_count <> 1 then
    return jsonb_build_object('ok', false, 'error', 'team_exactly_one_admin');
  end if;

  insert into public.bpo_center_leads (
    centre_display_name,
    form_submitted_at,
    stage
  ) values (
    trim(p_centre_display_name),
    now(),
    'pre_onboarding'
  )
  returning id into v_lead_id;

  v_sort := 0;
  for v_el in select value from jsonb_array_elements(p_team)
  loop
    v_sort := v_sort + 1;
    v_name := trim(coalesce(v_el->>'full_name', ''));
    v_email := lower(trim(coalesce(v_el->>'email', '')));
    v_phone := nullif(trim(coalesce(v_el->>'phone', '')), '');
    v_pos := lower(trim(coalesce(v_el->>'position_key', '')));
    v_custom := nullif(trim(coalesce(v_el->>'custom_position_label', '')), '');
    v_admin := coalesce((v_el->>'is_center_admin')::boolean, false);
    v_kind := case when v_admin then 'center_admin'::text else 'team_member'::text end;

    insert into public.bpo_center_lead_team_members (
      center_lead_id, member_kind, full_name, email, phone, position_key, custom_position_label, sort_order
    ) values (
      v_lead_id, v_kind, v_name, v_email, v_phone, v_pos,
      case when v_pos = 'custom' then v_custom else null end,
      v_sort
    );
  end loop;

  return jsonb_build_object('ok', true, 'center_lead_id', v_lead_id);
end;
$$;

grant execute on function public.bpo_center_lead_public_open_submit(text, jsonb) to anon, authenticated;
