-- Scope daily_deal_flow: role-based access for updated schema.

drop policy if exists daily_deal_flow_select_authenticated on public.daily_deal_flow;
drop policy if exists daily_deal_flow_insert_authenticated on public.daily_deal_flow;
drop policy if exists daily_deal_flow_update_authenticated on public.daily_deal_flow;
drop policy if exists daily_deal_flow_delete_authenticated on public.daily_deal_flow;

create policy daily_deal_flow_select_scoped
on public.daily_deal_flow
for select
to authenticated
using (
  public.has_any_role(array[
    'system_admin',
    'call_center_admin',
    'call_center_agent',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
);

create policy daily_deal_flow_insert_scoped
on public.daily_deal_flow
for insert
to authenticated
with check (
  public.has_any_role(array[
    'system_admin',
    'call_center_admin',
    'call_center_agent',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
);

create policy daily_deal_flow_update_scoped
on public.daily_deal_flow
for update
to authenticated
using (
  public.has_any_role(array[
    'system_admin',
    'call_center_admin',
    'call_center_agent',
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
    'call_center_admin',
    'call_center_agent',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
);

create policy daily_deal_flow_delete_scoped
on public.daily_deal_flow
for delete
to authenticated
using (
  public.has_any_role(array[
    'system_admin',
    'call_center_admin',
    'call_center_agent',
    'sales_manager',
    'hr',
    'accounting'
  ])
);
