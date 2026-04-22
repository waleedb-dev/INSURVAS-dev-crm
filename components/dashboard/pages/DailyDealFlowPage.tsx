"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EmptyState, Toast } from "@/components/ui";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { CalendarDays, ChevronDown, Download, FileText, Filter, RefreshCw, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DailyDealFlowRow } from "./daily-deal-flow/types";
import { ALL_OPTION, CALL_RESULT_OPTIONS, CARRIER_OPTIONS, LA_CALLBACK_OPTIONS, LICENSED_ACCOUNT_OPTIONS, RECORDS_PER_PAGE } from "./daily-deal-flow/constants";
import { dateObjectToESTString, displayDdfStatus, getTodayDateEST } from "./daily-deal-flow/helpers";
import { DdfGroupedGrid } from "./daily-deal-flow/DdfGroupedGrid";
import { DdfSyncNotSubmittedToLeadsModal } from "./daily-deal-flow/DdfSyncNotSubmittedToLeadsModal";
import { DdfCreateEntryModal } from "./daily-deal-flow/DdfCreateEntryModal";
import CreateLeadModal from "./CreateLeadModal";

type DailyDealFlowPageProps = {
  canProcessActions: boolean;
  isCallCenterScoped?: boolean;
  /** Sales manager: sync not-submitted call results to lead pipeline stage. */
  isSalesManager?: boolean;
  /** Embedded on Live Monitoring: compact chrome, view-only grid subset, same filters as main page. */
  variant?: "default" | "liveMonitoringEmbed";
};

type ExportMode = "eod" | "weekly" | "filtered" | "all";

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

/** Coerce from/to so gte/lte always span a valid interval (swap if user picks reversed order). */
function normalisedDateRange(from: string, to: string): { from: string; to: string } {
  if (!from && !to) return { from: "", to: "" };
  if (from && to && from > to) return { from: to, to: from };
  return { from, to };
}

async function enrichDdfRowsWithLeadProfile(supabase: SupabaseClient, ddfRows: DailyDealFlowRow[]): Promise<DailyDealFlowRow[]> {
  if (ddfRows.length === 0) return ddfRows;
  const submissionIds = [...new Set(ddfRows.map((r) => r.submission_id).filter(Boolean))];
  if (submissionIds.length === 0) {
    return ddfRows.map((r) => ({ ...r, lead_date_of_birth: null, lead_state: null }));
  }
  const { data: leadRows, error } = await supabase
    .from("leads")
    .select("submission_id, date_of_birth, state")
    .in("submission_id", submissionIds);
  const map = new Map<string, { date_of_birth: string | null; state: string | null }>();
  if (!error && leadRows) {
    for (const l of leadRows as { submission_id?: string; date_of_birth?: string | null; state?: string | null }[]) {
      if (l.submission_id) {
        map.set(l.submission_id, { date_of_birth: l.date_of_birth ?? null, state: l.state ?? null });
      }
    }
  }
  return ddfRows.map((r) => {
    const hit = map.get(r.submission_id);
    return {
      ...r,
      lead_date_of_birth: hit?.date_of_birth ?? null,
      lead_state: hit?.state ?? null,
    };
  });
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

export default function DailyDealFlowPage({
  canProcessActions,
  isCallCenterScoped = false,
  isSalesManager = false,
  variant = "default",
}: DailyDealFlowPageProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const params = useParams<{ role?: string }>();
  const dashboardRole = Array.isArray(params?.role) ? params.role[0] : params?.role || "agent";
  const [rows, setRows] = useState<DailyDealFlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [callCenterId, setCallCenterId] = useState<string | null>(null);
  const [leadVendorOptions, setLeadVendorOptions] = useState<string[]>([]);
  const [bufferAgentOptions, setBufferAgentOptions] = useState<string[]>([]);
  const [agentOptions, setAgentOptions] = useState<string[]>([]);
  const [retentionOptions, setRetentionOptions] = useState<string[]>([]);
  const [licensedOptions, setLicensedOptions] = useState<string[]>([]);
  const [carrierOptionsDynamic, setCarrierOptionsDynamic] = useState<string[]>([]);
  const [statusOptionsDynamic, setStatusOptionsDynamic] = useState<string[]>([]);
  const isLiveMonitoringEmbed = variant === "liveMonitoringEmbed";
  const hasWritePermissions = canProcessActions && !isLiveMonitoringEmbed;
  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);
  const [syncNotSubmittedModalOpen, setSyncNotSubmittedModalOpen] = useState(false);
  const [createLeadModalOpen, setCreateLeadModalOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [bufferAgentFilter, setBufferAgentFilter] = useState(ALL_OPTION);
  const [retentionAgentFilter, setRetentionAgentFilter] = useState<string[]>([]);
  const [licensedAgentFilter, setLicensedAgentFilter] = useState(ALL_OPTION);
  const [leadVendorFilter, setLeadVendorFilter] = useState(ALL_OPTION);
  const [statusFilter, setStatusFilter] = useState(ALL_OPTION);
  const [carrierFilter, setCarrierFilter] = useState(ALL_OPTION);
  const [callResultFilter, setCallResultFilter] = useState(ALL_OPTION);
  const [retentionFilter, setRetentionFilter] = useState(ALL_OPTION);
  const [incompleteUpdatesFilter, setIncompleteUpdatesFilter] = useState(ALL_OPTION);
  const [laCallbackFilter, setLaCallbackFilter] = useState(ALL_OPTION);
  const [hourFromFilter, setHourFromFilter] = useState(ALL_OPTION);
  const [hourToFilter, setHourToFilter] = useState(ALL_OPTION);
  const [groupBy, setGroupBy] = useState("none");
  const [groupBySecondary, setGroupBySecondary] = useState("none");

  const groupByOptions = [
    { value: "none", label: "No Grouping" },
    { value: "lead_vendor", label: "Lead Vendor" },
    { value: "buffer_agent", label: "Buffer Agent" },
    { value: "retention_agent", label: "Retention Agent" },
    { value: "agent", label: "Agent" },
    { value: "licensed_agent_account", label: "Licensed Agent" },
    { value: "status", label: "Status" },
    { value: "call_result", label: "Call Result" },
    { value: "carrier", label: "Carrier" },
    { value: "product_type", label: "Product Type" },
    { value: "is_callback", label: "Callback" },
    { value: "is_retention_call", label: "Retention" },
  ];

  const visiblePremium = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.monthly_premium) || 0), 0),
    [rows],
  );
  const visibleAveragePremium = useMemo(
    () => (rows.length ? visiblePremium / rows.length : 0),
    [rows, visiblePremium],
  );
  const activeCarriers = useMemo(
    () => new Set(rows.map((row) => String(row.carrier || "").trim()).filter(Boolean)).size,
    [rows],
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (searchTerm.trim() !== "") n++;
    if (dateFromFilter !== "") n++;
    if (dateToFilter !== "") n++;
    if (bufferAgentFilter !== ALL_OPTION) n++;
    if (retentionAgentFilter.length > 0) n++;
    if (licensedAgentFilter !== ALL_OPTION) n++;
    if (leadVendorFilter !== ALL_OPTION) n++;
    if (statusFilter !== ALL_OPTION) n++;
    if (carrierFilter !== ALL_OPTION) n++;
    if (callResultFilter !== ALL_OPTION) n++;
    if (retentionFilter !== ALL_OPTION) n++;
    if (incompleteUpdatesFilter !== ALL_OPTION) n++;
    if (laCallbackFilter !== ALL_OPTION) n++;
    if (hourFromFilter !== ALL_OPTION) n++;
    if (hourToFilter !== ALL_OPTION) n++;
    return n;
  }, [searchTerm, dateFromFilter, dateToFilter, bufferAgentFilter, retentionAgentFilter, licensedAgentFilter, leadVendorFilter, statusFilter, carrierFilter, callResultFilter, retentionFilter, incompleteUpdatesFilter, laCallbackFilter, hourFromFilter, hourToFilter]);

  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = () => {
    setSearchTerm("");
    setDateFromFilter("");
    setDateToFilter("");
    setBufferAgentFilter(ALL_OPTION);
    setRetentionAgentFilter([]);
    setLicensedAgentFilter(ALL_OPTION);
    setLeadVendorFilter(ALL_OPTION);
    setStatusFilter(ALL_OPTION);
    setCarrierFilter(ALL_OPTION);
    setCallResultFilter(ALL_OPTION);
    setRetentionFilter(ALL_OPTION);
    setIncompleteUpdatesFilter(ALL_OPTION);
    setLaCallbackFilter(ALL_OPTION);
    setHourFromFilter(ALL_OPTION);
    setHourToFilter(ALL_OPTION);
    setCurrentPage(1);
  };

  type VendorRow = { lead_vendor: string | null };
  type CarrierRow = { carrier: string | null };
  type UserOptionRow = {
    full_name: string | null;
    licensed_name: string | null;
    is_licensed: boolean | null;
    unlicensed_sales_subtype: string | null;
  };

  const loadDistinct = useCallback(async () => {
    const { data: vendorRows } = await supabase.from("daily_deal_flow").select("lead_vendor").not("lead_vendor", "is", null);
    const { data: carrierRows } = await supabase.from("daily_deal_flow").select("carrier").not("carrier", "is", null);
    const { data: pipelineStages } = await supabase
      .from("pipeline_stages")
      .select("name")
      .eq("pipeline_id", 4)
      .order("position", { ascending: true });

    // Fetch all active users with their roles
    const { data: allUsers, error: usersError } = await supabase
      .from("users")
      .select("full_name, licensed_name, is_licensed, unlicensed_sales_subtype, status")
      .eq("status", "active");

    if (usersError) {
      console.error("[DailyDealFlow] Error fetching users:", usersError);
    }

    console.log("[DailyDealFlow] Fetched users:", allUsers?.length || 0, allUsers);

    // Filter users locally based on their roles
    const userRows = (allUsers || []) as UserOptionRow[];
    const licensedList = userRows
      .filter((u) => u.is_licensed && u.licensed_name)
      .map((u) => u.licensed_name as string);
    
    const bufferList = userRows
      .filter((u) => u.unlicensed_sales_subtype === "buffer_agent" && u.full_name)
      .map((u) => u.full_name as string);
    
    const retentionList = userRows
      .filter((u) => u.unlicensed_sales_subtype === "retention_agent" && u.full_name)
      .map((u) => u.full_name as string);
    
    const agentList = userRows
      .filter((u) => u.is_licensed && u.full_name)
      .map((u) => u.full_name as string);

    console.log("[DailyDealFlow] Agent options:", { licensedList, bufferList, retentionList, agentList });

    const vendors = [...new Set(((vendorRows || []) as VendorRow[]).map((r) => r.lead_vendor).filter(Boolean) as string[])];
    const carriers = [...new Set(((carrierRows || []) as CarrierRow[]).map((r) => r.carrier).filter(Boolean) as string[])];
    const stages = (pipelineStages || []).map((s: { name: string }) => s.name).filter(Boolean) as string[];

    setLeadVendorOptions(vendors);
    setBufferAgentOptions(bufferList);
    setAgentOptions(agentList);
    setRetentionOptions(retentionList);
    setLicensedOptions(licensedList);
    setCarrierOptionsDynamic(carriers);
    setStatusOptionsDynamic(stages);
  }, [supabase]);

  const fetchData = useCallback(async (page = 1, showRefreshToast = false) => {
    setRefreshing(true);
    const from = (page - 1) * RECORDS_PER_PAGE;
    const to = from + RECORDS_PER_PAGE - 1;
    let query = supabase.from("daily_deal_flow").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
    const { from: rangeFrom, to: rangeTo } = normalisedDateRange(dateFromFilter, dateToFilter);
    if (rangeFrom) query = query.gte("date", rangeFrom);
    if (rangeTo) query = query.lte("date", rangeTo);
    if (bufferAgentFilter !== ALL_OPTION) query = query.eq("buffer_agent", bufferAgentFilter);
    if (retentionAgentFilter.length > 0) query = query.in("retention_agent", retentionAgentFilter);
    if (licensedAgentFilter !== ALL_OPTION) query = query.eq("licensed_agent_account", licensedAgentFilter);
    if (leadVendorFilter !== ALL_OPTION) query = query.eq("lead_vendor", leadVendorFilter);
    if (statusFilter !== ALL_OPTION && statusFilter !== "All") {
      if (statusFilter === "Pending Approval") {
        query = query.or("status.eq.Pending Approval,status.eq.Underwriting");
      } else {
        query = query.eq("status", statusFilter);
      }
    }
    if (carrierFilter !== ALL_OPTION) query = query.eq("carrier", carrierFilter);
    if (callResultFilter !== ALL_OPTION) query = query.eq("call_result", callResultFilter);
    if (retentionFilter !== ALL_OPTION) query = retentionFilter === "Retention" ? query.not("retention_agent", "is", null).neq("retention_agent", "") : query.or("retention_agent.is.null,retention_agent.eq.");
    if (incompleteUpdatesFilter !== ALL_OPTION) query = incompleteUpdatesFilter === "Incomplete" ? query.or("status.is.null,status.eq.") : query.not("status", "is", null).not("status", "eq", "");
    if (laCallbackFilter !== ALL_OPTION) query = query.eq("la_callback", laCallbackFilter);
    const hourBaseDate = rangeFrom || rangeTo || getTodayDateEST();
    if (hourFromFilter !== ALL_OPTION) {
      const hourFrom = Number(hourFromFilter);
      const utcHour = (hourFrom + 5) % 24;
      query = query.gte("created_at", `${hourBaseDate}T${String(utcHour).padStart(2, "0")}:00:00+00`);
    }
    if (hourToFilter !== ALL_OPTION) {
      const hourTo = Number(hourToFilter);
      const utcHourEnd = (hourTo + 6) % 24;
      query = query.lt("created_at", `${hourBaseDate}T${String(utcHourEnd).padStart(2, "0")}:00:00+00`);
    }
    if (searchTerm) {
      query = query.or(`insured_name.ilike.%${searchTerm}%,client_phone_number.ilike.%${searchTerm}%,submission_id.ilike.%${searchTerm}%,lead_vendor.ilike.%${searchTerm}%,agent.ilike.%${searchTerm}%,status.ilike.%${searchTerm}%,carrier.ilike.%${searchTerm}%,licensed_agent_account.ilike.%${searchTerm}%,buffer_agent.ilike.%${searchTerm}%,retention_agent.ilike.%${searchTerm}%`);
    }
    const { data, error, count } = await query;
    if (error) {
      setToast({ message: error.message || "Failed to fetch data", type: "error" });
    } else {
      const merged = await enrichDdfRowsWithLeadProfile(supabase, (data || []) as DailyDealFlowRow[]);
      setRows(merged);
      setTotalRecords(count || 0);
      setCurrentPage(page);
      if (showRefreshToast) setToast({ message: "Data refreshed successfully", type: "success" });
    }
    setLoading(false);
    setRefreshing(false);
  }, [supabase, dateFromFilter, dateToFilter, bufferAgentFilter, retentionAgentFilter, licensedAgentFilter, leadVendorFilter, statusFilter, carrierFilter, callResultFilter, retentionFilter, incompleteUpdatesFilter, laCallbackFilter, hourFromFilter, hourToFilter, searchTerm]);

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (uid) {
        const { data: profile } = await supabase
          .from("users")
          .select("call_center_id, call_centers(name)")
          .eq("id", uid)
          .maybeSingle();
        setCallCenterId(profile?.call_center_id ?? null);
      } else {
        setCallCenterId(null);
      }
      await loadDistinct();
      await fetchData(1);
    })();
  }, [supabase, loadDistinct, fetchData, canProcessActions]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchData(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm, fetchData]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchData(1);
    }, 0);
    return () => clearTimeout(timeout);
  }, [dateFromFilter, dateToFilter, bufferAgentFilter, retentionAgentFilter, licensedAgentFilter, leadVendorFilter, statusFilter, carrierFilter, callResultFilter, retentionFilter, incompleteUpdatesFilter, laCallbackFilter, hourFromFilter, hourToFilter, fetchData]);

  const handleExport = async (mode: ExportMode = "filtered") => {
    let query = supabase.from("daily_deal_flow").select("*").order("created_at", { ascending: false });
    const today = getTodayDateEST();
    const weekStart = dateObjectToESTString(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
    const { from: filterFrom, to: filterTo } = normalisedDateRange(dateFromFilter, dateToFilter);
    const exportFrom = mode === "eod" ? today : mode === "weekly" ? weekStart : mode === "filtered" ? filterFrom : "";
    const exportTo = mode === "eod" || mode === "weekly" ? today : mode === "filtered" ? filterTo : "";
    const shouldApplyFilters = mode === "filtered";

    if (exportFrom) query = query.gte("date", exportFrom);
    if (exportTo) query = query.lte("date", exportTo);
    if (shouldApplyFilters) {
      if (bufferAgentFilter !== ALL_OPTION) query = query.eq("buffer_agent", bufferAgentFilter);
      if (retentionAgentFilter.length > 0) query = query.in("retention_agent", retentionAgentFilter);
      if (licensedAgentFilter !== ALL_OPTION) query = query.eq("licensed_agent_account", licensedAgentFilter);
      if (leadVendorFilter !== ALL_OPTION) query = query.eq("lead_vendor", leadVendorFilter);
      if (statusFilter !== ALL_OPTION && statusFilter !== "All") {
        if (statusFilter === "Pending Approval") {
          query = query.or("status.eq.Pending Approval,status.eq.Underwriting");
        } else {
          query = query.eq("status", statusFilter);
        }
      }
      if (carrierFilter !== ALL_OPTION) query = query.eq("carrier", carrierFilter);
      if (callResultFilter !== ALL_OPTION) query = query.eq("call_result", callResultFilter);
      if (laCallbackFilter !== ALL_OPTION) query = query.eq("la_callback", laCallbackFilter);
      if (searchTerm) query = query.or(`insured_name.ilike.%${searchTerm}%,client_phone_number.ilike.%${searchTerm}%,submission_id.ilike.%${searchTerm}%`);
    }
    const { data, error } = await query;
    if (error || !data?.length) return setToast({ message: error?.message || "No data to export", type: "error" });
    const enriched = await enrichDdfRowsWithLeadProfile(supabase, data as DailyDealFlowRow[]);
    const headers = [
      "Submission ID",
      "Date",
      "Insured Name",
      "Lead Vendor",
      "Phone Number",
      "Date of Birth",
      "State",
      "Buffer Agent",
      "Retention Agent",
      "Agent",
      "Licensed Agent",
      "Status",
      "Call Result",
      "Carrier",
      "Product Type",
      "Draft Date",
      "Monthly Premium",
      "Face Amount",
      "LA Callback",
      "Notes",
    ];
    const csvRows = enriched.map((r) => {
      const values = [
        r.submission_id,
        r.date,
        r.insured_name,
        r.lead_vendor,
        r.client_phone_number,
        r.lead_date_of_birth ?? "",
        r.lead_state ?? "",
        r.buffer_agent,
        r.retention_agent,
        r.agent,
        r.licensed_agent_account,
        displayDdfStatus(r.status),
        r.call_result,
        r.carrier,
        r.product_type,
        r.draft_date,
        r.monthly_premium,
        r.face_amount,
        r.la_callback,
        String(r.notes || "").replace(/"/g, '""'),
      ];
      return values.map((v) => `"${v ?? ""}"`).join(",");
    });
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const { from: sFrom, to: sTo } = normalisedDateRange(exportFrom, exportTo);
    const suffix =
      sFrom || sTo ? `${sFrom || "start"}_${sTo || "end"}` : mode === "all" ? "all" : dateObjectToESTString(new Date());
    a.download = `daily-deal-flow-${mode}-${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: `Exported ${data.length} records`, type: "success" });
  };

  const statusOptions = [{ value: "All", label: "All Status" }, ...statusOptionsDynamic.map(v => ({ value: v, label: v }))];
  const carrierOptions = [{ value: "All", label: "All Carriers" }, ...CARRIER_OPTIONS.filter(v => v !== "All").map(v => ({ value: v, label: v }))];
  const callResultOptions = [{ value: "All", label: "All Results" }, ...CALL_RESULT_OPTIONS.filter(v => v !== "All").map(v => ({ value: v, label: v }))];
  const laCallbackOptions = [{ value: "All", label: "All Callbacks" }, ...LA_CALLBACK_OPTIONS.filter(v => v !== "All").map(v => ({ value: v, label: v }))];
  const bufferOptions = [{ value: "All", label: "All Buffers" }, ...bufferAgentOptions.map(v => ({ value: v, label: v }))];
  const vendorOptions = [{ value: "All", label: "All Vendors" }, ...leadVendorOptions.map(v => ({ value: v, label: v }))];

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          paddingBottom: isLiveMonitoringEmbed ? 8 : 24,
        }}
      >
        {!isLiveMonitoringEmbed && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <StatSkeleton key={i} />
            ))}
          </div>
        )}
        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            backgroundColor: T.cardBg,
            padding: isLiveMonitoringEmbed ? "40px 24px" : "80px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            flex: isLiveMonitoringEmbed ? 1 : undefined,
            minHeight: isLiveMonitoringEmbed ? 120 : undefined,
          }}
        >
          <LoadingSpinner size={48} label="Loading Daily Deal Flow..." />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        paddingBottom: isLiveMonitoringEmbed ? 8 : 24,
        position: "relative",
        overflow: isLiveMonitoringEmbed ? "hidden" : "visible",
      }}
    >
      {!isLiveMonitoringEmbed && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
        {[
          { label: "Total Entries", value: totalRecords.toLocaleString(), color: "#233217", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
            ) },
          { label: "Visible Premium", value: `$${visiblePremium.toLocaleString()}`, color: "#233217", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            ) },
          { label: "Avg Premium", value: `$${visibleAveragePremium.toFixed(0)}`, color: "#233217", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            ) },
          { label: "Active Carriers", value: activeCarriers.toString(), color: "#233217", icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>
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
              boxShadow: hoveredStatIdx === i ? "0 14px 40px rgba(28, 32, 26, 0.08), 0 4px 14px rgba(28, 32, 26, 0.05)" : "0 4px 12px rgba(0,0,0,0.03)",
              transform: hoveredStatIdx === i ? "translateY(-3px)" : "translateY(0)",
              transition: "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
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
                backgroundColor: hoveredStatIdx === i ? "color-mix(in srgb, #233217 24%, transparent)" : "color-mix(in srgb, #233217 15%, transparent)",
                width: 44,
                height: 44,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background-color 0.32s cubic-bezier(0.22, 1, 0.36, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
                transform: hoveredStatIdx === i ? "scale(1.04)" : "scale(1)",
              }}
            >
              {icon}
            </div>
          </Card>
        ))}
      </div>
      )}

      {isCallCenterScoped && !callCenterId && (
        <div
          role="status"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fff7ed",
            border: `1px solid ${T.border}`,
            color: T.textDark,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          Your profile is not linked to a call center. You cannot create Daily Deal Flow entries until an administrator assigns your center in Users.
        </div>
      )}

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
              <Search size={16} style={{ position: "absolute", left: 12, pointerEvents: "none", zIndex: 1, color: T.textMuted }} />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search entries..."
                style={{
                  height: 38,
                  minWidth: 260,
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

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StyledSelect
                value={groupBy}
                onValueChange={(val) => { setGroupBy(val); setCurrentPage(1); }}
                options={groupByOptions}
                placeholder="No Grouping"
              />
              {groupBy !== "none" && (
                <StyledSelect
                  value={groupBySecondary}
                  onValueChange={(val) => { setGroupBySecondary(val); setCurrentPage(1); }}
                  options={[{ value: "none", label: "No Secondary Group" }, ...groupByOptions.filter(o => o.value !== "none")]}
                  placeholder="No Secondary"
                />
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isSalesManager && hasWritePermissions && !isLiveMonitoringEmbed && (
              <DdfCreateEntryModal
                supabase={supabase}
                bufferAgentOptions={bufferAgentOptions}
                agentOptions={agentOptions}
                licensedOptions={licensedOptions}
                carrierOptions={carrierOptionsDynamic}
                statusOptions={statusOptionsDynamic}
                callCenterId={callCenterId}
                onCreateLead={() => setCreateLeadModalOpen(true)}
                onSuccess={() => {
                  setToast({ message: "Daily Deal Flow entry created", type: "success" });
                  void fetchData(1);
                }}
                onError={(message) => setToast({ message, type: "error" })}
              />
            )}

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

            {isSalesManager && !isLiveMonitoringEmbed && (
              <button
                type="button"
                onClick={() => setSyncNotSubmittedModalOpen(true)}
                style={{
                  height: 38,
                  padding: "0 16px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: "#fff",
                  color: T.textDark,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Sync
              </button>
            )}

            {!isLiveMonitoringEmbed && (
            <DropdownMenu>
              <DropdownMenuTrigger
                style={{
                  height: 38,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: "#fff",
                  color: T.textDark,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                className="hover:border-[#233217] hover:bg-[#EEF5EE] data-[popup-open]:border-[#233217] data-[popup-open]:ring-2 data-[popup-open]:ring-[#233217]/15"
              >
                <Download size={16} />
                Export
                <ChevronDown size={16} />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="!w-[220px] !rounded-[10px] !border-[#a7c194] !bg-white !p-0"
              >
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => void handleExport("eod")}
                    className="!cursor-pointer !gap-3 !rounded-none !px-4 !py-3 text-[13.5px] !font-semibold text-[#1c201a] focus:!bg-[#EEF5EE] focus:!text-[#233217]"
                  >
                    <FileText size={16} />
                    EOD Reports
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="!m-0 bg-[#dfe9d6]" />
                  <DropdownMenuItem
                    onClick={() => void handleExport("weekly")}
                    className="!cursor-pointer !gap-3 !rounded-none !px-4 !py-3 text-[13.5px] !font-semibold text-[#1c201a] focus:!bg-[#EEF5EE] focus:!text-[#233217]"
                  >
                    <CalendarDays size={16} />
                    Weekly
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="!m-0 bg-[#dfe9d6]" />
                  <DropdownMenuItem
                    onClick={() => void handleExport("filtered")}
                    className="!cursor-pointer !gap-3 !rounded-none !px-4 !py-3 text-[13.5px] !font-semibold text-[#1c201a] focus:!bg-[#EEF5EE] focus:!text-[#233217]"
                  >
                    <Download size={16} />
                    Export Filtered
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="!m-0 bg-[#dfe9d6]" />
                  <DropdownMenuItem
                    onClick={() => void handleExport("all")}
                    className="!cursor-pointer !gap-3 !rounded-none !px-4 !py-3 text-[13.5px] !font-semibold text-[#1c201a] focus:!bg-[#EEF5EE] focus:!text-[#233217]"
                  >
                    <Download size={16} />
                    Export All
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            )}

            <button
              onClick={() => void fetchData(1, true)}
              disabled={refreshing}
              style={{
                height: 38,
                padding: "0 16px",
                borderRadius: 10,
                border: "none",
                background: "#233217",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: T.font,
                cursor: refreshing ? "not-allowed" : "pointer",
                opacity: refreshing ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 12px rgba(35, 50, 23, 0.2)",
              }}
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Date</div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <input
                    type="date"
                    value={dateFromFilter}
                    onChange={(e) => setDateFromFilter(e.target.value)}
                    aria-label="Date from"
                    style={{
                      flex: "1 1 120px",
                      minWidth: 0,
                      height: 38,
                      borderRadius: 10,
                      border: `1px solid ${T.border}`,
                      backgroundColor: T.cardBg,
                      color: T.textDark,
                      fontSize: 13,
                      fontWeight: 500,
                      padding: "0 10px",
                      outline: "none",
                    }}
                    className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, flexShrink: 0 }}>to</span>
                  <input
                    type="date"
                    value={dateToFilter}
                    onChange={(e) => setDateToFilter(e.target.value)}
                    aria-label="Date to"
                    style={{
                      flex: "1 1 120px",
                      minWidth: 0,
                      height: 38,
                      borderRadius: 10,
                      border: `1px solid ${T.border}`,
                      backgroundColor: T.cardBg,
                      color: T.textDark,
                      fontSize: 13,
                      fontWeight: 500,
                      padding: "0 10px",
                      outline: "none",
                    }}
                    className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
                  />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Lead Vendor</div>
                <StyledSelect
                  value={leadVendorFilter}
                  onValueChange={setLeadVendorFilter}
                  options={vendorOptions}
                  placeholder="All Vendors"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Buffer Agent</div>
                <StyledSelect
                  value={bufferAgentFilter}
                  onValueChange={setBufferAgentFilter}
                  options={bufferOptions}
                  placeholder="All Buffers"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Status</div>
                <StyledSelect
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  options={statusOptions}
                  placeholder="All Status"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Carrier</div>
                <StyledSelect
                  value={carrierFilter}
                  onValueChange={setCarrierFilter}
                  options={carrierOptions}
                  placeholder="All Carriers"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Call Result</div>
                <StyledSelect
                  value={callResultFilter}
                  onValueChange={setCallResultFilter}
                  options={callResultOptions}
                  placeholder="All Results"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>LA Callback</div>
                <StyledSelect
                  value={laCallbackFilter}
                  onValueChange={setLaCallbackFilter}
                  options={laCallbackOptions}
                  placeholder="All Callbacks"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Licensed Agent</div>
                <StyledSelect
                  value={licensedAgentFilter}
                  onValueChange={setLicensedAgentFilter}
                  options={[{ value: "All", label: "All Agents" }, ...LICENSED_ACCOUNT_OPTIONS.filter(v => v !== "All").map(v => ({ value: v, label: v }))]}
                  placeholder="All Agents"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {searchTerm.trim() !== "" && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                      Search: {searchTerm}
                      <button onClick={() => setSearchTerm("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  )}
                  {(dateFromFilter !== "" || dateToFilter !== "") && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                      Date: {dateFromFilter || "…"} – {dateToFilter || "…"}
                      <button
                        type="button"
                        onClick={() => {
                          setDateFromFilter("");
                          setDateToFilter("");
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  )}
                  {leadVendorFilter !== ALL_OPTION && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                      Vendor: {leadVendorFilter}
                      <button onClick={() => setLeadVendorFilter(ALL_OPTION)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  )}
                  {bufferAgentFilter !== ALL_OPTION && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                      Buffer: {bufferAgentFilter}
                      <button onClick={() => setBufferAgentFilter(ALL_OPTION)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  )}
                  {statusFilter !== ALL_OPTION && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                      Status: {statusFilter}
                      <button onClick={() => setStatusFilter(ALL_OPTION)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  )}
                  {carrierFilter !== ALL_OPTION && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                      Carrier: {carrierFilter}
                      <button onClick={() => setCarrierFilter(ALL_OPTION)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  )}
                  {callResultFilter !== ALL_OPTION && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                      Result: {callResultFilter}
                      <button onClick={() => setCallResultFilter(ALL_OPTION)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  )}
                  {laCallbackFilter !== ALL_OPTION && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                      Callback: {laCallbackFilter}
                      <button onClick={() => setLaCallbackFilter(ALL_OPTION)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  )}
                  {licensedAgentFilter !== ALL_OPTION && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                      Agent: {licensedAgentFilter}
                      <button onClick={() => setLicensedAgentFilter(ALL_OPTION)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={clearFilters}
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
                  onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No daily deal entries yet"
          description={
            isLiveMonitoringEmbed
              ? "No rows match the current filters. Adjust filters or date range."
              : isCallCenterScoped
                ? "There are no rows for your call center yet, or filters exclude everything. Adjust filters or create a new entry."
                : "Try adjusting filters or creating a new entry."
          }
          compact
        />
      ) : (
        <DdfGroupedGrid
          rows={rows}
          currentPage={currentPage}
          totalRecords={totalRecords}
          recordsPerPage={RECORDS_PER_PAGE}
          hasWritePermissions={hasWritePermissions}
          onPageChange={(page) => void fetchData(page)}
          onRefresh={() => void fetchData(currentPage)}
          onError={(message) => setToast({ message, type: "error" })}
          onSuccess={(message) => setToast({ message, type: "success" })}
          supabase={supabase}
          leadVendorOptions={leadVendorOptions}
          bufferAgentOptions={bufferAgentOptions}
          agentOptions={agentOptions}
          retentionOptions={retentionOptions}
          licensedOptions={licensedOptions}
          carrierOptions={carrierOptionsDynamic}
          statusOptions={statusOptionsDynamic}
          groupBy={groupBy}
          groupBySecondary={groupBySecondary}
          gridColumnPreset={isLiveMonitoringEmbed ? "liveMonitoring" : "full"}
        />
      )}

      {isSalesManager && !isLiveMonitoringEmbed && (
        <DdfSyncNotSubmittedToLeadsModal
          open={syncNotSubmittedModalOpen}
          onClose={() => setSyncNotSubmittedModalOpen(false)}
          supabase={supabase}
          dashboardRole={dashboardRole}
          onSynced={() => void fetchData(currentPage)}
        />
      )}

      <CreateLeadModal
        open={createLeadModalOpen}
        onClose={() => setCreateLeadModalOpen(false)}
        onSuccess={() => {
          setCreateLeadModalOpen(false);
          setToast({ message: "Lead created and added to Daily Deal Flow", type: "success" });
          void fetchData(1);
        }}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
