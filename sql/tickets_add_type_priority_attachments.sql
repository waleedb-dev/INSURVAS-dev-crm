-- Add ticket_type, priority, and attachments to tickets table
-- Run this in your Supabase SQL Editor

-- Ticket type enum (idempotent create)
do $$
begin
  create type public.ticket_type as enum ('general', 'billing', 'technical', 'escalation', 'compliance');
exception
  when duplicate_object then null;
end$$;

-- Add 'lead_inquiry' to existing enum (safe to run multiple times)
-- Note: PostgreSQL allows adding values to enums only at the end
do $$
begin
  alter type public.ticket_type add value if not exists 'lead_inquiry';
exception
  when duplicate_object then null;
end$$;

-- Priority enum
do $$
begin
  create type public.ticket_priority as enum ('low', 'medium', 'high', 'urgent');
exception
  when duplicate_object then null;
end$$;

-- Add columns to tickets table
alter table public.tickets
  add column if not exists ticket_type public.ticket_type null,
  add column if not exists priority public.ticket_priority null default 'medium'::ticket_priority,
  add column if not exists attachments jsonb null default '[]'::jsonb,
  add column if not exists call_center_id uuid null references public.call_centers (id) on delete set null;

-- Index for filtering by call center
create index if not exists tickets_call_center_id_idx on public.tickets (call_center_id);

-- Update RLS insert policy to allow call_center_admin to create tickets
-- (they must be in the same call center as the lead)
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

-- Grant select on new columns (already covered by table grant, but explicit for clarity)
grant select, insert, update on public.tickets to authenticated;
