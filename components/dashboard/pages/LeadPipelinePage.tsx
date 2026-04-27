"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { Avatar, EmptyState } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/shadcn/table";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentUserPrimaryRole } from "@/lib/auth/user-role";
import { Search, Filter, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LeadViewComponent from "./LeadViewComponent";
import CreateLeadModal from "./CreateLeadModal";

type Stage = string;

interface PipelineStage {
  id: number;
  name: string;
  description: string;
}

interface Lead {
  id: string;
  rowUuid: string;
  name: string;
  phone: string;
  social: string;
  type: string;
  premium: number;
  source: string;
  agent: string;
  agentColor: string;
  daysInStage: number;
  stage: Stage;
  stageId: number | null;
  createdAt?: string;
  updatedAt?: string;
}

type LeadRow = Record<string, unknown>;

type LeadNoteRow = {
  id: string;
  body: string;
  created_at: string;
  created_by: string | null;
  authorName?: string;
};

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
  "New Lead":          { color: "#638b4b", bg: "#f2f8ee", header: "#ddecd4" },
  "Attempted Contact": { color: "#6366f1", bg: "#eef2ff", header: "#e0e7ff" },
  "Contacted":         { color: "#4e6e3a", bg: "#f5f3ff", header: "#ede9fe" },
  "Discovery Call":    { color: "#d946ef", bg: "#fdf4ff", header: "#fae8ff" },
  "Presentation":      { color: "#94c278", bg: "#fdf2f8", header: "#fce7f3" },
  "Needs Quote":       { color: "#f43f5e", bg: "#fff1f2", header: "#ffe4e6" },
  "Quoted":            { color: "#74a557", bg: "#fffbeb", header: "#fef3c7" },
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
  Auto: "#638b4b", Home: "#9333ea", Life: "#16a34a", Health: "#ea580c", Commercial: "#6b7a5f",
};

const LEAD_ALL_LEADS_ROLES = new Set([
  "system_admin",
  "sales_admin",
  "sales_manager",
  "sales_agent_licensed",
  "sales_agent_unlicensed",
  "hr",
  "accounting",
]);

function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select..."
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={(val) => onValueChange(val || "")}>
      <SelectTrigger
        style={{
          width: "100%",
          height: 38,
          borderRadius: 10,
          border: `1px solid ${T.border}`,
          backgroundColor: T.cardBg,
          color: value && value !== "All" ? T.textDark : T.textMuted,
          fontSize: 13,
          fontWeight: 500,
          paddingLeft: 14,
          paddingRight: 12,
          transition: "all 0.15s ease-in-out",
          position: "relative",
          zIndex: 1,
        }}
        className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
      >
        <SelectValue placeholder={placeholder}>
          {value && value !== "All"
            ? options.find(o => o.value === value)?.label || value
            : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        style={{
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          backgroundColor: T.cardBg,
          padding: 6,
          maxHeight: 300,
          zIndex: 50,
        }}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            style={{
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 400,
              color: T.textDark,
              cursor: "pointer",
              transition: "all 0.1s ease-in-out",
            }}
            className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LoadingSpinner({ size = 40, label = "Loading..." }: { size?: number; label?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `3px solid ${T.border}`,
          borderTopColor: "#233217",
          animation: "spin 0.8s linear infinite",
        }}
      />
      {label && (
        <span style={{ fontSize: 14, fontWeight: 500, color: T.textMuted }}>{label}</span>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function StatSkeleton() {
  return (
    <Card
      style={{
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        borderBottom: "4px solid #DCEBDC",
        background: T.cardBg,
        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
        padding: "20px 24px",
        minHeight: 100,
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: 1 }}>
        <div style={{ width: 80, height: 10, borderRadius: 4, background: "linear-gradient(90deg, #E8E8E8 25%, #F0F0F0 50%, #E8E8E8 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
        <div style={{ width: 60, height: 26, borderRadius: 6, background: "linear-gradient(90deg, #E8E8E8 25%, #F0F0F0 50%, #E8E8E8 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      </div>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "linear-gradient(90deg, #E8E8E8 25%, #F0F0F0 50%, #E8E8E8 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </Card>
  );
}

export default function LeadPipelinePage({ canUpdateActions = true }: { canUpdateActions?: boolean }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const params = useParams<{ role?: string }>();
  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role;
  const canEditLeadPipeline = canUpdateActions;

  const goToLead = useCallback(
    (leadUuid: string) => {
      const role = routeRole || "agent";
      router.push(`/dashboard/${role}/leads/${leadUuid}`);
    },
    [router, routeRole]
  );

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<string>("");
  const [pipelines, setPipelines] = useState<string[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [stageDescriptions, setStageDescriptions] = useState<Record<string, string>>({});
  const [userCallCenterId, setUserCallCenterId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [itemsPerPage] = useState(20);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [collapsedStages, setCollapsedStages] = useState<Record<number, boolean>>({});
  const [dragRowUuid, setDragRowUuid] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [kanbanPage, setKanbanPage] = useState<Record<number, number>>({});
  const [hoveredStageTooltip, setHoveredStageTooltip] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const KANBAN_ITEMS_PER_PAGE = 25;
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);
  const [filterStageId, setFilterStageId] = useState<number | "All">("All");
  const [filterType, setFilterType] = useState("All");
  const [filterAgent, setFilterAgent] = useState("All");
  const [filterSource, setFilterSource] = useState("All");
  const [filterMinPremium, setFilterMinPremium] = useState("");
  const [filterMaxPremium, setFilterMaxPremium] = useState("");
  const [quickEditLead, setQuickEditLead] = useState<Lead | null>(null);
  const [activeQuickEditTab, setActiveQuickEditTab] = useState<"Opportunity Details" | "Notes">("Opportunity Details");
  const [quickEditRow, setQuickEditRow] = useState<LeadRow | null>(null);
  const [quickEditLoading, setQuickEditLoading] = useState(false);
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [quickEditError, setQuickEditError] = useState<string | null>(null);
  const [quickEditStages, setQuickEditStages] = useState<Stage[]>([]);
  const [leadNotes, setLeadNotes] = useState<LeadNoteRow[]>([]);
  const [leadNotesLoading, setLeadNotesLoading] = useState(false);
  const [leadNotesError, setLeadNotesError] = useState<string | null>(null);
  const [newNoteText, setNewNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [licensedOwnerOptions, setLicensedOwnerOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);
  const [createLeadModalOpen, setCreateLeadModalOpen] = useState(false);

  const resolvePipelineId = useCallback(
    async (pipelineName: string) => {
      if (!pipelineName) return null;
      const { data: pipelineRow } = await supabase.from("pipelines").select("id").eq("name", pipelineName).maybeSingle();
      return pipelineRow?.id ?? null;
    },
    [supabase]
  );

  const filteredLeads = useMemo(() => {
    const query = search.toLowerCase().trim();
    const numericQuery = query.replace(/\D/g, "");

    const result = leads.filter(l => {
      const matchesSearch =
        !query ||
        l.name.toLowerCase().includes(query) ||
        l.id.toLowerCase().includes(query) ||
        l.rowUuid.toLowerCase().includes(query) ||
        (numericQuery && l.phone.replace(/\D/g, "").includes(numericQuery)) ||
        (numericQuery && l.social.replace(/\D/g, "").includes(numericQuery));
      const matchesStage = filterStageId === "All" || l.stageId === filterStageId;
      const matchesType = filterType === "All" || l.type === filterType;
      const matchesAgent = filterAgent === "All" || l.agent === filterAgent;
      const matchesSource = filterSource === "All" || l.source === filterSource;
      const minPremium = filterMinPremium.trim() ? Number(filterMinPremium) : null;
      const maxPremium = filterMaxPremium.trim() ? Number(filterMaxPremium) : null;
      const validMin = minPremium == null || Number.isNaN(minPremium) ? true : l.premium >= minPremium;
      const validMax = maxPremium == null || Number.isNaN(maxPremium) ? true : l.premium <= maxPremium;
      return matchesSearch && matchesStage && matchesType && matchesAgent && matchesSource && validMin && validMax;
    });
    
    return result;
  }, [leads, search, filterStageId, filterType, filterAgent, filterSource, filterMinPremium, filterMaxPremium]);

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice((page - 1) * itemsPerPage, page * itemsPerPage);



  const byStageId = (stageId: number) => leads.filter((l) => l.stageId === stageId);
  const stageValue = (stageId: number) => byStageId(stageId).reduce((s, l) => s + l.premium, 0);

  const toggleCollapse = (stageId: number) => {
    setCollapsedStages((prev) => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterStageId !== "All") n++;
    if (filterType !== "All") n++;
    if (filterAgent !== "All") n++;
    if (filterSource !== "All") n++;
    if (filterMinPremium.trim()) n++;
    if (filterMaxPremium.trim()) n++;
    return n;
  }, [filterStageId, filterType, filterAgent, filterSource, filterMinPremium, filterMaxPremium]);

  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = () => {
    setSearch("");
    setFilterStageId("All");
    setFilterType("All");
    setFilterAgent("All");
    setFilterSource("All");
    setFilterMinPremium("");
    setFilterMaxPremium("");
    setPage(1);
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
    async (targetStageId: number) => {
      if (!dragRowUuid || !canEditLeadPipeline) {
        setDragRowUuid(null);
        setDragOver(null);
        return;
      }
      const droppedUuid = dragRowUuid;
      const prevLead = leads.find((l) => l.rowUuid === droppedUuid);
      if (!prevLead || prevLead.stageId === targetStageId) {
        setDragRowUuid(null);
        setDragOver(null);
        return;
      }
      const targetStageObj = stages.find((s) => s.id === targetStageId);
      const targetStageName = targetStageObj?.name ?? prevLead.stage;
      setLeads((p) => p.map((l) => (l.rowUuid === droppedUuid ? { ...l, stage: targetStageName, stageId: targetStageId, daysInStage: 0 } : l)));
      const updatePayload: Record<string, unknown> = { stage: targetStageName, stage_id: targetStageId };
      const { error } = await supabase.from("leads").update(updatePayload).eq("id", droppedUuid);
      setDragRowUuid(null);
      setDragOver(null);
      if (error && prevLead) {
        setLeads((p) => p.map((l) => (l.rowUuid === droppedUuid ? prevLead : l)));
      }
    },
    [dragRowUuid, canEditLeadPipeline, leads, stages, supabase]
  );

  useEffect(() => {
    setPage(1);
  }, [search, filterStageId, filterType, filterAgent, filterSource, filterMinPremium, filterMaxPremium]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
    if (filteredLeads.length === 0 && page !== 1) setPage(1);
  }, [filteredLeads.length, page, totalPages]);

  const loadLeadsForPipeline = useCallback(async () => {
    if (!stages.length) return;
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id || null;
    const role = userId ? await getCurrentUserPrimaryRole(supabase, userId) : null;
    let callCenterId: string | null = null;
    if (userId) {
      const { data: profile } = await supabase.from("users").select("call_center_id").eq("id", userId).maybeSingle();
      callCenterId = profile?.call_center_id ?? null;
      setUserCallCenterId(callCenterId);
    }

    const selectCols =
      "id, lead_unique_id, first_name, last_name, phone, social, lead_value, monthly_premium, product_type, lead_source, stage, stage_id, pipeline_id, is_draft, call_center_id, licensed_agent_account, created_at, updated_at";

    const isTransferPipeline = pipeline === "Transfer Portal";
    const canViewAllCenters = role ? LEAD_ALL_LEADS_ROLES.has(role) : false;

    // Build stage lookup from current pipeline stages
    const stageById = new Map<number, PipelineStage>();
    stages.forEach((s) => stageById.set(s.id, s));

    const mapRow = (row: Record<string, unknown>): Lead => {
      const fullName = `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Unnamed Lead";
      const premiumValue = Number(row.lead_value ?? row.monthly_premium ?? 0) || 0;
      const rawStageId = row.stage_id != null ? Number(row.stage_id) : null;
      const resolvedStage = rawStageId != null && stageById.has(rawStageId)
        ? stageById.get(rawStageId)!
        : null;
      const stageName: Stage = resolvedStage?.name || String(row.stage || "").trim() || (stages[0]?.name ?? "");
      const stageId: number | null = resolvedStage?.id ?? rawStageId ?? null;
      const rowUuid = String(row.id);
      const displayId = row.lead_unique_id ? String(row.lead_unique_id) : rowUuid;
      const phoneStr = row.phone != null ? String(row.phone) : "";
      const socialStr = row.social != null ? String(row.social) : "";

      return {
        id: displayId,
        rowUuid,
        name: fullName,
        phone: phoneStr,
        social: socialStr,
        type: String(row.product_type || (isTransferPipeline ? "Transfer" : "")),
        premium: premiumValue,
        source: String(row.lead_source || (isTransferPipeline ? "Transfer Portal" : "")),
        agent: String(row.licensed_agent_account || (isTransferPipeline ? "BPO" : "SS")),
        agentColor: "#638b4b",
        daysInStage: 0,
        stage: stageName,
        stageId,
        createdAt: row.created_at ? String(row.created_at) : undefined,
        updatedAt: row.updated_at ? String(row.updated_at) : undefined,
      };
    };

    const PAGE_SIZE = 1000;
    const fetchAllRows = async (
      makeBaseQuery: () => any,
    ): Promise<{ data: Record<string, unknown>[] | null; error: { message?: string } | null }> => {
      const all: Record<string, unknown>[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await makeBaseQuery().range(offset, offset + PAGE_SIZE - 1);
        if (error) return { data: null, error };
        const batch = (data ?? []) as Record<string, unknown>[];
        all.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }
      return { data: all, error: null };
    };

    if (isTransferPipeline) {
      const transferPipelineId = await resolvePipelineId("Transfer Portal");
      if (!transferPipelineId) {
        setLeads([]);
        setLoading(false);
        return;
      }
      const { data, error } = await fetchAllRows(() => {
        let q: any = supabase
          .from("leads")
          .select(selectCols)
          .eq("pipeline_id", transferPipelineId)
          .eq("is_draft", false)
          .order("created_at", { ascending: false });
        if (!canViewAllCenters) {
          if (callCenterId) q = q.eq("call_center_id", callCenterId);
          else if (userId) q = q.eq("submitted_by", userId);
        }
        return q;
      });

      if (error || !data || data.length === 0) {
        setLeads([]);
        setLoading(false);
        return;
      }

      setLeads((data as Record<string, unknown>[]).map((row) => mapRow(row)));
      setLoading(false);
      return;
    }

    if (!pipeline) {
      setLeads([]);
      setLoading(false);
      return;
    }

    const selectedPipelineId = await resolvePipelineId(pipeline);
    if (!selectedPipelineId) {
      setLeads([]);
      setLoading(false);
      return;
    }
    const { data, error } = await fetchAllRows(() => {
      let q: any = supabase
        .from("leads")
        .select(selectCols)
        .eq("pipeline_id", selectedPipelineId)
        .eq("is_draft", false)
        .order("created_at", { ascending: false });
      if (!canViewAllCenters) {
        if (callCenterId) q = q.eq("call_center_id", callCenterId);
        else if (userId) q = q.eq("submitted_by", userId);
      }
      return q;
    });
    if (error || !data) {
      setLeads([]);
      setLoading(false);
      return;
    }

    const mapped: Lead[] = (data as Record<string, unknown>[]).map((row) => mapRow(row));
    setLeads(mapped);
    setLoading(false);
  }, [pipeline, stages, supabase, resolvePipelineId]);

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
        setStages([]);
        return;
      }

      const { data: stageRows, error: stageError } = await supabase
        .from("pipeline_stages")
        .select("id, name, description")
        .eq("pipeline_id", pipelineRow.id)
        .order("position");

      if (stageError || !stageRows || stageRows.length === 0) {
        setStages([]);
        setStageDescriptions({});
        return;
      }

      const mappedStages: PipelineStage[] = stageRows
        .map((row: { id: number | null; name: string | null; description: string | null }) => ({
          id: row.id ?? 0,
          name: row.name ?? "",
          description: row.description ?? "",
        }))
        .filter((s) => s.id !== 0 && s.name !== "");

      if (mappedStages.length === 0) {
        setStages([]);
        setStageDescriptions({});
        return;
      }

      const descriptions: Record<string, string> = {};
      stageRows.forEach((row: { name: string | null; description: string | null }) => {
        if (row.name) {
          descriptions[row.name] = row.description || "";
        }
      });

      setStages(mappedStages);
      setStageDescriptions(descriptions);

      setFilterStageId((current) => (current === "All" || mappedStages.some((s) => s.id === current) ? current : "All"));
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
    const pipelineName = String((quickEditRow as LeadRow | null)?.pipeline_name ?? pipeline ?? "").trim();
    if (!pipelineName) {
      setQuickEditStages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      // Clear immediately so we never show another pipeline's stages.
      setQuickEditStages([]);
      const { data: pipelineRow, error } = await supabase.from("pipelines").select("id").eq("name", pipelineName).maybeSingle();
      if (cancelled) return;
      if (error || !pipelineRow?.id) {
        setQuickEditStages(stages.map(s => s.name));
        return;
      }
      const { data: stageRows, error: stageError } = await supabase
        .from("pipeline_stages")
        .select("name")
        .eq("pipeline_id", pipelineRow.id)
        .order("position");
      if (cancelled) return;
      if (stageError || !stageRows?.length) {
        setQuickEditStages(stages.map(s => s.name));
        return;
      }
      const names = stageRows.map((r: { name: string | null }) => r.name).filter((n): n is string => Boolean(n));
      setQuickEditStages(names.length ? names : stages.map(s => s.name));
    })();
    return () => {
      cancelled = true;
    };
  }, [quickEditRow?.pipeline_name, supabase, stages, pipeline]);

  const patchQuickEdit = (key: string, value: unknown) => {
    setQuickEditRow((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const loadLeadNotes = useCallback(
    async (leadId: string) => {
      setLeadNotesLoading(true);
      setLeadNotesError(null);
      const { data: notes, error } = await supabase
        .from("lead_notes")
        .select("id, body, created_at, created_by")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (error) {
        setLeadNotesError(error.message);
        setLeadNotes([]);
        setLeadNotesLoading(false);
        return;
      }

      const rows = (notes || []) as Pick<LeadNoteRow, "id" | "body" | "created_at" | "created_by">[];
      const creatorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
      let nameById: Record<string, string> = {};
      if (creatorIds.length) {
        const { data: users } = await supabase.from("users").select("id, full_name").in("id", creatorIds);
        if (users) {
          nameById = Object.fromEntries(
            users.map((u: { id: string; full_name: string | null }) => [u.id, u.full_name?.trim() || "User"])
          );
        }
      }

      setLeadNotes(
        rows.map((r) => ({
          ...r,
          authorName: r.created_by ? nameById[r.created_by] ?? "User" : "System",
        }))
      );
      setLeadNotesLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    if (!quickEditLead?.rowUuid || activeQuickEditTab !== "Notes") return;
    void loadLeadNotes(quickEditLead.rowUuid);
  }, [quickEditLead?.rowUuid, activeQuickEditTab, loadLeadNotes]);

  useEffect(() => {
    if (!quickEditLead) {
      setSessionUserId(null);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSessionUserId(data.session?.user?.id ?? null);
    });
  }, [quickEditLead, supabase]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, is_licensed, roles!inner(key)")
        .in("status", ["active", "invited"]);
      if (cancelled || error || !data) return;
      const options = (data as Array<{ id: string; full_name: string | null; is_licensed?: boolean | null; roles: { key: string } | { key: string }[] | null }>)
        .map((row) => {
          const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
          return {
            id: row.id,
            name: row.full_name?.trim() || "Unknown User",
            roleKey: role?.key || "",
            isLicensed: row.is_licensed === true,
          };
        })
        .filter((row) => row.roleKey === "sales_agent_licensed")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((row) => ({ id: row.id, name: row.name }));
      if (!cancelled) setLicensedOwnerOptions(options);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const addLeadNote = async () => {
    if (!quickEditLead?.rowUuid || !newNoteText.trim()) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      setLeadNotesError("You must be signed in to add a note.");
      return;
    }
    setAddingNote(true);
    setLeadNotesError(null);
    const { error } = await supabase.from("lead_notes").insert({
      lead_id: quickEditLead.rowUuid,
      body: newNoteText.trim(),
      created_by: session.user.id,
    });
    setAddingNote(false);
    if (error) {
      setLeadNotesError(error.message);
      return;
    }
    setNewNoteText("");
    await loadLeadNotes(quickEditLead.rowUuid);
  };

  const deleteLeadNote = async (noteId: string) => {
    setLeadNotesError(null);
    const { error } = await supabase.from("lead_notes").delete().eq("id", noteId);
    if (error) {
      setLeadNotesError(error.message);
      return;
    }
    if (quickEditLead?.rowUuid) await loadLeadNotes(quickEditLead.rowUuid);
  };

  const closeQuickEdit = () => {
    setQuickEditLead(null);
    setQuickEditRow(null);
    setQuickEditError(null);
    setActiveQuickEditTab("Opportunity Details");
    setLeadNotes([]);
    setLeadNotesError(null);
    setNewNoteText("");
  };

  const openQuickEdit = (lead: Lead) => {
    if (!canEditLeadPipeline) return;
    setQuickEditLead(lead);
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

    const pipelineName = strVal("pipeline_name") || pipeline || "";
    const stageName = strVal("stage") || "";
    const stageId = pipelineName && stageName ? await resolveStageId(pipelineName, stageName) : null;
    const pipelineId = pipelineName ? await resolvePipelineId(pipelineName) : null;

    let tagsVal: string[] | null = null;
    const tagsRaw = quickEditRow.tags;
    if (Array.isArray(tagsRaw)) {
      tagsVal = tagsRaw.map((t) => String(t)).filter(Boolean);
    } else if (typeof tagsRaw === "string" && tagsRaw.trim()) {
      try {
        const parsed = JSON.parse(tagsRaw);
        if (Array.isArray(parsed)) tagsVal = parsed.map((t) => String(t));
      } catch {
        tagsVal = tagsRaw.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    }

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
      licensed_agent_account: strVal("licensed_agent_account"),
      draft_date: strVal("draft_date"),
      beneficiary_information: strVal("beneficiary_information"),
      bank_account_type: strVal("bank_account_type"),
      institution_name: strVal("institution_name"),
      routing_number: strVal("routing_number"),
      account_number: strVal("account_number"),
      future_draft_date: strVal("future_draft_date"),
      additional_information: strVal("additional_information"),
      stage: strVal("stage") || "Transfer API",
      lead_source: strVal("lead_source"),
      submission_date: strVal("submission_date"),
    };

    if (pipelineId != null) payload.pipeline_id = pipelineId;
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

  const [showAddLead, setShowAddLead] = useState(false);
  const sourceOptions = Array.from(new Set(leads.map((lead) => lead.source).filter(Boolean)));

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
        .kanban-board::-webkit-scrollbar-thumb { background-color: #c8d4bb; border-radius: 10px; }
        
        .kanban-column-wrapper {
          min-width: 320px;
          width: 320px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background-color: #fff;
          border: 1px solid ${T.border};
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          transition: width 0.2s ease;
          height: 100%;
        }
        
        .kanban-column-body {
          overflow-y: auto;
          max-height: calc(100vh - 280px);
          min-height: 400px;
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .kanban-column-body::-webkit-scrollbar { width: 6px; }
        .kanban-column-body::-webkit-scrollbar-track { background: transparent; }
        .kanban-column-body::-webkit-scrollbar-thumb { background-color: #b8c9a8; border-radius: 6px; }
        .kanban-column-body::-webkit-scrollbar-thumb:hover { background-color: #233217; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      
      <div className="kanban-container">
        <div className="kanban-board">
          {stages.map((stageObj, index) => {
            const stageId = stageObj.id;
            const stageName = stageObj.name;
            const cfg = getStageConfig(stageName, index);
            const filteredLeadUuids = new Set(filteredLeads.map(l => l.rowUuid));
            const stageLeads = byStageId(stageId).filter(l => filteredLeadUuids.has(l.rowUuid));
            const isCollapsed = collapsedStages[stageId];
            const isOver = dragOver === stageId;
            const currentPage = kanbanPage[stageId] || 1;
            const totalPages = Math.ceil(stageLeads.length / KANBAN_ITEMS_PER_PAGE);
            const paginatedLeads = stageLeads.slice((currentPage - 1) * KANBAN_ITEMS_PER_PAGE, currentPage * KANBAN_ITEMS_PER_PAGE);
            return (
              <div
                key={stageId}
                onDragOver={(e) => {
                  if (!canEditLeadPipeline || isCollapsed) return;
                  e.preventDefault();
                  setDragOver(stageId);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => {
                  if (!canEditLeadPipeline || isCollapsed) return;
                  void handleKanbanDrop(stageId);
                }}
                className="kanban-column-wrapper"
                style={{ 
                  minWidth: isCollapsed ? 50 : 320,
                  width: isCollapsed ? 50 : 320,
                }}
              >
                {isCollapsed ? (
                  <div style={{ backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "16px 0", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }} onClick={() => toggleCollapse(stageId)}>
                    <div style={{ backgroundColor: cfg.color, color: "#fff", borderRadius: 10, padding: "2px 7px", fontSize: 11, fontWeight: 800, marginBottom: 16 }}>
                      {stageLeads.length}
                    </div>
                    <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 13, fontWeight: 800, color: cfg.color, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>
                      {stageName}
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        background: `linear-gradient(180deg, ${cfg.bg} 0%, #ffffff 88%)`,
                        padding: "12px 16px",
                        borderTop: `4px solid ${cfg.color}`,
                        borderBottom: `1px solid ${T.borderLight}`,
                        borderRadius: "12px 12px 0 0",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: T.textDark }}>{stageName}</span>
                          {stageDescriptions[stageName] && (
                            <div style={{ position: "relative" }}>
                              <button
                                onMouseEnter={(e) => {
                                  setHoveredStageTooltip(stageName);
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTooltipPosition({ x: rect.left, y: rect.bottom + 8 });
                                }}
                                onMouseLeave={() => {
                                  setHoveredStageTooltip(null);
                                  setTooltipPosition(null);
                                }}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: T.textMuted, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10"/>
                                  <line x1="12" y1="16" x2="12" y2="12"/>
                                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                           <button onClick={() => toggleCollapse(stageId)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: T.textMuted }}>
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                           </button>
                        </div>
                      </div>
                      <div style={{ marginTop: 4, display: "flex", gap: 12, fontSize: 12 }}>
                        <span style={{ color: T.textMuted, fontWeight: 600 }}>{stageLeads.length} Opportunities</span>
                        <span style={{ color: T.textDark, fontWeight: 800 }}>${stageValue(stageId).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="kanban-column-body" style={{ backgroundColor: isOver ? cfg.bg + "40" : "#fafcf8", transition: "background-color 0.2s" }}>
                      {paginatedLeads.map((lead) => (
                        <div
                          key={lead.rowUuid}
                          onClick={() => goToLead(lead.rowUuid)}
                          draggable={canEditLeadPipeline}
                          onDragStart={() => { if (canEditLeadPipeline) setDragRowUuid(lead.rowUuid); }}
                          onDragEnd={() => { setDragRowUuid(null); setDragOver(null); }}
                          style={{
                            backgroundColor: "#fff", borderRadius: 10, padding: "16px",
                            boxShadow: "0 2px 8px rgba(35, 50, 23, 0.08)",
                            borderWidth: 1, borderStyle: "solid", borderColor: T.border,
                            borderLeftWidth: 4, borderLeftStyle: "solid", borderLeftColor: cfg.color,
                            cursor: canEditLeadPipeline ? "grab" : "pointer",
                            opacity: dragRowUuid === lead.rowUuid ? 0.5 : 1,
                            transition: "all 0.2s ease",
                            position: "relative"
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = "#233217"; e.currentTarget.style.borderLeftColor = cfg.color; e.currentTarget.style.boxShadow = "0 6px 20px rgba(35, 50, 23, 0.15)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.borderLeftColor = cfg.color; e.currentTarget.style.boxShadow = "0 2px 8px rgba(35, 50, 23, 0.08)"; e.currentTarget.style.transform = "translateY(0)"; }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "flex-start" }}>
                            <div style={{ flex: 1, marginRight: 8 }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.textDark, lineHeight: 1.4 }}>
                                {lead.name}
                                {lead.phone ? ` — ${formatPhoneDisplay(lead.phone)}` : ""}
                              </p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {canEditLeadPipeline && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openQuickEdit(lead);
                                  }}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                              )}
                              <input type="checkbox" onClick={(e) => e.stopPropagation()} style={{ width: 16, height: 16, accentColor: "#233217", cursor: "pointer", border: `1.5px solid ${T.border}`, borderRadius: 4 }} />
                            </div>
                          </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                              {lead.agent && lead.agent !== "BPO" && lead.agent !== "SS" ? (
                                <div style={{ display: "flex", fontSize: 12, gap: 8 }}>
                                  <span style={{ color: T.textMuted, fontWeight: 500, width: 110 }}>Assigned To:</span>
                                  <span style={{ color: T.textDark, fontWeight: 600 }}>{lead.agent}</span>
                                </div>
                              ) : null}
                              <div style={{ display: "flex", fontSize: 12, gap: 8 }}>
                                <span style={{ color: T.textMuted, fontWeight: 500, width: 110 }}>Opportunity Value:</span>
                                <span style={{ color: T.textDark, fontWeight: 600 }}>${lead.premium.toLocaleString()}</span>
                              </div>
                            </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 12, borderTop: `1px solid ${T.borderLight}` }}>
                             {[
                               { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>, count: 11, color: "#638b4b" },
                               { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, count: 52, color: "#9333ea" },
                             ].map((item, idx) => (
                               <div key={idx} style={{ color: item.color, display: "flex", alignItems: "center", position: "relative", cursor: "pointer", opacity: 0.7 }}>
                                 {item.count !== undefined && item.count > 0 && (
                                   <div style={{ position: "absolute", top: -8, right: -10, backgroundColor: item.color, color: "#fff", fontSize: 9, fontWeight: 800, minWidth: 18, height: 18, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #fff", padding: "0 3px" }}>{item.count}</div>
                                 )}
                                 {item.icon}
                               </div>
                             ))}
                          </div>
                        </div>
                      ))}

                      {totalPages > 1 && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 4px", borderTop: `1px solid ${T.borderLight}`, marginTop: 4 }}>
                          <button
                            onClick={() => setKanbanPage(prev => ({ ...prev, [stageId]: Math.max(1, (prev[stageId] || 1) - 1) }))}
                            disabled={currentPage === 1}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 6,
                              border: `1px solid ${T.border}`,
                              background: "#fff",
                              color: currentPage === 1 ? T.textMuted : "#233217",
                              cursor: currentPage === 1 ? "not-allowed" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: currentPage === 1 ? 0.5 : 1,
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                          </button>
                          <span style={{ fontSize: 12, fontWeight: 600, color: T.textDark }}>
                            {currentPage} / {totalPages}
                          </span>
                          <button
                            onClick={() => setKanbanPage(prev => ({ ...prev, [stageId]: Math.min(totalPages, (prev[stageId] || 1) + 1) }))}
                            disabled={currentPage === totalPages}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 6,
                              border: `1px solid ${T.border}`,
                              background: "#fff",
                              color: currentPage === totalPages ? T.textMuted : "#233217",
                              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: currentPage === totalPages ? 0.5 : 1,
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                          </button>
                        </div>
                      )}
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

  if (showAddLead) {
    return <LeadViewComponent isCreation onBack={() => setShowAddLead(false)} onSubmit={(newLead: any) => {
      const mappedLead: Lead = {
        id: `P-0${leads.length + 1}`,
        rowUuid: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `temp-${Date.now()}`,
        name: newLead.name,
        phone: "",
        social: "",
        type: newLead.type,
        premium: newLead.premium,
        source: newLead.source,
        agent: "SS",
        agentColor: "#638b4b",
        daysInStage: 0,
        stage: newLead.stage as Stage,
        stageId: null,
      };
      setLeads(prev => [mappedLead, ...prev]);
      setShowAddLead(false);
    }} />;
  }

  const totalPremium = filteredLeads.reduce((s, l) => s + l.premium, 0);
  const avgPremium = filteredLeads.length ? totalPremium / filteredLeads.length : 0;
  const uniqueAgents = new Set(filteredLeads.map((l) => l.agent)).size;

  const stageOptions = [{ value: "All", label: "All Stages" }, ...stages.map(s => ({ value: String(s.id), label: s.name }))];
  const typeOptions = [{ value: "All", label: "All Types" }, ...Object.keys(TYPE_COLORS).map(t => ({ value: t, label: t }))];
  const agentOptions = [{ value: "All", label: "All Owners" }, ...Array.from(new Set(leads.map((l) => l.agent))).map(a => ({ value: a, label: a }))];
  const sourceFilterOptions = [{ value: "All", label: "All Sources" }, ...sourceOptions.map(s => ({ value: s, label: s }))];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0, paddingBottom: 24, position: "relative" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          [
            { label: "Total Opportunities", value: filteredLeads.length.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              ) },
            { label: "Total Value", value: `$${totalPremium.toLocaleString()}`, color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              ) },
            { label: "Average Value", value: `$${Math.round(avgPremium).toLocaleString()}`, color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              ) },
            { label: "Active Owners", value: uniqueAgents.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              ) },
          ].map(({ label, value, color, icon }, i) => (
              <Card
                key={label}
                onMouseEnter={() => setHoveredStatIdx(i)}
                onMouseLeave={() => setHoveredStatIdx(null)}
                style={{
                  borderRadius: 16,
                  border: `1px solid ${T.border}`,
                  borderBottom: `4px solid ${color}`,
                  background: `linear-gradient(135deg, color-mix(in srgb, ${color} 20%, ${T.cardBg}) 0%, ${T.cardBg} 80%)`,
                  boxShadow:
                    hoveredStatIdx === i
                      ? "0 14px 40px rgba(28, 32, 26, 0.08), 0 4px 14px rgba(28, 32, 26, 0.05)"
                      : "0 4px 12px rgba(0,0,0,0.03)",
                  transform: hoveredStatIdx === i ? "translateY(-3px)" : "translateY(0)",
                  transition:
                    "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
                  padding: "20px 24px",
                  minHeight: 100,
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  cursor: "default",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#233217", letterSpacing: "0.45px", textTransform: "uppercase", lineHeight: 1.25 }}>{label}</span>
                  <div style={{ fontSize: 26, fontWeight: 800, color: color, lineHeight: 1.05, wordBreak: "break-all" }}>
                    {value}
                  </div>
                </div>
                <div
                  style={{
                    color,
                    backgroundColor:
                      hoveredStatIdx === i
                        ? `color-mix(in srgb, ${color} 24%, transparent)`
                        : `color-mix(in srgb, ${color} 15%, transparent)`,
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition:
                      "background-color 0.32s cubic-bezier(0.22, 1, 0.36, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
                    transform: hoveredStatIdx === i ? "scale(1.04)" : "scale(1)",
                  }}
                >
                  {icon}
                </div>
              </Card>
          ))
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 14 }}>
        <div
          style={{
            width: "100%",
            background: T.cardBg,
            border: `1px solid ${T.border}`,
            borderBottom: filterPanelExpanded || hasActiveFilters ? "none" : `1px solid ${T.border}`,
            borderRadius: filterPanelExpanded || hasActiveFilters ? "16px 16px 0 0" : 16,
            padding: "14px 20px",
            boxShadow: filterPanelExpanded || hasActiveFilters ? "none" : T.shadowSm,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search
                size={16}
                style={{ position: "absolute", left: 12, pointerEvents: "none", zIndex: 1, color: T.textMuted }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, SSN, lead id..."
                style={{
                  height: 38,
                  minWidth: 320,
                  paddingLeft: 38,
                  paddingRight: 14,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  fontSize: 14,
                  color: T.textDark,
                  background: T.pageBg,
                  outline: "none",
                  fontFamily: T.font,
                  transition: "all 0.15s ease-in-out",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#233217";
                  e.currentTarget.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
            <StyledSelect
              value={pipeline}
              onValueChange={setPipeline}
              options={pipelines.map(p => ({ value: p, label: p }))}
              placeholder="Select pipeline..."
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => setFilterPanelExpanded((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 38,
                padding: "0 16px",
                borderRadius: 10,
                border: filterPanelExpanded ? `1.5px solid #233217` : `1px solid ${T.border}`,
                background: filterPanelExpanded ? "#DCEBDC" : T.pageBg,
                color: filterPanelExpanded ? "#233217" : T.textDark,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: T.font,
                cursor: "pointer",
                transition: "all 0.15s ease-in-out",
              }}
            >
              <Filter size={16} />
              Filters
              {activeFilterCount > 0 && (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 20,
                  height: 20,
                  padding: "0 6px",
                  borderRadius: 999,
                  background: "#233217",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div style={{ display: "flex", border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
               <button onClick={() => setViewMode("kanban")} style={{ padding: "8px 10px", background: viewMode === "kanban" ? "#DCEBDC" : "#fff", color: viewMode === "kanban" ? "#233217" : T.textMuted, border: "none", cursor: "pointer" }}>
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
               </button>
               <button onClick={() => setViewMode("list")} style={{ padding: "8px 10px", background: viewMode === "list" ? "#DCEBDC" : "#fff", color: viewMode === "list" ? "#233217" : T.textMuted, border: "none", borderLeft: `1px solid ${T.border}`, cursor: "pointer" }}>
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
               </button>
            </div>

            {canEditLeadPipeline && (
              <button
                onClick={() => setCreateLeadModalOpen(true)}
                style={{
                  height: 38,
                  padding: "0 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "#233217",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(35, 50, 23, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.15s ease-in-out",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#1a2616";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(35, 50, 23, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#233217";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(35, 50, 23, 0.2)";
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = "scale(0.98)";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <Plus size={16} />
                Create Lead
              </button>
            )}
          </div>
        </div>

        {(filterPanelExpanded || hasActiveFilters) && (
          <div
            style={{
              width: "100%",
              background: T.cardBg,
              border: `1px solid ${T.border}`,
              borderRadius: "0 0 16px 16px",
              padding: "20px 24px",
              boxShadow: T.shadowSm,
              display: "flex",
              flexDirection: "column",
              gap: 20,
              overflow: "visible",
              position: "relative",
              zIndex: 50,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Stage</div>
                  <StyledSelect
                    value={String(filterStageId)}
                    onValueChange={(val) => setFilterStageId(val === "All" ? "All" : Number(val))}
                    options={stageOptions}
                    placeholder="All Stages"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Type</div>
                  <StyledSelect
                    value={filterType}
                    onValueChange={setFilterType}
                    options={typeOptions}
                    placeholder="All Types"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Owner</div>
                  <StyledSelect
                    value={filterAgent}
                    onValueChange={setFilterAgent}
                    options={agentOptions}
                    placeholder="All Owners"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Source</div>
                  <StyledSelect
                    value={filterSource}
                    onValueChange={setFilterSource}
                    options={sourceFilterOptions}
                    placeholder="All Sources"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Min Value</div>
                  <input
                    type="number"
                    value={filterMinPremium}
                    onChange={(e) => setFilterMinPremium(e.target.value)}
                    placeholder="0"
                    style={{
                      width: "100%",
                      height: 38,
                      paddingLeft: 14,
                      paddingRight: 12,
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      fontSize: 13,
                      color: T.textDark,
                      background: T.cardBg,
                      outline: "none",
                      fontFamily: T.font,
                      transition: "all 0.15s ease-in-out",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#233217";
                      e.currentTarget.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Max Value</div>
                  <input
                    type="number"
                    value={filterMaxPremium}
                    onChange={(e) => setFilterMaxPremium(e.target.value)}
                    placeholder="10000"
                    style={{
                      width: "100%",
                      height: 38,
                      paddingLeft: 14,
                      paddingRight: 12,
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      fontSize: 13,
                      color: T.textDark,
                      background: T.cardBg,
                      outline: "none",
                      fontFamily: T.font,
                      transition: "all 0.15s ease-in-out",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#233217";
                      e.currentTarget.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {filterStageId !== "All" && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                        Stage: {stages.find(s => s.id === filterStageId)?.name ?? filterStageId}
                        <button onClick={() => setFilterStageId("All")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    )}
                    {filterType !== "All" && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                        Type: {filterType}
                        <button onClick={() => setFilterType("All")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    )}
                    {filterAgent !== "All" && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                        Owner: {filterAgent}
                        <button onClick={() => setFilterAgent("All")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    )}
                    {filterSource !== "All" && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                        Source: {filterSource}
                        <button onClick={() => setFilterSource("All")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    )}
                    {filterMinPremium.trim() && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                        Min: ${filterMinPremium}
                        <button onClick={() => setFilterMinPremium("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    )}
                    {filterMaxPremium.trim() && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                        Max: ${filterMaxPremium}
                        <button onClick={() => setFilterMaxPremium("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={clearAllFilters}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#233217",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "4px 0",
                      transition: "all 0.15s ease-in-out",
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
          </div>
        )}
      </div>

      {loading ? (
        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            backgroundColor: T.cardBg,
            padding: "80px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <LoadingSpinner size={48} label="Loading opportunities..." />
        </div>
      ) : filteredLeads.length === 0 ? (
        <EmptyState title="No opportunities found" description="Try changing your search or filters." />
      ) : viewMode === "kanban" ? (
        filteredLeads.length === 0 ? (
          <EmptyState title="No opportunities found" description="Try changing your search or filters." compact />
        ) : (
          renderKanbanBoard()
        )
      ) : (
        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            borderBottom: "none",
            overflow: "hidden",
            backgroundColor: T.cardBg,
          }}
        >
          <ShadcnTable>
            <TableHeader style={{ backgroundColor: "#233217" }}>
              <TableRow style={{ borderBottom: "none" }} className="hover:bg-transparent">
                {[
                  { label: "Opportunity", align: "left" as const },
                  { label: "Stage", align: "left" as const },
                  { label: "Type", align: "left" as const },
                  { label: "Value", align: "right" as const },
                  { label: "Owner", align: "left" as const },
                  { label: "Source", align: "left" as const },
                  { label: "Actions", align: "center" as const },
                ].map(({ label, align }) => (
                  <TableHead key={label} style={{
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: "0.3px",
                    padding: "16px 20px",
                    whiteSpace: "nowrap",
                    textAlign: align
                  }}>
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLeads.map((lead) => (
                <TableRow
                  key={lead.rowUuid}
                  onClick={() => goToLead(lead.rowUuid)}
                  style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                  className="hover:bg-muted/30 transition-all duration-150"
                >
                  <TableCell style={{ padding: "14px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar name={lead.name} size={32} style={{ border: `1px solid ${T.border}` }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.textDark }}>{lead.name}</p>
                        <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>{lead.phone ? formatPhoneDisplay(lead.phone) : "No phone"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell style={{ padding: "14px 20px" }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 999,
                      backgroundColor: TYPE_COLORS[lead.type] ? `${TYPE_COLORS[lead.type]}15` : "#f0f0f0",
                      color: TYPE_COLORS[lead.type] || T.textMid,
                    }}>
                      {lead.stage}
                    </span>
                  </TableCell>
                  <TableCell style={{ padding: "14px 20px" }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 999,
                      backgroundColor: TYPE_COLORS[lead.type] ? `${TYPE_COLORS[lead.type]}15` : "#f0f0f0",
                      color: TYPE_COLORS[lead.type] || T.textMid,
                    }}>
                      {lead.type}
                    </span>
                  </TableCell>
                  <TableCell style={{ padding: "14px 20px", textAlign: "right" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#233217" }}>${lead.premium.toLocaleString()}</span>
                  </TableCell>
                  <TableCell style={{ padding: "14px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={lead.agent} size={28} style={{ backgroundColor: lead.agentColor }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: T.textDark }}>{lead.agent}</span>
                    </div>
                  </TableCell>
                  <TableCell style={{ padding: "14px 20px" }}>
                    <span style={{ fontSize: 13, color: T.textMid }}>{lead.source}</span>
                  </TableCell>
                  <TableCell style={{ padding: "12px 16px", textAlign: "center" }}>
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap" }}
                    >
                      <button
                        onClick={() => goToLead(lead.rowUuid)}
                        style={{ background: "none", border: "none", color: "#233217", cursor: "pointer", padding: 6, borderRadius: 6 }}
                        title="View Lead"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                      {canEditLeadPipeline && (
                        <button
                          onClick={() => openQuickEdit(lead)}
                          style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", padding: 6, borderRadius: 6 }}
                          title="Quick Edit"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ShadcnTable>
        </div>
      )}

      {viewMode === "list" && !loading && filteredLeads.length > 0 && (
        <div style={{
          backgroundColor: T.cardBg,
          border: `1px solid ${T.border}`,
          borderTop: "none",
          borderRadius: "0 0 16px 16px",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontSize: 13, color: "#233217", fontWeight: 500 }}>
            Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, filteredLeads.length)} of {filteredLeads.length} opportunities
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: "#fff",
                color: page === 1 ? T.textMuted : "#233217",
                cursor: page === 1 ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textDark, minWidth: 80, textAlign: "center" }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: "#fff",
                color: page === totalPages ? T.textMuted : "#233217",
                cursor: page === totalPages ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        </div>
      )}

      {quickEditLead && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", width: "100%", maxWidth: 1000, height: "100%", maxHeight: 800, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "24px 32px", borderBottom: `1px solid ${T.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
                  Edit &quot;
                  {quickEditRow
                    ? `${String(quickEditRow.first_name ?? "").trim()} ${String(quickEditRow.last_name ?? "").trim()}`.trim() || "Lead"
                    : quickEditLead.name}
                  &quot;
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: T.textMuted, fontWeight: 600 }}>
                  {canEditLeadPipeline
                    }
                </p>
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

            <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
              {quickEditLoading && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: T.textMuted }}>
                  Loading lead…
                </div>
              )}
              <div style={{ width: 220, borderRight: `1px solid ${T.borderLight}`, padding: "16px 8px", backgroundColor: "#fcfdff" }}>
                {(["Opportunity Details", "Notes"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveQuickEditTab(tab)}
                    style={{
                      width: "100%", padding: "12px 16px", border: "none", borderRadius: "8px", textAlign: "left", fontSize: 13, fontWeight: 700,
                      cursor: "pointer",
                      backgroundColor: activeQuickEditTab === tab ? "#DCEBDC" : "transparent",
                      color: activeQuickEditTab === tab ? "#233217" : T.textMuted,
                      marginBottom: 4, transition: "all 0.2s"
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, padding: "32px", overflowY: "auto", backgroundColor: "#fff" }}>
                {!quickEditRow && !quickEditLoading ? (
                  <p style={{ color: T.textMuted, fontSize: 14 }}>No data loaded.</p>
                ) : quickEditRow ? (
                  activeQuickEditTab === "Opportunity Details" ? (
                  <div style={{ maxWidth: 900 }}>
                    <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: T.textDark }}>Contact details</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Primary Contact Name</label>
                        <input
                          value={`${String(quickEditRow.first_name ?? "").trim()} ${String(quickEditRow.last_name ?? "").trim()}`.trim()}
                          onChange={(e) => {
                            const parts = e.target.value.trim().split(/\s+/);
                            const first = parts.shift() || "";
                            const last = parts.join(" ");
                            patchQuickEdit("first_name", first);
                            patchQuickEdit("last_name", last);
                          }}
                          style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Primary Phone</label>
                        <input value={String(quickEditRow.phone ?? "")} onChange={(e) => patchQuickEdit("phone", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                      </div>
                    </div>

                    <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: T.textDark }}>Opportunity Details</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Pipeline</label>
                        <StyledSelect
                          value={String(quickEditRow.pipeline_name ?? pipeline)}
                          onValueChange={(val) => {
                            patchQuickEdit("pipeline_name", val);
                            // Reset stage when pipeline changes; stage options will reload from `pipeline_stages`.
                            patchQuickEdit("stage", "");
                          }}
                          options={pipelines.map(p => ({ value: p, label: p }))}
                          placeholder="Select pipeline..."
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Stage</label>
                        <StyledSelect
                          value={String(quickEditRow.stage ?? "")}
                          onValueChange={(val) => patchQuickEdit("stage", val)}
                           options={[{ value: "All", label: "All Stages" }, ...(quickEditStages.length ? quickEditStages : stages.map(s => s.name)).map(s => ({ value: s, label: s }))]}
                          placeholder="Select stage..."
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Opportunity Value</label>
                        <div style={{ position: "relative" }}>
                          <span style={{ position: "absolute", left: 14, top: 12, fontSize: 14, fontWeight: 600, color: T.textMuted }}>$</span>
                          <input type="number" value={quickEditRow.lead_value != null && quickEditRow.lead_value !== "" ? String(quickEditRow.lead_value) : ""} onChange={(e) => patchQuickEdit("lead_value", e.target.value === "" ? null : Number(e.target.value))} style={{ width: "100%", padding: "12px 12px 12px 28px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Owner (Licensed Agent)</label>
                        <StyledSelect
                          value={String(quickEditRow.licensed_agent_account ?? "")}
                          onValueChange={(val) => patchQuickEdit("licensed_agent_account", val)}
                          options={[{ value: "", label: "Unassigned" }, ...licensedOwnerOptions.map(u => ({ value: u.name, label: u.name }))]}
                          placeholder="Select owner..."
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Business Name</label>
                        <input value={String(quickEditRow.business_name ?? "")} onChange={(e) => patchQuickEdit("business_name", e.target.value)} placeholder="Enter Business Name" style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Opportunity Source</label>
                        <input value={String(quickEditRow.lead_source ?? "")} onChange={(e) => patchQuickEdit("lead_source", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Tags</label>
                        <input value={Array.isArray(quickEditRow.tags) ? quickEditRow.tags.join(", ") : String(quickEditRow.tags ?? "")} onChange={(e) => patchQuickEdit("tags", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} placeholder="comma-separated tags" style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Carrier</label>
                        <input value={String(quickEditRow.carrier ?? "")} onChange={(e) => patchQuickEdit("carrier", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>First Draft Date</label>
                        <input type="date" value={String(quickEditRow.draft_date ?? "")} onChange={(e) => patchQuickEdit("draft_date", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Monthly Premium</label>
                        <input type="number" value={quickEditRow.monthly_premium != null && quickEditRow.monthly_premium !== "" ? String(quickEditRow.monthly_premium) : ""} onChange={(e) => patchQuickEdit("monthly_premium", e.target.value === "" ? null : Number(e.target.value))} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600 }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ maxWidth: 720 }}>
                    <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: T.textDark }}>Notes</h3>
                    

                    {leadNotesError && (
                      <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
                        {leadNotesError}
                      </div>
                    )}

                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>Add a note</label>
                      <textarea
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        placeholder="Type a note and click Add note — saves immediately."
                        disabled={!canEditLeadPipeline || addingNote}
                        rows={4}
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: `1.5px solid ${T.border}`,
                          fontSize: 14,
                          fontFamily: T.font,
                          resize: "vertical",
                          outline: "none",
                          marginBottom: 10,
                        }}
                      />
                      <button
                        type="button"
                        disabled={!canEditLeadPipeline || addingNote || !newNoteText.trim()}
                        onClick={() => void addLeadNote()}
                        style={{
                          background: "#233217",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "10px 20px",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: canEditLeadPipeline && !addingNote && newNoteText.trim() ? "pointer" : "not-allowed",
                          opacity: canEditLeadPipeline && !addingNote && newNoteText.trim() ? 1 : 0.55,
                        }}
                      >
                        {addingNote ? "Adding…" : "Add note"}
                      </button>
                    </div>

                    <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>History</h4>
                    {leadNotesLoading ? (
                      <p style={{ color: T.textMuted, fontSize: 14 }}>Loading notes…</p>
                    ) : leadNotes.length === 0 ? (
                      <p style={{ color: T.textMuted, fontSize: 14, padding: "16px", background: T.pageBg, borderRadius: 10, border: `1px dashed ${T.border}` }}>
                        No notes yet. Add one above.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
                        {leadNotes.map((note) => (
                          <div
                            key={note.id}
                            style={{
                              border: `1px solid ${T.border}`,
                              borderRadius: 10,
                              padding: "12px 14px",
                              background: "#fff",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>
                                {formatTs(note.created_at)}
                                <span style={{ marginLeft: 10, color: T.textMid }}>{note.authorName ?? "User"}</span>
                              </div>
                              {canEditLeadPipeline && note.created_by && sessionUserId === note.created_by && (
                                <button
                                  type="button"
                                  title="Delete your note"
                                  onClick={() => void deleteLeadNote(note.id)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#dc2626",
                                    cursor: "pointer",
                                    padding: 4,
                                    lineHeight: 1,
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            <div style={{ fontSize: 14, color: T.textDark, lineHeight: 1.5, wordBreak: "break-word" }}>
                              {note.body.length > 400 ? (
                                <>
                                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{note.body.slice(0, 400)}…</p>
                                  <details style={{ marginTop: 8 }}>
                                    <summary style={{ cursor: "pointer", fontSize: 12, color: "#233217", fontWeight: 700 }}>
                                      Show full note
                                    </summary>
                                    <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", color: T.textDark }}>{note.body}</p>
                                  </details>
                                </>
                              ) : (
                                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{note.body}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
                ) : null}
              </div>
            </div>

            <div style={{ padding: "16px 32px", borderTop: `1.5px solid ${T.borderLight}`, backgroundColor: "#fff", display: "flex", justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" disabled={quickEditSaving || !canEditLeadPipeline} onClick={deleteQuickEdit} style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: "8px", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626", cursor: canEditLeadPipeline ? "pointer" : "not-allowed", opacity: canEditLeadPipeline ? 1 : 0.5 }}>
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                </button>
                <button type="button" onClick={closeQuickEdit} style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: "8px", padding: "0 24px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button
                  type="button"
                  disabled={quickEditSaving || quickEditLoading || !quickEditRow || !canEditLeadPipeline}
                  onClick={saveQuickEdit}
                  style={{
                    background: "#233217",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0 32px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: canEditLeadPipeline && !quickEditSaving && !quickEditLoading && quickEditRow ? "pointer" : "not-allowed",
                    opacity: canEditLeadPipeline && !quickEditSaving && !quickEditLoading && quickEditRow ? 1 : 0.6,
                    boxShadow: "0 4px 12px rgba(35, 50, 23, 0.2)",
                  }}
                >
                  {quickEditSaving ? "Saving…" : "Update"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {hoveredStageTooltip && tooltipPosition && (
        <div style={{
          position: "fixed",
          top: tooltipPosition.y,
          left: tooltipPosition.x,
          backgroundColor: "#fff",
          color: "#233217",
          padding: "12px 16px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          maxWidth: 200,
          width: 200,
          zIndex: 9999,
          boxShadow: "0 8px 24px rgba(35, 50, 23, 0.2)",
          animation: "fadeInUp 0.2s ease-out",
          lineHeight: 1.5,
          border: "1.5px solid #233217",
        }}>
          {stageDescriptions[hoveredStageTooltip]}
        </div>
      )}

      <CreateLeadModal
        open={createLeadModalOpen}
        onClose={() => setCreateLeadModalOpen(false)}
        onSuccess={() => {
          void loadLeadsForPipeline();
        }}
      />
    </div>
  );
}
