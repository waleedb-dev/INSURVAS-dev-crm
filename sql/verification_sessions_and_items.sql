-- Verification sessions + items (buffer/LA verification workflow)
-- Adds public.leads.submission_id (stable business key for FK).

-- 1) submission_id on leads: backfill then enforce uniqueness (required for FK target)
alter table public.leads
  add column if not exists submission_id text;

update public.leads
set submission_id = id::text
where submission_id is null;

-- New lead rows: mirror id as submission_id when not provided (FK target for verification_sessions)
create or replace function public.leads_set_submission_id_from_id()
returns trigger
language plpgsql
as $$
begin
  if new.submission_id is null then
    new.submission_id := new.id::text;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_set_submission_id_from_id on public.leads;
create trigger trg_leads_set_submission_id_from_id
before insert on public.leads
for each row execute function public.leads_set_submission_id_from_id();

alter table public.leads
  alter column submission_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_submission_id_key'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_submission_id_key unique (submission_id);
  end if;
end $$;

-- 2) Parent: sessions
create table if not exists public.verification_sessions (
  id uuid not null default gen_random_uuid (),
  submission_id text not null,
  buffer_agent_id uuid null,
  licensed_agent_id uuid null,
  status text not null default 'pending'::text,
  started_at timestamp with time zone null default now(),
  completed_at timestamp with time zone null,
  transferred_at timestamp with time zone null,
  progress_percentage integer null default 0,
  total_fields integer null default 0,
  verified_fields integer null default 0,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  claimed_at timestamp with time zone null,
  is_retention_call boolean null default false,
  retention_agent_id uuid null,
  retention_notes jsonb null,
  constraint verification_sessions_pkey primary key (id),
  constraint verification_sessions_licensed_agent_id_fkey foreign key (licensed_agent_id) references auth.users (id),
  constraint verification_sessions_submission_id_fkey foreign key (submission_id) references public.leads (submission_id) on delete cascade,
  constraint verification_sessions_buffer_agent_id_fkey foreign key (buffer_agent_id) references auth.users (id),
  constraint verification_sessions_retention_agent_id_fkey foreign key (retention_agent_id) references auth.users (id),
  constraint verification_sessions_progress_percentage_check check (
    (progress_percentage >= 0) and (progress_percentage <= 100)
  ),
  constraint verification_sessions_status_check check (
    status = any (
      array[
        'pending'::text,
        'in_progress'::text,
        'ready_for_transfer'::text,
        'transferred'::text,
        'completed'::text,
        'call_dropped'::text,
        'buffer_done'::text,
        'la_done'::text
      ]
    )
  )
) tablespace pg_default;

create index if not exists idx_verification_sessions_submission_id on public.verification_sessions using btree (submission_id) tablespace pg_default;
create index if not exists idx_verification_sessions_buffer_agent on public.verification_sessions using btree (buffer_agent_id) tablespace pg_default;
create index if not exists idx_verification_sessions_licensed_agent on public.verification_sessions using btree (licensed_agent_id) tablespace pg_default;
create index if not exists idx_verification_sessions_status on public.verification_sessions using btree (status) tablespace pg_default;
create index if not exists idx_verification_sessions_claimed_at on public.verification_sessions using btree (claimed_at) tablespace pg_default;

-- Enforce one verification session per lead (submission_id).
-- If duplicates already exist, keep the most recently updated session and merge items.
with ranked as (
  select
    id,
    submission_id,
    row_number() over (
      partition by submission_id
      order by coalesce(updated_at, created_at) desc, created_at desc, id desc
    ) as rn
  from public.verification_sessions
),
winner_loser as (
  select
    w.id as winner_id,
    l.id as loser_id
  from ranked w
  join ranked l
    on w.submission_id = l.submission_id
  where w.rn = 1 and l.rn > 1
),
move_items as (
  insert into public.verification_items (
    session_id, field_name, field_category, original_value, verified_value,
    is_verified, is_modified, verified_at, verified_by, notes, created_at, updated_at
  )
  select
    wl.winner_id,
    vi.field_name,
    vi.field_category,
    vi.original_value,
    vi.verified_value,
    vi.is_verified,
    vi.is_modified,
    vi.verified_at,
    vi.verified_by,
    vi.notes,
    vi.created_at,
    vi.updated_at
  from winner_loser wl
  join public.verification_items vi
    on vi.session_id = wl.loser_id
  on conflict (session_id, field_name) do update
  set
    field_category = excluded.field_category,
    original_value = excluded.original_value,
    verified_value = excluded.verified_value,
    is_verified = excluded.is_verified,
    is_modified = excluded.is_modified,
    verified_at = excluded.verified_at,
    verified_by = excluded.verified_by,
    notes = excluded.notes,
    updated_at = excluded.updated_at
  returning 1
)
delete from public.verification_sessions s
using ranked r
where s.id = r.id and r.rn > 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'verification_sessions_submission_id_key'
      and conrelid = 'public.verification_sessions'::regclass
  ) then
    alter table public.verification_sessions
      add constraint verification_sessions_submission_id_key unique (submission_id);
  end if;
end $$;

drop trigger if exists update_verification_sessions_updated_at on public.verification_sessions;
create trigger update_verification_sessions_updated_at
before update on public.verification_sessions
for each row execute function public.set_updated_at ();

-- 3) Child: items
create table if not exists public.verification_items (
  id uuid not null default gen_random_uuid (),
  session_id uuid not null,
  field_name text not null,
  field_category text null,
  original_value text null,
  verified_value text null,
  is_verified boolean null default false,
  is_modified boolean null default false,
  verified_at timestamp with time zone null,
  verified_by uuid null,
  notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint verification_items_pkey primary key (id),
  constraint verification_items_session_id_field_name_key unique (session_id, field_name),
  constraint verification_items_session_id_fkey foreign key (session_id) references public.verification_sessions (id) on delete cascade,
  constraint verification_items_verified_by_fkey foreign key (verified_by) references auth.users (id)
) tablespace pg_default;

create index if not exists idx_verification_items_session_id on public.verification_items using btree (session_id) tablespace pg_default;
create index if not exists idx_verification_items_field_name on public.verification_items using btree (field_name) tablespace pg_default;
create index if not exists idx_verification_items_is_verified on public.verification_items using btree (is_verified) tablespace pg_default;

drop trigger if exists update_verification_items_updated_at on public.verification_items;
create trigger update_verification_items_updated_at
before update on public.verification_items
for each row execute function public.set_updated_at ();

-- 4) Progress sync (after both tables exist)
create or replace function public.update_verification_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  if tg_op = 'DELETE' then
    sid := old.session_id;
  else
    sid := new.session_id;
  end if;

  update public.verification_sessions vs
  set
    verified_fields = (
      select count(*)::int
      from public.verification_items vi
      where vi.session_id = sid and coalesce(vi.is_verified, false) = true
    ),
    total_fields = (
      select count(*)::int
      from public.verification_items vi
      where vi.session_id = sid
    ),
    progress_percentage = case
      when (
        select count(*) from public.verification_items vi where vi.session_id = sid
      ) = 0 then 0
      else least(
        100,
        greatest(
          0,
          round(
            100.0 * (
              select count(*)::numeric
              from public.verification_items vi
              where vi.session_id = sid and coalesce(vi.is_verified, false) = true
            )
            / nullif(
              (select count(*)::numeric from public.verification_items vi where vi.session_id = sid),
              0
            )
          )::int
        )
      )
    end,
    updated_at = now()
  where vs.id = sid;

  return coalesce(new, old);
end;
$$;

drop trigger if exists update_verification_progress_trigger on public.verification_items;
create trigger update_verification_progress_trigger
after insert or delete or update of is_verified on public.verification_items
for each row execute function public.update_verification_progress ();

-- 5) RLS + grants
alter table public.verification_sessions enable row level security;
alter table public.verification_items enable row level security;

drop policy if exists verification_sessions_select_authenticated on public.verification_sessions;
create policy verification_sessions_select_authenticated
on public.verification_sessions for select to authenticated using (true);

drop policy if exists verification_sessions_write_authenticated on public.verification_sessions;
create policy verification_sessions_write_authenticated
on public.verification_sessions for all to authenticated using (true) with check (true);

drop policy if exists verification_items_select_authenticated on public.verification_items;
create policy verification_items_select_authenticated
on public.verification_items for select to authenticated using (true);

drop policy if exists verification_items_write_authenticated on public.verification_items;
create policy verification_items_write_authenticated
on public.verification_items for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.verification_sessions to authenticated;
grant select, insert, update, delete on public.verification_items to authenticated;

-- 6) Initializer RPC for claim/start flows (idempotent for repeated claims)
create or replace function public.initialize_verification_items(session_id_param uuid, submission_id_param text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_record public.leads%rowtype;
begin
  select *
  into lead_record
  from public.leads
  where submission_id = submission_id_param
  limit 1;

  if not found then
    raise exception 'Lead not found with submission_id: %', submission_id_param;
  end if;

  insert into public.verification_items (session_id, field_name, field_category, original_value)
  values
    -- Personal
    (session_id_param, 'customer_full_name', 'personal', trim(concat(coalesce(lead_record.first_name, ''), ' ', coalesce(lead_record.last_name, '')))),
    (session_id_param, 'date_of_birth', 'personal', lead_record.date_of_birth),
    (session_id_param, 'birth_state', 'personal', lead_record.birth_state),
    (session_id_param, 'age', 'personal', lead_record.age),
    (session_id_param, 'social_security', 'personal', lead_record.social),
    (session_id_param, 'driver_license', 'personal', lead_record.driver_license_number),
    -- Contact
    (session_id_param, 'street_address', 'contact', trim(concat(coalesce(lead_record.street1, ''), ' ', coalesce(lead_record.street2, '')))),
    (session_id_param, 'city', 'contact', lead_record.city),
    (session_id_param, 'state', 'contact', lead_record.state),
    (session_id_param, 'zip_code', 'contact', lead_record.zip_code),
    (session_id_param, 'phone_number', 'contact', lead_record.phone),
    -- Health
    (session_id_param, 'height', 'health', lead_record.height),
    (session_id_param, 'weight', 'health', lead_record.weight),
    (session_id_param, 'doctors_name', 'health', lead_record.doctor_name),
    (session_id_param, 'tobacco_use', 'health', lead_record.tobacco_use),
    (session_id_param, 'health_conditions', 'health', lead_record.health_conditions),
    (session_id_param, 'medications', 'health', lead_record.medications),
    (session_id_param, 'existing_coverage', 'health', lead_record.existing_coverage_last_2_years),
    (session_id_param, 'previous_applications', 'health', lead_record.previous_applications_2_years),
    -- Insurance
    (session_id_param, 'carrier', 'insurance', lead_record.carrier),
    (session_id_param, 'product_type', 'insurance', lead_record.product_type),
    (session_id_param, 'coverage_amount', 'insurance', lead_record.coverage_amount),
    (session_id_param, 'monthly_premium', 'insurance', lead_record.monthly_premium),
    (session_id_param, 'draft_date', 'insurance', lead_record.draft_date),
    (session_id_param, 'future_draft_date', 'insurance', lead_record.future_draft_date),
    -- Banking
    (session_id_param, 'beneficiary_information', 'banking', lead_record.beneficiary_information),
    (session_id_param, 'institution_name', 'banking', lead_record.institution_name),
    (session_id_param, 'beneficiary_routing', 'banking', lead_record.routing_number),
    (session_id_param, 'beneficiary_account', 'banking', lead_record.account_number),
    (session_id_param, 'account_type', 'banking', lead_record.bank_account_type),
    -- Additional
    (session_id_param, 'additional_notes', 'additional', lead_record.additional_information),
    (session_id_param, 'lead_vendor', 'additional', lead_record.lead_source)
  on conflict (session_id, field_name) do update
  set
    field_category = excluded.field_category,
    original_value = excluded.original_value;

  update public.verification_sessions
  set total_fields = (
    select count(*)::int
    from public.verification_items
    where session_id = session_id_param
  )
  where id = session_id_param;
end;
$$;

grant execute on function public.initialize_verification_items(uuid, text) to authenticated;

-- 7) Call-fix + retention parity tables (safe no-op if already present)
create table if not exists public.call_results (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  customer_name text,
  call_status text not null,
  call_reason text,
  notes text,
  new_draft_date date,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint call_results_submission_unique unique (submission_id)
);

drop trigger if exists trg_call_results_updated_at on public.call_results;
create trigger trg_call_results_updated_at
before update on public.call_results
for each row execute function public.set_updated_at();

create table if not exists public.call_update_logs (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null,
  lead_id uuid references public.leads(id) on delete cascade,
  event_type text not null,
  event_details jsonb,
  agent_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.app_fix_tasks (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null,
  lead_id uuid references public.leads(id) on delete cascade,
  task_type text not null check (task_type = any(array['new_sale','fixed_payment','carrier_requirements'])),
  status text not null default 'open',
  assigned_to uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_app_fix_tasks_updated_at on public.app_fix_tasks;
create trigger trg_app_fix_tasks_updated_at
before update on public.app_fix_tasks
for each row execute function public.set_updated_at();

create table if not exists public.app_fix_banking_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.app_fix_tasks(id) on delete cascade,
  submission_id text not null,
  lead_id uuid references public.leads(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_fix_carrier_requirements (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.app_fix_tasks(id) on delete cascade,
  submission_id text not null,
  lead_id uuid references public.leads(id) on delete cascade,
  carrier text,
  product_type text,
  coverage_amount text,
  monthly_premium text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.call_results enable row level security;
alter table public.call_update_logs enable row level security;
alter table public.app_fix_tasks enable row level security;
alter table public.app_fix_banking_updates enable row level security;
alter table public.app_fix_carrier_requirements enable row level security;

drop policy if exists call_results_rw_authenticated on public.call_results;
create policy call_results_rw_authenticated
on public.call_results
for all
to authenticated
using (true)
with check (true);

drop policy if exists call_update_logs_rw_authenticated on public.call_update_logs;
create policy call_update_logs_rw_authenticated
on public.call_update_logs
for all
to authenticated
using (true)
with check (true);

drop policy if exists app_fix_tasks_rw_authenticated on public.app_fix_tasks;
create policy app_fix_tasks_rw_authenticated
on public.app_fix_tasks
for all
to authenticated
using (true)
with check (true);

drop policy if exists app_fix_banking_updates_rw_authenticated on public.app_fix_banking_updates;
create policy app_fix_banking_updates_rw_authenticated
on public.app_fix_banking_updates
for all
to authenticated
using (true)
with check (true);

drop policy if exists app_fix_carrier_requirements_rw_authenticated on public.app_fix_carrier_requirements;
create policy app_fix_carrier_requirements_rw_authenticated
on public.app_fix_carrier_requirements
for all
to authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.call_results to authenticated;
grant select, insert, update, delete on public.call_update_logs to authenticated;
grant select, insert, update, delete on public.app_fix_tasks to authenticated;
grant select, insert, update, delete on public.app_fix_banking_updates to authenticated;
grant select, insert, update, delete on public.app_fix_carrier_requirements to authenticated;
