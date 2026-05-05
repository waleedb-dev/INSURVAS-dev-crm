-- Add existing coverage details field for transfer lead application form.
alter table public.leads
  add column if not exists existing_coverage_details text;