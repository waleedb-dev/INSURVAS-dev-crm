-- FIX TICKETS SCHEMA + RLS FROM SCRATCH
-- Run this entire block in Supabase SQL Editor

-- 1. Make lead_id nullable (required for non-lead-inquiry tickets)
alter table public.tickets alter column lead_id drop not null;

-- 2. Add ticket_type enum value if not exists
do $$
begin
  alter type public.ticket_type add value if not exists 'lead_inquiry';
exception when duplicate_object then null;
end$$;

-- 3. Drop old policies
drop policy if exists tickets_select_participants on public.tickets;
drop policy if exists tickets_insert_publishers on public.tickets;
drop policy if exists tickets_update_assignee on public.tickets;
drop policy if exists tickets_update_admin on public.tickets;

-- 4. SELECT policy: participants can see their tickets
-- (publisher, assignee, follower, same-call-center admin, system_admin, publisher_manager)
create policy tickets_select_participants
on public.tickets
for select
to authenticated
using (
  publisher_id = auth.uid()
  or assignee_id = auth.uid()
  or exists (
    select 1 from public.ticket_followers tf
    where tf.ticket_id = id and tf.user_id = auth.uid()
  )
  or exists (
    select 1 from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid() and r.key = 'system_admin'
  )
  or exists (
    select 1 from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid() and r.key = 'publisher_manager'
  )
  or exists (
    -- call_center_admin can see tickets in their center
    select 1 from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = 'call_center_admin'
      and u.call_center_id is not null
      and (
        -- via lead
        (lead_id is not null and exists (
          select 1 from public.leads l
          where l.id = lead_id and l.call_center_id = u.call_center_id
        ))
        or
        -- via ticket.call_center_id
        (call_center_id is not null and call_center_id = u.call_center_id)
      )
  )
);

-- 5. INSERT policy: who can create tickets
-- system_admin: anything
-- call_center_admin: must set publisher_id=self, and call_center_id must match user's center
--                    (lead_id optional — if provided, lead must be in same center)
create policy tickets_insert_publishers
on public.tickets
for insert
to authenticated
with check (
  publisher_id = auth.uid()
  and (
    -- system_admin can insert anything
    exists (
      select 1 from public.users u
      join public.roles r on r.id = u.role_id
      where u.id = auth.uid() and r.key = 'system_admin'
    )
    or
    -- call_center_admin: must have matching call_center_id
    exists (
      select 1 from public.users u
      join public.roles r on r.id = u.role_id
      where u.id = auth.uid()
        and r.key = 'call_center_admin'
        and u.call_center_id is not null
        and call_center_id is not null
        and call_center_id = u.call_center_id
        and (
          -- if lead_id provided, lead must be in same center
          lead_id is null
          or exists (
            select 1 from public.leads l
            where l.id = lead_id and l.call_center_id = u.call_center_id
          )
        )
    )
  )
);

-- 6. UPDATE policy: assignee can update their own tickets
-- (the trigger enforces assignee/admin rules)
create policy tickets_update_assignee
on public.tickets
for update
to authenticated
using (
  assignee_id = auth.uid()
  or publisher_id = auth.uid()
  or exists (
    select 1 from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid() and r.key = 'system_admin'
  )
);

-- 7. DELETE policy: only system_admin or publisher can delete
create policy tickets_delete_publisher_or_admin
on public.tickets
for delete
to authenticated
using (
  publisher_id = auth.uid()
  or exists (
    select 1 from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid() and r.key = 'system_admin'
  )
);

-- 8. Ensure RLS is enabled
alter table public.tickets enable row level security;

-- 9. Grant permissions
grant select, insert, update, delete on public.tickets to authenticated;
