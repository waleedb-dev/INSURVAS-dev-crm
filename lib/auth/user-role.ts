import type { SupabaseClient } from "@supabase/supabase-js";
import { isRoleKey, pickPrimaryRole, type RoleKey } from "@/lib/auth/roles";

type UserRoleRow = {
  roles: { key: string } | { key: string }[] | null;
};

export async function getCurrentUserPrimaryRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<RoleKey | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("roles!inner(key)")
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (error || !data?.length) {
    return null;
  }

  const keys = (data as UserRoleRow[])
    .flatMap((row) => {
      if (Array.isArray(row.roles)) {
        return row.roles.map((role) => role.key);
      }

      return row.roles?.key ? [row.roles.key] : [];
    })
    .filter(isRoleKey);

  return pickPrimaryRole(keys);
}
