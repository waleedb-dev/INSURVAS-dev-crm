"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, EmptyState, Toast } from "@/components/ui";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { IconDownload, IconRefresh } from "@tabler/icons-react";
import type { DailyDealFlowRow } from "./daily-deal-flow/types";
import { ALL_OPTION, CALL_RESULT_OPTIONS, CARRIER_OPTIONS, LA_CALLBACK_OPTIONS, LICENSED_ACCOUNT_OPTIONS, RECORDS_PER_PAGE, RETENTION_AGENT_OPTIONS, STATUS_OPTIONS } from "./daily-deal-flow/constants";
import { dateObjectToESTString } from "./daily-deal-flow/helpers";
import { DdfToolbar } from "./daily-deal-flow/DdfToolbar";
import { DdfCreateEntryModal } from "./daily-deal-flow/DdfCreateEntryModal";
import { DdfGroupedGrid } from "./daily-deal-flow/DdfGroupedGrid";

type DailyDealFlowPageProps = {
  canProcessActions: boolean;
  /** When true, UI copy and create flow assume RLS is scoped to the user's call center. */
  isCallCenterScoped?: boolean;
};

export default function DailyDealFlowPage({ canProcessActions, isCallCenterScoped = false }: DailyDealFlowPageProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<DailyDealFlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [callCenterId, setCallCenterId] = useState<string | null>(null);
  const [callCenterName, setCallCenterName] = useState<string | null>(null);
  const [leadVendorOptions, setLeadVendorOptions] = useState<string[]>([]);
  const [bufferAgentOptions, setBufferAgentOptions] = useState<string[]>([]);
  const hasWritePermissions = canProcessActions;

  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
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

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    dateFilter !== "" ||
    dateFromFilter !== "" ||
    dateToFilter !== "" ||
    bufferAgentFilter !== ALL_OPTION ||
    retentionAgentFilter.length > 0 ||
    licensedAgentFilter !== ALL_OPTION ||
    leadVendorFilter !== ALL_OPTION ||
    statusFilter !== ALL_OPTION ||
    carrierFilter !== ALL_OPTION ||
    callResultFilter !== ALL_OPTION ||
    retentionFilter !== ALL_OPTION ||
    incompleteUpdatesFilter !== ALL_OPTION ||
    laCallbackFilter !== ALL_OPTION ||
    hourFromFilter !== ALL_OPTION ||
    hourToFilter !== ALL_OPTION;

  const clearFilters = () => {
    setSearchTerm("");
    setDateFilter("");
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
  type BufferRow = { buffer_agent: string | null };

  const loadDistinct = useCallback(async () => {
    const { data: vendorRows } = await supabase.from("daily_deal_flow").select("lead_vendor").not("lead_vendor", "is", null);
    const { data: bufferRows } = await supabase.from("daily_deal_flow").select("buffer_agent").not("buffer_agent", "is", null);
    const vendors = [...new Set(((vendorRows || []) as VendorRow[]).map((r) => r.lead_vendor).filter(Boolean) as string[])];
    const buffers = [...new Set(((bufferRows || []) as BufferRow[]).map((r) => r.buffer_agent).filter(Boolean) as string[])];
    setLeadVendorOptions(vendors);
    setBufferAgentOptions(buffers);
  }, [supabase]);

  const fetchData = useCallback(async (page = 1, showRefreshToast = false) => {
    setRefreshing(true);
    const from = (page - 1) * RECORDS_PER_PAGE;
    const to = from + RECORDS_PER_PAGE - 1;
    let query = supabase.from("daily_deal_flow").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
    if (dateFilter) query = query.eq("date", dateFilter);
    if (dateFromFilter) query = query.gte("date", dateFromFilter);
    if (dateToFilter) query = query.lte("date", dateToFilter);
    if (bufferAgentFilter !== ALL_OPTION) query = query.eq("buffer_agent", bufferAgentFilter);
    if (retentionAgentFilter.length > 0) query = query.in("retention_agent", retentionAgentFilter);
    if (licensedAgentFilter !== ALL_OPTION) query = query.eq("licensed_agent_account", licensedAgentFilter);
    if (leadVendorFilter !== ALL_OPTION) query = query.eq("lead_vendor", leadVendorFilter);
    if (statusFilter !== ALL_OPTION) query = query.eq("status", statusFilter);
    if (carrierFilter !== ALL_OPTION) query = query.eq("carrier", carrierFilter);
    if (callResultFilter !== ALL_OPTION) query = query.eq("call_result", callResultFilter);
    if (retentionFilter !== ALL_OPTION) query = retentionFilter === "Retention" ? query.not("retention_agent", "is", null).neq("retention_agent", "") : query.or("retention_agent.is.null,retention_agent.eq.");
    if (incompleteUpdatesFilter !== ALL_OPTION) query = incompleteUpdatesFilter === "Incomplete" ? query.or("status.is.null,status.eq.") : query.not("status", "is", null).not("status", "eq", "");
    if (laCallbackFilter !== ALL_OPTION) query = query.eq("la_callback", laCallbackFilter);
    if (hourFromFilter !== ALL_OPTION) {
      const hourFrom = Number(hourFromFilter);
      const baseDate = dateFilter || new Date().toISOString().split("T")[0];
      const utcHour = (hourFrom + 5) % 24;
      query = query.gte("created_at", `${baseDate}T${String(utcHour).padStart(2, "0")}:00:00+00`);
    }
    if (hourToFilter !== ALL_OPTION) {
      const hourTo = Number(hourToFilter);
      const baseDate = dateFilter || new Date().toISOString().split("T")[0];
      const utcHourEnd = (hourTo + 6) % 24;
      query = query.lt("created_at", `${baseDate}T${String(utcHourEnd).padStart(2, "0")}:00:00+00`);
    }
    if (searchTerm) {
      query = query.or(`insured_name.ilike.%${searchTerm}%,client_phone_number.ilike.%${searchTerm}%,submission_id.ilike.%${searchTerm}%,lead_vendor.ilike.%${searchTerm}%,agent.ilike.%${searchTerm}%,status.ilike.%${searchTerm}%,carrier.ilike.%${searchTerm}%,licensed_agent_account.ilike.%${searchTerm}%,buffer_agent.ilike.%${searchTerm}%,retention_agent.ilike.%${searchTerm}%`);
    }
    const { data, error, count } = await query;
    if (error) {
      setToast({ message: error.message || "Failed to fetch data", type: "error" });
    } else {
      setRows((data || []) as DailyDealFlowRow[]);
      setTotalRecords(count || 0);
      setCurrentPage(page);
      if (showRefreshToast) setToast({ message: "Data refreshed successfully", type: "success" });
    }
    setLoading(false);
    setRefreshing(false);
  }, [supabase, dateFilter, dateFromFilter, dateToFilter, bufferAgentFilter, retentionAgentFilter, licensedAgentFilter, leadVendorFilter, statusFilter, carrierFilter, callResultFilter, retentionFilter, incompleteUpdatesFilter, laCallbackFilter, hourFromFilter, hourToFilter, searchTerm]);

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
        const c = profile?.call_centers as { name?: string } | null | undefined;
        setCallCenterName(typeof c?.name === "string" ? c.name : null);
      } else {
        setCallCenterId(null);
        setCallCenterName(null);
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
  }, [dateFilter, dateFromFilter, dateToFilter, bufferAgentFilter, retentionAgentFilter, licensedAgentFilter, leadVendorFilter, statusFilter, carrierFilter, callResultFilter, retentionFilter, incompleteUpdatesFilter, laCallbackFilter, hourFromFilter, hourToFilter, fetchData]);

  const handleExport = async () => {
    let query = supabase.from("daily_deal_flow").select("*").order("created_at", { ascending: false });
    if (dateFilter) query = query.eq("date", dateFilter);
    if (dateFromFilter) query = query.gte("date", dateFromFilter);
    if (dateToFilter) query = query.lte("date", dateToFilter);
    if (bufferAgentFilter !== ALL_OPTION) query = query.eq("buffer_agent", bufferAgentFilter);
    if (retentionAgentFilter.length > 0) query = query.in("retention_agent", retentionAgentFilter);
    if (licensedAgentFilter !== ALL_OPTION) query = query.eq("licensed_agent_account", licensedAgentFilter);
    if (leadVendorFilter !== ALL_OPTION) query = query.eq("lead_vendor", leadVendorFilter);
    if (statusFilter !== ALL_OPTION) query = query.eq("status", statusFilter);
    if (carrierFilter !== ALL_OPTION) query = query.eq("carrier", carrierFilter);
    if (callResultFilter !== ALL_OPTION) query = query.eq("call_result", callResultFilter);
    if (laCallbackFilter !== ALL_OPTION) query = query.eq("la_callback", laCallbackFilter);
    if (searchTerm) query = query.or(`insured_name.ilike.%${searchTerm}%,client_phone_number.ilike.%${searchTerm}%,submission_id.ilike.%${searchTerm}%`);
    const { data, error } = await query;
    if (error || !data?.length) return setToast({ message: error?.message || "No data to export", type: "error" });
    const headers = ["Submission ID", "Date", "Insured Name", "Lead Vendor", "Phone Number", "Buffer Agent", "Retention Agent", "Agent", "Licensed Agent", "Status", "Call Result", "Carrier", "Product Type", "Draft Date", "Monthly Premium", "Face Amount", "LA Callback", "Notes"];
    const csv = [headers.join(","), ...(data as DailyDealFlowRow[]).map((r) => [r.submission_id, r.date, r.insured_name, r.lead_vendor, r.client_phone_number, r.buffer_agent, r.retention_agent, r.agent, r.licensed_agent_account, r.status, r.call_result, r.carrier, r.product_type, r.draft_date, r.monthly_premium, r.face_amount, r.la_callback, String(r.notes || "").replace(/"/g, '""')].map((v) => `"${v ?? ""}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const suffix = dateFilter ? dateFilter : dateFromFilter || dateToFilter ? `${dateFromFilter || "start"}_${dateToFilter || "end"}` : dateObjectToESTString(new Date());
    a.download = `daily-deal-flow-${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: `Exported ${data.length} records`, type: "success" });
  };

  if (loading) {
    return <div style={{ padding: 20, color: T.textMuted }}>Loading Daily Deal Flow...</div>;
  }

  return (
    <div style={{ fontFamily: T.font, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.textDark }}>Daily Deal Flow</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {hasWritePermissions && (
            <DdfCreateEntryModal
              supabase={supabase}
              leadVendorOptions={leadVendorOptions}
              callCenterId={callCenterId}
              requireCallCenterId={isCallCenterScoped}
              onError={(message) => setToast({ message, type: "error" })}
              onSuccess={() => { setToast({ message: "Entry created successfully", type: "success" }); void fetchData(currentPage); }}
            />
          )}
          <Button variant="ghost" icon={<IconDownload size={14} />} onClick={handleExport}>Export</Button>
          <Button variant="ghost" icon={<IconRefresh size={14} />} onClick={() => void fetchData(1, true)} state={refreshing ? "loading" : "enabled"}>Refresh</Button>
        </div>
      </div>

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
          }}
        >
          Your profile is not linked to a call center. You cannot create Daily Deal Flow entries until an administrator assigns your center in Users.
        </div>
      )}

      <style>{`
        @keyframes stat-card-in {
          from { opacity: 0; transform: translateY(8px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {[
          {
            label: "TOTAL ENTRIES",
            value: totalRecords.toLocaleString(),
            color: T.blue,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>
            ),
          },
          {
            label: "VISIBLE PREMIUM",
            value: `$${visiblePremium.toLocaleString()}`,
            color: T.memberAmber,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            ),
          },
          {
            label: "AVG PREMIUM",
            value: `$${visibleAveragePremium.toFixed(0)}`,
            color: T.memberPink,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
            ),
          },
          {
            label: "ACTIVE CARRIERS",
            value: activeCarriers.toString(),
            color: T.memberTeal,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></svg>
            ),
          },
        ].map(({ label, value, color, icon }, index) => (
          <div
            key={label}
            style={{
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
              animationDelay: `${index * 50}ms`,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</span>
              <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            </div>
            <div
              style={{
                color,
                backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                width: 54,
                height: 54,
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
          </div>
        ))}
      </div>

      <DdfToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        dateFilter={dateFilter}
        dateFromFilter={dateFromFilter}
        dateToFilter={dateToFilter}
        onDateFilterChange={(value) => { setDateFilter(value); if (value) { setDateFromFilter(""); setDateToFilter(""); } }}
        onDateFromFilterChange={(value) => { setDateFromFilter(value); if (value || dateToFilter) setDateFilter(""); }}
        onDateToFilterChange={(value) => { setDateToFilter(value); if (value || dateFromFilter) setDateFilter(""); }}
        bufferAgentFilter={bufferAgentFilter}
        onBufferAgentFilterChange={setBufferAgentFilter}
        retentionAgentFilter={retentionAgentFilter}
        onRetentionAgentFilterChange={setRetentionAgentFilter}
        licensedAgentFilter={licensedAgentFilter}
        onLicensedAgentFilterChange={setLicensedAgentFilter}
        leadVendorFilter={leadVendorFilter}
        onLeadVendorFilterChange={setLeadVendorFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        carrierFilter={carrierFilter}
        onCarrierFilterChange={setCarrierFilter}
        callResultFilter={callResultFilter}
        onCallResultFilterChange={setCallResultFilter}
        retentionFilter={retentionFilter}
        onRetentionFilterChange={setRetentionFilter}
        incompleteUpdatesFilter={incompleteUpdatesFilter}
        onIncompleteUpdatesFilterChange={setIncompleteUpdatesFilter}
        laCallbackFilter={laCallbackFilter}
        onLaCallbackFilterChange={setLaCallbackFilter}
        hourFromFilter={hourFromFilter}
        hourToFilter={hourToFilter}
        onHourFromFilterChange={setHourFromFilter}
        onHourToFilterChange={setHourToFilter}
        bufferOptions={bufferAgentOptions}
        retentionOptions={RETENTION_AGENT_OPTIONS.filter((v) => !v.toLowerCase().includes("all"))}
        licensedOptions={LICENSED_ACCOUNT_OPTIONS}
        vendorOptions={leadVendorOptions}
        statusOptions={STATUS_OPTIONS}
        carrierOptions={CARRIER_OPTIONS}
        callResultOptions={CALL_RESULT_OPTIONS}
        laCallbackOptions={LA_CALLBACK_OPTIONS}
        totalRows={totalRecords}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No daily deal entries yet"
          description={
            isCallCenterScoped
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
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
