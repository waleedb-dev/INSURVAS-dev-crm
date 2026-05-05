-- Fix: "new row violates row-level security policy for table policies" (42501) on insert/update from the agent portal.
-- The browser uses the Supabase `authenticated` role. Align with other CRM tables (e.g. call_results) that allow
-- authenticated read/write for portal workflows.
--
-- Apply in Supabase: SQL Editor → run this script once (after `public.policies` exists).

alter table public.policies enable row level security;

drop policy if exists policies_rw_authenticated on public.policies;
create policy policies_rw_authenticated
on public.policies
for all
to authenticated
using (true)
with check (true);

grant select, insert, update, delete on table public.policies to authenticated;

-- Serial / identity default for id (safe if the sequence name differs — ignore errors in that case)
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
      and c.relname = 'policies_id_seq'
  ) then
    execute 'grant usage, select on sequence public.policies_id_seq to authenticated';
  end if;
end $$;
