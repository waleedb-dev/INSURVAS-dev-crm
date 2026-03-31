-- Align leads pipeline/stage references with FK-backed tables.
-- Safe to run multiple times.

-- 1) Add pipeline_id on leads.
alter table public.leads
  add column if not exists pipeline_id bigint null;

-- 2) Backfill pipeline_id from stage_id first (most reliable).
update public.leads l
set pipeline_id = ps.pipeline_id
from public.pipeline_stages ps
where l.stage_id = ps.id
  and (l.pipeline_id is null or l.pipeline_id <> ps.pipeline_id);

-- 3) Backfill remaining pipeline_id from pipeline name text.
update public.leads l
set pipeline_id = p.id
from public.pipelines p
where l.pipeline_id is null
  and l.pipeline is not null
  and trim(l.pipeline) = p.name;

-- 4) Add FK + index for pipeline_id.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_pipeline_id_fkey'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_pipeline_id_fkey
      foreign key (pipeline_id) references public.pipelines(id) on delete set null;
  end if;
end $$;

create index if not exists leads_pipeline_id_idx
  on public.leads using btree (pipeline_id) tablespace pg_default;

-- 5) Keep legacy text columns + FK ids in sync during writes.
create or replace function public.leads_sync_pipeline_stage_refs()
returns trigger
language plpgsql
as $$
declare
  v_pipeline_id bigint;
  v_pipeline_name text;
  v_stage_name text;
begin
  -- If stage_id is provided, it dictates both pipeline_id and stage text.
  if new.stage_id is not null then
    select ps.pipeline_id, ps.name
    into v_pipeline_id, v_stage_name
    from public.pipeline_stages ps
    where ps.id = new.stage_id;

    if found then
      new.pipeline_id := v_pipeline_id;
      new.stage := v_stage_name;
    end if;
  end if;

  -- If pipeline_id is still missing but text pipeline exists, resolve id.
  if new.pipeline_id is null and new.pipeline is not null then
    select p.id into v_pipeline_id
    from public.pipelines p
    where p.name = trim(new.pipeline)
    limit 1;
    if found then
      new.pipeline_id := v_pipeline_id;
    end if;
  end if;

  -- Keep pipeline text canonical from pipeline_id.
  if new.pipeline_id is not null then
    select p.name into v_pipeline_name
    from public.pipelines p
    where p.id = new.pipeline_id;
    if found then
      new.pipeline := v_pipeline_name;
    end if;
  end if;

  -- If stage text + pipeline_id are present but stage_id missing, resolve stage_id.
  if new.stage_id is null and new.stage is not null and new.pipeline_id is not null then
    select ps.id, ps.name
    into new.stage_id, v_stage_name
    from public.pipeline_stages ps
    where ps.pipeline_id = new.pipeline_id
      and ps.name = trim(new.stage)
    limit 1;

    if found then
      new.stage := v_stage_name;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_leads_sync_pipeline_stage_refs on public.leads;
create trigger trg_leads_sync_pipeline_stage_refs
before insert or update on public.leads
for each row execute function public.leads_sync_pipeline_stage_refs();

