-- Allow call center admins to read (and comment on) support tickets for leads in their center
-- when the ticket was published by any user from that same call center.
-- Keeps publisher_manager / assignee visibility unchanged.

create or replace function public.ticket_user_has_access(p_ticket_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and (
        t.publisher_id = p_user_id
        or t.assignee_id = p_user_id
        or exists (
          select 1
          from public.ticket_followers tf
          where tf.ticket_id = t.id
            and tf.user_id = p_user_id
        )
        or (
          exists (
            select 1
            from public.users u_viewer
            join public.roles r on r.id = u_viewer.role_id
            where u_viewer.id = p_user_id
              and r.key = 'call_center_admin'
              and u_viewer.call_center_id is not null
          )
          and exists (
            select 1
            from public.leads l
            join public.users u_pub on u_pub.id = t.publisher_id
            join public.users u_viewer on u_viewer.id = p_user_id
            where l.id = t.lead_id
              and l.call_center_id is not null
              and l.call_center_id = u_viewer.call_center_id
              and u_pub.call_center_id is not null
              and u_pub.call_center_id = l.call_center_id
          )
        )
      )
  )
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_user_id
      and r.key = 'system_admin'
  );
$$;
