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
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const PERMISSION_SET = new Set<string>(PERMISSION_KEYS);

type RolePermissionRow = {
  permissions: { key: string } | { key: string }[] | null;
};

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_SET.has(value);
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

  const { data, error } = await supabase
    .from("role_permissions")
    .select("permissions!inner(key)")
    .eq("role_id", user.role_id);

  if (error || !data?.length) {
    return new Set<PermissionKey>();
  }

  const keys = (data as RolePermissionRow[])
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
    | "commissions"
    | "users-access"
    | "operations-guide"
    | "pipeline-management"
    | "carrier-management"
    | "bpo-centres",
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

  if (page === "commissions") {
    return permissionKeys.has("page.commissions.access");
  }

  if (page === "pipeline-management") {
    return role === "system_admin";
  }

  if (page === "carrier-management" || page === "bpo-centres") {
    return role === "system_admin";
  }

  return false;
}
