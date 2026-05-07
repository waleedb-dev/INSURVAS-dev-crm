-- Allow 'call_update' entries in call results and avoid breaking
-- last_call_result denormalisation (which only accepts real call outcomes).

alter table public.bpo_center_lead_call_results
  drop constraint if exists bpo_center_lead_call_result_code_chk;

alter table public.bpo_center_lead_call_results
  add constraint bpo_center_lead_call_result_code_chk check (
    result_code = any (array[
      'call_completed'::text,
      'no_pickup'::text,
      'call_update'::text
    ])
  );

create or replace function public.bpo_center_lead_sync_last_call()
returns trigger
language plpgsql
as $$
begin
  if new.result_code = any (array['call_completed'::text, 'no_pickup'::text]) then
    update public.bpo_center_leads
    set
      last_call_result = new.result_code,
      last_call_result_at = new.recorded_at,
      updated_at = now()
    where id = new.center_lead_id;
  else
    -- 'call_update' is an activity log entry, not a call outcome.
    update public.bpo_center_leads
    set updated_at = now()
    where id = new.center_lead_id;
  end if;

  return new;
end;
$$;

