-- Scope daily_deal_flow: org-wide roles see all; call center roles only rows for their call_center_id.

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
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
  or (
    public.has_any_role(array['call_center_admin', 'call_center_agent'])
    and call_center_id is not null
    and call_center_id = (select u.call_center_id from public.users u where u.id = auth.uid())
  )
);

create policy daily_deal_flow_insert_scoped
on public.daily_deal_flow
for insert
to authenticated
with check (
  public.has_any_role(array[
    'system_admin',
    'sales_manager',
    'sales_agent_licensed',
    'sales_agent_unlicensed',
    'hr',
    'accounting'
  ])
  or (
    public.has_any_role(array['call_center_admin', 'call_center_agent'])
    and call_center_id is not null
    and call_center_id = (select u.call_center_id from public.users u where u.id = auth.uid())
  )
);

create policy daily_deal_flow_update_scoped
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
  or (
    public.has_any_role(array['call_center_admin', 'call_center_agent'])
    and call_center_id is not null
    and call_center_id = (select u.call_center_id from public.users u where u.id = auth.uid())
  )
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
  or (
    public.has_any_role(array['call_center_admin', 'call_center_agent'])
    and call_center_id is not null
    and call_center_id = (select u.call_center_id from public.users u where u.id = auth.uid())
  )
);

create policy daily_deal_flow_delete_scoped
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
  or (
    public.has_any_role(array['call_center_admin', 'call_center_agent'])
    and call_center_id is not null
    and call_center_id = (select u.call_center_id from public.users u where u.id = auth.uid())
  )
);
