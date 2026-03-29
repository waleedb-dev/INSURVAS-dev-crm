-- Agent Hierarchy: IMO > Agency > Agent
-- This establishes the organizational structure for the CRM
-- 
-- PREREQUISITE: This script assumes the following tables already exist:
--   - public.carriers (with id, name columns)
--   - public.users (for RLS has_role function)
-- 
-- The carriers table is referenced by agent_carriers junction table but NOT created here.

-- ============================================
-- CORE TABLES: The Hierarchy
-- ============================================

-- 1. IMOs Table (Top Level)
create table if not exists public.imos (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_imos_updated_at on public.imos;
create trigger trg_imos_updated_at
before update on public.imos
for each row execute function public.set_updated_at();

-- 2. Agencies Table (Middle Level - NEW)
create table if not exists public.agencies (
  id bigserial primary key,
  name text not null,
  imo_id bigint not null references public.imos(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agencies_name_imo_unique unique (name, imo_id)
);

create index if not exists idx_agencies_imo_id on public.agencies(imo_id);

drop trigger if exists trg_agencies_updated_at on public.agencies;
create trigger trg_agencies_updated_at
before update on public.agencies
for each row execute function public.set_updated_at();

-- 3. Agents Table (Bottom Level - UPDATED)
-- Note: This assumes agents table exists. If it doesn't, create it fresh.
-- If it exists with different structure, you'll need to migrate data first.
create table if not exists public.agents (
  id bigserial primary key,
  first_name text not null,
  last_name text not null,
  agency_id bigint references public.agencies(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  slack_username text,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add new columns if agents table already exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'agency_id' AND table_schema = 'public') THEN
      ALTER TABLE public.agents ADD COLUMN agency_id bigint references public.agencies(id) on delete set null;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'user_id' AND table_schema = 'public') THEN
      ALTER TABLE public.agents ADD COLUMN user_id uuid references public.users(id) on delete set null;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'slack_username' AND table_schema = 'public') THEN
      ALTER TABLE public.agents ADD COLUMN slack_username text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'status' AND table_schema = 'public') THEN
      ALTER TABLE public.agents ADD COLUMN status text not null default 'Active' check (status in ('Active', 'Inactive'));
    END IF;
  END IF;
END $$;

create index if not exists idx_agents_agency_id on public.agents(agency_id);
create index if not exists idx_agents_status on public.agents(status);

drop trigger if exists trg_agents_updated_at on public.agents;
create trigger trg_agents_updated_at
before update on public.agents
for each row execute function public.set_updated_at();

-- 4. States Table (Reference Table)
create table if not exists public.states (
  code text primary key,
  name text not null unique
);

-- ============================================
-- JUNCTION TABLES: Agent Relationships
-- ============================================

-- Agent to Carriers (Many-to-Many)
create table if not exists public.agent_carriers (
  agent_id bigint not null references public.agents(id) on delete cascade,
  carrier_id bigint not null references public.carriers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agent_id, carrier_id)
);

create index if not exists idx_agent_carriers_agent_id on public.agent_carriers(agent_id);
create index if not exists idx_agent_carriers_carrier_id on public.agent_carriers(carrier_id);

-- Agent to States (Many-to-Many)
create table if not exists public.agent_states (
  agent_id bigint not null references public.agents(id) on delete cascade,
  state_code text not null references public.states(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agent_id, state_code)
);

create index if not exists idx_agent_states_agent_id on public.agent_states(agent_id);
create index if not exists idx_agent_states_state_code on public.agent_states(state_code);

-- ============================================
-- RLS POLICIES: System Admin Access
-- ============================================

-- IMOs Table Policies
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.imos to authenticated;
grant usage, select on sequence public.imos_id_seq to authenticated;

alter table public.imos enable row level security;

drop policy if exists imos_select_system_admin on public.imos;
create policy imos_select_system_admin
on public.imos
for select
to authenticated
using (public.has_role('system_admin'));

drop policy if exists imos_insert_system_admin on public.imos;
create policy imos_insert_system_admin
on public.imos
for insert
to authenticated
with check (public.has_role('system_admin'));

drop policy if exists imos_update_system_admin on public.imos;
create policy imos_update_system_admin
on public.imos
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));

drop policy if exists imos_delete_system_admin on public.imos;
create policy imos_delete_system_admin
on public.imos
for delete
to authenticated
using (public.has_role('system_admin'));

-- Agencies Table Policies
grant select, insert, update, delete on public.agencies to authenticated;
grant usage, select on sequence public.agencies_id_seq to authenticated;

alter table public.agencies enable row level security;

drop policy if exists agencies_select_system_admin on public.agencies;
create policy agencies_select_system_admin
on public.agencies
for select
to authenticated
using (public.has_role('system_admin'));

drop policy if exists agencies_insert_system_admin on public.agencies;
create policy agencies_insert_system_admin
on public.agencies
for insert
to authenticated
with check (public.has_role('system_admin'));

drop policy if exists agencies_update_system_admin on public.agencies;
create policy agencies_update_system_admin
on public.agencies
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));

drop policy if exists agencies_delete_system_admin on public.agencies;
create policy agencies_delete_system_admin
on public.agencies
for delete
to authenticated
using (public.has_role('system_admin'));

-- Agents Table Policies
grant select, insert, update, delete on public.agents to authenticated;
grant usage, select on sequence public.agents_id_seq to authenticated;

alter table public.agents enable row level security;

drop policy if exists agents_select_system_admin on public.agents;
create policy agents_select_system_admin
on public.agents
for select
to authenticated
using (public.has_role('system_admin'));

drop policy if exists agents_insert_system_admin on public.agents;
create policy agents_insert_system_admin
on public.agents
for insert
to authenticated
with check (public.has_role('system_admin'));

drop policy if exists agents_update_system_admin on public.agents;
create policy agents_update_system_admin
on public.agents
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));

drop policy if exists agents_delete_system_admin on public.agents;
create policy agents_delete_system_admin
on public.agents
for delete
to authenticated
using (public.has_role('system_admin'));

-- States Table Policies (Read-only for most, full access for system admin)
grant select on public.states to authenticated;
grant insert, update, delete on public.states to authenticated;

alter table public.states enable row level security;

drop policy if exists states_select_all on public.states;
create policy states_select_all
on public.states
for select
to authenticated
using (true);

drop policy if exists states_modify_system_admin on public.states;
create policy states_modify_system_admin
on public.states
for all
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));

-- Agent Carriers Junction Table Policies
grant select, insert, update, delete on public.agent_carriers to authenticated;

alter table public.agent_carriers enable row level security;

drop policy if exists agent_carriers_select_system_admin on public.agent_carriers;
create policy agent_carriers_select_system_admin
on public.agent_carriers
for select
to authenticated
using (public.has_role('system_admin'));

drop policy if exists agent_carriers_insert_system_admin on public.agent_carriers;
create policy agent_carriers_insert_system_admin
on public.agent_carriers
for insert
to authenticated
with check (public.has_role('system_admin'));

drop policy if exists agent_carriers_update_system_admin on public.agent_carriers;
create policy agent_carriers_update_system_admin
on public.agent_carriers
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));

drop policy if exists agent_carriers_delete_system_admin on public.agent_carriers;
create policy agent_carriers_delete_system_admin
on public.agent_carriers
for delete
to authenticated
using (public.has_role('system_admin'));

-- Agent States Junction Table Policies
grant select, insert, update, delete on public.agent_states to authenticated;

alter table public.agent_states enable row level security;

drop policy if exists agent_states_select_system_admin on public.agent_states;
create policy agent_states_select_system_admin
on public.agent_states
for select
to authenticated
using (public.has_role('system_admin'));

drop policy if exists agent_states_insert_system_admin on public.agent_states;
create policy agent_states_insert_system_admin
on public.agent_states
for insert
to authenticated
with check (public.has_role('system_admin'));

drop policy if exists agent_states_update_system_admin on public.agent_states;
create policy agent_states_update_system_admin
on public.agent_states
for update
to authenticated
using (public.has_role('system_admin'))
with check (public.has_role('system_admin'));

drop policy if exists agent_states_delete_system_admin on public.agent_states;
create policy agent_states_delete_system_admin
on public.agent_states
for delete
to authenticated
using (public.has_role('system_admin'));

-- ============================================
-- SAMPLE DATA (Optional - Uncomment to insert)
-- ============================================

-- -- Insert sample IMOs
-- insert into public.imos (name) values 
--   ('IMO A'),
--   ('IMO B')
-- on conflict (name) do nothing;

-- -- Insert sample Agencies (requires IMO IDs)
-- -- Note: Replace IMO IDs with actual values after insertion
-- -- insert into public.agencies (name, imo_id) values 
-- --   ('Wunder Agency', 1),
-- --   ('Coleman Financial', 1),
-- --   ('Elite Insurance Group', 2)
-- -- on conflict (name, imo_id) do nothing;

-- -- Insert all US states
-- insert into public.states (code, name) values 
--   ('AL', 'Alabama'), ('AK', 'Alaska'), ('AZ', 'Arizona'), ('AR', 'Arkansas'),
--   ('CA', 'California'), ('CO', 'Colorado'), ('CT', 'Connecticut'), ('DE', 'Delaware'),
--   ('FL', 'Florida'), ('GA', 'Georgia'), ('HI', 'Hawaii'), ('ID', 'Idaho'),
--   ('IL', 'Illinois'), ('IN', 'Indiana'), ('IA', 'Iowa'), ('KS', 'Kansas'),
--   ('KY', 'Kentucky'), ('LA', 'Louisiana'), ('ME', 'Maine'), ('MD', 'Maryland'),
--   ('MA', 'Massachusetts'), ('MI', 'Michigan'), ('MN', 'Minnesota'), ('MS', 'Mississippi'),
--   ('MO', 'Missouri'), ('MT', 'Montana'), ('NE', 'Nebraska'), ('NV', 'Nevada'),
--   ('NH', 'New Hampshire'), ('NJ', 'New Jersey'), ('NM', 'New Mexico'), ('NY', 'New York'),
--   ('NC', 'North Carolina'), ('ND', 'North Dakota'), ('OH', 'Ohio'), ('OK', 'Oklahoma'),
--   ('OR', 'Oregon'), ('PA', 'Pennsylvania'), ('RI', 'Rhode Island'), ('SC', 'South Carolina'),
--   ('SD', 'South Dakota'), ('TN', 'Tennessee'), ('TX', 'Texas'), ('UT', 'Utah'),
--   ('VT', 'Vermont'), ('VA', 'Virginia'), ('WA', 'Washington'), ('WV', 'West Virginia'),
--   ('WI', 'Wisconsin'), ('WY', 'Wyoming'), ('DC', 'District of Columbia')
-- on conflict (code) do nothing;
