"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ClaimWorkflowType = "buffer" | "licensed" | "retention";
export type RetentionType = "new_sale" | "fixed_payment" | "carrier_requirements";

export type AgentOption = {
  id: string;
  name: string;
  roleKey: string;
};

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
};

type VerificationSessionRow = {
  id: string;
  submission_id: string;
  status: string;
};

export async function ensureSubmissionId(
  supabase: SupabaseClient,
  leadRowId: string,
  existingSubmissionId: string | null,
): Promise<string> {
  const clean = (existingSubmissionId || "").trim();
  if (clean) return clean;

  const fallback = leadRowId.trim();
  const { error } = await supabase
    .from("leads")
    .update({ submission_id: fallback })
    .eq("id", leadRowId)
    .is("submission_id", null);

  if (error) {
    throw new Error(error.message || "Could not set submission id for this lead.");
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
    .select("id, full_name, role_id, roles!inner(key)")
    .eq("status", "active");

  if (error) {
    throw new Error(error.message || "Failed to load claim agents.");
  }

  const rows = (data || []) as Array<{
    id: string;
    full_name: string | null;
    role_id: string | null;
    roles: { key: string } | { key: string }[] | null;
  }>;

  const normalized: AgentOption[] = rows
    .map((row) => {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      const key = role?.key || "";
      return {
        id: row.id,
        roleKey: key,
        name: row.full_name?.trim() || "Unknown User",
      };
    })
    .filter((row) => row.roleKey.length > 0);

  const licensedAgents = normalized.filter((row) => row.roleKey === "sales_agent_licensed");
  const bufferAgents = normalized.filter(
    (row) => row.roleKey === "sales_agent_unlicensed" || row.roleKey === "call_center_agent",
  );
  const retentionAgents = normalized.filter(
    (row) => row.roleKey === "sales_manager" || row.roleKey === "sales_agent_licensed",
  );

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

  if (selection.workflowType === "buffer" && selection.bufferAgentId) {
    basePayload.buffer_agent_id = selection.bufferAgentId;
  }
  if (selection.workflowType === "licensed" && selection.licensedAgentId) {
    basePayload.licensed_agent_id = selection.licensedAgentId;
  }
  if (selection.workflowType === "retention" && selection.retentionAgentId) {
    basePayload.retention_agent_id = selection.retentionAgentId;
    basePayload.retention_notes = {
      retentionType: selection.retentionType || null,
      notes: selection.retentionNotes || null,
      quoteCarrier: selection.quoteCarrier || null,
      quoteProduct: selection.quoteProduct || null,
      quoteCoverage: selection.quoteCoverage || null,
      quoteMonthlyPremium: selection.quoteMonthlyPremium || null,
    };
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

  if (selection.workflowType === "buffer") {
    sessionPatch.buffer_agent_id = selection.bufferAgentId;
  } else if (selection.workflowType === "licensed") {
    sessionPatch.licensed_agent_id = selection.licensedAgentId;
  } else if (selection.workflowType === "retention") {
    sessionPatch.retention_agent_id = selection.retentionAgentId;
    sessionPatch.retention_notes = {
      retentionType: selection.retentionType || null,
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
