create table if not exists public.agencies (
  id bigint default nextval('agencies_id_seq'::regclass) not null,
  name text not null,
  imo_id bigint not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint agencies_pkey PRIMARY KEY (id),
  constraint agencies_name_imo_unique UNIQUE (name, imo_id)
);

create table if not exists public.agent_carrier_states (
  agent_id bigint not null,
  carrier_id bigint not null,
  state_code text not null,
  created_at timestamp with time zone default now() not null,
  constraint agent_carrier_states_pkey PRIMARY KEY (agent_id, carrier_id, state_code)
);

create table if not exists public.agent_carriers (
  agent_id bigint not null,
  carrier_id bigint not null,
  created_at timestamp with time zone default now() not null,
  constraint agent_carriers_pkey PRIMARY KEY (agent_id, carrier_id)
);

create table if not exists public.agent_states (
  agent_id bigint not null,
  state_code text not null,
  created_at timestamp with time zone default now() not null,
  constraint agent_states_pkey PRIMARY KEY (agent_id, state_code)
);

create table if not exists public.agents (
  id bigint default nextval('agents_id_seq'::regclass) not null,
  first_name text not null,
  last_name text not null,
  agency_id bigint,
  status text default 'Active'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  user_id uuid,
  slack_username text,
  upline_id bigint,
  language text default 'English'::text,
  constraint agents_language_check CHECK (language = ANY (ARRAY['English'::text, 'Spanish'::text, 'French'::text, 'German'::text, 'Portuguese'::text, 'Italian'::text, 'Chinese'::text, 'Japanese'::text, 'Korean'::text, 'Arabic'::text, 'Hindi'::text, 'Tagalog'::text, 'Vietnamese'::text, 'Russian'::text, 'Polish'::text])),
  constraint agents_status_check CHECK (status = ANY (ARRAY['Active'::text, 'Inactive'::text])),
  constraint agents_pkey PRIMARY KEY (id)
);

create table if not exists public.announcements (
  id uuid default gen_random_uuid() not null,
  title text not null,
  description text,
  created_at timestamp with time zone default now(),
  constraint announcements_pkey PRIMARY KEY (id)
);

create table if not exists public.app_fix_banking_updates (
  id uuid default gen_random_uuid() not null,
  task_id uuid not null,
  submission_id text not null,
  lead_id uuid,
  notes text,
  created_at timestamp with time zone default now() not null,
  constraint app_fix_banking_updates_pkey PRIMARY KEY (id)
);

create table if not exists public.app_fix_carrier_requirements (
  id uuid default gen_random_uuid() not null,
  task_id uuid not null,
  submission_id text not null,
  lead_id uuid,
  carrier text,
  product_type text,
  coverage_amount text,
  monthly_premium text,
  notes text,
  created_at timestamp with time zone default now() not null,
  constraint app_fix_carrier_requirements_pkey PRIMARY KEY (id)
);

create table if not exists public.app_fix_tasks (
  id uuid default gen_random_uuid() not null,
  submission_id text not null,
  lead_id uuid,
  task_type text not null,
  status text default 'open'::text not null,
  assigned_to uuid,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint app_fix_tasks_task_type_check CHECK (task_type = ANY (ARRAY['new_sale'::text, 'fixed_payment'::text, 'carrier_requirements'::text])),
  constraint app_fix_tasks_pkey PRIMARY KEY (id)
);

create table if not exists public.call_centers (
  id uuid default gen_random_uuid() not null,
  name text not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  did text,
  slack_channel text,
  email text,
  logo_url text,
  region text,
  country text,
  status text default 'active'::text not null,
  account_id numeric,
  ghl_token text,
  constraint call_centers_status_check CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  constraint call_centers_pkey PRIMARY KEY (id),
  constraint call_centers_name_key UNIQUE (name)
);

create table if not exists public.call_result_reason_templates (
  id uuid default gen_random_uuid() not null,
  status text not null,
  reason text not null,
  note_template text,
  sort_order integer default 0 not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint call_result_reason_templates_pkey PRIMARY KEY (id),
  constraint call_result_reason_templates_status_reason_key UNIQUE (status, reason)
);

create table if not exists public.call_results (
  id uuid default gen_random_uuid() not null,
  submission_id text,
  lead_id uuid,
  status character varying,
  dq_reason text,
  notes text,
  new_draft_date date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  application_submitted boolean default false,
  carrier character varying,
  product_type character varying,
  draft_date character varying,
  submitting_agent character varying,
  licensed_agent_account character varying,
  coverage_amount numeric,
  monthly_premium numeric,
  face_amount numeric,
  submission_date timestamp with time zone,
  agent_id character varying,
  user_id uuid,
  buffer_agent text,
  agent_who_took_call text,
  sent_to_underwriting boolean default false,
  call_source text,
  is_callback boolean default false,
  is_retention_call boolean default false,
  carrier_attempted_1 character varying(255),
  carrier_attempted_2 character varying(255),
  carrier_attempted_3 character varying(255),
  disposition_path jsonb,
  generated_note text,
  manual_note text,
  quick_disposition_tag text,
  constraint call_results_pkey PRIMARY KEY (id)
);

create table if not exists public.call_update_logs (
  id uuid default gen_random_uuid() not null,
  submission_id text not null,
  lead_id uuid,
  event_type text not null,
  event_details jsonb,
  agent_id uuid,
  created_at timestamp with time zone default now() not null,
  constraint call_update_logs_pkey PRIMARY KEY (id)
);

create table if not exists public.callback_requests (
  id uuid default gen_random_uuid() not null,
  submission_id text not null,
  lead_vendor text not null,
  request_type text not null,
  notes text not null,
  customer_name text,
  phone_number text,
  status text default 'pending'::text,
  requested_by uuid,
  requested_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  completed_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint callback_requests_request_type_check CHECK (request_type = ANY (ARRAY['new_application'::text, 'updating_billing'::text, 'carrier_requirements'::text])),
  constraint callback_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])),
  constraint callback_requests_pkey PRIMARY KEY (id)
);

create table if not exists public.carrier_info (
  id bigint default nextval('carrier_info_id_seq'::regclass) not null,
  carrier_id bigint not null,
  group_type text not null,
  description text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint carrier_info_group_type_check CHECK (group_type = ANY (ARRAY['Carrier Requirements'::text, 'Authorization Format'::text, 'Limitations'::text, 'Information'::text])),
  constraint carrier_info_pkey PRIMARY KEY (id)
);

create table if not exists public.carrier_products (
  carrier_id bigint not null,
  product_id bigint not null,
  created_at timestamp with time zone default now() not null,
  constraint carrier_products_pkey PRIMARY KEY (carrier_id, product_id)
);

create table if not exists public.carriers (
  id bigint default nextval('carriers_id_seq'::regclass) not null,
  name text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  requires_state_appointment boolean default false not null,
  constraint carriers_pkey PRIMARY KEY (id),
  constraint carriers_name_key UNIQUE (name)
);

create table if not exists public.center_thresholds (
  id uuid default gen_random_uuid() not null,
  center_name text not null,
  lead_vendor text not null,
  tier text default 'C'::text,
  daily_transfer_target integer default 10,
  daily_sales_target integer default 5,
  max_dq_percentage numeric(5,2) default 20.00,
  min_approval_ratio numeric(5,2) default 20.00,
  transfer_weight integer default 40,
  approval_ratio_weight integer default 35,
  dq_weight integer default 25,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid,
  updated_by uuid,
  slack_webhook_url text,
  slack_channel text,
  slack_manager_id text,
  underwriting_threshold integer default 5,
  slack_channel_id text,
  constraint center_thresholds_tier_check CHECK (tier = ANY (ARRAY['A'::text, 'B'::text, 'C'::text])),
  constraint center_thresholds_pkey PRIMARY KEY (id),
  constraint center_thresholds_center_name_key UNIQUE (center_name),
  constraint center_thresholds_lead_vendor_key UNIQUE (lead_vendor)
);

create table if not exists public.commissions (
  id bigint not null,
  policy_number text not null,
  commission_amount numeric not null,
  commission_rate numeric,
  commission_type text,
  sales_agent_id uuid,
  sales_agent_name text,
  writing_no text,
  status text default 'pending'::text not null,
  earned_at timestamp with time zone,
  paid_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint commissions_pkey PRIMARY KEY (id)
);

create table if not exists public.daily_deal_flow (
  id uuid default gen_random_uuid() not null,
  submission_id text not null,
  client_phone_number text,
  lead_vendor text,
  date date default CURRENT_DATE,
  insured_name text,
  buffer_agent text,
  agent text,
  licensed_agent_account text,
  status text,
  call_result text,
  carrier text,
  product_type text,
  draft_date date,
  monthly_premium numeric(10,2),
  face_amount numeric(12,2),
  from_callback boolean default false,
  notes text,
  policy_number text,
  carrier_audit text,
  product_type_carrier text,
  level_or_gi text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  is_callback boolean default false,
  is_retention_call boolean default false,
  placement_status text,
  ghl_location_id text,
  ghl_opportunity_id text,
  ghlcontactid text,
  sync_status text,
  retention_agent text,
  retention_agent_id uuid,
  is_reviewed boolean default false,
  la_callback text,
  call_center_id uuid,
  initial_quote text,
  constraint daily_deal_flow_placement_status_check CHECK (placement_status = ANY (ARRAY['Good Standing'::text, 'Not Placed'::text, 'Pending Failed Payment Fix'::text, 'FDPF Pending Reason'::text, 'FDPF Insufficient Funds'::text, 'FDPF Incorrect Banking Info'::text, 'FDPF Unauthorized Draft'::text])),
  constraint daily_deal_flow_pkey PRIMARY KEY (id),
  constraint daily_deal_flow_submission_id_date_key UNIQUE (submission_id, date)
);

create table if not exists public.departments (
  id uuid default gen_random_uuid() not null,
  name text not null,
  publisher_manager_user_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint departments_pkey PRIMARY KEY (id)
);

create table if not exists public.disposition_events (
  id uuid default gen_random_uuid() not null,
  submission_id text not null,
  lead_id uuid not null,
  flow_key text not null,
  path_json jsonb default '[]'::jsonb not null,
  generated_note text,
  manual_note text,
  final_note text,
  quick_tag_label text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  constraint disposition_events_pkey PRIMARY KEY (id)
);

create table if not exists public.disposition_flow_nodes (
  id bigint default nextval('disposition_flow_nodes_id_seq'::regclass) not null,
  flow_id bigint not null,
  node_key text not null,
  node_type text not null,
  node_label text not null,
  sort_order integer default 0 not null,
  metadata jsonb default '{}'::jsonb not null,
  constraint disposition_flow_nodes_node_type_check CHECK (node_type = ANY (ARRAY['choice'::text, 'carrier_multi'::text, 'text'::text])),
  constraint disposition_flow_nodes_pkey PRIMARY KEY (id),
  constraint disposition_flow_nodes_flow_id_node_key_key UNIQUE (flow_id, node_key)
);

create table if not exists public.disposition_flow_options (
  id bigint default nextval('disposition_flow_options_id_seq'::regclass) not null,
  node_id bigint not null,
  option_key text not null,
  option_label text not null,
  sort_order integer default 0 not null,
  next_node_key text,
  template_key text,
  quick_tag_label text,
  requires_manual_note boolean default false not null,
  constraint disposition_flow_options_pkey PRIMARY KEY (id),
  constraint disposition_flow_options_node_id_option_key_key UNIQUE (node_id, option_key)
);

create table if not exists public.disposition_flows (
  id bigint default nextval('disposition_flows_id_seq'::regclass) not null,
  flow_key text not null,
  pipeline_stage_name text not null,
  flow_label text not null,
  root_node_key text not null,
  is_active boolean default true not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint disposition_flows_pkey PRIMARY KEY (id),
  constraint disposition_flows_flow_key_key UNIQUE (flow_key),
  constraint disposition_flows_pipeline_stage_name_flow_key_key UNIQUE (pipeline_stage_name, flow_key)
);

create table if not exists public.disposition_note_templates (
  template_key text not null,
  template_body text not null,
  append_manual_to_final boolean default false not null,
  description text,
  created_at timestamp with time zone default now() not null,
  constraint disposition_note_templates_pkey PRIMARY KEY (template_key)
);

create table if not exists public.imos (
  id bigint default nextval('imos_id_seq'::regclass) not null,
  name text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint imos_pkey PRIMARY KEY (id),
  constraint imos_name_key UNIQUE (name)
);

create table if not exists public.lead_notes (
  id uuid default gen_random_uuid() not null,
  lead_id uuid not null,
  body text not null,
  created_at timestamp with time zone default now() not null,
  created_by uuid,
  deal_tracker_review_note_id uuid,
  constraint lead_notes_body_check CHECK (char_length(TRIM(BOTH FROM body)) > 0),
  constraint lead_notes_pkey PRIMARY KEY (id)
);

create table if not exists public.lead_queue_comments (
  id uuid default gen_random_uuid() not null,
  queue_item_id uuid not null,
  author_user_id uuid not null,
  body text not null,
  visibility text default 'manager_and_assigned'::text not null,
  created_at timestamp with time zone default now() not null,
  constraint lead_queue_comments_body_check CHECK (length(TRIM(BOTH FROM body)) > 0),
  constraint lead_queue_comments_pkey PRIMARY KEY (id)
);

create table if not exists public.lead_queue_events (
  id uuid default gen_random_uuid() not null,
  queue_item_id uuid not null,
  event_type queue_event_type_enum not null,
  actor_user_id uuid,
  actor_role queue_role_enum,
  old_payload jsonb,
  new_payload jsonb,
  meta jsonb,
  slack_message_id text,
  created_at timestamp with time zone default now() not null,
  constraint lead_queue_events_pkey PRIMARY KEY (id)
);

create table if not exists public.lead_queue_items (
  id uuid default gen_random_uuid() not null,
  lead_id uuid,
  submission_id text,
  verification_session_id uuid,
  ddf_id uuid,
  policy_id text,
  client_name text,
  phone_number text,
  call_center_id uuid,
  call_center_name text,
  state text,
  carrier text,
  queue_type queue_type_enum default 'unclaimed_transfer'::queue_type_enum not null,
  status queue_status_enum default 'active'::queue_status_enum not null,
  current_owner_user_id uuid,
  current_owner_role queue_role_enum,
  assigned_ba_id uuid,
  assigned_la_id uuid,
  manager_assigned_by uuid,
  la_ready_at timestamp with time zone,
  la_ready_by uuid,
  ba_ready_at timestamp with time zone,
  ba_ready_by uuid,
  ba_transfer_sent_at timestamp with time zone,
  queued_at timestamp with time zone default now() not null,
  claimed_at timestamp with time zone,
  eta_minutes integer,
  ba_verification_percent numeric(5,2),
  action_required queue_action_required_enum default 'unknown'::queue_action_required_enum not null,
  imo_id text,
  agency_id text,
  attempted_application boolean default false not null,
  last_attempt_agent_id uuid,
  last_attempt_imo_id text,
  last_disposition text,
  take_next boolean default false not null,
  priority_score integer,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  transfer_screening_json jsonb,
  transfer_screening_at timestamp with time zone,
  constraint lead_queue_items_ba_verification_percent_check CHECK (ba_verification_percent IS NULL OR ba_verification_percent >= 0::numeric AND ba_verification_percent <= 100::numeric),
  constraint lead_queue_items_eta_minutes_check CHECK (eta_minutes IS NULL OR eta_minutes >= 0),
  constraint lead_queue_items_pkey PRIMARY KEY (id)
);

create table if not exists public.leads (
  id uuid default gen_random_uuid() not null,
  submission_date date,
  first_name text,
  last_name text,
  street1 text,
  street2 text,
  city text,
  state text,
  zip_code text,
  phone text,
  birth_state text,
  date_of_birth date,
  age text,
  social text,
  driver_license_number text,
  existing_coverage_last_2_years text,
  previous_applications_2_years text,
  height text,
  weight text,
  doctor_name text,
  tobacco_use text,
  health_conditions text,
  medications text,
  monthly_premium text,
  coverage_amount text,
  carrier text,
  product_type text,
  draft_date date,
  beneficiary_information text,
  bank_account_type text,
  institution_name text,
  routing_number text,
  account_number text,
  future_draft_date date,
  additional_information text,
  stage text default 'Transfer API'::text not null,
  submitted_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  lead_unique_id text,
  lead_value numeric(12,2),
  lead_source text,
  call_center_id uuid,
  stage_id integer,
  is_draft boolean default false not null,
  tags text[] default '{}'::text[] not null,
  submission_id text not null,
  pipeline_id bigint,
  licensed_agent_account text,
  language text,
  contact_id text,
  existing_coverage_details text,
  is_duplicate boolean default false not null,
  sms_access boolean default false not null,
  email_access boolean default false not null,
  has_backup_quote boolean default false not null,
  backup_carrier text,
  backup_product_type text,
  backup_monthly_premium text,
  backup_coverage_amount text,
  policy_id text,
  lead_vendor text,
  sync_required boolean default true not null,
  constraint leads_existing_coverage_last_2_years_check CHECK (existing_coverage_last_2_years = ANY (ARRAY['Yes'::text, 'No'::text])),
  constraint leads_previous_applications_2_years_check CHECK (previous_applications_2_years = ANY (ARRAY['Yes'::text, 'No'::text])),
  constraint leads_tobacco_use_check CHECK (tobacco_use = ANY (ARRAY['Yes'::text, 'No'::text])),
  constraint leads_pkey PRIMARY KEY (id),
  constraint leads_submission_id_key UNIQUE (submission_id)
);

create table if not exists public.permissions (
  id uuid default gen_random_uuid() not null,
  key text not null,
  resource text not null,
  action text not null,
  description text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  constraint permissions_pkey PRIMARY KEY (id),
  constraint permissions_key_key UNIQUE (key)
);

create table if not exists public.pipeline_stages (
  id bigint default nextval('pipeline_stages_id_seq'::regclass) not null,
  pipeline_id bigint not null,
  name text not null,
  "position" integer not null,
  show_in_reports boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  description text,
  constraint pipeline_stages_pkey PRIMARY KEY (id),
  constraint pipeline_stages_pipeline_id_name_key UNIQUE (pipeline_id, name),
  constraint pipeline_stages_pipeline_id_position_key UNIQUE (pipeline_id, "position")
);

create table if not exists public.pipelines (
  id bigint default nextval('pipelines_id_seq'::regclass) not null,
  name text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint pipelines_pkey PRIMARY KEY (id),
  constraint pipelines_name_key UNIQUE (name)
);

create table if not exists public.policies (
  id bigint not null,
  lead_id uuid,
  deal_name text,
  tasks text,
  ghl_name text,
  ghl_stage text,
  policy_status text,
  deal_creation_date timestamp with time zone,
  policy_number text,
  deal_value numeric,
  cc_value numeric,
  notes text,
  status text,
  last_updated timestamp with time zone,
  sales_agent text,
  writing_no text,
  commission_type text,
  effective_date timestamp with time zone,
  call_center text,
  phone_number text,
  cc_pmt_ws text,
  cc_cb_ws text,
  carrier_status text,
  lead_creation_date timestamp with time zone,
  policy_type text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  monday_item_id text,
  carrier text,
  group_title text,
  group_color text,
  disposition text,
  disposition_date timestamp with time zone,
  disposition_agent_id uuid,
  disposition_agent_name text,
  disposition_notes text,
  callback_datetime timestamp with time zone,
  disposition_count integer default 0,
  is_active boolean default true not null,
  lock_status text default 'pending'::text,
  locked_at timestamp with time zone,
  locked_by uuid,
  locked_by_name text,
  lock_password text,
  lock_reason text,
  constraint policies_pkey PRIMARY KEY (id),
  constraint policies_policy_number_key UNIQUE (policy_number)
);

create table if not exists public.product_guides (
  id bigint default nextval('product_guides_id_seq'::regclass) not null,
  title text not null,
  slug text not null,
  description text,
  bullets jsonb default '[]'::jsonb,
  media_url text,
  media_type text,
  category text default 'General'::text not null,
  display_order integer default 0 not null,
  is_published boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  screenshots jsonb default '[]'::jsonb,
  video_url text,
  constraint product_guides_media_type_check CHECK (media_type = ANY (ARRAY['video'::text, 'image'::text, 'none'::text])),
  constraint product_guides_pkey PRIMARY KEY (id),
  constraint product_guides_slug_key UNIQUE (slug)
);

create table if not exists public.products (
  id bigint default nextval('products_id_seq'::regclass) not null,
  name text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint products_pkey PRIMARY KEY (id),
  constraint products_name_key UNIQUE (name)
);

create table if not exists public.role_permissions (
  role_id uuid not null,
  permission_id uuid not null,
  created_at timestamp with time zone default now() not null,
  constraint role_permissions_pkey PRIMARY KEY (role_id, permission_id)
);

create table if not exists public.roles (
  id uuid default gen_random_uuid() not null,
  key text not null,
  name text not null,
  description text,
  is_system boolean default true not null,
  created_at timestamp with time zone default now() not null,
  constraint roles_pkey PRIMARY KEY (id),
  constraint roles_key_key UNIQUE (key)
);

create table if not exists public.ssn_duplicate_stage_rules (
  id bigint default nextval('ssn_duplicate_stage_rules_id_seq'::regclass) not null,
  stage_name text not null,
  ghl_stage text,
  message text not null,
  is_addable boolean default true not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  precedence_rank integer default 500 not null,
  constraint ssn_duplicate_stage_rules_pkey PRIMARY KEY (id),
  constraint ssn_duplicate_stage_rules_stage_name_key UNIQUE (stage_name)
);

create table if not exists public.stage_disposition_map (
  id bigint default nextval('stage_disposition_map_id_seq'::regclass) not null,
  stage_id bigint not null,
  disposition text not null,
  created_at timestamp with time zone default now() not null,
  constraint stage_disposition_map_pkey PRIMARY KEY (id),
  constraint stage_disposition_map_disposition_key UNIQUE (disposition),
  constraint stage_disposition_map_stage_id_key UNIQUE (stage_id)
);

create table if not exists public.states (
  code text not null,
  name text not null,
  constraint states_pkey PRIMARY KEY (code),
  constraint states_name_key UNIQUE (name)
);

create table if not exists public.ticket_comments (
  id uuid default gen_random_uuid() not null,
  ticket_id uuid not null,
  user_id uuid not null,
  body text not null,
  created_at timestamp with time zone default now() not null,
  constraint ticket_comments_body_check CHECK (char_length(TRIM(BOTH FROM body)) > 0),
  constraint ticket_comments_pkey PRIMARY KEY (id)
);

create table if not exists public.ticket_followers (
  ticket_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone default now() not null,
  constraint ticket_followers_pkey PRIMARY KEY (ticket_id, user_id)
);

create table if not exists public.ticket_routing_rules (
  id uuid default gen_random_uuid() not null,
  priority integer default 100 not null,
  rule_kind text not null,
  match_value text not null,
  assignee_user_id uuid not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  constraint ticket_routing_rules_rule_kind_check CHECK (rule_kind = ANY (ARRAY['country'::text, 'region'::text, 'language'::text])),
  constraint ticket_routing_rules_pkey PRIMARY KEY (id)
);

create table if not exists public.tickets (
  id uuid default gen_random_uuid() not null,
  lead_id uuid,
  publisher_id uuid not null,
  assignee_id uuid,
  title text not null,
  description text,
  status ticket_status default 'open'::ticket_status not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  ticket_type ticket_type,
  priority ticket_priority default 'medium'::ticket_priority,
  attachments jsonb default '[]'::jsonb,
  call_center_id uuid,
  lead_name text,
  constraint tickets_title_check CHECK (char_length(TRIM(BOTH FROM title)) > 0),
  constraint tickets_pkey PRIMARY KEY (id)
);

create table if not exists public.upline_carrier_states (
  carrier_id bigint not null,
  state_code text not null,
  created_at timestamp with time zone default now() not null,
  constraint upline_carrier_states_pkey PRIMARY KEY (carrier_id, state_code)
);

create table if not exists public.user_creation_audit (
  id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  user_id uuid,
  email text not null,
  temp_password text not null,
  role_key text not null,
  role_id uuid,
  full_name text,
  created_by uuid,
  created_by_email text,
  welcome_email_to text,
  unlicensed_sales_subtype text,
  constraint user_creation_audit_pkey PRIMARY KEY (id)
);

create table if not exists public.user_permissions (
  user_id uuid not null,
  permission_id uuid not null,
  created_at timestamp with time zone default now() not null,
  constraint user_permissions_pkey PRIMARY KEY (user_id, permission_id)
);

create table if not exists public.users (
  id uuid not null,
  full_name text,
  status text default 'invited'::text not null,
  call_center_id uuid,
  role_id uuid,
  manager_user_id uuid,
  is_licensed boolean default false not null,
  license_number text,
  slack_user_id text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  phone text,
  email text,
  unlicensed_sales_subtype text,
  department_id uuid,
  licensed_name text,
  constraint users_status_check CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'invited'::text, 'suspended'::text])),
  constraint users_unlicensed_sales_subtype_check CHECK (unlicensed_sales_subtype IS NULL OR (unlicensed_sales_subtype = ANY (ARRAY['buffer_agent'::text, 'retention_agent'::text]))),
  constraint users_pkey PRIMARY KEY (id)
);

create table if not exists public.verification_items (
  id uuid default gen_random_uuid() not null,
  session_id uuid not null,
  field_name text not null,
  field_category text,
  original_value text,
  verified_value text,
  is_verified boolean default false,
  is_modified boolean default false,
  verified_at timestamp with time zone,
  verified_by uuid,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint verification_items_pkey PRIMARY KEY (id),
  constraint verification_items_session_id_field_name_key UNIQUE (session_id, field_name)
);

create table if not exists public.verification_sessions (
  id uuid default gen_random_uuid() not null,
  submission_id text not null,
  buffer_agent_id uuid,
  licensed_agent_id uuid,
  status text default 'pending'::text not null,
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  transferred_at timestamp with time zone,
  progress_percentage integer default 0,
  total_fields integer default 0,
  verified_fields integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  claimed_at timestamp with time zone,
  is_retention_call boolean default false,
  retention_agent_id uuid,
  retention_notes jsonb,
  constraint verification_sessions_progress_percentage_check CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  constraint verification_sessions_status_check CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'ready_for_transfer'::text, 'transferred'::text, 'completed'::text, 'call_dropped'::text, 'buffer_done'::text, 'la_done'::text])),
  constraint verification_sessions_pkey PRIMARY KEY (id),
  constraint verification_sessions_submission_id_key UNIQUE (submission_id)
);