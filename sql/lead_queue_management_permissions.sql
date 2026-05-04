-- Queue Management permissions + RLS (additive)
-- Applies only to new queue tables.

begin;

-- Table/API privileges for signed-in users
grant usage on schema public to authenticated;

grant select, insert, update, delete
  on table public.lead_queue_items
  to authenticated;

grant select, insert
  on table public.lead_queue_events
  to authenticated;

grant select, insert
  on table public.lead_queue_comments
  to authenticated;

grant select
  on table public.v_queue_source_snapshot
  to authenticated;

-- RLS
alter table public.lead_queue_items enable row level security;
alter table public.lead_queue_events enable row level security;
alter table public.lead_queue_comments enable row level security;

-- Dev-first permissive policies for authenticated users on queue tables.
-- These can be tightened to role-specific checks in the next iteration.
drop policy if exists lead_queue_items_authenticated_all on public.lead_queue_items;
create policy lead_queue_items_authenticated_all
  on public.lead_queue_items
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists lead_queue_events_authenticated_read on public.lead_queue_events;
create policy lead_queue_events_authenticated_read
  on public.lead_queue_events
  for select
  to authenticated
  using (true);

drop policy if exists lead_queue_events_authenticated_insert on public.lead_queue_events;
create policy lead_queue_events_authenticated_insert
  on public.lead_queue_events
  for insert
  to authenticated
  with check (true);

drop policy if exists lead_queue_comments_authenticated_read on public.lead_queue_comments;
create policy lead_queue_comments_authenticated_read
  on public.lead_queue_comments
  for select
  to authenticated
  using (true);

drop policy if exists lead_queue_comments_authenticated_insert on public.lead_queue_comments;
create policy lead_queue_comments_authenticated_insert
  on public.lead_queue_comments
  for insert
  to authenticated
  with check (true);

commit;
