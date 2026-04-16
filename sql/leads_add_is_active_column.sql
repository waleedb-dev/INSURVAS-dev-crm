-- Optional column for `dnc-lookup` edge function: deactivate TCPA-flagged leads.
alter table public.leads
  add column if not exists is_active boolean not null default true;

create index if not exists leads_is_active_idx
  on public.leads using btree (is_active)
  where is_active = true;
