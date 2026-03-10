# Auth Roles, RLS Setup, and Testing Plan

This document captures the current decision:
- Fixed roles
- No separate `permissions` table for now
- Authorization enforced in Supabase RLS (not frontend)

## 1) Current Auth Model

## Tables
- `public.users` (profile + org scope)
- `public.roles` (8 fixed role keys)
- `public.user_roles` (role assignments)

## Role Keys
- `call_center_agent`
- `call_center_admin`
- `sales_agent_unlicensed`
- `sales_agent_licensed`
- `sales_manager`
- `system_admin`
- `hr`
- `accounting`

## Scope Columns (required on business tables)
- `owner_user_id`
- `sales_team_id`
- `call_center_id`

RLS will use these scopes:
- `self`
- `team`
- `center`
- `all`

## 2) Role Capabilities (v1)

| Role | Lead Read | Lead Write | Assign/Reassign | Convert Lead | User Mgmt | Commission Access |
|---|---|---|---|---|---|---|
| call_center_agent | self | self | no | no | no | no |
| call_center_admin | center | center | limited center | no | center-only | no |
| sales_agent_unlicensed | team/assigned | self/team limited | no | no | no | limited read |
| sales_agent_licensed | team/assigned | self/team | no | yes | no | limited read |
| sales_manager | team (or all sales by policy) | team | yes | yes | limited | team read |
| system_admin | all | all | all | all | all | all |
| hr | limited/non-lead | no | no | no | yes | no |
| accounting | limited financial context | limited financial updates | no | no | no | yes |

Notes:
- Keep this matrix as the single business reference for policy behavior.
- Any exception should be avoided now; add a permission table later only if exceptions grow.

## 3) Setup Plan (Supabase)

1. Create and seed `roles`.
2. Create `user_roles` and assign exactly one role per user initially (you can allow multiple later).
3. Ensure each business table includes scope columns (`owner_user_id`, `sales_team_id`, `call_center_id`) as applicable.
4. Enable RLS on every exposed business table.
5. Add SQL helper functions:
   - role checks by `auth.uid()`
   - scope checks (`self/team/center/all`)
6. Add table policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE` based on role + scope.
7. Keep FE checks for UX only (route/menu/button visibility).

## 4) Recommended RLS Policy Pattern

Per table, define policies by operation:
- `SELECT`: allow role if row is within allowed scope
- `INSERT`: role can create only in permitted scope
- `UPDATE`: role can edit only in permitted scope
- `DELETE`: restrict heavily (usually manager/admin only)

Policy strategy:
- Prefer explicit allow policies.
- Default deny when no policy matches.
- Keep policy names explicit, e.g. `leads_select_sales_team`.

## 5) Testing Strategy

Test at two levels:
- Policy/unit checks in SQL
- End-to-end checks with real JWT users

## A) Test Accounts
Create at least one user per role and assign:
- 2 call centers
- 2 sales teams
- mixed ownership rows across leads/policies

This gives positive and negative scope cases.

## B) Core Test Matrix
For each role, verify:
1. Can read allowed rows.
2. Cannot read disallowed rows.
3. Can update allowed rows only.
4. Cannot update disallowed rows.
5. Can/cannot execute special actions (assign, convert, commission updates).

Minimum scenarios:
- Self row vs other user row
- Same team vs other team
- Same center vs other center
- Admin full access

## C) Regression Tests
Run on every policy change:
1. `system_admin` still has full access.
2. Non-admin roles never see cross-scope rows.
3. HR/accounting cannot perform lead workflow actions.
4. Unlicensed agent cannot run licensed-only conversion actions.

## D) FE/API Parity Checks
- FE hides unavailable actions for each role.
- Attempting action via API still fails when RLS denies.
- Error handling displays authorization failures clearly.

## 6) Rollout Sequence

1. Implement roles + assignments in staging.
2. Add RLS for one table first (`leads`) and validate thoroughly.
3. Extend same pattern to related tables (`notes`, `activities`, `policies`, `commissions`).
4. Freeze role matrix and capture sign-off from stakeholders.
5. Promote to production with staged monitoring.

## 7) When to Introduce a Permission Table Later

Add `permissions` only if one of these appears:
- frequent one-off access exceptions
- role explosion
- non-engineers need runtime permission changes
- compliance requires explicit grant records per capability

Until then, fixed roles + RLS is the simplest and most maintainable model.
