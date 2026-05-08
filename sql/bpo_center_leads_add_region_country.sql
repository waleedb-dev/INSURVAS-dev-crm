-- Add region/country to BPO centre leads and extend intake RPCs.
-- Applied to dev via MCP; keep this file for other environments.

alter table public.bpo_center_leads
  add column if not exists region text null,
  add column if not exists country text null;

comment on column public.bpo_center_leads.region is 'Geographic region for the centre (intake or staff).';
comment on column public.bpo_center_leads.country is 'Country for the centre (intake or staff).';
