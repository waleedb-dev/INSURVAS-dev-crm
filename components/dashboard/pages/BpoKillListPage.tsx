"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Search, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type KillListVariant = "new-sale" | "retention";

type LeadRecord = {
  rowUuid: string;
  displayId: string;
  name: string;
  phone: string;
  stage: string;
  pipelineName: string;
  productType: string;
  source: string;
  owner: string;
  premium: number;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
};

type ColumnConfig = {
  id: string;
  label: string;
  stages: string[];
  color: string;
  bg: string;
};

const NEW_SALE_COLUMNS: ColumnConfig[] = [
  { id: "needs-bpo-callback", label: "Needs BPO Callback", stages: ["Needs BPO Callback"], color: "#6366f1", bg: "#eef2ff" },
  { id: "incomplete-transfer", label: "Incomplete Transfer", stages: ["Incomplete Transfer"], color: "#0f766e", bg: "#ecfeff" },
  { id: "previously-sold-bpo", label: "Previously Sold BPO", stages: ["Previously Sold BPO"], color: "#9333ea", bg: "#f5f3ff" },
  { id: "application-withdrawn", label: "Application Withdrawn", stages: ["Application Withdrawn"], color: "#dc2626", bg: "#fef2f2" },
  { id: "declined-underwriting", label: "Declined Underwriting", stages: ["Declined Underwriting"], color: "#b45309", bg: "#fffbeb" },
  { id: "chargeback-failed-payment", label: "Chargeback Failed Payment", stages: ["Chargeback Failed Payment"], color: "#1d4ed8", bg: "#eff6ff" },
  { id: "chargeback-cancellation", label: "Chargeback Cancellation", stages: ["Chargeback Cancellation"], color: "#be123c", bg: "#fff1f2" },
];

const FDPF_STAGES = [
  "FDPF Pending Reason",
  "FDPF Insufficient Funds",
  "FDPF Incorrect Banking Info",
  "FDPF Unauthorized Draft",
] as const;

const RETENTION_COLUMNS: ColumnConfig[] = [
  { id: "pending-manual-action", label: "Pending Manual Action", stages: ["Pending Manual Action"], color: "#6366f1", bg: "#eef2ff" },
  { id: "fdpf", label: "All FDPFs", stages: [...FDPF_STAGES], color: "#b45309", bg: "#fffbeb" },
  { id: "pending-lapse", label: "Pending Lapse", stages: ["Pending Lapse"], color: "#be123c", bg: "#fff1f2" },
];

const PIPELINE_NAMES = ["Transfer Portal", "Chargeback Pipeline"] as const;

function formatPhoneDisplay(phone: string | null | undefined) {
  const raw = String(phone ?? "").replace(/\D/g, "");
  if (raw.length === 10) {
    return `+1 (${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
  }
  return phone || "";
}

function formatDateDisplay(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((tag) => String(tag).trim()).filter(Boolean);
      }
    } catch {
      return value.split(",").map((tag) => tag.trim()).filter(Boolean);
    }
  }
  return [];
}

function getColumns(variant: KillListVariant) {
  return variant === "new-sale" ? NEW_SALE_COLUMNS : RETENTION_COLUMNS;
}

function getColumnForLead(lead: LeadRecord, variant: KillListVariant): string | null {
  if (variant === "new-sale") {
    if (lead.stage === "Previously Sold BPO" && lead.tags.length === 0) {
      return null;
    }
    return NEW_SALE_COLUMNS.find((column) => column.stages.includes(lead.stage))?.id ?? null;
  }

  if (lead.stage === "Pending Manual Action") return "pending-manual-action";
  if (lead.stage === "Pending Lapse") return "pending-lapse";
  if (FDPF_STAGES.includes(lead.stage as (typeof FDPF_STAGES)[number])) return "fdpf";
  return null;
}

function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next || "All")}>
      <SelectTrigger
        style={{
          width: "100%",
          height: 38,
          borderRadius: 10,
          border: `1px solid ${T.border}`,
          backgroundColor: T.cardBg,
          color: value !== "All" ? T.textDark : T.textMuted,
          fontSize: 13,
          fontWeight: 500,
          paddingLeft: 14,
          paddingRight: 12,
        }}
      >
        <SelectValue placeholder={placeholder}>
          {value !== "All" ? options.find((option) => option.value === value)?.label ?? value : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        style={{
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          backgroundColor: T.cardBg,
          padding: 6,
        }}
      >
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function BpoKillListPage({ variant }: { variant: KillListVariant }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { currentRole } = useDashboardContext();
  const router = useRouter();
  const params = useParams<{ role?: string }>();
  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role;
  const columns = useMemo(() => getColumns(variant), [variant]);
  const actualStages = useMemo(() => Array.from(new Set(columns.flatMap((column) => column.stages))), [columns]);

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);
  const [filterStage, setFilterStage] = useState("All");
  const [filterPipeline, setFilterPipeline] = useState("All");
  const [filterOwner, setFilterOwner] = useState("All");
  const [filterSource, setFilterSource] = useState("All");
  const [filterTag, setFilterTag] = useState("All");
  const [kanbanPage, setKanbanPage] = useState<Record<string, number>>({});
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);

  const canViewAllCenters = currentRole === "system_admin";
  const KANBAN_ITEMS_PER_PAGE = 20;
  const sourcePage = variant === "new-sale" ? "bpo-kill-list-new-sale" : "bpo-kill-list-retention";

  const loadLeads = useCallback(async () => {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const userId = session?.user?.id ?? null;
    if (!userId) {
      setLeads([]);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("call_center_id")
      .eq("id", userId)
      .maybeSingle();

    const userCallCenterId = profile?.call_center_id ?? null;

    const { data: pipelineRows, error: pipelineError } = await supabase
      .from("pipelines")
      .select("id, name")
      .in("name", [...PIPELINE_NAMES]);

    if (pipelineError || !pipelineRows?.length) {
      setLeads([]);
      setLoading(false);
      return;
    }

    const pipelineIdMap = new Map<number, string>(
      pipelineRows
        .map((row) => {
          const id = Number(row.id);
          if (!Number.isFinite(id) || !row.name) return null;
          return [id, String(row.name)] as const;
        })
        .filter((entry): entry is readonly [number, string] => entry !== null),
    );

    const pipelineIds = Array.from(pipelineIdMap.keys());
    if (!pipelineIds.length) {
      setLeads([]);
      setLoading(false);
      return;
    }

    const fetchAllRows = async () => {
      const PAGE_SIZE = 1000;
      const allRows: Record<string, unknown>[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        let query = supabase
          .from("leads")
          .select("id, lead_unique_id, first_name, last_name, phone, lead_value, monthly_premium, product_type, lead_source, stage, pipeline_id, licensed_agent_account, tags, created_at, updated_at, call_center_id, is_draft")
          .in("pipeline_id", pipelineIds)
          .in("stage", actualStages)
          .eq("is_draft", false)
          .order("created_at", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (!canViewAllCenters) {
          if (userCallCenterId) {
            query = query.eq("call_center_id", userCallCenterId);
          } else {
            setLeads([]);
            setLoading(false);
            return null;
          }
        }

        const { data, error } = await query;
        if (error) return null;
        const batch = (data ?? []) as Record<string, unknown>[];
        allRows.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }
      return allRows;
    };

    const rows = await fetchAllRows();
    if (!rows) {
      setLeads([]);
      setLoading(false);
      return;
    }

    const mapped = rows
      .map((row) => {
        const rowUuid = String(row.id ?? "");
        const stage = String(row.stage ?? "").trim();
        const pipelineId = Number(row.pipeline_id ?? 0);
        const pipelineName = pipelineIdMap.get(pipelineId) ?? "Unknown Pipeline";
        const tags = parseTags(row.tags);
        const fullName = `${String(row.first_name ?? "").trim()} ${String(row.last_name ?? "").trim()}`.trim() || "Unnamed Lead";
        const lead: LeadRecord = {
          rowUuid,
          displayId: row.lead_unique_id ? String(row.lead_unique_id) : rowUuid,
          name: fullName,
          phone: String(row.phone ?? ""),
          stage,
          pipelineName,
          productType: String(row.product_type ?? "—"),
          source: String(row.lead_source ?? "—"),
          owner: String(row.licensed_agent_account ?? "Unassigned"),
          premium: Number(row.lead_value ?? row.monthly_premium ?? 0) || 0,
          tags,
          createdAt: row.created_at ? String(row.created_at) : undefined,
          updatedAt: row.updated_at ? String(row.updated_at) : undefined,
        } satisfies LeadRecord;
        return getColumnForLead(lead, variant) ? lead : null;
      })
      .filter((lead): lead is LeadRecord => lead !== null);

    setLeads(mapped);
    setLoading(false);
  }, [actualStages, canViewAllCenters, supabase, variant]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    setKanbanPage({});
  }, [variant, search, filterStage, filterPipeline, filterOwner, filterSource, filterTag]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    const numericQuery = query.replace(/\D/g, "");

    return leads.filter((lead) => {
      const columnId = getColumnForLead(lead, variant);
      if (!columnId) return false;

      const matchesSearch =
        !query ||
        lead.name.toLowerCase().includes(query) ||
        lead.displayId.toLowerCase().includes(query) ||
        lead.source.toLowerCase().includes(query) ||
        lead.owner.toLowerCase().includes(query) ||
        lead.stage.toLowerCase().includes(query) ||
        lead.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        (numericQuery && lead.phone.replace(/\D/g, "").includes(numericQuery));

      const matchesStage = filterStage === "All" || lead.stage === filterStage;
      const matchesPipeline = filterPipeline === "All" || lead.pipelineName === filterPipeline;
      const matchesOwner = filterOwner === "All" || lead.owner === filterOwner;
      const matchesSource = filterSource === "All" || lead.source === filterSource;
      const matchesTag = filterTag === "All" || lead.tags.includes(filterTag);

      return matchesSearch && matchesStage && matchesPipeline && matchesOwner && matchesSource && matchesTag;
    });
  }, [filterOwner, filterPipeline, filterSource, filterStage, filterTag, leads, search, variant]);

  const totalTagged = filteredLeads.filter((lead) => lead.tags.length > 0).length;
  const uniqueOwners = new Set(filteredLeads.map((lead) => lead.owner).filter(Boolean)).size;
  const totalPremium = filteredLeads.reduce((sum, lead) => sum + lead.premium, 0);
  const averagePremium = filteredLeads.length ? totalPremium / filteredLeads.length : 0;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterStage !== "All") count++;
    if (filterPipeline !== "All") count++;
    if (filterOwner !== "All") count++;
    if (filterSource !== "All") count++;
    if (filterTag !== "All") count++;
    return count;
  }, [filterOwner, filterPipeline, filterSource, filterStage, filterTag]);

  const clearAllFilters = () => {
    setSearch("");
    setFilterStage("All");
    setFilterPipeline("All");
    setFilterOwner("All");
    setFilterSource("All");
    setFilterTag("All");
  };

  const toggleCollapse = (columnId: string) => {
    setCollapsedColumns((prev) => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  const pipelineOptions = [{ value: "All", label: "All Pipelines" }, ...Array.from(new Set(leads.map((lead) => lead.pipelineName))).sort().map((name) => ({ value: name, label: name }))];
  const stageOptions = useMemo(() => {
    const visibleLeads = filterPipeline === "All" ? leads : leads.filter((lead) => lead.pipelineName === filterPipeline);
    const values = Array.from(new Set(visibleLeads.map((lead) => lead.stage))).sort();
    return [{ value: "All", label: "All Stages" }, ...values.map((stage) => ({ value: stage, label: stage }))];
  }, [filterPipeline, leads]);
  const ownerOptions = [{ value: "All", label: "All Owners" }, ...Array.from(new Set(leads.map((lead) => lead.owner))).sort().map((value) => ({ value, label: value }))];
  const sourceOptions = [{ value: "All", label: "All Sources" }, ...Array.from(new Set(leads.map((lead) => lead.source))).sort().map((value) => ({ value, label: value }))];
  const tagOptions = [{ value: "All", label: "All Tags" }, ...Array.from(new Set(leads.flatMap((lead) => lead.tags))).sort().map((value) => ({ value, label: value }))];

  useEffect(() => {
    if (filterStage === "All") return;
    if (filterPipeline === "All") return;
    const stillValid = leads.some((lead) => lead.pipelineName === filterPipeline && lead.stage === filterStage);
    if (!stillValid) setFilterStage("All");
  }, [filterPipeline, filterStage, leads]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0, paddingBottom: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
        {[
          {
            label: "Leads in Kill List",
            value: filteredLeads.length.toLocaleString(),
            color: "#233217",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            ),
          },
          {
            label: "Tagged Leads",
            value: totalTagged.toLocaleString(),
            color: "#233217",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
            ),
          },
          {
            label: "Visible Premium",
            value: `$${totalPremium.toLocaleString()}`,
            color: "#233217",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            ),
          },
          {
            label: "Active Owners",
            value: uniqueOwners.toString(),
            color: "#233217",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            ),
            subtitle: filteredLeads.length ? `Avg $${Math.round(averagePremium).toLocaleString()}` : "Avg $0",
          },
        ].map(({ label, value, color, icon, subtitle }, i) => (
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
              <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.05, wordBreak: "break-all" }}>
                {value}
              </div>
              {subtitle ? (
                <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>{subtitle}</span>
              ) : null}
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
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 16 }}>
        <div
          style={{
            width: "100%",
            background: T.cardBg,
            border: `1px solid ${T.border}`,
            borderBottom: filterPanelExpanded || activeFilterCount > 0 ? "none" : `1px solid ${T.border}`,
            borderRadius: filterPanelExpanded || activeFilterCount > 0 ? "16px 16px 0 0" : 16,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={16} style={{ position: "absolute", left: 12, color: T.textMuted }} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search leads, phone, tags..."
                style={{
                  height: 38,
                  minWidth: 280,
                  paddingLeft: 38,
                  paddingRight: 14,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  fontSize: 14,
                  color: T.textDark,
                  background: T.pageBg,
                  outline: "none",
                  fontFamily: T.font,
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setFilterPanelExpanded((current) => !current)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 38,
                padding: "0 16px",
                borderRadius: 10,
                border: filterPanelExpanded ? "1.5px solid #233217" : `1px solid ${T.border}`,
                background: filterPanelExpanded ? "#DCEBDC" : T.pageBg,
                color: filterPanelExpanded ? "#233217" : T.textDark,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Filter size={16} />
              Filters
              {activeFilterCount > 0 ? (
                <span
                  style={{
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
                  }}
                >
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {(filterPanelExpanded || activeFilterCount > 0) && (
          <div
            style={{
              width: "100%",
              background: T.cardBg,
              border: `1px solid ${T.border}`,
              borderRadius: "0 0 16px 16px",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase" }}>Pipeline</div>
                <StyledSelect value={filterPipeline} onValueChange={setFilterPipeline} options={pipelineOptions} placeholder="All Pipelines" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase" }}>Stage</div>
                <StyledSelect value={filterStage} onValueChange={setFilterStage} options={stageOptions} placeholder="All Stages" />
              </div>
              <div />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase" }}>Owner</div>
                <StyledSelect value={filterOwner} onValueChange={setFilterOwner} options={ownerOptions} placeholder="All Owners" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase" }}>Source</div>
                <StyledSelect value={filterSource} onValueChange={setFilterSource} options={sourceOptions} placeholder="All Sources" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase" }}>Tag</div>
                <StyledSelect value={filterTag} onValueChange={setFilterTag} options={tagOptions} placeholder="All Tags" />
              </div>
            </div>

            {activeFilterCount > 0 ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#233217",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : null}
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
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 600,
            color: T.textMuted,
          }}
        >
          Loading kill list leads...
        </div>
      ) : filteredLeads.length === 0 ? (
        <EmptyState title="No kill list leads found" description="Try changing your search or filters." />
      ) : (
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <style>{`
            .kill-list-board {
              display: flex;
              gap: 16px;
              overflow-x: auto;
              overflow-y: hidden;
              padding: 8px 4px;
              align-items: stretch;
              min-height: 0;
              flex: 1;
            }
            .kill-list-board::-webkit-scrollbar { height: 6px; }
            .kill-list-board::-webkit-scrollbar-thumb { background-color: #c8d4bb; border-radius: 10px; }
            .kill-list-column {
              min-width: 320px;
              width: 320px;
              flex-shrink: 0;
              display: flex;
              flex-direction: column;
              background-color: #fff;
              border: 1px solid ${T.border};
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
            }
            .kill-list-column-body {
              overflow-y: auto;
              max-height: calc(100vh - 360px);
              min-height: 420px;
              padding: 12px 10px;
              display: flex;
              flex-direction: column;
              gap: 12px;
              background: #fafcf8;
            }
            .kill-list-column-body::-webkit-scrollbar { width: 6px; }
            .kill-list-column-body::-webkit-scrollbar-thumb { background-color: #b8c9a8; border-radius: 6px; }
          `}</style>

          <div className="kill-list-board">
            {columns.map((column) => {
              const columnLeads = filteredLeads.filter((lead) => getColumnForLead(lead, variant) === column.id);
              const isCollapsed = collapsedColumns[column.id];
              const currentPage = kanbanPage[column.id] || 1;
              const totalPages = Math.max(1, Math.ceil(columnLeads.length / KANBAN_ITEMS_PER_PAGE));
              const paginatedLeads = columnLeads.slice((currentPage - 1) * KANBAN_ITEMS_PER_PAGE, currentPage * KANBAN_ITEMS_PER_PAGE);

              return (
                <div
                  key={column.id}
                  className="kill-list-column"
                  style={{
                    minWidth: isCollapsed ? 50 : 320,
                    width: isCollapsed ? 50 : 320,
                    transition: "width 0.2s ease",
                  }}
                >
                  {isCollapsed ? (
                    <div
                      style={{
                        backgroundColor: "#fff",
                        border: `1px solid ${T.border}`,
                        borderRadius: 8,
                        padding: "16px 0",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                      onClick={() => toggleCollapse(column.id)}
                    >
                      <div
                        style={{
                          backgroundColor: column.color,
                          color: "#fff",
                          borderRadius: 10,
                          padding: "2px 7px",
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {columnLeads.length}
                      </div>
                      <div
                        style={{
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                          fontSize: 13,
                          fontWeight: 800,
                          color: column.color,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          whiteSpace: "nowrap",
                          marginTop: 16,
                        }}
                      >
                        {column.label}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          background: `linear-gradient(180deg, ${column.bg} 0%, #ffffff 88%)`,
                          padding: "12px 16px",
                          borderTop: `4px solid ${column.color}`,
                          borderBottom: `1px solid ${T.border}`,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: T.textDark }}>{column.label}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span
                              style={{
                                borderRadius: 999,
                                background: column.color,
                                color: "#fff",
                                padding: "2px 8px",
                                fontSize: 11,
                                fontWeight: 800,
                              }}
                            >
                              {columnLeads.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleCollapse(column.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: T.textMuted }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                            </button>
                          </div>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: T.textMuted }}>
                          ${columnLeads.reduce((sum, lead) => sum + lead.premium, 0).toLocaleString()}
                        </div>
                      </div>

                      <div className="kill-list-column-body">

                        {paginatedLeads.map((lead) => (
                          <div
                            key={lead.rowUuid}
                            onClick={() =>
                              router.push(
                                variant === "retention"
                                  ? `/dashboard/${routeRole || "agent"}/bpo-kill-list/retention/${lead.rowUuid}?page=${sourcePage}`
                                  : `/dashboard/${routeRole || "agent"}/bpo-kill-list/${lead.rowUuid}?page=${sourcePage}`,
                              )
                            }
                            style={{
                              backgroundColor: "#fff",
                              borderRadius: 10,
                              padding: "16px",
                              boxShadow: "0 2px 8px rgba(35, 50, 23, 0.08)",
                              borderWidth: 1,
                              borderStyle: "solid",
                              borderColor: T.border,
                              borderLeftWidth: 4,
                              borderLeftStyle: "solid",
                              borderLeftColor: column.color,
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              position: "relative",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "#233217";
                              e.currentTarget.style.borderLeftColor = column.color;
                              e.currentTarget.style.boxShadow = "0 6px 20px rgba(35, 50, 23, 0.15)";
                              e.currentTarget.style.transform = "translateY(-2px)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = T.border;
                              e.currentTarget.style.borderLeftColor = column.color;
                              e.currentTarget.style.boxShadow = "0 2px 8px rgba(35, 50, 23, 0.08)";
                              e.currentTarget.style.transform = "translateY(0)";
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "flex-start" }}>
                              <div style={{ flex: 1, marginRight: 8 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.textDark, lineHeight: 1.4 }}>
                                  {lead.name}
                                  {lead.phone ? ` — ${formatPhoneDisplay(lead.phone)}` : ""}
                                </p>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: "#233217", whiteSpace: "nowrap" }}>
                                  ${lead.premium.toLocaleString()}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                              <div style={{ display: "flex", fontSize: 12, gap: 8 }}>
                                <span style={{ color: T.textMuted, fontWeight: 500, width: 110 }}>Assigned To:</span>
                                <span style={{ color: T.textDark, fontWeight: 600 }}>{lead.owner}</span>
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 12, borderTop: `1px solid ${T.borderLight}`, flexWrap: "wrap" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#638b4b", opacity: 0.8 }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                  <polyline points="14 2 14 8 20 8"/>
                                </svg>
                                <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>{formatDateDisplay(lead.createdAt)}</span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(
                                    variant === "retention"
                                      ? `/dashboard/${routeRole || "agent"}/bpo-kill-list/retention/${lead.rowUuid}?page=${sourcePage}`
                                      : `/dashboard/${routeRole || "agent"}/bpo-kill-list/${lead.rowUuid}?page=${sourcePage}`,
                                  );
                                }}
                                style={{
                                  marginLeft: "auto",
                                  height: 28,
                                  padding: "0 10px",
                                  borderRadius: 999,
                                  border: "1px solid #233217",
                                  background: "#233217",
                                  color: "#fff",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  boxShadow: "0 1px 0 rgba(0,0,0,0.06)",
                                  transition: "transform 0.12s ease, box-shadow 0.12s ease, background-color 0.12s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#1c2812";
                                  e.currentTarget.style.boxShadow = "0 6px 14px rgba(35, 50, 23, 0.18)";
                                  e.currentTarget.style.transform = "translateY(-1px)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "#233217";
                                  e.currentTarget.style.boxShadow = "0 1px 0 rgba(0,0,0,0.06)";
                                  e.currentTarget.style.transform = "translateY(0)";
                                }}
                              >
                                Reconnect
                              </button>
                              {lead.tags.length > 0 ? (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {lead.tags.map((tag) => (
                                    <span
                                      key={`${lead.rowUuid}-${tag}`}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        padding: "4px 8px",
                                        borderRadius: 999,
                                        background: "#DCEBDC",
                                        border: "1px solid #b8c9a8",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "#233217",
                                      }}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}

                        {columnLeads.length === 0 ? (
                          <div
                            style={{
                              border: `1px dashed ${T.border}`,
                              borderRadius: 10,
                              padding: "20px 14px",
                              textAlign: "center",
                              fontSize: 13,
                              fontWeight: 600,
                              color: T.textMuted,
                              background: "#fff",
                            }}
                          >
                            No leads in this column.
                          </div>
                        ) : null}

                        {totalPages > 1 ? (
                          <div
                            style={{
                              position: "sticky",
                              bottom: 0,
                              zIndex: 5,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "10px 12px",
                              background: "#fafcf8",
                              borderTop: `1px solid ${T.border}`,
                              marginTop: "auto",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setKanbanPage((prev) => ({
                                  ...prev,
                                  [column.id]: Math.max(1, (prev[column.id] || 1) - 1),
                                }))
                              }
                              disabled={currentPage === 1}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                border: `1px solid ${T.border}`,
                                background: "#fff",
                                color: currentPage === 1 ? T.textMuted : "#233217",
                                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                              }}
                            >
                              {"<"}
                            </button>
                            <span style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>
                              {currentPage} / {totalPages}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setKanbanPage((prev) => ({
                                  ...prev,
                                  [column.id]: Math.min(totalPages, (prev[column.id] || 1) + 1),
                                }))
                              }
                              disabled={currentPage === totalPages}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                border: `1px solid ${T.border}`,
                                background: "#fff",
                                color: currentPage === totalPages ? T.textMuted : "#233217",
                                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                              }}
                            >
                              {">"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
