create table if not exists public.callback_requests (
  id uuid not null default gen_random_uuid(),
  submission_id text not null,
  lead_vendor text not null,
  request_type text not null,
  notes text not null,
  customer_name text null,
  phone_number text null,
  status text null default 'pending'::text,
  requested_by uuid null,
  requested_at timestamp with time zone null default now(),
  completed_at timestamp with time zone null,
  completed_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint callback_requests_pkey primary key (id),
  constraint callback_requests_completed_by_fkey foreign key (completed_by) references auth.users (id),
  constraint callback_requests_requested_by_fkey foreign key (requested_by) references auth.users (id),
  constraint callback_requests_request_type_check check (
    request_type = any (
      array[
        'new_application'::text,
        'updating_billing'::text,
        'carrier_requirements'::text
      ]
    )
  ),
  constraint callback_requests_status_check check (
    status = any (
      array[
        'pending'::text,
        'in_progress'::text,
        'completed'::text,
        'cancelled'::text
      ]
    )
  )
);

create index if not exists idx_callback_requests_submission_id
  on public.callback_requests using btree (submission_id);

create index if not exists idx_callback_requests_lead_vendor
  on public.callback_requests using btree (lead_vendor);

create index if not exists idx_callback_requests_status
  on public.callback_requests using btree (status);

create index if not exists idx_callback_requests_requested_at
  on public.callback_requests using btree (requested_at desc);

grant select, insert, update on public.callback_requests to authenticated;

alter table public.callback_requests enable row level security;

drop policy if exists callback_requests_select on public.callback_requests;
create policy callback_requests_select
on public.callback_requests
for select
to authenticated
using (
  requested_by = auth.uid()
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (array['system_admin', 'call_center_admin']::text[])
  )
);

drop policy if exists callback_requests_insert on public.callback_requests;
create policy callback_requests_insert
on public.callback_requests
for insert
to authenticated
with check (
  requested_by = auth.uid()
  or requested_by is null
);

drop policy if exists callback_requests_update on public.callback_requests;
create policy callback_requests_update
on public.callback_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (array['system_admin', 'call_center_admin']::text[])
  )
)
with check (
  exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (array['system_admin', 'call_center_admin']::text[])
  )
);
