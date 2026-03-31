-- Store assigned owner (licensed agent display name) on leads.
alter table public.leads
  add column if not exists licensed_agent_account text;
