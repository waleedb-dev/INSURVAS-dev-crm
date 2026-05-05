-- Subtype for Sales Agent (Unlicensed): buffer vs retention routing in claim workflows.
-- Safe to run multiple times.

alter table public.users
  add column if not exists unlicensed_sales_subtype text;

alter table public.users
  drop constraint if exists users_unlicensed_sales_subtype_check;

alter table public.users
  add constraint users_unlicensed_sales_subtype_check
  check (
    unlicensed_sales_subtype is null
    or unlicensed_sales_subtype in ('buffer_agent', 'retention_agent')
  );

comment on column public.users.unlicensed_sales_subtype is
  'For role sales_agent_unlicensed only: buffer_agent or retention_agent; null for other roles or unset.';
