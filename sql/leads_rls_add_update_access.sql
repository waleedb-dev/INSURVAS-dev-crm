-- Allow transfer/call workflows to update lead rows under RLS.
-- Mirrors role scope from leads_select_own_or_admin_or_call_center, plus submitter ownership.

alter table public.leads enable row level security;

drop policy if exists leads_update_own_or_admin_or_call_center on public.leads;
create policy leads_update_own_or_admin_or_call_center
on public.leads
for update
to authenticated
using (
  submitted_by = auth.uid()
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (
        array[
          'system_admin',
          'hr',
          'call_center_admin',
          'call_center_agent',
          'sales_admin',
          'sales_manager',
          'sales_agent_licensed',
          'sales_agent_unlicensed'
        ]::text[]
      )
  )
)
with check (
  submitted_by = auth.uid()
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (
        array[
          'system_admin',
          'hr',
          'call_center_admin',
          'call_center_agent',
          'sales_admin',
          'sales_manager',
          'sales_agent_licensed',
          'sales_agent_unlicensed'
        ]::text[]
      )
  )
);

grant update on public.leads to authenticated;
