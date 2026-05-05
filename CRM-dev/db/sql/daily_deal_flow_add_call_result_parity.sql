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
