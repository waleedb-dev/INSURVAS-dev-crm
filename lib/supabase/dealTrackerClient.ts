import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Read-only browser client for the secondary "deal tracker" Supabase project.
 *
 * This project is used as the source of truth for GHL stage mappings and is
 * queried by the CRM Sync Operations page to compare our local leads / policies
 * against the external `deal_tracker` table.
 */
let dealTrackerClient: SupabaseClient | null = null;

function getDealTrackerConfig() {
  const url = process.env.NEXT_PUBLIC_DEAL_TRACKER_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_DEAL_TRACKER_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Deal Tracker Supabase environment variables. Set NEXT_PUBLIC_DEAL_TRACKER_SUPABASE_URL and NEXT_PUBLIC_DEAL_TRACKER_SUPABASE_ANON_KEY.",
    );
  }

  return { url, anonKey };
}

export function getDealTrackerSupabaseClient(): SupabaseClient {
  if (dealTrackerClient) {
    return dealTrackerClient;
  }

  const { url, anonKey } = getDealTrackerConfig();

  dealTrackerClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return dealTrackerClient;
}

export type DealTrackerRow = {
  id: string;
  policy_number: string;
  carrier: string;
  name: string | null;
  ghl_name: string | null;
  ghl_stage: string | null;
  policy_status: string | null;
  status: string | null;
  sales_agent: string | null;
  call_center: string | null;
  phone_number: string | null;
  commission_type: string | null;
  policy_type: string | null;
  deal_value: number | null;
  cc_value: number | null;
  effective_date: string | null;
  deal_creation_date: string | null;
  last_updated: string | null;
  notes: string | null;
};

const DEAL_TRACKER_SELECT_COLUMNS =
  "id, policy_number, carrier, name, ghl_name, ghl_stage, policy_status, status, sales_agent, call_center, phone_number, commission_type, policy_type, deal_value, cc_value, effective_date, deal_creation_date, last_updated, notes";

export async function fetchDealTrackerByPolicyNumber(
  policyNumber: string,
): Promise<DealTrackerRow | null> {
  if (!policyNumber || !policyNumber.trim()) return null;

  const client = getDealTrackerSupabaseClient();
  const { data, error } = await client
    .from("deal_tracker")
    .select(DEAL_TRACKER_SELECT_COLUMNS)
    .eq("policy_number", policyNumber.trim())
    .order("last_updated", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as DealTrackerRow | null;
}

const DEAL_TRACKER_IN_CHUNK_SIZE = 150;
const DEAL_TRACKER_IN_CONCURRENCY = 4;

export async function fetchDealTrackerByPolicyNumbers(
  policyNumbers: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, DealTrackerRow>> {
  const cleaned = Array.from(
    new Set(
      policyNumbers
        .map((p) => (p == null ? "" : String(p).trim()))
        .filter((p) => p.length > 0),
    ),
  );
  if (cleaned.length === 0) return new Map();

  const client = getDealTrackerSupabaseClient();
  const byPolicy = new Map<string, DealTrackerRow>();

  const mergeRow = (row: DealTrackerRow) => {
    const key = String(row.policy_number || "").trim();
    if (!key) return;
    const existing = byPolicy.get(key);
    if (!existing) {
      byPolicy.set(key, row);
      return;
    }
    const a = existing.last_updated ? Date.parse(existing.last_updated) : 0;
    const b = row.last_updated ? Date.parse(row.last_updated) : 0;
    if (b > a) byPolicy.set(key, row);
  };

  const chunks: string[][] = [];
  for (let i = 0; i < cleaned.length; i += DEAL_TRACKER_IN_CHUNK_SIZE) {
    chunks.push(cleaned.slice(i, i + DEAL_TRACKER_IN_CHUNK_SIZE));
  }

  let done = 0;
  onProgress?.(done, chunks.length);

  const fetchChunk = async (chunk: string[]) => {
    const { data, error } = await client
      .from("deal_tracker")
      .select(DEAL_TRACKER_SELECT_COLUMNS)
      .in("policy_number", chunk);
    if (error) {
      throw new Error(error.message);
    }
    for (const row of (data ?? []) as DealTrackerRow[]) {
      mergeRow(row);
    }
    done += 1;
    onProgress?.(done, chunks.length);
  };

  for (let i = 0; i < chunks.length; i += DEAL_TRACKER_IN_CONCURRENCY) {
    const window = chunks.slice(i, i + DEAL_TRACKER_IN_CONCURRENCY);
    await Promise.all(window.map(fetchChunk));
  }

  return byPolicy;
}
