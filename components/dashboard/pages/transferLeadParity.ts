"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isUnlicensedSalesSubtype, type UnlicensedSalesSubtype } from "@/lib/auth/unlicensedSalesSubtype";
import { getTodayDateEST } from "./daily-deal-flow/helpers";

export type ClaimWorkflowType = "buffer_only" | "buffer" | "licensed" | "retention";
export type RetentionType = "new_sale" | "fixed_payment" | "carrier_requirements";

export type AgentOption = {
  id: string;
  name: string;
  roleKey: string;
};

/** Default “Direct to Licensed” assignee when the signed-in user is in the licensed agents list. */
export function defaultLicensedAgentIdForSession(
  licensedAgents: AgentOption[],
  sessionUserId: string | null | undefined,
): string | null {
  const uid = typeof sessionUserId === "string" ? sessionUserId.trim() : "";
  if (!uid) return null;
  return licensedAgents.some((a) => a.id === uid) ? uid : null;
}

/** Roles that can take a “Direct to Licensed” claim */
const LICENSED_CLAIM_ROLE_KEYS = new Set([
  "sales_agent_licensed",
  "sales_manager",
  "sales_admin",
]);

export type ClaimSelections = {
  workflowType: ClaimWorkflowType;
  bufferAgentId: string | null;
  licensedAgentId: string | null;
  retentionAgentId: string | null;
  isRetentionCall: boolean;
  retentionType: RetentionType | "";
  retentionNotes: string;
  quoteCarrier: string;
  quoteProduct: string;
  quoteCoverage: string;
  quoteMonthlyPremium: string;
};

export type VerificationItemRow = {
  id: string;
  field_name: string;
  field_category: string | null;
  original_value: string | null;
  verified_value: string | null;
  is_verified: boolean | null;
  notes: string | null;
};

export type ClaimLeadContext = {
  rowId: string;
  leadUniqueId: string;
  leadName: string;
  phone: string;
  source: string;
  submissionId: string | null;
  callCenterId: string | null;
};

type VerificationSessionRow = {
  id: string;
  submission_id: string;
  status: string;
};

type LeadSyncMapper = (value: string) => Record<string, unknown>;

const VERIFIED_FIELD_TO_LEAD_MAPPER: Record<string, LeadSyncMapper> = {
  customer_full_name: (value) => {
    const clean = value.trim();
    if (!clean) return {};
    const parts = clean.split(/\s+/);
    const first = parts.shift() || "";
    const last = parts.join(" ");
    return {
      first_name: first || null,
      last_name: last || null,
    };
  },
  date_of_birth: (value) => ({ date_of_birth: value.trim() || null }),
  birth_state: (value) => ({ birth_state: value.trim() || null }),
  age: (value) => ({ age: value.trim() || null }),
  social_security: (value) => ({ social: value.trim() || null }),
  driver_license: (value) => ({ driver_license_number: value.trim() || null }),
  street_address: (value) => ({ street1: value.trim() || null }),
  city: (value) => ({ city: value.trim() || null }),
  state: (value) => ({ state: value.trim() || null }),
  zip_code: (value) => ({ zip_code: value.trim() || null }),
  phone_number: (value) => ({ phone: value.trim() || null }),
  height: (value) => ({ height: value.trim() || null }),
  weight: (value) => ({ weight: value.trim() || null }),
  doctors_name: (value) => ({ doctor_name: value.trim() || null }),
  tobacco_use: (value) => ({ tobacco_use: value.trim() || null }),
  health_conditions: (value) => ({ health_conditions: value.trim() || null }),
  medications: (value) => ({ medications: value.trim() || null }),
  existing_coverage: (value) => ({ existing_coverage_last_2_years: value.trim() || null }),
  previous_applications: (value) => ({ previous_applications_2_years: value.trim() || null }),
  carrier: (value) => ({ carrier: value.trim() || null }),
  product_type: (value) => ({ product_type: value.trim() || null }),
  insurance_application_details: (value) => ({ product_type: value.trim() || null }),
  draft_date: (value) => ({ draft_date: value.trim() || null }),
  future_draft_date: (value) => ({ future_draft_date: value.trim() || null }),
  beneficiary_information: (value) => ({ beneficiary_information: value.trim() || null }),
  institution_name: (value) => ({ institution_name: value.trim() || null }),
  beneficiary_routing: (value) => ({ routing_number: value.trim() || null }),
  beneficiary_account: (value) => ({ account_number: value.trim() || null }),
  account_type: (value) => ({ bank_account_type: value.trim() || null }),
  additional_notes: (value) => ({ additional_information: value.trim() || null }),
  lead_vendor: (value) => ({ lead_source: value.trim() || null }),
  coverage_amount: (value) => {
    const parsed = Number(String(value).replace(/\$/g, "").replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? { coverage_amount: parsed } : {};
  },
  monthly_premium: (value) => {
    const parsed = Number(String(value).replace(/\$/g, "").replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? { monthly_premium: parsed } : {};
  },
};

export async function ensureSubmissionId(
  supabase: SupabaseClient,
  leadRowId: string,
  existingSubmissionId: string | null,
): Promise<string> {
  const clean = (existingSubmissionId || "").trim();
  if (clean) return clean;

  const fallback = leadRowId.trim();
  // Some legacy rows store `submission_id` as an empty string instead of NULL.
  // We treat both as "missing" so downstream daily deal flow can populate insured_name/lead_vendor.
  const { error: nullError } = await supabase
    .from("leads")
    .update({ submission_id: fallback })
    .eq("id", leadRowId)
    .is("submission_id", null);

  if (nullError) {
    throw new Error(nullError.message || "Could not set submission id for this lead.");
  }

  const { error: emptyError } = await supabase
    .from("leads")
    .update({ submission_id: fallback })
    .eq("id", leadRowId)
    .eq("submission_id", "");

  if (emptyError) {
    throw new Error(emptyError.message || "Could not set submission id for this lead.");
  }

  return fallback;
}

export async function fetchClaimAgents(supabase: SupabaseClient): Promise<{
  bufferAgents: AgentOption[];
  licensedAgents: AgentOption[];
  retentionAgents: AgentOption[];
}> {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, is_licensed, unlicensed_sales_subtype, role_id, roles!inner(key)")
    .in("status", ["active", "invited"]);

  if (error) {
    throw new Error(error.message || "Failed to load claim agents.");
  }

  const rows = (data || []) as Array<{
    id: string;
    full_name: string | null;
    is_licensed?: boolean | null;
    unlicensed_sales_subtype?: string | null;
    role_id: string | null;
    roles: { key: string } | { key: string }[] | null;
  }>;

  type Norm = AgentOption & { isLicensedProfile: boolean; unlicensedSubtype: UnlicensedSalesSubtype | null };

  const normalized: Norm[] = rows
    .map((row) => {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      const key = role?.key || "";
      const st = row.unlicensed_sales_subtype;
      return {
        id: row.id,
        roleKey: key,
        name: row.full_name?.trim() || "Unknown User",
        isLicensedProfile: row.is_licensed === true,
        unlicensedSubtype: isUnlicensedSalesSubtype(st) ? st : null,
      };
    })
    .filter((row) => row.roleKey.length > 0);

  const byName = (a: AgentOption, b: AgentOption) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

  const toOption = (row: Norm): AgentOption => ({
    id: row.id,
    name: row.name,
    roleKey: row.roleKey,
  });

  /** Direct to Licensed — all sales agents (licensed and unlicensed) */
  const licensedAgents = normalized
    .filter(
      (row) =>
        row.roleKey === "sales_agent_unlicensed" ||
        row.roleKey === "sales_agent_licensed",
    )
    .map(toOption)
    .sort(byName);

  /** Buffer to Licensed — all sales agents (licensed and unlicensed) */
  const bufferAgents = normalized
    .filter(
      (row) =>
        row.roleKey === "sales_agent_unlicensed" ||
        row.roleKey === "sales_agent_licensed",
    )
    .map(toOption)
    .sort(byName);

  /** Retention workflow — managers/licensed, plus unlicensed users designated as retention */
  const retentionAgents = normalized
    .filter((row) => {
      if (row.roleKey === "sales_manager" || LICENSED_CLAIM_ROLE_KEYS.has(row.roleKey)) return true;
      return row.roleKey === "sales_agent_unlicensed" && row.unlicensedSubtype === "retention_agent";
    })
    .map(toOption)
    .sort(byName);

  return { bufferAgents, licensedAgents, retentionAgents };
}

async function seedVerificationItemsFallback(
  supabase: SupabaseClient,
  sessionId: string,
  leadRowId: string,
): Promise<void> {
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      "first_name,last_name,street1,street2,city,state,zip_code,phone,birth_state,date_of_birth,age,social,driver_license_number,existing_coverage_last_2_years,previous_applications_2_years,height,weight,doctor_name,tobacco_use,health_conditions,medications,monthly_premium,coverage_amount,carrier,product_type,draft_date,future_draft_date,beneficiary_information,institution_name,routing_number,account_number,bank_account_type,additional_information,lead_source",
    )
    .eq("id", leadRowId)
    .maybeSingle();

  if (leadError || !lead) {
    throw new Error(leadError?.message || "Unable to read lead for verification item seeding.");
  }

  const leadName = `${String(lead.first_name || "").trim()} ${String(lead.last_name || "").trim()}`.trim();
  const streetAddress = [lead.street1, lead.street2].filter(Boolean).join(" ");

  const items = [
    ["customer_full_name", "personal", leadName],
    ["date_of_birth", "personal", lead.date_of_birth],
    ["birth_state", "personal", lead.birth_state],
    ["age", "personal", lead.age],
    ["social_security", "personal", lead.social],
    ["driver_license", "personal", lead.driver_license_number],
    ["street_address", "contact", streetAddress],
    ["city", "contact", lead.city],
    ["state", "contact", lead.state],
    ["zip_code", "contact", lead.zip_code],
    ["phone_number", "contact", lead.phone],
    ["height", "health", lead.height],
    ["weight", "health", lead.weight],
    ["doctors_name", "health", lead.doctor_name],
    ["tobacco_use", "health", lead.tobacco_use],
    ["health_conditions", "health", lead.health_conditions],
    ["medications", "health", lead.medications],
    ["existing_coverage", "health", lead.existing_coverage_last_2_years],
    ["previous_applications", "health", lead.previous_applications_2_years],
    ["carrier", "insurance", lead.carrier],
    ["product_type", "insurance", lead.product_type],
    ["coverage_amount", "insurance", lead.coverage_amount],
    ["monthly_premium", "insurance", lead.monthly_premium],
    ["draft_date", "insurance", lead.draft_date],
    ["future_draft_date", "insurance", lead.future_draft_date],
    ["beneficiary_information", "banking", lead.beneficiary_information],
    ["institution_name", "banking", lead.institution_name],
    ["beneficiary_routing", "banking", lead.routing_number],
    ["beneficiary_account", "banking", lead.account_number],
    ["account_type", "banking", lead.bank_account_type],
    ["additional_notes", "additional", lead.additional_information],
    ["lead_vendor", "additional", lead.lead_source],
    ["call_dropped", "outcome", ""],
  ] as const;

  const insertRows = items.map(([fieldName, category, value]) => ({
    session_id: sessionId,
    field_name: fieldName,
    field_category: category,
    original_value: value == null ? null : String(value),
  }));

  const { error: insertError } = await supabase
    .from("verification_items")
    .upsert(insertRows, { onConflict: "session_id,field_name", ignoreDuplicates: false });

  if (insertError) {
    throw new Error(insertError.message || "Unable to initialize verification items.");
  }
}

export async function initializeVerificationItems(
  supabase: SupabaseClient,
  sessionId: string,
  submissionId: string,
  leadRowId: string,
): Promise<void> {
  const { error: rpcError } = await supabase.rpc("initialize_verification_items", {
    session_id_param: sessionId,
    submission_id_param: submissionId,
  });

  if (!rpcError) return;
  await seedVerificationItemsFallback(supabase, sessionId, leadRowId);
}

export async function findOrCreateVerificationSession(
  supabase: SupabaseClient,
  context: ClaimLeadContext,
  selection: ClaimSelections,
): Promise<{ sessionId: string; submissionId: string }> {
  const submissionId = await ensureSubmissionId(supabase, context.rowId, context.submissionId);

  const { data: existing, error: existingError } = await supabase
    .from("verification_sessions")
    .select("id, submission_id, status")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || "Failed to check current verification sessions.");
  }

  if (existing?.id) {
    return {
      sessionId: existing.id,
      submissionId,
    };
  }

  const basePayload: Record<string, unknown> = {
    submission_id: submissionId,
    status: "in_progress",
    is_retention_call: selection.isRetentionCall,
    started_at: new Date().toISOString(),
  };

  if (selection.workflowType === "buffer_only" && selection.bufferAgentId) {
    basePayload.buffer_agent_id = selection.bufferAgentId;
  }
  if (selection.workflowType === "buffer" && selection.bufferAgentId) {
    basePayload.buffer_agent_id = selection.bufferAgentId;
  }
  if (selection.workflowType === "buffer" && selection.licensedAgentId) {
    basePayload.licensed_agent_id = selection.licensedAgentId;
  }
  if (selection.workflowType === "licensed" && selection.licensedAgentId) {
    basePayload.licensed_agent_id = selection.licensedAgentId;
  }
  if (selection.workflowType === "retention" && selection.retentionAgentId) {
    basePayload.retention_agent_id = selection.retentionAgentId;
    basePayload.retention_notes = {
      retentionType: selection.retentionType || "new_sale",
      notes: selection.retentionNotes || null,
      quoteCarrier: selection.quoteCarrier || null,
      quoteProduct: selection.quoteProduct || null,
      quoteCoverage: selection.quoteCoverage || null,
      quoteMonthlyPremium: selection.quoteMonthlyPremium || null,
    };
  }
  if (selection.workflowType === "retention" && selection.licensedAgentId) {
    basePayload.licensed_agent_id = selection.licensedAgentId;
  }

  const { data: created, error: createError } = await supabase
    .from("verification_sessions")
    .insert(basePayload)
    .select("id, submission_id, status")
    .single();

  if (createError || !created) {
    // Another request may have created the row first due to the unique constraint.
    if (createError?.code === "23505") {
      const { data: fallback, error: fallbackError } = await supabase
        .from("verification_sessions")
        .select("id, submission_id, status")
        .eq("submission_id", submissionId)
        .limit(1)
        .maybeSingle();
      if (!fallbackError && fallback?.id) {
        return { sessionId: fallback.id, submissionId };
      }
    }
    throw new Error(createError?.message || "Unable to create verification session.");
  }

  await initializeVerificationItems(supabase, created.id, submissionId, context.rowId);

  return {
    sessionId: created.id,
    submissionId,
  };
}

export async function applyClaimSelectionToSession(
  supabase: SupabaseClient,
  sessionId: string,
  submissionId: string,
  selection: ClaimSelections,
): Promise<void> {
  const sessionPatch: Record<string, unknown> = {
    is_retention_call: selection.isRetentionCall,
    updated_at: new Date().toISOString(),
    status: "in_progress",
  };

  if (selection.workflowType === "buffer_only") {
    sessionPatch.buffer_agent_id = selection.bufferAgentId;
    sessionPatch.licensed_agent_id = null;
  } else if (selection.workflowType === "buffer") {
    sessionPatch.buffer_agent_id = selection.bufferAgentId;
    sessionPatch.licensed_agent_id = selection.licensedAgentId;
  } else if (selection.workflowType === "licensed") {
    sessionPatch.licensed_agent_id = selection.licensedAgentId;
  } else if (selection.workflowType === "retention") {
    sessionPatch.retention_agent_id = selection.retentionAgentId;
    sessionPatch.licensed_agent_id = selection.licensedAgentId;
    sessionPatch.retention_notes = {
      retentionType: selection.retentionType || "new_sale",
      notes: selection.retentionNotes || null,
      quoteCarrier: selection.quoteCarrier || null,
      quoteProduct: selection.quoteProduct || null,
      quoteCoverage: selection.quoteCoverage || null,
      quoteMonthlyPremium: selection.quoteMonthlyPremium || null,
    };
  }

  const { error: updateError } = await supabase
    .from("verification_sessions")
    .update(sessionPatch)
    .eq("id", sessionId);

  if (updateError) {
    throw new Error(updateError.message || "Unable to save claim assignment.");
  }

  const { error: leadUpdateError } = await supabase
    .from("leads")
    .update({
      is_retention_call: selection.isRetentionCall,
      submission_id: submissionId,
    })
    .eq("submission_id", submissionId);

  if (leadUpdateError) {
    const missingRetentionColumn =
      leadUpdateError.code === "PGRST204" &&
      typeof leadUpdateError.message === "string" &&
      leadUpdateError.message.includes("'is_retention_call' column");

    if (missingRetentionColumn) {
      // Backward-compatible fallback for environments where leads.is_retention_call does not exist yet.
      const { error: fallbackLeadUpdateError } = await supabase
        .from("leads")
        .update({ submission_id: submissionId })
        .eq("submission_id", submissionId);

      if (!fallbackLeadUpdateError) return;
      throw new Error(fallbackLeadUpdateError.message || "Unable to update lead claim state.");
    }

    throw new Error(leadUpdateError.message || "Unable to update lead claim state.");
  }
}

export async function loadVerificationItems(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<VerificationItemRow[]> {
  const { data, error } = await supabase
    .from("verification_items")
    .select("id, field_name, field_category, original_value, verified_value, is_verified, notes")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message || "Failed to load verification items.");
  return (data || []) as VerificationItemRow[];
}

export async function updateVerificationItem(
  supabase: SupabaseClient,
  itemId: string,
  payload: { isVerified?: boolean; verifiedValue?: string; notes?: string },
): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.isVerified !== undefined) patch.is_verified = payload.isVerified;
  if (payload.verifiedValue !== undefined) patch.verified_value = payload.verifiedValue;
  if (payload.notes !== undefined) patch.notes = payload.notes;

  const { error } = await supabase.from("verification_items").update(patch).eq("id", itemId);
  if (error) throw new Error(error.message || "Failed to save verification item.");
}

export async function fetchLatestSessionForSubmission(
  supabase: SupabaseClient,
  submissionId: string,
): Promise<VerificationSessionRow | null> {
  const { data, error } = await supabase
    .from("verification_sessions")
    .select("id, submission_id, status")
    .eq("submission_id", submissionId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message || "Failed to load verification session.");
  return (data as VerificationSessionRow | null) || null;
}

export async function syncVerifiedFieldsToLead(
  supabase: SupabaseClient,
  leadRowId: string,
  submissionId: string,
  sessionIdOverride?: string | null,
): Promise<void> {
  const session = sessionIdOverride?.trim()
    ? { id: sessionIdOverride.trim() }
    : await fetchLatestSessionForSubmission(supabase, submissionId);
  if (!session?.id) return;

  const { data, error } = await supabase
    .from("verification_items")
    .select("field_name, verified_value, original_value, is_verified")
    .eq("session_id", session.id)
    .eq("is_verified", true);

  if (error) {
    throw new Error(error.message || "Failed to load verified fields.");
  }

  const items = (data || []) as Array<{
    field_name: string | null;
    verified_value: string | null;
    original_value: string | null;
    is_verified: boolean | null;
  }>;

  const leadPatch: Record<string, unknown> = {};
  for (const item of items) {
    const fieldName = String(item.field_name || "").trim();
    if (!fieldName) continue;
    const mapper = VERIFIED_FIELD_TO_LEAD_MAPPER[fieldName];
    if (!mapper) continue;
    const value = String(item.verified_value ?? item.original_value ?? "").trim();
    if (!value) continue;
    Object.assign(leadPatch, mapper(value));
  }

  if (Object.keys(leadPatch).length === 0) return;
  leadPatch.updated_at = new Date().toISOString();

  const { data: updatedLead, error: leadError } = await supabase
    .from("leads")
    .update(leadPatch)
    .eq("id", leadRowId)
    .select("id")
    .maybeSingle();

  if (leadError) {
    throw new Error(leadError.message || "Failed to sync verified fields to lead.");
  }
  if (!updatedLead?.id) {
    throw new Error("Verified fields sync did not update the lead row (possible RLS or row visibility issue).");
  }
}

/**
 * Full retention workflow save - handles complex retention operations
 * This consolidates the logic from TransferLeadRetentionFlowPage into the modal workflow
 */
export async function saveFullRetentionWorkflow(
  supabase: SupabaseClient,
  context: ClaimLeadContext,
  selection: ClaimSelections,
  userId: string | null,
): Promise<void> {
  if (!context.submissionId) {
    throw new Error("Submission ID is required for retention workflow.");
  }

  const submissionId = context.submissionId;
  const retentionType = selection.retentionType || "new_sale";

  // For new_sale mode, add to daily_deal_flow
  if (retentionType === "new_sale") {
    const { data: profile } = userId
      ? await supabase.from("users").select("call_center_id, call_centers(name)").eq("id", userId).maybeSingle()
      : { data: null as { call_center_id?: string | null; call_centers?: { name?: string } | null } | null };

    const row = profile as { call_center_id?: string | null; call_centers?: { name?: string } | null } | null;
    const { error: ddfError } = await supabase.from("daily_deal_flow").insert({
      lead_id: context.rowId,
      lead_unique_id: context.leadUniqueId,
      lead_name: context.leadName,
      center_name: row?.call_centers?.name || null,
      call_center_id: row?.call_center_id || null,
      date: getTodayDateEST(),
    });
    if (ddfError) throw ddfError;
  }

  // Create the retention task
  const { data: task, error: taskError } = await supabase
    .from("app_fix_tasks")
    .insert({
      submission_id: submissionId,
      lead_id: context.rowId,
      task_type: retentionType,
      status: "open",
      assigned_to: userId,
      notes: selection.retentionNotes || null,
    })
    .select("id")
    .single();
  if (taskError || !task) throw taskError || new Error("Unable to create retention task.");

  // Create specific records based on retention type
  if (retentionType === "fixed_payment") {
    const { error } = await supabase.from("app_fix_banking_updates").insert({
      task_id: task.id,
      submission_id: submissionId,
      lead_id: context.rowId,
      notes: selection.retentionNotes || null,
    });
    if (error) throw error;
  } else if (retentionType === "carrier_requirements") {
    const { error } = await supabase.from("app_fix_carrier_requirements").insert({
      task_id: task.id,
      submission_id: submissionId,
      lead_id: context.rowId,
      carrier: selection.quoteCarrier || null,
      product_type: selection.quoteProduct || null,
      coverage_amount: selection.quoteCoverage || null,
      monthly_premium: selection.quoteMonthlyPremium || null,
      notes: selection.retentionNotes || null,
    });
    if (error) throw error;
  }

  // Update verification session with retention metadata
  const { error: sessionError } = await supabase
    .from("verification_sessions")
    .update({
      is_retention_call: true,
      status: "in_progress",
      retention_notes: {
        retentionType: retentionType,
        notes: selection.retentionNotes || null,
        quoteCarrier: selection.quoteCarrier || null,
        quoteProduct: selection.quoteProduct || null,
        quoteCoverage: selection.quoteCoverage || null,
        quoteMonthlyPremium: selection.quoteMonthlyPremium || null,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("submission_id", submissionId);
  if (sessionError) throw sessionError;
}
