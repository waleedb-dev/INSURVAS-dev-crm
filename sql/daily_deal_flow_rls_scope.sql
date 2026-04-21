-- Scope daily_deal_flow: role-based access, with call-center scoping.

drop policy if exists daily_deal_flow_select_authenticated on public.daily_deal_flow;
drop policy if exists daily_deal_flow_insert_authenticated on public.daily_deal_flow;
drop policy if exists daily_deal_flow_update_authenticated on public.daily_deal_flow;
drop policy if exists daily_deal_flow_delete_authenticated on public.daily_deal_flow;

drop policy if exists daily_deal_flow_select_scoped on public.daily_deal_flow;
drop policy if exists daily_deal_flow_insert_scoped on public.daily_deal_flow;
drop policy if exists daily_deal_flow_update_scoped on public.daily_deal_flow;
drop policy if exists daily_deal_flow_delete_scoped on public.daily_deal_flow;

-- Ensure call_center_id exists for scoping (safe to rerun).
alter table public.daily_deal_flow
add column if not exists call_center_id uuid null references public.call_centers(id);

create index if not exists idx_daily_deal_flow_call_center_id
on public.daily_deal_flow(call_center_id);

-- Helper: current user's call_center_id (null if missing).
create or replace function public.current_user_call_center_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.call_center_id
  from public.users u
  where u.id = auth.uid();
$$;

-- ── SELECT ───────────────────────────────────────────────────────────────────
create policy daily_deal_flow_select_global
on public.daily_deal_flow
for select
to authenticated
using (
  public.has_any_role(array[
    'system_admin',
    'sales_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
);

create policy daily_deal_flow_select_call_center
on public.daily_deal_flow
for select
to authenticated
using (
  public.has_any_role(array['call_center_admin', 'call_center_agent'])
  and call_center_id is not null
  and call_center_id = public.current_user_call_center_id()
);

-- ── INSERT ───────────────────────────────────────────────────────────────────
create policy daily_deal_flow_insert_global
on public.daily_deal_flow
for insert
to authenticated
with check (
  public.has_any_role(array[
    'system_admin',
    'sales_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
);

create policy daily_deal_flow_insert_call_center
on public.daily_deal_flow
for insert
to authenticated
with check (
  public.has_any_role(array['call_center_admin', 'call_center_agent'])
  and call_center_id is not null
  and call_center_id = public.current_user_call_center_id()
);

-- ── UPDATE ───────────────────────────────────────────────────────────────────
create policy daily_deal_flow_update_global
on public.daily_deal_flow
for update
to authenticated
using (
  public.has_any_role(array[
    'system_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
)
with check (
  public.has_any_role(array[
    'system_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
);

create policy daily_deal_flow_update_call_center
on public.daily_deal_flow
for update
to authenticated
using (
  public.has_any_role(array['call_center_admin', 'call_center_agent'])
  and call_center_id is not null
  and call_center_id = public.current_user_call_center_id()
)
with check (
  public.has_any_role(array['call_center_admin', 'call_center_agent'])
  and call_center_id is not null
  and call_center_id = public.current_user_call_center_id()
);

-- ── DELETE ───────────────────────────────────────────────────────────────────
create policy daily_deal_flow_delete_global
on public.daily_deal_flow
for delete
to authenticated
using (
  public.has_any_role(array[
    'system_admin',
    'sales_manager',
    'hr',
    'accounting'
  ])
);

create policy daily_deal_flow_delete_call_center
on public.daily_deal_flow
for delete
to authenticated
using (
  public.has_any_role(array['call_center_admin', 'call_center_agent'])
  and call_center_id is not null
  and call_center_id = public.current_user_call_center_id()
);
