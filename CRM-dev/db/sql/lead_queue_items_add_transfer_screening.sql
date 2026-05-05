-- Persist transfer / TCPA screening snapshot when a queue row is created (auto-screening).

alter table public.lead_queue_items
  add column if not exists transfer_screening_json jsonb;

alter table public.lead_queue_items
  add column if not exists transfer_screening_at timestamptz;
