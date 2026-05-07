-- Add tags support to bpo_center_leads (similar to public.leads.tags)
-- Safe to run multiple times (idempotent).

alter table public.bpo_center_leads
  add column if not exists tags text[] not null default '{}';

