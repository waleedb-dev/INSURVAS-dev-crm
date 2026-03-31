"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { T } from "@/lib/theme";
import { ActionMenu, DataGrid, FilterChip, Input, Pagination, Table, Toast, EmptyState } from "@/components/ui";
import { FieldLabel, SelectInput } from "./daily-deal-flow/ui-primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/shadcn/table";
import TransferLeadApplicationForm, { type TransferLeadFormData } from "./TransferLeadApplicationForm";
import LeadViewComponent from "./LeadViewComponent";
import TransferLeadClaimModal from "./TransferLeadClaimModal";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
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
  /** ISO `created_at` for date-range filtering */
  createdAtIso: string;
  isDraft?: boolean;
};

type DuplicateLeadMatch = {
  id: string;
  lead_unique_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  social: string | null;
  stage: string | null;
  match_type: "phone" | "ssn";
  created_at?: string | null;
};

const FIXED_BPO_LEAD_SOURCE = "BPO Transfer Lead Source";

const TL_DATE_INPUT_STYLE: CSSProperties = {
  width: "100%",
  height: 36,
  border: `1.5px solid ${T.border}`,
  borderRadius: 8,
  fontSize: 13,
  color: T.textDark,
  padding: "0 8px",
  boxSizing: "border-box",
  background: T.cardBg,
};

function transferLeadDayKey(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mapSelectOptions(values: string[], allLabel: string) {
  const sorted = [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
  return [{ value: "All", label: allLabel }, ...sorted.map((v) => ({ value: v, label: v }))];
}

/** BPO name for Slack vendor channel mapping (must match `leadVendorChannelMapping` keys in `slack-notification`). */
const TRANSFER_PORTAL_LEAD_VENDOR = "Ascendra BPO";

/** Must match deployed Edge Function names. */
const FE_SLACK_NOTIFICATION_EDGE_FUNCTION = "fe-slack-notification" as const;
const FE_GHL_CREATE_CONTACT_EDGE_FUNCTION = "fe-ghl-create-contact" as const;
const TEST_BPO_CHANNEL = "#test-bpo" as const;
const NOTIFY_ELIGIBLE_AGENTS_ENDPOINT =
  process.env.NEXT_PUBLIC_NOTIFY_ELIGIBLE_AGENTS_URL ||
  "https://gqhcjqxcvhgwsqfqgekh.supabase.co/functions/v1/notify-eligible-agents";
const NOTIFY_ELIGIBLE_AGENTS_BEARER_TOKEN =
  process.env.NEXT_PUBLIC_NOTIFY_ELIGIBLE_AGENTS_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxaGNqcXhjdmhnd3NxZnFnZWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNjAyNjEsImV4cCI6MjA2NzkzNjI2MX0.s4nuUN7hw_XCltM-XY3jC9o0og3froDRq_i80UCQ-rA";

type SsnDuplicateRule = {
  stage_name: string;
  ghl_stage: string | null;
  message: string;
  is_addable: boolean;
  is_active: boolean;
};
type DuplicateQueryLead = {
  id: string;
  lead_unique_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  social: string | null;
  stage: string | null;
  created_at: string | null;
};

const DEFAULT_CLAIM_SELECTION: ClaimSelections = {
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
};

// Generate a consistent avatar color from a string
function stringToColor(str: string) {
  const colors = [T.blue, "#94c278", "#4e6e3a", "#bbd9a9", "#74a557", "#74a557", "#3b5229", "#6b7a5f"];
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

function normalizeLeadUniqueId(value: string): string {
  return String(value || "").trim().toUpperCase();
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

function normalizeSsnDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function formatSsn(digits: string) {
  if (digits.length !== 9) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function formatUsPhone(digits: string) {
  if (digits.length !== 10) return digits;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Calendar date `YYYY-MM-DD` in US Eastern — aligns with FE quote `date` and portal submission dates. */
function getTodayInEasternYyyyMmDd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function insertDailyDealFlowEntry(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  row: {
    submissionId: string;
    leadVendor: string;
    leadName: string;
    payload: TransferLeadFormData;
    callCenterId?: string | null;
  }
) {
  const monthly = Number(row.payload.monthlyPremium);
  const face = Number(row.payload.coverageAmount);
  const insuredName = (row.leadName || "").trim() || "Unnamed Lead";
  const flowDate = getTodayInEasternYyyyMmDd();
  const { error } = await supabase.from("daily_deal_flow").insert({
    submission_id: row.submissionId,
    client_phone_number: row.payload.phone || null,
    lead_vendor: row.leadVendor || null,
    call_center_id: row.callCenterId || null,
    date: flowDate,
    insured_name: insuredName,
    carrier: row.payload.carrier || null,
    product_type: row.payload.productType || null,
    draft_date: row.payload.draftDate || null,
    monthly_premium: Number.isFinite(monthly) ? monthly : null,
    face_amount: Number.isFinite(face) ? face : null,
  });
  if (error) console.warn("daily_deal_flow insert:", error.message);
}

async function notifySlackTransferPortalLead(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  params: {
    leadId: string;
    submissionId: string;
    leadUniqueId: string;
    payload: TransferLeadFormData;
    callCenterName: string;
    callCenterId?: string | null;
  }
) {
  const { leadId, submissionId, leadUniqueId, payload, callCenterName, callCenterId } = params;
  try {
    const customerName = `${payload.firstName} ${payload.lastName}`.trim() || "Unnamed Lead";
    const transferPortalMessage = `A new Application Submission:
Call Center Name: ${callCenterName || TRANSFER_PORTAL_LEAD_VENDOR}
Customer Name: ${customerName}
Customer Number: ${payload.phone || "N/A"}
Date & Time (EST): ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`;

    const { error: transferPortalError } = await supabase.functions.invoke(
      FE_SLACK_NOTIFICATION_EDGE_FUNCTION,
      {
        body: {
          channel: TEST_BPO_CHANNEL,
          message: transferPortalMessage,
        },
      },
    );
    if (transferPortalError) console.warn("fe-slack-notification (transfer-portal):", transferPortalError.message);

    const { data: centerRow } = callCenterId
      ? await supabase
          .from("call_centers")
          .select("name, slack_channel")
          .eq("id", callCenterId)
          .maybeSingle()
      : { data: null as { name?: string | null; slack_channel?: string | null } | null };
    const centerName = (centerRow?.name || callCenterName || TRANSFER_PORTAL_LEAD_VENDOR).trim();
    const centerSlackChannel = TEST_BPO_CHANNEL;

    if (centerSlackChannel) {
      const agentPortalUrl = `https://agents-portal-zeta.vercel.app/call-result-update?submissionId=${encodeURIComponent(submissionId || leadId)}&center=${encodeURIComponent(centerName)}`;
      const centerMessage = `New Application Submission:

Call Center Name: ${centerName}
Customer Name: ${customerName}
Customer State: ${payload.state || "N/A"}
Quoted Carrier: ${payload.carrier || "N/A"}
Date & Time (EST): ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`;
      const centerBlocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*New Application Submission:*\n\n*Call Center Name:* ${centerName}\n*Customer Name:* ${customerName}\n*Customer State:* ${payload.state || "N/A"}\n*Quoted Carrier:* ${payload.carrier || "N/A"}\n*Date & Time (EST):* ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View Application" },
              url: agentPortalUrl,
              style: "primary",
            },
          ],
        },
      ];

      const { error: centerSlackError } = await supabase.functions.invoke(
        FE_SLACK_NOTIFICATION_EDGE_FUNCTION,
        {
          body: {
            channel: centerSlackChannel,
            message: centerMessage,
            blocks: centerBlocks,
          },
        },
      );
      if (centerSlackError) console.warn("fe-slack-notification (center):", centerSlackError.message);
    }

    if (payload.carrier && payload.state && centerName) {
      try {
        const notifyResponse = await fetch(NOTIFY_ELIGIBLE_AGENTS_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${NOTIFY_ELIGIBLE_AGENTS_BEARER_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            carrier: payload.carrier,
            state: payload.state,
            lead_vendor: centerName,
            language: "English",
          }),
        });

        if (!notifyResponse.ok) {
          const errorText = await notifyResponse.text();
          console.warn("notify-eligible-agents:", errorText || `HTTP ${notifyResponse.status}`);
        }
      } catch (notifyError) {
        console.warn(
          "notify-eligible-agents:",
          notifyError instanceof Error ? notifyError.message : "Request failed",
        );
      }
    }

    if (centerName && payload.phone) {
      const { error: ghlError } = await supabase.functions.invoke(FE_GHL_CREATE_CONTACT_EDGE_FUNCTION, {
        body: {
          lead_vendor: centerName,
          first_name: payload.firstName || null,
          last_name: payload.lastName || null,
          phone_number: payload.phone,
          email: null,
          date_of_birth: payload.dateOfBirth || null,
          state: payload.state || null,
          city: payload.city || null,
          street_address: payload.street1 || null,
          zip_code: payload.zipCode || null,
          carrier: payload.carrier || null,
          product_type: payload.productType || null,
          monthly_premium: payload.monthlyPremium || null,
          coverage_amount: payload.coverageAmount || null,
          submission_id: submissionId || leadId,
        },
      });
      if (ghlError) console.warn("fe-ghl-create-contact:", ghlError.message);
    }
  } catch (e) {
    console.warn("post-create notifications failed", e);
  }
}

export default function CallCenterLeadIntakePage({
  canCreateLeads = true,
  canViewTransferClaimReclaimVisit = false,
}: {
  canCreateLeads?: boolean;
  canViewTransferClaimReclaimVisit?: boolean;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const { permissionKeys, currentRole } = useDashboardContext();
  const canEditTransferLeads = permissionKeys.has("action.transfer_leads.edit");
  /** Overwrite the matched row: editors always; intake creators only for SSN match (duplicate resolution). */
  const canOverwriteDuplicateMatch = (match: DuplicateLeadMatch | null) =>
    Boolean(
      match &&
        (canEditTransferLeads || (canCreateLeads && match.match_type === "ssn")),
    );
  const isCallCenterTransferRole =
    currentRole === "call_center_agent" || currentRole === "call_center_admin";
  const params = useParams<{ role?: string }>();
  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role || "agent";
  const [leads, setLeads] = useState<IntakeLead[]>([]);
  const [viewingLead, setViewingLead] = useState<{ id: string; name: string; rowUuid: string } | null>(null);
  const [editingLead, setEditingLead] = useState<{ rowId: string; formData: TransferLeadFormData } | null>(null);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("All");
  const [filterDateSingle, setFilterDateSingle] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterCenter, setFilterCenter] = useState("All");
  const [filterPipeline, setFilterPipeline] = useState("All");
  const [filterStage, setFilterStage] = useState("All");
  const [filterCreatedBy, setFilterCreatedBy] = useState("All");
  const [filterProductType, setFilterProductType] = useState("All");
  const [filterDraft, setFilterDraft] = useState<"All" | "draft" | "live">("All");
  const [filterMinPremium, setFilterMinPremium] = useState("");
  const [filterMaxPremium, setFilterMaxPremium] = useState("");
  /** Detailed filters (dates, dropdowns, premium) — search + chips stay usable when false */
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);
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
  const [pendingDeleteLead, setPendingDeleteLead] = useState<{ rowId: string; name: string } | null>(null);
  const [deletingLead, setDeletingLead] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimModalLoading, setClaimModalLoading] = useState(false);
  const [claimLeadContext, setClaimLeadContext] = useState<ClaimLeadContext | null>(null);
  const [claimAgents, setClaimAgents] = useState<{
    bufferAgents: { id: string; name: string; roleKey: string }[];
    licensedAgents: { id: string; name: string; roleKey: string }[];
    retentionAgents: { id: string; name: string; roleKey: string }[];
  }>({ bufferAgents: [], licensedAgents: [], retentionAgents: [] });
  const [claimSelection, setClaimSelection] = useState<ClaimSelections>(DEFAULT_CLAIM_SELECTION);
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

    const baseQuery = supabase
      .from("leads")
      .select("id, submission_id, lead_unique_id, first_name, last_name, phone, lead_value, product_type, lead_source, pipeline, stage, stage_id, call_center_id, created_at, is_draft, call_centers(name), users!submitted_by(full_name)")
      .eq("pipeline", "Transfer Portal")
      .eq("stage", "Transfer API")
      .order("created_at", { ascending: false });

    const canViewAll = permissionKeys.has("action.transfer_leads.view_all");
    const canViewCallCenter = permissionKeys.has("action.transfer_leads.view_call_center");
    const canViewOwn = permissionKeys.has("action.transfer_leads.view_own");
    const hideDraftsForSalesRole =
      currentRole === "sales_admin" ||
      currentRole === "sales_manager" ||
      currentRole === "sales_agent_licensed" ||
      currentRole === "sales_agent_unlicensed";

    const scopedQuery = canViewAll
      ? baseQuery
      : canViewCallCenter && userProfile?.call_center_id
        ? baseQuery.eq("call_center_id", userProfile.call_center_id)
        : canViewOwn
          ? baseQuery.eq("submitted_by", session.user.id)
          : baseQuery.eq("id", "__no_access__");
    const query = hideDraftsForSalesRole ? scopedQuery.eq("is_draft", false) : scopedQuery;

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
        createdAtIso: lead.created_at ? String(lead.created_at) : "",
        isDraft: typeof lead.is_draft === "boolean" ? lead.is_draft : false,
      };
    });

    setLeads(mapped);
  };

  const openClaimModalForLead = async (lead: IntakeLead) => {
    if (!canViewTransferClaimReclaimVisit) {
      setToast({ message: "Missing permission to start verification.", type: "error" });
      return;
    }
    const context: ClaimLeadContext = {
      rowId: lead.rowId,
      leadUniqueId: lead.id,
      leadName: lead.name,
      phone: lead.phone,
      source: lead.source,
      submissionId: lead.submissionId,
    };
    const initialSelection: ClaimSelections = { ...DEFAULT_CLAIM_SELECTION };

    setClaimLeadContext(context);
    setClaimSelection(initialSelection);
    setClaimModalOpen(true);
    setClaimModalLoading(true);
    try {
      const loaded = await fetchClaimAgents(supabase);
      setClaimAgents(loaded);

      // Clicking "Start verification" should initialize verification immediately,
      // even before the user confirms assignments in the modal.
      await findOrCreateVerificationSession(supabase, context, initialSelection);
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Failed to load claim agents.",
        type: "error",
      });
    } finally {
      setClaimModalLoading(false);
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

  const sources = useMemo(() => Array.from(new Set(leads.map((lead) => lead.source))), [leads]);
  const centerOptions = useMemo(() => Array.from(new Set(leads.map((l) => l.centerName))), [leads]);
  const pipelineOptions = useMemo(() => Array.from(new Set(leads.map((l) => l.pipeline))), [leads]);
  const stageOptions = useMemo(() => Array.from(new Set(leads.map((l) => l.stage))), [leads]);
  const createdByOptions = useMemo(() => Array.from(new Set(leads.map((l) => l.createdBy))), [leads]);
  const productTypeOptions = useMemo(() => Array.from(new Set(leads.map((l) => l.type))), [leads]);

  const transferLeadsHasActiveFilters = useMemo(() => {
    const minP = filterMinPremium.trim();
    const maxP = filterMaxPremium.trim();
    return (
      filterSource !== "All" ||
      filterDateSingle !== "" ||
      filterDateFrom !== "" ||
      filterDateTo !== "" ||
      filterCenter !== "All" ||
      filterPipeline !== "All" ||
      filterStage !== "All" ||
      filterCreatedBy !== "All" ||
      filterProductType !== "All" ||
      filterDraft !== "All" ||
      (minP !== "" && !Number.isNaN(Number(minP))) ||
      (maxP !== "" && !Number.isNaN(Number(maxP)))
    );
  }, [
    search,
    filterSource,
    filterDateSingle,
    filterDateFrom,
    filterDateTo,
    filterCenter,
    filterPipeline,
    filterStage,
    filterCreatedBy,
    filterProductType,
    filterDraft,
    filterMinPremium,
    filterMaxPremium,
  ]);

  const transferLeadDetailedFilterCount = useMemo(() => {
    const minP = filterMinPremium.trim();
    const maxP = filterMaxPremium.trim();
    let n = 0;
    if (filterSource !== "All") n++;
    if (filterDateSingle !== "") n++;
    if (filterDateFrom !== "") n++;
    if (filterDateTo !== "") n++;
    if (filterCenter !== "All") n++;
    if (filterPipeline !== "All") n++;
    if (filterStage !== "All") n++;
    if (filterCreatedBy !== "All") n++;
    if (filterProductType !== "All") n++;
    if (filterDraft !== "All") n++;
    if (minP !== "" && !Number.isNaN(Number(minP))) n++;
    if (maxP !== "" && !Number.isNaN(Number(maxP))) n++;
    return n;
  }, [
    filterSource,
    filterDateSingle,
    filterDateFrom,
    filterDateTo,
    filterCenter,
    filterPipeline,
    filterStage,
    filterCreatedBy,
    filterProductType,
    filterDraft,
    filterMinPremium,
    filterMaxPremium,
  ]);

  const clearTransferLeadFilters = () => {
    setSearch("");
    setFilterSource("All");
    setFilterDateSingle("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterCenter("All");
    setFilterPipeline("All");
    setFilterStage("All");
    setFilterCreatedBy("All");
    setFilterProductType("All");
    setFilterDraft("All");
    setFilterMinPremium("");
    setFilterMaxPremium("");
    setPage(1);
  };

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    const minPrem = filterMinPremium.trim() ? Number(filterMinPremium) : null;
    const maxPrem = filterMaxPremium.trim() ? Number(filterMaxPremium) : null;
    const minOk = minPrem == null || !Number.isNaN(minPrem);
    const maxOk = maxPrem == null || !Number.isNaN(maxPrem);

    return leads.filter((lead) => {
      const matchSource = filterSource === "All" || lead.source === filterSource;
      const matchSearch =
        !query ||
        lead.name.toLowerCase().includes(query) ||
        lead.phone.replace(/\D/g, "").includes(query.replace(/\D/g, "")) ||
        lead.id.toLowerCase().includes(query) ||
        (lead.submissionId && String(lead.submissionId).toLowerCase().includes(query));
      const day = transferLeadDayKey(lead.createdAtIso);
      let matchDate = true;
      if (filterDateSingle) {
        matchDate = day === filterDateSingle;
      } else {
        if (filterDateFrom && day && day < filterDateFrom) matchDate = false;
        if (filterDateTo && day && day > filterDateTo) matchDate = false;
      }
      const matchCenter = filterCenter === "All" || lead.centerName === filterCenter;
      const matchPipeline = filterPipeline === "All" || lead.pipeline === filterPipeline;
      const matchStage = filterStage === "All" || lead.stage === filterStage;
      const matchCreatedBy = filterCreatedBy === "All" || lead.createdBy === filterCreatedBy;
      const matchType = filterProductType === "All" || lead.type === filterProductType;
      const matchDraft =
        filterDraft === "All" ||
        (filterDraft === "draft" ? Boolean(lead.isDraft) : !lead.isDraft);
      let matchPrem = true;
      if (minOk && minPrem != null) matchPrem = matchPrem && lead.premium >= minPrem;
      if (maxOk && maxPrem != null) matchPrem = matchPrem && lead.premium <= maxPrem;

      return (
        matchSource &&
        matchSearch &&
        matchDate &&
        matchCenter &&
        matchPipeline &&
        matchStage &&
        matchCreatedBy &&
        matchType &&
        matchDraft &&
        matchPrem
      );
    });
  }, [
    leads,
    search,
    filterSource,
    filterDateSingle,
    filterDateFrom,
    filterDateTo,
    filterCenter,
    filterPipeline,
    filterStage,
    filterCreatedBy,
    filterProductType,
    filterDraft,
    filterMinPremium,
    filterMaxPremium,
  ]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    filterSource,
    filterDateSingle,
    filterDateFrom,
    filterDateTo,
    filterCenter,
    filterPipeline,
    filterStage,
    filterCreatedBy,
    filterProductType,
    filterDraft,
    filterMinPremium,
    filterMaxPremium,
  ]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
    if (filtered.length === 0 && page !== 1) setPage(1);
  }, [filtered.length, page, totalPages]);

  // Stats (match filtered table)
  const totalPremium = filtered.reduce((s, l) => s + l.premium, 0);
  const avgPremium = filtered.length ? totalPremium / filtered.length : 0;
  const uniquePipelines = new Set(filtered.map((l) => l.pipeline)).size;

  const promptDuplicateIfAny = async (payload: TransferLeadFormData): Promise<boolean> => {
    const phoneDigits = normalizePhoneDigits(payload.phone || "");
    const ssnDigits = normalizeSsnDigits(payload.social || "");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id || null;
    if (!currentUserId) return false;

    const loadDuplicateRulesByGhlStage = async () => {
      const { data: rulesData, error: rulesError } = await supabase
        .from("ssn_duplicate_stage_rules")
        .select("stage_name, ghl_stage, message, is_addable, is_active")
        .eq("is_active", true);
      if (rulesError) throw new Error(rulesError.message || "Unable to load duplicate rules.");
      const rules = ((rulesData || []) as SsnDuplicateRule[]).map((rule) => ({
        ...rule,
        stage_name: String(rule.stage_name || "").trim(),
        ghl_stage: String(rule.ghl_stage || "").trim() || null,
      }));
      const ruleByGhlStage = new Map<string, SsnDuplicateRule>();
      rules.forEach((rule) => {
        if (rule.ghl_stage) ruleByGhlStage.set(rule.ghl_stage.toLowerCase(), rule);
      });
      return ruleByGhlStage;
    };

    const findDuplicateByPhone = async () => {
      if (phoneDigits.length !== 10) return null;
      const variants = Array.from(
        new Set([payload.phone?.trim(), phoneDigits, formatUsPhone(phoneDigits)].filter(Boolean)),
      );
      const { data: existing, error: existingError } = await supabase
        .from("leads")
        .select("id, lead_unique_id, first_name, last_name, phone, social, stage, created_at")
        .eq("submitted_by", currentUserId)
        .in("phone", variants)
        .order("created_at", { ascending: false });
      if (existingError) return null;
      return (
        (existing || []).find(
          (row: { phone: string | null }) => normalizePhoneDigits(String(row.phone || "")) === phoneDigits,
        ) || null
      );
    };

    const findDuplicateBySsn = async () => {
      if (ssnDigits.length !== 9) return null;
      const variants = Array.from(
        new Set([payload.social?.trim(), ssnDigits, formatSsn(ssnDigits)].filter(Boolean)),
      );
      const { data: existing, error: existingError } = await supabase
        .from("leads")
        .select("id, lead_unique_id, first_name, last_name, phone, social, stage, created_at")
        .eq("submitted_by", currentUserId)
        .in("social", variants)
        .order("created_at", { ascending: false });
      if (existingError) return null;
      return (
        (existing || []).find(
          (row: { social: string | null }) => normalizeSsnDigits(String(row.social || "")) === ssnDigits,
        ) || null
      );
    };

    const showDuplicateDialogForLead = async (existingLead: DuplicateQueryLead, matchType: "phone" | "ssn") => {
      try {
        const ruleByStage = await loadDuplicateRulesByGhlStage();
        const stage = String(existingLead.stage || "").trim();
        const rule = stage ? ruleByStage.get(stage.toLowerCase()) : undefined;
        const ghlStage = rule?.ghl_stage ? ` (GHL: ${rule.ghl_stage})` : "";
        const baseMessage = rule?.message || `A lead already exists with this ${matchType === "phone" ? "phone number" : "SSN"}.`;
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
        social: existingLead.social ?? null,
        stage: existingLead.stage ?? null,
        match_type: matchType,
        created_at: existingLead.created_at ?? null,
      });
      setShowDuplicateDialog(true);
    };

    const phoneMatch = await findDuplicateByPhone();
    if (phoneMatch) {
      await showDuplicateDialogForLead(phoneMatch, "phone");
      return true;
    }

    const ssnMatch = await findDuplicateBySsn();
    if (ssnMatch) {
      await showDuplicateDialogForLead(ssnMatch, "ssn");
      return true;
    }

    return false;
  };

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

    const leadUniqueId = normalizeLeadUniqueId(payload.leadUniqueId) || buildLeadUniqueId(payload);
    const generatedSubmissionId = buildSubmissionId(callCenterName);

    const hasDuplicate = await promptDuplicateIfAny(payload);
    if (hasDuplicate) return;

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
        submissionId: generatedSubmissionId,
        leadVendor: callCenterName,
        leadName,
        payload,
        callCenterId: userProfile?.call_center_id || null,
      });
      void notifySlackTransferPortalLead(supabase, {
        leadId: insertedLead.id,
        submissionId: generatedSubmissionId,
        leadUniqueId,
        payload,
        callCenterName,
        callCenterId: userProfile?.call_center_id || null,
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

    const leadUniqueId = normalizeLeadUniqueId(pendingCreatePayload.leadUniqueId) || buildLeadUniqueId(pendingCreatePayload);
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
        submissionId: generatedSubmissionId,
        leadVendor: callCenterName,
        leadName,
        payload: pendingCreatePayload,
        callCenterId: userProfile?.call_center_id || null,
      });
      void notifySlackTransferPortalLead(supabase, {
        leadId: dupInserted.id,
        submissionId: generatedSubmissionId,
        leadUniqueId,
        payload: pendingCreatePayload,
        callCenterName,
        callCenterId: userProfile?.call_center_id || null,
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
    if (!pendingCreatePayload) return;
    if (!duplicateLeadMatch?.id) return;
    if (!canOverwriteDuplicateMatch(duplicateLeadMatch)) {
      setToast({ message: "You do not have permission to overwrite this lead.", type: "error" });
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

    const { error } = await supabase
      .from("leads")
      .update({
        lead_unique_id: normalizeLeadUniqueId(pendingCreatePayload.leadUniqueId) || buildLeadUniqueId(pendingCreatePayload),
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
        additional_information: pendingCreatePayload.additionalInformation || null,
        pipeline: pendingCreatePayload.pipeline || "Transfer Portal",
        stage: pendingCreatePayload.stage || "Transfer API",
        stage_id: defaultTransferStageId,
        is_draft: false,
        call_center_id: userProfile?.call_center_id || null,
      })
      .eq("id", duplicateLeadMatch.id);

    if (error) {
      setToast({ message: error.message || "Failed to update existing duplicate lead", type: "error" });
      return;
    }

    setShowDuplicateDialog(false);
    setPendingCreatePayload(null);
    setDuplicateLeadMatch(null);
    setDuplicateRuleMessage("");
    setShowCreateLead(false);
    setToast({ message: "Existing lead updated successfully", type: "success" });
    setPage(1);
    await refreshLeads();
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

    const leadUniqueId = normalizeLeadUniqueId(payload.leadUniqueId) || buildLeadUniqueId(payload);
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

  const openLeadInForm = async (rowId: string) => {
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

  const handleEditLead = async (rowId: string) => {
    if (!canEditTransferLeads) {
      setToast({ message: "You do not have permission to edit transfer leads.", type: "error" });
      return;
    }
    await openLeadInForm(rowId);
  };

  const openLeadFromGrid = async (lead: IntakeLead) => {
    if (lead.isDraft && isCallCenterTransferRole) {
      await openLeadInForm(lead.rowId);
      return;
    }
    setViewingLead({ id: lead.id, name: lead.name, rowUuid: lead.rowId });
  };

  const handleUpdateLead = async (payload: TransferLeadFormData) => {
    if (!editingLead?.rowId) return;
    const canResumeDraftAsCallCenter = Boolean(isCallCenterTransferRole && editingLead.formData.isDraft);
    const wasDraftBeforeUpdate = Boolean(editingLead.formData.isDraft);
    if (!canEditTransferLeads && !canResumeDraftAsCallCenter) {
      setToast({ message: "You do not have permission to edit transfer leads.", type: "error" });
      return;
    }

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

    const leadUniqueId = normalizeLeadUniqueId(payload.leadUniqueId) || buildLeadUniqueId(payload);
    const { data: updatedLead, error } = await supabase
      .from("leads")
      .update({
        lead_unique_id: leadUniqueId,
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
      .eq("id", editingLead.rowId)
      .select("id, submission_id")
      .single();

    if (error) {
      setToast({ message: error.message || "Failed to update lead", type: "error" });
      return;
    }

    if (wasDraftBeforeUpdate && updatedLead?.id) {
      const submissionId = String(updatedLead.submission_id || "").trim() || buildSubmissionId(callCenterName);
      const leadName = `${payload.firstName} ${payload.lastName}`.trim() || "Unnamed Lead";
      await insertDailyDealFlowEntry(supabase, {
        submissionId,
        leadVendor: callCenterName,
        leadName,
        payload,
        callCenterId: userProfile?.call_center_id || null,
      });
      void notifySlackTransferPortalLead(supabase, {
        leadId: updatedLead.id,
        submissionId,
        leadUniqueId,
        payload,
        callCenterName,
        callCenterId: userProfile?.call_center_id || null,
      });
    }

    setToast({ message: "Lead updated successfully", type: "success" });
    setEditingLead(null);
    await refreshLeads();
  };

  const handleUpdateDraftLead = async (payload: TransferLeadFormData) => {
    if (!editingLead?.rowId) return;
    const canResumeDraftAsCallCenter = Boolean(isCallCenterTransferRole && editingLead.formData.isDraft);
    if (!canEditTransferLeads && !canResumeDraftAsCallCenter) {
      setToast({ message: "You do not have permission to edit transfer leads.", type: "error" });
      return;
    }

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
        lead_unique_id: normalizeLeadUniqueId(payload.leadUniqueId) || buildLeadUniqueId(payload),
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

  const handleDeleteLead = async (leadRowId: string, leadName?: string) => {
    setPendingDeleteLead({ rowId: leadRowId, name: (leadName || "this lead").trim() });
  };

  const confirmDeleteLead = async () => {
    if (!canEditTransferLeads) {
      setToast({ message: "You do not have permission to delete transfer leads.", type: "error" });
      setPendingDeleteLead(null);
      return;
    }
    if (!pendingDeleteLead || deletingLead) return;
    setDeletingLead(true);
    const { error, count } = await supabase
      .from("leads")
      .delete({ count: "exact" })
      .eq("id", pendingDeleteLead.rowId);
    if (error) {
      setToast({ message: error.message || "Failed to delete lead", type: "error" });
      setDeletingLead(false);
      return;
    }
    if (!count || count < 1) {
      setToast({ message: "Lead could not be deleted (permission denied or already removed).", type: "error" });
      setDeletingLead(false);
      return;
    }

    setPendingDeleteLead(null);
    setDeletingLead(false);
    setToast({ message: "Lead deleted successfully", type: "success" });
    setPage(1);
    await refreshLeads();
  };

  if (showCreateLead) {
    return (
      <>
        <TransferLeadApplicationForm
          onBack={() => setShowCreateLead(false)}
          onSubmit={handleCreateLead}
          onSaveDraft={handleCreateDraftLead}
          onInstantDuplicateCheck={(payload) => void promptDuplicateIfAny(payload)}
          centerName={callCenterName}
        />
        {showDuplicateDialog && duplicateLeadMatch && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ width: "100%", maxWidth: 560, backgroundColor: "#fff", borderRadius: 12, border: `1px solid ${T.border}`, padding: 22, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Duplicate lead found</h3>
              <p style={{ marginTop: 10, marginBottom: 8, fontSize: 14, color: T.textMid, lineHeight: 1.5 }}>
                {duplicateRuleMessage || `We found an existing lead with the same ${duplicateLeadMatch.match_type === "ssn" ? "SSN" : "phone number"}.`}
              </p>
              {duplicateLeadMatch.match_type === "ssn" && (
                <p style={{ marginTop: 0, marginBottom: 14, fontSize: 12, color: T.textMuted, lineHeight: 1.45 }}>
                  Stage rules (SSN duplicate rules) control whether a <strong>second</strong> lead can be created. You can still overwrite the existing lead with the form you entered.
                </p>
              )}
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
                  SSN: {duplicateLeadMatch.social || "Unknown"}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>
                  Stage: {duplicateLeadMatch.stage || "Unknown"}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>
                  Match Type: {duplicateLeadMatch.match_type === "ssn" ? "SSN" : "Phone"}
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
                    setDuplicateIsAddable(true);
                  }}
                  style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}
                >
                  Cancel
                </button>
                {canOverwriteDuplicateMatch(duplicateLeadMatch) && (
                  <button
                    type="button"
                    onClick={() => void handleEditExistingDuplicateLead()}
                    style={{
                      background: duplicateIsAddable ? "#fff" : T.blue,
                      border: duplicateIsAddable ? `1px solid ${T.blue}` : "none",
                      color: duplicateIsAddable ? T.blue : "#fff",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Overwrite existing lead
                  </button>
                )}
                {duplicateIsAddable ? (
                  <button
                    type="button"
                    onClick={() => void handleCreateDuplicateLead()}
                    style={{ background: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}
                  >
                    Create Duplicate
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    style={{ background: "#c8d4bb", color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "not-allowed" }}
                    title="A second lead is not allowed for this stage (see SSN duplicate stage rules)."
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
          canEditLead={canEditTransferLeads}
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

      {/* Stats Row - Shadcn Vibes */}
      <style>{`
        @keyframes stat-card-in {
          from { opacity: 0; transform: translateY(8px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes filter-panel-in {
          from { opacity: 0; transform: translateY(-8px); transform-origin: top; }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "TOTAL LEADS", value: filtered.length.toString(), color: T.blue, icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          ) },
          { label: "TOTAL PREMIUM", value: `$${totalPremium.toLocaleString()}`, color: T.memberAmber, icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          ) },
          { label: "AVG PREMIUM", value: `$${avgPremium.toFixed(0)}`, color: T.memberPink, icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h0M2 9.5h20"/></svg>
          ) },
          { label: "ACTIVE PIPELINES", value: uniquePipelines.toString(), color: T.memberTeal, icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          ) },
        ].map(({ label, value, color, icon }, i) => (
          <Card key={label} style={{ 
            borderRadius: 12, 
            border: `1px solid ${T.border}`, 
            borderBottom: `4px solid ${color}`, 
            background: `linear-gradient(135deg, color-mix(in srgb, ${color} 20%, ${T.cardBg}) 0%, ${T.cardBg} 80%)`, 
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)", 
            padding: "20px 24px", 
            display: "flex", 
            flexDirection: "row", 
            justifyContent: "space-between",
            animation: "stat-card-in 0.3s cubic-bezier(0.16,1,0.3,1) both", 
            animationDelay: `${i * 50}ms` 
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</span>
              <div style={{ fontSize: 32, fontWeight: 800, color: color, lineHeight: 1 }}>
                {value}
              </div>
            </div>
            <div style={{ 
              color: color, 
              backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
              width: 54,
              height: 54,
              borderRadius: 14,
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              flexShrink: 0
            }}>
              {icon}
            </div>
          </Card>
        ))}
      </div>

      {/* Filter toolbar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {/* Top Bar */}
        <div
          style={{
            background: T.cardBg,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: "10px 16px",
            boxShadow: T.shadowSm,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Left: Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: "absolute", left: 10, pointerEvents: "none", zIndex: 1 }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search leads..."
                style={{
                  height: 34,
                  minWidth: 240,
                  paddingLeft: 32,
                  paddingRight: 12,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: T.textDark,
                  background: T.pageBg,
                  outline: "none",
                  fontFamily: T.font,
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = T.blue;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${T.blue}20`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          {/* Right: Total count + Filters button */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              fontSize: 13,
              color: T.textMuted,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}>
              {filtered.length} total
            </span>

            <button
              type="button"
              onClick={() => setFilterPanelExpanded((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 34,
                padding: "0 14px",
                borderRadius: 8,
                border: filterPanelExpanded
                  ? `1.5px solid ${T.blue}`
                  : `1px solid ${T.border}`,
                background: filterPanelExpanded ? T.blueLight : T.pageBg,
                color: filterPanelExpanded ? T.blue : T.textDark,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: T.font,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filters
              {transferLeadDetailedFilterCount > 0 && (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: T.blue,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800,
                }}>
                  {transferLeadDetailedFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {(filterPanelExpanded || transferLeadsHasActiveFilters) && (
          <div
            style={{
              background: T.cardBg,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: "16px 20px",
              boxShadow: T.shadowSm,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              animation: "filter-panel-in 0.2s cubic-bezier(0.16,1,0.3,1) both",
            }}
          >
            {filterPanelExpanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
              <div>
                <FieldLabel label="Single date" />
                <input
                  type="date"
                  value={filterDateSingle}
                  onChange={(e) => {
                    setFilterDateSingle(e.target.value);
                    setFilterDateFrom("");
                    setFilterDateTo("");
                  }}
                  style={TL_DATE_INPUT_STYLE}
                />
              </div>
              <div>
                <FieldLabel label="Date from" />
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => {
                    setFilterDateFrom(e.target.value);
                    setFilterDateSingle("");
                  }}
                  style={TL_DATE_INPUT_STYLE}
                />
              </div>
              <div>
                <FieldLabel label="Date to" />
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => {
                    setFilterDateTo(e.target.value);
                    setFilterDateSingle("");
                  }}
                  style={TL_DATE_INPUT_STYLE}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
              <div>
                <FieldLabel label="Source" />
                <SelectInput
                  value={filterSource}
                  onChange={(v) => setFilterSource(String(v))}
                  options={mapSelectOptions(sources, "All sources")}
                />
              </div>
              <div>
                <FieldLabel label="Centre" />
                <SelectInput
                  value={filterCenter}
                  onChange={(v) => setFilterCenter(String(v))}
                  options={mapSelectOptions(centerOptions, "All centres")}
                />
              </div>
              <div>
                <FieldLabel label="Pipeline" />
                <SelectInput
                  value={filterPipeline}
                  onChange={(v) => setFilterPipeline(String(v))}
                  options={mapSelectOptions(pipelineOptions, "All pipelines")}
                />
              </div>
              <div>
                <FieldLabel label="Stage" />
                <SelectInput
                  value={filterStage}
                  onChange={(v) => setFilterStage(String(v))}
                  options={mapSelectOptions(stageOptions, "All stages")}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
              <div>
                <FieldLabel label="Created by" />
                <SelectInput
                  value={filterCreatedBy}
                  onChange={(v) => setFilterCreatedBy(String(v))}
                  options={mapSelectOptions(createdByOptions, "All users")}
                />
              </div>
              <div>
                <FieldLabel label="Product type" />
                <SelectInput
                  value={filterProductType}
                  onChange={(v) => setFilterProductType(String(v))}
                  options={mapSelectOptions(productTypeOptions, "All types")}
                />
              </div>
              <div>
                <FieldLabel label="Draft status" />
                <SelectInput
                  value={filterDraft}
                  onChange={(v) => setFilterDraft(String(v) as "All" | "draft" | "live")}
                  options={[
                    { value: "All", label: "All records" },
                    { value: "live", label: "Submitted only" },
                    { value: "draft", label: "Drafts only" },
                  ]}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <FieldLabel label="Min premium ($)" />
                  <Input
                    value={filterMinPremium}
                    onChange={(e) => setFilterMinPremium(e.target.value)}
                    placeholder="Any"
                    inputMode="decimal"
                    style={{ height: 36 }}
                  />
                </div>
                <div>
                  <FieldLabel label="Max premium ($)" />
                  <Input
                    value={filterMaxPremium}
                    onChange={(e) => setFilterMaxPremium(e.target.value)}
                    placeholder="Any"
                    inputMode="decimal"
                    style={{ height: 36 }}
                  />
                </div>
              </div>
            </div>
              </div>
            )}

            {transferLeadsHasActiveFilters && (
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between", 
                gap: 12, 
                flexWrap: "wrap",
                paddingTop: filterPanelExpanded ? 16 : 0,
                borderTop: filterPanelExpanded ? `1px solid ${T.borderLight}` : "none",
              }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Active:
            </span>
            {filterSource !== "All" && <FilterChip label={`Source: ${filterSource}`} onClear={() => setFilterSource("All")} />}
            {filterDateSingle !== "" && <FilterChip label={`Date: ${filterDateSingle}`} onClear={() => setFilterDateSingle("")} />}
            {filterDateFrom !== "" && <FilterChip label={`From: ${filterDateFrom}`} onClear={() => setFilterDateFrom("")} />}
            {filterDateTo !== "" && <FilterChip label={`To: ${filterDateTo}`} onClear={() => setFilterDateTo("")} />}
            {filterCenter !== "All" && <FilterChip label={`Centre: ${filterCenter}`} onClear={() => setFilterCenter("All")} />}
            {filterPipeline !== "All" && <FilterChip label={`Pipeline: ${filterPipeline}`} onClear={() => setFilterPipeline("All")} />}
            {filterStage !== "All" && <FilterChip label={`Stage: ${filterStage}`} onClear={() => setFilterStage("All")} />}
            {filterCreatedBy !== "All" && <FilterChip label={`Created by: ${filterCreatedBy}`} onClear={() => setFilterCreatedBy("All")} />}
            {filterProductType !== "All" && <FilterChip label={`Type: ${filterProductType}`} onClear={() => setFilterProductType("All")} />}
            {filterDraft !== "All" && (
              <FilterChip
                label={filterDraft === "draft" ? "Drafts only" : "Submitted only"}
                onClear={() => setFilterDraft("All")}
              />
            )}
            {filterMinPremium.trim() !== "" && !Number.isNaN(Number(filterMinPremium)) && (
              <FilterChip label={`Min $: ${filterMinPremium}`} onClear={() => setFilterMinPremium("")} />
            )}
            {filterMaxPremium.trim() !== "" && !Number.isNaN(Number(filterMaxPremium)) && (
              <FilterChip label={`Max $: ${filterMaxPremium}`} onClear={() => setFilterMaxPremium("")} />
            )}
                </div>
                
                <button
                  type="button"
                  onClick={clearTransferLeadFilters}
                  style={{
                    background: "none",
                    border: "none",
                    color: T.blue,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: "4px 0",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = "underline";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = "none";
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <DataGrid
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search leads by name, phone, source, or ID..."
        noHeader
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
        <div
          style={{
            borderRadius: "12px 12px 0 0",
            border: `1.5px solid ${T.border}`,
            borderBottom: "none",
            overflow: "hidden",
            backgroundColor: T.cardBg,
          }}
        >
          <ShadcnTable>
            <TableHeader style={{ backgroundColor: T.blue }}>
              <TableRow style={{ borderBottom: "none" }} className="hover:bg-transparent">
                {[
                  "LEAD ID", "CLIENT", "CONTACT", "CENTRE", "PIPELINE", "PREMIUM", "CREATED", "CREATED BY", "ACTIONS"
                ].map(header => (
                  <TableHead key={header} style={{ 
                    color: "white", 
                    fontWeight: 800, 
                    fontSize: 11, 
                    letterSpacing: "0.5px",
                    padding: "16px",
                    whiteSpace: "nowrap",
                    textAlign: header === "ACTIONS" ? "center" : "left"
                  }}>
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((lead) => {
                const avatarColor = stringToColor(lead.name);
                return (
                  <TableRow 
                    key={lead.id}
                    onClick={() => void openLeadFromGrid(lead)}
                    style={{ cursor: "pointer", borderBottom: `1px solid ${T.borderLight}` }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <TableCell style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: T.blue, textDecoration: "underline" }}>
                        {lead.id}
                      </span>
                    </TableCell>
                    <TableCell style={{ padding: "12px 16px" }}>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>{lead.name}</span>
                          {lead.isDraft ? (
                            <span
                              style={{
                                backgroundColor: "#fff7ed",
                                color: "#c2410c",
                                border: "1px solid #fdba74",
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: "0.2px",
                                textTransform: "uppercase",
                              }}
                            >
                              Draft
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 13, color: T.textDark, fontWeight: 700 }}>{lead.phone}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginTop: 4 }}>{lead.source}</div>
                    </TableCell>
                    <TableCell style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 13, color: T.textMid, fontWeight: 700 }}>
                        {lead.centerName}
                      </span>
                    </TableCell>
                    <TableCell style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 13, color: T.textDark, fontWeight: 700 }}>{lead.pipeline}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginTop: 4 }}>{lead.stage}</div>
                    </TableCell>
                    <TableCell style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: T.textDark }}>
                        ${lead.premium.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 12, color: T.textMid, fontWeight: 600 }}>{lead.createdAt}</span>
                    </TableCell>
                    <TableCell style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 13, color: T.textMid, fontWeight: 700 }}>
                        {lead.createdBy}
                      </span>
                    </TableCell>
                    <TableCell style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap" }}
                      >
                        {!isCallCenterTransferRole && (
                          <button
                            className="lead-action-btn"
                            type="button"
                            onClick={() => {
                              if (lead.isDraft) {
                                void openLeadFromGrid(lead);
                                return;
                              }
                              router.push(`/dashboard/${routeRole}/transfer-leads/${lead.rowId}`);
                            }}
                            style={{
                              border: `1.5px solid ${T.border}`,
                              borderRadius: 8,
                              background: T.cardBg,
                              color: T.textDark,
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "6px 12px",
                              cursor: "pointer",
                              transition: "all 160ms ease",
                            }}
                          >
                            View Lead
                          </button>
                        )}
                        {canViewTransferClaimReclaimVisit && (
                          <>
                            <button
                              className="lead-action-btn"
                              type="button"
                              onClick={() => void openClaimModalForLead(lead)}
                              style={{
                                border: `1.5px solid ${T.border}`,
                                borderRadius: 8,
                                background: T.cardBg,
                                color: T.textDark,
                                fontSize: 12,
                                fontWeight: 700,
                                padding: "6px 12px",
                                cursor: "pointer",
                                transition: "all 160ms ease",
                              }}
                            >
                              Claim Call
                            </button>
                            <button
                              className="lead-action-btn"
                              type="button"
                              onClick={() => router.push(`/dashboard/${routeRole}/retention-flow?leadRowId=${lead.rowId}`)}
                              style={{
                                border: `1.5px solid ${T.border}`,
                                borderRadius: 8,
                                background: T.cardBg,
                                color: T.textDark,
                                fontSize: 12,
                                fontWeight: 700,
                                padding: "6px 12px",
                                cursor: "pointer",
                                transition: "all 160ms ease",
                              }}
                            >
                              Claim Retention
                            </button>
                          </>
                        )}
                        <ActionMenu
                          id={lead.id}
                          activeId={activeMenu}
                          onToggle={setActiveMenu}
                          items={
                            canEditTransferLeads
                              ? [
                                  { label: "View Details", onClick: () => void openLeadFromGrid(lead) },
                                  { label: "Edit Lead", onClick: () => void handleEditLead(lead.rowId) },
                                  { label: "Delete", danger: true, onClick: () => void handleDeleteLead(lead.rowId, lead.name) },
                                ]
                              : isCallCenterTransferRole && lead.isDraft
                                ? [
                                    { label: "View Details", onClick: () => void openLeadFromGrid(lead) },
                                    { label: "Update Lead", onClick: () => void openLeadInForm(lead.rowId) },
                                  ]
                                : [{ label: "View Details", onClick: () => void openLeadFromGrid(lead) }]
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </ShadcnTable>
        </div>
        {filtered.length === 0 && (
          <EmptyState title="No leads found" description="Try changing your search or filter selections." compact />
        )}
      </DataGrid>

      {pendingDeleteLead && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.42)",
            zIndex: 3600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              backgroundColor: T.cardBg,
              borderRadius: 12,
              border: `1.5px solid ${T.border}`,
              boxShadow: "0 18px 45px rgba(0,0,0,0.24)",
              padding: 20,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Delete Lead</h3>
            <p style={{ margin: "10px 0 0", color: T.textMid, fontSize: 14, lineHeight: 1.5 }}>
              Delete <strong>{pendingDeleteLead.name}</strong>? This action cannot be undone.
            </p>
            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                disabled={deletingLead}
                onClick={() => setPendingDeleteLead(null)}
                style={{
                  border: `1px solid ${T.border}`,
                  background: T.cardBg,
                  color: T.textMid,
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontWeight: 700,
                  cursor: deletingLead ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingLead}
                onClick={() => void confirmDeleteLead()}
                style={{
                  border: "none",
                  background: T.danger,
                  color: "#fff",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontWeight: 700,
                  cursor: deletingLead ? "not-allowed" : "pointer",
                  opacity: deletingLead ? 0.7 : 1,
                }}
              >
                {deletingLead ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

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
      <style jsx>{`
        .lead-action-btn:hover {
          background: #3b5229;
          border-color: #3b5229;
          color: #fff;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
        }
        .lead-action-btn:active {
          transform: translateY(0);
          box-shadow: 0 1px 4px rgba(37, 99, 235, 0.25);
        }
      `}</style>
    </div>
  );
}
