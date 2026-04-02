"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/shadcn/table";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Search, Filter, Plus, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Policy = {
  id: number;
  policy_number: string | null;
  deal_name: string | null;
  policy_status: string | null;
  policy_type: string | null;
  sales_agent: string | null;
  carrier: string | null;
  call_center: string | null;
  commission_type: string | null;
  deal_value: number | null;
  effective_date: string | null;
  status: string | null;
  is_active: boolean;
  lock_status: string | null;
  created_at: string;
  updated_at: string;
};

const LOCK_COLORS: Record<string, { bg: string; color: string }> = {
  pending:  { bg: "#fffbeb", color: "#d97706" },
  locked:   { bg: "#fef2f2", color: "#3b5229" },
  unlocked: { bg: "#ecfdf5", color: "#059669" },
};

const ITEMS_PER_PAGE = 100;

const ALL_OPTION = "All";

function mapOpts(values: string[]) {
  return [{ value: ALL_OPTION, label: "All" }, ...values.map((v) => ({ value: v, label: v }))];
}

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
          color: value && value !== ALL_OPTION ? T.textDark : T.textMuted,
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
          {value && value !== ALL_OPTION
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
          zIndex: 99999,
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

const ACTIVE_OPTS = [
  { value: ALL_OPTION, label: "All" },
  { value: "active",   label: "Active Only" },
  { value: "inactive", label: "Inactive Only" },
];

export default function PoliciesPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState(ALL_OPTION);
  const [carrierFilter, setCarrierFilter] = useState(ALL_OPTION);
  const [agentFilter, setAgentFilter] = useState(ALL_OPTION);
  const [typeFilter, setTypeFilter] = useState(ALL_OPTION);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("policies")
      .select("id, policy_number, deal_name, policy_status, policy_type, sales_agent, carrier, call_center, commission_type, deal_value, effective_date, status, is_active, lock_status, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) { setLoadError(error.message); setRows([]); }
    else { setRows((data || []) as Policy[]); }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void loadRows(); }, [loadRows]);
  useEffect(() => { setPage(1); }, [search, activeFilter, carrierFilter, agentFilter, typeFilter, fromDate, toDate]);

  const carrierOptions = useMemo(() => {
    const vals = [...new Set(rows.map((r) => r.carrier).filter(Boolean))] as string[];
    return mapOpts(vals);
  }, [rows]);

  const agentOptions = useMemo(() => {
    const vals = [...new Set(rows.map((r) => r.sales_agent).filter(Boolean))] as string[];
    return mapOpts(vals);
  }, [rows]);

  const typeOptions = useMemo(() => {
    const vals = [...new Set(rows.map((r) => r.policy_type).filter(Boolean))] as string[];
    return mapOpts(vals);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (q && !(
        (r.policy_number || "").toLowerCase().includes(q) ||
        (r.deal_name || "").toLowerCase().includes(q) ||
        (r.sales_agent || "").toLowerCase().includes(q) ||
        (r.carrier || "").toLowerCase().includes(q)
      )) return false;
      if (activeFilter === "active" && !r.is_active) return false;
      if (activeFilter === "inactive" && r.is_active) return false;
      if (carrierFilter !== ALL_OPTION && r.carrier !== carrierFilter) return false;
      if (agentFilter !== ALL_OPTION && r.sales_agent !== agentFilter) return false;
      if (typeFilter !== ALL_OPTION && r.policy_type !== typeFilter) return false;
      const effDate = r.effective_date ? r.effective_date.slice(0, 10) : r.created_at.slice(0, 10);
      if (fromDate && effDate < fromDate) return false;
      if (toDate && effDate > toDate) return false;
      return true;
    });
  }, [rows, search, activeFilter, carrierFilter, agentFilter, typeFilter, fromDate, toDate]);

  const hasFilters = search !== "" || activeFilter !== ALL_OPTION || carrierFilter !== ALL_OPTION || agentFilter !== ALL_OPTION || typeFilter !== ALL_OPTION || fromDate !== "" || toDate !== "";
  const clearFilters = () => { setSearch(""); setActiveFilter(ALL_OPTION); setCarrierFilter(ALL_OPTION); setAgentFilter(ALL_OPTION); setTypeFilter(ALL_OPTION); setFromDate(""); setToDate(""); };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalDealValue = useMemo(
    () => filtered.reduce((sum, row) => sum + (Number(row.deal_value) || 0), 0),
    [filtered],
  );
  const activePolicies = useMemo(
    () => filtered.filter((row) => row.is_active).length,
    [filtered],
  );
  const activeCarriers = useMemo(
    () => new Set(filtered.map((row) => String(row.carrier || "").trim()).filter(Boolean)).size,
    [filtered],
  );

  const hasActiveFilters = activeFilter !== ALL_OPTION || carrierFilter !== ALL_OPTION || agentFilter !== ALL_OPTION || typeFilter !== ALL_OPTION || fromDate !== "" || toDate !== "";
  const activeFilterCount = [
    activeFilter !== ALL_OPTION,
    carrierFilter !== ALL_OPTION,
    agentFilter !== ALL_OPTION,
    typeFilter !== ALL_OPTION,
    fromDate !== "",
    toDate !== "",
  ].filter(Boolean).length;

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
    if (filtered.length === 0 && page !== 1) setPage(1);
  }, [filtered.length, page, totalPages]);

  return (
    <div onClick={() => {}} style={{ fontFamily: T.font, padding: "0", animation: "fadeIn 0.3s ease-out" }}>

      {loadError && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
          {loadError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          [
            { label: "Total Policies", value: filtered.length.toLocaleString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
              ) },
            { label: "Active Policies", value: activePolicies.toLocaleString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
              ) },
            { label: "Total Deal Value", value: `$${totalDealValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              ) },
            { label: "Active Carriers", value: activeCarriers.toLocaleString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
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
                placeholder="Search policies by number, deal, agent, carrier..."
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
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

            <button
              onClick={() => void loadRows()}
              disabled={loading}
              style={{
                height: 38,
                padding: "0 16px",
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: T.pageBg,
                color: T.textDark,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: T.font,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: loading ? 0.6 : 1,
                transition: "all 0.15s ease-in-out",
              }}
            >
              <RefreshCw size={16} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
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
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Effective From</div>
                  <input 
                    type="date" 
                    value={fromDate} 
                    onChange={(e) => setFromDate(e.target.value)} 
                    style={{ 
                      width: "100%", 
                      height: 38, 
                      border: `1px solid ${T.border}`, 
                      borderRadius: 10, 
                      fontSize: 13, 
                      color: T.textDark, 
                      padding: "0 12px",
                      backgroundColor: T.cardBg,
                      outline: "none",
                      fontFamily: T.font,
                    }} 
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Effective To</div>
                  <input 
                    type="date" 
                    value={toDate} 
                    onChange={(e) => setToDate(e.target.value)} 
                    style={{ 
                      width: "100%", 
                      height: 38, 
                      border: `1px solid ${T.border}`, 
                      borderRadius: 10, 
                      fontSize: 13, 
                      color: T.textDark, 
                      padding: "0 12px",
                      backgroundColor: T.cardBg,
                      outline: "none",
                      fontFamily: T.font,
                    }} 
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Active Status</div>
                  <StyledSelect
                    value={activeFilter}
                    onValueChange={setActiveFilter}
                    options={ACTIVE_OPTS}
                    placeholder="All"
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
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Agent</div>
                  <StyledSelect
                    value={agentFilter}
                    onValueChange={setAgentFilter}
                    options={agentOptions}
                    placeholder="All Agents"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Policy Type</div>
                  <StyledSelect
                    value={typeFilter}
                    onValueChange={setTypeFilter}
                    options={typeOptions}
                    placeholder="All Types"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {activeFilter !== ALL_OPTION && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                        Status: {activeFilter}
                        <button onClick={() => setActiveFilter(ALL_OPTION)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
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
                    {agentFilter !== ALL_OPTION && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                        Agent: {agentFilter}
                        <button onClick={() => setAgentFilter(ALL_OPTION)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    )}
                    {typeFilter !== ALL_OPTION && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                        Type: {typeFilter}
                        <button onClick={() => setTypeFilter(ALL_OPTION)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    )}
                    {fromDate !== "" && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                        From: {fromDate}
                        <button onClick={() => setFromDate("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    )}
                    {toDate !== "" && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                        To: {toDate}
                        <button onClick={() => setToDate("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
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

      <div
        style={{
          borderRadius: 16,
          border: `1px solid ${T.border}`,
          overflow: "hidden",
          backgroundColor: T.cardBg,
        }}
      >
        {loading ? (
          <div
            style={{
              padding: "80px 40px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
            }}
          >
            <LoadingSpinner size={48} label="Loading policies..." />
          </div>
        ) : paginated.length === 0 ? (
          <div
            style={{
              padding: "60px 40px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>{rows.length === 0 ? "No policy records yet" : "No matching records"}</div>
            <div style={{ fontSize: 14, color: T.textMid }}>{rows.length === 0 ? "Policy records will appear here once synced." : "Try adjusting your search or filter criteria."}</div>
          </div>
        ) : (
          <>
            <div
              style={{
                borderBottom: `1px solid ${T.border}`,
                overflow: "hidden",
                backgroundColor: T.cardBg,
              }}
            >
              <ShadcnTable>
                <TableHeader style={{ backgroundColor: "#233217" }}>
                  <TableRow style={{ borderBottom: "none" }} className="hover:bg-transparent">
                    {[
                      { label: "S.No", align: "left" as const },
                      { label: "Policy #", align: "left" as const },
                      { label: "Deal Name", align: "left" as const },
                      { label: "Agent", align: "left" as const },
                      { label: "Carrier", align: "left" as const },
                      { label: "Type", align: "left" as const },
                      { label: "Deal Value", align: "right" as const },
                      { label: "Status", align: "left" as const },
                      { label: "Lock", align: "left" as const },
                      { label: "Active", align: "center" as const },
                      { label: "Effective", align: "left" as const },
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
                  {paginated.map((r, i) => (
                    <TableRow 
                      key={r.id}
                      style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                      className="hover:bg-muted/30 transition-all duration-150"
                    >
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.textMuted }}>{(page - 1) * ITEMS_PER_PAGE + i + 1}</span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#233217", fontFamily: "monospace" }}>{r.policy_number || "—"}</span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: T.textDark }}>{r.deal_name || "—"}</span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 13, color: T.textMid, fontWeight: 500 }}>{r.sales_agent || "—"}</span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        {r.carrier ? (
                          <span style={{ 
                            display: "inline-flex", 
                            alignItems: "center", 
                            padding: "4px 10px", 
                            borderRadius: 6, 
                            backgroundColor: "#DCEBDC", 
                            color: "#233217", 
                            fontSize: 11, 
                            fontWeight: 700 
                          }}>
                            {r.carrier}
                          </span>
                        ) : (
                          <span style={{ color: T.textMuted, fontSize: 13 }}>—</span>
                        )}
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 12, color: T.textMid, fontWeight: 500 }}>{r.policy_type || "—"}</span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px", textAlign: "right" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: T.textDark }}>
                          {r.deal_value != null ? `$${r.deal_value.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                        </span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        {r.policy_status ? (
                          <span style={{ 
                            display: "inline-flex", 
                            alignItems: "center", 
                            padding: "4px 10px", 
                            borderRadius: 6, 
                            backgroundColor: "#f0f9ff", 
                            color: "#0369a1", 
                            fontSize: 11, 
                            fontWeight: 700 
                          }}>
                            {r.policy_status}
                          </span>
                        ) : (
                          <span style={{ color: T.textMuted, fontSize: 13 }}>—</span>
                        )}
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        {(() => {
                          const ls = r.lock_status || "pending";
                          const lc = LOCK_COLORS[ls] ?? { bg: "#f3f4f6", color: "#6b7a5f" };
                          return (
                            <span style={{ 
                              display: "inline-flex", 
                              alignItems: "center", 
                              padding: "4px 10px", 
                              borderRadius: 6, 
                              backgroundColor: lc.bg, 
                              color: lc.color, 
                              fontSize: 11, 
                              fontWeight: 700 
                            }}>
                              {ls.charAt(0).toUpperCase() + ls.slice(1)}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px", textAlign: "center" }}>
                        <span style={{ 
                          display: "inline-flex", 
                          alignItems: "center", 
                          gap: 6,
                          padding: "4px 10px",
                          borderRadius: 999,
                          backgroundColor: r.is_active ? "#dcfce7" : "#f3f4f6",
                          color: r.is_active ? "#166534" : "#6b7a5f",
                          fontSize: 11,
                          fontWeight: 700
                        }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: r.is_active ? "#22c55e" : "#9ca3af" }}/>
                          {r.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>
                          {r.effective_date ? new Date(r.effective_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </ShadcnTable>
            </div>

            <div
              style={{
                backgroundColor: T.cardBg,
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: `1px solid ${T.border}`,
              }}
            >
              <span style={{ fontSize: 13, color: "#233217", fontWeight: 500 }}>
                Showing {paginated.length} of {filtered.length.toLocaleString()} policies
              </span>
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{
                      height: 32,
                      width: 32,
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      background: T.cardBg,
                      color: page === 1 ? T.textMuted : T.textDark,
                      cursor: page === 1 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                  <span style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    style={{
                      height: 32,
                      width: 32,
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      background: T.cardBg,
                      color: page === totalPages ? T.textMuted : T.textDark,
                      cursor: page === totalPages ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}