-- Add committed_daily_transfers column and offboarded stage to bpo_center_leads.
-- Safe to run multiple times (idempotent).

-- 1. Add column if missing
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bpo_center_leads'
      and column_name = 'committed_daily_transfers'
  ) then
    alter table public.bpo_center_leads
      add column committed_daily_transfers integer null;
  end if;
end $$;

-- 2. Replace stage check constraint to include 'offboarded'
alter table public.bpo_center_leads
  drop constraint if exists bpo_center_leads_stage_chk;

alter table public.bpo_center_leads
  add constraint bpo_center_leads_stage_chk check (
    stage = any (array[
      'pre_onboarding'::text,
      'ready_for_onboarding_meeting'::text,
      'onboarding_completed'::text,
      'actively_selling'::text,
      'needs_attention'::text,
      'on_pause'::text,
      'dqed'::text,
      'offboarded'::text
    ])
  );
