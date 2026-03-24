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

-- Seed defaults requested by business
insert into public.ssn_duplicate_stage_rules (stage_name, ghl_stage, message, is_addable, is_active)
values
  ('Chargeback DQ', 'Chargeback DQ', 'Lead already exists in Chargeback DQ. Transfer cannot be accepted.', false, true),
  ('Chargeback Fixed', 'Chargeback Fixed', 'Lead already exists in Chargeback Fixed. Transfer cannot be accepted.', false, true),
  ('Pending Approval', 'Pending Approval', 'Lead already exists in Pending Approval. You can submit this transfer.', true, true)
on conflict (stage_name) do update
set
  ghl_stage = excluded.ghl_stage,
  message = excluded.message,
  is_addable = excluded.is_addable,
  is_active = excluded.is_active,
  updated_at = now();
