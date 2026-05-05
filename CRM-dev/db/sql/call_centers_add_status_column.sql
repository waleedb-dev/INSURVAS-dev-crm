alter table public.call_centers
add column if not exists status text;

update public.call_centers
set status = case
  when is_active is false or name ilike 'Inactive:%' then 'inactive'
  else 'active'
end
where status is null;

alter table public.call_centers
alter column status set default 'active';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'call_centers_status_check'
      and conrelid = 'public.call_centers'::regclass
  ) then
    alter table public.call_centers
    add constraint call_centers_status_check
    check (status in ('active', 'inactive'));
  end if;
end $$;

alter table public.call_centers
alter column status set not null;
