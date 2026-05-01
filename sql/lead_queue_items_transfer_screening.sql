-- Persist transfer screening snapshot on queue rows (manager Save + transfer check).
-- Safe to run multiple times.

alter table public.lead_queue_items
  add column if not exists transfer_screening_json jsonb,
  add column if not exists transfer_screening_at timestamptz;

comment on column public.lead_queue_items.transfer_screening_json is
  'Versioned payload from snapshotToPersistedPayload (lib/transferScreening.ts); v:1.';
