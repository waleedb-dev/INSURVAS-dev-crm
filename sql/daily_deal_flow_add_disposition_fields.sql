alter table public.daily_deal_flow
  add column if not exists dq_reason text,
  add column if not exists new_draft_date date,
  add column if not exists disposition_path jsonb,
  add column if not exists generated_note text,
  add column if not exists manual_note text,
  add column if not exists quick_disposition_tag text;
