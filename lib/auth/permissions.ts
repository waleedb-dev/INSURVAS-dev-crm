import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoleKey } from "@/lib/auth/roles";

export const PERMISSION_KEYS = [
  "page.daily_deal_flow.access",
  "action.daily_deal_flow.process",
  "page.assigning.access",
  "action.assigning.assign",
  "page.lead_pipeline.access",
  "action.lead_pipeline.update",
  "page.commissions.access",
  "action.commissions.approve",
  "page.transfer_leads.access",
  "action.transfer_leads.view_all",
  "action.transfer_leads.view_call_center",
  "action.transfer_leads.view_own",
  "action.transfer_leads.create",
  "action.transfer_leads.edit",
  "action.transfer_leads.claim_reclaim_visit",
  "page.bpo_score_board.access",
  "page.bpo_center_performance.access",
  "page.center_thresholds.access",
  "page.colombian_score_board.access",
  "page.colombian_center_performance.access",
  "page.colombian_thresholds.access",
  "page.imo_management.access",
  "page.upline_carrier_states.access",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const PERMISSION_SET = new Set<string>(PERMISSION_KEYS);

type RolePermissionRow = {
  permissions: { key: string } | { key: string }[] | null;
};

type UserPermissionRow = {
  permissions: { key: string } | { key: string }[] | null;
};

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_SET.has(value);
}

/** BPO + Colombian analytics routes: system admin, or matching key from `role_permissions` / `user_permissions`. */
const ANALYTICS_DASHBOARD_PAGE_KEYS = {
  "bpo-score-board": "page.bpo_score_board.access",
  "bpo-center-performance": "page.bpo_center_performance.access",
  "center-thresholds": "page.center_thresholds.access",
  "colombian-score-board": "page.colombian_score_board.access",
  "colombian-center-performance": "page.colombian_center_performance.access",
  "colombian-thresholds": "page.colombian_thresholds.access",
} as const satisfies Record<string, PermissionKey>;

type AnalyticsDashboardPage = keyof typeof ANALYTICS_DASHBOARD_PAGE_KEYS;

function analyticsDashboardPermission(page: string): PermissionKey | null {
  if (page in ANALYTICS_DASHBOARD_PAGE_KEYS) {
    return ANALYTICS_DASHBOARD_PAGE_KEYS[page as AnalyticsDashboardPage];
  }
  return null;
}

export async function getCurrentUserPermissionKeys(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<PermissionKey>> {
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("role_id")
    .eq("id", userId)
    .maybeSingle();

  if (userError || !user?.role_id) {
    return new Set<PermissionKey>();
  }

  const [{ data: roleData, error: roleError }, { data: userData, error: userError2 }] =
    await Promise.all([
      supabase
        .from("role_permissions")
        .select("permissions!inner(key)")
        .eq("role_id", user.role_id),
      supabase
        .from("user_permissions")
        .select("permissions!inner(key)")
        .eq("user_id", userId),
    ]);

  if (roleError && userError2) {
    return new Set<PermissionKey>();
  }

  const keys = [...(roleData as RolePermissionRow[] | null) ?? [], ...(userData as UserPermissionRow[] | null) ?? []]
    .flatMap((row) => {
      if (Array.isArray(row.permissions)) {
        return row.permissions.map((permission) => permission.key);
      }

      return row.permissions?.key ? [row.permissions.key] : [];
    })
    .filter(isPermissionKey);

  return new Set<PermissionKey>(keys);
}

export function canAccessPage(
  page:
    | "dashboard"
    | "nearest-events"
    | "daily-deal-flow"
    | "assigning"
    | "lead-pipeline"
    | "support-tickets"
    | "call-center-lead-intake"
    | "bpo-kill-list-new-sale"
    | "bpo-kill-list-retention"
    | "transfer-check-tester"
    | "crm-sync"
    | "ghl-data-import"
    | "live-monitoring"
    | "commissions"
    | "policies"
    | "users-access"
    | "operations-guide"
    | "pipeline-management"
    | "carrier-management"
    | "bpo-centres"
    | "carrier-updates"
    | "imo-management"
    | "upline-carrier-states"
    | "imo-settings"
    | "product-guide"
    | "announcements"
    | "bpo-score-board"
    | "bpo-center-performance"
    | "center-thresholds"
    | "colombian-score-board"
    | "colombian-center-performance"
    | "colombian-thresholds",
  role: RoleKey | null,
  permissionKeys: Set<PermissionKey>,
): boolean {
  if (page === "dashboard" || page === "nearest-events" || page === "operations-guide") {
    return true;
  }

  if (page === "users-access") {
    return role === "system_admin" || role === "hr";
  }

  if (page === "daily-deal-flow") {
    return permissionKeys.has("page.daily_deal_flow.access");
  }

  if (page === "assigning") {
    return permissionKeys.has("page.assigning.access");
  }

  if (page === "lead-pipeline") {
    return permissionKeys.has("page.lead_pipeline.access");
  }

  if (page === "support-tickets") {
    return role === "publisher_manager" || role === "system_admin" || role === "call_center_admin";
  }

  if (page === "bpo-kill-list-new-sale" || page === "bpo-kill-list-retention") {
    return role === "call_center_admin" || role === "system_admin";
  }

  if (page === "call-center-lead-intake" || page === "transfer-check-tester") {
    return permissionKeys.has("page.transfer_leads.access");
  }

  if (page === "crm-sync" || page === "ghl-data-import") {
    return role === "system_admin";
  }

  if (page === "live-monitoring") {
    return role === "sales_manager";
  }

  if (page === "commissions") {
    return role === "system_admin";
  }

  if (page === "pipeline-management") {
    return role === "system_admin";
  }

  if (page === "carrier-management" || page === "bpo-centres" || page === "carrier-updates") {
    return role === "system_admin";
  }

  if (page === "policies") {
    return role === "system_admin";
  }

  if (page === "imo-management" || page === "imo-settings") {
    return role === "system_admin";
  }

  if (page === "upline-carrier-states" || page === "product-guide" || page === "announcements") {
    return role === "system_admin";
  }

  const analyticsPageKey = analyticsDashboardPermission(page);

  if (analyticsPageKey !== null) {
    return role === "system_admin" || permissionKeys.has(analyticsPageKey);
  }

  return false;
}
