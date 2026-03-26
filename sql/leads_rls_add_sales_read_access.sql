-- Allow sales roles to read all leads (cross-center visibility).
-- Keeps existing behavior for submitter, system_admin, hr, and call-center roles.

drop policy if exists leads_select_own_or_admin_or_call_center on public.leads;

create policy leads_select_own_or_admin_or_call_center
on public.leads
for select
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
);
