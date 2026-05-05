-- Ticket assignee: default to the department's Publisher Manager (single department row for now).
-- Replaces routing-rule + publisher.manager_user_id logic in tickets_apply_default_assignee.
-- Prerequisite: departments_module.sql (departments.publisher_manager_user_id).

create or replace function public.tickets_apply_default_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pm uuid;
begin
  if new.assignee_id is not null then
    return new;
  end if;

  select d.publisher_manager_user_id
  into v_pm
  from public.departments d
  where d.publisher_manager_user_id is not null
  order by d.created_at asc
  limit 1;

  if v_pm is not null then
    new.assignee_id := v_pm;
  end if;

  return new;
end;
$$;

-- Trigger already exists from tickets_module.sql; ensure it points at this function body.
drop trigger if exists trg_tickets_apply_routing on public.tickets;
create trigger trg_tickets_apply_routing
before insert on public.tickets
for each row execute function public.tickets_apply_default_assignee();
