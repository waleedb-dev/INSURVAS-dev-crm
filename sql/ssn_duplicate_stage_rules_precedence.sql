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

insert into public.ssn_duplicate_stage_rules (stage_name, ghl_stage, message, is_addable, is_active, precedence_rank)
values -- Tier 1 — highest precedence (sorted)
  ('Pending Approval', 'Pending Approval', 'Customer has current policy — approved for transfer.', true, true, 10),
  ('Chargeback DQ', 'Chargeback DQ', 'Customer has already been DQ from our agency.', false, true, 20),
  ('Returned To Center - DQ', 'Returned To Center - DQ', 'Customer has already been DQ from our agency.', false, true, 30),
  ('DQ''d Can''t be sold', 'DQ''d Can''t be sold', 'Customer has already been DQ from our agency.', false, true, 40),
  ('Pending Manual Action', 'Pending Manual Action', 'Needs BPO Callback — can be sent, approved.', true, true, 50),
  ('Pending Manual Action (Current Policy)', 'Pending Manual Action (Current Policy)', 'Customer has current policy — approved for transfer.', true, true, 55),

  -- Tier 2 — same two message families, sorted
  ('Transfer Lead In', 'Transfer Lead In', 'Can be sent, approved.', true, true, 100),
  ('Chargeback Transfer Lead In', 'Chargeback Transfer Lead In', 'Can be sent, approved.', true, true, 110),
  ('Incomplete Transfer', 'Incomplete Transfer', 'Can be sent, approved.', true, true, 120),
  ('Needs BPO Callback', 'Needs BPO Callback', 'Can be sent, approved.', true, true, 130),
  ('Application Withdrawn', 'Application Withdrawn', 'Can be sent, approved.', true, true, 140),
  ('Declined Underwriting', 'Declined Underwriting', 'Can be sent, approved.', true, true, 150),
  ('Issued - Pending First Draft', 'Issued - Pending First Draft', 'Customer has current policy — approved for transfer.', true, true, 160),
  ('Premium Paid - Commission Pending', 'Premium Paid - Commission Pending', 'Customer has current policy — approved for transfer.', true, true, 170),
  ('ACTIVE PLACED - Paid as Earned', 'ACTIVE PLACED - Paid as Earned', 'Customer has current policy — approved for transfer.', true, true, 180),
  ('ACTIVE PLACED - Paid as Advanced', 'ACTIVE PLACED - Paid as Advanced', 'Customer has current policy — approved for transfer.', true, true, 190),
  ('ACTIVE - 3 Months +', 'ACTIVE - 3 Months +', 'Customer has current policy — approved for transfer.', true, true, 200),
  ('ACTIVE - 6 months +', 'ACTIVE - 6 months +', 'Customer has current policy — approved for transfer.', true, true, 210),
  ('ACTIVE - 9 months', 'ACTIVE - 9 months', 'Customer has current policy — approved for transfer.', true, true, 220),
  ('ACTIVE - Past Charge-Back Period', 'ACTIVE - Past Charge-Back Period', 'Customer has current policy — approved for transfer.', true, true, 230),
  ('FDPF Insufficient Funds', 'FDPF Insufficient Funds', 'Customer has current policy — approved for transfer.', true, true, 240),
  ('FDPF Incorrect Banking Info', 'FDPF Incorrect Banking Info', 'Customer has current policy — approved for transfer.', true, true, 250),
  ('FDPF Unauthorized Draft', 'FDPF Unauthorized Draft', 'Customer has current policy — approved for transfer.', true, true, 260),
  ('Pending Failed Payment Fix', 'Pending Failed Payment Fix', 'Customer has current policy — approved for transfer.', true, true, 270),
  ('Pending Lapse', 'Pending Lapse', 'Customer has current policy — approved for transfer.', true, true, 280),
  ('Chargeback Failed Payment', 'Chargeback Failed Payment', 'Can be sent, approved.', true, true, 290),
  ('Chargeback Cancellation', 'Chargeback Cancellation', 'Can be sent, approved.', true, true, 300),
  ('Pending Chargeback Fix', 'Pending Chargeback Fix', 'Can be sent, approved.', true, true, 310),
  ('Chargeback Fixed', 'Chargeback Fixed', 'Can be sent, approved.', true, true, 320)
on conflict (stage_name) do update
set
  ghl_stage = excluded.ghl_stage,
  message = excluded.message,
  is_addable = excluded.is_addable,
  is_active = excluded.is_active,
  precedence_rank = excluded.precedence_rank,
  updated_at = now();
