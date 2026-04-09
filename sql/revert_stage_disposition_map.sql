-- Rollback for migration `stage_disposition_map` (removes map table + extra Transfer Portal stages).
-- Safe if no `leads.stage_id` points at those stages.

drop table if exists public.stage_disposition_map cascade;

delete from public.pipeline_stages ps
using public.pipelines p
where ps.pipeline_id = p.id
  and p.name = 'Transfer Portal'
  and ps.name in (
    'GI DQ',
    'Fulfilled Carrier Requirement',
    'Pending Failed Payment Fix',
    'New Submission',
    'Chargeback DQ'
  );
