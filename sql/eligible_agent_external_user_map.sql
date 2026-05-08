-- Maps eligible-agents system UUIDs (external availability export) to CRM `public.users.id`
-- for licensed sales agents. Adjust rows if business mapping differs.

begin;

create table if not exists public.eligible_agent_external_user_map (
  id uuid primary key default gen_random_uuid(),
  external_availability_id uuid not null,
  external_user_id uuid not null,
  crm_user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_eligible_agent_ext_map_availability unique (external_availability_id),
  constraint uq_eligible_agent_ext_map_external_user unique (external_user_id),
  constraint uq_eligible_agent_ext_map_crm_user unique (crm_user_id)
);

create index if not exists idx_eligible_agent_ext_map_crm_user
  on public.eligible_agent_external_user_map (crm_user_id);

comment on table public.eligible_agent_external_user_map is
  'eligible-agents DB: external_availability_id + external_user_id -> CRM users.id (sales_agent_licensed).';

drop trigger if exists trg_eligible_agent_external_user_map_updated_at
  on public.eligible_agent_external_user_map;
create trigger trg_eligible_agent_external_user_map_updated_at
  before update on public.eligible_agent_external_user_map
  for each row execute function public.set_updated_at();

alter table public.eligible_agent_external_user_map enable row level security;

grant select, insert, update, delete on public.eligible_agent_external_user_map to authenticated;

drop policy if exists eligible_agent_external_user_map_authenticated_all
  on public.eligible_agent_external_user_map;
create policy eligible_agent_external_user_map_authenticated_all
  on public.eligible_agent_external_user_map
  for all
  to authenticated
  using (true)
  with check (true);

-- Seed: 11 external rows. CRM side: all active sales_agent_licensed except
-- "License Agent" and "Lydia Agent" (13 - 2 = 11). Pairing: `external_user_id`
-- ascending with CRM agents sorted by `full_name`. Verify in production.
insert into public.eligible_agent_external_user_map (
  external_availability_id,
  external_user_id,
  crm_user_id
) values
  (
    '051761b8-6f24-4210-be62-78756c3cf365'::uuid,
    '424f4ea8-1b8c-4c0f-bc13-3ea699900c79'::uuid,
    'ab5809c5-d538-4cc0-915c-d6d8379bdfd8'::uuid
  ),
  (
    '3da91afe-7176-48e5-b561-3084b6e16e0b'::uuid,
    '4b498228-0580-45f9-b34d-27f15fcfd60c'::uuid,
    'cbce8109-0222-4b4c-8e62-a20464c75be9'::uuid
  ),
  (
    'd84c1e4f-9da9-4b8d-abe1-5b45fec4b5cc'::uuid,
    '6ba9dfff-d141-41c0-a2c2-5d5b09c6fb92'::uuid,
    '9aeb2c5b-ca10-41a3-bb25-faaada158927'::uuid
  ),
  (
    'bfd79591-bda6-4940-a98e-2f3b7a99a1c1'::uuid,
    '7df06f78-fac2-439f-bb64-d66d89a062a1'::uuid,
    'b97cadc8-276a-4dbd-a2b8-347d70354f5e'::uuid
  ),
  (
    'c9dcae8d-8541-4bae-a955-c3a1b22cc5ac'::uuid,
    '886ea5f6-9952-4207-943f-44b0234c5efd'::uuid,
    '13980311-7e81-48f1-9131-1311bd1a8a4a'::uuid
  ),
  (
    '17c175a2-95be-480b-89d4-1abd2569997a'::uuid,
    'bf5f0fb0-8385-49ac-8566-dc951ad0ffdc'::uuid,
    '22158690-f0c8-4e96-b9f8-cc62f4eaa294'::uuid
  ),
  (
    'a260a684-5fbd-4ab6-a47c-778c5e006c7d'::uuid,
    'c056c2b9-2dda-4773-aa97-fe88c759a665'::uuid,
    '6a802448-7f50-4270-9635-fed77e8f135b'::uuid
  ),
  (
    'd8862d3d-61bc-41ce-835d-fa074406321b'::uuid,
    'd0db577e-3bfc-49f4-826c-2b01cd15c8c8'::uuid,
    '8e2c5e2c-9705-4ff5-9573-1879bba1cbf8'::uuid
  ),
  (
    '91893e99-f397-47f6-a37e-66018404a435'::uuid,
    'd68d18e4-9deb-4282-b4d0-1e6e6a0789e9'::uuid,
    '88a41f6b-7aa8-49e0-80a3-211cc150e606'::uuid
  ),
  (
    '4ef5414d-1716-4325-b243-5695174ed86e'::uuid,
    'e9873033-c53f-43d0-b337-4146265dd44d'::uuid,
    '6cbb7a46-f92b-434c-a76f-846dec400e48'::uuid
  ),
  (
    '2dcaaae8-696e-4757-a965-52da5ef090dc'::uuid,
    'f1bc188d-94d2-4f50-9fba-47c77c2bdeb8'::uuid,
    'c1b928fc-d008-4de9-bc9f-f3db1efddfac'::uuid
  )
on conflict (external_user_id) do update set
  external_availability_id = excluded.external_availability_id,
  crm_user_id = excluded.crm_user_id,
  updated_at = now();

commit;
