-- Add sync_required column to leads table
-- Run this in your Supabase SQL Editor

-- Add the sync_required boolean column with default true
alter table public.leads 
add column if not exists sync_required boolean not null default true;

-- Create index for filtering
create index if not exists leads_sync_required_idx on public.leads (sync_required);