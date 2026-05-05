-- Optional one-time wiring after users and roles exist.
-- Sets the publisher-management department's publisher_manager_user_id to a single
-- existing publisher_manager user when the column is still null (dev / first setup).

update public.departments d
set publisher_manager_user_id = sub.uid
from (
  select u.id as uid
  from public.users u
  join public.roles r on r.id = u.role_id
  where r.key = 'publisher_manager'
  order by u.created_at asc nulls last
  limit 1
) sub
where d.publisher_manager_user_id is null
  and (d.name = 'publisher management' or lower(trim(d.name)) = 'default');
