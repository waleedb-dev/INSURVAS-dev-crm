-- Fix RLS insert policy to allow null lead_id for call_center_admin
-- when call_center_id on the ticket matches the user's call_center_id

drop policy if exists tickets_insert_publishers on public.tickets;

create policy tickets_insert_publishers
on public.tickets
for insert
to authenticated
with check (
  publisher_id = auth.uid()
  and (
    -- system_admin can always insert
    public.has_role('system_admin')
    or
    -- call_center_admin: must match center either via lead OR via ticket.call_center_id
    (
      public.has_role('call_center_admin')
      and exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and u.call_center_id is not null
          and (
            -- Case 1: lead_id provided → lead must be in same center
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
            -- Case 2: lead_id is null → ticket.call_center_id must match user's center
            (
              lead_id is null
              and call_center_id is not null
              and call_center_id = u.call_center_id
            )
          )
      )
    )
  )
);
