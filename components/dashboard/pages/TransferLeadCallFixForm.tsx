"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Toast } from "@/components/ui";
import { useCarrierProductDropdowns } from "@/lib/useCarrierProductDropdowns";
import {
  defaultLicensedAgentIdForSession,
  fetchClaimAgents,
  syncVerifiedFieldsToLead,
  type AgentOption,
} from "./transferLeadParity";
import { LeadCard } from "./LeadCard";
import {
  getNoteText,
  getReasonStatusFromStage,
  REASON_MAP,
  REASON_STATUSES_WITH_DROPDOWN,
} from "./transferCallReasonMapping";
import { loadDispositionFlowForStage } from "@/lib/dispositionFlowLoad";
import type { DispositionFlowDefinition } from "@/lib/dispositionFlowTypes";
import TransferDispositionWizard, { type DispositionWizardPayload } from "./TransferDispositionWizard";
import { TransferStyledSelect, transferSelectLabelStyle } from "./TransferStyledSelect";

/** `pipeline_stages.name` for the Supabase-driven disposition wizard (see `disposition_flows`). */
const NEEDS_BPO_CALLBACK_STAGE = "Needs BPO Callback";
const INCOMPLETE_TRANSFER_STAGE = "Incomplete Transfer";
const RETURNED_TO_CENTER_DQ_STAGE = "Returned To Center - DQ";
const DQ_CANT_BE_SOLD_STAGE = "DQ'd Can't be sold";

/**
 * Transfer Portal stages that have a row in `stage_disposition_map` (call outcomes only).
 * Entry/routing stages such as Transfer API and Chargeback Fix API are pipeline positions, not dispositions.
 * @see sql/stage_disposition_map.sql
 */
const STAGES_WITH_DISPOSITION_MAP = new Set([
  "Needs BPO Callback",
  "DQ'd Can't be sold",
  "GI DQ",
  "Returned To Center - DQ",
  "Incomplete Transfer",
  "Fulfilled Carrier Requirement",
  "Pending Failed Payment Fix",
  "New Submission",
  "Chargeback DQ",
]);

type PersistedCallDisposition = {
  path: unknown;
  generated_note: string;
  manual_note: string;
  quick_disposition_tag: string | null;
};

type Props = {
  leadRowId: string;
  submissionId: string;
  verificationSessionId?: string | null;
  leadName: string;
  leadPhone?: string;
  leadVendor?: string;
  /** When set, empty “Agent who took the call” / “Licensed Agent Account” picklists default like TransferLeadClaimModal. */
  sessionUserId?: string | null;
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
  sessionUserId = null,
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
  /** Transfer Portal: `stageName` is persisted (pipeline_stages.name); `label` is disposition when mapped. */
  const [transferStageOptions, setTransferStageOptions] = useState<{ stageName: string; label: string }[]>([]);
  const [transferStagesLoading, setTransferStagesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [dispositionFlow, setDispositionFlow] = useState<DispositionFlowDefinition | null>(null);
  const [dispositionFlowLoading, setDispositionFlowLoading] = useState(false);
  const [dispositionPayload, setDispositionPayload] = useState<DispositionWizardPayload | null>(null);
  const [persistedDisposition, setPersistedDisposition] = useState<PersistedCallDisposition | null>(null);
  /** Skip the wizard's first empty payload so we do not wipe notes loaded from `call_results`. */
  const dispositionWizardBootRef = useRef(true);
  const { carriers, productsForCarrier, loadingProducts } = useCarrierProductDropdowns(supabase, {
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

  const statusOptions = useMemo(() => transferStageOptions, [transferStageOptions]);
  const reasonStatus = useMemo(() => getReasonStatusFromStage(status), [status]);
  const reasons = REASON_MAP[reasonStatus] || [];
  const dispositionWizardForCurrentStage =
    dispositionFlow !== null && dispositionFlow.pipeline_stage_name.trim() === status.trim();
  const showStructuredDisposition =
    applicationSubmitted === false && dispositionWizardForCurrentStage;
  /** Hide legacy Reason while a Supabase disposition flow is loading or active for this stage. */
  const hideReasonForDispositionWizard =
    applicationSubmitted === false &&
    !!status.trim() &&
    (dispositionFlowLoading ||
      (dispositionFlow !== null && dispositionFlow.pipeline_stage_name.trim() === status.trim()));
  const showSubmittedFields = applicationSubmitted === true;
  const showNotSubmittedFields = applicationSubmitted === false;
  const showStatusReasonDropdown =
    applicationSubmitted === false &&
    REASON_STATUSES_WITH_DROPDOWN.has(reasonStatus) &&
    !hideReasonForDispositionWizard;
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
  const dispositionNotesOk =
    showStructuredDisposition
      ? notes.trim().length > 0 && (!!dispositionPayload?.complete || persistedDisposition !== null)
      : notes.trim().length > 0;
  const notSubmittedMissingFields = [
    !agentWhoTookCall ? "Agent who took the call" : "",
    !status ? "Disposition" : "",
    statusReasonRequired && !statusReason ? "Reason" : "",
    requiresDraftDate && !newDraftDate ? "New Draft Date" : "",
    showCarrierAttemptedFields && !carrierAttempted1 ? "Carrier Attempted #1" : "",
    !dispositionNotesOk ? "Notes" : "",
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
    if (claimAgentsLoading || hydrating) return;
    const autoId = defaultLicensedAgentIdForSession(claimAgents.licensedAgents, sessionUserId);
    if (!autoId) return;
    const opt = claimAgents.licensedAgents.find((a) => a.id === autoId);
    const name = opt?.name?.trim();
    if (!name) return;
    setAgentWhoTookCall((prev) => (prev.trim() ? prev : name));
    setLicensedAgentAccount((prev) => (prev.trim() ? prev : name));
  }, [claimAgentsLoading, hydrating, claimAgents.licensedAgents, sessionUserId]);

  useEffect(() => {
    let cancelled = false;
    const loadTransferStagesWithDispositions = async () => {
      setTransferStagesLoading(true);
      try {
        const { data: mapRows, error: mapError } = await supabase
          .from("stage_disposition_map")
          .select("disposition, pipeline_stages(name, position)")
          .order("disposition", { ascending: true });
        if (mapError || !mapRows?.length) {
          if (!cancelled) setTransferStageOptions([]);
          return;
        }

        type MapRow = {
          disposition: string | null;
          pipeline_stages:
            | { name: string | null; position: number | null }
            | { name: string | null; position: number | null }[]
            | null;
        };
        const options = (mapRows as unknown as MapRow[])
          .map((row) => {
            const disposition = String(row.disposition || "").trim();
            const rawPs = row.pipeline_stages;
            const ps = Array.isArray(rawPs) ? rawPs[0] : rawPs;
            const stageName = String(ps?.name || "").trim();
            if (!disposition || !stageName) return null;
            const position = typeof ps?.position === "number" ? ps.position : 0;
            return { stageName, label: disposition, position };
          })
          .filter((x): x is { stageName: string; label: string; position: number } => x != null)
          .filter((x) => STAGES_WITH_DISPOSITION_MAP.has(x.stageName))
          .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label));

        if (!cancelled) {
          setTransferStageOptions(options.map(({ stageName, label }) => ({ stageName, label })));
        }
      } finally {
        if (!cancelled) setTransferStagesLoading(false);
      }
    };
    void loadTransferStagesWithDispositions();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  /** Drop pipeline-only values (e.g. "Transfer API") and stale values not in the disposition map list. */
  useEffect(() => {
    if (hydrating) return;
    if (!status) return;
    if (!STAGES_WITH_DISPOSITION_MAP.has(status)) {
      setStatus("");
      return;
    }
    if (transferStagesLoading || transferStageOptions.length === 0) return;
    if (!transferStageOptions.some((o) => o.stageName === status)) {
      setStatus("");
    }
  }, [hydrating, status, transferStagesLoading, transferStageOptions]);

  useEffect(() => {
    let cancelled = false;
    if (applicationSubmitted !== false || !status.trim()) {
      setDispositionFlow(null);
      setDispositionFlowLoading(false);
      return;
    }
    dispositionWizardBootRef.current = true;
    setDispositionPayload(null);
    setDispositionFlow(null);
    setDispositionFlowLoading(true);
    void loadDispositionFlowForStage(supabase, status).then((flow) => {
      if (cancelled) return;
      setDispositionFlow(flow);
      setDispositionFlowLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [applicationSubmitted, status, supabase]);

  const handleDispositionPayloadChange = useCallback((p: DispositionWizardPayload) => {
    setDispositionPayload(p);
    if (p.complete) {
      setNotes(p.final_note);
      dispositionWizardBootRef.current = false;
      return;
    }
    if (p.path.length === 0) {
      if (dispositionWizardBootRef.current) {
        dispositionWizardBootRef.current = false;
        return;
      }
      // Do not clear Notes when the wizard resets (Clear / step back): agents often add to Notes after
      // "Apply"; wiping here forced retyping from scratch.
      return;
    }
    dispositionWizardBootRef.current = false;
  }, []);

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

        const dp = (existing as { disposition_path?: unknown }).disposition_path;
        const pathArr = Array.isArray(dp) ? dp : null;
        const qtag = (existing as { quick_disposition_tag?: string | null }).quick_disposition_tag;
        const gen = (existing as { generated_note?: string | null }).generated_note;
        const man = (existing as { manual_note?: string | null }).manual_note;
        const hasPersisted =
          (pathArr && pathArr.length > 0) ||
          !!(qtag && String(qtag).trim()) ||
          !!(gen && String(gen).trim());
        if (hasPersisted) {
          setPersistedDisposition({
            path: pathArr ?? [],
            generated_note: String(gen || ""),
            manual_note: String(man || ""),
            quick_disposition_tag: qtag ? String(qtag) : null,
          });
        } else {
          setPersistedDisposition(null);
        }
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
    if (
      status === NEEDS_BPO_CALLBACK_STAGE ||
      status === INCOMPLETE_TRANSFER_STAGE ||
      status === RETURNED_TO_CENTER_DQ_STAGE ||
      status === DQ_CANT_BE_SOLD_STAGE
    ) {
      setStatusReason("");
      return;
    }
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
  }, [reasonStatus, leadName, status]);

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

      const dispositionCallFields: Record<string, unknown> = showStructuredDisposition
        ? dispositionPayload?.complete
          ? {
              disposition_path: dispositionPayload.path,
              generated_note: dispositionPayload.generated_note || null,
              manual_note: dispositionPayload.manual_note || null,
              quick_disposition_tag: dispositionPayload.quick_tag_label,
            }
          : persistedDisposition
            ? {
                disposition_path: persistedDisposition.path,
                generated_note: persistedDisposition.generated_note || null,
                manual_note: persistedDisposition.manual_note || null,
                quick_disposition_tag: persistedDisposition.quick_disposition_tag,
              }
            : {
                disposition_path: null,
                generated_note: null,
                manual_note: null,
                quick_disposition_tag: null,
              }
        : {
            disposition_path: null,
            generated_note: null,
            manual_note: null,
            quick_disposition_tag: null,
          };

      const autoGeneratedNotes =
        applicationSubmitted === true
          ? [
              licensedAgentAccount ? `Licensed agent account: ${licensedAgentAccount}` : null,
              carrier ? `Carrier: ${carrier}` : null,
              productType ? `Carrier product name and level: ${productType}` : null,
              monthlyPremium ? `Premium amount: $${Number(monthlyPremium).toLocaleString()}` : null,
              coverageAmount ? `Coverage amount: $${Number(coverageAmount).toLocaleString()}` : null,
              draftDate ? `Draft date: ${new Date(draftDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}` : null,
              `Sent to Underwriting: ${sentToUnderwriting === true ? "Yes" : "No"}`,
              "Commissions are paid after policy is officially approved and issued",
            ]
              .filter(Boolean)
              .join("\n")
          : null;

      const finalNotes = autoGeneratedNotes || notes || null;

      const payload: Record<string, unknown> = {
        submission_id: submissionId,
        lead_id: leadRowId,
        application_submitted: applicationSubmitted,
        call_source: callSource,
        status: finalStatus,
        dq_reason: showStatusReasonDropdown ? statusReason || null : null,
        notes: finalNotes,
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
        call_result:
          applicationSubmitted === true
            ? sentToUnderwriting === true
              ? "Underwriting"
              : "Submitted"
            : "Not Submitted",
        ...dispositionCallFields,
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

      if (applicationSubmitted === true) {
        const leadStageName = mapDispositionToLeadStageName(applicationSubmitted, status);
        const { data: tpPipeline } = await supabase
          .from("pipelines")
          .select("id")
          .eq("name", "Transfer Portal")
          .maybeSingle();
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

        const quickTagForLead =
          typeof dispositionCallFields.quick_disposition_tag === "string"
            ? dispositionCallFields.quick_disposition_tag.trim()
            : "";
        if (quickTagForLead) {
          const { data: tagRow, error: tagSelectError } = await supabase
            .from("leads")
            .select("tags")
            .eq("id", leadRowId)
            .maybeSingle();
          if (!tagSelectError && tagRow) {
            const cur = Array.isArray(tagRow.tags) ? (tagRow.tags as string[]) : [];
            if (!cur.includes(quickTagForLead)) {
              const { error: tagUpdateError } = await supabase
                .from("leads")
                .update({ tags: [...cur, quickTagForLead], updated_at: new Date().toISOString() })
                .eq("id", leadRowId);
              if (tagUpdateError) console.warn("Lead tags merge (quick disposition) failed:", tagUpdateError.message);
            }
          }
        }
      }

      const dispPayload = dispositionPayload;
      const shouldInsertDispositionEvent =
        showStructuredDisposition &&
        dispositionFlow &&
        dispPayload?.complete &&
        JSON.stringify(dispPayload.path) !== JSON.stringify(persistedDisposition?.path ?? []);
      if (shouldInsertDispositionEvent && dispPayload) {
        const { error: dispEvError } = await supabase.from("disposition_events").insert({
          submission_id: submissionId,
          lead_id: leadRowId,
          flow_key: dispositionFlow.flow_key,
          path_json: dispPayload.path,
          generated_note: dispPayload.generated_note || null,
          manual_note: dispPayload.manual_note || null,
          final_note: dispPayload.final_note || null,
          quick_tag_label: dispPayload.quick_tag_label,
          created_by: userId,
        });
        if (dispEvError) console.warn("disposition_events insert failed:", dispEvError.message);
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
        call_result:
          applicationSubmitted === true
            ? sentToUnderwriting === true
              ? "Underwriting"
              : "Submitted"
            : "Not Submitted",
        carrier: carrier || null,
        product_type: productType || null,
        draft_date: draftDate || null,
        monthly_premium: monthlyPremium ? Number(monthlyPremium) : null,
        face_amount: coverageAmount ? Number(coverageAmount) : null,
        notes: notes || null,
        from_callback: callSource === "Agent Callback",
        is_callback: submissionId.startsWith("CB") || submissionId.startsWith("CBB"),
        is_retention_call: isRetentionCall,
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
    <>
      <LeadCard
        icon="📞"
        title="Update Call Result"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 16, color: T.textDark, fontWeight: 700, marginBottom: 2 }}>Was the application submitted?</div>
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
              fontWeight: 600,
              cursor: "pointer",
              outline: "none",
              transition: "all 0.15s ease-in-out",
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 2px rgba(99, 139, 75, 0.4)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
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
              fontWeight: 600,
              cursor: "pointer",
              outline: "none",
              transition: "all 0.15s ease-in-out",
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 2px rgba(99, 139, 75, 0.4)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            No - Not Submitted
          </button>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/${role}/retention-flow?leadRowId=${leadRowId}`)}
            aria-label="Open app fix flow"
            style={{
              border: `1.5px solid ${T.blue}`,
              backgroundColor: "#fff",
              color: T.blue,
              borderRadius: 8,
              padding: "8px 14px",
              fontWeight: 600,
              cursor: "pointer",
              outline: "none",
              transition: "all 0.15s ease-in-out",
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 2px rgba(99, 139, 75, 0.4)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            App Fix
          </button>
        </div>

        <div>
          <label style={transferSelectLabelStyle}>
            Call Source *
          </label>
          <TransferStyledSelect
            value={callSource}
            onValueChange={setCallSource}
            error={!callSource}
            placeholder="Select call source (required)"
            options={[
              { value: "BPO Transfer", label: "BPO Transfer" },
              { value: "Agent Callback", label: "Agent Callback" },
            ]}
          />
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
                  <label style={transferSelectLabelStyle}>
                    Buffer Agent
                  </label>
                  <TransferStyledSelect
                    value={bufferAgent}
                    onValueChange={setBufferAgent}
                    disabled={claimAgentsLoading || bufferAgentOptions.length === 0}
                    placeholder={
                      claimAgentsLoading
                        ? "Loading buffer agents..."
                        : bufferAgentOptions.length > 0
                          ? "Select buffer agent"
                          : "No buffer agents found"
                    }
                    options={bufferAgentOptions.map((option) => ({ value: option, label: option }))}
                  />
                </div>

                <div>
                  <label style={transferSelectLabelStyle}>
                    Agent who took the call
                  </label>
                  <TransferStyledSelect
                    value={agentWhoTookCall}
                    onValueChange={setAgentWhoTookCall}
                    disabled={claimAgentsLoading || licensedAgentOptions.length === 0}
                    placeholder={
                      claimAgentsLoading
                        ? "Loading licensed agents..."
                        : licensedAgentOptions.length > 0
                          ? "Select licensed agent"
                          : "No licensed agents found"
                    }
                    options={licensedAgentOptions.map((option) => ({ value: option, label: option }))}
                  />
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
                <label style={transferSelectLabelStyle}>
                  Licensed Agent Account *
                </label>
                <TransferStyledSelect
                  value={licensedAgentAccount}
                  onValueChange={setLicensedAgentAccount}
                  error={!licensedAgentAccount}
                  disabled={claimAgentsLoading || licensedAgentOptions.length === 0}
                  placeholder={
                    claimAgentsLoading
                      ? "Loading licensed accounts..."
                      : licensedAgentOptions.length > 0
                        ? "Select licensed account"
                        : "No licensed agents found"
                  }
                  options={licensedAgentOptions.map((option) => ({ value: option, label: option }))}
                />
                {!licensedAgentAccount && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Licensed Agent Account is required</p>}
              </div>

              <div>
                <label style={transferSelectLabelStyle}>
                  Carrier Name *
                </label>
                <TransferStyledSelect
                  value={carrier}
                  onValueChange={setCarrier}
                  error={!carrier}
                  placeholder="Select carrier"
                  options={carrierOptions.map((option) => ({ value: option, label: option }))}
                />
                {!carrier && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Carrier is required</p>}
              </div>

              <div>
                <label style={transferSelectLabelStyle}>
                  Product Type *
                </label>
                <TransferStyledSelect
                  value={productType}
                  onValueChange={setProductType}
                  disabled={!carrier.trim() || loadingProducts || productsForCarrier.length === 0}
                  error={!productType}
                  placeholder={
                    loadingProducts
                      ? "Loading product types..."
                      : !carrier.trim()
                        ? "Select carrier first"
                        : productsForCarrier.length === 0
                          ? "No products for this carrier"
                          : "Select product type"
                  }
                  options={productsForCarrier.map((option) => ({ value: option.name, label: option.name }))}
                />
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
                      style={{ border: `1.5px solid ${sentToUnderwriting === true ? T.blue : T.border}`, backgroundColor: sentToUnderwriting === true ? T.blueFaint : "#fff", color: sentToUnderwriting === true ? T.blue : T.textDark, borderRadius: 8, padding: "8px 12px", fontWeight: 600, cursor: "pointer", outline: "none", transition: "all 0.15s ease-in-out" }}
                      onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 2px rgba(99, 139, 75, 0.4)"; }}
                      onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setSentToUnderwriting(false)}
                      style={{ border: `1.5px solid ${sentToUnderwriting === false ? T.blue : T.border}`, backgroundColor: sentToUnderwriting === false ? T.blueFaint : "#fff", color: sentToUnderwriting === false ? T.blue : T.textDark, borderRadius: 8, padding: "8px 12px", fontWeight: 600, cursor: "pointer", outline: "none", transition: "all 0.15s ease-in-out" }}
                      onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 2px rgba(99, 139, 75, 0.4)"; }}
                      onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
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
                <label style={transferSelectLabelStyle}>
                  Agent Who Took Call *
                </label>
                <TransferStyledSelect
                  value={agentWhoTookCall}
                  onValueChange={setAgentWhoTookCall}
                  error={!agentWhoTookCall}
                  disabled={claimAgentsLoading || licensedAgentOptions.length === 0}
                  placeholder={
                    claimAgentsLoading
                      ? "Loading licensed agents..."
                      : licensedAgentOptions.length > 0
                        ? "Select licensed agent"
                        : "No licensed agents found"
                  }
                  options={licensedAgentOptions.map((option) => ({ value: option, label: option }))}
                />
                {!agentWhoTookCall && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Agent who took the call is required</p>}
              </div>

              <div>
                <label style={transferSelectLabelStyle}>
                  Disposition *
                </label>
                <TransferStyledSelect
                  value={status}
                  onValueChange={setStatus}
                  disabled={transferStagesLoading || statusOptions.length === 0}
                  error={!status}
                  placeholder={
                    transferStagesLoading
                      ? "Loading dispositions..."
                      : statusOptions.length > 0
                        ? "Select disposition"
                        : "No transfer stages configured"
                  }
                  options={statusOptions.map((opt) => ({ value: opt.stageName, label: opt.label }))}
                />
                {!status && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Disposition is required</p>}
              </div>
            </div>

            {showStatusReasonDropdown && reasons.length > 0 && (
              <div>
                <label style={transferSelectLabelStyle}>
                  Reason
                </label>
                <TransferStyledSelect
                  value={statusReason}
                  onValueChange={handleStatusReasonChange}
                  error={!statusReason}
                  placeholder="Select reason"
                  options={reasons.map((option) => ({ value: option, label: option }))}
                />
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
                  <label style={transferSelectLabelStyle}>
                    Carrier Attempted #1 *
                  </label>
                  <TransferStyledSelect
                    value={carrierAttempted1}
                    onValueChange={setCarrierAttempted1}
                    error={!carrierAttempted1}
                    placeholder="Select"
                    options={carrierOptions.map((option) => ({ value: option, label: option }))}
                  />
                  {!carrierAttempted1 && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>Carrier Attempted #1 is required</p>}
                </div>
                <div>
                  <label style={transferSelectLabelStyle}>
                    Carrier Attempted #2
                  </label>
                  <TransferStyledSelect
                    value={carrierAttempted2}
                    onValueChange={setCarrierAttempted2}
                    placeholder="Select"
                    options={carrierOptions.map((option) => ({ value: option, label: option }))}
                  />
                </div>
                <div>
                  <label style={transferSelectLabelStyle}>
                    Carrier Attempted #3
                  </label>
                  <TransferStyledSelect
                    value={carrierAttempted3}
                    onValueChange={setCarrierAttempted3}
                    placeholder="Select"
                    options={carrierOptions.map((option) => ({ value: option, label: option }))}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {applicationSubmitted === false && !!status.trim() && dispositionFlowLoading && (
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.textMuted }}>Loading disposition wizard…</p>
        )}

        {showStructuredDisposition && dispositionFlow && (
          <TransferDispositionWizard
            key={dispositionFlow.flow_key}
            flow={dispositionFlow}
            clientName={leadName || "[Client Name]"}
            carrierOptions={carrierOptions}
            onPayloadChange={handleDispositionPayloadChange}
          />
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
              showStructuredDisposition
                ? "Notes update when you finish the disposition steps above. Edit or add to this text anytime — it stays when you use Clear on the wizard."
                : showStatusReasonDropdown && statusReason && statusReason !== "Other"
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
          {applicationSubmitted === false && showStructuredDisposition && notes.trim().length > 0 && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
              This field is fully editable. Add context here even after applying the disposition above.
            </p>
          )}
          {applicationSubmitted === false && !dispositionNotesOk && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>
              {showStructuredDisposition
                ? "Complete the disposition wizard (or load an existing saved disposition) and ensure notes are filled in."
                : "Notes are required"}
            </p>
          )}
        </div>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: T.textDark, fontWeight: 600 }}>
          <input 
            type="checkbox" 
            checked={isRetentionCall} 
            onChange={(e) => setIsRetentionCall(e.target.checked)}
          />
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
              fontWeight: 600,
              cursor: loading || !canSubmit ? "not-allowed" : "pointer",
              outline: "none",
              transition: "all 0.15s ease-in-out",
            }}
            onFocus={(e) => {
              if (!loading && canSubmit) {
                e.currentTarget.style.boxShadow = "0 0 0 2px rgba(99, 139, 75, 0.4)";
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {loading ? "Saving..." : "Save Call Result"}
          </button>
        </div>
      </div>
      </LeadCard>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
