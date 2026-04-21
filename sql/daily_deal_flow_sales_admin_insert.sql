-- Allow Sales Admin to create Daily Deal Flow rows from manual lead admission.

drop policy if exists daily_deal_flow_insert_global on public.daily_deal_flow;

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
