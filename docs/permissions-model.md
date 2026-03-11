# Permissions Model

This document defines the permissions layer implemented in SQL via:
- `sql/permissions_module.sql`

## 1) Tables

- `public.permissions`
  - Permission catalog (`key`, `resource`, `action`, `description`, `is_active`)
- `public.role_permissions`
  - Many-to-many mapping between `roles` and `permissions`

## 2) Naming Convention

- Page access: `page.<resource>.access`
- Action permission: `action.<resource>.<action>`

Examples:
- `page.daily_deal_flow.access`
- `action.assigning.assign`

## 3) Seeded Permission Keys

1. `page.daily_deal_flow.access`
2. `action.daily_deal_flow.process`
3. `page.assigning.access`
4. `action.assigning.assign`
5. `page.lead_pipeline.access`
6. `action.lead_pipeline.update`
7. `page.commissions.access`
8. `action.commissions.approve`

## 4) Default Role Mapping

### `system_admin`
- All 8 permissions

### `sales_manager`
- `page.daily_deal_flow.access`
- `action.daily_deal_flow.process`
- `page.assigning.access`
- `action.assigning.assign`
- `page.lead_pipeline.access`
- `action.lead_pipeline.update`
- `page.commissions.access`

### `sales_agent_licensed`
- `page.daily_deal_flow.access`
- `action.daily_deal_flow.process`
- `page.lead_pipeline.access`
- `action.lead_pipeline.update`

### `sales_agent_unlicensed`
- `page.daily_deal_flow.access`
- `page.lead_pipeline.access`
- `action.lead_pipeline.update`

### `call_center_admin`
- `page.assigning.access`
- `action.assigning.assign`
- `page.lead_pipeline.access`

### `call_center_agent`
- `page.lead_pipeline.access`

### `accounting`
- `page.commissions.access`
- `action.commissions.approve`

### `hr`
- No seeded page/action permissions by default

## 5) Runtime Check Functions

- `public.has_permission(permission_key text) -> boolean`
- `public.has_any_permission(permission_keys text[]) -> boolean`

Use these in RLS policies and API guards for authorization.

## 6) SQL Run Order

1. `sql/clean_swipe.sql` (optional, destructive reset)
2. `sql/authentication_module.sql`
3. `sql/permissions_module.sql`

