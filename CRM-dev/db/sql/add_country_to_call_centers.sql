-- Add country column to call_centers table
alter table public.call_centers
add column if not exists country text null;

-- Create index for country filtering
create index if not exists idx_call_centers_country on public.call_centers(country);

-- Update RLS policies to allow country field access (same as other fields)
-- The existing policies should already cover it since they allow all authenticated access

comment on column public.call_centers.country is 'Country where the call center is located (e.g., United States, Pakistan, Philippines)';
