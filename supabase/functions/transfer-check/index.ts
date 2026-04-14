/**
 * Edge function: `transfer-check`
 *
 * CRM-only transfer eligibility: phone-first match, then SSN cohort from on-file `social`,
 * `ssn_duplicate_stage_rules` + precedence. No external agency API.
 *
 * Optional body `social` disambiguates when the same phone has different SSNs on file, or supplies SSN when
 * phone-matched rows have none.
 *
 * TCPA / DNC / litigator screening: use `dnc-lookup` (this function does not screen).
 *
 * Body: { phone, phone_raw?, social? }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_RANK = 10_000;

/** Aligns with `TRANSFER_CHECK_CLEAR_USER_MESSAGE` in the app when there is no CRM match. */
const CLEAR_TRANSFER_MESSAGE = "Can be sent, approved";

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

type CrmPhoneMatchPayload = {
  has_match: boolean;
  match_count?: number;
  is_addable?: boolean;
  rule_message?: string;
  /** When the CRM match is unambiguous (one lead, or SSN narrowed to one), full name from `leads`. */
  matched_contact_name?: string;
  lead_ids?: string[];
  stages?: string[];
  error?: string | null;
  scenario?:
    | "no_match"
    | "single"
    | "multi_no_ssn"
    | "multi_ssn_mismatch"
    | "multi_ssn_resolved"
    | "multi_phone_stage_only";
  ssn_digits_provided?: boolean;
  /** True when the anchor SSN came from phone-matched CRM rows (request did not need `social`). */
  ssn_matched_from_crm?: boolean;
  /** Debug details: why this precedence winner was selected. */
  decision_log?: string[];
  winner?: {
    lead_id: string;
    stage: string;
    precedence_rank: number;
    is_addable: boolean;
  };
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

function formatSsnNineDigits(nine: string): string {
  const d = normalizeSsnDigits(nine);
  if (d.length !== 9) return nine;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
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
): {
  is_addable: boolean;
  message: string;
  decision_log: string[];
  winner?: { lead_id: string; stage: string; precedence_rank: number; is_addable: boolean };
} {
  const decision_log: string[] = [];
  if (!leads.length) {
    decision_log.push("No leads in scope for duplicate resolution.");
    return { is_addable: true, message: "", decision_log };
  }

  type Ann = { lead: { id: string; stage: string | null }; rule?: RuleRow; rank: number };
  const annotated: Ann[] = leads.map((lead) => {
    const rule = ruleForLeadStage(lead.stage, rules);
    const rank = rule?.precedence_rank ?? DEFAULT_RANK;
    return { lead, rule, rank };
  });
  for (const a of annotated) {
    const stage = String(a.lead.stage ?? "").trim() || "(empty stage)";
    if (!a.rule) {
      decision_log.push(`Lead ${a.lead.id} stage "${stage}": no active rule (default rank ${DEFAULT_RANK}).`);
    } else {
      decision_log.push(
        `Lead ${a.lead.id} stage "${stage}": rule "${a.rule.stage_name}" rank=${a.rank} addable=${a.rule.is_addable}.`,
      );
    }
  }

  const withRules = annotated.filter((a) => a.rule);
  if (withRules.length) {
    const winner = minBy(withRules, (x) => x.rank)!;
    const winnerStage = String(winner.lead.stage ?? "").trim();
    decision_log.push(
      `Winner: lead ${winner.lead.id} stage "${winnerStage || "(empty stage)"}" by lowest precedence_rank=${winner.rank}.`,
    );
    return {
      is_addable: winner.rule!.is_addable,
      message: winner.rule!.message,
      decision_log,
      winner: {
        lead_id: winner.lead.id,
        stage: winnerStage,
        precedence_rank: winner.rank,
        is_addable: winner.rule!.is_addable,
      },
    };
  }

  decision_log.push("No matching stage rules found; default allow.");
  return {
    is_addable: true,
    message: "A lead already exists for this phone; review stage before submitting.",
    decision_log,
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

/** Build `social` column variants for `.in("social", …)` (matches app intake / transfer form). */
function socialQueryVariants(anchorNine: string, phoneRows: LeadRow[]): string[] {
  const set = new Set<string>();
  set.add(anchorNine);
  set.add(formatSsnNineDigits(anchorNine));
  for (const r of phoneRows) {
    const t = String(r.social ?? "").trim();
    if (t && normalizeSsnDigits(t) === anchorNine) set.add(t);
  }
  return Array.from(set).filter(Boolean);
}

/**
 * Decide 9-digit anchor from phone-matched leads; optional request `social` disambiguates conflicting on-file SSNs
 * or supplies SSN when no phone row has one.
 */
function resolveAnchorSsnFromPhoneRows(
  phoneRows: LeadRow[],
  socialRaw: string | undefined,
):
  | { ok: true; anchor: string; source: "crm" | "request" }
  | { ok: false; reason: "ambiguous" | "request_mismatch" | "no_ssn_on_phone" } {
  const requestNine = normalizeSsnDigits(socialRaw ?? "");
  const fromPhone = phoneRows
    .map((r) => normalizeSsnDigits(String(r.social ?? "")))
    .filter((s) => s.length === 9);
  const uniquePhone = [...new Set(fromPhone)];

  if (requestNine.length === 9) {
    if (uniquePhone.length === 0) {
      return { ok: true, anchor: requestNine, source: "request" };
    }
    if (uniquePhone.includes(requestNine)) {
      return { ok: true, anchor: requestNine, source: "request" };
    }
    return { ok: false, reason: "request_mismatch" };
  }

  if (uniquePhone.length === 1) {
    return { ok: true, anchor: uniquePhone[0], source: "crm" };
  }
  if (uniquePhone.length === 0) {
    return { ok: false, reason: "no_ssn_on_phone" };
  }
  return { ok: false, reason: "ambiguous" };
}

async function computeCrmPhoneMatch(
  supabase: SupabaseClient,
  cleanPhone: string,
  phoneRaw: string,
  socialRaw: string | undefined,
): Promise<CrmPhoneMatchPayload> {
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
    const requestNine = normalizeSsnDigits(socialRaw ?? "");

    const anchorRes = resolveAnchorSsnFromPhoneRows(rows, socialRaw);
    if (!anchorRes.ok) {
      if (anchorRes.reason === "request_mismatch") {
        return {
          has_match: true,
          match_count: rows.length,
          is_addable: true,
          rule_message:
            `This phone is on file for ${rows.length} leads, but the SSN you entered does not match any of those records. Treating as a different customer (shared or recycled line).`,
          lead_ids: rows.map((r) => r.id),
          stages: rows.map((r) => String(r.stage ?? "").trim()).filter((s) => s.length > 0),
          scenario: "multi_ssn_mismatch",
          ssn_digits_provided: true,
          decision_log: ["Request SSN did not match any phone-matched lead SSN."],
        };
      }
      if (anchorRes.reason === "ambiguous") {
        return {
          has_match: true,
          match_count: rows.length,
          is_addable: true,
          rule_message:
            `This phone is on file for ${rows.length} leads with different SSNs on record. Enter the customer's full SSN to confirm which record applies.`,
          lead_ids: rows.map((r) => r.id),
          stages: rows.map((r) => String(r.stage ?? "").trim()).filter((s) => s.length > 0),
          scenario: "multi_no_ssn",
          ssn_digits_provided: false,
          decision_log: ["Phone matched multiple leads with conflicting SSNs; SSN required to disambiguate."],
        };
      }
      // no_ssn_on_phone
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
          ssn_digits_provided: false,
          decision_log: resolved.decision_log,
          ...(resolved.winner ? { winner: resolved.winner } : {}),
        };
      }
      const resolvedPhoneOnly = resolveDuplicatePolicy(
        rows.map((c) => ({ id: c.id, stage: c.stage })),
        rules,
      );
      const winnerLeadPhone = resolvedPhoneOnly.winner
        ? rows.find((c) => c.id === resolvedPhoneOnly.winner!.lead_id) ?? rows[0]
        : rows[0];
      const stagePhone = String(resolvedPhoneOnly.winner?.stage ?? winnerLeadPhone.stage ?? "").trim();
      const matchedRulePhone = ruleForLeadStage(stagePhone || winnerLeadPhone.stage, rules);
      const ruleMessagePhone =
        `${resolvedPhoneOnly.message}${stagePhone ? ` Stage: ${stagePhone}.` : ""}` +
        ghlSuffix(stagePhone, matchedRulePhone) +
        ` (${rows.length} lead(s) on this phone; no full SSN on file — stage precedence only.)`;
           return {
        has_match: true,
        match_count: rows.length,
        is_addable: resolvedPhoneOnly.is_addable,
        rule_message: ruleMessagePhone,
        lead_ids: rows.map((r) => r.id),
        stages: rows.map((r) => String(r.stage ?? "").trim()).filter((s) => s.length > 0),
        scenario: "multi_phone_stage_only",
        ssn_digits_provided: false,
        decision_log: [
          "No full SSN on any phone-matched lead — applied stage precedence across those rows only.",
          ...resolvedPhoneOnly.decision_log,
        ],
        ...(resolvedPhoneOnly.winner ? { winner: resolvedPhoneOnly.winner } : {}),
      };
    }

    const { anchor, source: anchorSource } = anchorRes;
    const socialVars = socialQueryVariants(anchor, rows);
    const { data: cohortRaw, error: cohortError } = await supabase
      .from("leads")
      .select("id, lead_unique_id, stage, phone, social, first_name, last_name, created_at")
      .eq("is_draft", false)
      .in("social", socialVars)
      .order("created_at", { ascending: false });

    if (cohortError) {
      return {
        has_match: true,
        match_count: rows.length,
        error: cohortError.message,
        lead_ids: rows.map((r) => r.id),
        stages: rows.map((r) => String(r.stage ?? "").trim()).filter(Boolean),
      };
    }

    const cohortList = ((cohortRaw ?? []) as LeadRow[]).filter(
      (r) => normalizeSsnDigits(String(r.social ?? "")) === anchor,
    );
    const cohortById = new Map<string, LeadRow>();
    for (const r of cohortList) {
      cohortById.set(r.id, r);
    }
    const cohort = Array.from(cohortById.values());

    if (cohort.length === 0) {
      return {
        has_match: true,
        match_count: rows.length,
        is_addable: true,
        rule_message: "Matched phone in CRM but could not load leads for the on-file SSN.",
        lead_ids: rows.map((r) => r.id),
        stages: rows.map((r) => String(r.stage ?? "").trim()).filter((s) => s.length > 0),
        scenario: "multi_no_ssn",
        ssn_digits_provided: requestNine.length === 9,
        ...(anchorSource === "crm" ? { ssn_matched_from_crm: true } : {}),
      };
    }

    const resolved = resolveDuplicatePolicy(
      cohort.map((c) => ({ id: c.id, stage: c.stage })),
      rules,
    );
    const winnerLead = resolved.winner
      ? cohort.find((c) => c.id === resolved.winner!.lead_id) ?? cohort[0]
      : cohort[0];
    const stage = String(resolved.winner?.stage ?? winnerLead.stage ?? "").trim();
    const matchedRule = ruleForLeadStage(stage || winnerLead.stage, rules);
    const ruleMessage =
      `${resolved.message}${stage ? ` Stage: ${stage}.` : ""}` +
      ghlSuffix(stage, matchedRule) +
      ` (${cohort.length} lead(s) in CRM share this SSN.)`;
    const matched_contact_name =
      cohort.length === 1 ? formatContactName(winnerLead.first_name, winnerLead.last_name) : undefined;

    return {
      has_match: true,
      match_count: cohort.length,
      is_addable: resolved.is_addable,
      rule_message: ruleMessage,
      ...(matched_contact_name ? { matched_contact_name } : {}),
      lead_ids: cohort.map((r) => r.id),
      stages: cohort.map((r) => String(r.stage ?? "").trim()).filter((s) => s.length > 0),
      scenario: cohort.length === 1 ? "single" : "multi_ssn_resolved",
      ssn_digits_provided: requestNine.length === 9,
      decision_log: resolved.decision_log,
      ...(resolved.winner ? { winner: resolved.winner } : {}),
      ...(anchorSource === "crm" ? { ssn_matched_from_crm: true } : {}),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "CRM phone match check failed";
    return { has_match: false, error: msg, scenario: "no_match" };
  }
}

function buildTransferCheckResponse(cleanPhone: string, crm: CrmPhoneMatchPayload): Record<string, unknown> {
  let message = CLEAR_TRANSFER_MESSAGE;
  let status: string = "cleared";

  if (!crm.has_match) {
    const err = String(crm.error ?? "").trim();
    if (err) {
      message = err;
      status = "error";
    }
  } else {
    const rm = String(crm.rule_message ?? "").trim();
    const err = String(crm.error ?? "").trim();
    message = rm || err || CLEAR_TRANSFER_MESSAGE;
    status = crm.is_addable === false ? "blocked" : "matched";
  }

  return {
    phone: cleanPhone,
    message,
    status,
    crm_phone_match: crm,
  };
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

  let crmPhoneMatch: CrmPhoneMatchPayload;
  try {
    crmPhoneMatch = await computeCrmPhoneMatch(supabase, cleanPhone, phoneRaw, socialOpt);
  } catch {
    crmPhoneMatch = { has_match: false, error: "CRM phone match check threw", scenario: "no_match" };
  }

  const merged = buildTransferCheckResponse(cleanPhone, crmPhoneMatch);

  return new Response(JSON.stringify(merged), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
