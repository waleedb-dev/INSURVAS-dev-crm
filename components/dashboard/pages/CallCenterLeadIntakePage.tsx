"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { ActionMenu, DataGrid, FilterChip, Pagination, Table, Toast, EmptyState } from "@/components/ui";
import TransferLeadApplicationForm, { type TransferLeadFormData } from "./TransferLeadApplicationForm";
import LeadViewComponent from "./LeadViewComponent";
import TransferLeadClaimModal from "./TransferLeadClaimModal";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentUserPrimaryRole } from "@/lib/auth/user-role";
import { useParams, useRouter } from "next/navigation";
import {
  applyClaimSelectionToSession,
  fetchClaimAgents,
  findOrCreateVerificationSession,
  type ClaimLeadContext,
  type ClaimSelections,
} from "./transferLeadParity";

type IntakeLead = {
  rowId: string;
  id: string;
  submissionId: string | null;
  name: string;
  phone: string;
  premium: number;
  type: string;
  source: string;
  centerName: string;
  pipeline: string;
  stage: string;
  createdBy: string;
  createdAt: string;
  isDraft?: boolean;
};

type DuplicateLeadMatch = {
  id: string;
  lead_unique_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  stage: string | null;
  created_at?: string | null;
};

const FIXED_BPO_LEAD_SOURCE = "BPO Transfer Lead Source";

/** BPO name for Slack vendor channel mapping (must match `leadVendorChannelMapping` keys in `slack-notification`). */
const TRANSFER_PORTAL_LEAD_VENDOR = "Ascendra BPO";

/** Must match deployed Edge Function name: `slack-notification` */
const SLACK_NOTIFICATION_EDGE_FUNCTION = "slack-notification" as const;

type SsnDuplicateRule = {
  stage_name: string;
  ghl_stage: string | null;
  message: string;
  is_addable: boolean;
  is_active: boolean;
};

// ── Color maps matching the DailyDealFlow style ─────────────────────────────
const TYPE_CONFIG: Record<string, { bg: string; color: string }> = {
  "Preferred":  { bg: "#eff6ff", color: "#2563eb" },
  "Standard":   { bg: "#f0fdf4", color: "#16a34a" },
  "Graded":     { bg: "#fdf4ff", color: "#9333ea" },
  "Modified":   { bg: "#fff7ed", color: "#ea580c" },
  "GI":         { bg: "#fef9c3", color: "#ca8a04" },
  "Immediate":  { bg: "#fdf4ff", color: "#d946ef" },
  "Level":      { bg: "#f0fdf4", color: "#059669" },
  "ROP":        { bg: "#f8fafc", color: "#475569" },
  "Transfer":   { bg: "#eff6ff", color: "#2563eb" },
};

const getTypeConfig = (type: string) =>
  TYPE_CONFIG[type] ?? { bg: T.blueFaint, color: T.blue };

// Generate a consistent avatar color from a string
function stringToColor(str: string) {
  const colors = [T.blue, "#ec4899", "#8b5cf6", "#0ea5e9", "#f59e0b", "#f97316", "#14b8a6", "#64748b"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function buildLeadUniqueId(payload: TransferLeadFormData): string {
  const phoneDigits = String(payload.phone || "").replace(/\D/g, "");
  const ph2 = phoneDigits.slice(0, 2).padEnd(2, "0");

  const carrierLetters = String(payload.carrier || "").replace(/[^A-Za-z]/g, "");
  const car2 = carrierLetters.slice(0, 2).padEnd(2, "X");

  const fn1 = String(payload.firstName || "").trim().charAt(0) || "X";
  const ln1 = String(payload.lastName || "").trim().charAt(0) || "X";

  const ssnDigits = String(payload.social || "").replace(/\D/g, "");
  const ss2 = ssnDigits.slice(0, 2).padEnd(2, "0");

  return `${ph2}${car2}${fn1}${ln1}${ss2}`.toUpperCase();
}

function buildSubmissionId(centerName: string): string {
  const words = String(centerName || "")
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);
  const centerCode = words.length >= 2
    ? `${words[0][0] ?? ""}${words[1][0] ?? ""}`
    : (words[0]?.slice(0, 2) ?? "NA");
  const ts = Date.now();
  const rand = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 8);
  return `${ts}-${rand}-${centerCode.toUpperCase()}`;
}

function normalizePhoneDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function formatUsPhone(digits: string) {
  if (digits.length !== 10) return digits;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

async function insertDailyDealFlowEntry(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  row: { leadId: string; leadUniqueId: string; leadName: string; centerName: string; callCenterId: string | null }
) {
  const { error } = await supabase.from("daily_deal_flow").insert({
    lead_id: row.leadId,
    lead_unique_id: row.leadUniqueId || null,
    lead_name: row.leadName,
    center_name: row.centerName || null,
    call_center_id: row.callCenterId,
  });
  if (error) console.warn("daily_deal_flow insert:", error.message);
}

async function notifySlackTransferPortalLead(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  params: {
    leadId: string;
    leadUniqueId: string;
    payload: TransferLeadFormData;
    callCenterName: string;
    authToken: string;
  }
) {
  const { leadId, leadUniqueId, payload, callCenterName, authToken } = params;
  try {
    const { error } = await supabase.functions.invoke(SLACK_NOTIFICATION_EDGE_FUNCTION, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: {
        event: "transfer_portal_lead_created",
        submissionId: leadId,
        lead_vendor: TRANSFER_PORTAL_LEAD_VENDOR,
        callCenterName: callCenterName.trim() || undefined,
        leadData: {
          customer_full_name: `${payload.firstName} ${payload.lastName}`.trim() || "Unnamed Lead",
          phone: payload.phone,
          carrier: payload.carrier,
          product_type: payload.productType,
          draft_date: payload.draftDate,
          monthly_premium: payload.monthlyPremium,
          coverage_amount: payload.coverageAmount,
          lead_unique_id: leadUniqueId,
        },
      },
    });
    if (error) console.warn("slack-notification:", error.message);
  } catch (e) {
    console.warn("slack-notification failed", e);
  }
}

export default function CallCenterLeadIntakePage({ canCreateLeads = true }: { canCreateLeads?: boolean }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const params = useParams<{ role?: string }>();
  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role || "agent";
  const [leads, setLeads] = useState<IntakeLead[]>([]);
  const [viewingLead, setViewingLead] = useState<{ id: string; name: string; rowUuid: string } | null>(null);
  const [editingLead, setEditingLead] = useState<{ rowId: string; formData: TransferLeadFormData } | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterSource, setFilterSource] = useState("All");
  const [page, setPage] = useState(1);
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [defaultTransferStageId, setDefaultTransferStageId] = useState<number | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingCreatePayload, setPendingCreatePayload] = useState<TransferLeadFormData | null>(null);
  const [duplicateLeadMatch, setDuplicateLeadMatch] = useState<DuplicateLeadMatch | null>(null);
  const [duplicateRuleMessage, setDuplicateRuleMessage] = useState<string>("");
  const [duplicateIsAddable, setDuplicateIsAddable] = useState<boolean>(true);
  const [callCenterName, setCallCenterName] = useState("");
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimModalLoading, setClaimModalLoading] = useState(false);
  const [claimLeadContext, setClaimLeadContext] = useState<ClaimLeadContext | null>(null);
  const [claimAgents, setClaimAgents] = useState<{
    bufferAgents: { id: string; name: string; roleKey: string }[];
    licensedAgents: { id: string; name: string; roleKey: string }[];
    retentionAgents: { id: string; name: string; roleKey: string }[];
  }>({ bufferAgents: [], licensedAgents: [], retentionAgents: [] });
  const [claimSelection, setClaimSelection] = useState<ClaimSelections>({
    workflowType: "buffer",
    bufferAgentId: null,
    licensedAgentId: null,
    retentionAgentId: null,
    isRetentionCall: false,
    retentionType: "",
    retentionNotes: "",
    quoteCarrier: "",
    quoteProduct: "",
    quoteCoverage: "",
    quoteMonthlyPremium: "",
  });
  const itemsPerPage = 10;

  useEffect(() => {
    let cancelled = false;
    const loadCallCenterName = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        if (!cancelled) setCallCenterName("");
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("call_centers(name)")
        .eq("id", session.user.id)
        .maybeSingle();
      const row = data as { call_centers?: { name?: string } | null } | null;
      const name = row?.call_centers?.name;
      if (!cancelled) setCallCenterName(typeof name === "string" ? name.trim() : "");
    };
    void loadCallCenterName();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const refreshLeads = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setLeads([]);
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("full_name, call_center_id")
      .eq("id", session.user.id)
      .maybeSingle();

    const role = await getCurrentUserPrimaryRole(supabase, session.user.id);

    const baseQuery = supabase
      .from("leads")
      .select("id, submission_id, lead_unique_id, first_name, last_name, phone, lead_value, product_type, lead_source, pipeline, stage, stage_id, call_center_id, created_at, is_draft, call_centers(name), users!submitted_by(full_name)")
      .order("created_at", { ascending: false });

    const query =
      role === "sales_manager" || role === "system_admin"
        ? baseQuery
        : role === "call_center_admin" && userProfile?.call_center_id
          ? baseQuery.eq("call_center_id", userProfile.call_center_id)
          : baseQuery.eq("submitted_by", session.user.id);

    const { data, error } = await query;

    if (error) {
      setToast({ message: error.message || "Failed to load leads", type: "error" });
      return;
    }

    const mapped: IntakeLead[] = (data || []).map((lead: Record<string, unknown>) => {
      const callCenterObj = lead.call_centers as { name?: unknown } | null | undefined;
      const userObj = lead.users as { full_name?: unknown } | null | undefined;
      const submissionIdRaw = lead.submission_id;

      return {
        rowId: typeof lead.id === "string" ? lead.id : String(lead.id ?? ""),
        submissionId: typeof submissionIdRaw === "string" && submissionIdRaw.trim() !== "" ? submissionIdRaw : null,
        id: typeof lead.lead_unique_id === "string" && lead.lead_unique_id.trim() !== "" ? lead.lead_unique_id : "N/A",
        name: `${typeof lead.first_name === "string" ? lead.first_name : ""} ${typeof lead.last_name === "string" ? lead.last_name : ""}`.trim() || "Unnamed Lead",
        phone: typeof lead.phone === "string" ? lead.phone : "",
        premium: Number(lead.lead_value) || 0,
        type: typeof lead.product_type === "string" && lead.product_type.trim() !== "" ? lead.product_type : "Transfer",
        source: typeof lead.lead_source === "string" && lead.lead_source.trim() !== "" ? lead.lead_source : "Unknown",
        centerName: typeof callCenterObj?.name === "string" && callCenterObj.name.trim() !== "" ? callCenterObj.name : "Unassigned",
        pipeline: typeof lead.pipeline === "string" && lead.pipeline.trim() !== "" ? lead.pipeline : "Transfer Portal",
        stage: typeof lead.stage === "string" && lead.stage.trim() !== "" ? lead.stage : "Transfer API",
        createdBy: typeof userObj?.full_name === "string" && userObj.full_name.trim() !== "" ? userObj.full_name.trim() : "Unknown",
        createdAt: lead.created_at ? new Date(String(lead.created_at)).toLocaleString() : "Just now",
        isDraft: typeof lead.is_draft === "boolean" ? lead.is_draft : false,
      };
    });

    setLeads(mapped);
  };

  const openClaimModalForLead = async (lead: IntakeLead) => {
    setClaimLeadContext({
      rowId: lead.rowId,
      leadUniqueId: lead.id,
      leadName: lead.name,
      phone: lead.phone,
      source: lead.source,
      submissionId: lead.submissionId,
    });
    setClaimSelection({
      workflowType: "buffer",
      bufferAgentId: null,
      licensedAgentId: null,
      retentionAgentId: null,
      isRetentionCall: false,
      retentionType: "",
      retentionNotes: "",
      quoteCarrier: "",
      quoteProduct: "",
      quoteCoverage: "",
      quoteMonthlyPremium: "",
    });
    setClaimModalOpen(true);
    try {
      const loaded = await fetchClaimAgents(supabase);
      setClaimAgents(loaded);
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Failed to load claim agents.",
        type: "error",
      });
    }
  };

  const handleClaimAndOpenLead = async () => {
    if (!claimLeadContext) return;
    setClaimModalLoading(true);
    try {
      const found = await findOrCreateVerificationSession(supabase, claimLeadContext, claimSelection);
      await applyClaimSelectionToSession(supabase, found.sessionId, found.submissionId, claimSelection);
      setClaimModalOpen(false);
      await refreshLeads();
      router.push(`/dashboard/${routeRole}/transfer-leads/${claimLeadContext.rowId}`);
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Failed to claim lead.",
        type: "error",
      });
    } finally {
      setClaimModalLoading(false);
    }
  };

  useEffect(() => {
    refreshLeads();
  }, [supabase]);

  useEffect(() => {
    const fetchDefaultTransferStage = async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id")
        .eq("name", "Transfer Portal")
        .maybeSingle();

      if (error || !data?.id) return;

      const { data: stageData, error: stageError } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("pipeline_id", data.id)
        .eq("name", "Transfer API")
        .maybeSingle();

      if (!stageError && stageData?.id) {
        setDefaultTransferStageId(stageData.id);
      }
    };

    void fetchDefaultTransferStage();
  }, [supabase]);

  const types = Array.from(new Set(leads.map((lead) => lead.type)));
  const sources = Array.from(new Set(leads.map((lead) => lead.source)));

  const filtered = leads.filter((lead) => {
    const matchType = filterType === "All" || lead.type === filterType;
    const matchSource = filterSource === "All" || lead.source === filterSource;
    const query = search.toLowerCase().trim();
    const matchSearch =
      !query ||
      lead.name.toLowerCase().includes(query) ||
      lead.phone.toLowerCase().includes(query) ||
      lead.id.toLowerCase().includes(query);
    return matchType && matchSource && matchSearch;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => { setPage(1); }, [search, filterType, filterSource]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
    if (filtered.length === 0 && page !== 1) setPage(1);
  }, [filtered.length, page, totalPages]);

  // Stats
  const totalPremium = leads.reduce((s, l) => s + l.premium, 0);
  const avgPremium = leads.length ? totalPremium / leads.length : 0;
  const uniquePipelines = new Set(leads.map((l) => l.pipeline)).size;

  const handleCreateLead = async (payload: TransferLeadFormData) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setToast({ message: "You are not logged in", type: "error" });
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("call_center_id")
      .eq("id", session.user.id)
      .maybeSingle();

    const leadUniqueId = payload.leadUniqueId || buildLeadUniqueId(payload);
    const generatedSubmissionId = buildSubmissionId(callCenterName);

    const phoneDigits = normalizePhoneDigits(payload.phone || "");

    const loadDuplicateRulesByStage = async () => {
      const { data: rulesData, error: rulesError } = await supabase
        .from("ssn_duplicate_stage_rules")
        .select("stage_name, ghl_stage, message, is_addable, is_active")
        .eq("is_active", true);
      if (rulesError) throw new Error(rulesError.message || "Unable to load duplicate rules.");
      const rules = ((rulesData || []) as SsnDuplicateRule[]).map((rule) => ({
        ...rule,
        stage_name: String(rule.stage_name || "").trim(),
      }));
      const ruleByStage = new Map<string, SsnDuplicateRule>();
      rules.forEach((rule) => {
        if (rule.stage_name) ruleByStage.set(rule.stage_name.toLowerCase(), rule);
      });
      return ruleByStage;
    };

    const findDuplicateByPhone = async () => {
      if (phoneDigits.length !== 10) return null;
      const variants = Array.from(
        new Set([payload.phone?.trim(), phoneDigits, formatUsPhone(phoneDigits)].filter(Boolean)),
      );
      const { data: existing, error: existingError } = await supabase
        .from("leads")
        .select("id, lead_unique_id, first_name, last_name, phone, stage, created_at")
        .in("phone", variants)
        .order("created_at", { ascending: false });
      if (existingError) return null;
      return (
        (existing || []).find(
          (row: { phone: string | null }) => normalizePhoneDigits(String(row.phone || "")) === phoneDigits,
        ) || null
      );
    };

    // 1) Phone duplicate check (first)
    const existingLead = await findDuplicateByPhone();
    if (existingLead) {
      try {
        const ruleByStage = await loadDuplicateRulesByStage();
        const stage = String(existingLead.stage || "").trim();
        const rule = stage ? ruleByStage.get(stage.toLowerCase()) : undefined;
        const ghlStage = rule?.ghl_stage ? ` (GHL: ${rule.ghl_stage})` : "";
        const baseMessage = rule?.message || "A lead already exists with this phone number.";
        setDuplicateRuleMessage(`${baseMessage}${stage ? ` Stage: ${stage}.` : ""}${ghlStage}`);
        setDuplicateIsAddable(rule?.is_addable ?? true);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to load duplicate rule message.";
        setDuplicateRuleMessage(message);
        setDuplicateIsAddable(true);
      }
      setPendingCreatePayload(payload);
      setDuplicateLeadMatch({
        id: existingLead.id,
        lead_unique_id: existingLead.lead_unique_id ?? null,
        first_name: existingLead.first_name ?? null,
        last_name: existingLead.last_name ?? null,
        phone: existingLead.phone ?? null,
        stage: existingLead.stage ?? null,
        created_at: existingLead.created_at ?? null,
      });
      setShowDuplicateDialog(true);
      return;
    }

    // 2) DNC check (submit-time)
    try {
      if (phoneDigits.length === 10) {
        const [blacklistResult, dncTestResult] = await Promise.all([
          supabase.functions.invoke("blacklist-check", { body: { phone: phoneDigits } }),
          supabase.functions.invoke("dnc-test", { body: { mobileNumber: phoneDigits } }),
        ]);
        if (blacklistResult.error && dncTestResult.error) {
          throw new Error(blacklistResult.error.message || dncTestResult.error.message || "DNC check failed");
        }

        const toPayload = (input: unknown): Record<string, unknown> => {
          const isPayloadShape = (obj: Record<string, unknown>) =>
            "is_tcpa" in obj ||
            "is_blacklisted" in obj ||
            "is_dnc" in obj ||
            "litigator" in obj ||
            "national_dnc" in obj ||
            "state_dnc" in obj ||
            "dma" in obj ||
            "status" in obj ||
            "message" in obj;

          const firstNestedPayload = (obj: Record<string, unknown>): Record<string, unknown> => {
            for (const value of Object.values(obj)) {
              if (value && typeof value === "object") {
                const candidate = value as Record<string, unknown>;
                if (isPayloadShape(candidate)) return candidate;
              }
            }
            return {};
          };

          if (Array.isArray(input)) {
            const first = input[0];
            return first && typeof first === "object" ? (first as Record<string, unknown>) : {};
          }
          if (!input || typeof input !== "object") return {};
          const record = input as Record<string, unknown>;
          const nested = record.data;
          if (Array.isArray(nested)) {
            const first = nested[0];
            return first && typeof first === "object" ? (first as Record<string, unknown>) : {};
          }
          if (nested && typeof nested === "object") {
            const nestedObj = nested as Record<string, unknown>;
            return isPayloadShape(nestedObj) ? nestedObj : firstNestedPayload(nestedObj);
          }
          return isPayloadShape(record) ? record : firstNestedPayload(record);
        };

        const payloadA = blacklistResult.error ? {} : toPayload(blacklistResult.data);
        const payloadB = dncTestResult.error ? {} : toPayload(dncTestResult.data);
        const litigatorA = String(payloadA.litigator ?? "").toUpperCase();
        const litigatorB = String(payloadB.litigator ?? "").toUpperCase();
        const isTcpa =
          payloadA.is_tcpa === true || payloadA.is_blacklisted === true || litigatorA === "Y" ||
          payloadB.is_tcpa === true || payloadB.is_blacklisted === true || litigatorB === "Y";
        const tcpaMessage =
          (typeof payloadA.message === "string" && payloadA.message) ||
          (typeof payloadB.message === "string" && payloadB.message) ||
          "WARNING: This number is blacklisted/TCPA flagged. Lead creation is blocked.";

        if (isTcpa) {
          setToast({
            message: tcpaMessage,
            type: "error",
          });
          return;
        }
      }
    } catch (e) {
      // Non-blocking: allow submit but inform user
      const message = e instanceof Error ? e.message : "Unable to check DNC status.";
      setToast({ message, type: "error" });
    }

    const insertLead = async (finalPayload: TransferLeadFormData, asDuplicate: boolean) => {
      const existingAdditional = (finalPayload.additionalInformation || "").trim();
      return supabase
        .from("leads")
        .insert({
          submission_id: generatedSubmissionId,
          lead_unique_id: leadUniqueId,
          lead_value: Number(finalPayload.leadValue || 0),
          lead_source: FIXED_BPO_LEAD_SOURCE,
          submission_date: finalPayload.submissionDate,
          first_name: finalPayload.firstName,
          last_name: finalPayload.lastName,
          street1: finalPayload.street1,
          street2: finalPayload.street2 || null,
          city: finalPayload.city,
          state: finalPayload.state,
          zip_code: finalPayload.zipCode,
          phone: finalPayload.phone,
          birth_state: finalPayload.birthState,
          date_of_birth: finalPayload.dateOfBirth,
          age: finalPayload.age,
          social: finalPayload.social,
          driver_license_number: finalPayload.driverLicenseNumber,
          existing_coverage_last_2_years: finalPayload.existingCoverageLast2Years,
          previous_applications_2_years: finalPayload.previousApplications2Years,
          height: finalPayload.height,
          weight: finalPayload.weight,
          doctor_name: finalPayload.doctorName,
          tobacco_use: finalPayload.tobaccoUse,
          health_conditions: finalPayload.healthConditions,
          medications: finalPayload.medications,
          monthly_premium: finalPayload.monthlyPremium,
          coverage_amount: finalPayload.coverageAmount,
          carrier: finalPayload.carrier,
          product_type: finalPayload.productType,
          draft_date: finalPayload.draftDate,
          beneficiary_information: finalPayload.beneficiaryInformation,
          bank_account_type: finalPayload.bankAccountType || null,
          institution_name: finalPayload.institutionName,
          routing_number: finalPayload.routingNumber,
          account_number: finalPayload.accountNumber,
          future_draft_date: finalPayload.futureDraftDate,
          additional_information: existingAdditional || null,
          tags: asDuplicate ? ["duplicate"] : [],
          pipeline: finalPayload.pipeline || "Transfer Portal",
          stage: finalPayload.stage || "Transfer API",
          stage_id: defaultTransferStageId,
          is_draft: false,
          call_center_id: userProfile?.call_center_id || null,
          submitted_by: session.user.id,
        })
        .select("id")
        .single();
    };

    const { data: insertedLead, error } = await insertLead(payload, false);

    if (error) {
      setToast({ message: error.message || "Failed to save lead", type: "error" });
      return;
    }

    if (insertedLead?.id) {
      const leadName = `${payload.firstName} ${payload.lastName}`.trim() || "Unnamed Lead";
      await insertDailyDealFlowEntry(supabase, {
        leadId: insertedLead.id,
        leadUniqueId: leadUniqueId,
        leadName,
        centerName: callCenterName,
        callCenterId: userProfile?.call_center_id ?? null,
      });
      void notifySlackTransferPortalLead(supabase, {
        leadId: insertedLead.id,
        leadUniqueId,
        payload,
        callCenterName,
        authToken: session.access_token,
      });
    }

    setToast({ message: "Lead saved successfully", type: "success" });
    setShowCreateLead(false);
    setPage(1);
    await refreshLeads();
  };

  const handleCreateDuplicateLead = async () => {
    if (!pendingCreatePayload) return;
    if (!duplicateIsAddable) {
      setToast({ message: "Duplicate creation is not allowed for the existing lead’s current stage.", type: "error" });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setToast({ message: "You are not logged in", type: "error" });
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("call_center_id")
      .eq("id", session.user.id)
      .maybeSingle();

    const leadUniqueId = pendingCreatePayload.leadUniqueId || buildLeadUniqueId(pendingCreatePayload);
    const generatedSubmissionId = buildSubmissionId(callCenterName);
    const existingAdditional = (pendingCreatePayload.additionalInformation || "").trim();

    const { data: dupInserted, error } = await supabase
      .from("leads")
      .insert({
        submission_id: generatedSubmissionId,
        lead_unique_id: leadUniqueId,
        lead_value: Number(pendingCreatePayload.leadValue || 0),
        lead_source: FIXED_BPO_LEAD_SOURCE,
        submission_date: pendingCreatePayload.submissionDate,
        first_name: pendingCreatePayload.firstName,
        last_name: pendingCreatePayload.lastName,
        street1: pendingCreatePayload.street1,
        street2: pendingCreatePayload.street2 || null,
        city: pendingCreatePayload.city,
        state: pendingCreatePayload.state,
        zip_code: pendingCreatePayload.zipCode,
        phone: pendingCreatePayload.phone,
        birth_state: pendingCreatePayload.birthState,
        date_of_birth: pendingCreatePayload.dateOfBirth,
        age: pendingCreatePayload.age,
        social: pendingCreatePayload.social,
        driver_license_number: pendingCreatePayload.driverLicenseNumber,
        existing_coverage_last_2_years: pendingCreatePayload.existingCoverageLast2Years,
        previous_applications_2_years: pendingCreatePayload.previousApplications2Years,
        height: pendingCreatePayload.height,
        weight: pendingCreatePayload.weight,
        doctor_name: pendingCreatePayload.doctorName,
        tobacco_use: pendingCreatePayload.tobaccoUse,
        health_conditions: pendingCreatePayload.healthConditions,
        medications: pendingCreatePayload.medications,
        monthly_premium: pendingCreatePayload.monthlyPremium,
        coverage_amount: pendingCreatePayload.coverageAmount,
        carrier: pendingCreatePayload.carrier,
        product_type: pendingCreatePayload.productType,
        draft_date: pendingCreatePayload.draftDate,
        beneficiary_information: pendingCreatePayload.beneficiaryInformation,
        bank_account_type: pendingCreatePayload.bankAccountType || null,
        institution_name: pendingCreatePayload.institutionName,
        routing_number: pendingCreatePayload.routingNumber,
        account_number: pendingCreatePayload.accountNumber,
        future_draft_date: pendingCreatePayload.futureDraftDate,
        additional_information: existingAdditional || null,
        tags: ["duplicate"],
        pipeline: pendingCreatePayload.pipeline || "Transfer Portal",
        stage: pendingCreatePayload.stage || "Transfer API",
        stage_id: defaultTransferStageId,
        is_draft: false,
        call_center_id: userProfile?.call_center_id || null,
        submitted_by: session.user.id,
      })
      .select("id")
      .single();

    if (error) {
      setToast({ message: error.message || "Failed to save duplicate lead", type: "error" });
      return;
    }

    if (dupInserted?.id) {
      const leadName = `${pendingCreatePayload.firstName} ${pendingCreatePayload.lastName}`.trim() || "Unnamed Lead";
      await insertDailyDealFlowEntry(supabase, {
        leadId: dupInserted.id,
        leadUniqueId: leadUniqueId,
        leadName,
        centerName: callCenterName,
        callCenterId: userProfile?.call_center_id ?? null,
      });
      void notifySlackTransferPortalLead(supabase, {
        leadId: dupInserted.id,
        leadUniqueId,
        payload: pendingCreatePayload,
        callCenterName,
        authToken: session.access_token,
      });
    }

    setShowDuplicateDialog(false);
    setPendingCreatePayload(null);
    setDuplicateLeadMatch(null);
    setToast({ message: "Duplicate lead saved with duplicate tag", type: "success" });
    setShowCreateLead(false);
    setPage(1);
    await refreshLeads();
  };

  const handleEditExistingDuplicateLead = async () => {
    if (!duplicateLeadMatch?.id) return;
    setShowDuplicateDialog(false);
    setPendingCreatePayload(null);
    const existingId = duplicateLeadMatch.id;
    setDuplicateLeadMatch(null);
    setShowCreateLead(false);
    await handleEditLead(existingId);
  };

  const handleCreateDraftLead = async (payload: TransferLeadFormData) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setToast({ message: "You are not logged in", type: "error" });
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("call_center_id")
      .eq("id", session.user.id)
      .maybeSingle();

    const leadUniqueId = payload.leadUniqueId || buildLeadUniqueId(payload);
    const generatedSubmissionId = buildSubmissionId(callCenterName);

    const { error } = await supabase.from("leads").insert({
      submission_id: generatedSubmissionId,
      lead_unique_id: leadUniqueId,
      lead_value: Number(payload.leadValue || 0),
      lead_source: FIXED_BPO_LEAD_SOURCE,
      submission_date: payload.submissionDate || null,
      first_name: payload.firstName || null,
      last_name: payload.lastName || null,
      street1: payload.street1 || null,
      street2: payload.street2 || null,
      city: payload.city || null,
      state: payload.state || null,
      zip_code: payload.zipCode || null,
      phone: payload.phone || null,
      birth_state: payload.birthState || null,
      date_of_birth: payload.dateOfBirth || null,
      age: payload.age || null,
      social: payload.social || null,
      driver_license_number: payload.driverLicenseNumber || null,
      existing_coverage_last_2_years: payload.existingCoverageLast2Years || null,
      previous_applications_2_years: payload.previousApplications2Years || null,
      height: payload.height || null,
      weight: payload.weight || null,
      doctor_name: payload.doctorName || null,
      tobacco_use: payload.tobaccoUse || null,
      health_conditions: payload.healthConditions || null,
      medications: payload.medications || null,
      monthly_premium: payload.monthlyPremium || null,
      coverage_amount: payload.coverageAmount || null,
      carrier: payload.carrier || null,
      product_type: payload.productType || null,
      draft_date: payload.draftDate || null,
      beneficiary_information: payload.beneficiaryInformation || null,
      bank_account_type: payload.bankAccountType || null,
      institution_name: payload.institutionName || null,
      routing_number: payload.routingNumber || null,
      account_number: payload.accountNumber || null,
      future_draft_date: payload.futureDraftDate || null,
      additional_information: payload.additionalInformation || null,
      pipeline: payload.pipeline || "Transfer Portal",
      stage: payload.stage || "Transfer API",
      stage_id: defaultTransferStageId,
      is_draft: true,
      call_center_id: userProfile?.call_center_id || null,
      submitted_by: session.user.id,
    });

    if (error) {
      setToast({ message: error.message || "Failed to save draft", type: "error" });
      return;
    }

    setToast({ message: "Draft saved", type: "success" });
    setShowCreateLead(false);
    setPage(1);
    await refreshLeads();
  };

  const handleEditLead = async (rowId: string) => {
    const { data, error } = await supabase
      .from("leads")
      .select("id, lead_unique_id, lead_value, lead_source, submission_date, first_name, last_name, street1, street2, city, state, zip_code, phone, birth_state, date_of_birth, age, social, driver_license_number, existing_coverage_last_2_years, previous_applications_2_years, height, weight, doctor_name, tobacco_use, health_conditions, medications, monthly_premium, coverage_amount, carrier, product_type, draft_date, beneficiary_information, bank_account_type, institution_name, routing_number, account_number, future_draft_date, additional_information, pipeline, stage, is_draft")
      .eq("id", rowId)
      .maybeSingle();

    if (error || !data) {
      setToast({ message: error?.message || "Failed to load lead for editing", type: "error" });
      return;
    }

    const mapped: TransferLeadFormData = {
      leadUniqueId: data.lead_unique_id || "",
      leadValue: data.lead_value != null ? String(data.lead_value) : "",
      leadSource: FIXED_BPO_LEAD_SOURCE,
      submissionDate: data.submission_date || "",
      firstName: data.first_name || "",
      lastName: data.last_name || "",
      street1: data.street1 || "",
      street2: data.street2 || "",
      city: data.city || "",
      state: data.state || "",
      zipCode: data.zip_code || "",
      phone: data.phone || "",
      birthState: data.birth_state || "",
      dateOfBirth: data.date_of_birth || "",
      age: data.age || "",
      social: data.social || "",
      driverLicenseNumber: data.driver_license_number || "",
      existingCoverageLast2Years: data.existing_coverage_last_2_years || "",
      previousApplications2Years: data.previous_applications_2_years || "",
      height: data.height || "",
      weight: data.weight || "",
      doctorName: data.doctor_name || "",
      tobaccoUse: data.tobacco_use || "",
      healthConditions: data.health_conditions || "",
      medications: data.medications || "",
      monthlyPremium: data.monthly_premium || "",
      coverageAmount: data.coverage_amount || "",
      carrier: data.carrier || "",
      productType: data.product_type || "",
      draftDate: data.draft_date || "",
      beneficiaryInformation: data.beneficiary_information || "",
      bankAccountType: data.bank_account_type || "",
      institutionName: data.institution_name || "",
      routingNumber: data.routing_number || "",
      accountNumber: data.account_number || "",
      futureDraftDate: data.future_draft_date || "",
      additionalInformation: data.additional_information || "",
      pipeline: data.pipeline || "Transfer Portal",
      stage: data.stage || "Transfer API",
      isDraft: data.is_draft ?? false,
    };

    setEditingLead({ rowId, formData: mapped });
  };

  const handleUpdateLead = async (payload: TransferLeadFormData) => {
    if (!editingLead?.rowId) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data: userProfile } = session?.user?.id
      ? await supabase
          .from("users")
          .select("call_center_id")
          .eq("id", session.user.id)
          .maybeSingle()
      : { data: null as { call_center_id?: string | null } | null };

    const { error } = await supabase
      .from("leads")
      .update({
        lead_unique_id: payload.leadUniqueId || buildLeadUniqueId(payload),
        lead_value: Number(payload.leadValue || 0),
        lead_source: FIXED_BPO_LEAD_SOURCE,
        submission_date: payload.submissionDate,
        first_name: payload.firstName,
        last_name: payload.lastName,
        street1: payload.street1,
        street2: payload.street2 || null,
        city: payload.city,
        state: payload.state,
        zip_code: payload.zipCode,
        phone: payload.phone,
        birth_state: payload.birthState,
        date_of_birth: payload.dateOfBirth,
        age: payload.age,
        social: payload.social,
        driver_license_number: payload.driverLicenseNumber,
        existing_coverage_last_2_years: payload.existingCoverageLast2Years,
        previous_applications_2_years: payload.previousApplications2Years,
        height: payload.height,
        weight: payload.weight,
        doctor_name: payload.doctorName,
        tobacco_use: payload.tobaccoUse,
        health_conditions: payload.healthConditions,
        medications: payload.medications,
        monthly_premium: payload.monthlyPremium,
        coverage_amount: payload.coverageAmount,
        carrier: payload.carrier,
        product_type: payload.productType,
        draft_date: payload.draftDate,
        beneficiary_information: payload.beneficiaryInformation,
        bank_account_type: payload.bankAccountType || null,
        institution_name: payload.institutionName,
        routing_number: payload.routingNumber,
        account_number: payload.accountNumber,
        future_draft_date: payload.futureDraftDate,
        additional_information: payload.additionalInformation || null,
        pipeline: payload.pipeline || "Transfer Portal",
        stage: payload.stage || "Transfer API",
        stage_id: defaultTransferStageId,
        is_draft: false,
        call_center_id: userProfile?.call_center_id || null,
      })
      .eq("id", editingLead.rowId);

    if (error) {
      setToast({ message: error.message || "Failed to update lead", type: "error" });
      return;
    }

    setToast({ message: "Lead updated successfully", type: "success" });
    setEditingLead(null);
    await refreshLeads();
  };

  const handleUpdateDraftLead = async (payload: TransferLeadFormData) => {
    if (!editingLead?.rowId) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data: userProfile } = session?.user?.id
      ? await supabase
          .from("users")
          .select("call_center_id")
          .eq("id", session.user.id)
          .maybeSingle()
      : { data: null as { call_center_id?: string | null } | null };

    const { error } = await supabase
      .from("leads")
      .update({
        lead_unique_id: payload.leadUniqueId || buildLeadUniqueId(payload),
        lead_value: Number(payload.leadValue || 0),
        lead_source: FIXED_BPO_LEAD_SOURCE,
        submission_date: payload.submissionDate || null,
        first_name: payload.firstName || null,
        last_name: payload.lastName || null,
        street1: payload.street1 || null,
        street2: payload.street2 || null,
        city: payload.city || null,
        state: payload.state || null,
        zip_code: payload.zipCode || null,
        phone: payload.phone || null,
        birth_state: payload.birthState || null,
        date_of_birth: payload.dateOfBirth || null,
        age: payload.age || null,
        social: payload.social || null,
        driver_license_number: payload.driverLicenseNumber || null,
        existing_coverage_last_2_years: payload.existingCoverageLast2Years || null,
        previous_applications_2_years: payload.previousApplications2Years || null,
        height: payload.height || null,
        weight: payload.weight || null,
        doctor_name: payload.doctorName || null,
        tobacco_use: payload.tobaccoUse || null,
        health_conditions: payload.healthConditions || null,
        medications: payload.medications || null,
        monthly_premium: payload.monthlyPremium || null,
        coverage_amount: payload.coverageAmount || null,
        carrier: payload.carrier || null,
        product_type: payload.productType || null,
        draft_date: payload.draftDate || null,
        beneficiary_information: payload.beneficiaryInformation || null,
        bank_account_type: payload.bankAccountType || null,
        institution_name: payload.institutionName || null,
        routing_number: payload.routingNumber || null,
        account_number: payload.accountNumber || null,
        future_draft_date: payload.futureDraftDate || null,
        additional_information: payload.additionalInformation || null,
        pipeline: payload.pipeline || "Transfer Portal",
        stage: payload.stage || "Transfer API",
        stage_id: defaultTransferStageId,
        is_draft: true,
        call_center_id: userProfile?.call_center_id || null,
      })
      .eq("id", editingLead.rowId);

    if (error) {
      setToast({ message: error.message || "Failed to save draft", type: "error" });
      return;
    }

    setToast({ message: "Draft updated", type: "success" });
    setEditingLead(null);
    await refreshLeads();
  };

  if (showCreateLead) {
    return (
      <>
        <TransferLeadApplicationForm
          onBack={() => setShowCreateLead(false)}
          onSubmit={handleCreateLead}
          onSaveDraft={handleCreateDraftLead}
          centerName={callCenterName}
        />
        {showDuplicateDialog && duplicateLeadMatch && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ width: "100%", maxWidth: 560, backgroundColor: "#fff", borderRadius: 12, border: `1px solid ${T.border}`, padding: 22, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Lead already exists</h3>
              <p style={{ marginTop: 10, marginBottom: 14, fontSize: 14, color: T.textMid, lineHeight: 1.5 }}>
                {duplicateRuleMessage || "We found an existing lead with the same phone number."}
              </p>
              <div style={{ backgroundColor: T.rowBg, border: `1px solid ${T.borderLight}`, borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>
                  {(duplicateLeadMatch.first_name || "")} {(duplicateLeadMatch.last_name || "")}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
                  Lead ID: {duplicateLeadMatch.lead_unique_id || duplicateLeadMatch.id}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>
                  Phone: {duplicateLeadMatch.phone || "Unknown"}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>
                  Stage: {duplicateLeadMatch.stage || "Unknown"}
                </div>
                {duplicateLeadMatch.created_at && (
                  <div style={{ fontSize: 12, color: T.textMuted }}>
                    Created: {new Date(duplicateLeadMatch.created_at).toLocaleString()}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    setShowDuplicateDialog(false);
                    setPendingCreatePayload(null);
                    setDuplicateLeadMatch(null);
                    setDuplicateRuleMessage("");
                  }}
                  style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleEditExistingDuplicateLead()}
                  style={{ background: "#fff", border: `1px solid ${T.blue}`, color: T.blue, borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}
                >
                  Edit Existing
                </button>
                {duplicateIsAddable ? (
                  <button
                    onClick={() => void handleCreateDuplicateLead()}
                    style={{ background: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}
                  >
                    Create Duplicate
                  </button>
                ) : (
                  <button
                    disabled
                    style={{ background: "#d1d5db", color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "not-allowed" }}
                    title="Duplicate creation is blocked by stage rule"
                  >
                    Duplicate Not Allowed
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  if (editingLead) {
    return (
      <>
        <TransferLeadApplicationForm
          onBack={() => setEditingLead(null)}
          onSubmit={handleUpdateLead}
          onSaveDraft={handleUpdateDraftLead}
          initialData={editingLead.formData}
          submitButtonLabel="Update Lead"
          centerName={callCenterName}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  if (viewingLead) {
    return (
      <>
        <LeadViewComponent
          leadId={viewingLead.id}
          leadRowUuid={viewingLead.rowUuid}
          leadName={viewingLead.name}
          canEditLead={canCreateLeads}
          onBack={() => setViewingLead(null)}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  return (
    <div onClick={() => setActiveMenu(null)}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>
            Transfer workflow — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textDark, margin: 0 }}>Transfer Leads</h1>
        </div>
        <button
          onClick={() => setShowCreateLead(true)}
          disabled={!canCreateLeads}
          title={!canCreateLeads ? "Missing permission: action.transfer_leads.create" : undefined}
          style={{
            backgroundColor: canCreateLeads ? T.blue : T.border,
            color: "#fff",
            border: "none",
            borderRadius: T.radiusMd,
            padding: "10px 22px",
            fontSize: 13,
            fontWeight: 700,
            cursor: canCreateLeads ? "pointer" : "not-allowed",
            fontFamily: T.font,
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: canCreateLeads ? `0 4px 12px ${T.blue}44` : "none",
            transition: "all 0.15s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add New Lead
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Leads", value: leads.length.toString(), color: T.blue },
          { label: "Total Premium Volume", value: `$${totalPremium.toLocaleString()}`, color: "#16a34a" },
          { label: "Avg Premium", value: `$${avgPremium.toFixed(0)}`, color: "#ca8a04" },
          { label: "Active Pipelines", value: uniquePipelines.toString(), color: "#7c3aed" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: T.cardBg, borderRadius: T.radiusLg, padding: "18px 20px", boxShadow: T.shadowSm, borderLeft: `4px solid ${color}` }}>
            <p style={{ margin: "0 0 6px", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{label}</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color }}>{value}</p>
          </div>
        ))}
      </div>

      <DataGrid
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search leads by name, phone, source, or ID..."
        filters={
          <>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}
            >
              <option value="All">All Types</option>
              {types.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}
            >
              <option value="All">All Sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </>
        }
        activeFilters={
          (filterType !== "All" || filterSource !== "All") ? (
            <>
              {filterType !== "All" && <FilterChip label={`Type: ${filterType}`} onClear={() => setFilterType("All")} />}
              {filterSource !== "All" && <FilterChip label={`Source: ${filterSource}`} onClear={() => setFilterSource("All")} />}
              <button
                onClick={() => { setFilterType("All"); setFilterSource("All"); }}
                style={{ background: "none", border: "none", color: T.blue, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "4px 8px", fontFamily: T.font, marginLeft: "auto" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "underline")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "none")}
              >
                Reset All
              </button>
            </>
          ) : null
        }
        pagination={
          <Pagination
            page={page}
            totalItems={filtered.length}
            itemsPerPage={itemsPerPage}
            itemLabel="leads"
            onPageChange={setPage}
          />
        }
      >
        <Table
          data={paginated}
          onRowClick={(lead) => setViewingLead({ id: lead.id, name: lead.name, rowUuid: lead.rowId })}
          columns={[
            {
              header: "Lead ID",
              key: "id",
              render: (lead) => (
                <span style={{ fontSize: 12, fontWeight: 700, color: T.blue, textDecoration: "underline" }}>
                  {lead.id}
                </span>
              ),
            },
            {
              header: "Client",
              key: "name",
              render: (lead) => {
                const avatarColor = stringToColor(lead.name);
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      backgroundColor: avatarColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}>
                      {getInitials(lead.name)}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>{lead.name}</span>
                  </div>
                );
              },
            },
            {
              header: "Contact",
              key: "phone",
              render: (lead) => (
                <div>
                  <div style={{ fontSize: 12, color: T.textDark, fontWeight: 700 }}>{lead.phone}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginTop: 2 }}>{lead.source}</div>
                </div>
              ),
            },
            {
              header: "Type",
              key: "type",
              render: (lead) => {
                const tc = getTypeConfig(lead.type);
                return (
                  <span style={{
                    backgroundColor: tc.bg,
                    color: tc.color,
                    borderRadius: 6,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}>
                    {lead.type}
                  </span>
                );
              },
            },
            {
              header: "Centre",
              key: "centerName",
              render: (lead) => (
                <span style={{ fontSize: 12, color: T.textMid, fontWeight: 700 }}>
                  {lead.centerName}
                </span>
              ),
            },
            {
              header: "Pipeline",
              key: "pipeline",
              render: (lead) => (
                <div>
                  <div style={{ fontSize: 12, color: T.textDark, fontWeight: 700 }}>{lead.pipeline}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginTop: 2 }}>{lead.stage}</div>
                </div>
              ),
            },
            {
              header: "Premium",
              key: "premium",
              render: (lead) => (
                <span style={{ fontSize: 13, fontWeight: 800, color: T.textDark }}>
                  ${lead.premium.toLocaleString()}
                </span>
              ),
            },
            {
              header: "Created By",
              key: "createdBy",
              render: (lead) => (
                <span style={{ fontSize: 12, color: T.textMid, fontWeight: 700 }}>
                  {lead.createdBy}
                </span>
              ),
            },
            {
              header: "Created",
              key: "createdAt",
              render: (lead) => (
                <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>
                  {lead.createdAt}
                </span>
              ),
            },
            {
              header: "Actions",
              key: "actions",
              align: "center",
              render: (lead) => (
                <div onClick={(e) => e.stopPropagation()}>
                  <ActionMenu
                    id={lead.id}
                    activeId={activeMenu}
                    onToggle={setActiveMenu}
                    items={[
                      { label: "View Lead", onClick: () => router.push(`/dashboard/${routeRole}/transfer-leads/${lead.rowId}`) },
                      { label: "Claim Call", onClick: () => void openClaimModalForLead(lead) },
                      { label: "Claim Retention", onClick: () => router.push(`/dashboard/${routeRole}/retention-flow?leadRowId=${lead.rowId}`) },
                      { label: "View Details", onClick: () => setViewingLead({ id: lead.id, name: lead.name, rowUuid: lead.rowId }) },
                      { label: "Edit Lead", onClick: () => void handleEditLead(lead.rowId) },
                      { label: "Delete", danger: true },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
        {filtered.length === 0 && (
          <EmptyState title="No leads found" description="Try changing your search or filter selections." compact />
        )}
      </DataGrid>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <TransferLeadClaimModal
        open={claimModalOpen}
        loading={claimModalLoading}
        leadName={claimLeadContext?.leadName || ""}
        agents={claimAgents}
        selection={claimSelection}
        onChange={setClaimSelection}
        onClose={() => setClaimModalOpen(false)}
        onSubmit={() => {
          void handleClaimAndOpenLead();
        }}
      />
    </div>
  );
}
