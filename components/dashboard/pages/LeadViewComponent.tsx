import { useState, useEffect, useMemo, useCallback } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui";

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

type CallUpdateLogRow = {
  id: string;
  event_type: string;
  event_details: unknown;
  created_at: string;
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

/** Single policy row from `public.policies` (keyed by schema column names). */
type PolicyRow = Record<string, unknown>;

type PolicyFieldSpec = {
  key: string;
  label: string;
  /** Match `public.policies` column semantics */
  wide?: boolean;
  multiline?: boolean;
  kind?: "text" | "ts" | "num" | "bool";
};

function policyDisplayValue(row: PolicyRow | null, key: string, kind: PolicyFieldSpec["kind"] = "text"): string {
  if (!row) return "";
  const v = row[key];
  if (v == null || v === "") return "";
  if (kind === "bool") return fmtBool(v);
  if (kind === "ts") return formatTs(v);
  if (kind === "num") {
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : String(v);
  }
  return String(v);
}

/** Read-only layout aligned to `public.policies` columns (see Supabase schema). */
const POLICY_SCHEMA_SECTIONS: { title: string; fields: PolicyFieldSpec[] }[] = [
  {
    title: "Policy",
    fields: [
      { key: "deal_name", label: "deal_name" },
      { key: "policy_type", label: "policy_type" },
      { key: "carrier", label: "carrier" },
      { key: "carrier_status", label: "carrier_status" },
      { key: "policy_number", label: "policy_number" },
      { key: "policy_status", label: "policy_status" },
      { key: "status", label: "status" },
      { key: "deal_value", label: "deal_value", kind: "num" },
      { key: "cc_value", label: "cc_value", kind: "num" },
      { key: "is_active", label: "is_active", kind: "bool" },
      { key: "group_title", label: "group_title" },
      { key: "group_color", label: "group_color" },
    ],
  },
  {
    title: "People & placement",
    fields: [
      { key: "sales_agent", label: "sales_agent" },
      { key: "call_center", label: "call_center" },
      { key: "phone_number", label: "phone_number" },
    ],
  },
  {
    title: "Dates",
    fields: [
      { key: "effective_date", label: "effective_date", kind: "ts" },
      { key: "deal_creation_date", label: "deal_creation_date", kind: "ts" },
      { key: "lead_creation_date", label: "lead_creation_date", kind: "ts" },
      { key: "last_updated", label: "last_updated", kind: "ts" },
    ],
  },
  {
    title: "Commission & writing",
    fields: [
      { key: "writing_no", label: "writing_no" },
      { key: "commission_type", label: "commission_type" },
      { key: "cc_pmt_ws", label: "cc_pmt_ws" },
      { key: "cc_cb_ws", label: "cc_cb_ws" },
    ],
  },
  {
    title: "CRM",
    fields: [
      { key: "ghl_name", label: "ghl_name" },
      { key: "ghl_stage", label: "ghl_stage" },
      { key: "monday_item_id", label: "monday_item_id" },
    ],
  },
  {
    title: "Notes",
    fields: [
      { key: "notes", label: "notes", wide: true, multiline: true },
      { key: "tasks", label: "tasks", wide: true, multiline: true },
    ],
  },
  {
    title: "Disposition",
    fields: [
      { key: "disposition", label: "disposition" },
      { key: "disposition_date", label: "disposition_date", kind: "ts" },
      { key: "disposition_agent_id", label: "disposition_agent_id" },
      { key: "disposition_agent_name", label: "disposition_agent_name" },
      { key: "disposition_notes", label: "disposition_notes", wide: true, multiline: true },
      { key: "callback_datetime", label: "callback_datetime", kind: "ts" },
      { key: "disposition_count", label: "disposition_count", kind: "num" },
    ],
  },
  {
    title: "Lock",
    fields: [
      { key: "lock_status", label: "lock_status" },
      { key: "locked_at", label: "locked_at", kind: "ts" },
      { key: "locked_by", label: "locked_by" },
      { key: "locked_by_name", label: "locked_by_name" },
      { key: "lock_reason", label: "lock_reason", wide: true, multiline: true },
    ],
  },
  {
    title: "Record",
    fields: [
      { key: "id", label: "id" },
      { key: "lead_id", label: "lead_id" },
      { key: "created_at", label: "created_at", kind: "ts" },
      { key: "updated_at", label: "updated_at", kind: "ts" },
    ],
  },
];

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

  const [callResultsRows, setCallResultsRows] = useState<LeadRow[]>([]);
  const [callUpdatesLoading, setCallUpdatesLoading] = useState(false);
  const [callUpdateLogRows, setCallUpdateLogRows] = useState<CallUpdateLogRow[]>([]);

  const [policyRow, setPolicyRow] = useState<PolicyRow | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);

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
    if (!leadRow || !canEditLead) return;
    setEditDraft({ ...leadRow });
    setIsEditing(true);
    setSaveError(null);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditDraft(null);
    setSaveError(null);
  };

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

  const loadCallUpdates = useCallback(async () => {
    if (!rowUuid) return;
    setCallUpdatesLoading(true);
    const [crRes, logRes] = await Promise.all([
      supabase.from("call_results").select("*").eq("lead_id", rowUuid).order("updated_at", { ascending: false }),
      supabase
        .from("call_update_logs")
        .select("id, event_type, event_details, created_at")
        .eq("lead_id", rowUuid)
        .order("created_at", { ascending: false })
        .limit(80),
    ]);
    if (!crRes.error && crRes.data) {
      setCallResultsRows(crRes.data as LeadRow[]);
    } else {
      setCallResultsRows([]);
    }
    if (!logRes.error && logRes.data) {
      setCallUpdateLogRows(logRes.data as CallUpdateLogRow[]);
    } else {
      setCallUpdateLogRows([]);
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
            <div>
              <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>Leads · Lead Profile</p>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{leadName || "Demo lead"}</h1>
            </div>
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
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>Leads</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
              <span style={{ fontSize: 13, color: T.blue, fontWeight: 700 }}>{isCreation ? "Create New Lead" : "Lead Profile"}</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
              {isCreation ? "New Lead Entry" : fullName}
            </h1>
          </div>
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
              <button type="button" onClick={() => void saveLeadEdits()} disabled={saving || !canEditLead} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: T.radiusMd, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: saving || !canEditLead ? "not-allowed" : "pointer", opacity: canEditLead ? 1 : 0.6 }}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={startEdit}
                disabled={!canEditLead || !leadRow}
                title={!canEditLead ? "You do not have permission to edit this lead." : undefined}
                style={{
                  backgroundColor: "#fff",
                  border: `1.5px solid ${T.border}`,
                  borderRadius: T.radiusMd,
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: canEditLead && leadRow ? "pointer" : "not-allowed",
                  color: T.textDark,
                  opacity: canEditLead && leadRow ? 1 : 0.55,
                }}
              >
                Edit Lead
              </button>
              <button type="button" style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: T.radiusMd, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${T.blue}44` }}>
                Convert to Client
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "8px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: `1.5px solid ${T.border}`, display: "flex", gap: 4 }}>
            {(["Overview", "Call updates", "Notes", "Policy & coverage"] as TabType[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  border: "none",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: activeTab === tab ? 800 : 600,
                  backgroundColor: activeTab === tab ? T.blueFaint : "transparent",
                  color: activeTab === tab ? T.blue : T.textMuted,
                  transition: "all 0.2s",
                  fontFamily: T.font,
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ backgroundColor: "#fff", borderRadius: "24px", padding: "32px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)", border: `1.5px solid ${T.border}`, minHeight: 600 }}>
            {activeTab === "Overview" && (
              <div style={{ animation: "fadeInUp 0.3s ease-out" }}>
                <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800 }}>Lead record</h3>

                {!isCreation && leadRow && display && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
                    {(() => {
                      const d = isEditing && editDraft ? editDraft : display;
                      const ro = !isEditing;
                      const roStyle = {
                        ...inputStyle,
                        backgroundColor: T.pageBg,
                        color: T.textMid,
                      } as const;
                      const fieldStyle = ro ? roStyle : inputStyle;

                      const pipelineName =
                        d?.pipeline_id != null && d?.pipeline_id !== ""
                          ? pipelines.find((p) => p.id === Number(d.pipeline_id))?.name || String(d?.pipeline ?? "")
                          : String(d?.pipeline ?? "");
                      const stagesForPipeline =
                        pipelines.find((p) => p.name === pipelineName)?.stages ||
                        currentPipeline?.stages ||
                        [];

                      return (
                        <>
                          <div>
                            <h3 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800 }}>Primary Identity</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                              <div>
                                <label style={labelStyle}>
                                  Given Name <span style={{ color: T.danger }}>*</span>
                                </label>
                                <input
                                  value={String(d?.first_name ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("first_name", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>
                                  Family Name <span style={{ color: T.danger }}>*</span>
                                </label>
                                <input
                                  value={String(d?.last_name ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("last_name", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <label style={labelStyle}>Phone Number</label>
                                <input
                                  value={String(d?.phone ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("phone", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <label style={labelStyle}>Lead source</label>
                                <input
                                  value={String(d?.lead_source ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("lead_source", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800 }}>Policy & coverage</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                              <div>
                                <label style={labelStyle}>Product type</label>
                                <input
                                  value={String(d?.product_type ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("product_type", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>Carrier</label>
                                <input
                                  value={String(d?.carrier ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("carrier", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>Monthly premium</label>
                                <input
                                  value={String(d?.monthly_premium ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("monthly_premium", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>Coverage amount</label>
                                <input
                                  value={String(d?.coverage_amount ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("coverage_amount", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <label style={labelStyle}>Tags</label>
                                <input
                                  value={
                                    Array.isArray(d?.tags)
                                      ? (d.tags as unknown[]).map(String).filter(Boolean).join(", ")
                                      : typeof d?.tags === "string"
                                        ? String(d.tags)
                                        : ""
                                  }
                                  readOnly={ro}
                                  onChange={(e) =>
                                    patchDraft(
                                      "tags",
                                      e.target.value
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean)
                                    )
                                  }
                                  style={fieldStyle}
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800 }}>Pipeline</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                              <div>
                                <label style={labelStyle}>Pipeline</label>
                                <select
                                  value={pipelineName}
                                  disabled={ro}
                                  onChange={(e) => {
                                    const pName = e.target.value;
                                    const p = pipelines.find((pl) => pl.name === pName);
                                    patchDraft("pipeline", pName);
                                    patchDraft("pipeline_id", p?.id ?? null);
                                    if (p?.stages?.length) patchDraft("stage", p.stages[0]);
                                  }}
                                  style={(ro ? roStyle : inputStyle) as any}
                                >
                                  {pipelines.map((p) => (
                                    <option key={p.name} value={p.name}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label style={labelStyle}>Stage</label>
                                <select
                                  value={String(d?.stage ?? "")}
                                  disabled={ro}
                                  onChange={(e) => patchDraft("stage", e.target.value)}
                                  style={(ro ? roStyle : inputStyle) as any}
                                >
                                  {stagesForPipeline.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label style={labelStyle}>Lead value</label>
                                <input
                                  value={d?.lead_value != null && d?.lead_value !== "" ? String(d.lead_value) : ""}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("lead_value", e.target.value === "" ? null : Number(e.target.value))}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>Submission date</label>
                                <input
                                  value={String(d?.submission_date ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("submission_date", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800 }}>Location</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <label style={labelStyle}>Street 1</label>
                                <input
                                  value={String(d?.street1 ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("street1", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <label style={labelStyle}>Street 2</label>
                                <input
                                  value={String(d?.street2 ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("street2", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>City</label>
                                <input
                                  value={String(d?.city ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("city", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>State</label>
                                <input
                                  value={String(d?.state ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("state", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>ZIP</label>
                                <input
                                  value={String(d?.zip_code ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("zip_code", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Row metadata intentionally hidden */}

                {isCreation && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                      <div style={{ backgroundColor: T.pageBg, border: `1.5px solid ${T.borderLight}`, borderRadius: "16px", padding: "20px" }}>
                        <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: T.textDark }}>Policy / product</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Product type</label>
                          <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            style={{ padding: "10px", borderRadius: "10px", border: `1.5px solid ${T.border}`, fontWeight: 700 }}
                          >
                            <option value="Auto">Auto Insurance</option>
                            <option value="Home">Home Insurance</option>
                            <option value="Life">Life Insurance</option>
                            <option value="Health">Health Insurance</option>
                            <option value="Commercial">Commercial Insurance</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ backgroundColor: T.pageBg, border: `1.5px solid ${T.borderLight}`, borderRadius: "16px", padding: "20px" }}>
                        <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: T.textDark }}>Pipeline & stage</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Pipeline</label>
                            <select
                              value={formData.pipeline}
                              onChange={(e) => {
                                const pName = e.target.value;
                                const p = pipelines.find((pl) => pl.name === pName);
                                setFormData({ ...formData, pipeline: pName, stage: p ? p.stages[0] : "" });
                              }}
                              style={{ padding: "10px", borderRadius: "10px", border: `1.5px solid ${T.border}`, fontWeight: 700, outline: "none" }}
                            >
                              {pipelines.map((p) => (
                                <option key={p.name} value={p.name}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Stage</label>
                            <select
                              value={formData.stage}
                              onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                              style={{ padding: "10px", borderRadius: "10px", border: `1.5px solid ${T.border}`, fontWeight: 700, outline: "none" }}
                            >
                              {currentPipeline?.stages.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ border: `2px dashed ${T.border}`, borderRadius: "24px", padding: 40, textAlign: "center", color: T.textMuted }}>
                      <p style={{ fontWeight: 600 }}>Additional fields will be available after lead creation.</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "Call updates" && !isCreation && (
              <div>
                <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800 }}>Call updates</h3>

                {callUpdatesLoading ? (
                  <p style={{ color: T.textMuted, fontWeight: 600 }}>Loading call data…</p>
                ) : (
                  <>
                    {callResultsRows.length === 0 && callUpdateLogRows.length === 0 ? (
                      <EmptyState
                        title="No call updates yet"
                        description="Call results and update events appear here after a call is logged from Transfer Leads or related flows."
                        compact
                      />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        {callResultsRows.map((cr, i) => (
                          <div
                            key={String(cr.id ?? i)}
                            style={{
                              border: `1.5px solid ${T.border}`,
                              borderRadius: 16,
                              padding: 20,
                              background: T.rowBg,
                            }}
                          >
                            <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.6 }}>
                              Call result{callResultsRows.length > 1 ? ` · ${String(cr.submission_id ?? i + 1)}` : ""}
                            </p>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                                gap: "12px 20px",
                              }}
                            >
                              {CALL_RESULT_FIELD_ORDER.map(({ key, label, format }) => {
                                const raw = cr[key];
                                if (raw === undefined || raw === null || raw === "") return null;
                                const text = format ? format(raw) : fmt(raw);
                                if (text === "—") return null;
                                return (
                                  <div key={key}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>{label}</div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: T.textDark, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{text}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        {callUpdateLogRows.length > 0 && (
                          <div>
                            <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: T.textDark }}>Event log</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {callUpdateLogRows.map((log) => (
                                <div
                                  key={log.id}
                                  style={{
                                    border: `1px solid ${T.borderLight}`,
                                    borderRadius: 12,
                                    padding: 12,
                                    background: "#fff",
                                    fontSize: 13,
                                  }}
                                >
                                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, marginBottom: 6 }}>
                                    {formatTs(log.created_at)} · {log.event_type}
                                  </div>
                                  <pre
                                    style={{
                                      margin: 0,
                                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                      fontSize: 12,
                                      whiteSpace: "pre-wrap",
                                      wordBreak: "break-word",
                                      color: T.textMid,
                                    }}
                                  >
                                    {log.event_details == null
                                      ? "—"
                                      : typeof log.event_details === "string"
                                        ? log.event_details
                                        : JSON.stringify(log.event_details, null, 2)}
                                  </pre>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === "Notes" && !isCreation && (
              <div>
                <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>Notes</h3>
                <p style={{ margin: "0 0 16px", fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
                  Table <code style={{ fontSize: 11 }}>public.lead_notes</code>, linked by <code style={{ fontSize: 11 }}>lead_id</code> →{" "}
                  <code style={{ fontSize: 11 }}>leads.id</code> (same as Lead Pipeline quick edit).
                </p>
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Add a note…"
                  disabled={!canEditLead || addingNote}
                  rows={4}
                  style={{
                    width: "100%",
                    padding: 14,
                    borderRadius: 12,
                    border: `1.5px solid ${T.border}`,
                    fontFamily: T.font,
                    fontSize: 14,
                    marginBottom: 10,
                    resize: "vertical",
                  }}
                />
                <button
                  type="button"
                  disabled={!canEditLead || addingNote || !newNoteText.trim()}
                  onClick={() => void addNote()}
                  style={{
                    background: T.blue,
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "10px 20px",
                    fontWeight: 800,
                    cursor: canEditLead && newNoteText.trim() ? "pointer" : "not-allowed",
                    opacity: canEditLead ? 1 : 0.6,
                    marginBottom: 28,
                  }}
                >
                  {addingNote ? "Adding…" : "Add note"}
                </button>

                {notesLoading ? (
                  <p style={{ color: T.textMuted }}>Loading notes…</p>
                ) : leadNotes.length === 0 ? (
                  <p style={{ color: T.textMuted, padding: 16, background: T.pageBg, borderRadius: 10 }}>No notes yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {leadNotes.map((note) => (
                      <div key={note.id} style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, background: T.rowBg }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 700 }}>
                            {formatTs(note.created_at)} · {note.authorName}
                          </span>
                          {canEditLead && note.created_by && sessionUserId === note.created_by && (
                            <button type="button" onClick={() => void deleteNote(note.id)} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: 12 }}>
                              Delete
                            </button>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{note.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "Policy & coverage" && !isCreation && (
              <div>
                <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>Policy & coverage</h3>
                <p style={{ margin: "0 0 16px", fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
                  Newest <code style={{ fontSize: 11 }}>public.policies</code> row for this lead. Field labels match column names.
                </p>
                {policyLoading ? (
                  <p style={{ color: T.textMuted, fontSize: 14, margin: 0 }}>Loading policy…</p>
                ) : (
                  (() => {
                    const roStyle = { ...inputStyle, backgroundColor: T.pageBg, color: T.textMid } as const;
                    return (
                      <div style={{ maxWidth: 960 }}>
                        {!policyRow ? (
                          <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>
                            No policy row linked to this lead — fields below show the schema layout.
                          </p>
                        ) : null}
                        {POLICY_SCHEMA_SECTIONS.map((section) => (
                          <div key={section.title} style={{ marginBottom: 28 }}>
                            <h4
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                color: T.textMuted,
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                margin: "0 0 14px",
                              }}
                            >
                              {section.title}
                            </h4>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 20,
                              }}
                            >
                              {section.fields.map((field) => {
                                const val = policyDisplayValue(policyRow, field.key, field.kind);
                                const colStyle = field.wide ? { gridColumn: "1 / -1" as const } : undefined;
                                return (
                                  <div key={field.key} style={colStyle}>
                                    <label style={labelStyle}>{field.label}</label>
                                    {field.multiline ? (
                                      <textarea
                                        readOnly
                                        value={val}
                                        rows={field.key === "notes" || field.key === "tasks" ? 4 : 3}
                                        style={{
                                          ...roStyle,
                                          width: "100%",
                                          resize: "vertical",
                                          fontFamily: T.font,
                                          minHeight: 80,
                                        }}
                                      />
                                    ) : (
                                      <input readOnly value={val} style={roStyle} />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
