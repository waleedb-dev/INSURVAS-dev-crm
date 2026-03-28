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
  const [hasWritePermissions, setHasWritePermissions] = useState(false);
  const [callCenterId, setCallCenterId] = useState<string | null>(null);
  const [callCenterName, setCallCenterName] = useState<string | null>(null);
  const [leadVendorOptions, setLeadVendorOptions] = useState<string[]>([]);
  const [bufferAgentOptions, setBufferAgentOptions] = useState<string[]>([]);

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
          <p style={{ margin: "4px 0 0", color: T.textMuted, fontSize: 13 }}>
            {isCallCenterScoped
              ? `Showing entries for your call center only${callCenterName ? ` (${callCenterName})` : ""}. Vendor and buffer filters list values from your center's data.`
              : "Manage and edit daily deal flow data in real-time."}
          </p>
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
