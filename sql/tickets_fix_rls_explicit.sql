-- EXPLICIT RLS policy: directly checks user role instead of relying on has_role()
-- This matches the pattern used in ticket_user_has_access()

drop policy if exists tickets_insert_publishers on public.tickets;

create policy tickets_insert_publishers
on public.tickets
for insert
to authenticated
with check (
  publisher_id = auth.uid()
  and (
    -- Branch 1: system_admin via role key
    exists (
      select 1
      from public.users u
      join public.roles r on r.id = u.role_id
      where u.id = auth.uid()
        and r.key = 'system_admin'
    )
    or
    -- Branch 2: call_center_admin via role key
    -- Must have call_center_id set on their user profile
    exists (
      select 1
      from public.users u
      join public.roles r on r.id = u.role_id
      where u.id = auth.uid()
        and r.key = 'call_center_admin'
        and u.call_center_id is not null
        and (
          -- Case A: ticket has a lead → lead must be in same center
          (
            lead_id is not null
            and exists (
              select 1
              from public.leads l
              where l.id = lead_id
                and l.call_center_id = u.call_center_id
            )
          )
          or
          -- Case B: ticket has no lead → ticket.call_center_id must match user's center
          (
            lead_id is null
            and call_center_id is not null
            and call_center_id = u.call_center_id
          )
        )
    )
  )
);
