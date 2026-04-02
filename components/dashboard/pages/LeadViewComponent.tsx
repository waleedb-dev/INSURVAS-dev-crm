import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { LayoutDashboard, Phone, FileText, Shield } from "lucide-react";
import { POLICY_SCHEMA_SECTIONS, policyDisplayValue, type PolicyRow } from "@/lib/policy-schema";
import { buildDraftFromPolicyRow, payloadFromDraft } from "@/lib/policy-form-utils";
import { EmptyState } from "@/components/ui";
import { AppSelect } from "@/components/ui/app-select";
import ConvertClientPolicyModal from "./ConvertClientPolicyModal";
import PolicyFormFields from "./PolicyFormFields";
import { getCurrentUserPermissionKeys, type PermissionKey } from "@/lib/auth/permissions";

interface Lead {
  name: string;
  email: string;
  phone: string;
  premium: number;
  type: string;
  source: string;
  pipeline: string;
  stage: string;
}

type LeadRow = Record<string, unknown>;

type LeadNoteRow = {
  id: string;
  body: string;
  created_at: string;
  created_by: string | null;
  authorName?: string;
};

interface LeadViewProps {
  leadId?: string;
  /** When known, use this UUID for DB fetch/update (avoids lookup by lead_unique_id). */
  leadRowUuid?: string;
  leadName?: string;
  isCreation?: boolean;
  onSubmit?: (lead: Lead) => void;
  onBack: () => void;
  defaultPipeline?: string;
  defaultStage?: string;
  /** When false, hides Edit Lead and disables note add (e.g. read-only). */
  canEditLead?: boolean;
  /** Demo / mock entry — no DB fetch; shows name only (e.g. Assigning sandbox). */
  previewMode?: boolean;
}

type TabType = "Overview" | "Call updates" | "Notes" | "Policy & coverage";
type PipelineOption = { id: number; name: string; stages: string[] };

const TAB_CONFIG: { id: TabType; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "Overview", label: "Overview", icon: LayoutDashboard },
  { id: "Call updates", label: "Call updates", icon: Phone },
  { id: "Notes", label: "Notes", icon: FileText },
  { id: "Policy & coverage", label: "Policy & coverage", icon: Shield },
];

function TabNavigation({ activeTab, onTabChange }: { activeTab: TabType; onTabChange: (tab: TabType) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const buttons = containerRef.current.querySelectorAll("[data-tab-button]");
    const activeIndex = TAB_CONFIG.findIndex((t) => t.id === activeTab);
    const activeButton = buttons[activeIndex] as HTMLButtonElement | undefined;
    if (activeButton) {
      setPillStyle({
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
      });
    }
  }, [activeTab]);

  // Muted brand green for icons - more distinguishable from text
  const iconColor = "#6b7a5f";
  const iconColorActive = "#4e6e3a";

  // Track background matches header bg (sidebarBg) for seamless look
  const trackBg = T.sidebarBg;

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        justifyContent: "flex-start",
        position: "relative",
        backgroundColor: trackBg,
        borderRadius: 14,
        padding: 4,
        gap: 0,
      }}
    >
      {/* Floating white pill - only for active tab */}
      <div
        style={{
          position: "absolute",
          top: 4,
          left: pillStyle.left,
          width: pillStyle.width,
          height: "calc(100% - 8px)",
          backgroundColor: "#fff",
          borderRadius: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          transition: "left 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {TAB_CONFIG.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            data-tab-button
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 20px",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? T.textDark : T.textMuted,
              backgroundColor: "transparent",
              transition: "color 0.2s ease",
              fontFamily: T.font,
              position: "relative",
              zIndex: 1,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = T.textMid;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = T.textMuted;
              }
            }}
          >
            <div style={{ display: "flex", color: isActive ? iconColorActive : iconColor }}>
              <Icon size={12} />
            </div>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatTs(value: unknown) {
  if (value == null || value === "") return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatPhoneDisplay(phone: string | null | undefined) {
  const raw = String(phone ?? "").replace(/\D/g, "");
  if (raw.length === 10) {
    return `+1 (${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
  }
  return phone || "—";
}

function fmt(value: unknown) {
  if (value == null || value === "") return "—";
  return String(value);
}

function fmtBool(value: unknown) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

const CALL_RESULT_FIELD_ORDER: { key: string; label: string; format?: (v: unknown) => string }[] = [
  { key: "submission_id", label: "Submission ID" },
  { key: "customer_name", label: "Customer name" },
  { key: "call_status", label: "Call status (legacy)" },
  { key: "status", label: "Status" },
  { key: "call_reason", label: "Call reason" },
  { key: "call_source", label: "Call source" },
  { key: "application_submitted", label: "Application submitted", format: fmtBool },
  { key: "dq_reason", label: "DQ / reason" },
  { key: "notes", label: "Call notes" },
  { key: "buffer_agent", label: "Buffer agent" },
  { key: "agent_who_took_call", label: "Agent who took call" },
  { key: "licensed_agent_account", label: "Licensed agent account" },
  { key: "carrier", label: "Carrier" },
  { key: "product_type", label: "Product type" },
  { key: "draft_date", label: "Draft date" },
  { key: "new_draft_date", label: "New draft date" },
  { key: "monthly_premium", label: "Monthly premium" },
  { key: "coverage_amount", label: "Coverage amount" },
  { key: "face_amount", label: "Face amount" },
  { key: "sent_to_underwriting", label: "Sent to underwriting", format: fmtBool },
  { key: "is_callback", label: "Callback", format: fmtBool },
  { key: "is_retention_call", label: "Retention call", format: fmtBool },
  { key: "carrier_attempted_1", label: "Carrier attempted #1" },
  { key: "carrier_attempted_2", label: "Carrier attempted #2" },
  { key: "carrier_attempted_3", label: "Carrier attempted #3" },
  { key: "created_at", label: "Recorded", format: (v) => formatTs(v) },
  { key: "updated_at", label: "Last updated", format: (v) => formatTs(v) },
];

export default function LeadViewComponent({
  leadId,
  leadRowUuid,
  leadName,
  isCreation,
  onSubmit,
  onBack,
  defaultPipeline,
  defaultStage,
  canEditLead = true,
  previewMode = false,
}: LeadViewProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [activeTab, setActiveTab] = useState<TabType>("Overview");
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);

  const [formData, setFormData] = useState<Lead>({
    name: leadName || "",
    email: leadName ? `${leadName.split(" ")[0].toLowerCase()}@example.com` : "",
    phone: "+1 (555) 000-0000",
    premium: 0,
    type: "Auto Insurance",
    source: "Manual Entry",
    pipeline: defaultPipeline || "Sales Pipeline",
    stage: defaultStage || "New Lead",
  });

  const PROJECTS = [
    {
      id: "PN0001265", name: "Medical App (iOS native)", created: "Sep 12, 2020",
      priority: "Medium" as const, allTasks: 34, activeTasks: 13,
      assignees: ["#638b4b","#74a557","#94c278","#4e6e3a"], extraAssignees: 2,
      emoji: "💊", color: "#e8edf8", progress: 38,
      description: "A fully native iOS medical application for patient management, appointment scheduling, and telemedicine consultations.",
      tags: ["iOS","Healthcare","Mobile"],
    },
    {
      id: "PN0001221", name: "Food Delivery Service", created: "Sep 10, 2020",
      priority: "Medium" as const, allTasks: 50, activeTasks: 24,
      assignees: ["#3b5229","#74a557","#bbd9a9"], extraAssignees: 0,
      emoji: "🍔", color: "#f0fdf4", progress: 52,
      description: "End-to-end food delivery platform with real-time order tracking, restaurant dashboard, and driver apps.",
      tags: ["Web","Mobile","Logistics"],
    },
    {
      id: "PN0001290", name: "Food Delivery Service", created: "May 28, 2020",
      priority: "Low" as const, allTasks: 23, activeTasks: 20,
      assignees: ["#638b4b","#94c278","#4e6e3a"], extraAssignees: 5,
      emoji: "📦", color: "#fdf4ff", progress: 86,
      description: "Cloud-based logistics platform.",
      tags: ["Web","Logistics"],
    },
  ];

  const [rowUuid, setRowUuid] = useState<string | null>(leadRowUuid ?? null);
  const [leadRow, setLeadRow] = useState<LeadRow | null>(null);
  const [loadingLead, setLoadingLead] = useState(!isCreation && !previewMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<LeadRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [leadNotes, setLeadNotes] = useState<LeadNoteRow[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [userPermissionKeys, setUserPermissionKeys] = useState<Set<PermissionKey>>(new Set());
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const [callResultsRows, setCallResultsRows] = useState<LeadRow[]>([]);
  const [callUpdatesLoading, setCallUpdatesLoading] = useState(false);

  const [policyRow, setPolicyRow] = useState<PolicyRow | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyDraft, setPolicyDraft] = useState<Record<string, string>>({});
  const [policySaving, setPolicySaving] = useState(false);
  const [policySaveError, setPolicySaveError] = useState<string | null>(null);
  const [policyCallCenterNames, setPolicyCallCenterNames] = useState<string[]>([]);
  const [policyCarrierNames, setPolicyCarrierNames] = useState<string[]>([]);
  const [policyStageNames, setPolicyStageNames] = useState<string[]>([]);
  const [policyLookupReady, setPolicyLookupReady] = useState(false);
  const [convertClientModalOpen, setConvertClientModalOpen] = useState(false);


  // Sample lead data with complete schema
const sampleLead = {
  // 1. Personal & Contact Information
  first_name: "John",
  last_name: "Smith",
  social: "XXX-XX-1234",
  driver_license_number: "D12345678",
  date_of_birth: "1985-03-15",
  age: 39,
  birth_state: "California",
  language: "English",
  phone: "+1 (555) 123-4567",
  email: "john.smith@example.com",
  street1: "123 Main St",
  street2: "Apt 4B",
  city: "Los Angeles",
  state: "CA",
  zip_code: "90210",

  // 2. Health & Underwriting Data
  height: "5'10\"",
  weight: "175 lbs",
  health_conditions: "None reported",
  medications: "None",
  doctor_name: "Dr. Sarah Johnson",
  tobacco_use: false,
  existing_coverage_last_2_years: "No prior coverage",
  previous_applications_2_years: "None",

  // 3. Policy & Coverage Details
  carrier: "State Farm",
  product_type: "Whole Life Insurance",
  coverage_amount: 500000,
  monthly_premium: 1250.00,
  lead_value: 2500,
  draft_date: "2024-02-01",
  future_draft_date: "2024-03-01",
  beneficiary_information: "Jane Smith (Spouse) - 100%",
  additional_information: "Client prefers email contact. Interested in adding riders for accidental death.",

  // 4. Financial & System Metadata
  id: "550e8400-e29b-41d4-a716-446655440000",
  lead_unique_id: "LEAD-2024-001",
  submission_id: "SUB-2024-0089",
  stage: "New Lead",
  stage_id: "stage_001",
  pipeline_id: "pipe_001",
  is_draft: false,
  tags: ["hot-lead", "retention", "high-value"],
  bank_account_type: "Checking",
  institution_name: "Bank of America",
  routing_number: "*****1234",
  account_number: "*****9876",
  created_at: "2024-01-15T10:30:00Z",
  updated_at: "2024-01-15T14:22:00Z",
  submission_date: "2024-01-15",
  submitted_by: "agent_michael_davis",
  call_center_id: "CC_LA_001",
  licensed_agent_account: "agent_sarah_wilson",
  lead_source: "BPO Transfer Lead Source",
};

  const resolveLeadUuid = useCallback(
    async (id: string | undefined): Promise<string | null> => {
      if (!id) return null;
      if (UUID_RE.test(id)) return id;
      const { data } = await supabase.from("leads").select("id").eq("lead_unique_id", id).maybeSingle();
      return data?.id ? String(data.id) : null;
    },
    [supabase]
  );

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSessionUserId(data.session?.user?.id ?? null));
  }, [supabase]);

  useEffect(() => {
    fetchPipelines();
  }, []);

  async function fetchPipelines() {
    const { data: pipelinesData, error: pError } = await supabase.from("pipelines").select("id, name");
    if (pError || !pipelinesData) return;

    const { data: stagesData, error: sError } = await supabase.from("pipeline_stages").select("pipeline_id, name").order("position");
    if (sError || !stagesData) return;

    const built = pipelinesData.map((p) => ({
      id: Number(p.id),
      name: p.name,
      stages: stagesData.filter((s) => s.pipeline_id === p.id).map((s) => s.name),
    }));
    setPipelines(built);

    if (isCreation && built.length > 0) {
      const requestedPipeline = defaultPipeline || formData.pipeline;
      const selectedPipeline = built.find((pipeline) => pipeline.name === requestedPipeline) || built[0];
      const hasRequestedStage = selectedPipeline.stages.includes(defaultStage || formData.stage);
      setFormData((prev) => ({
        ...prev,
        pipeline: selectedPipeline.name,
        stage: hasRequestedStage ? defaultStage || prev.stage : selectedPipeline.stages[0] || "",
      }));
    }
  }

  useEffect(() => {
    if (isCreation || previewMode) {
      setLoadingLead(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingLead(true);
      setLoadError(null);
      const uuid = leadRowUuid || (await resolveLeadUuid(leadId));
      if (cancelled) return;
      if (!uuid) {
        setLoadError("Lead not found.");
        setLeadRow(null);
        setRowUuid(null);
        setLoadingLead(false);
        return;
      }
      setRowUuid(uuid);
      const { data, error } = await supabase.from("leads").select("*").eq("id", uuid).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setLoadError(error?.message || "Could not load lead.");
        setLeadRow(null);
      } else {
        setLeadRow(data as LeadRow);
      }
      setLoadingLead(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isCreation, previewMode, leadId, leadRowUuid, resolveLeadUuid, supabase]);

  // Fetch user permissions from Supabase
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPermissionsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setPermissionsLoading(false);
        return;
      }
      const permissions = await getCurrentUserPermissionKeys(supabase, user.id);
      if (!cancelled) {
        setUserPermissionKeys(permissions);
        setPermissionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const pipelineNameForStages = (() => {
    if (isEditing && editDraft) {
      if (editDraft.pipeline_id != null && editDraft.pipeline_id !== "") {
        const byId = pipelines.find((p) => p.id === Number(editDraft.pipeline_id));
        if (byId) return byId.name;
      }
      return String(editDraft.pipeline ?? "");
    }
    if (leadRow?.pipeline_id != null && leadRow.pipeline_id !== "") {
      const byId = pipelines.find((p) => p.id === Number(leadRow.pipeline_id));
      if (byId) return byId.name;
    }
    return String(leadRow?.pipeline ?? formData.pipeline);
  })();
  const currentPipeline =
    pipelines.find((p) => p.name === pipelineNameForStages) ||
    pipelines.find((p) => p.name === String(leadRow?.pipeline ?? formData.pipeline)) ||
    pipelines[0];

  const fullName = useMemo(() => {
    const d = isEditing && editDraft ? editDraft : leadRow;
    if (previewMode && leadName) return leadName;
    if (!d) return leadName || "Lead";
    const combined = `${String(d.first_name ?? "").trim()} ${String(d.last_name ?? "").trim()}`.trim();
    return combined || leadName || "Lead";
  }, [isEditing, editDraft, leadRow, leadName, previewMode]);

  const startEdit = () => {
    if (!leadRow || !effectiveCanEditLead) return;
    setEditDraft({ ...leadRow });
    setIsEditing(true);
    setSaveError(null);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditDraft(null);
    setSaveError(null);
  };

  // Check edit permission from Supabase (falls back to prop if permissions still loading)
  const effectiveCanEditLead = useMemo(() => {
    // Use prop value if permissions are still loading
    if (permissionsLoading) return canEditLead;
    // Check Supabase permissions - has either lead_pipeline.update or transfer_leads.edit
    const hasEditPermission = userPermissionKeys.has("action.lead_pipeline.update") || 
                              userPermissionKeys.has("action.transfer_leads.edit");
    return hasEditPermission;
  }, [permissionsLoading, canEditLead, userPermissionKeys]);

  const resolveStageId = async (pipelineName: string, stageName: string) => {
    const { data: pipelineRow } = await supabase.from("pipelines").select("id").eq("name", pipelineName).maybeSingle();
    if (!pipelineRow?.id) return null;
    const { data: st } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_id", pipelineRow.id)
      .eq("name", stageName)
      .maybeSingle();
    return st?.id ?? null;
  };

  const saveLeadEdits = async () => {
    if (!rowUuid || !editDraft) return;
    setSaving(true);
    setSaveError(null);

    const str = (k: string) => {
      const v = editDraft[k];
      if (v == null) return null;
      if (typeof v === "string") return v.trim() === "" ? null : v.trim();
      return String(v);
    };
    const num = (k: string) => {
      const raw = editDraft[k];
      if (raw === "" || raw == null) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    const pipelineName = str("pipeline") || "Transfer Portal";
    const stageName = str("stage") || "Transfer API";
    const stageId = await resolveStageId(pipelineName, stageName);
    const pipelineId = pipelines.find((p) => p.name === pipelineName)?.id ?? null;

    let tagsVal: string[] | null = null;
    const tr = editDraft.tags;
    if (Array.isArray(tr)) tagsVal = tr.map((t) => String(t)).filter(Boolean);
    else if (typeof tr === "string" && tr.trim()) {
      tagsVal = tr.split(",").map((s) => s.trim()).filter(Boolean);
    }

    const payload: Record<string, unknown> = {
      first_name: str("first_name"),
      last_name: str("last_name"),
      phone: str("phone"),
      street1: str("street1"),
      street2: str("street2"),
      city: str("city"),
      state: str("state"),
      zip_code: str("zip_code"),
      product_type: str("product_type"),
      lead_value: num("lead_value"),
      monthly_premium: str("monthly_premium"),
      coverage_amount: str("coverage_amount"),
      carrier: str("carrier"),
      lead_source: str("lead_source"),
      submission_date: str("submission_date"),
      stage: stageName,
    };
    if (pipelineId != null) payload.pipeline_id = pipelineId;
    if (stageId != null) payload.stage_id = stageId;
    if (tagsVal) payload.tags = tagsVal;

    const { data: updated, error } = await supabase.from("leads").update(payload).eq("id", rowUuid).select("*").maybeSingle();
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    if (updated) {
      setLeadRow(updated as LeadRow);
      setIsEditing(false);
      setEditDraft(null);
    }
  };

  const display = isEditing && editDraft ? editDraft : leadRow;

  const tags: string[] = Array.isArray(display?.tags)
    ? (display!.tags as unknown[]).map(String)
    : typeof display?.tags === "string"
      ? display.tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const loadNotes = useCallback(async () => {
    if (!rowUuid) return;
    setNotesLoading(true);
    const { data: notes, error } = await supabase
      .from("lead_notes")
      .select("id, body, created_at, created_by")
      .eq("lead_id", rowUuid)
      .order("created_at", { ascending: false });
    if (error) {
      setLeadNotes([]);
      setNotesLoading(false);
      return;
    }
    const rows = (notes || []) as Pick<LeadNoteRow, "id" | "body" | "created_at" | "created_by">[];
    const creatorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
    let nameById: Record<string, string> = {};
    if (creatorIds.length) {
      const { data: users } = await supabase.from("users").select("id, full_name").in("id", creatorIds);
      if (users) {
        nameById = Object.fromEntries(users.map((u: { id: string; full_name: string | null }) => [u.id, u.full_name?.trim() || "User"]));
      }
    }
    setLeadNotes(
      rows.map((r) => ({
        ...r,
        authorName: r.created_by ? nameById[r.created_by] ?? "User" : "System",
      }))
    );
    setNotesLoading(false);
  }, [rowUuid, supabase]);

  const loadPolicyForLead = useCallback(async () => {
    if (!rowUuid) {
      setPolicyRow(null);
      return;
    }
    setPolicyLoading(true);
    const { data, error } = await supabase
      .from("policies")
      .select("*")
      .eq("lead_id", rowUuid)
      .order("created_at", { ascending: false })
      .limit(1);
    setPolicyLoading(false);
    if (error) {
      setPolicyRow(null);
      return;
    }
    const row = data?.[0];
    setPolicyRow(row ? (row as PolicyRow) : null);
  }, [rowUuid, supabase]);

  useEffect(() => {
    void loadPolicyForLead();
  }, [loadPolicyForLead]);

  const policySyncKey =
    policyRow && canEditLead && !previewMode ? `${String(policyRow.id)}-${String(policyRow.updated_at ?? "")}` : "";

  useLayoutEffect(() => {
    if (!policyRow || !canEditLead || previewMode) {
      setPolicyDraft({});
      return;
    }
    setPolicyDraft(buildDraftFromPolicyRow(policyRow));
  }, [policySyncKey, canEditLead, previewMode]);

  useEffect(() => {
    if (activeTab !== "Policy & coverage" || !policyRow || !canEditLead || previewMode) {
      setPolicyLookupReady(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setPolicyLookupReady(false);
      const pipelineId = leadRow?.pipeline_id;
      const stageQuery =
        pipelineId != null && String(pipelineId).trim() !== ""
          ? supabase.from("pipeline_stages").select("name").eq("pipeline_id", pipelineId).order("position")
          : Promise.resolve({ data: [] as { name: string | null }[] });

      const [ccRes, carRes, stRes] = await Promise.all([
        supabase.from("call_centers").select("id, name").order("name"),
        supabase.from("carriers").select("id, name").order("name"),
        stageQuery,
      ]);
      if (cancelled) return;

      const stageSorted = (stRes.data ?? [])
        .map((r: { name?: string | null }) => String(r.name ?? "").trim())
        .filter(Boolean);
      setPolicyStageNames(stageSorted);

      const ccSorted = (ccRes.data ?? [])
        .map((r: { name?: string | null }) => String(r.name ?? "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      const carSorted = (carRes.data ?? [])
        .map((r: { name?: string | null }) => String(r.name ?? "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      setPolicyCallCenterNames(ccSorted);
      setPolicyCarrierNames(carSorted);

      if (!cancelled) setPolicyLookupReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, policyRow, leadRow, supabase, canEditLead, previewMode]);

  const savePolicyFromTab = useCallback(async () => {
    if (!policyRow?.id || !canEditLead || previewMode) return;
    setPolicySaving(true);
    setPolicySaveError(null);
    try {
      const payload = payloadFromDraft(policyDraft, true);
      const { error } = await supabase.from("policies").update(payload).eq("id", policyRow.id as string);
      if (error) throw error;
      await loadPolicyForLead();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Could not save policy.";
      setPolicySaveError(msg);
    } finally {
      setPolicySaving(false);
    }
  }, [policyRow, canEditLead, previewMode, policyDraft, supabase, loadPolicyForLead]);

  const resetPolicyDraft = useCallback(() => {
    if (!policyRow) return;
    setPolicyDraft(buildDraftFromPolicyRow(policyRow));
    setPolicySaveError(null);
  }, [policyRow]);

  const loadCallUpdates = useCallback(async () => {
    if (!rowUuid) return;
    setCallUpdatesLoading(true);
    const crRes = await supabase
      .from("call_results")
      .select("*")
      .eq("lead_id", rowUuid)
      .order("updated_at", { ascending: false });
    if (!crRes.error && crRes.data) {
      setCallResultsRows(crRes.data as LeadRow[]);
    } else {
      setCallResultsRows([]);
    }
    setCallUpdatesLoading(false);
  }, [rowUuid, supabase]);

  useEffect(() => {
    if (activeTab !== "Notes" || !rowUuid || isCreation || previewMode) return;
    void loadNotes();
  }, [activeTab, rowUuid, isCreation, previewMode, loadNotes]);

  useEffect(() => {
    if (activeTab !== "Call updates" || !rowUuid || isCreation || previewMode) return;
    void loadCallUpdates();
  }, [activeTab, rowUuid, isCreation, previewMode, loadCallUpdates]);

  const addNote = async () => {
    if (!rowUuid || !newNoteText.trim()) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    setAddingNote(true);
    const { error } = await supabase.from("lead_notes").insert({
      lead_id: rowUuid,
      body: newNoteText.trim(),
      created_by: session.user.id,
    });
    setAddingNote(false);
    if (!error) {
      setNewNoteText("");
      await loadNotes();
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!window.confirm("Delete this note?")) return;
    const { error } = await supabase.from("lead_notes").delete().eq("id", noteId);
    if (!error) await loadNotes();
  };

  const patchDraft = (key: string, value: unknown) => {
    setEditDraft((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const handleSave = () => {
    if (onSubmit) onSubmit(formData);
  };

  if (!isCreation && loadingLead) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: T.textMuted, fontWeight: 600 }}>
        Loading lead…
      </div>
    );
  }

  if (!isCreation && loadError) {
    return (
      <div style={{ padding: 48 }}>
        <p style={{ color: "#b91c1c", fontWeight: 700, marginBottom: 16 }}>{loadError}</p>
        <button type="button" onClick={onBack} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${T.border}`, cursor: "pointer" }}>
          Back
        </button>
      </div>
    );
  }

  if (!isCreation && previewMode) {
    return (
      <div style={{ animation: "fadeIn 0.3s ease-out", color: T.textDark }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                background: "#fff",
                border: `1.5px solid ${T.border}`,
                borderRadius: "12px",
                width: 42,
                height: 42,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: T.textMid,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>
        <div
          style={{
            padding: 20,
            borderRadius: 16,
            background: T.blueFaint,
            border: `1px solid ${T.border}`,
            marginBottom: 20,
            fontSize: 14,
            fontWeight: 600,
            color: T.textMid,
          }}
        >
          This is a demo lead from the Assigning sandbox. Open a lead from <strong>Lead Pipeline</strong> or <strong>Transfer Leads</strong> to view and edit live records.
        </div>
        <button type="button" onClick={onBack} style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${T.border}`, cursor: "pointer", fontWeight: 700 }}>
          Back to list
        </button>
      </div>
    );
  }

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    border: `1px solid ${T.border}`,
    borderRadius: "8px",
    fontSize: 14,
    color: T.textDark,
    fontFamily: T.font,
    backgroundColor: "#fff",
    outline: "none",
    transition: "all 0.2s",
  } as const;

  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: T.textDark,
    marginBottom: 8,
  } as const;

  const convertToClientDisabled =
    !canEditLead ||
    !leadRow ||
    !rowUuid ||
    previewMode ||
    policyLoading ||
    policyRow != null;

  const convertToClientTitle = !canEditLead
    ? "You do not have permission."
    : previewMode
      ? "Not available in preview."
      : !rowUuid
        ? "Lead must finish loading."
        : policyLoading
          ? "Loading policy…"
          : policyRow
            ? "Already converted — a policy is linked. See Policy & coverage."
            : undefined;

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out", color: T.textDark }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "#fff",
              border: `1.5px solid ${T.border}`,
              borderRadius: "12px",
              width: 42,
              height: 42,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: T.textMid,
              transition: "all 0.2s",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {saveError && (
            <span style={{ fontSize: 12, color: "#b91c1c", fontWeight: 600, maxWidth: 280 }}>{saveError}</span>
          )}
          {isCreation ? (
            <>
              <button type="button" onClick={onBack} style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textDark }}>
                Cancel
              </button>
              <button type="button" onClick={handleSave} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: T.radiusMd, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${T.blue}44` }}>
                Create Lead
              </button>
            </>
          ) : isEditing ? (
            <>
              <button type="button" onClick={cancelEdit} disabled={saving} style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                Cancel
              </button>
              <button type="button" onClick={() => void saveLeadEdits()} disabled={saving || !effectiveCanEditLead} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: T.radiusMd, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: saving || !effectiveCanEditLead ? "not-allowed" : "pointer", opacity: effectiveCanEditLead ? 1 : 0.6 }}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={startEdit}
                disabled={!effectiveCanEditLead || !leadRow}
                title={!effectiveCanEditLead ? "You do not have permission to edit this lead." : undefined}
                style={{
                  backgroundColor: "#fff",
                  border: `1.5px solid ${T.border}`,
                  borderRadius: T.radiusMd,
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: effectiveCanEditLead && leadRow ? "pointer" : "not-allowed",
                  color: T.textDark,
                  opacity: effectiveCanEditLead && leadRow ? 1 : 0.55,
                }}
              >
                Edit Lead
              </button>
              <button
                type="button"
                onClick={() => setConvertClientModalOpen(true)}
                disabled={convertToClientDisabled}
                title={convertToClientTitle}
                style={{
                  backgroundColor: convertToClientDisabled ? T.border : T.blue,
                  color: "#fff",
                  border: "none",
                  borderRadius: T.radiusMd,
                  padding: "10px 24px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: convertToClientDisabled ? "not-allowed" : "pointer",
                  boxShadow: `0 4px 12px ${T.blue}44`,
                  opacity: convertToClientDisabled ? 0.65 : 1,
                }}
              >
                Convert to Client
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {activeTab === "Overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <LeadSummaryCard lead={sampleLead} />
          </div>
        )}

        {activeTab === "Call updates" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <CallUpdatesTab
              callResultsRows={callResultsRows}
              callUpdatesLoading={callUpdatesLoading}
              isCreation={isCreation}
              previewMode={previewMode}
            />
          </div>
        )}

        {activeTab === "Notes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <NotesTab
              leadNotes={leadNotes}
              notesLoading={notesLoading}
              newNoteText={newNoteText}
              setNewNoteText={setNewNoteText}
              addingNote={addingNote}
              addNote={addNote}
              deleteNote={deleteNote}
              isCreation={isCreation}
              previewMode={previewMode}
              canEditLead={effectiveCanEditLead}
            />
          </div>
        )}

        {activeTab === "Policy & coverage" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PolicyCoverageTab
              policyRow={policyRow}
              policyLoading={policyLoading}
              policyDraft={policyDraft}
              setPolicyDraft={setPolicyDraft}
              policySaving={policySaving}
              policySaveError={policySaveError}
              savePolicyFromTab={savePolicyFromTab}
              resetPolicyDraft={resetPolicyDraft}
              policyCallCenterNames={policyCallCenterNames}
              policyCarrierNames={policyCarrierNames}
              policyStageNames={policyStageNames}
              policyLookupReady={policyLookupReady}
              canEditLead={canEditLead}
              previewMode={previewMode}
            />
          </div>
        )}
      </div>

      {!isCreation && !previewMode && (
        <ConvertClientPolicyModal
          open={convertClientModalOpen}
          onClose={() => setConvertClientModalOpen(false)}
          leadId={rowUuid}
          policyRow={policyRow}
          leadRow={leadRow}
          onSaved={() => void loadPolicyForLead()}
        />
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// Tab Content Components
function CallUpdatesTab({
  callResultsRows,
  callUpdatesLoading,
  isCreation,
  previewMode,
}: {
  callResultsRows: LeadRow[];
  callUpdatesLoading: boolean;
  isCreation: boolean | undefined;
  previewMode: boolean | undefined;
}) {
  if (isCreation || previewMode) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>
        Call updates are not available in {isCreation ? "creation" : "preview"} mode.
      </div>
    );
  }

  if (callUpdatesLoading) {
    return <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Loading call updates…</div>;
  }

  if (callResultsRows.length === 0) {
    return (
      <EmptyState
        title="No call updates"
        description="Call activity will appear here when agents contact this lead."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {callResultsRows.map((row, idx) => (
        <div
          key={idx}
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            border: `1.5px solid ${T.border}`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
            padding: "20px 24px",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {CALL_RESULT_FIELD_ORDER.map((field) => (
              <div key={field.key}>
                <p style={{ margin: "0 0 4px", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
                  {field.label}
                </p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.textDark }}>
                  {field.format ? field.format(row[field.key]) : fmt(row[field.key])}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NotesTab({
  leadNotes,
  notesLoading,
  newNoteText,
  setNewNoteText,
  addingNote,
  addNote,
  deleteNote,
  isCreation,
  previewMode,
  canEditLead,
}: {
  leadNotes: LeadNoteRow[];
  notesLoading: boolean;
  newNoteText: string;
  setNewNoteText: (text: string) => void;
  addingNote: boolean;
  addNote: () => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  isCreation: boolean | undefined;
  previewMode: boolean | undefined;
  canEditLead: boolean;
}) {
  if (isCreation || previewMode) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>
        Notes are not available in {isCreation ? "creation" : "preview"} mode.
      </div>
    );
  }

  if (notesLoading) {
    return <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Loading notes…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Add Note Input */}
      {canEditLead && (
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            border: `1.5px solid ${T.border}`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
            padding: "20px 24px",
          }}
        >
          <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: T.textDark }}>Add Note</p>
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Enter note..."
            style={{
              width: "100%",
              padding: "12px 16px",
              border: `1px solid ${T.border}`,
              borderRadius: "8px",
              fontSize: 14,
              color: T.textDark,
              fontFamily: T.font,
              backgroundColor: "#fff",
              outline: "none",
              resize: "vertical",
              minHeight: 80,
              marginBottom: 12,
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => void addNote()}
              disabled={addingNote || !newNoteText.trim()}
              style={{
                backgroundColor: T.blue,
                color: "#fff",
                border: "none",
                borderRadius: T.radiusMd,
                padding: "10px 24px",
                fontSize: 13,
                fontWeight: 700,
                cursor: addingNote || !newNoteText.trim() ? "not-allowed" : "pointer",
                opacity: addingNote || !newNoteText.trim() ? 0.6 : 1,
              }}
            >
              {addingNote ? "Adding…" : "Add Note"}
            </button>
          </div>
        </div>
      )}

      {/* Notes List */}
      {leadNotes.length === 0 ? (
        <EmptyState
          title="No notes"
          description="Add notes to track important information about this lead."
        />
      ) : (
        leadNotes.map((note) => (
          <div
            key={note.id}
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              border: `1.5px solid ${T.border}`,
              boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
              padding: "20px 24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.textDark }}>
                  {note.authorName || "User"}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: T.textMuted }}>
                  {formatTs(note.created_at)}
                </p>
              </div>
              {canEditLead && (
                <button
                  type="button"
                  onClick={() => void deleteNote(note.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#b91c1c",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 8px",
                  }}
                >
                  Delete
                </button>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 14, color: T.textDark, whiteSpace: "pre-wrap" }}>{note.body}</p>
          </div>
        ))
      )}
    </div>
  );
}

function PolicyCoverageTab({
  policyRow,
  policyLoading,
  policyDraft,
  setPolicyDraft,
  policySaving,
  policySaveError,
  savePolicyFromTab,
  resetPolicyDraft,
  policyCallCenterNames,
  policyCarrierNames,
  policyStageNames,
  policyLookupReady,
  canEditLead,
  previewMode,
}: {
  policyRow: PolicyRow | null;
  policyLoading: boolean;
  policyDraft: Record<string, string>;
  setPolicyDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  policySaving: boolean;
  policySaveError: string | null;
  savePolicyFromTab: () => Promise<void>;
  resetPolicyDraft: () => void;
  policyCallCenterNames: string[];
  policyCarrierNames: string[];
  policyStageNames: string[];
  policyLookupReady: boolean;
  canEditLead: boolean | undefined;
  previewMode: boolean | undefined;
}) {
  if (previewMode) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>
        Policy & coverage is not available in preview mode.
      </div>
    );
  }

  if (policyLoading) {
    return <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Loading policy…</div>;
  }

  if (!policyRow) {
    return (
      <EmptyState
        title="No policy linked"
        description="This lead hasn't been converted to a client yet. Click 'Convert to Client' to create a policy."
      />
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: `1.5px solid ${T.border}`,
        boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
        padding: "24px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.textDark }}>Policy Details</p>
        {canEditLead && (
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={resetPolicyDraft}
              disabled={policySaving}
              style={{
                backgroundColor: "#fff",
                border: `1.5px solid ${T.border}`,
                borderRadius: T.radiusMd,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: policySaving ? "not-allowed" : "pointer",
                color: T.textDark,
              }}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => void savePolicyFromTab()}
              disabled={policySaving || !policyLookupReady}
              style={{
                backgroundColor: T.blue,
                color: "#fff",
                border: "none",
                borderRadius: T.radiusMd,
                padding: "8px 20px",
                fontSize: 13,
                fontWeight: 700,
                cursor: policySaving || !policyLookupReady ? "not-allowed" : "pointer",
                opacity: policyLookupReady ? 1 : 0.6,
              }}
            >
              {policySaving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {policySaveError && (
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#fef2f2", borderRadius: 8, color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
          {policySaveError}
        </div>
      )}

      <PolicyFormFields
        draft={policyDraft}
        onChange={(key, value) => setPolicyDraft((prev) => ({ ...prev, [key]: value }))}
        callCenterNames={policyCallCenterNames}
        carrierNames={policyCarrierNames}
        stageNames={policyStageNames}
        lookupReady={policyLookupReady}
      />
    </div>
  );
}


function ProjectCard({ id, name, created, priority, allTasks, activeTasks, assignees, extraAssignees, emoji, color }: any) {
  return (
    <div style={{
      backgroundColor: "#fff", borderRadius: 20, overflow: "hidden",
      border: `1.5px solid ${T.border}`,
      boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
      display: "grid", gridTemplateColumns: "1.2fr 1fr 0.8fr",
      alignItems: "stretch"
    }}>
      {/* Detail Section */}
      <div style={{ padding: "20px 24px", borderRight: `1px solid ${T.borderLight}`, display: "flex", gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{emoji}</div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: T.textMuted }}>{id}</p>
          <h4 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800, color: T.textDark }}>{name}</h4>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
             <div style={{ display: "flex", alignItems: "center", gap: 4, color: T.textMuted }}>
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
               <span style={{ fontSize: 11, fontWeight: 600 }}>Created {created}</span>
             </div>
             <div style={{ display: "flex", alignItems: "center", gap: 3, color: priority === "Low" ? "#16a34a" : "#ca8a04" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d={priority === "Low" ? "M12 19V5M19 12l-7 7-7-7" : "M12 5v14M5 12l7-7 7 7"}/></svg>
                <span style={{ fontSize: 11, fontWeight: 800 }}>{priority}</span>
             </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div style={{ padding: "20px 24px", borderRight: `1px solid ${T.borderLight}`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: T.textDark }}>Project Data</p>
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: T.textMuted, fontWeight: 700 }}>All tasks</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.textDark }}>{allTasks}</p>
          </div>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: T.textMuted, fontWeight: 700 }}>Active tasks</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.textDark }}>{activeTasks}</p>
          </div>
        </div>
      </div>

      {/* Assignees Section */}
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: T.textDark }}>Assignees</p>
        <div style={{ display: "flex", alignItems: "center" }}>
          {assignees.map((c: string, i: number) => (
            <div key={i} style={{ 
              width: 28, height: 28, borderRadius: "50%", backgroundColor: c, border: "2px solid #fff", 
              marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff"
            }}>
              {["SS","RD","ET","LC"][i]}
            </div>
          ))}
          {extraAssignees > 0 && (
            <div style={{ 
              width: 28, height: 28, borderRadius: "50%", backgroundColor: T.blueFaint, border: "2px solid #fff", 
              marginLeft: -8, zIndex: 0, color: T.blue, fontSize: 10, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              +{extraAssignees}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface LeadSummaryCardProps {
  lead: {
    // 1. Personal & Contact Information
    first_name?: string;
    last_name?: string;
    social?: string;
    driver_license_number?: string;
    date_of_birth?: string;
    age?: number;
    birth_state?: string;
    language?: string;
    phone?: string;
    email?: string;
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    zip_code?: string;

    // 2. Health & Underwriting Data
    height?: string;
    weight?: string;
    health_conditions?: string;
    medications?: string;
    doctor_name?: string;
    tobacco_use?: boolean;
    existing_coverage_last_2_years?: string;
    previous_applications_2_years?: string;

    // 3. Policy & Coverage Details
    carrier?: string;
    product_type?: string;
    coverage_amount?: number;
    monthly_premium?: number;
    lead_value?: number;
    draft_date?: string;
    future_draft_date?: string;
    beneficiary_information?: string;
    additional_information?: string;

    // 4. Financial & System Metadata
    id?: string;
    lead_unique_id?: string;
    submission_id?: string;
    stage?: string;
    stage_id?: string;
    pipeline_id?: string;
    is_draft?: boolean;
    tags?: string[];
    bank_account_type?: string;
    institution_name?: string;
    routing_number?: string;
    account_number?: string;
    created_at?: string;
    updated_at?: string;
    submission_date?: string;
    submitted_by?: string;
    call_center_id?: string;
    licensed_agent_account?: string;
    lead_source?: string;
  };
}

function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        backgroundColor: "#EEF5EE",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.textDark }}>{title}</p>
        {subtitle && <p style={{ margin: "2px 0 0", fontSize: 12, color: T.textMuted, fontWeight: 500 }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: "0 0 4px", fontSize: 12, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.textDark }}>
        {value || "—"}
      </p>
    </div>
  );
}

function LeadSummaryCard({ lead }: LeadSummaryCardProps) {
  // Helper to format currency
  const formatCurrency = (val: number | undefined) => {
    if (val == null) return "—";
    return `$${Number(val).toLocaleString()}`;
  };

  // Helper to format boolean
  const formatBool = (val: boolean | undefined) => {
    if (val === true) return "Yes";
    if (val === false) return "No";
    return "—";
  };

  // Helper to format date
  const formatDate = (val: string | undefined) => {
    if (!val) return "—";
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}>
      {/* Section 1: Personal & Contact Information */}
      <div style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: `1.5px solid ${T.border}`,
        boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
        padding: "24px",
      }}>
        <SectionHeader icon="👤" title="Personal & Contact Information" subtitle="Identity, demographics, and location details" />

        {/* Identity Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.borderLight}` }}>
          <InfoField label="First Name" value={lead.first_name} />
          <InfoField label="Last Name" value={lead.last_name} />
          <InfoField label="SSN" value={lead.social} />
          <InfoField label="Driver's License" value={lead.driver_license_number} />
        </div>

        {/* Demographics Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.borderLight}` }}>
          <InfoField label="Date of Birth" value={formatDate(lead.date_of_birth)} />
          <InfoField label="Age" value={lead.age} />
          <InfoField label="Birth State" value={lead.birth_state} />
          <InfoField label="Preferred Language" value={lead.language} />
        </div>

        {/* Contact Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.borderLight}` }}>
          <InfoField label="Phone" value={lead.phone} />
          <InfoField label="Email" value={lead.email} />
        </div>

        {/* Address Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          <InfoField label="Street Address" value={`${lead.street1 || ""} ${lead.street2 ? lead.street2 : ""}`.trim()} />
          <InfoField label="City" value={lead.city} />
          <InfoField label="State" value={lead.state} />
          <InfoField label="ZIP Code" value={lead.zip_code} />
        </div>
      </div>

      {/* Section 2: Health & Underwriting Data */}
      <div style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: `1.5px solid ${T.border}`,
        boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
        padding: "24px",
      }}>
        <SectionHeader icon="🏥" title="Health & Underwriting Data" subtitle="Risk assessment and medical history" />

        {/* Physical Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.borderLight}` }}>
          <InfoField label="Height" value={lead.height} />
          <InfoField label="Weight" value={lead.weight} />
          <InfoField label="Tobacco Use" value={formatBool(lead.tobacco_use)} />
          <InfoField label="Doctor Name" value={lead.doctor_name} />
        </div>

        {/* Medical History */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.borderLight}` }}>
          <InfoField label="Health Conditions" value={lead.health_conditions} />
          <InfoField label="Current Medications" value={lead.medications} />
        </div>

        {/* History */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
          <InfoField label="Existing Coverage (Last 2 Years)" value={lead.existing_coverage_last_2_years} />
          <InfoField label="Previous Applications (Last 2 Years)" value={lead.previous_applications_2_years} />
        </div>
      </div>

      {/* Section 3: Policy & Coverage Details */}
      <div style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: `1.5px solid ${T.border}`,
        boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
        padding: "24px",
      }}>
        <SectionHeader icon="🛡️" title="Policy & Coverage Details" subtitle="Insurance product and financial information" />

        {/* Product Info */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.borderLight}` }}>
          <InfoField label="Carrier" value={lead.carrier} />
          <InfoField label="Product Type" value={lead.product_type} />
          <InfoField label="Coverage Amount" value={formatCurrency(lead.coverage_amount)} />
        </div>

        {/* Financials */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.borderLight}` }}>
          <InfoField label="Monthly Premium" value={formatCurrency(lead.monthly_premium)} />
          <InfoField label="Lead Value" value={formatCurrency(lead.lead_value)} />
          <InfoField label="Beneficiary Info" value={lead.beneficiary_information} />
        </div>

        {/* Logistics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.borderLight}` }}>
          <InfoField label="Draft Date" value={formatDate(lead.draft_date)} />
          <InfoField label="Future Draft Date" value={formatDate(lead.future_draft_date)} />
          <InfoField label="Lead Source" value={lead.lead_source} />
        </div>

        {/* Notes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
          <InfoField label="Additional Information" value={lead.additional_information} />
        </div>
      </div>

      {/* Section 4: Financial & System Metadata */}
      <div style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: `1.5px solid ${T.border}`,
        boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
        padding: "24px",
      }}>
        <SectionHeader icon="⚙️" title="Financial & System Metadata" subtitle="Banking details and CRM workflow data" />

        {/* Banking */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.borderLight}` }}>
          <InfoField label="Account Type" value={lead.bank_account_type} />
          <InfoField label="Institution" value={lead.institution_name} />
          <InfoField label="Routing Number" value={lead.routing_number} />
          <InfoField label="Account Number" value={lead.account_number} />
        </div>

        {/* Workflow/CRM */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.borderLight}` }}>
          <InfoField label="Lead ID" value={lead.lead_unique_id} />
          <InfoField label="Submission ID" value={lead.submission_id} />
          <InfoField label="Stage" value={lead.stage} />
          <InfoField label="Is Draft" value={formatBool(lead.is_draft)} />
        </div>

        {/* Tags */}
        <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.borderLight}` }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px" }}>
            Tags
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {lead.tags && lead.tags.length > 0 ? (
              lead.tags.map((tag, i) => (
                <span key={i} style={{
                  backgroundColor: "#EEF5EE",
                  color: "#4e6e3a",
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  {tag}
                </span>
              ))
            ) : (
              <span style={{ color: T.textMuted, fontSize: 14 }}>—</span>
            )}
          </div>
        </div>

        {/* Audit Trail */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          <InfoField label="Created At" value={formatDate(lead.created_at)} />
          <InfoField label="Updated At" value={formatDate(lead.updated_at)} />
          <InfoField label="Submission Date" value={formatDate(lead.submission_date)} />
          <InfoField label="Submitted By" value={lead.submitted_by} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginTop: 16 }}>
          <InfoField label="Call Center ID" value={lead.call_center_id} />
          <InfoField label="Licensed Agent" value={lead.licensed_agent_account} />
          <InfoField label="Lead Source" value={lead.lead_source} />
        </div>
      </div>
    </div>
  );
}