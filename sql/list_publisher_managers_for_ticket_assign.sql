-- Callable by call centre admins and system admins (creators of lead-scoped tickets) so they can
-- choose an assignee even though RLS on public.users does not expose publisher_manager rows to CC admins.

create or replace function public.list_publisher_managers_for_ticket_assign()
returns table (id uuid, full_name text, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.has_role('call_center_admin') or public.has_role('system_admin')) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  return query
  select
    u.id,
    coalesce(nullif(trim(u.full_name), ''), u.email) as full_name,
    u.email
  from public.users u
  join public.roles r on r.id = u.role_id
  where r.key = 'publisher_manager'
    and u.status = 'active'
  order by 2 asc, 3 asc;
end;
$$;

grant execute on function public.list_publisher_managers_for_ticket_assign() to authenticated;
