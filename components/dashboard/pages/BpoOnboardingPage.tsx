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
import { Loader2, Plus, Search, ShieldAlert, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import { PipelineStatGrid, PipelineToolbar, type PipelineStat } from "@/components/dashboard/pages/pipeline/PipelineChrome";
import { PipelineKanban, type PipelineKanbanColumn } from "@/components/dashboard/pages/pipeline/PipelineKanban";
import { useParams, useRouter } from "next/navigation";

const BRAND_GREEN = "#233217";

type CenterLeadStage =
  | "pre_onboarding"
  | "ready_for_onboarding_meeting"
  | "onboarding_completed"
  | "actively_selling"
  | "needs_attention"
  | "on_pause"
  | "dqed";

const STAGE_OPTIONS: { key: CenterLeadStage; label: string }[] = [
  { key: "pre_onboarding", label: "Pre-onboarding" },
  { key: "ready_for_onboarding_meeting", label: "Ready for onboarding meeting" },
  { key: "onboarding_completed", label: "Onboarding completed" },
  { key: "actively_selling", label: "Actively selling" },
  { key: "needs_attention", label: "Needs attention" },
  { key: "on_pause", label: "On pause" },
  { key: "dqed", label: "DQED" },
];

const STAGE_LABEL: Record<string, string> = Object.fromEntries(STAGE_OPTIONS.map((o) => [o.key, o.label]));

function formatCallResultLabel(key: string | null): string {
  if (!key) return "";
  return key.replace(/_/g, " ");
}

interface CenterLeadRow {
  id: string;
  centre_display_name: string;
  stage: CenterLeadStage;
  linked_crm_centre_label: string | null;
  lead_vendor_label: string | null;
  opportunity_value: number | null;
  opportunity_source: string | null;
  expected_start_date: string | null;
  committed_daily_sales: number | null;
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
  const [stageFilter, setStageFilter] = useState<CenterLeadStage | "all">("all");
  const [intakeFilter, setIntakeFilter] = useState<"all" | "submitted" | "pending">("all");
  const [sourceFilter, setSourceFilter] = useState("");

  const [, setInviteToken] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

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
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (stageFilter !== "all" && row.stage !== stageFilter) return false;
        if (intakeFilter === "submitted" && !row.form_submitted_at) return false;
        if (intakeFilter === "pending" && row.form_submitted_at) return false;
        if (sourceFilter && row.opportunity_source !== sourceFilter) return false;
        if (normalizedSearchQuery) {
          const haystack = [
            row.centre_display_name,
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
    [intakeFilter, normalizedSearchQuery, rows, sourceFilter, stageFilter],
  );
  const activeFilterCount =
    (stageFilter !== "all" ? 1 : 0) +
    (intakeFilter !== "all" ? 1 : 0) +
    (sourceFilter ? 1 : 0) +
    (normalizedSearchQuery ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;
  const resetFilters = () => {
    setStageFilter("all");
    setIntakeFilter("all");
    setSourceFilter("");
  };
  const stageTotals = useMemo(() => {
    const totals = new Map<CenterLeadStage, number>();
    for (const stage of STAGE_OPTIONS) totals.set(stage.key, 0);
    for (const row of filteredRows) totals.set(row.stage, (totals.get(row.stage) ?? 0) + 1);
    return totals;
  }, [filteredRows]);
  const stageColors = ["#638b4b", "#2563eb", "#7c3aed", "#0f766e", "#d97706", "#64748b", "#991b1b"];
  const stageBackgrounds = ["#f2f8ee", "#eef2ff", "#f5f3ff", "#f0fdfa", "#fffbeb", "#f8fafc", "#fef2f2"];
  const totalOpportunityValue = filteredRows.reduce((sum, row) => sum + (row.opportunity_value ?? 0), 0);
  const averageOpportunityValue = filteredRows.length ? totalOpportunityValue / filteredRows.length : 0;
  const activeSources = new Set(filteredRows.map((row) => row.opportunity_source).filter(Boolean)).size;
  const pipelineStats: PipelineStat[] = [
    {
      label: "Total Opportunities",
      value: filteredRows.length.toString(),
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
    },
    {
      label: "Total Value",
      value: totalOpportunityValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    },
    {
      label: "Average Value",
      value: averageOpportunityValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    },
    {
      label: "Active Sources",
      value: activeSources.toString(),
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    },
  ];
  const kanbanColumns: PipelineKanbanColumn[] = STAGE_OPTIONS.map((stage, index) => {
    const stageRows = filteredRows.filter((row) => row.stage === stage.key);
    const color = stageColors[index % stageColors.length] ?? BRAND_GREEN;
    const bg = stageBackgrounds[index % stageBackgrounds.length] ?? "#f2f8ee";

    return {
      id: stage.key,
      title: stage.label,
      count: stageTotals.get(stage.key) ?? 0,
      value: stageRows.reduce((sum, row) => sum + (row.opportunity_value ?? 0), 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
      color,
      bg,
      cards: stageRows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => goToCentreLead(row.id)}
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
            cursor: "pointer",
            transition: "all 0.2s ease",
            position: "relative",
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", fontSize: 12, gap: 8 }}>
              <span style={{ color: T.textMuted, fontWeight: 500, width: 110 }}>Source:</span>
              <span style={{ color: T.textDark, fontWeight: 600 }}>{row.opportunity_source || "Not set"}</span>
            </div>
            <div style={{ display: "flex", fontSize: 12, gap: 8 }}>
              <span style={{ color: T.textMuted, fontWeight: 500, width: 110 }}>Opportunity Value:</span>
              <span style={{ color: T.textDark, fontWeight: 600 }}>{(row.opportunity_value ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</span>
            </div>
            <div style={{ display: "flex", fontSize: 12, gap: 8 }}>
              <span style={{ color: T.textMuted, fontWeight: 500, width: 110 }}>Intake:</span>
              <span style={{ color: T.textDark, fontWeight: 600 }}>{row.form_submitted_at ? "Submitted" : "Pending"}</span>
            </div>
          </div>
        </button>
      )),
    };
  });

  if (currentRole !== "system_admin") {
    return (
      <div className="mx-auto w-full max-w-[1200px]" style={{ fontFamily: T.font }}>
        <Card className="rounded-2xl border p-8" style={{ borderColor: T.border, background: T.cardBg }}>
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5" style={{ color: "#991b1b" }} />
            <div>
              <h2 className="m-0 text-lg font-extrabold" style={{ color: T.textDark }}>Restricted workspace</h2>
              <p className="m-0 mt-2 text-sm font-medium" style={{ color: T.textMuted }}>
                BPO Centre Leads are currently available to System Admin users only.
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
            <div
              style={{
                height: 38,
                width: 206,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                background: T.cardBg,
                color: T.textDark,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 14px",
                fontSize: 14,
                fontWeight: 500,
                fontFamily: T.font,
                boxShadow: "inset 0 0 0 1px rgba(35, 50, 23, 0.08)",
              }}
            >
              BPO Centre Leads
              <span style={{ color: T.textMuted }}>⌄</span>
            </div>
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
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide" style={{ color: BRAND_GREEN }}>Stage</label>
                <Select value={stageFilter} onValueChange={(value) => setStageFilter(value as CenterLeadStage | "all")}>
                  <SelectTrigger className="h-10 rounded-lg border text-sm font-semibold" style={{ borderColor: T.border, color: T.textDark }}>
                    <SelectValue placeholder="All stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stages</SelectItem>
                    {STAGE_OPTIONS.map((stage) => (
                      <SelectItem key={stage.key} value={stage.key}>{stage.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide" style={{ color: BRAND_GREEN }}>Intake</label>
                <Select value={intakeFilter} onValueChange={(value) => setIntakeFilter(value as "all" | "submitted" | "pending")}>
                  <SelectTrigger className="h-10 rounded-lg border text-sm font-semibold" style={{ borderColor: T.border, color: T.textDark }}>
                    <SelectValue placeholder="All intake" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All intake</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide" style={{ color: BRAND_GREEN }}>Source</label>
                <Select value={sourceFilter || "all"} onValueChange={(value) => setSourceFilter(value && value !== "all" ? value : "")}>
                  <SelectTrigger className="h-10 rounded-lg border text-sm font-semibold" style={{ borderColor: T.border, color: T.textDark }}>
                    <SelectValue placeholder="All sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    {sourceOptions.map((source) => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wide" style={{ color: BRAND_GREEN }}>Showing</div>
                  <div className="mt-2 text-sm font-extrabold" style={{ color: T.textDark }}>
                    {filteredRows.length} of {rows.length} centre leads
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold disabled:opacity-50"
                  style={{ borderColor: T.border, color: BRAND_GREEN, background: "#fff" }}
                >
                  <X size={15} />
                  Reset
                </button>
              </div>
            </div>
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
        <PipelineKanban columns={kanbanColumns} />
      ) : (
        <Card className="overflow-hidden rounded-2xl border transition-all duration-150" style={{ borderColor: T.border, background: T.cardBg }}>
          <ShadcnTable>
            <TableHeader>
              <TableRow style={{ background: T.blueFaint, borderColor: T.border }}>
                <TableHead style={{ color: BRAND_GREEN, fontWeight: 800 }}>Centre</TableHead>
                <TableHead style={{ color: BRAND_GREEN, fontWeight: 800 }}>Stage</TableHead>
                <TableHead style={{ color: BRAND_GREEN, fontWeight: 800 }}>Last call</TableHead>
                <TableHead style={{ color: BRAND_GREEN, fontWeight: 800 }}>Intake</TableHead>
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
                    <TableCell style={{ fontWeight: 800, color: T.textDark }}>{r.centre_display_name || "—"}</TableCell>
                    <TableCell style={{ fontWeight: 600, color: T.textMid }}>{STAGE_LABEL[r.stage] ?? r.stage}</TableCell>
                    <TableCell style={{ fontSize: 12, color: T.textMuted }}>
                      {r.last_call_result
                        ? `${formatCallResultLabel(r.last_call_result)}${
                            r.last_call_result_at ? ` · ${new Date(r.last_call_result_at).toLocaleString()}` : ""
                          }`
                        : "—"}
                    </TableCell>
                    <TableCell style={{ fontSize: 12, color: T.textMuted }}>
                      {r.form_submitted_at ? new Date(r.form_submitted_at).toLocaleString() : "Pending"}
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
