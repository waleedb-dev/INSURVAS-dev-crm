-- Support tickets (lead-scoped), comments, followers, routing rules, and RLS.
-- Prerequisite: public.has_role(text), public.users, public.roles, public.leads, public.call_centers.

-- ---------------------------------------------------------------------------
-- Status enum (idempotent)
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.ticket_status as enum ('open', 'in_progress', 'solved');
exception
  when duplicate_object then null;
end$$;

-- ---------------------------------------------------------------------------
-- Routing: ordered rules (lower priority = tried first). Match is case-insensitive trim.
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_routing_rules (
  id uuid primary key default gen_random_uuid(),
  priority integer not null default 100,
  rule_kind text not null check (rule_kind in ('country', 'region', 'language')),
  match_value text not null,
  assignee_user_id uuid not null references public.users (id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ticket_routing_rules_active_priority_idx
  on public.ticket_routing_rules (is_active, priority);

comment on table public.ticket_routing_rules is
  'Maps lead/center country, call_centers.region, or leads.language to default ticket assignee. Maintained by admins.';

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete restrict,
  publisher_id uuid not null references public.users (id) on delete restrict,
  assignee_id uuid references public.users (id) on delete set null,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  status public.ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_lead_id_idx on public.tickets (lead_id);
create index if not exists tickets_publisher_id_idx on public.tickets (publisher_id);
create index if not exists tickets_assignee_id_idx on public.tickets (assignee_id);
create index if not exists tickets_status_idx on public.tickets (status);

drop trigger if exists trg_tickets_updated_at on public.tickets;
create trigger trg_tickets_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Comments (body column matches lead_notes naming)
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete restrict,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists ticket_comments_ticket_id_created_at_idx
  on public.ticket_comments (ticket_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Followers
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_followers (
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ticket_id, user_id)
);

create index if not exists ticket_followers_user_id_idx on public.ticket_followers (user_id);

-- ---------------------------------------------------------------------------
-- Optional role (for reporting / future UI); assignees are resolved via rules or manager_user_id.
-- ---------------------------------------------------------------------------
insert into public.roles (key, name, description, is_system)
values (
  'publisher_manager',
  'Publisher Manager',
  'Support queue owner for publisher-raised tickets; use with ticket_routing_rules or as assignee.',
  true
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description;

-- ---------------------------------------------------------------------------
-- Security definer: visibility without RLS recursion between tickets <-> followers
-- ---------------------------------------------------------------------------
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
  )
  or exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = p_user_id
      and r.key = 'publisher_manager'
  );
$$;

grant execute on function public.ticket_user_has_access(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Auto-assign: routing rules, then publisher.manager_user_id
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

  select u.manager_user_id
  into v_manager
  from public.users u
  where u.id = new.publisher_id;

  new.assignee_id := v_manager;
  return new;
end;
$$;

drop trigger if exists trg_tickets_apply_routing on public.tickets;
create trigger trg_tickets_apply_routing
before insert on public.tickets
for each row execute function public.tickets_apply_default_assignee();

-- ---------------------------------------------------------------------------
-- Enforce solved + assignee change (column-level rules; RLS cannot see OLD/NEW split easily)
-- ---------------------------------------------------------------------------
create or replace function public.tickets_before_update_enforce()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = 'system_admin'
  )
  into is_admin;

  if new.assignee_id is distinct from old.assignee_id and not is_admin then
    raise exception 'Only a system admin may change the ticket assignee';
  end if;

  if new.status = 'solved'::public.ticket_status and old.status is distinct from 'solved'::public.ticket_status then
    if is_admin then
      return new;
    end if;
    if old.assignee_id = auth.uid() and new.assignee_id is not distinct from old.assignee_id then
      return new;
    end if;
    raise exception 'Only the assignee or a system admin may set status to solved';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tickets_before_update_enforce on public.tickets;
create trigger trg_tickets_before_update_enforce
before update on public.tickets
for each row execute function public.tickets_before_update_enforce();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.tickets to authenticated;
grant select, insert, update, delete on public.ticket_comments to authenticated;
grant select, insert, update, delete on public.ticket_followers to authenticated;

-- Routing table: no grants to authenticated (maintain via service role / SQL).

alter table public.tickets enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.ticket_followers enable row level security;
alter table public.ticket_routing_rules enable row level security;

-- ---------------------------------------------------------------------------
-- tickets policies
-- ---------------------------------------------------------------------------
drop policy if exists tickets_select_participants on public.tickets;
create policy tickets_select_participants
on public.tickets
for select
to authenticated
using (public.ticket_user_has_access(id, auth.uid()));

-- Publisher = call center admin only: same center as the lead (or system_admin).
drop policy if exists tickets_insert_publishers on public.tickets;
create policy tickets_insert_publishers
on public.tickets
for insert
to authenticated
with check (
  publisher_id = auth.uid()
  and exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and (
        public.has_role('system_admin')
        or (
          public.has_role('call_center_admin')
          and l.call_center_id is not null
          and exists (
            select 1
            from public.users u
            where u.id = auth.uid()
              and u.call_center_id is not null
              and u.call_center_id = l.call_center_id
          )
        )
      )
  )
);

drop policy if exists tickets_update_assignee on public.tickets;
create policy tickets_update_assignee
on public.tickets
for update
to authenticated
using (assignee_id = auth.uid())
with check (true);

drop policy if exists tickets_update_admin on public.tickets;
create policy tickets_update_admin
on public.tickets
for update
to authenticated
using (public.has_role('system_admin'))
with check (true);

-- ---------------------------------------------------------------------------
-- ticket_comments policies
-- ---------------------------------------------------------------------------
drop policy if exists ticket_comments_select on public.ticket_comments;
create policy ticket_comments_select
on public.ticket_comments
for select
to authenticated
using (public.ticket_user_has_access(ticket_id, auth.uid()));

drop policy if exists ticket_comments_insert on public.ticket_comments;
create policy ticket_comments_insert
on public.ticket_comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.ticket_user_has_access(ticket_id, auth.uid())
);

drop policy if exists ticket_comments_delete_own_or_admin on public.ticket_comments;
create policy ticket_comments_delete_own_or_admin
on public.ticket_comments
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.has_role('system_admin')
);

-- ---------------------------------------------------------------------------
-- ticket_followers policies
-- ---------------------------------------------------------------------------
drop policy if exists ticket_followers_select on public.ticket_followers;
create policy ticket_followers_select
on public.ticket_followers
for select
to authenticated
using (public.ticket_user_has_access(ticket_id, auth.uid()));

drop policy if exists ticket_followers_insert_assignee on public.ticket_followers;
create policy ticket_followers_insert_assignee
on public.ticket_followers
for insert
to authenticated
with check (
  public.has_role('system_admin')
  or public.has_role('publisher_manager')
  or exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and t.assignee_id = auth.uid()
  )
);

drop policy if exists ticket_followers_delete_assignee on public.ticket_followers;
create policy ticket_followers_delete_assignee
on public.ticket_followers
for delete
to authenticated
using (
  public.has_role('system_admin')
  or public.has_role('publisher_manager')
  or exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and t.assignee_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- ticket_routing_rules: service role / postgres only (no authenticated policies)
-- ---------------------------------------------------------------------------
