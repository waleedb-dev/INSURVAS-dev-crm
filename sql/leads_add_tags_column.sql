-- Add tags support on leads for duplicate labeling and future categorization
alter table public.leads
add column if not exists tags text[] not null default '{}';
