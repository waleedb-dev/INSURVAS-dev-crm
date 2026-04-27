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

function normalizeName(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export async function fetchDealTrackerByGhlNames(
  ghlNames: string[],
): Promise<Map<string, DealTrackerRow>> {
  const cleaned = Array.from(
    new Set(
      ghlNames
        .map((n) => String(n ?? "").trim())
        .filter((n) => n.length > 0),
    ),
  );
  if (cleaned.length === 0) return new Map();

  const client = getDealTrackerSupabaseClient();
  const byName = new Map<string, DealTrackerRow>();

  const mergeRow = (row: DealTrackerRow) => {
    const key = normalizeName(row.ghl_name || row.name || null);
    if (!key) return;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, row);
      return;
    }
    const a = existing.last_updated ? Date.parse(existing.last_updated) : 0;
    const b = row.last_updated ? Date.parse(row.last_updated) : 0;
    if (b > a) byName.set(key, row);
  };

  const chunks: string[][] = [];
  for (let i = 0; i < cleaned.length; i += DEAL_TRACKER_IN_CHUNK_SIZE) {
    chunks.push(cleaned.slice(i, i + DEAL_TRACKER_IN_CHUNK_SIZE));
  }

  const fetchChunk = async (chunk: string[]) => {
    const { data, error } = await client
      .from("deal_tracker")
      .select(DEAL_TRACKER_SELECT_COLUMNS)
      .in("ghl_name", chunk);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as DealTrackerRow[]) {
      mergeRow(row);
    }
  };

  for (let i = 0; i < chunks.length; i += DEAL_TRACKER_IN_CONCURRENCY) {
    const window = chunks.slice(i, i + DEAL_TRACKER_IN_CONCURRENCY);
    await Promise.all(window.map(fetchChunk));
  }

  return byName;
}

export async function fetchDealTrackerCandidatesByNamesAndPhones(params: {
  ghlNames: string[];
  names: string[];
  phones: string[];
}): Promise<DealTrackerRow[]> {
  const ghlNames = Array.from(
    new Set(params.ghlNames.map((v) => String(v ?? "").trim()).filter(Boolean)),
  );
  const names = Array.from(
    new Set(params.names.map((v) => String(v ?? "").trim()).filter(Boolean)),
  );
  const phones = Array.from(
    new Set(params.phones.map((v) => String(v ?? "").trim()).filter(Boolean)),
  );
  if (ghlNames.length === 0 && names.length === 0 && phones.length === 0) return [];

  const client = getDealTrackerSupabaseClient();
  const byId = new Map<string, DealTrackerRow>();

  const mergeRows = (rows: DealTrackerRow[]) => {
    for (const row of rows) {
      const id = String(row.id ?? "");
      if (!id) continue;
      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, row);
        continue;
      }
      const a = existing.last_updated ? Date.parse(existing.last_updated) : 0;
      const b = row.last_updated ? Date.parse(row.last_updated) : 0;
      if (b > a) byId.set(id, row);
    }
  };

  const fetchInChunks = async (column: "ghl_name" | "name" | "phone_number", values: string[]) => {
    if (values.length === 0) return;
    const chunks: string[][] = [];
    for (let i = 0; i < values.length; i += DEAL_TRACKER_IN_CHUNK_SIZE) {
      chunks.push(values.slice(i, i + DEAL_TRACKER_IN_CHUNK_SIZE));
    }
    const fetchChunk = async (chunk: string[]) => {
      const { data, error } = await client
        .from("deal_tracker")
        .select(DEAL_TRACKER_SELECT_COLUMNS)
        .in(column, chunk);
      if (error) throw new Error(error.message);
      mergeRows((data ?? []) as DealTrackerRow[]);
    };
    for (let i = 0; i < chunks.length; i += DEAL_TRACKER_IN_CONCURRENCY) {
      const window = chunks.slice(i, i + DEAL_TRACKER_IN_CONCURRENCY);
      await Promise.all(window.map(fetchChunk));
    }
  };

  await fetchInChunks("ghl_name", ghlNames);
  await fetchInChunks("name", names);
  await fetchInChunks("phone_number", phones);

  return Array.from(byId.values());
}

export async function fetchDealTrackerUniqueCarrierAndCallCenterValues(): Promise<{
  carriers: string[];
  callCenters: string[];
}> {
  const client = getDealTrackerSupabaseClient();
  const PAGE_SIZE = 1000;
  const maxRows = 50000;
  let from = 0;
  const carriers = new Set<string>();
  const callCenters = new Set<string>();

  while (from < maxRows) {
    const { data, error } = await client
      .from("deal_tracker")
      .select("carrier, call_center")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{ carrier?: string | null; call_center?: string | null }>;
    for (const row of rows) {
      const carrier = String(row.carrier ?? "").trim();
      const callCenter = String(row.call_center ?? "").trim();
      if (carrier) carriers.add(carrier);
      if (callCenter) callCenters.add(callCenter);
    }
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return {
    carriers: Array.from(carriers).sort((a, b) => a.localeCompare(b)),
    callCenters: Array.from(callCenters).sort((a, b) => a.localeCompare(b)),
  };
}
