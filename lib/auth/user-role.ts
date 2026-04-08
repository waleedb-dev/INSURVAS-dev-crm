import type { SupabaseClient } from "@supabase/supabase-js";
import { isRoleKey, type RoleKey } from "@/lib/auth/roles";

export async function getCurrentUserPrimaryRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<RoleKey | null> {
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("role_id, status")
    .eq("id", userId)
    .maybeSingle();

  if (userError || !user?.role_id || user.status !== "active") {
    return null;
  }

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("key")
    .eq("id", user.role_id)
    .maybeSingle();

  if (roleError || !role?.key || !isRoleKey(role.key)) {
    return null;
  }

  return role.key;
}
