import { useState, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { LayoutDashboard, Phone, FileText, Shield } from "lucide-react";
import { POLICY_SCHEMA_SECTIONS, policyDisplayValue, type PolicyRow } from "@/lib/policy-schema";
import { buildDraftFromPolicyRow, payloadFromDraft } from "@/lib/policy-form-utils";
import { EmptyState, Toast } from "@/components/ui";
import ConvertClientPolicyModal from "./ConvertClientPolicyModal";
import PolicyFormFields from "./PolicyFormFields";
import { getCurrentUserPermissionKeys, type PermissionKey } from "@/lib/auth/permissions";
import { LeadCard, InfoField, InfoGrid, formatCurrency, formatBool, formatDate } from "./LeadCard";
import { LeadEditForm, useLeadEdit } from "./LeadEditForm";

interface Lead {
  name: string;
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
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-start",
        gap: 4,
        padding: 4,
        backgroundColor: T.sidebarBg,
        borderRadius: 10,
      }}
    >
      {TAB_CONFIG.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 10,
              border: "none",
              background: isActive ? "#233217" : "transparent",
              color: isActive ? "#fff" : T.textMuted,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: T.font,
              cursor: "pointer",
              boxShadow: isActive ? "0 2px 8px rgba(35, 50, 23, 0.2)" : "none",
              transition: "all 0.15s ease-in-out",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Icon size={12} />
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
    phone: "+1 (555) 000-0000",
    premium: 0,
    type: "Auto Insurance",
    source: "Manual Entry",
    pipeline: defaultPipeline || "Sales Pipeline",
    stage: defaultStage || "New Lead",
  });

  const [rowUuid, setRowUuid] = useState<string | null>(leadRowUuid ?? null);
  const [leadRow, setLeadRow] = useState<LeadRow | null>(null);
  const [loadingLead, setLoadingLead] = useState(!isCreation && !previewMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editToast, setEditToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [leadNotes, setLeadNotes] = useState<LeadNoteRow[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [userPermissionKeys, setUserPermissionKeys] = useState<Set<PermissionKey>>(new Set());
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

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
      setSessionUserId(user.id);
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

  // Check edit permission from Supabase (falls back to prop if permissions still loading)
  const effectiveCanEditLead = useMemo(() => {
    // Use prop value if permissions are still loading
    if (permissionsLoading) return canEditLead;
    // Check Supabase permissions - has either lead_pipeline.update or transfer_leads.edit
    const hasEditPermission = userPermissionKeys.has("action.lead_pipeline.update") || 
                              userPermissionKeys.has("action.transfer_leads.edit");
    return hasEditPermission;
  }, [permissionsLoading, canEditLead, userPermissionKeys]);

  // Lead Edit Form hook
  const {
    pipelines: editFormPipelines,
    stages: editFormStages,
    licensedAgents: editFormLicensedAgents,
    isLoading: editFormLoading,
    isSaving: editFormSaving,
    error: editFormError,
    toast: editFormToast,
    saveLead,
    deleteLead,
    clearToast,
  } = useLeadEdit({
    leadRowUuid: rowUuid,
    canEdit: effectiveCanEditLead,
    onSave: (updated) => {
      setLeadRow(updated as LeadRow);
      setIsEditing(false);
    },
    onDelete: () => {
      onBack();
    },
  });

  const pipelineNameForStages = (() => {
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
    if (previewMode && leadName) return leadName;
    if (!leadRow) return leadName || "Lead";
    const combined = `${String(leadRow.first_name ?? "").trim()} ${String(leadRow.last_name ?? "").trim()}`.trim();
    return combined || leadName || "Lead";
  }, [leadRow, leadName, previewMode]);

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

  const deleteNote = async (noteId: string) => {
    if (!window.confirm("Delete this note?")) return;
    const { error } = await supabase.from("lead_notes").delete().eq("id", noteId);
    if (!error) await loadNotes();
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
    !effectiveCanEditLead ||
    !leadRow ||
    !rowUuid ||
    previewMode ||
    policyLoading ||
    policyRow != null;

  const convertToClientTitle = !effectiveCanEditLead
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
          {isCreation ? (
            <>
              <button type="button" onClick={onBack} style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textDark }}>
                Cancel
              </button>
              <button type="button" onClick={handleSave} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: T.radiusMd, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${T.blue}44` }}>
                Create Lead
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                disabled={!effectiveCanEditLead || !leadRow}
                title={!effectiveCanEditLead ? "You do not have permission to edit this lead." : undefined}
                style={{
                  border: `1px solid ${T.border}`,
                  borderRadius: T.radiusMd,
                  background: T.cardBg,
                  color: "#233217",
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "10px 20px",
                  cursor: effectiveCanEditLead && leadRow ? "pointer" : "not-allowed",
                  opacity: effectiveCanEditLead && leadRow ? 1 : 0.55,
                  transition: "all 0.15s ease-in-out",
                }}
                onMouseEnter={(e) => {
                  if (effectiveCanEditLead && leadRow) {
                    e.currentTarget.style.backgroundColor = "#233217";
                    e.currentTarget.style.color = "#fff";
                    e.currentTarget.style.borderColor = "#233217";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = T.cardBg;
                  e.currentTarget.style.color = "#233217";
                  e.currentTarget.style.borderColor = T.border;
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
                  border: `1px solid ${convertToClientDisabled ? T.border : "#233217"}`,
                  borderRadius: T.radiusMd,
                  background: convertToClientDisabled ? T.cardBg : "#233217",
                  color: convertToClientDisabled ? "#233217" : "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "10px 24px",
                  cursor: convertToClientDisabled ? "not-allowed" : "pointer",
                  opacity: convertToClientDisabled ? 0.65 : 1,
                  transition: "all 0.15s ease-in-out",
                }}
                onMouseEnter={(e) => {
                  if (!convertToClientDisabled) {
                    e.currentTarget.style.backgroundColor = "#1a260f";
                    e.currentTarget.style.borderColor = "#1a260f";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!convertToClientDisabled) {
                    e.currentTarget.style.backgroundColor = "#233217";
                    e.currentTarget.style.borderColor = "#233217";
                  }
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
            {loadingLead ? (
              <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Loading lead data…</div>
            ) : leadRow ? (
              <LeadSummaryCard lead={leadRow as LeadSummaryCardProps["lead"]} />
            ) : (
              <EmptyState title="No lead data" description="Unable to load lead information." />
            )}
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

      {/* Toast notification for edit form */}
      {(editFormToast || editToast) && (
        <Toast
          message={(editFormToast || editToast)?.message || ""}
          type={(editFormToast || editToast)?.type || "success"}
          onClose={() => {
            clearToast();
            setEditToast(null);
          }}
        />
      )}

      {/* Lead Edit Modal */}
      {isEditing && leadRow && (
        <LeadEditForm
          // Use exact lead values from leadRow (from LeadViewComponent's state)
          lead={{
            // Contact Information
            firstName: String(leadRow.first_name ?? ""),
            lastName: String(leadRow.last_name ?? ""),
            phone: String(leadRow.phone ?? ""),
            language: String(leadRow.language ?? ""),
            
            // Address
            street1: String(leadRow.street1 ?? ""),
            street2: String(leadRow.street2 ?? ""),
            city: String(leadRow.city ?? ""),
            state: String(leadRow.state ?? ""),
            zipCode: String(leadRow.zip_code ?? ""),
            
            // Personal Details
            dateOfBirth: String(leadRow.date_of_birth ?? ""),
            social: String(leadRow.social ?? ""),
            driverLicenseNumber: String(leadRow.driver_license_number ?? ""),
            birthState: String(leadRow.birth_state ?? ""),
            age: String(leadRow.age ?? ""),
            
            // Health & Underwriting (all text in DB)
            height: String(leadRow.height ?? ""),
            weight: String(leadRow.weight ?? ""),
            tobaccoUse: String(leadRow.tobacco_use ?? ""),
            healthConditions: String(leadRow.health_conditions ?? ""),
            medications: String(leadRow.medications ?? ""),
            doctorName: String(leadRow.doctor_name ?? ""),
            existingCoverage: String(leadRow.existing_coverage_last_2_years ?? ""),
            previousApplications: String(leadRow.previous_applications_2_years ?? ""),
            
            // Pipeline & Stage (use IDs from DB)
            pipelineId: leadRow.pipeline_id != null ? Number(leadRow.pipeline_id) : null,
            stageId: leadRow.stage_id != null ? Number(leadRow.stage_id) : null,
            
            // Opportunity Details
            leadValue: leadRow.lead_value != null ? Number(leadRow.lead_value) : null,
            licensedAgentAccount: String(leadRow.licensed_agent_account ?? ""),
            leadSource: String(leadRow.lead_source ?? ""),
            tags: Array.isArray(leadRow.tags) ? (leadRow.tags as string[]).join(", ") : String(leadRow.tags ?? ""),
            submissionDate: String(leadRow.submission_date ?? ""),
            
            // Policy & Coverage (all text in DB)
            carrier: String(leadRow.carrier ?? ""),
            productType: String(leadRow.product_type ?? ""),
            coverageAmount: String(leadRow.coverage_amount ?? ""),
            monthlyPremium: String(leadRow.monthly_premium ?? ""),
            draftDate: String(leadRow.draft_date ?? ""),
            futureDraftDate: String(leadRow.future_draft_date ?? ""),
            beneficiaryInformation: String(leadRow.beneficiary_information ?? ""),
            additionalInformation: String(leadRow.additional_information ?? ""),
            
            // Banking Details
            bankAccountType: String(leadRow.bank_account_type ?? ""),
            institutionName: String(leadRow.institution_name ?? ""),
            routingNumber: String(leadRow.routing_number ?? ""),
            accountNumber: String(leadRow.account_number ?? ""),
          }}
          pipelines={editFormPipelines.length > 0 ? editFormPipelines : pipelines.map(p => ({ id: p.id, name: p.name }))}
          stages={editFormStages.length > 0 ? editFormStages : (currentPipeline?.stages || []).map((s, idx) => ({ id: idx + 1, name: s }))}
          licensedAgents={editFormLicensedAgents}
          canEdit={effectiveCanEditLead}
          onSubmit={async (data) => {
            await saveLead(data);
            if (editFormToast?.type === "success") {
              setIsEditing(false);
            }
          }}
          onCancel={() => setIsEditing(false)}
          onDelete={effectiveCanEditLead ? async () => {
            await deleteLead();
            if (editFormToast?.type === "success") {
              onBack();
            }
          } : undefined}
          isSaving={editFormSaving}
          isLoading={editFormLoading}
          error={editFormError}
          title={`Edit "${fullName}"`}
          // Notes management props
          leadRowUuid={rowUuid}
          canEditNotes={effectiveCanEditLead}
          sessionUserId={sessionUserId}
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
      <LeadCard icon="📞" title="Call Updates" subtitle="Not available" collapsible={false}>
        <div style={{ padding: 20, textAlign: "center", color: T.textMuted }}>
          Call updates are not available in {isCreation ? "creation" : "preview"} mode.
        </div>
      </LeadCard>
    );
  }

  if (callUpdatesLoading) {
    return (
      <LeadCard icon="📞" title="Call Updates" subtitle="Loading..." collapsible={false}>
        <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Loading call updates…</div>
      </LeadCard>
    );
  }

  if (callResultsRows.length === 0) {
    return (
      <LeadCard icon="📞" title="Call Updates" subtitle="No activity yet" collapsible={false}>
        <EmptyState
          title="No call updates"
          description="Call activity will appear here when agents contact this lead."
        />
      </LeadCard>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {callResultsRows.map((row, idx) => (
        <LeadCard
          key={idx}
          icon="📞"
          title={`Call Update #${idx + 1}`}
          subtitle={row.created_at ? formatDate(String(row.created_at)) : undefined}
          defaultExpanded={idx === 0}
        >
          <InfoGrid columns={3} bordered={false}>
            {CALL_RESULT_FIELD_ORDER.map((field) => (
              <InfoField
                key={field.key}
                label={field.label}
                value={field.format ? field.format(row[field.key]) : fmt(row[field.key])}
              />
            ))}
          </InfoGrid>
        </LeadCard>
      ))}
    </div>
  );
}

function NotesTab({
  leadNotes,
  notesLoading,
  deleteNote,
  isCreation,
  previewMode,
  canEditLead,
}: {
  leadNotes: LeadNoteRow[];
  notesLoading: boolean;
  deleteNote: (id: string) => Promise<void>;
  isCreation: boolean | undefined;
  previewMode: boolean | undefined;
  canEditLead: boolean;
}) {
  if (isCreation || previewMode) {
    return (
      <LeadCard icon="📝" title="Notes" subtitle="Not available" collapsible={false}>
        <div style={{ padding: 20, textAlign: "center", color: T.textMuted }}>
          Notes are not available in {isCreation ? "creation" : "preview"} mode.
        </div>
      </LeadCard>
    );
  }

  if (notesLoading) {
    return (
      <LeadCard icon="📝" title="Notes" subtitle="Loading..." collapsible={false}>
        <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Loading notes…</div>
      </LeadCard>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Notes List */}
      {leadNotes.length === 0 ? (
        <LeadCard icon="📝" title="Notes" subtitle="No notes yet" collapsible={false}>
          <EmptyState
            title="No notes"
            description="No notes have been added yet."
          />
        </LeadCard>
      ) : (
        leadNotes.map((note) => (
          <LeadCard
            key={note.id}
            icon="📝"
            title={note.authorName || "User"}
            subtitle={formatTs(note.created_at)}
            defaultExpanded={true}
            actions={
              canEditLead ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteNote(note.id);
                  }}
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
              ) : undefined
            }
          >
            <p style={{ margin: 0, fontSize: 14, color: T.textDark, whiteSpace: "pre-wrap" }}>{note.body}</p>
          </LeadCard>
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
      <LeadCard icon="🛡️" title="Policy & Coverage" subtitle="Not available" collapsible={false}>
        <div style={{ padding: 20, textAlign: "center", color: T.textMuted }}>
          Policy & coverage is not available in preview mode.
        </div>
      </LeadCard>
    );
  }

  if (policyLoading) {
    return (
      <LeadCard icon="🛡️" title="Policy & Coverage" subtitle="Loading..." collapsible={false}>
        <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Loading policy…</div>
      </LeadCard>
    );
  }

  if (!policyRow) {
    return (
      <LeadCard icon="🛡️" title="Policy & Coverage" subtitle="No policy linked" collapsible={false}>
        <EmptyState
          title="No policy linked"
          description="This lead hasn't been converted to a client yet. Click 'Convert to Client' to create a policy."
        />
      </LeadCard>
    );
  }

  return (
    <LeadCard
      icon="🛡️"
      title="Policy Details"
      subtitle="Edit policy information"
      collapsible={false}
      actions={
        canEditLead ? (
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetPolicyDraft();
              }}
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
              onClick={(e) => {
                e.stopPropagation();
                void savePolicyFromTab();
              }}
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
        ) : undefined
      }
    >
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
    </LeadCard>
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


function LeadSummaryCard({ lead }: LeadSummaryCardProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}>
      {/* Section 1: Personal & Contact Information */}
      <LeadCard
        icon="👤"
        title="Personal & Contact Information"
        subtitle="Identity, demographics, and location details"
      >
        <InfoGrid columns={4}>
          <InfoField label="Full Name" value={`${lead.first_name || ""} ${lead.last_name || ""}`.trim()} />
          <InfoField label="SSN" value={lead.social} />
          <InfoField label="Driver's License" value={lead.driver_license_number} />
          <InfoField label="Phone" value={lead.phone} />
        </InfoGrid>

        <InfoGrid columns={4}>
          <InfoField label="Date of Birth" value={formatDate(lead.date_of_birth)} />
          <InfoField label="Age" value={lead.age} />
          <InfoField label="Birth State" value={lead.birth_state} />
          <InfoField label="Preferred Language" value={lead.language} />
        </InfoGrid>

        <InfoGrid columns={4} bordered={false}>
          <InfoField label="Street Address" value={`${lead.street1 || ""} ${lead.street2 ? lead.street2 : ""}`.trim()} />
          <InfoField label="City" value={lead.city} />
          <InfoField label="State" value={lead.state} />
          <InfoField label="ZIP Code" value={lead.zip_code} />
        </InfoGrid>
      </LeadCard>

      {/* Section 2: Health & Underwriting Data */}
      <LeadCard
        icon="🏥"
        title="Health & Underwriting Data"
        subtitle="Risk assessment and medical history"
      >
        <InfoGrid columns={4}>
          <InfoField label="Height" value={lead.height} />
          <InfoField label="Weight" value={lead.weight} />
          <InfoField label="Tobacco Use" value={formatBool(lead.tobacco_use)} />
          <InfoField label="Doctor Name" value={lead.doctor_name} />
        </InfoGrid>

        <InfoGrid columns={2}>
          <InfoField label="Health Conditions" value={lead.health_conditions} />
          <InfoField label="Current Medications" value={lead.medications} />
        </InfoGrid>

        <InfoGrid columns={2} bordered={false}>
          <InfoField label="Existing Coverage (Last 2 Years)" value={lead.existing_coverage_last_2_years} />
          <InfoField label="Previous Applications (Last 2 Years)" value={lead.previous_applications_2_years} />
        </InfoGrid>
      </LeadCard>

      {/* Section 3: Policy & Coverage Details */}
      <LeadCard
        icon="🛡️"
        title="Policy & Coverage Details"
        subtitle="Insurance product and financial information"
      >
        <InfoGrid columns={3}>
          <InfoField label="Carrier" value={lead.carrier} />
          <InfoField label="Product Type" value={lead.product_type} />
          <InfoField label="Coverage Amount" value={formatCurrency(lead.coverage_amount)} />
        </InfoGrid>

        <InfoGrid columns={3}>
          <InfoField label="Monthly Premium" value={formatCurrency(lead.monthly_premium)} />
          <InfoField label="Lead Value" value={formatCurrency(lead.lead_value)} />
          <InfoField label="Beneficiary Info" value={lead.beneficiary_information} />
        </InfoGrid>

        <InfoGrid columns={3}>
          <InfoField label="Draft Date" value={formatDate(lead.draft_date)} />
          <InfoField label="Future Draft Date" value={formatDate(lead.future_draft_date)} />
          <InfoField label="Lead Source" value={lead.lead_source} />
        </InfoGrid>

        <InfoGrid columns={1} bordered={false}>
          <InfoField label="Additional Information" value={lead.additional_information} />
        </InfoGrid>
      </LeadCard>

      {/* Section 4: Financial & System Metadata */}
      <LeadCard
        icon="⚙️"
        title="Financial & System Metadata"
        subtitle="Banking details and CRM workflow data"
      >
        <InfoGrid columns={4}>
          <InfoField label="Account Type" value={lead.bank_account_type} />
          <InfoField label="Institution" value={lead.institution_name} />
          <InfoField label="Routing Number" value={lead.routing_number} />
          <InfoField label="Account Number" value={lead.account_number} />
        </InfoGrid>

        <InfoGrid columns={4}>
          <InfoField label="Lead ID" value={lead.lead_unique_id} />
          <InfoField label="Submission ID" value={lead.submission_id} />
          <InfoField label="Stage" value={lead.stage} />
          <InfoField label="Is Draft" value={formatBool(lead.is_draft)} />
        </InfoGrid>

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

        <InfoGrid columns={4} bordered={false}>
          <InfoField label="Created At" value={formatDate(lead.created_at)} />
          <InfoField label="Updated At" value={formatDate(lead.updated_at)} />
          <InfoField label="Submission Date" value={formatDate(lead.submission_date)} />
          <InfoField label="Submitted By" value={lead.submitted_by} />
        </InfoGrid>
      </LeadCard>
    </div>
  );
}