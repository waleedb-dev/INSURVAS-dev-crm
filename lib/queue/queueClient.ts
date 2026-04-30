"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoleKey } from "@/lib/auth/roles";

export type QueueRole = "manager" | "ba" | "la" | "none";
export type QueueType = "unclaimed_transfer" | "ba_active" | "la_active";

export type LeadQueueItem = {
  id: string;
  lead_id: string | null;
  submission_id: string | null;
  client_name: string | null;
  call_center_name: string | null;
  state: string | null;
  carrier: string | null;
  action_required: string | null;
  queue_type: QueueType;
  status: "active" | "completed" | "dropped" | "cancelled" | "expired";
  assigned_ba_id: string | null;
  assigned_la_id: string | null;
  eta_minutes: number | null;
  ba_verification_percent: number | null;
  la_ready_at: string | null;
  queued_at: string;
  updated_at: string;
};

export type QueueOutcome = "completed" | "dropped_callback";

type QueueEventType =
  | "queue_created"
  | "manager_assigned"
  | "ready_clicked"
  | "la_ready"
  | "transfer_sent"
  | "call_dropped"
  | "status_changed";

const MANAGER_ROLES = new Set<RoleKey>([
  "system_admin",
  "sales_admin",
  "sales_manager",
  "publisher_manager",
]);

export function resolveQueueRole(role: RoleKey): QueueRole {
  if (MANAGER_ROLES.has(role)) return "manager";
  if (role === "sales_agent_licensed") return "la";
  if (role === "sales_agent_unlicensed") return "ba";
  return "none";
}

function allowedQueueTypes(queueRole: QueueRole): QueueType[] {
  if (queueRole === "manager") return ["unclaimed_transfer", "ba_active", "la_active"];
  if (queueRole === "la") return ["unclaimed_transfer", "ba_active"];
  if (queueRole === "ba") return ["unclaimed_transfer", "la_active"];
  return [];
}

async function logQueueEvent(
  supabase: SupabaseClient,
  queueItemId: string,
  eventType: QueueEventType,
  actorUserId: string,
  actorRole: "manager" | "ba" | "la",
  oldPayload: Record<string, unknown> | null,
  newPayload: Record<string, unknown> | null,
) {
  await supabase.from("lead_queue_events").insert({
    queue_item_id: queueItemId,
    event_type: eventType,
    actor_user_id: actorUserId,
    actor_role: actorRole,
    old_payload: oldPayload,
    new_payload: newPayload,
  });
}

export async function fetchQueueSnapshot(
  supabase: SupabaseClient,
  queueRole: QueueRole,
  currentUserId?: string | null,
): Promise<LeadQueueItem[]> {
  const allowed = allowedQueueTypes(queueRole);
  if (allowed.length === 0) return [];

  const baseQuery = supabase
    .from("lead_queue_items")
    .select(
      "id, lead_id, submission_id, client_name, call_center_name, state, carrier, action_required, queue_type, status, assigned_ba_id, assigned_la_id, eta_minutes, ba_verification_percent, la_ready_at, queued_at, updated_at",
    )
    .eq("status", "active")
    .in("queue_type", allowed)
    .order("queued_at", { ascending: true });

  const { data: baseRows, error: baseError } = await baseQuery.limit(300);
  if (baseError) throw new Error(baseError.message);

  const applyVerificationProgress = async (rows: LeadQueueItem[]) => {
    const submissionIds = Array.from(
      new Set(rows.map((r) => String(r.submission_id ?? "").trim()).filter(Boolean)),
    );
    if (submissionIds.length === 0) return rows;

    const { data: sessionRows, error: sessionErr } = await supabase
      .from("verification_sessions")
      .select("submission_id, progress_percentage, verified_fields, total_fields, updated_at")
      .in("submission_id", submissionIds)
      .order("updated_at", { ascending: false });
    if (sessionErr) throw new Error(sessionErr.message);

    const bySubmission = new Map<string, number>();
    for (const s of sessionRows ?? []) {
      const key = String(s.submission_id ?? "").trim();
      if (!key || bySubmission.has(key)) continue;
      const fromProgress =
        s.progress_percentage != null && !Number.isNaN(Number(s.progress_percentage))
          ? Number(s.progress_percentage)
          : null;
      const verified = Number(s.verified_fields ?? 0);
      const total = Number(s.total_fields ?? 0);
      const fallback = total > 0 ? Math.round((verified / total) * 100) : null;
      const pct = fromProgress ?? fallback ?? null;
      if (pct != null) bySubmission.set(key, Math.max(0, Math.min(100, pct)));
    }

    return rows.map((row) => {
      if (row.queue_type !== "la_active") return row;
      const key = String(row.submission_id ?? "").trim();
      if (!key) return row;
      const pct = bySubmission.get(key);
      if (pct == null) return row;
      return { ...row, ba_verification_percent: pct };
    });
  };

  if (!currentUserId || queueRole === "manager") {
    return applyVerificationProgress((baseRows ?? []) as LeadQueueItem[]);
  }

  let assignedQuery = supabase
    .from("lead_queue_items")
    .select(
      "id, lead_id, submission_id, client_name, call_center_name, state, carrier, action_required, queue_type, status, assigned_ba_id, assigned_la_id, eta_minutes, ba_verification_percent, la_ready_at, queued_at, updated_at",
    )
    .eq("status", "active")
    .order("queued_at", { ascending: true })
    .limit(300);

  assignedQuery =
    queueRole === "la"
      ? assignedQuery.eq("assigned_la_id", currentUserId)
      : assignedQuery.eq("assigned_ba_id", currentUserId);

  const { data: assignedRows, error: assignedError } = await assignedQuery;
  if (assignedError) throw new Error(assignedError.message);

  const merged = new Map<string, LeadQueueItem>();
  for (const row of (baseRows ?? []) as LeadQueueItem[]) merged.set(row.id, row);
  for (const row of (assignedRows ?? []) as LeadQueueItem[]) merged.set(row.id, row);
  const mergedRows = Array.from(merged.values()).sort(
    (a, b) => new Date(a.queued_at).getTime() - new Date(b.queued_at).getTime(),
  );
  return applyVerificationProgress(mergedRows);
}

export async function fetchQueueAssignees(supabase: SupabaseClient): Promise<
  Array<{ id: string; name: string; queueRole: "ba" | "la" }>
> {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, roles(key)")
    .order("full_name");

  if (error) throw new Error(error.message);

  const out: Array<{ id: string; name: string; queueRole: "ba" | "la" }> = [];
  for (const row of data ?? []) {
    const rolesRaw = row.roles as { key: string } | { key: string }[] | null;
    const roleObj = Array.isArray(rolesRaw) ? rolesRaw[0] : rolesRaw;
    const key = roleObj?.key;
    if (key !== "sales_agent_unlicensed" && key !== "sales_agent_licensed") continue;
    out.push({
      id: String(row.id),
      name: String(row.full_name ?? "Unnamed Agent").trim() || "Unnamed Agent",
      queueRole: key === "sales_agent_licensed" ? "la" : "ba",
    });
  }

  return out;
}

export async function managerAssignQueueItem(
  supabase: SupabaseClient,
  queueItemId: string,
  actorUserId: string,
  payload: { assignedBaId?: string | null; assignedLaId?: string | null; etaMinutes?: number | null },
) {
  const oldPayload = payload as Record<string, unknown>;
  const updatePayload: Record<string, unknown> = {
    manager_assigned_by: actorUserId,
  };
  if ("assignedBaId" in payload) updatePayload.assigned_ba_id = payload.assignedBaId ?? null;
  if ("assignedLaId" in payload) updatePayload.assigned_la_id = payload.assignedLaId ?? null;
  if ("etaMinutes" in payload) updatePayload.eta_minutes = payload.etaMinutes ?? null;

  const { error } = await supabase.from("lead_queue_items").update(updatePayload).eq("id", queueItemId);
  if (error) throw new Error(error.message);

  await logQueueEvent(
    supabase,
    queueItemId,
    "manager_assigned",
    actorUserId,
    "manager",
    oldPayload,
    updatePayload,
  );
}

export async function markQueueReady(
  supabase: SupabaseClient,
  queueItem: LeadQueueItem,
  actorUserId: string,
  actorRole: "ba" | "la",
) {
  const nowIso = new Date().toISOString();
  const payload: Record<string, unknown> = {};

  if (actorRole === "la") {
    payload.la_ready_at = nowIso;
    payload.la_ready_by = actorUserId;
  } else {
    payload.ba_ready_at = nowIso;
    payload.ba_ready_by = actorUserId;
  }
  if (queueItem.queue_type === "unclaimed_transfer") {
    payload.queue_type = actorRole === "la" ? "la_active" : "ba_active";
    payload.current_owner_user_id = actorUserId;
    payload.current_owner_role = actorRole;
    payload.claimed_at = nowIso;
  }

  const { error } = await supabase.from("lead_queue_items").update(payload).eq("id", queueItem.id);
  if (error) throw new Error(error.message);

  await logQueueEvent(
    supabase,
    queueItem.id,
    queueItem.queue_type === "ba_active" && actorRole === "la" ? "la_ready" : "ready_clicked",
    actorUserId,
    actorRole,
    null,
    payload,
  );
}

export async function sendQueueTransfer(
  supabase: SupabaseClient,
  queueItem: LeadQueueItem,
  actorUserId: string,
) {
  const payload = {
    queue_type: "la_active",
    current_owner_user_id: queueItem.assigned_la_id,
    current_owner_role: "la",
    ba_transfer_sent_at: new Date().toISOString(),
    claimed_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("lead_queue_items").update(payload).eq("id", queueItem.id);
  if (error) throw new Error(error.message);

  await logQueueEvent(supabase, queueItem.id, "transfer_sent", actorUserId, "ba", null, payload);
}

export async function markQueueClaimed(
  supabase: SupabaseClient,
  args: {
    leadRowId: string;
    submissionId?: string | null;
    actorUserId: string;
    actorRole: "ba" | "la";
  },
) {
  const { leadRowId, submissionId, actorUserId, actorRole } = args;
  const queueType = actorRole === "la" ? "la_active" : "ba_active";
  let query = supabase
    .from("lead_queue_items")
    .select("id")
    .eq("status", "active")
    .eq("lead_id", leadRowId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (submissionId) query = query.eq("submission_id", submissionId);
  const { data: row, error: selErr } = await query.maybeSingle();
  if (selErr) throw new Error(selErr.message);
  if (!row?.id) return;

  const payload = {
    queue_type: queueType,
    current_owner_user_id: actorUserId,
    current_owner_role: actorRole,
    claimed_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("lead_queue_items").update(payload).eq("id", row.id);
  if (error) throw new Error(error.message);
  await logQueueEvent(supabase, row.id, "status_changed", actorUserId, actorRole, null, payload);
}

export async function applyQueueOutcomeFromCallFix(
  supabase: SupabaseClient,
  args: {
    leadRowId: string;
    submissionId?: string | null;
    actorUserId: string;
    outcome: QueueOutcome;
  },
) {
  const { leadRowId, submissionId, actorUserId, outcome } = args;
  let query = supabase
    .from("lead_queue_items")
    .select("*")
    .eq("status", "active")
    .eq("lead_id", leadRowId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (submissionId) query = query.eq("submission_id", submissionId);
  const { data: current, error: selErr } = await query.maybeSingle();
  if (selErr) throw new Error(selErr.message);
  if (!current?.id) return;

  if (outcome === "completed") {
    const payload = { status: "completed" as const };
    const { error } = await supabase.from("lead_queue_items").update(payload).eq("id", current.id);
    if (error) throw new Error(error.message);
    await logQueueEvent(supabase, current.id, "status_changed", actorUserId, "manager", null, payload);
    return;
  }

  const dropPayload = { status: "dropped" as const };
  const { error: dropErr } = await supabase.from("lead_queue_items").update(dropPayload).eq("id", current.id);
  if (dropErr) throw new Error(dropErr.message);
  await logQueueEvent(supabase, current.id, "call_dropped", actorUserId, "manager", null, dropPayload);

  const insertPayload = {
    lead_id: current.lead_id,
    submission_id: current.submission_id,
    verification_session_id: current.verification_session_id,
    ddf_id: current.ddf_id,
    policy_id: current.policy_id,
    client_name: current.client_name,
    phone_number: current.phone_number,
    call_center_id: current.call_center_id,
    call_center_name: current.call_center_name,
    state: current.state,
    carrier: current.carrier,
    queue_type: "unclaimed_transfer" as const,
    status: "active" as const,
    current_owner_user_id: null,
    current_owner_role: null,
    assigned_ba_id: null,
    assigned_la_id: null,
    manager_assigned_by: null,
    la_ready_at: null,
    la_ready_by: null,
    ba_ready_at: null,
    ba_ready_by: null,
    ba_transfer_sent_at: null,
    claimed_at: null,
    eta_minutes: null,
    ba_verification_percent: null,
    action_required: "pending_file",
    attempted_application: current.attempted_application ?? false,
    last_attempt_agent_id: current.last_attempt_agent_id,
    last_attempt_imo_id: current.last_attempt_imo_id,
    last_disposition: "Call back required",
    take_next: false,
    priority_score: current.priority_score,
  };
  const { data: inserted, error: insErr } = await supabase
    .from("lead_queue_items")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();
  if (insErr) throw new Error(insErr.message);
  if (inserted?.id) {
    await logQueueEvent(supabase, inserted.id, "queue_created", actorUserId, "manager", null, insertPayload);
  }
}

export async function enqueueUnclaimedTransfer(
  supabase: SupabaseClient,
  args: {
    leadRowId: string;
    submissionId: string;
    clientName: string;
    phoneNumber?: string | null;
    callCenterId?: string | null;
    callCenterName?: string | null;
    state?: string | null;
    carrier?: string | null;
    actionRequired?: "new_sale" | "carrier_requirement" | "payment_fix" | "pending_file" | "unknown";
    actorUserId: string;
  },
) {
  const {
    leadRowId,
    submissionId,
    clientName,
    phoneNumber = null,
    callCenterId = null,
    callCenterName = null,
    state = null,
    carrier = null,
    actionRequired = "new_sale",
    actorUserId,
  } = args;

  const { data: existing, error: existingErr } = await supabase
    .from("lead_queue_items")
    .select("id")
    .eq("status", "active")
    .eq("lead_id", leadRowId)
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  if (existing?.id) return existing.id as string;

  const payload = {
    lead_id: leadRowId,
    submission_id: submissionId,
    client_name: clientName || "Unnamed Client",
    phone_number: phoneNumber,
    call_center_id: callCenterId,
    call_center_name: callCenterName,
    state,
    carrier,
    queue_type: "unclaimed_transfer" as const,
    status: "active" as const,
    action_required: actionRequired,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("lead_queue_items")
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (insErr) throw new Error(insErr.message);
  if (inserted?.id) {
    await logQueueEvent(supabase, inserted.id, "queue_created", actorUserId, "manager", null, payload);
    return inserted.id as string;
  }
  return null;
}
