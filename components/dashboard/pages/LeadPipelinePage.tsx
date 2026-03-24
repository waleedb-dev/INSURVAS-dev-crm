"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { ActionMenu, Pagination, Avatar, Badge, Table, DataGrid, FilterChip, EmptyState } from "@/components/ui";
import LeadViewComponent from "./LeadViewComponent";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Stage = string;

interface Lead {
  /** Display / drag id: lead_unique_id when present, else leads.id */
  id: string;
  /** UUID primary key in public.leads — required for fetch/update */
  rowUuid: string;
  name: string;
  phone: string;
  type: string;
  premium: number;
  source: string;
  agent: string;
  agentColor: string;
  daysInStage: number;
  stage: Stage;
}

type LeadRow = Record<string, unknown>;

function formatPhoneDisplay(phone: string | null | undefined) {
  const raw = String(phone ?? "").replace(/\D/g, "");
  if (raw.length === 10) {
    return `+1 (${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
  }
  return phone || "";
}

function formatTs(value: unknown) {
  if (value == null || value === "") return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const DEFAULT_STAGES: Stage[] = [
  "New Lead", "Attempted Contact", "Contacted", "Discovery Call", "Presentation",
  "Needs Quote", "Quoted", "Underwriting", "Bound", "Won", "Lost"
];
const STAGE_CONFIG: Record<string, { color: string; bg: string; header: string }> = {
  "New Lead":          { color: "#3b82f6", bg: "#eff6ff", header: "#dbeafe" },
  "Attempted Contact": { color: "#6366f1", bg: "#eef2ff", header: "#e0e7ff" },
  "Contacted":         { color: "#8b5cf6", bg: "#f5f3ff", header: "#ede9fe" },
  "Discovery Call":    { color: "#d946ef", bg: "#fdf4ff", header: "#fae8ff" },
  "Presentation":      { color: "#ec4899", bg: "#fdf2f8", header: "#fce7f3" },
  "Needs Quote":       { color: "#f43f5e", bg: "#fff1f2", header: "#ffe4e6" },
  "Quoted":            { color: "#f59e0b", bg: "#fffbeb", header: "#fef3c7" },
  "Underwriting":      { color: "#eab308", bg: "#fefce8", header: "#fef08a" },
  "Bound":             { color: "#84cc16", bg: "#f7fee7", header: "#d9f99d" },
  "Won":               { color: "#16a34a", bg: "#f0fdf4", header: "#dcfce7" },
  "Lost":              { color: "#dc2626", bg: "#fef2f2", header: "#fee2e2" },
};

const STAGE_COLOR_SEQUENCE = Object.values(STAGE_CONFIG);

function getStageConfig(stage: string, index: number) {
  const fromMap = STAGE_CONFIG[stage];
  if (fromMap) return fromMap;
  const fallback = STAGE_COLOR_SEQUENCE[index % STAGE_COLOR_SEQUENCE.length];
  return fallback ?? { color: T.blue, bg: T.blueFaint, header: T.blueFaint };
}

const TYPE_COLORS: Record<string, string> = {
  Auto: "#3b82f6", Home: "#9333ea", Life: "#16a34a", Health: "#ea580c", Commercial: "#64748b",
};

// const INITIAL_LEADS: Lead[] = [ ... ]; // Dummy data commented out for production

export default function LeadPipelinePage({ canUpdateActions = true }: { canUpdateActions?: boolean }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [leads, setLeads] = useState<Lead[]>([]); // Start with empty array, no dummy data
  const [dragRowUuid, setDragRowUuid] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Stage | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  const [pipeline, setPipeline] = useState<string>("");
  const [pipelines, setPipelines] = useState<string[]>([]);
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES);
  const [userCallCenterId, setUserCallCenterId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [viewingLead, setViewingLead] = useState<{ id: string, name: string } | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<"Filters" | "Fields">("Filters");
  const [activeTab, setActiveTab] = useState("Opportunities");
  const [filterStage, setFilterStage] = useState<Stage | "All">("All");
  const [filterType, setFilterType] = useState("All");
  const [filterAgent, setFilterAgent] = useState("All");
  const [filterSource, setFilterSource] = useState("All");
  const [filterMinPremium, setFilterMinPremium] = useState("");
  const [filterMaxPremium, setFilterMaxPremium] = useState("");
  const [drawerStage, setDrawerStage] = useState<Stage | "All">("All");
  const [drawerType, setDrawerType] = useState("All");
  const [drawerAgent, setDrawerAgent] = useState("All");
  const [drawerSource, setDrawerSource] = useState("All");
  const [drawerMinPremium, setDrawerMinPremium] = useState("");
  const [drawerMaxPremium, setDrawerMaxPremium] = useState("");
  const [quickEditLead, setQuickEditLead] = useState<Lead | null>(null);
  const [activeQuickEditTab, setActiveQuickEditTab] = useState<"Opportunity Details" | "Notes">("Opportunity Details");
  const [quickEditRow, setQuickEditRow] = useState<LeadRow | null>(null);
  const [quickEditLoading, setQuickEditLoading] = useState(false);
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [quickEditError, setQuickEditError] = useState<string | null>(null);
  const [hideEmptyQuickFields, setHideEmptyQuickFields] = useState(false);
  const [quickEditStages, setQuickEditStages] = useState<Stage[]>([]);

  const byStage = (stage: Stage) => leads.filter((l) => l.stage === stage);
  const stageValue = (stage: Stage) => byStage(stage).reduce((s, l) => s + l.premium, 0);

  const toggleCollapse = (stage: Stage) => {
    setCollapsedStages((prev) => ({ ...prev, [stage]: !prev[stage] }));
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.type.toLowerCase().includes(search.toLowerCase());
    const matchesStage = filterStage === "All" || l.stage === filterStage;
    const matchesType = filterType === "All" || l.type === filterType;
    const matchesAgent = filterAgent === "All" || l.agent === filterAgent;
    const matchesSource = filterSource === "All" || l.source === filterSource;
    const minPremium = filterMinPremium.trim() ? Number(filterMinPremium) : null;
    const maxPremium = filterMaxPremium.trim() ? Number(filterMaxPremium) : null;
    const validMin = minPremium == null || Number.isNaN(minPremium) ? true : l.premium >= minPremium;
    const validMax = maxPremium == null || Number.isNaN(maxPremium) ? true : l.premium <= maxPremium;
    return matchesSearch && matchesStage && matchesType && matchesAgent && matchesSource && validMin && validMax;
  });
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [search, filterStage, filterType, filterAgent, filterSource, filterMinPremium, filterMaxPremium]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
    if (filteredLeads.length === 0 && page !== 1) setPage(1);
  }, [filteredLeads.length, page, totalPages]);

  const loadLeadsForPipeline = useCallback(async () => {
    if (!stages.length) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id || null;
    let callCenterId: string | null = null;
    if (userId) {
      const { data: profile } = await supabase.from("users").select("call_center_id").eq("id", userId).maybeSingle();
      callCenterId = profile?.call_center_id ?? null;
      setUserCallCenterId(callCenterId);
    }

    const selectCols =
      "id, lead_unique_id, first_name, last_name, phone, lead_value, monthly_premium, product_type, lead_source, stage, is_draft, call_center_id";

    const isTransferPipeline = pipeline === "Transfer Portal";

    const mapRow = (row: Record<string, unknown>): Lead => {
      const fullName = `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Unnamed Lead";
      const premiumValue = Number(row.lead_value ?? row.monthly_premium ?? 0) || 0;
      const stageName: Stage = row.stage && stages.includes(String(row.stage)) ? String(row.stage) : (stages[0] as Stage);
      const rowUuid = String(row.id);
      const displayId = row.lead_unique_id ? String(row.lead_unique_id) : rowUuid;
      const phoneStr = row.phone != null ? String(row.phone) : "";

      return {
        id: displayId,
        rowUuid,
        name: fullName,
        phone: phoneStr,
        type: String(row.product_type || (isTransferPipeline ? "Transfer" : "")),
        premium: premiumValue,
        source: String(row.lead_source || (isTransferPipeline ? "Transfer Portal" : "")),
        agent: isTransferPipeline ? "BPO" : "SS",
        agentColor: "#4285f4",
        daysInStage: 0,
        stage: stageName,
      };
    };

    if (isTransferPipeline) {
      let q: any = supabase.from("leads").select(selectCols).eq("pipeline", "Transfer Portal").eq("is_draft", false).order("created_at", { ascending: false });
      if (callCenterId) q = q.eq("call_center_id", callCenterId);

      const { data, error } = await q;

      if (error || !data || data.length === 0) {
        setLeads([]);
        return;
      }

      setLeads((data as Record<string, unknown>[]).map((row) => mapRow(row)));
      return;
    }

    if (!pipeline) {
      setLeads([]);
      return;
    }

    let q: any = supabase.from("leads").select(selectCols).eq("pipeline", pipeline).eq("is_draft", false).order("created_at", { ascending: false });
    if (callCenterId) q = q.eq("call_center_id", callCenterId);

    const { data, error } = await q;
    if (error || !data) {
      setLeads([]);
      return;
    }

    const mapped: Lead[] = (data as Record<string, unknown>[]).map((row) => mapRow(row));
    setLeads(mapped);
  }, [pipeline, stages, supabase]);

  useEffect(() => {
    void loadLeadsForPipeline();
  }, [loadLeadsForPipeline]);

  useEffect(() => {
    const fetchPipelines = async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("name")
        .order("name");

      if (error || !data) {
        return;
      }

      const names = data
        .map((p: { name: string | null }) => p.name)
        .filter((n): n is string => Boolean(n));

      if (names.length === 0) {
        setPipelines([]);
        return;
      }

      setPipelines(names);

      if (!names.includes(pipeline)) {
        setPipeline(names[0]);
      }
    };

    void fetchPipelines();
  }, [supabase, pipeline]);

  useEffect(() => {
    const fetchStages = async () => {
      const { data: pipelineRow, error } = await supabase
        .from("pipelines")
        .select("id")
        .eq("name", pipeline)
        .maybeSingle();

      if (error || !pipelineRow?.id) {
        setStages(DEFAULT_STAGES);
        return;
      }

      const { data: stageRows, error: stageError } = await supabase
        .from("pipeline_stages")
        .select("name")
        .eq("pipeline_id", pipelineRow.id)
        .order("position");

      if (stageError || !stageRows || stageRows.length === 0) {
        setStages(DEFAULT_STAGES);
        return;
      }

      const names = stageRows
        .map((row: { name: string | null }) => row.name)
        .filter((name): name is string => Boolean(name));

      if (names.length === 0) {
        setStages(DEFAULT_STAGES);
        return;
      }

      setStages(names);

      setFilterStage((current) => (current === "All" || names.includes(current) ? current : "All"));
    };

    void fetchStages();
  }, [supabase, pipeline]);

  useEffect(() => {
    if (!quickEditLead?.rowUuid) {
      setQuickEditRow(null);
      setQuickEditError(null);
      setQuickEditLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setQuickEditLoading(true);
      setQuickEditError(null);
      const { data, error } = await supabase.from("leads").select("*").eq("id", quickEditLead.rowUuid).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setQuickEditRow(null);
        setQuickEditError(error?.message || "Could not load lead.");
      } else {
        setQuickEditRow(data as LeadRow);
      }
      setQuickEditLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [quickEditLead?.rowUuid, supabase]);

  useEffect(() => {
    const pipelineName = quickEditRow?.pipeline != null ? String(quickEditRow.pipeline) : "";
    if (!pipelineName) {
      setQuickEditStages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: pipelineRow, error } = await supabase.from("pipelines").select("id").eq("name", pipelineName).maybeSingle();
      if (cancelled) return;
      if (error || !pipelineRow?.id) {
        setQuickEditStages(stages);
        return;
      }
      const { data: stageRows, error: stageError } = await supabase
        .from("pipeline_stages")
        .select("name")
        .eq("pipeline_id", pipelineRow.id)
        .order("position");
      if (cancelled) return;
      if (stageError || !stageRows?.length) {
        setQuickEditStages(stages);
        return;
      }
      const names = stageRows.map((r: { name: string | null }) => r.name).filter((n): n is string => Boolean(n));
      setQuickEditStages(names.length ? names : stages);
    })();
    return () => {
      cancelled = true;
    };
  }, [quickEditRow?.pipeline, supabase, stages]);

  const patchQuickEdit = (key: string, value: unknown) => {
    setQuickEditRow((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const resolveStageId = useCallback(async (pipelineName: string, stageName: string) => {
    const { data: pipelineRow } = await supabase.from("pipelines").select("id").eq("name", pipelineName).maybeSingle();
    if (!pipelineRow?.id) return null;
    const { data: st } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_id", pipelineRow.id)
      .eq("name", stageName)
      .maybeSingle();
    return st?.id ?? null;
  }, [supabase]);

  const handleKanbanDrop = useCallback(
    async (targetStage: Stage) => {
      if (!dragRowUuid || !canUpdateActions) {
        setDragRowUuid(null);
        setDragOver(null);
        return;
      }
      const droppedUuid = dragRowUuid;
      const prevLead = leads.find((l) => l.rowUuid === droppedUuid);
      if (!prevLead || prevLead.stage === targetStage) {
        setDragRowUuid(null);
        setDragOver(null);
        return;
      }
      const stageId = await resolveStageId(pipeline, targetStage);
      setLeads((p) => p.map((l) => (l.rowUuid === droppedUuid ? { ...l, stage: targetStage, daysInStage: 0 } : l)));
      const updatePayload: Record<string, unknown> = { stage: targetStage };
      if (stageId != null) updatePayload.stage_id = stageId;
      const { error } = await supabase.from("leads").update(updatePayload).eq("id", droppedUuid);
      setDragRowUuid(null);
      setDragOver(null);
      if (error && prevLead) {
        setLeads((p) => p.map((l) => (l.rowUuid === droppedUuid ? prevLead : l)));
      }
    },
    [dragRowUuid, canUpdateActions, leads, pipeline, resolveStageId, supabase]
  );

  const closeQuickEdit = () => {
    setQuickEditLead(null);
    setQuickEditRow(null);
    setQuickEditError(null);
    setActiveQuickEditTab("Opportunity Details");
  };

  const saveQuickEdit = async () => {
    if (!quickEditLead?.rowUuid || !quickEditRow) return;
    setQuickEditSaving(true);
    setQuickEditError(null);

    const strVal = (k: string) => {
      const v = quickEditRow[k];
      if (v == null) return null;
      if (typeof v === "string") return v.trim() === "" ? null : v.trim();
      return String(v);
    };

    const numOrNull = (k: string) => {
      const raw = quickEditRow[k];
      if (raw === "" || raw == null) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    const pipelineName = strVal("pipeline") || "";
    const stageName = strVal("stage") || "";
    const stageId = pipelineName && stageName ? await resolveStageId(pipelineName, stageName) : null;

    let tagsVal: string[] | null = null;
    const tagsRaw = quickEditRow.tags;
    if (Array.isArray(tagsRaw)) {
      tagsVal = tagsRaw.map((t) => String(t)).filter(Boolean);
    } else if (typeof tagsRaw === "string" && tagsRaw.trim()) {
      try {
        const parsed = JSON.parse(tagsRaw);
        if (Array.isArray(parsed)) tagsVal = parsed.map((t) => String(t));
      } catch {
        tagsVal = tagsRaw.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }

    // DB columns `age`, `monthly_premium`, `coverage_amount` are text — must not send JSON numbers.
    const payload: Record<string, unknown> = {
      first_name: strVal("first_name"),
      last_name: strVal("last_name"),
      phone: strVal("phone"),
      street1: strVal("street1"),
      street2: strVal("street2"),
      city: strVal("city"),
      state: strVal("state"),
      zip_code: strVal("zip_code"),
      birth_state: strVal("birth_state"),
      date_of_birth: strVal("date_of_birth"),
      age: strVal("age"),
      social: strVal("social"),
      driver_license_number: strVal("driver_license_number"),
      existing_coverage_last_2_years: strVal("existing_coverage_last_2_years"),
      previous_applications_2_years: strVal("previous_applications_2_years"),
      height: strVal("height"),
      weight: strVal("weight"),
      doctor_name: strVal("doctor_name"),
      tobacco_use: strVal("tobacco_use"),
      health_conditions: strVal("health_conditions"),
      medications: strVal("medications"),
      monthly_premium: strVal("monthly_premium"),
      coverage_amount: strVal("coverage_amount"),
      lead_value: numOrNull("lead_value"),
      carrier: strVal("carrier"),
      product_type: strVal("product_type"),
      draft_date: strVal("draft_date"),
      beneficiary_information: strVal("beneficiary_information"),
      bank_account_type: strVal("bank_account_type"),
      institution_name: strVal("institution_name"),
      routing_number: strVal("routing_number"),
      account_number: strVal("account_number"),
      future_draft_date: strVal("future_draft_date"),
      additional_information: strVal("additional_information"),
      pipeline: strVal("pipeline") || "Transfer Portal",
      stage: strVal("stage") || "Transfer API",
      lead_source: strVal("lead_source"),
      submission_date: strVal("submission_date"),
    };

    if (stageId != null) payload.stage_id = stageId;
    else if (quickEditRow.stage_id != null && quickEditRow.stage_id !== "") payload.stage_id = quickEditRow.stage_id;
    if (tagsVal) payload.tags = tagsVal;

    const { data: updatedRows, error } = await supabase.from("leads").update(payload).eq("id", quickEditLead.rowUuid).select("id");
    setQuickEditSaving(false);
    if (error) {
      setQuickEditError(error.message);
      return;
    }
    if (!updatedRows?.length) {
      setQuickEditError(
        "Update did not apply (0 rows). You may lack permission to edit this lead, or the record was removed."
      );
      return;
    }
    await loadLeadsForPipeline();
    closeQuickEdit();
  };

  const deleteQuickEdit = async () => {
    if (!quickEditLead?.rowUuid) return;
    if (!window.confirm("Delete this lead permanently? This cannot be undone.")) return;
    setQuickEditSaving(true);
    setQuickEditError(null);
    const { error } = await supabase.from("leads").delete().eq("id", quickEditLead.rowUuid);
    setQuickEditSaving(false);
    if (error) {
      setQuickEditError(error.message);
      return;
    }
    await loadLeadsForPipeline();
    closeQuickEdit();
  };

  const renderKanbanBoard = () => (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <style>{`
        .kanban-container {
          background-color: transparent;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }
        .kanban-board {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 8px 4px;
          align-items: stretch;
          flex: 1;
          min-height: 0;
          scrollbar-width: thin;
          scrollbar-color: ${T.border} transparent;
        }
        .kanban-board::-webkit-scrollbar { height: 6px; }
        .kanban-board::-webkit-scrollbar-track { background: transparent; }
        .kanban-board::-webkit-scrollbar-thumb { background-color: #e2e8f0; border-radius: 10px; }
        
        .kanban-column-wrapper {
          min-width: 300px;
          width: 300px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background-color: transparent;
          overflow: hidden;
          transition: width 0.2s ease;
          height: 100%;
        }
        
        .kanban-column-body {
          overflow-y: auto;
          max-height: calc(100vh - 320px);
          min-height: 480px;
          padding: 12px 2px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .kanban-column-body::-webkit-scrollbar { width: 5px; }
        .kanban-column-body::-webkit-scrollbar-track { background: transparent; }
        .kanban-column-body::-webkit-scrollbar-thumb { background-color: #e2e8f0; border-radius: 10px; }
      `}</style>
      
      <div className="kanban-container">
        <div className="kanban-board">
          {stages.map((stage, index) => {
            const cfg = getStageConfig(stage, index);
            const stageLeads = byStage(stage).filter(l => filteredLeads.includes(l));
            const isCollapsed = collapsedStages[stage];
            const isOver = dragOver === stage;
            return (
              <div
                key={stage}
                onDragOver={(e) => {
                  if (!canUpdateActions || isCollapsed) return;
                  e.preventDefault();
                  setDragOver(stage);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => {
                  if (!canUpdateActions || isCollapsed) return;
                  void handleKanbanDrop(stage);
                }}
                className="kanban-column-wrapper"
                style={{ 
                  minWidth: isCollapsed ? 50 : 280,
                  width: isCollapsed ? 50 : 280,
                }}
              >
                {isCollapsed ? (
                  <div style={{ backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "16px 0", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }} onClick={() => toggleCollapse(stage)}>
                    <div style={{ backgroundColor: cfg.color, color: "#fff", borderRadius: 10, padding: "2px 7px", fontSize: 11, fontWeight: 800, marginBottom: 16 }}>
                      {stageLeads.length}
                    </div>
                    <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 13, fontWeight: 800, color: cfg.color, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>
                      {stage}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ backgroundColor: "#fff", padding: "12px 16px", border: `1px solid ${T.border}`, borderTop: `4px solid ${cfg.color}`, borderRadius: "8px 8px 0 0", flexShrink: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: T.textDark }}>{stage}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                           <button onClick={() => toggleCollapse(stage)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: T.textMuted }}>
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                           </button>
                        </div>
                      </div>
                      <div style={{ marginTop: 4, display: "flex", gap: 12, fontSize: 12 }}>
                        <span style={{ color: T.textMuted, fontWeight: 600 }}>{stageLeads.length} Opportunities</span>
                        <span style={{ color: T.textDark, fontWeight: 800 }}>${stageValue(stage).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="kanban-column-body" style={{ backgroundColor: isOver ? cfg.bg + "40" : "transparent", transition: "background-color 0.2s" }}>
                      {stageLeads.map((lead) => (
                        <div
                          key={lead.rowUuid}
                          onClick={() => setViewingLead({ id: lead.id, name: lead.name })}
                          draggable={canUpdateActions}
                          onDragStart={() => { if (canUpdateActions) setDragRowUuid(lead.rowUuid); }}
                          onDragEnd={() => { setDragRowUuid(null); setDragOver(null); }}
                          style={{
                            backgroundColor: "#fff", borderRadius: 8, padding: "16px",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${T.border}`,
                            borderLeft: `3px solid ${cfg.color}`,
                            cursor: canUpdateActions ? "grab" : "default",
                            opacity: dragRowUuid === lead.rowUuid ? 0.5 : 1,
                            transition: "all 0.15s",
                            position: "relative"
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.boxShadow = T.shadowSm; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "flex-start" }}>
                            <div style={{ flex: 1, marginRight: 8 }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.textDark, lineHeight: 1.4 }}>
                                {lead.name}
                                {lead.phone ? ` — ${formatPhoneDisplay(lead.phone)}` : ""}
                              </p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setQuickEditLead(lead); }}
                                style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <input type="checkbox" onClick={(e) => e.stopPropagation()} style={{ width: 14, height: 14, accentColor: T.blue, cursor: "pointer", border: `1.5px solid ${T.border}`, borderRadius: 3 }} />
                            </div>
                          </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                             <div style={{ display: "flex", fontSize: 12, gap: 8 }}>
                               <span style={{ color: T.textMuted, fontWeight: 500, width: 110 }}>Lead ID:</span>
                               <span style={{ color: T.textDark, fontWeight: 600 }}>{lead.id}</span>
                             </div>
                             <div style={{ display: "flex", fontSize: 12, gap: 8 }}>
                               <span style={{ color: T.textMuted, fontWeight: 500, width: 110 }}>Opportunity Value:</span>
                               <span style={{ color: T.textDark, fontWeight: 600 }}>${lead.premium.toLocaleString()}</span>
                             </div>
                            </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, borderTop: `1px solid ${T.borderLight}` }}>
                             {[
                               { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>, count: 11 },
                               { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, count: 52 },
                             ].map((item, idx) => (
                               <div key={idx} style={{ color: T.textMuted, display: "flex", alignItems: "center", position: "relative", cursor: "pointer" }}>
                                 {item.count !== undefined && item.count > 0 && (
                                   <div style={{ position: "absolute", top: -8, right: -10, backgroundColor: T.blue, color: "#fff", fontSize: 8, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #fff", padding: "0 2px" }}>{item.count}</div>
                                 )}
                                 {item.icon}
                               </div>
                             ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const [showAddLead, setShowAddLead] = useState(false);
  const sourceOptions = Array.from(new Set(leads.map((lead) => lead.source).filter(Boolean)));

  const openFilterDrawer = () => {
    setDrawerStage(filterStage);
    setDrawerType(filterType);
    setDrawerAgent(filterAgent);
    setDrawerSource(filterSource);
    setDrawerMinPremium(filterMinPremium);
    setDrawerMaxPremium(filterMaxPremium);
    setIsFilterOpen(true);
  };

  const applyDrawerFilters = () => {
    setFilterStage(drawerStage);
    setFilterType(drawerType);
    setFilterAgent(drawerAgent);
    setFilterSource(drawerSource);
    setFilterMinPremium(drawerMinPremium.trim());
    setFilterMaxPremium(drawerMaxPremium.trim());
    setIsFilterOpen(false);
  };

  const resetDrawerFilters = () => {
    setDrawerStage("All");
    setDrawerType("All");
    setDrawerAgent("All");
    setDrawerSource("All");
    setDrawerMinPremium("");
    setDrawerMaxPremium("");
    setFilterStage("All");
    setFilterType("All");
    setFilterAgent("All");
    setFilterSource("All");
    setFilterMinPremium("");
    setFilterMaxPremium("");
  };

  if (viewingLead) {
    return <LeadViewComponent leadId={viewingLead.id} leadName={viewingLead.name} onBack={() => setViewingLead(null)} />;
  }

  if (showAddLead) {
    return <LeadViewComponent isCreation onBack={() => setShowAddLead(false)} onSubmit={(newLead: any) => {
      const mappedLead: Lead = {
        id: `P-0${leads.length + 1}`,
        rowUuid: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `temp-${Date.now()}`,
        name: newLead.name,
        phone: "",
        type: newLead.type,
        premium: newLead.premium,
        source: newLead.source,
        agent: "SS",
        agentColor: "#4285f4",
        daysInStage: 0,
        stage: newLead.stage as Stage
      };
      setLeads(prev => [mappedLead, ...prev]);
      setShowAddLead(false);
    }} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0, paddingBottom: 24, position: "relative" }}>
      {/* Drawer Overlay */}
      {isFilterOpen && (
        <div onClick={() => setIsFilterOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.15)", zIndex: 1000, backdropFilter: "blur(2px)" }} />
      )}

      {/* Filter Sidebar */}
      <div style={{ position: "fixed", top: 0, right: isFilterOpen ? 0 : -420, width: 420, bottom: 0, backgroundColor: "#fff", zIndex: 1001, boxShadow: "-8px 0 32px rgba(0,0,0,0.05)", transition: "right 0.3s ease", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px", borderBottom: `1.5px solid ${T.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Customise Card</h2>
          <button onClick={() => setIsFilterOpen(false)} style={{ background: T.rowBg, border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setActiveFilterTab("Filters")}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: activeFilterTab === "Filters" ? `1px solid ${T.blue}` : `1px solid ${T.border}`,
                backgroundColor: activeFilterTab === "Filters" ? T.blueFaint : "#fff",
                color: activeFilterTab === "Filters" ? T.blue : T.textMuted,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Filters
            </button>
            <button
              onClick={() => setActiveFilterTab("Fields")}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: activeFilterTab === "Fields" ? `1px solid ${T.blue}` : `1px solid ${T.border}`,
                backgroundColor: activeFilterTab === "Fields" ? T.blueFaint : "#fff",
                color: activeFilterTab === "Fields" ? T.blue : T.textMuted,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Fields
            </button>
          </div>
          {activeFilterTab === "Filters" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6 }}>Stage</label>
                <select value={drawerStage} onChange={(e) => setDrawerStage(e.target.value as Stage | "All")} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, fontWeight: 600 }}>
                  <option value="All">All Stages</option>
                  {stages.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6 }}>Type</label>
                <select value={drawerType} onChange={(e) => setDrawerType(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, fontWeight: 600 }}>
                  <option value="All">All Types</option>
                  {Object.keys(TYPE_COLORS).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6 }}>Owner</label>
                <select value={drawerAgent} onChange={(e) => setDrawerAgent(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, fontWeight: 600 }}>
                  <option value="All">All Owners</option>
                  {Array.from(new Set(leads.map((l) => l.agent))).map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6 }}>Source</label>
                <select value={drawerSource} onChange={(e) => setDrawerSource(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, fontWeight: 600 }}>
                  <option value="All">All Sources</option>
                  {sourceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6 }}>Min Value</label>
                  <input
                    value={drawerMinPremium}
                    onChange={(e) => setDrawerMinPremium(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6 }}>Max Value</label>
                  <input
                    value={drawerMaxPremium}
                    onChange={(e) => setDrawerMaxPremium(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="10000"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, fontWeight: 600 }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.5 }}>
              Field visibility controls can be added next. Current list and kanban cards already use active filters.
            </div>
          )}
        </div>
        <div style={{ padding: "16px 24px", borderTop: `1.5px solid ${T.borderLight}`, display: "flex", gap: 12, justifyContent: "flex-end", backgroundColor: "#f9fafb" }}>
          <button onClick={resetDrawerFilters} style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 16px", fontWeight: 700 }}>Reset</button>
          <button onClick={() => setIsFilterOpen(false)} style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 20px", fontWeight: 700 }}>Cancel</button>
          <button onClick={applyDrawerFilters} style={{ background: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700 }}>Apply</button>
        </div>
      </div>

      {/* Pipeline & Filter Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: `1px solid ${T.pageBg}`, flexShrink: 0, gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <select
            value={pipeline}
            onChange={(e) => setPipeline(e.target.value)}
            style={{ padding: "8px 14px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 800, backgroundColor: "#fff", cursor: "pointer", outline: "none" }}
          >
            {pipelines.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.blue, backgroundColor: T.blueFaint, padding: "4px 10px", borderRadius: 20 }}>{leads.length} opportunities</span>
          
          <div style={{ width: 1, height: 24, backgroundColor: T.border, margin: "0 4px" }} />
          
          <button onClick={openFilterDrawer} style={{ padding: "8px 16px", border: `1.5px solid ${T.blue}30`, borderRadius: 20, backgroundColor: T.blueFaint, color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Advanced Filters
          </button>
          <button style={{ padding: "8px 16px", border: `1.5px solid ${T.border}`, borderRadius: 20, backgroundColor: "#fff", color: T.textMid, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
            Sort (1)
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
             <button onClick={() => setViewMode("kanban")} style={{ padding: "8px 10px", background: viewMode === "kanban" ? T.blueFaint : "#fff", color: viewMode === "kanban" ? T.blue : T.textMuted, border: "none", cursor: "pointer" }}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
             </button>
             <button onClick={() => setViewMode("list")} style={{ padding: "8px 10px", background: viewMode === "list" ? T.blueFaint : "#fff", color: viewMode === "list" ? T.blue : T.textMuted, border: "none", borderLeft: `1px solid ${T.border}`, cursor: "pointer" }}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
             </button>
          </div>
          {canUpdateActions && (
            <button
              onClick={() => setShowAddLead(true)}
              style={{
                backgroundColor: T.blue,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              + Add lead
            </button>
          )}
        </div>
      </div>


      {/* Main Board Area */}
      <DataGrid
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search Opportunities..."
        filters={
          <>
            <select value={filterStage} onChange={(e) => setFilterStage(e.target.value as any)} style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}>
              <option value="All">All Stages</option>
              {stages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}>
              <option value="All">All Types</option>
              {Object.keys(TYPE_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}>
              <option value="All">All Owners</option>
              {Array.from(new Set(leads.map(l => l.agent))).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </>
        }
        activeFilters={
          (filterStage !== "All" || filterType !== "All" || filterAgent !== "All" || filterSource !== "All" || Boolean(filterMinPremium) || Boolean(filterMaxPremium)) && (
            <>
              {filterStage !== "All" && <FilterChip label={`Stage: ${filterStage}`} onClear={() => setFilterStage("All")} />}
              {filterType !== "All" && <FilterChip label={`Type: ${filterType}`} onClear={() => setFilterType("All")} />}
              {filterAgent !== "All" && <FilterChip label={`Owner: ${filterAgent}`} onClear={() => setFilterAgent("All")} />}
              {filterSource !== "All" && <FilterChip label={`Source: ${filterSource}`} onClear={() => setFilterSource("All")} />}
              {Boolean(filterMinPremium) && <FilterChip label={`Min: $${filterMinPremium}`} onClear={() => setFilterMinPremium("")} />}
              {Boolean(filterMaxPremium) && <FilterChip label={`Max: $${filterMaxPremium}`} onClear={() => setFilterMaxPremium("")} />}
            </>
          )
        }
        pagination={
          viewMode === "list" ? (
            <Pagination page={page} totalItems={filteredLeads.length} itemsPerPage={itemsPerPage} itemLabel="leads" onPageChange={setPage} />
          ) : undefined
        }
      >
        {viewMode === "kanban" ? (
          filteredLeads.length === 0 ? (
            <EmptyState title="No opportunities found" description="Try changing your search or filters." compact />
          ) : (
            renderKanbanBoard()
          )
        ) : (
          <>
            <Table
              data={paginatedLeads}
              onRowClick={(lead) => setViewingLead({ id: lead.id, name: lead.name })}
              columns={[
              {
                header: <input type="checkbox" style={{ width: 15, height: 15, accentColor: T.blue }} />,
                key: "checkbox",
                width: 40,
                align: "center",
                render: () => <input type="checkbox" onClick={(e) => e.stopPropagation()} style={{ width: 14, height: 14, accentColor: T.blue }} />
              },
              {
                header: "Opportunity",
                key: "name",
                sortable: true,
                render: (lead) => <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.blue }}>{lead.name} ...</p>
              },
              {
                header: "Contact",
                key: "contact",
                render: (lead) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar name={lead.name} size={26} style={{ border: `1px solid ${T.border}` }} />
                    <span style={{ fontSize: 13, color: T.textMid }}>{lead.name}...</span>
                  </div>
                )
              },
              {
                header: "Stage",
                key: "stage",
                sortable: true,
                render: (lead) => <span style={{ fontSize: 13, color: T.textMid }}>{lead.stage}...</span>
              },
              {
                header: "Opportunity Value",
                key: "premium",
                sortable: true,
                render: (lead) => <span style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>${lead.premium.toLocaleString()}</span>
              },
              {
                header: "Status",
                key: "status",
                render: () => <Badge label="open" variant="custom" color={T.textMid} bgColor={T.pageBg} />
              },
              {
                header: "Opportunity Owner",
                key: "agent",
                render: (lead) => <Avatar name={lead.agent} size={28} style={{ backgroundColor: lead.agentColor }} />
              },
              {
                header: "Tags",
                key: "tags",
                render: () => <span style={{ backgroundColor: T.rowBg, borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700, color: T.textMuted }}>call center</span>
              },
              {
                header: "Created",
                key: "created",
                sortable: true,
                render: () => (
                  <div style={{ fontSize: 11, color: T.textMid }}>
                     <p style={{ margin: 0 }}>Mar 9, 2026</p>
                     <p style={{ margin: 0, fontSize: 10, color: T.textMuted }}>03:51 PM</p>
                  </div>
                )
              },
              {
                header: "Updated",
                key: "updated",
                sortable: true,
                render: () => (
                  <div style={{ fontSize: 11, color: T.textMid }}>
                     <p style={{ margin: 0 }}>Mar 16, 2026</p>
                     <p style={{ margin: 0, fontSize: 10, color: T.textMuted }}>10:42 AM</p>
                  </div>
                )
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
                        { label: "View Details", onClick: () => setViewingLead({ id: lead.id, name: lead.name }) },
                        { label: "Quick Edit", onClick: () => setQuickEditLead(lead) },
                        { label: "Edit Lead" },
                        { label: "Delete", danger: true },
                      ]}
                    />
                  </div>
                )
              }
              ]}
            />
            {filteredLeads.length === 0 && (
              <EmptyState title="No opportunities found" description="Try changing your search or filters." compact />
            )}
          </>
        )}
      </DataGrid>
 
      {/* Quick Edit Modal */}
      {quickEditLead && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", width: "100%", maxWidth: 1000, height: "100%", maxHeight: 800, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            {/* Header */}
            <div style={{ padding: "24px 32px", borderBottom: `1px solid ${T.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
                  Edit &quot;
                  {quickEditRow
                    ? `${String(quickEditRow.first_name ?? "").trim()} ${String(quickEditRow.last_name ?? "").trim()}`.trim() || "Lead"
                    : quickEditLead.name}
                  {quickEditRow?.phone != null && String(quickEditRow.phone).trim()
                    ? ` — ${formatPhoneDisplay(String(quickEditRow.phone))}`
                    : quickEditLead.phone
                      ? ` — ${formatPhoneDisplay(quickEditLead.phone)}`
                      : ""}
                  &quot;
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: T.textMuted, fontWeight: 600 }}>Loaded from database — edit below, then Update.</p>
              </div>
              <button type="button" onClick={closeQuickEdit} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {quickEditError && (
              <div style={{ padding: "12px 32px", backgroundColor: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 600, borderBottom: `1px solid ${T.borderLight}` }}>
                {quickEditError}
              </div>
            )}

            {/* Content Area */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
              {quickEditLoading && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: T.textMuted }}>
                  Loading lead…
                </div>
              )}
              {/* Left Sidebar */}
              <div style={{ width: 220, borderRight: `1px solid ${T.borderLight}`, padding: "16px 8px", backgroundColor: "#fcfdff" }}>
                {(["Opportunity Details", "Notes"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveQuickEditTab(tab)}
                    style={{
                      width: "100%", padding: "12px 16px", border: "none", borderRadius: "8px", textAlign: "left", fontSize: 13, fontWeight: 700,
                      cursor: "pointer",
                      backgroundColor: activeQuickEditTab === tab ? T.blueFaint : "transparent",
                      color: activeQuickEditTab === tab ? T.blue : T.textMuted,
                      marginBottom: 4, transition: "all 0.2s"
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Right Form Area */}
              <div style={{ flex: 1, padding: "32px", overflowY: "auto", backgroundColor: "#fff" }}>
                {!quickEditRow && !quickEditLoading ? (
                  <p style={{ color: T.textMuted, fontSize: 14 }}>No data loaded.</p>
                ) : quickEditRow ? (
                  activeQuickEditTab === "Opportunity Details" ? (
                  <div style={{ maxWidth: 900 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                       <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.textDark, display: "flex", alignItems: "center", gap: 8 }}>
                         Contact details <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                       </h3>
                       <label style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="checkbox" checked={hideEmptyQuickFields} onChange={(e) => setHideEmptyQuickFields(e.target.checked)} style={{ width: 16, height: 16 }} /> Hide empty fields (extra columns)
                       </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
                       <div>
                         <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>First name <span style={{ color: T.danger }}>*</span></label>
                         <input value={String(quickEditRow.first_name ?? "")} onChange={(e) => patchQuickEdit("first_name", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                       </div>
                       <div>
                         <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Last name <span style={{ color: T.danger }}>*</span></label>
                         <input value={String(quickEditRow.last_name ?? "")} onChange={(e) => patchQuickEdit("last_name", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                       </div>
                       <div>
                         <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Primary Email</label>
                         <input disabled placeholder="No email column on leads" style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600, background: T.pageBg, color: T.textMuted }} />
                       </div>
                       <div>
                         <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Primary Phone</label>
                         <input value={String(quickEditRow.phone ?? "")} onChange={(e) => patchQuickEdit("phone", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                       </div>
                    </div>

                    <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: T.textDark }}>Opportunity</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
                       <div style={{ gridColumn: "span 2" }}>
                         <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Display title (read-only)</label>
                         <input readOnly value={`${String(quickEditRow.first_name ?? "").trim()} ${String(quickEditRow.last_name ?? "").trim()}`.trim() + (quickEditRow.phone ? ` — ${formatPhoneDisplay(String(quickEditRow.phone))}` : "")} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600, background: T.pageBg, color: T.textDark }} />
                       </div>
                       <div>
                         <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Pipeline</label>
                         <select value={String(quickEditRow.pipeline ?? pipeline)} onChange={(e) => patchQuickEdit("pipeline", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }}>
                            {pipelines.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                         </select>
                       </div>
                       <div>
                         <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Stage</label>
                           <select value={String(quickEditRow.stage ?? "")} onChange={(e) => patchQuickEdit("stage", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }}>
                             {(quickEditStages.length ? quickEditStages : stages).map((s) => (
                               <option key={s} value={s}>{s}</option>
                             ))}
                           </select>
                       </div>
                       <div>
                         <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Lead source</label>
                         <input value={String(quickEditRow.lead_source ?? "")} onChange={(e) => patchQuickEdit("lead_source", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                       </div>
                       <div>
                         <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Product type</label>
                         <input value={String(quickEditRow.product_type ?? "")} onChange={(e) => patchQuickEdit("product_type", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                       </div>
                       <div>
                         <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Opportunity value</label>
                         <div style={{ position: "relative" }}>
                            <span style={{ position: "absolute", left: 14, top: 12, fontSize: 14, fontWeight: 600, color: T.textMuted }}>$</span>
                            <input type="number" value={quickEditRow.lead_value != null && quickEditRow.lead_value !== "" ? String(quickEditRow.lead_value) : ""} onChange={(e) => patchQuickEdit("lead_value", e.target.value === "" ? null : Number(e.target.value))} style={{ width: "100%", padding: "12px 12px 12px 28px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                         </div>
                       </div>
                       <div>
                         <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Monthly premium</label>
                         <input type="number" value={quickEditRow.monthly_premium != null && quickEditRow.monthly_premium !== "" ? String(quickEditRow.monthly_premium) : ""} onChange={(e) => patchQuickEdit("monthly_premium", e.target.value === "" ? null : Number(e.target.value))} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                       </div>
                    </div>

                    <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: T.textDark }}>Address & identifiers</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                      <div style={{ gridColumn: "span 2" }}>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Street 1</label>
                        <input value={String(quickEditRow.street1 ?? "")} onChange={(e) => patchQuickEdit("street1", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Street 2</label>
                        <input value={String(quickEditRow.street2 ?? "")} onChange={(e) => patchQuickEdit("street2", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>City</label>
                        <input value={String(quickEditRow.city ?? "")} onChange={(e) => patchQuickEdit("city", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>State</label>
                        <input value={String(quickEditRow.state ?? "")} onChange={(e) => patchQuickEdit("state", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>ZIP</label>
                        <input value={String(quickEditRow.zip_code ?? "")} onChange={(e) => patchQuickEdit("zip_code", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Lead unique ID</label>
                        <input readOnly value={String(quickEditRow.lead_unique_id ?? "")} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600, background: T.pageBg }} />
                      </div>
                    </div>

                    <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: T.textDark }}>All other columns</h3>
                    <p style={{ margin: "0 0 12px", fontSize: 12, color: T.textMuted }}>Remaining fields on this row (read-only: id, timestamps, submitted_by, call_center_id).</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(() => {
                        const primary = new Set([
                          "first_name", "last_name", "phone", "pipeline", "stage", "lead_source", "product_type",
                          "lead_value", "monthly_premium", "street1", "street2", "city", "state", "zip_code", "lead_unique_id",
                          "additional_information",
                        ]);
                        return Object.keys(quickEditRow)
                          .sort()
                          .filter((key) => !primary.has(key))
                          .filter((key) => {
                            if (!hideEmptyQuickFields) return true;
                            const v = quickEditRow[key];
                            if (v == null || v === "") return false;
                            if (Array.isArray(v) && v.length === 0) return false;
                            return true;
                          })
                          .map((key) => {
                            const readOnly = ["id", "created_at", "updated_at", "submitted_by", "call_center_id"].includes(key);
                            const v = quickEditRow[key];
                            const display =
                              v != null && typeof v === "object" && !Array.isArray(v)
                                ? JSON.stringify(v)
                                : Array.isArray(v)
                                  ? v.join(", ")
                                  : v == null
                                    ? ""
                                    : String(v);
                            const isLong = display.length > 80 || /information|conditions|medications|beneficiary/i.test(key);
                            return (
                              <div key={key} style={{ display: "grid", gridTemplateColumns: "minmax(140px,200px) 1fr", gap: 8, alignItems: "start" }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, paddingTop: 10 }}>{key.replace(/_/g, " ")}</label>
                                {readOnly ? (
                                  <input readOnly value={display} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, background: T.pageBg, color: T.textMid }} />
                                ) : isLong ? (
                                  <textarea value={display} onChange={(e) => patchQuickEdit(key, e.target.value)} rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: T.font, resize: "vertical" }} />
                                ) : key === "tags" ? (
                                  <input value={display} onChange={(e) => patchQuickEdit("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="comma-separated" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13 }} />
                                ) : (
                                  <input value={display} onChange={(e) => patchQuickEdit(key, e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13 }} />
                                )}
                              </div>
                            );
                          });
                      })()}
                    </div>
                  </div>
                ) : (
                  <div style={{ maxWidth: 800 }}>
                     <h3 style={{ margin: "0 0 24px", fontSize: 16, fontWeight: 800, color: T.textDark }}>Notes (additional_information)</h3>
                     <textarea
                       value={String(quickEditRow.additional_information ?? "")}
                       onChange={(e) => patchQuickEdit("additional_information", e.target.value)}
                       placeholder="Notes stored on the lead…"
                       style={{ width: "100%", height: 300, padding: "20px", borderRadius: "12px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 500, fontFamily: T.font, resize: "vertical", outline: "none" }}
                     />
                  </div>
                )
                ) : null}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 32px", borderTop: `1.5px solid ${T.borderLight}`, backgroundColor: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>
                 <div style={{ marginBottom: 4 }}>Row id: <span style={{ color: T.textDark, fontWeight: 700 }}>{quickEditLead.rowUuid}</span></div>
                 <div style={{ marginBottom: 4 }}>Created: {quickEditRow ? formatTs(quickEditRow.created_at) : "—"}</div>
                 <div>Updated: {quickEditRow ? formatTs(quickEditRow.updated_at) : "—"}</div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" disabled={quickEditSaving || !canUpdateActions} onClick={deleteQuickEdit} style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: "8px", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: T.danger, cursor: canUpdateActions ? "pointer" : "not-allowed", opacity: canUpdateActions ? 1 : 0.5 }}>
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                </button>
                <button type="button" onClick={closeQuickEdit} style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: "8px", padding: "0 24px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button
                  type="button"
                  disabled={quickEditSaving || quickEditLoading || !quickEditRow || !canUpdateActions}
                  title={
                    !canUpdateActions
                      ? "Missing permission: action.lead_pipeline.update. Ask an admin to grant pipeline update for your role."
                      : quickEditLoading
                        ? "Loading lead…"
                        : !quickEditRow
                          ? "Lead data not loaded."
                          : undefined
                  }
                  onClick={saveQuickEdit}
                  style={{
                    background: T.blue,
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0 32px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: canUpdateActions && !quickEditSaving && !quickEditLoading && quickEditRow ? "pointer" : "not-allowed",
                    opacity: canUpdateActions && !quickEditSaving && !quickEditLoading && quickEditRow ? 1 : 0.6,
                    boxShadow: "0 4px 12px rgba(37,99,235,0.2)",
                  }}
                >
                  {quickEditSaving ? "Saving…" : "Update"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
