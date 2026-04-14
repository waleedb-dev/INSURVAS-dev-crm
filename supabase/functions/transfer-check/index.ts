/**
 * Edge function: `transfer-check`
 * 1) Proxies the agency transfer checker (TCPA / policy).
 * 2) Enriches JSON with `crm_duplicate` — same logic as TransferLeadApplicationForm
 *    `checkPhoneDuplicate`: phone variants, `ssn_duplicate_stage_rules` + precedence,
 *    multi-match SSN narrow (optional `social` in body).
 *
 * Body: { phone, phone_raw? (optional, extra DB match variants), social? (optional SSN) }
 *
 * Optional secret: TRANSFER_CHECK_UPSTREAM_URL
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_UPSTREAM = "https://livetransferchecker.vercel.app/api/transfer-check";
const DEFAULT_RANK = 10_000;

type RuleRow = {
  stage_name: string;
  ghl_stage: string | null;
  message: string;
  is_addable: boolean;
  is_active: boolean;
  precedence_rank: number | null;
};

type LeadRow = {
  id: string;
  lead_unique_id: string | null;
  stage: string | null;
  phone: string | null;
  social: string | null;
  first_name: string | null;
  last_name: string | null;
};

type CrmDuplicatePayload = {
  has_match: boolean;
  match_count?: number;
  is_addable?: boolean;
  rule_message?: string;
  /** When the CRM match is unambiguous (one lead, or SSN narrowed to one), full name from `leads`. */
  matched_contact_name?: string;
  lead_ids?: string[];
  stages?: string[];
  error?: string | null;
  scenario?: "no_match" | "single" | "multi_no_ssn" | "multi_ssn_mismatch" | "multi_ssn_resolved";
  ssn_digits_provided?: boolean;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

function phone10digits(value: string | null | undefined): string | null {
  const d = String(value ?? "").replace(/\D/g, "");
  if (d.length === 10) return d;
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  return null;
}

function formatUsPhone10(d: string): string {
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function normalizeSsnDigits(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

function ruleForLeadStage(stage: string | null, rules: RuleRow[]): RuleRow | undefined {
  const st = String(stage || "").trim();
  if (!st) return undefined;
  const key = norm(st);
  const active = rules.filter((r) => r.is_active);
  return active.find((r) => (r.ghl_stage && norm(r.ghl_stage) === key) || norm(r.stage_name) === key);
}

function ghlSuffix(stage: string, matchedRule: RuleRow | undefined): string {
  if (!matchedRule?.ghl_stage) return "";
  if (matchedRule.ghl_stage.toLowerCase() === stage.toLowerCase()) return "";
  return ` (GHL: ${matchedRule.ghl_stage})`;
}

function minBy<T>(items: T[], score: (x: T) => number): T | undefined {
  if (!items.length) return undefined;
  let best = items[0];
  let bestScore = score(best);
  for (let i = 1; i < items.length; i++) {
    const s = score(items[i]);
    if (s < bestScore) {
      best = items[i];
      bestScore = s;
    }
  }
  return best;
}

function resolveDuplicatePolicy(
  leads: { id: string; stage: string | null }[],
  rules: RuleRow[],
): { is_addable: boolean; message: string } {
  if (!leads.length) {
    return { is_addable: true, message: "" };
  }

  type Ann = { lead: { id: string; stage: string | null }; rule?: RuleRow; rank: number };
  const annotated: Ann[] = leads.map((lead) => {
    const rule = ruleForLeadStage(lead.stage, rules);
    const rank = rule?.precedence_rank ?? DEFAULT_RANK;
    return { lead, rule, rank };
  });

  const withRules = annotated.filter((a) => a.rule);
  const blocking = withRules.filter((a) => a.rule!.is_addable === false);
  if (blocking.length) {
    const winner = minBy(blocking, (b) => b.rank)!;
    return { is_addable: false, message: winner.rule!.message };
  }

  const allowing = withRules.filter((a) => a.rule!.is_addable === true);
  if (allowing.length) {
    const winner = minBy(allowing, (b) => b.rank)!;
    return { is_addable: true, message: winner.rule!.message };
  }

  return {
    is_addable: true,
    message: "A lead already exists for this match; review stage before submitting.",
  };
}

function formatContactName(first: string | null | undefined, last: string | null | undefined): string {
  const n = `${String(first ?? "").trim()} ${String(last ?? "").trim()}`.trim();
  return n;
}

function phoneVariants(cleanPhone: string, phoneRaw: string): string[] {
  const set = new Set<string>();
  if (phoneRaw.trim()) {
    set.add(phoneRaw.trim());
    const rd = phoneRaw.replace(/\D/g, "");
    if (rd) set.add(rd);
  }
  set.add(cleanPhone);
  set.add(formatUsPhone10(cleanPhone));
  return Array.from(set).filter(Boolean);
}

async function computeCrmDuplicate(
  supabase: SupabaseClient,
  cleanPhone: string,
  phoneRaw: string,
  socialRaw: string | undefined,
): Promise<CrmDuplicatePayload> {
  try {
    const variants = phoneVariants(cleanPhone, phoneRaw);
    const { data: existing, error: leadsError } = await supabase
      .from("leads")
      .select("id, lead_unique_id, stage, phone, social, first_name, last_name, created_at")
      .eq("is_draft", false)
      .in("phone", variants)
      .order("created_at", { ascending: false });

    if (leadsError) {
      return { has_match: false, error: leadsError.message, scenario: "no_match" };
    }

    const rows = ((existing ?? []) as LeadRow[]).filter(
      (row) => phone10digits(row.phone) === cleanPhone,
    );

    if (rows.length === 0) {
      return { has_match: false, scenario: "no_match" };
    }

    const { data: rulesData, error: rulesError } = await supabase
      .from("ssn_duplicate_stage_rules")
      .select("stage_name, ghl_stage, message, is_addable, is_active, precedence_rank")
      .eq("is_active", true);

    if (rulesError) {
      const sole = rows.length === 1 ? rows[0] : undefined;
      const matched_contact_name = sole ? formatContactName(sole.first_name, sole.last_name) : undefined;
      return {
        has_match: true,
        match_count: rows.length,
        error: rulesError.message,
        lead_ids: rows.map((r) => r.id),
        stages: rows.map((r) => String(r.stage ?? "")).filter(Boolean),
        ...(matched_contact_name ? { matched_contact_name } : {}),
      };
    }

    const rules = (rulesData ?? []) as RuleRow[];
    const ssnDigits = normalizeSsnDigits(socialRaw ?? "");

    if (rows.length === 1) {
      const mapped = rows[0];
      const resolved = resolveDuplicatePolicy([{ id: mapped.id, stage: mapped.stage }], rules);
      const stage = String(mapped.stage || "").trim();
      const matchedRule = ruleForLeadStage(mapped.stage, rules);
      const ruleMessage =
        `${resolved.message}${stage ? ` Stage: ${stage}.` : ""}` + ghlSuffix(stage, matchedRule);
      const matched_contact_name = formatContactName(mapped.first_name, mapped.last_name);
      return {
        has_match: true,
        match_count: 1,
        is_addable: resolved.is_addable,
        rule_message: ruleMessage,
        ...(matched_contact_name ? { matched_contact_name } : {}),
        lead_ids: [mapped.id],
        stages: stage ? [stage] : [],
        scenario: "single",
        ssn_digits_provided: ssnDigits.length === 9,
      };
    }

    const narrowed =
      ssnDigits.length === 9
        ? rows.filter((c) => normalizeSsnDigits(String(c.social ?? "")) === ssnDigits)
        : [];

    if (narrowed.length === 0) {
      const ruleMessage =
        ssnDigits.length === 9
          ? `This phone is on file for ${rows.length} leads, but the SSN you entered does not match any of those records. Treating as a different customer (shared or recycled line).`
          : `This phone is on file for ${rows.length} leads. Enter the customer's full SSN to confirm which record applies (duplicates-of-duplicates check).`;
      return {
        has_match: true,
        match_count: rows.length,
        is_addable: true,
        rule_message: ruleMessage,
        lead_ids: rows.map((r) => r.id),
        stages: rows.map((r) => String(r.stage ?? "").trim()).filter((s) => s.length > 0),
        scenario: ssnDigits.length === 9 ? "multi_ssn_mismatch" : "multi_no_ssn",
        ssn_digits_provided: ssnDigits.length === 9,
      };
    }

    const resolved = resolveDuplicatePolicy(
      narrowed.map((c) => ({ id: c.id, stage: c.stage })),
      rules,
    );
    const detail = narrowed[0];
    const stage = String(detail.stage || "").trim();
    const ruleMessage =
      `${resolved.message}${stage ? ` Stage: ${stage}.` : ""} (${narrowed.length} record(s) share this phone and SSN.)`;
    const matched_contact_name =
      narrowed.length === 1 ? formatContactName(detail.first_name, detail.last_name) : undefined;

    return {
      has_match: true,
      match_count: rows.length,
      is_addable: resolved.is_addable,
      rule_message: ruleMessage,
      ...(matched_contact_name ? { matched_contact_name } : {}),
      lead_ids: rows.map((r) => r.id),
      stages: rows.map((r) => String(r.stage ?? "").trim()).filter((s) => s.length > 0),
      scenario: "multi_ssn_resolved",
      ssn_digits_provided: true,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "CRM duplicate check failed";
    return { has_match: false, error: msg, scenario: "no_match" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return new Response(
      JSON.stringify({ message: "Unauthorized", detail: userError?.message ?? null }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let body: { phone?: string; phone_raw?: string; social?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ message: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const raw = String(body.phone ?? "");
  const digits = raw.replace(/\D/g, "");
  let cleanPhone: string;
  if (digits.length === 10) {
    cleanPhone = digits;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    cleanPhone = digits.slice(1);
  } else {
    return new Response(JSON.stringify({ message: "Please provide a valid 10-digit US phone number." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const phoneRaw = String(body.phone_raw ?? body.phone ?? "");
  const socialOpt = body.social !== undefined ? String(body.social) : undefined;

  const upstream = Deno.env.get("TRANSFER_CHECK_UPSTREAM_URL")?.trim() || DEFAULT_UPSTREAM;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanPhone }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upstream transfer check unreachable";
    return new Response(JSON.stringify({ message: msg }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const text = await upstreamRes.text();
  let crmDuplicate: CrmDuplicatePayload;
  try {
    crmDuplicate = await computeCrmDuplicate(supabase, cleanPhone, phoneRaw, socialOpt);
  } catch {
    crmDuplicate = { has_match: false, error: "CRM duplicate check threw", scenario: "no_match" };
  }

  let merged: Record<string, unknown>;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    merged = { ...parsed, crm_duplicate: crmDuplicate };
  } catch {
    merged = {
      message: "Upstream returned non-JSON",
      raw: text,
      crm_duplicate: crmDuplicate,
    };
  }

  return new Response(JSON.stringify(merged), {
    status: upstreamRes.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
