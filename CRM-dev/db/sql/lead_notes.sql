-- Per-lead notes (Quick Edit Notes tab). Visibility follows the same rules as public.leads SELECT.

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.users (id) on delete set null
);

create index if not exists lead_notes_lead_id_created_at_idx on public.lead_notes (lead_id, created_at desc);

grant select, insert, update, delete on public.lead_notes to authenticated;

alter table public.lead_notes enable row level security;

-- Same visibility as leads: submitter or privileged roles (see leads_select_own_or_admin_or_call_center).
drop policy if exists lead_notes_select on public.lead_notes;
create policy lead_notes_select
on public.lead_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_notes.lead_id
      and (
        l.submitted_by = auth.uid()
        or exists (
          select 1
          from public.users u
          join public.roles r on r.id = u.role_id
          where u.id = auth.uid()
            and r.key = any (array['system_admin', 'hr', 'call_center_admin', 'call_center_agent']::text[])
        )
      )
  )
);

drop policy if exists lead_notes_insert on public.lead_notes;
create policy lead_notes_insert
on public.lead_notes
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.leads l
    where l.id = lead_notes.lead_id
      and (
        l.submitted_by = auth.uid()
        or exists (
          select 1
          from public.users u
          join public.roles r on r.id = u.role_id
          where u.id = auth.uid()
            and r.key = any (array['system_admin', 'hr', 'call_center_admin', 'call_center_agent']::text[])
        )
      )
  )
);

drop policy if exists lead_notes_update on public.lead_notes;
create policy lead_notes_update
on public.lead_notes
for update
to authenticated
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_notes.lead_id
      and (
        l.submitted_by = auth.uid()
        or exists (
          select 1
          from public.users u
          join public.roles r on r.id = u.role_id
          where u.id = auth.uid()
            and r.key = any (array['system_admin', 'hr', 'call_center_admin', 'call_center_agent']::text[])
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.leads l
    where l.id = lead_notes.lead_id
      and (
        l.submitted_by = auth.uid()
        or exists (
          select 1
          from public.users u
          join public.roles r on r.id = u.role_id
          where u.id = auth.uid()
            and r.key = any (array['system_admin', 'hr', 'call_center_admin', 'call_center_agent']::text[])
        )
      )
  )
);

drop policy if exists lead_notes_delete on public.lead_notes;
create policy lead_notes_delete
on public.lead_notes
for delete
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (array['system_admin', 'hr', 'call_center_admin']::text[])
  )
);
