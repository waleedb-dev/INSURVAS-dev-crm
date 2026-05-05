-- Exported via Supabase MCP (execute_sql)
-- Generated from pg_get_functiondef() for schema: public

CREATE OR REPLACE FUNCTION public.update_center_thresholds_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$;

BEGIN
  NEW.updated_at = now();
  RETURN NEW;

END;
$function$;


CREATE OR REPLACE FUNCTION public.is_admin_or_hr()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$;
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = auth.uid() 
    AND r.key IN ('system_admin', 'hr')
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.is_call_center_admin(target_center_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$;
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = auth.uid() 
    AND r.key = 'call_center_admin'
    AND u.call_center_id = target_center_id
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.leads_set_submission_id_from_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$;
begin
  if new.submission_id is null then
    new.submission_id := new.id::text;
  end if;
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.set_updated_at_lead_queue_items()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$;
begin
  new.updated_at = now();
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.update_verification_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$;
declare
  sid uuid;
begin
  if tg_op = 'DELETE' then
    sid := old.session_id;
  else
    sid := new.session_id;
  end if;

  update public.verification_sessions vs
  set
    verified_fields = (
      select count(*)::int
      from public.verification_items vi
      where vi.session_id = sid and coalesce(vi.is_verified, false) = true
    ),
    total_fields = (
      select count(*)::int
      from public.verification_items vi
      where vi.session_id = sid
    ),
    progress_percentage = case
      when (
        select count(*) from public.verification_items vi where vi.session_id = sid
      ) = 0 then 0
      else least(
        100,
        greatest(
          0,
          round(
            100.0 * (
              select count(*)::numeric
              from public.verification_items vi
              where vi.session_id = sid and coalesce(vi.is_verified, false) = true
            )
            / nullif(
              (select count(*)::numeric from public.verification_items vi where vi.session_id = sid),
              0
            )
          )::int
        )
      )
    end,
    updated_at = now()
  where vs.id = sid;

  return coalesce(new, old);
end;
$function$;


CREATE OR REPLACE FUNCTION public.tickets_apply_default_assignee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$;
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

  -- Routing rules only apply when a lead is linked
  if new.lead_id is not null then
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
  end if;

  -- Fallback: assign to a publisher_manager user
  -- Prefer one in the same call centre if ticket has call_center_id
  select u.id
  into v_manager
  from public.users u
  join public.roles r on r.id = u.role_id
  where r.key = 'publisher_manager'
  order by
    case when new.call_center_id is not null and u.call_center_id = new.call_center_id then 0 else 1 end,
    u.created_at asc
  limit 1;

  if v_manager is not null then
    new.assignee_id := v_manager;
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.leads_sync_pipeline_stage_refs()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$;
declare
  v_pipeline_id bigint;
  v_stage_name text;
begin
  -- If stage_id is provided, derive pipeline_id + canonical stage name.
  if new.stage_id is not null then
    select ps.pipeline_id, ps.name
    into v_pipeline_id, v_stage_name
    from public.pipeline_stages ps
    where ps.id = new.stage_id;

    if found then
      new.pipeline_id := v_pipeline_id;
      new.stage := v_stage_name;
    end if;
  end if;

  -- If stage text + pipeline_id are present but stage_id missing, resolve stage_id.
  if new.stage_id is null and new.stage is not null and new.pipeline_id is not null then
    select ps.id, ps.name
    into new.stage_id, v_stage_name
    from public.pipeline_stages ps
    where ps.pipeline_id = new.pipeline_id
      and ps.name = trim(new.stage)
    limit 1;

    if found then
      new.stage := v_stage_name;
    end if;
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.tickets_before_update_enforce()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$;
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
$function$;


CREATE OR REPLACE FUNCTION public.initialize_verification_items(session_id_param uuid, submission_id_param text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$;
declare
  l record;
  lead_name text;
  street_address text;
begin
  select
    first_name,
    last_name,
    street1,
    street2,
    city,
    state,
    zip_code,
    phone,
    birth_state,
    date_of_birth,
    age,
    social,
    driver_license_number,
    existing_coverage_last_2_years,
    previous_applications_2_years,
    height,
    weight,
    doctor_name,
    tobacco_use,
    health_conditions,
    medications,
    monthly_premium,
    coverage_amount,
    carrier,
    product_type,
    draft_date,
    future_draft_date,
    beneficiary_information,
    institution_name,
    routing_number,
    account_number,
    bank_account_type,
    additional_information,
    lead_source,
    email,
    la_notes
  into l
  from public.leads
  where submission_id = submission_id_param
     or id::text = submission_id_param
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  lead_name := trim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, ''));
  if lead_name = '' then
    lead_name := null;
  end if;

  street_address := trim(btrim(coalesce(l.street1, '')) || case when coalesce(l.street2, '') <> '' then ' ' || btrim(l.street2) else '' end);
  if street_address = '' then
    street_address := null;
  end if;

  insert into public.verification_items (
    session_id,
    field_name,
    field_category,
    original_value
  )
  values
    (session_id_param, 'customer_full_name', 'personal', lead_name),
    (session_id_param, 'date_of_birth', 'personal', nullif(coalesce(l.date_of_birth::text, ''), '')),
    (session_id_param, 'birth_state', 'personal', nullif(coalesce(l.birth_state::text, ''), '')),
    (session_id_param, 'age', 'personal', nullif(coalesce(l.age::text, ''), '')),
    (session_id_param, 'social_security', 'personal', nullif(coalesce(l.social::text, ''), '')),
    (session_id_param, 'driver_license', 'personal', nullif(coalesce(l.driver_license_number::text, ''), '')),

    (session_id_param, 'street_address', 'contact', street_address),
    (session_id_param, 'city', 'contact', nullif(coalesce(l.city::text, ''), '')),
    (session_id_param, 'state', 'contact', nullif(coalesce(l.state::text, ''), '')),
    (session_id_param, 'zip_code', 'contact', nullif(coalesce(l.zip_code::text, ''), '')),
    (session_id_param, 'phone_number', 'contact', nullif(coalesce(l.phone::text, ''), '')),
    (session_id_param, 'email', 'contact', nullif(coalesce(l.email::text, ''), '')),

    (session_id_param, 'height', 'health', nullif(coalesce(l.height::text, ''), '')),
    (session_id_param, 'weight', 'health', nullif(coalesce(l.weight::text, ''), '')),
    (session_id_param, 'doctors_name', 'health', nullif(coalesce(l.doctor_name::text, ''), '')),
    (session_id_param, 'tobacco_use', 'health', nullif(coalesce(l.tobacco_use::text, ''), '')),
    (session_id_param, 'health_conditions', 'health', nullif(coalesce(l.health_conditions::text, ''), '')),
    (session_id_param, 'medications', 'health', nullif(coalesce(l.medications::text, ''), '')),
    (session_id_param, 'existing_coverage', 'health', nullif(coalesce(l.existing_coverage_last_2_years::text, ''), '')),
    (session_id_param, 'previous_applications', 'health', nullif(coalesce(l.previous_applications_2_years::text, ''), '')),

    (session_id_param, 'carrier', 'insurance', nullif(coalesce(l.carrier::text, ''), '')),
    (session_id_param, 'product_type', 'insurance', nullif(coalesce(l.product_type::text, ''), '')),
    (session_id_param, 'coverage_amount', 'insurance', nullif(coalesce(l.coverage_amount::text, ''), '')),
    (session_id_param, 'monthly_premium', 'insurance', nullif(coalesce(l.monthly_premium::text, ''), '')),
    (session_id_param, 'draft_date', 'insurance', nullif(coalesce(l.draft_date::text, ''), '')),
    (session_id_param, 'future_draft_date', 'insurance', nullif(coalesce(l.future_draft_date::text, ''), '')),

    (session_id_param, 'beneficiary_information', 'banking', nullif(coalesce(l.beneficiary_information::text, ''), '')),
    (session_id_param, 'institution_name', 'banking', nullif(coalesce(l.institution_name::text, ''), '')),
    (session_id_param, 'beneficiary_routing', 'banking', nullif(coalesce(l.routing_number::text, ''), '')),
    (session_id_param, 'beneficiary_account', 'banking', nullif(coalesce(l.account_number::text, ''), '')),
    (session_id_param, 'account_type', 'banking', nullif(coalesce(l.bank_account_type::text, ''), '')),

    (session_id_param, 'additional_notes', 'additional', nullif(coalesce(l.additional_information::text, ''), '')),
    (session_id_param, 'la_notes', 'additional', nullif(coalesce(l.la_notes::text, ''), '')),
    (session_id_param, 'lead_vendor', 'additional', nullif(coalesce(l.lead_source::text, ''), '')),

    (session_id_param, 'call_dropped', 'outcome', null)
  on conflict (session_id, field_name) do update
    set original_value = excluded.original_value
  where
    (public.verification_items.original_value is null or public.verification_items.original_value = '')
    and excluded.original_value is not null
    and excluded.original_value <> '';
end;
$function$;


CREATE OR REPLACE FUNCTION public.current_user_call_center_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$;
  select u.call_center_id
  from public.users u
  where u.id = auth.uid();
$function$;


CREATE OR REPLACE FUNCTION public.ticket_user_has_access(p_ticket_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$;
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
$function$;


CREATE OR REPLACE FUNCTION public.list_publisher_managers_for_ticket_assignee()
 RETURNS TABLE(id uuid, full_name text, email text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$;
begin
  if not (
    public.has_role('system_admin')
    or public.has_role('call_center_admin')
    or public.has_role('publisher_manager')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    (coalesce(nullif(trim(u.full_name), ''), u.email))::text as full_name,
    u.email
  from public.users u
  join public.roles r on r.id = u.role_id
  where r.key = 'publisher_manager'
    and u.status = 'active'
  order by 2 asc, 3 asc;
end;
$function$;


CREATE OR REPLACE FUNCTION public.list_publisher_managers_for_ticket_assign()
 RETURNS TABLE(id uuid, full_name text, email text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$;
begin
  if not (public.has_role('call_center_admin') or public.has_role('system_admin')) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  return query
  select
    u.id,
    coalesce(nullif(trim(u.full_name), ''), u.email) as full_name,
    u.email
  from public.users u
  join public.roles r on r.id = u.role_id
  where r.key = 'publisher_manager'
    and u.status = 'active'
  order by 2 asc, 3 asc;
end;
$function$;


CREATE OR REPLACE FUNCTION public.get_user_call_center_id(p_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$;
  select u.call_center_id from public.users u where u.id = p_user_id;
$function$;


CREATE OR REPLACE FUNCTION public.assign_default_role_to_user()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$;
declare
  default_role_id uuid;
begin
  if new.role_id is null then
    select id into default_role_id from public.roles where key = 'call_center_agent' limit 1;
    if default_role_id is not null then
      new.role_id := default_role_id;
    end if;
  end if;
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$;
begin
  new.updated_at = now();
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.is_active_user(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$;
  select exists (
    select 1
    from public.users u
    where u.id = p_user_id and u.status = 'active'
  );
$function$;


CREATE OR REPLACE FUNCTION public.has_role(p_role_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$;
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = p_role_key
  );
$function$;


CREATE OR REPLACE FUNCTION public.has_any_role(p_role_keys text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$;
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.key = any (p_role_keys)
  );
$function$;


CREATE OR REPLACE FUNCTION public.has_permission(p_permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$;
  select exists (
    select 1
    from public.permissions p
    where p.is_active = true
      and p.key = p_permission_key
      and (
        exists (
          select 1
          from public.users u
          join public.role_permissions rp on rp.role_id = u.role_id
          where u.id = auth.uid()
            and rp.permission_id = p.id
        )
        or exists (
          select 1
          from public.user_permissions up
          where up.user_id = auth.uid()
            and up.permission_id = p.id
        )
      )
  );
$function$;


CREATE OR REPLACE FUNCTION public.has_any_permission(p_permission_keys text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$;
  select exists (
    select 1
    from public.permissions p
    where p.is_active = true
      and p.key = any (p_permission_keys)
      and (
        exists (
          select 1
          from public.users u
          join public.role_permissions rp on rp.role_id = u.role_id
          where u.id = auth.uid()
            and rp.permission_id = p.id
        )
        or exists (
          select 1
          from public.user_permissions up
          where up.user_id = auth.uid()
            and up.permission_id = p.id
        )
      )
  );
$function$;

