-- Test fixtures: 2 call centers, 2 admins, 2 agents, 22 leads (Transfer Portal pipeline + center-B + SSN-precedence pairs).
-- Re-runnable: deletes by fixed UUIDs / test-seed emails / submission_ids.
--
-- Login (all accounts): password TestSeed123!
--   test-seed-admin-a@insurvas.test   → test center one (admin)
--   test-seed-admin-b@insurvas.test   → test center two (admin)
--   test-seed-agent-a@insurvas.test   → test center one (agent)
--   test-seed-agent-b@insurvas.test   → test center two (agent)
--
-- Phone numbers (10-digit, no "test" substring in digits):
--   Center DIDs: 8724419031 (one), 6192287740 (two)
--
-- All Transfer Portal (pipeline 4) stages — log in as test-seed-agent-a@insurvas.test and use these phones:
--   2017726000 Transfer API          2017726008 Declined Underwriting
--   2017726001 Chargeback Fix API    2017726009 Pending Approval
--   2017726002 Incomplete Transfer   2017726010 Pending Manual Action
--   2017726003 Returned To Center - DQ 2017726011 GI DQ
--   2017726004 Previously Sold BPO   2017726012 Fulfilled Carrier Requirement
--   2017726005 DQ'd Can't be sold    2017726013 Pending Failed Payment Fix
--   2017726006 Needs BPO Callback    2017726014 New Submission
--   2017726007 Application Withdrawn 2017726015 Chargeback DQ
--   2017726080 / 2017726081 — SSN duplicate precedence fixtures (see block comment below)
--
-- Center B (test-seed-agent-b):4803316701 Pending Approval | 4803316702 Returned To Center - DQ
--
-- SSN duplicate / precedence (same phone + same SSN on file; transfer-check needs phone only — it loads SSN from CRM then queries all leads with that SSN):
--   2017726080 → crm_phone_match uses Pending Approval (rank 10) over Application Withdrawn (140) across the SSN cohort.
--   2017726081 + SSN 900701002 → Chargeback DQ (block, rank 20) + Pending Approval (addable, rank 10).
--     blocking beats allowing → "Customer has already been DQ from our agency."

-- Fixed IDs (stable across re-seeds)
-- Centers: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1 / aaa2
-- Admins
-- bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba1 / bba2
-- Agents
-- cccccccc-cccc-cccc-cccc-cccccccccca1 / cca2

delete from public.leads where submission_id like 'test-seed-%';
delete from public.users where id in (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba1'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba2'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccca2'::uuid
);
delete from auth.identities where user_id in (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba1'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba2'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccca2'::uuid
);
delete from auth.users where id in (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba1'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba2'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccca2'::uuid
);
delete from public.call_centers where id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid
);

insert into public.call_centers (id, name, is_active, status, did, country, region, email)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
    'test center one',
    true,
    'active',
    '8724419031',
    'United States',
    'test-region-a',
    'test-center-one@insurvas.test'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
    'test center two',
    true,
    'active',
    '6192287740',
    'United States',
    'test-region-b',
    'test-center-two@insurvas.test'
  );

-- Center A admin
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba1'::uuid,
  'authenticated',
  'authenticated',
  'test-seed-admin-a@insurvas.test',
  crypt('TestSeed123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  ''
);
insert into auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  gen_random_uuid(),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba1'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba1'::text,
  'email',
  jsonb_build_object(
    'sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba1'::text,
    'email', 'test-seed-admin-a@insurvas.test',
    'email_verified', true,
    'phone_verified', false
  ),
  now(),
  now(),
  now()
);
insert into public.users (id, full_name, status, call_center_id, role_id, email, is_licensed)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba1'::uuid,
  'test admin center a',
  'active',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
  (select id from public.roles where key = 'call_center_admin' limit 1),
  'test-seed-admin-a@insurvas.test',
  false
);

-- Center B admin
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba2'::uuid,
  'authenticated',
  'authenticated',
  'test-seed-admin-b@insurvas.test',
  crypt('TestSeed123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  ''
);
insert into auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  gen_random_uuid(),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba2'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba2'::text,
  'email',
  jsonb_build_object(
    'sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba2'::text,
    'email', 'test-seed-admin-b@insurvas.test',
    'email_verified', true,
    'phone_verified', false
  ),
  now(),
  now(),
  now()
);
insert into public.users (id, full_name, status, call_center_id, role_id, email, is_licensed)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba2'::uuid,
  'test admin center b',
  'active',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
  (select id from public.roles where key = 'call_center_admin' limit 1),
  'test-seed-admin-b@insurvas.test',
  false
);

-- Center A agent
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid,
  'authenticated',
  'authenticated',
  'test-seed-agent-a@insurvas.test',
  crypt('TestSeed123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  ''
);
insert into auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  gen_random_uuid(),
  'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccca1'::text,
  'email',
  jsonb_build_object(
    'sub', 'cccccccc-cccc-cccc-cccc-cccccccccca1'::text,
    'email', 'test-seed-agent-a@insurvas.test',
    'email_verified', true,
    'phone_verified', false
  ),
  now(),
  now(),
  now()
);
insert into public.users (id, full_name, status, call_center_id, role_id, email, is_licensed)
values (
  'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid,
  'test agent center a',
  'active',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
  (select id from public.roles where key = 'call_center_agent' limit 1),
  'test-seed-agent-a@insurvas.test',
  false
);

-- Center B agent
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'cccccccc-cccc-cccc-cccc-cccccccccca2'::uuid,
  'authenticated',
  'authenticated',
  'test-seed-agent-b@insurvas.test',
  crypt('TestSeed123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  ''
);
insert into auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  gen_random_uuid(),
  'cccccccc-cccc-cccc-cccc-cccccccccca2'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccca2'::text,
  'email',
  jsonb_build_object(
    'sub', 'cccccccc-cccc-cccc-cccc-cccccccccca2'::text,
    'email', 'test-seed-agent-b@insurvas.test',
    'email_verified', true,
    'phone_verified', false
  ),
  now(),
  now(),
  now()
);
insert into public.users (id, full_name, status, call_center_id, role_id, email, is_licensed)
values (
  'cccccccc-cccc-cccc-cccc-cccccccccca2'::uuid,
  'test agent center b',
  'active',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
  (select id from public.roles where key = 'call_center_agent' limit 1),
  'test-seed-agent-b@insurvas.test',
  false
);

insert into public.leads (
  submission_id,
  lead_unique_id,
  first_name,
  last_name,
  phone,
  stage,
  pipeline_id,
  stage_id,
  is_draft,
  submitted_by,
  call_center_id,
  submission_date,
  lead_source,
  tags,
  sms_access,
  email_access
) values
  ('test-seed-p4-116', 'test-seed-lu-116', 'test', 'stg transfer api', '2017726000', 'Transfer API', 4, 116, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-p4-120', 'test-seed-lu-120', 'test', 'stg chg fix api', '2017726001', 'Chargeback Fix API', 4, 120, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-p4-121', 'test-seed-lu-121', 'test', 'stg incomplete', '2017726002', 'Incomplete Transfer', 4, 121, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-p4-122', 'test-seed-lu-122', 'test', 'stg returned dq', '2017726003', 'Returned To Center - DQ', 4, 122, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-p4-123', 'test-seed-lu-123', 'test', 'stg prev sold bpo', '2017726004', 'Previously Sold BPO', 4, 123, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-p4-124', 'test-seed-lu-124', 'test', 'stg dq cant sold', '2017726005', 'DQ''d Can''t be sold', 4, 124, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-p4-125', 'test-seed-lu-125', 'test', 'stg bpo callback', '2017726006', 'Needs BPO Callback', 4, 125, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-p4-126', 'test-seed-lu-126', 'test', 'stg withdrawn', '2017726007', 'Application Withdrawn', 4, 126, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-p4-127', 'test-seed-lu-127', 'test', 'stg declined uw', '2017726008', 'Declined Underwriting', 4, 127, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-p4-128', 'test-seed-lu-128', 'test', 'stg pending appr', '2017726009', 'Pending Approval', 4, 128, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-p4-129', 'test-seed-lu-129', 'test', 'stg pending manual', '2017726010', 'Pending Manual Action', 4, 129, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-p4-142', 'test-seed-lu-142', 'test', 'stg gi dq', '2017726011', 'GI DQ', 4, 142, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-p4-143', 'test-seed-lu-143', 'test', 'stg fulfilled carr', '2017726012', 'Fulfilled Carrier Requirement', 4, 143, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-p4-144', 'test-seed-lu-144', 'test', 'stg pmt fix', '2017726013', 'Pending Failed Payment Fix', 4, 144, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-p4-145', 'test-seed-lu-145', 'test', 'stg new sub', '2017726014', 'New Submission', 4, 145, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-p4-146', 'test-seed-lu-146', 'test', 'stg chg dq', '2017726015', 'Chargeback DQ', 4, 146, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-b-128', 'test-seed-lu-b-128', 'test', 'center b pending', '4803316701', 'Pending Approval', 4, 128, false, 'cccccccc-cccc-cccc-cccc-cccccccccca2'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  ('test-seed-b-122', 'test-seed-lu-b-122', 'test', 'center b returned', '4803316702', 'Returned To Center - DQ', 4, 122, false, 'cccccccc-cccc-cccc-cccc-cccccccccca2'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid, current_date, 'BPO Transfer Lead Source', array['test']::text[], false, false),
  -- Precedence: two addable — lower precedence_rank wins (Pending Approval over Application Withdrawn)
  ('test-seed-ssn-prec-a', 'test-seed-lu-ssn-prec-a', 'test', 'ssn prec pending appr', '2017726080', 'Pending Approval', 4, 128, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test','ssn-precedence']::text[], false, false),
  ('test-seed-ssn-prec-b', 'test-seed-lu-ssn-prec-b', 'test', 'ssn prec withdrawn', '2017726080', 'Application Withdrawn', 4, 126, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test','ssn-precedence']::text[], false, false),
  -- Precedence: one blocking + one addable — blocking wins
  ('test-seed-ssn-blk-a', 'test-seed-lu-ssn-blk-a', 'test', 'ssn blk chargeback dq', '2017726081', 'Chargeback DQ', 4, 146, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test','ssn-precedence']::text[], false, false),
  ('test-seed-ssn-blk-b', 'test-seed-lu-ssn-blk-b', 'test', 'ssn blk pending appr', '2017726081', 'Pending Approval', 4, 128, false, 'cccccccc-cccc-cccc-cccc-cccccccccca1'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, current_date, 'BPO Transfer Lead Source', array['test','ssn-precedence']::text[], false, false);

update public.leads
set social = '900701001'
where submission_id in ('test-seed-ssn-prec-a', 'test-seed-ssn-prec-b');

update public.leads
set social = '900701002'
where submission_id in ('test-seed-ssn-blk-a', 'test-seed-ssn-blk-b');
