-- Add lead language for transfer portal intake (English/Spanish).
alter table public.leads
  add column if not exists language text;
