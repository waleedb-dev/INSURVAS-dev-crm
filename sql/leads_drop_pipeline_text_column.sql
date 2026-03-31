-- Remove legacy text pipeline column from leads after pipeline_id migration.
-- Safe to run multiple times.

-- Keep stage_id/pipeline_id in sync without referencing removed text column.
create or replace function public.leads_sync_pipeline_stage_refs()
returns trigger
language plpgsql
as $$
declare
  v_pipeline_id bigint;
  v_stage_name text;
begin
  -- If stage_id is provided, derive pipeline_id + canonical stage name.
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

-- Remove legacy text column.
alter table public.leads
  drop column if exists pipeline;

