-- After inserting into auth.users via SQL, GoTrue can return:
--   {"code":"unexpected_failure","message":"Database error querying schema"}
-- if token-related columns are NULL. Coalesce them to empty string (Supabase / GoTrue expectation).
--
-- Target one user by email:
update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where email = 'publisher.manager.dev@insurvas.local';

-- Optional: fix any row still holding NULLs in those columns
-- update auth.users
-- set
--   confirmation_token = coalesce(confirmation_token, ''),
--   recovery_token = coalesce(recovery_token, ''),
--   email_change = coalesce(email_change, ''),
--   email_change_token_new = coalesce(email_change_token_new, ''),
--   email_change_token_current = coalesce(email_change_token_current, ''),
--   phone_change = coalesce(phone_change, ''),
--   phone_change_token = coalesce(phone_change_token, ''),
--   reauthentication_token = coalesce(reauthentication_token, '')
-- where confirmation_token is null
--    or recovery_token is null
--    or email_change is null
--    or email_change_token_new is null;
