-- One-off: tighten ticket INSERT to call_center_admin (same center as lead) or system_admin.
-- Run after tickets_module.sql if you already deployed the older submitter-based policy.

drop policy if exists tickets_insert_publishers on public.tickets;

create policy tickets_insert_publishers
on public.tickets
for insert
to authenticated
with check (
  publisher_id = auth.uid()
  and exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and (
        public.has_role('system_admin')
        or (
          public.has_role('call_center_admin')
          and l.call_center_id is not null
          and exists (
            select 1
            from public.users u
            where u.id = auth.uid()
              and u.call_center_id is not null
              and u.call_center_id = l.call_center_id
          )
        )
      )
  )
);
