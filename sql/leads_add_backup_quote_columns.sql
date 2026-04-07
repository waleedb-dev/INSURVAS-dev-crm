-- Optional backup quote on transfer / BPO leads (mirrors primary carrier/product/premium/coverage).

alter table public.leads
  add column if not exists has_backup_quote boolean not null default false;

alter table public.leads
  add column if not exists backup_carrier text null;

alter table public.leads
  add column if not exists backup_product_type text null;

alter table public.leads
  add column if not exists backup_monthly_premium text null;

alter table public.leads
  add column if not exists backup_coverage_amount text null;
