-- Update auto-assign trigger to assign tickets to publisher_manager role
-- Run this in your Supabase SQL Editor

-- ---------------------------------------------------------------------------
-- Auto-assign: routing rules (lead-linked only), then any publisher_manager
-- ---------------------------------------------------------------------------
create or replace function public.tickets_apply_default_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_country text;
  v_region text;
  v_language text;
  v_rule_user uuid;
  v_manager uuid;
begin
  if new.assignee_id is not null then
    return new;
  end if;

  -- Routing rules only apply when a lead is linked
  if new.lead_id is not null then
    select lower(trim(cc.country)), lower(trim(cc.region)), lower(trim(l.language))
    into v_country, v_region, v_language
    from public.leads l
    left join public.call_centers cc on cc.id = l.call_center_id
    where l.id = new.lead_id;

    select r.assignee_user_id
    into v_rule_user
    from public.ticket_routing_rules r
    where r.is_active
      and (
        (r.rule_kind = 'country' and v_country is not null and v_country = lower(trim(r.match_value)))
        or (r.rule_kind = 'region' and v_region is not null and v_region = lower(trim(r.match_value)))
        or (r.rule_kind = 'language' and v_language is not null and v_language = lower(trim(r.match_value)))
      )
    order by r.priority asc, r.created_at asc
    limit 1;

    if v_rule_user is not null then
      new.assignee_id := v_rule_user;
      return new;
    end if;
  end if;

  -- Fallback: assign to a publisher_manager user
  -- Prefer one in the same call center if ticket has call_center_id
  select u.id
  into v_manager
  from public.users u
  join public.roles r on r.id = u.role_id
  where r.key = 'publisher_manager'
  order by
    case when new.call_center_id is not null and u.call_center_id = new.call_center_id then 0 else 1 end,
    u.created_at asc
  limit 1;

  if v_manager is not null then
    new.assignee_id := v_manager;
  end if;

  return new;
end;
$$;

-- Recreate trigger to ensure it uses the updated function
drop trigger if exists trg_tickets_apply_routing on public.tickets;
create trigger trg_tickets_apply_routing
before insert on public.tickets
for each row execute function public.tickets_apply_default_assignee();
