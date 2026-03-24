/**
 * Backfill daily_deal_flow from leads (same logic as sql/backfill_daily_deal_flow_from_leads.sql).
 * Uses SUPABASE_SERVICE_ROLE_KEY so RLS does not block inserts.
 *
 * Usage: node --env-file=.env.local scripts/run-backfill-daily-deal-flow.mjs
 * Optional: TRANSFER_ONLY=1 node --env-file=.env.local scripts/run-backfill-daily-deal-flow.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, "../.env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const k = m[1];
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* rely on existing process.env */
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const transferOnly = process.env.TRANSFER_ONLY === "1" || process.env.TRANSFER_ONLY === "true";

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

function leadName(row) {
  const t = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return t || "Unnamed lead";
}

function flowDateUtc(iso) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

async function fetchAllLeadIdsInDdf() {
  const ids = new Set();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase.from("daily_deal_flow").select("lead_id").range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) ids.add(r.lead_id);
    if (data.length < page) break;
    from += page;
  }
  return ids;
}

async function fetchEligibleLeads() {
  const rows = [];
  let from = 0;
  const page = 500;
  for (;;) {
    const { data, error } = await supabase
      .from("leads")
      .select("id, created_at, lead_unique_id, first_name, last_name, call_center_id, is_draft, pipeline")
      .or("is_draft.eq.false,is_draft.is.null")
      .range(from, from + page - 1)
      .order("created_at", { ascending: true });
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < page) break;
    from += page;
  }
  if (transferOnly) {
    return rows.filter((l) => (l.pipeline ?? "") === "Transfer Portal");
  }
  return rows;
}

async function fetchCenterNames(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map();
  if (!unique.length) return map;
  const { data, error } = await supabase.from("call_centers").select("id, name").in("id", unique);
  if (error) throw error;
  for (const r of data ?? []) map.set(r.id, r.name);
  return map;
}

async function main() {
  console.log(transferOnly ? "Mode: Transfer Portal leads only\n" : "Mode: all non-draft leads\n");

  const existing = await fetchAllLeadIdsInDdf();
  console.log(`Existing daily_deal_flow rows (distinct lead_id count): ${existing.size}`);

  const leads = await fetchEligibleLeads();
  const toInsert = leads.filter((l) => !existing.has(l.id));
  console.log(`Eligible leads: ${leads.length}, to backfill: ${toInsert.length}`);

  if (!toInsert.length) {
    console.log("Nothing to insert.");
    return;
  }

  const centerMap = await fetchCenterNames(toInsert.map((l) => l.call_center_id));

  const payload = toInsert.map((l) => ({
    created_at: l.created_at,
    flow_date: flowDateUtc(l.created_at),
    lead_id: l.id,
    lead_unique_id: l.lead_unique_id ?? null,
    lead_name: leadName(l),
    center_name: l.call_center_id ? centerMap.get(l.call_center_id) ?? null : null,
    call_center_id: l.call_center_id ?? null,
  }));

  const batch = 100;
  let inserted = 0;
  for (let i = 0; i < payload.length; i += batch) {
    const chunk = payload.slice(i, i + batch);
    const { error } = await supabase.from("daily_deal_flow").insert(chunk);
    if (error) {
      console.error("Insert failed:", error.message);
      process.exit(1);
    }
    inserted += chunk.length;
    console.log(`Inserted ${inserted} / ${payload.length}`);
  }

  console.log(`Done. Backfilled ${inserted} row(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
