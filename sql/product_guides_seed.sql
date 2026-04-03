-- Product Guides table for storing help articles and guides
create table if not exists public.product_guides (
  id bigserial primary key,
  title text not null,
  slug text not null unique,
  description text,
  bullets jsonb default '[]',
  video_url text,
  screenshots jsonb default '[]',
  category text not null default 'General',
  display_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for faster slug lookups
create index if not exists idx_product_guides_slug on public.product_guides(slug);
create index if not exists idx_product_guides_category on public.product_guides(category);
create index if not exists idx_product_guides_display_order on public.product_guides(display_order);

-- Grants for browser client access
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.product_guides to authenticated;
grant usage, select on sequence public.product_guides_id_seq to authenticated;

-- RLS policies
alter table public.product_guides enable row level security;

drop policy if exists product_guides_select_all_authenticated on public.product_guides;
create policy product_guides_select_all_authenticated
on public.product_guides
for select
to authenticated
using (true);

drop policy if exists product_guides_insert_all_authenticated on public.product_guides;
create policy product_guides_insert_all_authenticated
on public.product_guides
for insert
to authenticated
with check (true);

drop policy if exists product_guides_update_all_authenticated on public.product_guides;
create policy product_guides_update_all_authenticated
on public.product_guides
for update
to authenticated
using (true)
with check (true);

drop policy if exists product_guides_delete_all_authenticated on public.product_guides;
create policy product_guides_delete_all_authenticated
on public.product_guides
for delete
to authenticated
using (true);

-- Seed some example guides
insert into public.product_guides (title, slug, description, bullets, screenshots, category, display_order)
values
  (
    'Getting Started with INSURVAS CRM',
    'getting-started',
    'Learn the basics of navigating and using the INSURVAS CRM platform effectively.',
    '["Navigate the dashboard using the sidebar menu", "Understand the role-based access control system", "Learn how to search and filter leads", "Set up your user preferences and notifications"]',
    '[]',
    'Getting Started',
    1
  ),
  (
    'Managing Daily Deal Flow',
    'daily-deal-flow',
    'Master the Daily Deal Flow module to track and manage your leads efficiently.',
    '["View and filter leads by status and agent", "Use inline editing for quick updates", "Mark leads as incomplete with one click", "Track call results and agent assignments"]',
    '[]',
    'Daily Deal Flow',
    2
  ),
  (
    'Lead Pipeline Management',
    'lead-pipeline',
    'Understand how to move leads through the pipeline stages and track progress.',
    '["Drag and drop leads between pipeline stages", "Update lead status in bulk", "View pipeline analytics and reports", "Set up automated stage transitions"]',
    '[]',
    'Lead Pipeline',
    3
  ),
  (
    'Transferring Leads',
    'transfer-leads',
    'Learn the complete process of transferring leads to carriers and tracking their status.',
    '["Submit leads to transfer portal", "Track transfer status in real-time", "Handle incomplete transfers", "View transfer history and audit logs"]',
    '[]',
    'Transfer Leads',
    4
  ),
  (
    'User Access Management',
    'user-access',
    'Configure user roles and permissions for your team.',
    '["Add new users to the system", "Assign roles (Admin, Manager, Agent)", "Set up permissions for specific actions", "Deactivate or delete user accounts"]',
    '[]',
    'Administration',
    5
  )
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  bullets = excluded.bullets,
  screenshots = excluded.screenshots,
  category = excluded.category,
  display_order = excluded.display_order,
  updated_at = now();
