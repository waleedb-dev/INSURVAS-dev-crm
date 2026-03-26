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

-- Backfill callback marker from submission prefix.
update public.call_results
set is_callback = true
where is_callback is distinct from true
  and (submission_id like 'CB%' or submission_id like 'CBB%');
