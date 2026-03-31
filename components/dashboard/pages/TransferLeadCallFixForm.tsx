"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Toast } from "@/components/ui";
import { AppSelect } from "@/components/ui/app-select";
import { useCarrierProductDropdowns } from "@/lib/useCarrierProductDropdowns";
import { fetchClaimAgents, syncVerifiedFieldsToLead, type AgentOption } from "./transferLeadParity";
import {
  getNoteText,
  getReasonStatusFromStage,
  REASON_MAP,
  REASON_STATUSES_WITH_DROPDOWN,
} from "./transferCallReasonMapping";

type Props = {
  leadRowId: string;
  submissionId: string;
  verificationSessionId?: string | null;
  leadName: string;
  leadPhone?: string;
  leadVendor?: string;
};

const mapStatusToSheetValue = (userSelectedStatus: string) => {
  const statusMap: Record<string, string> = {
    "Needs callback": "Needs BPO Callback",
    "GI - Currently DQ": "Returned To Center - DQ",
    "Call Never Sent": "Incomplete Transfer",
    "Not Interested": "Returned To Center - DQ",
    "Fulfilled carrier requirements": "Pending Approval",
    "Updated Banking/draft date": "Pending Failed Payment Fix",
    DQ: "DQ'd Can't be sold",
    "Chargeback DQ": "DQ'd Can't be sold",
    "Future Submission Date": "Application Withdrawn",
    Disconnected: "Incomplete Transfer",
    "Disconnected - Never Retransferred": "Incomplete Transfer",
  };
  return statusMap[userSelectedStatus] || userSelectedStatus;
};

/** Target `pipeline_stages.name` under Transfer Portal (see `sql/pipelines_and_stages_seed.sql`). */
function mapDispositionToLeadStageName(applicationSubmitted: boolean | null, dispositionStatus: string): string {
  if (applicationSubmitted === true) {
    return "Pending Approval";
  }
  return dispositionStatus;
}

const isSchemaColumnError = (error: unknown) => {
  const candidate = error as { code?: string; message?: string };
  const message = String(candidate?.message || "").toLowerCase();
  return candidate?.code === "PGRST204" || message.includes("column") || message.includes("schema cache");
};

const getMissingColumnFromError = (error: unknown): string | null => {
  const candidate = error as { message?: string };
  const message = String(candidate?.message || "");
  const match = message.match(/'([^']+)' column/i);
  return match?.[1] || null;
};

export default function TransferLeadCallFixForm({
  leadRowId,
  submissionId,
  verificationSessionId,
  leadName,
  leadPhone,
  leadVendor,
}: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const params = useParams<{ role?: string }>();
  const role = Array.isArray(params?.role) ? params.role[0] : params?.role || "agent";

  const [applicationSubmitted, setApplicationSubmitted] = useState<boolean | null>(null);
  const [callSource, setCallSource] = useState("");
  const [status, setStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [notes, setNotes] = useState("");
  const [newDraftDate, setNewDraftDate] = useState("");
  const [bufferAgent, setBufferAgent] = useState("");
  const [agentWhoTookCall, setAgentWhoTookCall] = useState("");
  const [licensedAgentAccount, setLicensedAgentAccount] = useState("");
  const [carrier, setCarrier] = useState("");
  const [productType, setProductType] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [monthlyPremium, setMonthlyPremium] = useState("");
  const [coverageAmount, setCoverageAmount] = useState("");
  const [sentToUnderwriting, setSentToUnderwriting] = useState<boolean | null>(null);
  const [isRetentionCall, setIsRetentionCall] = useState(false);
  const [carrierAttempted1, setCarrierAttempted1] = useState("");
  const [carrierAttempted2, setCarrierAttempted2] = useState("");
  const [carrierAttempted3, setCarrierAttempted3] = useState("");
  const [claimAgentsLoading, setClaimAgentsLoading] = useState(true);
  const [claimAgents, setClaimAgents] = useState<{
    bufferAgents: AgentOption[];
    licensedAgents: AgentOption[];
  }>({ bufferAgents: [], licensedAgents: [] });
  const [transferPipelineStages, setTransferPipelineStages] = useState<string[]>([]);
  const [transferStagesLoading, setTransferStagesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const { carriers, productsForCarrier, loadingProducts } = useCarrierProductDropdowns(supabase, {
    open: true,
    carrierName: carrier,
    onInvalidateProduct: (list, carrierNameSnapshot) => {
      if (carrierNameSnapshot !== carrier.trim()) return;
      if (!productType.trim()) return;
      if (list.some((x) => x.name === productType)) return;
      setProductType("");
    },
  });
  const carrierOptions = carriers.map((c) => c.name);
  const bufferAgentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...claimAgents.bufferAgents.map((row) => row.name), bufferAgent]
            .map((name) => name.trim())
            .filter(Boolean),
        ),
      ),
    [claimAgents.bufferAgents, bufferAgent],
  );
  const licensedAgentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...claimAgents.licensedAgents.map((row) => row.name), agentWhoTookCall, licensedAgentAccount]
            .map((name) => name.trim())
            .filter(Boolean),
        ),
      ),
    [claimAgents.licensedAgents, agentWhoTookCall, licensedAgentAccount],
  );

  const statusOptions = useMemo(() => transferPipelineStages, [transferPipelineStages]);
  const reasonStatus = useMemo(() => getReasonStatusFromStage(status), [status]);
  const reasons = REASON_MAP[reasonStatus] || [];
  const showSubmittedFields = applicationSubmitted === true;
  const showNotSubmittedFields = applicationSubmitted === false;
  const showStatusReasonDropdown =
    applicationSubmitted === false &&
    REASON_STATUSES_WITH_DROPDOWN.has(reasonStatus);
  const requiresDraftDate = reasonStatus === "Updated Banking/draft date" && !!statusReason;
  const showCarrierAttemptedFields = applicationSubmitted === false && reasonStatus === "GI - Currently DQ";
  const statusReasonRequired = showStatusReasonDropdown && reasons.length > 0;
  const submittedMissingFields = [
    !agentWhoTookCall ? "Agent who took the call" : "",
    !licensedAgentAccount ? "Licensed Agent Account" : "",
    !carrier ? "Carrier" : "",
    !productType ? "Product Type" : "",
    !draftDate ? "Draft Date" : "",
    !monthlyPremium ? "Monthly Premium" : "",
    !coverageAmount ? "Coverage Amount" : "",
    sentToUnderwriting === null ? "Sent to Underwriting" : "",
  ].filter(Boolean);
  const notSubmittedMissingFields = [
    !agentWhoTookCall ? "Agent who took the call" : "",
    !status ? "Status/Stage" : "",
    statusReasonRequired && !statusReason ? "Reason" : "",
    requiresDraftDate && !newDraftDate ? "New Draft Date" : "",
    showCarrierAttemptedFields && !carrierAttempted1 ? "Carrier Attempted #1" : "",
    !notes.trim() ? "Notes" : "",
  ].filter(Boolean);
  const canSubmit =
    !!callSource &&
    applicationSubmitted !== null &&
    (applicationSubmitted === true ? submittedMissingFields.length === 0 : notSubmittedMissingFields.length === 0);

  useEffect(() => {
    let cancelled = false;
    const loadClaimAgents = async () => {
      setClaimAgentsLoading(true);
      try {
        const loaded = await fetchClaimAgents(supabase);
        if (cancelled) return;
        setClaimAgents({
          bufferAgents: loaded.bufferAgents,
          licensedAgents: loaded.licensedAgents,
        });
      } catch {
        if (cancelled) return;
        setClaimAgents({ bufferAgents: [], licensedAgents: [] });
      } finally {
        if (!cancelled) setClaimAgentsLoading(false);
      }
    };
    void loadClaimAgents();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    const loadTransferPipelineStages = async () => {
      setTransferStagesLoading(true);
      try {
        const { data: pipelineRow, error: pipelineError } = await supabase
          .from("pipelines")
          .select("id")
          .eq("name", "Transfer Portal")
          .maybeSingle();
        if (pipelineError || !pipelineRow?.id) {
          if (!cancelled) setTransferPipelineStages([]);
          return;
        }

        const { data: stageRows, error: stageError } = await supabase
          .from("pipeline_stages")
          .select("name")
          .eq("pipeline_id", pipelineRow.id)
          .order("created_at", { ascending: true });
        if (stageError) {
          if (!cancelled) setTransferPipelineStages([]);
          return;
        }

        const names = Array.from(
          new Set(
            (stageRows || [])
              .map((row) => String((row as { name?: string | null }).name || "").trim())
              .filter(Boolean),
          ),
        );
        if (!cancelled) setTransferPipelineStages(names);
      } finally {
        if (!cancelled) setTransferStagesLoading(false);
      }
    };
    void loadTransferPipelineStages();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    const loadExisting = async () => {
      setHydrating(true);
      try {
        const { data: existing } = await supabase
          .from("call_results")
          .select("*")
          .eq("submission_id", submissionId)
          .maybeSingle();

        if (!existing || cancelled) return;

        setApplicationSubmitted(
          existing.application_submitted === null || typeof existing.application_submitted === "undefined"
            ? null
            : Boolean(existing.application_submitted),
        );
        setCallSource(String(existing.call_source || ""));
        setStatus(String(existing.status || existing.call_status || ""));
        setStatusReason(String(existing.dq_reason || ""));
        setNotes(String(existing.notes || ""));
        setNewDraftDate(String(existing.new_draft_date || ""));
        setBufferAgent(String(existing.buffer_agent || ""));
        setAgentWhoTookCall(String(existing.agent_who_took_call || ""));
        setLicensedAgentAccount(String(existing.licensed_agent_account || ""));
        setCarrier(String(existing.carrier || ""));
        setProductType(String(existing.product_type || ""));
        setDraftDate(String(existing.draft_date || ""));
        setMonthlyPremium(existing.monthly_premium ? String(existing.monthly_premium) : "");
        setCoverageAmount(existing.coverage_amount ? String(existing.coverage_amount) : "");
        setSentToUnderwriting(
          existing.sent_to_underwriting === null || typeof existing.sent_to_underwriting === "undefined"
            ? null
            : Boolean(existing.sent_to_underwriting),
        );
        setIsRetentionCall(Boolean(existing.is_retention_call));
        setCarrierAttempted1(String(existing.carrier_attempted_1 || ""));
        setCarrierAttempted2(String(existing.carrier_attempted_2 || ""));
        setCarrierAttempted3(String(existing.carrier_attempted_3 || ""));
      } finally {
        if (!cancelled) setHydrating(false);
      }
    };
    void loadExisting();
    return () => {
      cancelled = true;
    };
  }, [submissionId, supabase]);

  useEffect(() => {
    if (reasonStatus === "Chargeback DQ") {
      setStatusReason("Chargeback DQ");
      setNotes(getNoteText(reasonStatus, "Chargeback DQ", leadName || "[Client Name]"));
      return;
    }
    if (reasonStatus === "GI - Currently DQ") {
      setCarrierAttempted1("");
      setCarrierAttempted2("");
      setCarrierAttempted3("");
      setStatusReason("");
      setNotes("");
      return;
    }
    if (reasonStatus === "Fulfilled carrier requirements") {
      setStatusReason("");
      setNotes("");
      return;
    }
    setStatusReason("");
    setNotes("");
  }, [reasonStatus, leadName]);

  useEffect(() => {
    if (reasonStatus === "GI - Currently DQ" && carrierAttempted1) {
      const carriers = [carrierAttempted1];
      if (carrierAttempted2) carriers.push(carrierAttempted2);
      if (carrierAttempted3) carriers.push(carrierAttempted3);
      const carrierText = carriers.join(", ");
      setNotes(`${leadName || "[Client Name]"} has been declined through ${carrierText} and only qualifies for a GI policy. They are currently DQ'd`);
    }
  }, [reasonStatus, carrierAttempted1, carrierAttempted2, carrierAttempted3, leadName]);

  useEffect(() => {
    if (reasonStatus === "Updated Banking/draft date" && statusReason) {
      setNotes(getNoteText(reasonStatus, statusReason, leadName || "[Client Name]", newDraftDate));
    }
  }, [reasonStatus, statusReason, newDraftDate, leadName]);

  const handleStatusReasonChange = (reason: string) => {
    setStatusReason(reason);
    if (!reason) return;
    if (reason === "Other") {
      setNotes("");
      return;
    }
    if (reasonStatus === "Fulfilled carrier requirements") {
      setNotes("");
      return;
    }
    setNotes(getNoteText(reasonStatus, reason, leadName || "[Client Name]", newDraftDate));
  };

  const invokeOptionalFunction = async (functionName: string, body: Record<string, unknown>) => {
    const { error } = await supabase.functions.invoke(functionName, { body });
    if (!error) return;
    const err = String(error.message || "").toLowerCase();
    if (err.includes("not found") || err.includes("does not exist") || err.includes("404")) return;
    throw error;
  };

  const save = async () => {
    if (applicationSubmitted === null) {
      setToast({ message: "Select whether application was submitted.", type: "error" });
      return;
    }
    if (!callSource) {
      setToast({ message: "Call source is required.", type: "error" });
      return;
    }
    if (applicationSubmitted === false && notSubmittedMissingFields.length > 0) {
      setToast({ message: `Missing fields: ${notSubmittedMissingFields.join(", ")}`, type: "error" });
      return;
    }
    if (applicationSubmitted === true) {
      if (submittedMissingFields.length > 0) {
        setToast({ message: `Missing fields: ${submittedMissingFields.join(", ")}`, type: "error" });
        return;
      }
    }

    setLoading(true);
    setToast(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id || null;
      const finalStatus =
        applicationSubmitted === true
          ? sentToUnderwriting === true
            ? "Underwriting"
            : "Pending Approval"
          : status;

      const payload: Record<string, unknown> = {
        submission_id: submissionId,
        lead_id: leadRowId,
        application_submitted: applicationSubmitted,
        call_source: callSource,
        status: finalStatus,
        dq_reason: showStatusReasonDropdown ? statusReason || null : null,
        notes: notes || null,
        new_draft_date: requiresDraftDate ? newDraftDate || null : null,
        buffer_agent: bufferAgent || null,
        agent_who_took_call: agentWhoTookCall || null,
        licensed_agent_account: licensedAgentAccount || null,
        carrier: carrier || null,
        product_type: productType || null,
        draft_date: draftDate || null,
        monthly_premium: monthlyPremium ? Number(monthlyPremium) : null,
        coverage_amount: coverageAmount ? Number(coverageAmount) : null,
        face_amount: coverageAmount ? Number(coverageAmount) : null,
        sent_to_underwriting: sentToUnderwriting,
        is_retention_call: isRetentionCall,
        is_callback: submissionId.startsWith("CB") || submissionId.startsWith("CBB"),
        carrier_attempted_1: showCarrierAttemptedFields ? carrierAttempted1 || null : null,
        carrier_attempted_2: showCarrierAttemptedFields ? carrierAttempted2 || null : null,
        carrier_attempted_3: showCarrierAttemptedFields ? carrierAttempted3 || null : null,
        user_id: userId,
        updated_at: new Date().toISOString(),
      };

      // No unique constraint on submission_id in your current schema, so we do update-or-insert manually.
      const writePayload: Record<string, unknown> = { ...payload };
      for (let attempt = 0; attempt < 8; attempt++) {
        const { data: existingRow, error: existingError } = await supabase
          .from("call_results")
          .select("id")
          .eq("submission_id", submissionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existingError) throw existingError;

        const writeAction = existingRow?.id
          ? supabase.from("call_results").update(writePayload).eq("id", existingRow.id)
          : supabase.from("call_results").insert(writePayload);

        const { error: writeError } = await writeAction;
        if (!writeError) break;
        if (!isSchemaColumnError(writeError)) throw writeError;

        const missingColumn = getMissingColumnFromError(writeError);
        if (!missingColumn || !(missingColumn in writePayload)) {
          // Last-resort fallback with guaranteed baseline columns.
          const fallbackPayload = {
            submission_id: submissionId,
            lead_id: leadRowId,
            status: finalStatus,
            dq_reason: showStatusReasonDropdown ? statusReason || null : null,
            notes: notes || null,
            new_draft_date: requiresDraftDate ? newDraftDate || null : null,
            updated_at: new Date().toISOString(),
          };
          const fallbackAction = existingRow?.id
            ? supabase.from("call_results").update(fallbackPayload).eq("id", existingRow.id)
            : supabase.from("call_results").insert(fallbackPayload);
          const { error: fallbackError } = await fallbackAction;
          if (fallbackError) throw fallbackError;
          break;
        }

        delete writePayload[missingColumn];
        if (attempt === 7) throw writeError;
      }

      const leadStageName = mapDispositionToLeadStageName(applicationSubmitted, status);
      const { data: tpPipeline } = await supabase.from("pipelines").select("id").eq("name", "Transfer Portal").maybeSingle();
      let resolvedPipelineId: number | null = null;
      let resolvedStageId: number | null = null;
      if (tpPipeline?.id) {
        resolvedPipelineId = Number(tpPipeline.id);
        const { data: stageRow } = await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("pipeline_id", tpPipeline.id)
          .eq("name", leadStageName)
          .maybeSingle();
        resolvedStageId = stageRow?.id ? Number(stageRow.id) : null;
      }

      const leadUpdate: Record<string, unknown> = {
        stage: leadStageName,
        updated_at: new Date().toISOString(),
      };
      if (resolvedPipelineId) leadUpdate.pipeline_id = resolvedPipelineId;
      if (resolvedStageId) leadUpdate.stage_id = resolvedStageId;
      if (carrier.trim()) leadUpdate.carrier = carrier.trim();
      if (productType.trim()) leadUpdate.product_type = productType.trim();
      if (monthlyPremium.trim()) leadUpdate.monthly_premium = monthlyPremium.trim();
      if (coverageAmount.trim()) leadUpdate.coverage_amount = coverageAmount.trim();
      if (draftDate.trim()) leadUpdate.draft_date = draftDate.trim();

      const { error: leadUpdateError } = await supabase.from("leads").update(leadUpdate).eq("id", leadRowId);
      if (leadUpdateError) {
        console.warn("Lead update after call result failed:", leadUpdateError.message);
      }

      let verifiedSyncWarning: string | null = null;
      try {
        await syncVerifiedFieldsToLead(supabase, leadRowId, submissionId, verificationSessionId);
      } catch (syncError) {
        verifiedSyncWarning = syncError instanceof Error ? syncError.message : String(syncError);
        console.warn("Verified fields sync to lead failed:", verifiedSyncWarning);
      }

      const { error: logError } = await supabase.from("call_update_logs").insert({
        submission_id: submissionId,
        lead_id: leadRowId,
        event_type: "call_result_updated",
        event_details: {
          application_submitted: applicationSubmitted,
          call_source: callSource,
          status: finalStatus,
          reason: showStatusReasonDropdown ? statusReason || null : null,
          notes: notes || null,
          newDraftDate: requiresDraftDate ? newDraftDate || null : null,
          sent_to_underwriting: sentToUnderwriting,
          mapped_status:
            applicationSubmitted === false ? finalStatus : mapStatusToSheetValue(finalStatus),
        },
        agent_id: userId,
      });
      if (logError) console.warn("call_update_logs insert failed:", logError.message);

      await invokeOptionalFunction("update-daily-deal-flow-entry", {
        submission_id: submissionId,
        insured_name: leadName || null,
        client_phone_number: leadPhone || null,
        lead_vendor: leadVendor || null,
        call_source: callSource,
        buffer_agent: bufferAgent || null,
        agent: agentWhoTookCall || null,
        licensed_agent_account: licensedAgentAccount || null,
        status: finalStatus,
        application_submitted: applicationSubmitted,
        sent_to_underwriting: sentToUnderwriting,
        call_result:
          applicationSubmitted === true
            ? sentToUnderwriting === true
              ? "Underwriting"
              : "Pending Approval"
            : finalStatus,
        carrier: carrier || null,
        product_type: productType || null,
        draft_date: draftDate || null,
        monthly_premium: monthlyPremium ? Number(monthlyPremium) : null,
        face_amount: coverageAmount ? Number(coverageAmount) : null,
        notes: notes || null,
        from_callback: callSource === "Agent Callback",
        is_callback: submissionId.startsWith("CB") || submissionId.startsWith("CBB"),
      });

      if (applicationSubmitted === true) {
        await invokeOptionalFunction("slack-notification", {
          channel: "#test-bpo",
          submissionId,
          leadData: { customer_full_name: leadName },
          callResult: {
            application_submitted: true,
            status: finalStatus,
            call_source: callSource,
            buffer_agent: bufferAgent || null,
            agent_who_took_call: agentWhoTookCall || null,
            licensed_agent_account: licensedAgentAccount || null,
            carrier: carrier || null,
            product_type: productType || null,
            draft_date: draftDate || null,
            monthly_premium: monthlyPremium ? Number(monthlyPremium) : null,
            face_amount: coverageAmount ? Number(coverageAmount) : null,
            sent_to_underwriting: sentToUnderwriting,
            dq_reason: showStatusReasonDropdown ? statusReason || null : null,
            notes: notes || null,
          },
        });
      }

      setToast({
        message: verifiedSyncWarning
          ? `Call result saved, but verified fields were not synced to lead: ${verifiedSyncWarning}`
          : "Call result update saved.",
        type: verifiedSyncWarning ? "error" : "success",
      });
      setTimeout(() => {
        router.back();
      }, 700);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to save call result data.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  if (hydrating) {
    return (
      <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 18, boxShadow: T.shadowSm, padding: 18 }}>
        <p style={{ margin: 0, color: T.textMid, fontWeight: 700 }}>Loading call result data...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: `1.5px solid ${T.border}`,
        borderRadius: 18,
        boxShadow: T.shadowSm,
        padding: 18,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 18, color: T.textDark, fontWeight: 800 }}>Update Call Result</h3>
      <p style={{ marginTop: 6, marginBottom: 14, fontSize: 12, color: T.textMuted }}>
        Agent Portal parity form for transfer lead disposition and outcome tracking.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 16, color: T.textDark, fontWeight: 800, marginBottom: 2 }}>Was the application submitted?</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setApplicationSubmitted(true)}
            style={{
              border: `1.5px solid ${applicationSubmitted === true ? T.blue : T.border}`,
              backgroundColor: applicationSubmitted === true ? T.blueFaint : "#fff",
              color: applicationSubmitted === true ? T.blue : T.textDark,
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Yes - Submitted
          </button>
          <button
            type="button"
            onClick={() => setApplicationSubmitted(false)}
            style={{
              border: `1.5px solid ${applicationSubmitted === false ? T.blue : T.border}`,
              backgroundColor: applicationSubmitted === false ? T.blueFaint : "#fff",
              color: applicationSubmitted === false ? T.blue : T.textDark,
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            No - Not Submitted
          </button>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/${role}/retention-flow?leadRowId=${leadRowId}`)}
            style={{
              border: `1.5px solid ${T.blue}`,
              backgroundColor: "#fff",
              color: T.blue,
              borderRadius: 8,
              padding: "8px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            App Fix
          </button>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
            Call Source *
          </label>
          <AppSelect
            value={callSource}
            onChange={(e) => setCallSource(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${!callSource ? "#fca5a5" : T.border}` }}
          >
            <option value="">Select call source (required)</option>
            <option value="BPO Transfer">BPO Transfer</option>
            <option value="Agent Callback">Agent Callback</option>
          </AppSelect>
          {!callSource && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Call source is required</p>
          )}
        </div>

        {showSubmittedFields && (
          <>
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, backgroundColor: "#f5f7fa" }}>
              <div style={{ fontSize: 16, color: T.textDark, fontWeight: 800, marginBottom: 10 }}>Call Information</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                    Buffer Agent
                  </label>
                  <AppSelect value={bufferAgent} onChange={(e) => setBufferAgent(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}` }} disabled={claimAgentsLoading}>
                    <option value="">
                      {claimAgentsLoading
                        ? "Loading buffer agents..."
                        : bufferAgentOptions.length > 0
                          ? "Select buffer agent"
                          : "No buffer agents found"}
                    </option>
                    {bufferAgentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </AppSelect>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                    Agent who took the call
                  </label>
                  <AppSelect value={agentWhoTookCall} onChange={(e) => setAgentWhoTookCall(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}` }} disabled={claimAgentsLoading}>
                    <option value="">
                      {claimAgentsLoading
                        ? "Loading licensed agents..."
                        : licensedAgentOptions.length > 0
                          ? "Select licensed agent"
                          : "No licensed agents found"}
                    </option>
                    {licensedAgentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </AppSelect>
                  {!agentWhoTookCall && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Agent who took the call is required</p>}
                </div>
              </div>
            </div>

            <div style={{ border: "1px solid #bbf7d0", borderRadius: 12, padding: 14, backgroundColor: "#f0fdf4" }}>
              <div style={{ fontSize: 16, color: "#166534", fontWeight: 800, marginBottom: 10 }}>
                Application Submitted Details <span style={{ color: "#dc2626" }}>* All fields required</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                  Licensed Agent Account *
                </label>
                <AppSelect value={licensedAgentAccount} onChange={(e) => setLicensedAgentAccount(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${!licensedAgentAccount ? "#fca5a5" : T.border}` }} disabled={claimAgentsLoading}>
                  <option value="">
                    {claimAgentsLoading
                      ? "Loading licensed accounts..."
                      : licensedAgentOptions.length > 0
                        ? "Select licensed account"
                        : "No licensed agents found"}
                  </option>
                  {licensedAgentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </AppSelect>
                {!licensedAgentAccount && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Licensed Agent Account is required</p>}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                  Carrier Name *
                </label>
                <AppSelect value={carrier} onChange={(e) => setCarrier(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${!carrier ? "#fca5a5" : T.border}` }}>
                  <option value="">Select carrier</option>
                  {carrierOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </AppSelect>
                {!carrier && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Carrier is required</p>}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                  Product Type *
                </label>
                <AppSelect
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  disabled={!carrier.trim() || loadingProducts}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1.5px solid ${!productType ? "#fca5a5" : T.border}`,
                    opacity: !carrier.trim() || loadingProducts ? 0.7 : 1,
                  }}
                >
                  <option value="">
                    {loadingProducts
                      ? "Loading product types..."
                      : !carrier.trim()
                        ? "Select carrier first"
                        : productsForCarrier.length === 0
                          ? "No products for this carrier"
                          : "Select product type"}
                  </option>
                  {productsForCarrier.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </AppSelect>
                {!productType && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Product Type is required</p>}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                  Draft Date *
                </label>
                <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${!draftDate ? "#fca5a5" : T.border}` }} />
                {!draftDate && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Draft Date is required</p>}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                  Monthly Premium *
                </label>
                <input type="number" value={monthlyPremium} onChange={(e) => setMonthlyPremium(e.target.value)} placeholder="0.00" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${!monthlyPremium ? "#fca5a5" : T.border}` }} />
                {!monthlyPremium && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Monthly Premium is required</p>}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                  Coverage Amount *
                </label>
                <input type="number" value={coverageAmount} onChange={(e) => setCoverageAmount(e.target.value)} placeholder="0.00" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${!coverageAmount ? "#fca5a5" : T.border}` }} />
                {!coverageAmount && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Coverage Amount is required</p>}
              </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>
                    Sent to Underwriting *
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setSentToUnderwriting(true)}
                      style={{ border: `1.5px solid ${sentToUnderwriting === true ? T.blue : T.border}`, backgroundColor: sentToUnderwriting === true ? T.blueFaint : "#fff", color: sentToUnderwriting === true ? T.blue : T.textDark, borderRadius: 8, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setSentToUnderwriting(false)}
                      style={{ border: `1.5px solid ${sentToUnderwriting === false ? T.blue : T.border}`, backgroundColor: sentToUnderwriting === false ? T.blueFaint : "#fff", color: sentToUnderwriting === false ? T.blue : T.textDark, borderRadius: 8, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
                    >
                      No
                    </button>
                  </div>
                  {sentToUnderwriting === null && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Sent to Underwriting is required</p>}
                </div>
              </div>
            </div>
          </>
        )}

        {showNotSubmittedFields && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                  Agent Who Took Call *
                </label>
                <AppSelect value={agentWhoTookCall} onChange={(e) => setAgentWhoTookCall(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${!agentWhoTookCall ? "#fca5a5" : T.border}` }} disabled={claimAgentsLoading}>
                  <option value="">
                    {claimAgentsLoading
                      ? "Loading licensed agents..."
                      : licensedAgentOptions.length > 0
                        ? "Select licensed agent"
                        : "No licensed agents found"}
                  </option>
                  {licensedAgentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </AppSelect>
                {!agentWhoTookCall && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Agent who took the call is required</p>}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                  Status / Stage *
                </label>
                <AppSelect
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                  }}
                  disabled={transferStagesLoading}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${!status ? "#fca5a5" : T.border}` }}
                >
                  <option value="">
                    {transferStagesLoading
                      ? "Loading stages..."
                      : statusOptions.length > 0
                        ? "Select stage"
                        : "No transfer stages configured"}
                  </option>
                  {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </AppSelect>
                {!status && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Status/Stage is required</p>}
              </div>
            </div>

            {showStatusReasonDropdown && reasons.length > 0 && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                  Reason
                </label>
                <AppSelect
                  value={statusReason}
                  onChange={(e) => handleStatusReasonChange(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}` }}
                >
                  <option value="">Select reason</option>
                  {reasons.map((option) => <option key={option} value={option}>{option}</option>)}
                </AppSelect>
                {!statusReason && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Reason is required</p>}
              </div>
            )}

            {requiresDraftDate && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                  New Draft Date
                </label>
                <input
                  type="date"
                  value={newDraftDate}
                  onChange={(e) => setNewDraftDate(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}` }}
                />
                {!newDraftDate && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>New Draft Date is required</p>}
              </div>
            )}

            {showCarrierAttemptedFields && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                    Carrier Attempted #1 *
                  </label>
                  <AppSelect value={carrierAttempted1} onChange={(e) => setCarrierAttempted1(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${!carrierAttempted1 ? "#fca5a5" : T.border}` }}>
                    <option value="">Select</option>
                    {carrierOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </AppSelect>
                  {!carrierAttempted1 && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Carrier Attempted #1 is required</p>}
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                    Carrier Attempted #2
                  </label>
                  <AppSelect value={carrierAttempted2} onChange={(e) => setCarrierAttempted2(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}` }}>
                    <option value="">Select</option>
                    {carrierOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </AppSelect>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                    Carrier Attempted #3
                  </label>
                  <AppSelect value={carrierAttempted3} onChange={(e) => setCarrierAttempted3(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}` }}>
                    <option value="">Select</option>
                    {carrierOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </AppSelect>
                </div>
              </div>
            )}
          </>
        )}

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
            Notes
          </label>
          <textarea
            rows={6}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1.5px solid ${T.border}`,
              resize: "vertical",
              fontFamily: T.font,
            }}
            placeholder={
              showStatusReasonDropdown && statusReason && statusReason !== "Other"
                ? "Note has been auto-populated. You can edit if needed."
                : showStatusReasonDropdown && statusReason === "Other"
                  ? "Please enter a custom message."
                  : "Why the call got dropped or application was not submitted? Please provide the reason (required)"
            }
          />
          {applicationSubmitted === false && showStatusReasonDropdown && statusReason && statusReason !== "Other" && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
              Note has been auto-populated based on selected reason. You can edit if needed.
            </p>
          )}
          {applicationSubmitted === false && showStatusReasonDropdown && statusReason === "Other" && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
              Please enter a custom message for this reason.
            </p>
          )}
          {applicationSubmitted === false && !notes.trim() && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Notes are required</p>
          )}
        </div>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: T.textDark, fontWeight: 700 }}>
          <input type="checkbox" checked={isRetentionCall} onChange={(e) => setIsRetentionCall(e.target.checked)} />
          Mark as retention call
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => void save()}
            disabled={loading || !canSubmit}
            style={{
              border: "none",
              backgroundColor: loading || !canSubmit ? T.border : T.blue,
              color: "#fff",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: loading || !canSubmit ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Saving..." : "Save Call Result"}
          </button>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
