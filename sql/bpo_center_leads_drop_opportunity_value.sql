-- Remove obsolete monetary field from BPO centre leads (applied via Supabase MCP to dev).

alter table public.bpo_center_leads drop column if exists opportunity_value;
