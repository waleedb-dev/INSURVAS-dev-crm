"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export type EligibleAgentExternalMapRow = {
  external_availability_id: string;
  external_user_id: string;
  crm_user_id: string;
};

/** external_user_id (eligible system) -> crm users.id */
export async function fetchEligibleAgentExternalUserMap(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("eligible_agent_external_user_map")
    .select("external_user_id, crm_user_id");
  if (error) throw new Error(error.message);
  const m = new Map<string, string>();
  for (const row of data ?? []) {
    const e = row as { external_user_id?: string; crm_user_id?: string };
    const ext = e.external_user_id?.trim();
    const crm = e.crm_user_id?.trim();
    if (ext && crm) m.set(ext, crm);
  }
  return m;
}
