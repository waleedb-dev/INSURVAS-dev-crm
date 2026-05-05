-- Add lead_name to tickets and make lead_id nullable
-- Run this in your Supabase SQL Editor

-- Make lead_id nullable (idempotent - safe to run even if already nullable)
alter table public.tickets alter column lead_id drop not null;

-- Add lead_name text column for manual lead name entry
alter table public.tickets add column if not exists lead_name text;

-- Update RLS insert policy to allow tickets without a linked lead
-- (when lead_id is null, we verify via call_center_id instead)
drop policy if exists tickets_insert_publishers on public.tickets;
create policy tickets_insert_publishers
on public.tickets
for insert
to authenticated
with check (
  publisher_id = auth.uid()
  and (
    -- System admin can create any ticket
    public.has_role('system_admin')
    or (
      -- Call center admin: must match call_center_id when lead_id is null,
      -- or match lead's call_center_id when lead_id is provided
      public.has_role('call_center_admin')
      and exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and u.call_center_id is not null
          and (
            -- No lead linked: verify via ticket's call_center_id
            (lead_id is null and call_center_id is not null and call_center_id = u.call_center_id)
            or
            -- Lead linked: verify via lead's call_center_id
            (lead_id is not null and exists (
              select 1
              from public.leads l
              where l.id = lead_id
                and l.call_center_id is not null
                and l.call_center_id = u.call_center_id
            ))
          )
      )
    )
  )
);

-- Grant select on new column (already covered by table grant, but explicit for clarity)
grant select, insert, update on public.tickets to authenticated;
