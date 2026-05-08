"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import {
  Table as ShadcnTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Loader2, Plus, Search, ShieldAlert } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import { PipelineStatGrid, PipelineToolbar, type PipelineStat } from "@/components/dashboard/pages/pipeline/PipelineChrome";
import {
  PipelineKanban,
  type PipelineKanbanColumn,
  type PipelineKanbanDragDrop,
} from "@/components/dashboard/pages/pipeline/PipelineKanban";
import { useParams, useRouter } from "next/navigation";

const BRAND_GREEN = "#233217";

function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
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
          minWidth: 140,
          height: 38,
          flexShrink: 0,
          borderRadius: 10,
          border: `1px solid ${T.border}`,
          backgroundColor: T.cardBg,
          color: value && value !== "all" ? T.textDark : T.textMuted,
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
          {value && value !== "all" ? options.find((o) => o.value === value)?.label || value : placeholder}
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

type CenterLeadStage =
  | "pre_onboarding"
  | "ready_for_onboarding_meeting"
  | "onboarding_completed"
  | "actively_selling"
  | "needs_attention"
  | "on_pause"
  | "dqed"
  | "offboarded";

const STAGE_OPTIONS: { key: CenterLeadStage; label: string }[] = [
  { key: "pre_onboarding", label: "Pre-Onboarding" },
  { key: "ready_for_onboarding_meeting", label: "Ready for Onboarding Meeting" },
  { key: "onboarding_completed", label: "Onboarding Completed" },
  { key: "actively_selling", label: "Actively Selling" },
  { key: "needs_attention", label: "Needs attention" },
  { key: "on_pause", label: "On Pause" },
  { key: "dqed", label: "DQED" },
  { key: "offboarded", label: "Offboarded" },
];

const STAGE_LABEL: Record<string, string> = Object.fromEntries(STAGE_OPTIONS.map((o) => [o.key, o.label]));

/** Column header info tooltips (aligned with Lead Pipeline Kanban). */
const STAGE_INFO: Record<CenterLeadStage, string> = {
  pre_onboarding:
    "Landing stage for new centre leads. Qualify the opportunity, complete intake, and gather what you need before scheduling a formal onboarding conversation.",
  ready_for_onboarding_meeting:
    "The centre is queued for their Insurvas onboarding meeting. Use once prerequisites are in place and the session is booked or imminent.",
  onboarding_completed:
    "Onboarding and provisioning are finished and the centre should be operating in the CRM. Day-to-day seller activity continues from here unless something changes.",
  actively_selling:
    "Steady-state centre with no open escalations—normal production and relationship management.",
  needs_attention:
    "Flagged for visibility: blockers, stalled progress, SLA risk, or anything that needs explicit follow-up from the team.",
  on_pause:
    "Intentionally on hold. Leave the lead here until criteria to resume are agreed; avoid routine progression while paused.",
  dqed:
    "Disqualified centre: not proceeding under current partnership criteria. Keeps history without cluttering active stages.",
  offboarded:
    "Formal end of the relationship. Archived for reference; no ongoing onboarding or operational work expected.",
};

const STAGE_KANBAN_COLORS = ["#638b4b", "#2563eb", "#7c3aed", "#0f766e", "#d97706", "#64748b", "#991b1b", "#374151"];
const STAGE_KANBAN_BACKGROUNDS = ["#f2f8ee", "#eef2ff", "#f5f3ff", "#f0fdfa", "#fffbeb", "#f8fafc", "#fef2f2", "#f9fafb"];

function formatCallResultLabel(key: string | null): string {
  if (!key) return "";
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface CenterLeadRow {
  id: string;
  centre_display_name: string;
  country: string | null;
  stage: CenterLeadStage;
  linked_crm_centre_label: string | null;
  lead_vendor_label: string | null;
  opportunity_source: string | null;
  expected_start_date: string | null;
  committed_daily_sales: number | null;
  committed_daily_transfers: number | null;
  closer_count: number | null;
  buyer_details: string | null;
  daily_sales_generation_notes: string | null;
  trending_metrics_notes: string | null;
  owner_manager_contact_notes: string | null;
  last_disposition_text: string | null;
  last_call_result: string | null;
  last_call_result_at: string | null;
  form_submitted_at: string | null;
  created_at: string;
  tags?: string[] | null;
}

export default function BpoOnboardingPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const params = useParams<{ role?: string }>();
  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role;
  const { currentRole, searchQuery, setSearchQuery, setPageHeaderActions } = useDashboardContext();

  const [rows, setRows] = useState<CenterLeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);
  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);
  const [intakeFilter, setIntakeFilter] = useState<"all" | "submitted" | "pending">("all");
  const [sourceFilter, setSourceFilter] = useState("");

  const [, setInviteToken] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<CenterLeadStage | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bpo_center_leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setToast({ message: error.message, type: "error" });
      setRows([]);
    } else {
      setRows((data ?? []) as unknown as CenterLeadRow[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadList();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadList]);

  const goToCentreLead = useCallback(
    (id: string) => {
      const role = routeRole || "agent";
      router.push(`/dashboard/${role}/bpo-centre-leads/${id}`);
    },
    [routeRole, router],
  );

  const handleKanbanDrop = useCallback(
    async (targetColumnId: string | number) => {
      const targetStage = String(targetColumnId) as CenterLeadStage;
      const droppedId = dragLeadId;
      if (!droppedId) {
        setDragOverStage(null);
        return;
      }
      const prevRow = rows.find((r) => r.id === droppedId);
      if (!prevRow || prevRow.stage === targetStage) {
        setDragOverStage(null);
        return;
      }
      setRows((p) => p.map((r) => (r.id === droppedId ? { ...r, stage: targetStage } : r)));
      const { error } = await supabase
        .from("bpo_center_leads")
        .update({ stage: targetStage, updated_at: new Date().toISOString() })
        .eq("id", droppedId);
      if (error && prevRow) {
        setRows((p) => p.map((r) => (r.id === droppedId ? prevRow : r)));
        setToast({ message: error.message, type: "error" });
      }
    },
    [dragLeadId, rows, supabase],
  );

  const kanbanDragDrop = useMemo<PipelineKanbanDragDrop>(
    () => ({
      dragOverColumnId: dragOverStage,
      onColumnDragOver: (id) => setDragOverStage(String(id) as CenterLeadStage),
      onColumnDragLeave: () => setDragOverStage(null),
      onColumnDrop: (id) => void handleKanbanDrop(id),
    }),
    [dragOverStage, handleKanbanDrop],
  );

  const handleCreateInvite = useCallback(async () => {
    setSaving(true);
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id ?? null;
    const { data: lead, error: e1 } = await supabase
      .from("bpo_center_leads")
      .insert({
        centre_display_name: "New centre lead",
        stage: "pre_onboarding",
        created_by: uid,
      })
      .select("id")
      .single();
    if (e1 || !lead?.id) {
      setToast({ message: e1?.message ?? "Failed to create centre lead", type: "error" });
      setSaving(false);
      return;
    }
    const { data: inv, error: e2 } = await supabase
      .from("bpo_center_lead_invites")
      .insert({ center_lead_id: lead.id, created_by: uid })
      .select("token")
      .single();
    setSaving(false);
    if (e2 || !inv?.token) {
      setToast({ message: e2?.message ?? "Failed to create invite", type: "error" });
      return;
    }
    setToast({ message: "Centre lead and intake link created.", type: "success" });
    await loadList();
    goToCentreLead(lead.id);
    setInviteToken(String(inv.token));
  }, [goToCentreLead, loadList, supabase]);

  useEffect(() => {
    setPageHeaderActions(null);
    return () => setPageHeaderActions(null);
  }, [setPageHeaderActions]);
  const sourceOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => row.opportunity_source?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const intakeOptions = useMemo(
    () => [
      { value: "all", label: "All intake" },
      { value: "submitted", label: "Submitted" },
      { value: "pending", label: "Pending" },
    ],
    [],
  );
  const sourceFilterOptions = useMemo(
    () => [{ value: "all", label: "All sources" }, ...sourceOptions.map((s) => ({ value: s, label: s }))],
    [sourceOptions],
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (intakeFilter === "submitted" && !row.form_submitted_at) return false;
        if (intakeFilter === "pending" && row.form_submitted_at) return false;
        if (sourceFilter && row.opportunity_source !== sourceFilter) return false;
        if (normalizedSearchQuery) {
          const haystack = [
            row.centre_display_name,
            row.country,
            row.linked_crm_centre_label,
            row.lead_vendor_label,
            row.opportunity_source,
            row.buyer_details,
            row.owner_manager_contact_notes,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(normalizedSearchQuery)) return false;
        }
        return true;
      }),
    [intakeFilter, normalizedSearchQuery, rows, sourceFilter],
  );
  const activeFilterCount =
    (intakeFilter !== "all" ? 1 : 0) +
    (sourceFilter ? 1 : 0) +
    (normalizedSearchQuery ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;
  const resetFilters = () => {
    setIntakeFilter("all");
    setSourceFilter("");
  };
  const clearAllFilters = () => {
    resetFilters();
    setSearchQuery("");
  };
  const stageTotals = useMemo(() => {
    const totals = new Map<CenterLeadStage, number>();
    for (const stage of STAGE_OPTIONS) totals.set(stage.key, 0);
    for (const row of filteredRows) totals.set(row.stage, (totals.get(row.stage) ?? 0) + 1);
    return totals;
  }, [filteredRows]);
  const intakeSubmittedCount = filteredRows.filter((row) => Boolean(row.form_submitted_at)).length;
  const intakePendingCount = filteredRows.filter((row) => !row.form_submitted_at).length;
  const activeSources = new Set(filteredRows.map((row) => row.opportunity_source).filter(Boolean)).size;
  const pipelineStats: PipelineStat[] = [
    {
      label: "Total Opportunities",
      value: filteredRows.length.toString(),
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
    },
    {
      label: "Intake submitted",
      value: intakeSubmittedCount.toString(),
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    },
    {
      label: "Intake pending",
      value: intakePendingCount.toString(),
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    },
    {
      label: "Active Sources",
      value: activeSources.toString(),
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    },
  ];
  const kanbanColumns = useMemo<PipelineKanbanColumn[]>(
    () =>
      STAGE_OPTIONS.map((stage, index) => {
        const stageRows = filteredRows.filter((row) => row.stage === stage.key);
        const color = STAGE_KANBAN_COLORS[index % STAGE_KANBAN_COLORS.length] ?? BRAND_GREEN;
        const bg = STAGE_KANBAN_BACKGROUNDS[index % STAGE_KANBAN_BACKGROUNDS.length] ?? "#f2f8ee";

        return {
          id: stage.key,
          title: stage.label,
          info: STAGE_INFO[stage.key],
          count: stageTotals.get(stage.key) ?? 0,
          color,
          bg,
          cards: stageRows.map((row) => (
        <div
          key={row.id}
          role="button"
          tabIndex={0}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", row.id);
            setDragLeadId(row.id);
          }}
          onDragEnd={() => {
            setDragLeadId(null);
            setDragOverStage(null);
          }}
          onClick={() => goToCentreLead(row.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              goToCentreLead(row.id);
            }
          }}
          style={{
            backgroundColor: "#fff",
            borderRadius: 10,
            padding: 16,
            textAlign: "left",
            boxShadow: "0 2px 8px rgba(35, 50, 23, 0.08)",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: T.border,
            borderLeftWidth: 4,
            borderLeftStyle: "solid",
            borderLeftColor: color,
            cursor: "grab",
            transition: "all 0.2s ease",
            position: "relative",
            opacity: dragLeadId === row.id ? 0.55 : 1,
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.borderColor = BRAND_GREEN;
            event.currentTarget.style.borderLeftColor = color;
            event.currentTarget.style.boxShadow = "0 6px 20px rgba(35, 50, 23, 0.15)";
            event.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.borderColor = T.border;
            event.currentTarget.style.borderLeftColor = color;
            event.currentTarget.style.boxShadow = "0 2px 8px rgba(35, 50, 23, 0.08)";
            event.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: T.textDark, lineHeight: 1.4 }}>
            {row.centre_display_name || "Untitled centre"}
          </div>
          {(row.tags && row.tags.length > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {row.tags.slice(0, 6).map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: "#eef2ff",
                    border: "1px solid #c7d2fe",
                    color: "#3730a3",
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                  }}
                >
                  {tag}
                </span>
              ))}
              {row.tags.length > 6 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: T.textMuted, alignSelf: "center" }}>
                  +{row.tags.length - 6}
                </span>
              )}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", fontSize: 12, gap: 8 }}>
              <span style={{ color: T.textMuted, fontWeight: 500, width: 110 }}>Source:</span>
              <span style={{ color: T.textDark, fontWeight: 600 }}>{row.opportunity_source || "Not set"}</span>
            </div>
            <div style={{ display: "flex", fontSize: 12, gap: 8 }}>
              <span style={{ color: T.textMuted, fontWeight: 500, width: 110 }}>Country:</span>
              <span style={{ color: T.textDark, fontWeight: 600 }}>{row.country?.trim() || "Not set"}</span>
            </div>
          </div>
          {/* Call result tag */}
          {row.last_call_result && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                background: row.last_call_result === "call_completed" ? "#dcfce7" : "#fef3c7",
                color: row.last_call_result === "call_completed" ? "#166534" : "#92400e",
                border: `1px solid ${row.last_call_result === "call_completed" ? "#86efac" : "#fcd34d"}`,
              }}
            >
              {formatCallResultLabel(row.last_call_result)}
              {row.last_call_result_at && (
                <span style={{ fontWeight: 600 }}>
                  &mdash; {new Date(row.last_call_result_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </div>
          )}
        </div>
      )),
    };
      }),
    [dragLeadId, filteredRows, goToCentreLead, stageTotals],
  );

  if (currentRole !== "system_admin") {
    return (
      <div className="mx-auto w-full max-w-[1200px]" style={{ fontFamily: T.font }}>
        <Card className="rounded-2xl border p-8" style={{ borderColor: T.border, background: T.cardBg }}>
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5" style={{ color: "#991b1b" }} />
            <div>
              <h2 className="m-0 text-lg font-extrabold" style={{ color: T.textDark }}>Restricted workspace</h2>
              <p className="m-0 mt-2 text-sm font-medium" style={{ color: T.textMuted }}>
                BPO Onboarding is currently available to System Admin users only.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] transition-all duration-150" style={{ fontFamily: T.font }}>
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[5100] rounded-xl px-4 py-3 text-sm font-semibold shadow-lg"
          style={{ background: toast.type === "success" ? "#166534" : "#991b1b", color: "#fff", fontFamily: T.font }}
        >
          {toast.message}
          <button type="button" className="ml-3 underline" onClick={() => setToast(null)}>
            Dismiss
          </button>
        </div>
      )}

      <PipelineStatGrid
        loading={loading}
        stats={pipelineStats}
        hoveredIndex={hoveredStatIdx}
        onHoverIndexChange={setHoveredStatIdx}
      />

      <PipelineToolbar
        left={
          <>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={16} style={{ position: "absolute", left: 12, pointerEvents: "none", zIndex: 1, color: T.textMuted }} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search..."
                style={{
                  height: 38,
                  width: 240,
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
                onFocus={(event) => {
                  event.currentTarget.style.borderColor = BRAND_GREEN;
                  event.currentTarget.style.boxShadow = "0 0 0 3px rgba(35, 50, 23, 0.1)";
                }}
                onBlur={(event) => {
                  event.currentTarget.style.borderColor = T.border;
                  event.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          </>
        }
        filterExpanded={filterPanelExpanded}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        viewMode={viewMode}
        onToggleFilters={() => setFilterPanelExpanded((value) => !value)}
        onViewModeChange={setViewMode}
        actions={
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleCreateInvite()}
            style={{
              height: 38,
              padding: "0 18px",
              borderRadius: 10,
              border: "none",
              background: BRAND_GREEN,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: T.font,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.65 : 1,
              boxShadow: "0 4px 12px rgba(35, 50, 23, 0.2)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s ease-in-out",
            }}
            onMouseEnter={(event) => {
              if (saving) return;
              event.currentTarget.style.backgroundColor = "#1a2616";
              event.currentTarget.style.transform = "translateY(-1px)";
              event.currentTarget.style.boxShadow = "0 6px 16px rgba(35, 50, 23, 0.3)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = BRAND_GREEN;
              event.currentTarget.style.transform = "translateY(0)";
              event.currentTarget.style.boxShadow = "0 4px 12px rgba(35, 50, 23, 0.2)";
            }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={16} />}
            New centre lead
          </button>
        }
      >
        <div
          style={{
            width: "100%",
            background: T.cardBg,
            border: `1px solid ${T.border}`,
            borderRadius: "0 0 16px 16px",
            padding: "20px 24px",
            boxShadow: T.shadowSm,
            overflow: "visible",
            position: "relative",
            zIndex: 50,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Match Lead Pipeline filter panel layout */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: BRAND_GREEN, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                  Intake
                </div>
                <StyledSelect
                  value={intakeFilter}
                  onValueChange={(val) => setIntakeFilter(val as "all" | "submitted" | "pending")}
                  options={intakeOptions}
                  placeholder="All intake"
                />
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: BRAND_GREEN, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                  Source
                </div>
                <StyledSelect
                  value={sourceFilter || "all"}
                  onValueChange={(val) => setSourceFilter(val && val !== "all" ? val : "")}
                  options={sourceFilterOptions}
                  placeholder="All sources"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {normalizedSearchQuery && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                      Search: {searchQuery.trim()}
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}
                        aria-label="Clear search"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {intakeFilter !== "all" && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                      Intake: {intakeFilter}
                      <button type="button" onClick={() => setIntakeFilter("all")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }} aria-label="Clear intake filter">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {sourceFilter && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                      Source: {sourceFilter}
                      <button type="button" onClick={() => setSourceFilter("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }} aria-label="Clear source filter">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
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
                    color: BRAND_GREEN,
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
      </PipelineToolbar>

      {loading ? (
        <Card className="overflow-hidden rounded-2xl border transition-all duration-150" style={{ borderColor: T.border, background: T.cardBg }}>
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND_GREEN }} />
          </div>
        </Card>
      ) : viewMode === "kanban" ? (
        <PipelineKanban columns={kanbanColumns} dragDrop={kanbanDragDrop} />
      ) : (
        <Card className="overflow-hidden rounded-2xl border transition-all duration-150" style={{ borderColor: T.border, background: T.cardBg }}>
          <ShadcnTable>
            <TableHeader>
              <TableRow style={{ backgroundColor: BRAND_GREEN, borderBottom: "none" }} className="hover:bg-transparent">
                {[
                  { label: "Centre", align: "left" as const },
                  { label: "Stage", align: "left" as const },
                  { label: "Last call", align: "left" as const },
                  { label: "Country", align: "left" as const },
                ].map(({ label, align }) => (
                  <TableHead
                    key={label}
                    style={{
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: 12,
                      letterSpacing: "0.3px",
                      padding: "16px 20px",
                      whiteSpace: "nowrap",
                      textAlign: align,
                    }}
                  >
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} style={{ color: T.textMuted, padding: "28px 20px" }}>
                    {rows.length === 0 ? (
                      <>No centre leads yet. Use <strong style={{ color: T.textMid }}>New centre lead</strong> in the toolbar.</>
                    ) : (
                      <>No centre leads match the current filters.</>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((r) => (
                  <TableRow
                    key={r.id}
                    onClick={() => goToCentreLead(r.id)}
                    style={{ borderColor: T.border, cursor: "pointer" }}
                    className="transition-colors duration-150 hover:bg-[#f4faf4]"
                  >
                    <TableCell style={{ padding: "14px 20px", fontWeight: 800, color: T.textDark }}>{r.centre_display_name || "—"}</TableCell>
                    <TableCell style={{ padding: "14px 20px", fontWeight: 600, color: T.textMid }}>{STAGE_LABEL[r.stage] ?? r.stage}</TableCell>
                    <TableCell style={{ padding: "14px 20px", fontSize: 12, color: T.textMuted }}>
                      {r.last_call_result
                        ? `${formatCallResultLabel(r.last_call_result)}${
                            r.last_call_result_at ? ` · ${new Date(r.last_call_result_at).toLocaleString()}` : ""
                          }`
                        : "—"}
                    </TableCell>
                    <TableCell style={{ padding: "14px 20px", fontSize: 12, color: T.textMuted }}>
                      {r.country?.trim() || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </ShadcnTable>
        </Card>
      )}
    </div>
  );
}
