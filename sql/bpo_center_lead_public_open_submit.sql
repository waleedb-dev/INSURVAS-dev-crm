-- Public intake without invite token: creates a new bpo_center_leads row + team (anon).
-- Safe to run after bpo_center_leads_module.sql.

drop function if exists public.bpo_center_lead_public_open_submit(text, jsonb);

create or replace function public.bpo_center_lead_public_open_submit(
  p_centre_display_name text,
  p_team jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_el jsonb;
  v_pos text;
  v_custom text;
  v_name text;
  v_email text;
  v_phone text;
  v_admin bool;
  v_admin_count integer := 0;
  v_sort integer := 0;
  v_kind text;
begin
  if p_centre_display_name is null or length(trim(p_centre_display_name)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'centre_name_required');
  end if;

  if p_team is null or jsonb_typeof(p_team) <> 'array' or jsonb_array_length(p_team) = 0 then
    return jsonb_build_object('ok', false, 'error', 'team_required');
  end if;

  for v_el in select value from jsonb_array_elements(p_team)
  loop
    v_sort := v_sort + 1;
    v_name := trim(coalesce(v_el->>'full_name', ''));
    v_email := lower(trim(coalesce(v_el->>'email', '')));
    v_phone := nullif(trim(coalesce(v_el->>'phone', '')), '');
    v_pos := lower(trim(coalesce(v_el->>'position_key', '')));
    v_custom := nullif(trim(coalesce(v_el->>'custom_position_label', '')), '');
    v_admin := coalesce((v_el->>'is_center_admin')::boolean, false);

    if v_admin then
      v_admin_count := v_admin_count + 1;
    end if;

    if length(v_name) = 0 or length(v_email) = 0 then
      return jsonb_build_object('ok', false, 'error', 'team_name_email_required');
    end if;

    if v_pos not in ('owner', 'manager', 'closer', 'custom') then
      return jsonb_build_object('ok', false, 'error', 'team_invalid_position');
    end if;

    if v_pos = 'custom' and (v_custom is null or length(v_custom) = 0) then
      return jsonb_build_object('ok', false, 'error', 'team_custom_label_required');
    end if;
  end loop;

  if v_admin_count <> 1 then
    return jsonb_build_object('ok', false, 'error', 'team_exactly_one_admin');
  end if;

  insert into public.bpo_center_leads (
    centre_display_name,
    form_submitted_at,
    stage
  ) values (
    trim(p_centre_display_name),
    now(),
    'pre_onboarding'
  )
  returning id into v_lead_id;

  v_sort := 0;
  for v_el in select value from jsonb_array_elements(p_team)
  loop
    v_sort := v_sort + 1;
    v_name := trim(coalesce(v_el->>'full_name', ''));
    v_email := lower(trim(coalesce(v_el->>'email', '')));
    v_phone := nullif(trim(coalesce(v_el->>'phone', '')), '');
    v_pos := lower(trim(coalesce(v_el->>'position_key', '')));
    v_custom := nullif(trim(coalesce(v_el->>'custom_position_label', '')), '');
    v_admin := coalesce((v_el->>'is_center_admin')::boolean, false);
    v_kind := case when v_admin then 'center_admin'::text else 'team_member'::text end;

    insert into public.bpo_center_lead_team_members (
      center_lead_id, member_kind, full_name, email, phone, position_key, custom_position_label, sort_order
    ) values (
      v_lead_id, v_kind, v_name, v_email, v_phone, v_pos,
      case when v_pos = 'custom' then v_custom else null end,
      v_sort
    );
  end loop;

  return jsonb_build_object('ok', true, 'center_lead_id', v_lead_id);
end;
$$;

grant execute on function public.bpo_center_lead_public_open_submit(text, jsonb) to anon, authenticated;
