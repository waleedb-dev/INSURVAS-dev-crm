"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Calendar, ChevronDown, LayoutDashboard, Phone, Clock, FileCheck, CheckCircle, AlertTriangle, XCircle, FileText } from "lucide-react";
import type { DailyDealFlowRow } from "./daily-deal-flow/types";

// ── Types ────────────────────────────────────────────────────────────────────

type DatePreset = "today" | "yesterday" | "7" | "30" | "custom";

interface ScoreStats {
  totalTransfers: number;
  pendingApproval: number;
  underwriting: number;
  approved: number;
  giCurrentlyDq: number;
  approvalRate: number;
  callbackRate: number;
  dqRate: number;
  underwritingRate: number;
  approvalDenom: number;
  callbackDenom: number;
  callbackDenomTotal: number;
  dqDenom: number;
  underwritingDenom: number;
  totalTransfersTrend: number;
  pendingApprovalTrend: number;
  underwritingTrend: number;
  approvedTrend: number;
  giCurrentlyDqTrend: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getPresetRange(preset: DatePreset): { start: Date; end: Date; label: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return { start: today, end: today, label: "Today" };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { start: y, end: y, label: "Yesterday" };
    }
    case "7": {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return { start: s, end: today, label: "Last 7 Days" };
    }
    case "30": {
      const s = new Date(today);
      s.setDate(s.getDate() - 29);
      return { start: s, end: today, label: "Last 30 Days" };
    }
    case "custom":
    default:
      return { start: today, end: today, label: formatDate(today) };
  }
}

function getPreviousPeriod(start: Date, end: Date): { start: Date; end: Date } {
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { start: prevStart, end: prevEnd };
}

function computeTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function normalize(val: string | null | undefined): string {
  return (val ?? "").trim().replace(/\s+/g, " ");
}

function isExactMatch(val: string | null | undefined, target: string): boolean {
  return normalize(val) === target;
}

function computeStats(rows: DailyDealFlowRow[]): Omit<ScoreStats, "totalTransfersTrend" | "pendingApprovalTrend" | "underwritingTrend" | "approvedTrend" | "giCurrentlyDqTrend"> {
  // Match BPO Portal AnalyticsRates - exact string match (no trimming)
  const underwriting = rows.filter((r) => r.call_result === "Underwriting").length;
  const approved = rows.filter((r) => r.call_result === "Submitted").length;
  // Pending Approval = Underwriting + Approved (pipeline count)
  const pendingApproval = underwriting + approved;

  // DQ statuses matching BPO Portal exactly
  const dqStatuses = new Set([
    "Returned To Center - DQ",
    "DQ'd Can't be sold",
    "GI - Currently DQ",
  ]);
  const dqRows = rows.filter(
    (r) => dqStatuses.has(r.status ?? "") || (r.status?.includes("DQ") ?? false)
  );

  // GI DQ - exact match (BPO Portal uses "GI - Currently DQ" with hyphen)
  const giDqStatuses = new Set(["GI - Currently DQ", "GI DQ"]);
  const giCurrentlyDq = rows.filter((r) => giDqStatuses.has(r.status ?? "")).length;

  // Callback = needs BPO Callback + Incomplete Transfer
  const needsCallbackCount = rows.filter(
    (r) => r.status === "Needs BPO Callback" || r.status === "Incomplete Transfer"
  ).length;

  const totalTransfers = rows.length;
  // Non-pending = total minus pending
  const nonPendingCount = totalTransfers - pendingApproval;

  // Rates:
  // Approval Rate = Approved / Total Transfers
  // Callback Rate = (Needs BPO Callback + Incomplete) / (Total - Pending)
  // DQ Rate = DQ count / (Total - Pending)
  // Underwriting Rate = Underwriting / Total Transfers
  const approvalRate = totalTransfers > 0 ? Math.round((approved / totalTransfers) * 100) : 0;
  // Callback Rate = (Needs BPO Callback + Incomplete) / (Total - Approved) * 100
  const callbackDenomTotal = totalTransfers - approved;
  const callbackRate = callbackDenomTotal > 0 ? Math.round((needsCallbackCount / callbackDenomTotal) * 100) : 0;
  const dqRate = callbackDenomTotal > 0 ? Math.round((dqRows.length / callbackDenomTotal) * 100) : 0;
  const underwritingRate = callbackDenomTotal > 0 ? Math.round((underwriting / callbackDenomTotal) * 100) : 0;

  return {
    totalTransfers,
    pendingApproval,
    underwriting,
    approved,
    giCurrentlyDq,
    approvalRate,
    callbackRate,
    dqRate,
    underwritingRate,
    approvalDenom: approved,
    callbackDenom: needsCallbackCount,
    callbackDenomTotal,
    dqDenom: dqRows.length,
    underwritingDenom: underwriting,
  };
}

// ── Icons ────────────────────────────────────────────────────────────────────

const TrendBadge = ({ value }: { value: number }) => {
  const isPositive = value >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: "2px 8px",
        borderRadius: 6,
        backgroundColor: isPositive ? "#dcfce7" : "#fee2e2",
        color: isPositive ? "#166534" : "#991b1b",
        fontSize: 11,
        fontWeight: 700,
        marginLeft: 8,
      }}
    >
      {isPositive ? "+" : ""}
      {value}%
    </span>
  );
};

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  trend,
  icon,
  iconBg,
  iconColor,
  hovered,
  onHover,
}: {
  label: string;
  value: number;
  trend: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  hovered: boolean;
  onHover: (v: boolean) => void;
}) {
  return (
    <Card
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        background: T.cardBg,
        boxShadow: hovered ? "0 14px 40px rgba(28, 32, 26, 0.08), 0 4px 14px rgba(28, 32, 26, 0.05)" : "0 4px 12px rgba(0,0,0,0.03)",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        transition: "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
        padding: "24px",
        minHeight: 120,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 16,
        cursor: "default",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: iconColor,
          flexShrink: 0,
          transition: "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
          transform: hovered ? "scale(1.04)" : "scale(1)",
        }}
      >
        {icon}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#647864", letterSpacing: "0.45px", textTransform: "uppercase", lineHeight: 1.25 }}>
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#233217", lineHeight: 1.05 }}>{value}</span>
          <TrendBadge value={trend} />
        </div>
      </div>
    </Card>
  );
}

function RateCard({
  label,
  rate,
  denom,
  total,
  color,
  icon,
  iconBg,
  iconColor,
  hovered,
  onHover,
}: {
  label: string;
  rate: number;
  denom: number;
  total: number;
  color: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  hovered: boolean;
  onHover: (v: boolean) => void;
}) {
  return (
    <Card
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        background: T.cardBg,
        boxShadow: hovered ? "0 14px 40px rgba(28, 32, 26, 0.08), 0 4px 14px rgba(28, 32, 26, 0.05)" : "0 4px 12px rgba(0,0,0,0.03)",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        transition: "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
        padding: "24px",
        minHeight: 140,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 16,
        cursor: "default",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#647864", letterSpacing: "0.45px", textTransform: "uppercase", lineHeight: 1.25 }}>
            {label}
          </span>
          <span style={{ fontSize: 32, fontWeight: 800, color: "#233217", lineHeight: 1.05 }}>{rate}%</span>
        </div>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: iconColor,
            flexShrink: 0,
            transition: "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
            transform: hovered ? "scale(1.04)" : "scale(1)",
          }}
        >
          {icon}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#647864" }}>
            {denom} of {total}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#647864" }}>{rate.toFixed(1)}%</span>
        </div>
        <div style={{ width: "100%", height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.min(rate, 100)}%`,
              height: "100%",
              backgroundColor: color,
              borderRadius: 3,
              transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </div>
      </div>
    </Card>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ColombianScoreBoardPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [noCentersConfigured, setNoCentersConfigured] = useState(false);
  const [rows, setRows] = useState<DailyDealFlowRow[]>([]);
  const [prevRows, setPrevRows] = useState<DailyDealFlowRow[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const today = new Date();
    const last7 = new Date(today);
    last7.setDate(last7.getDate() - 6);
    return formatDateForInput(last7);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => formatDateForInput(new Date()));
  const [appliedRange, setAppliedRange] = useState<{ start: Date; end: Date; label: string }>(getPresetRange("today"));
  const [retentionStats, setRetentionStats] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [hoveredKeyCard, setHoveredKeyCard] = useState<number | null>(null);
  const [hoveredRateCard, setHoveredRateCard] = useState<number | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDateDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchData = useCallback(
    async (start: Date, end: Date) => {
      setLoading(true);
      setNoCentersConfigured(false);

      // Step 1: Get Colombian centers
      const { data: centers, error: centersError } = await supabase
        .from("call_centers")
        .select("name")
        .eq("country", "Colombia");

      if (centersError) {
        console.error("[ColombianScoreBoard] centers error:", centersError);
        setRows([]);
        setPrevRows([]);
        setLoading(false);
        return;
      }

      const centerNames = (centers || []).map((c) => c.name).filter(Boolean) as string[];
      if (centerNames.length === 0) {
        console.log("[ColombianScoreBoard] No Colombian centers found");
        setNoCentersConfigured(true);
        setRows([]);
        setPrevRows([]);
        setLoading(false);
        return;
      }

      // Step 2: Get active thresholds for those centers
      const { data: thresholds, error: thresholdsError } = await supabase
        .from("center_thresholds")
        .select("lead_vendor")
        .in("center_name", centerNames)
        .eq("is_active", true);

      if (thresholdsError) {
        console.error("[ColombianScoreBoard] thresholds error:", thresholdsError);
        setRows([]);
        setPrevRows([]);
        setLoading(false);
        return;
      }

      const colombianLeadVendors = [...new Set((thresholds || []).map((t) => t.lead_vendor).filter(Boolean))] as string[];
      if (colombianLeadVendors.length === 0) {
        console.log("[ColombianScoreBoard] No active thresholds for Colombian centers");
        setNoCentersConfigured(true);
        setRows([]);
        setPrevRows([]);
        setLoading(false);
        return;
      }

      console.log("[ColombianScoreBoard] Colombian lead vendors:", colombianLeadVendors);

      const fromStr = formatDateForInput(start);
      const toStr = formatDateForInput(end);

      console.log("[ColombianScoreBoard] Fetching data from:", fromStr, "to:", toStr);

      let query = supabase.from("daily_deal_flow").select("*");
      query = query.gte("date", fromStr);
      query = query.lte("date", toStr);
      query = query.in("lead_vendor", colombianLeadVendors);

      console.log("[ColombianScoreBoard] Query built - date range:", fromStr, "to", toStr);

      const { data, error, count } = await query;
      console.log("[ColombianScoreBoard] Main query result - count:", count, "rows:", data?.length, "error:", error);
      if (error) {
        console.error("[ColombianScoreBoard] fetch error:", error);
        setRows([]);
      } else {
        console.log("[ColombianScoreBoard] Raw rows from DB:", data?.length);
        console.log("[ColombianScoreBoard] All statuses in result:", [...new Set((data || []).map(r => JSON.stringify(r.status)))].filter(Boolean));
        console.log("[ColombianScoreBoard] All unique status+call_result combos:", [...new Set((data || []).map(r => JSON.stringify({ status: r.status, call_result: r.call_result })))].filter(Boolean));
        console.log("[ColombianScoreBoard] Rows with non-empty retention_agent:", (data || []).filter((r: any) => r.retention_agent && String(r.retention_agent).trim() !== "").length);
        setRows((data || []) as DailyDealFlowRow[]);
      }

      // Fetch previous period for trends
      const { start: prevStart, end: prevEnd } = getPreviousPeriod(start, end);
      const prevFromStr = formatDateForInput(prevStart);
      const prevToStr = formatDateForInput(prevEnd);

      console.log("[ColombianScoreBoard] Fetching prev period from:", prevFromStr, "to:", prevToStr);

      let prevQuery = supabase.from("daily_deal_flow").select("*");
      prevQuery = prevQuery.gte("date", prevFromStr);
      prevQuery = prevQuery.lte("date", prevToStr);
      prevQuery = prevQuery.in("lead_vendor", colombianLeadVendors);

      const { data: prevData, error: prevError, count: prevCount } = await prevQuery;
      console.log("[ColombianScoreBoard] Prev query result - count:", prevCount, "rows:", prevData?.length, "error:", prevError);
      if (prevError) {
        console.error("[ColombianScoreBoard] prev fetch error:", prevError);
        setPrevRows([]);
      } else {
        console.log("[ColombianScoreBoard] Prev rows from DB:", prevData?.length);
        setPrevRows((prevData || []) as DailyDealFlowRow[]);
      }

      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchData(appliedRange.start, appliedRange.end);
    }, 0);
    return () => clearTimeout(timeout);
  }, [appliedRange, fetchData]);

  const handlePresetSelect = (preset: DatePreset) => {
    if (preset === "custom") {
      setDatePreset("custom");
    } else {
      setDatePreset(preset);
      setAppliedRange(getPresetRange(preset));
      setShowDateDropdown(false);
    }
  };

  const handleApplyCustomRange = () => {
    if (customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      setAppliedRange({
        start,
        end,
        label: `${formatDate(start)} - ${formatDate(end)}`,
      });
      setShowDateDropdown(false);
    }
  };

  const currentStats = useMemo(() => computeStats(rows), [rows]);
  const previousStats = useMemo(() => computeStats(prevRows), [prevRows]);

  const stats: ScoreStats = useMemo(() => {
    return {
      ...currentStats,
      totalTransfersTrend: computeTrend(currentStats.totalTransfers, previousStats.totalTransfers),
      pendingApprovalTrend: computeTrend(currentStats.pendingApproval, previousStats.pendingApproval),
      underwritingTrend: computeTrend(currentStats.underwriting, previousStats.underwriting),
      approvedTrend: computeTrend(currentStats.approved, previousStats.approved),
      giCurrentlyDqTrend: computeTrend(currentStats.giCurrentlyDq, previousStats.giCurrentlyDq),
    };
  }, [currentStats, previousStats]);

  const dateDisplay = datePreset === "custom" ? appliedRange.label : appliedRange.label;

  // Key metrics definitions
  const keyMetrics = [
    {
      label: "Total Transfers",
      value: stats.totalTransfers,
      trend: stats.totalTransfersTrend,
      icon: <LayoutDashboard size={20} />,
      iconBg: "#dcfce7",
      iconColor: "#166534",
    },
    {
      label: "Pending Approval",
      value: stats.pendingApproval,
      trend: stats.pendingApprovalTrend,
      icon: <Clock size={20} />,
      iconBg: "#fef3c7",
      iconColor: "#b45309",
    },
    {
      label: "Underwriting",
      value: stats.underwriting,
      trend: stats.underwritingTrend,
      icon: <FileText size={20} />,
      iconBg: "#dbeafe",
      iconColor: "#1e40af",
    },
    {
      label: "Approved",
      value: stats.approved,
      trend: stats.approvedTrend,
      icon: <CheckCircle size={20} />,
      iconBg: "#dcfce7",
      iconColor: "#166534",
    },
    {
      label: "GI-Currently DQ",
      value: stats.giCurrentlyDq,
      trend: stats.giCurrentlyDqTrend,
      icon: <AlertTriangle size={20} />,
      iconBg: "#fee2e2",
      iconColor: "#991b1b",
    },
  ];

  const rateMetrics = [
    {
      label: "Approval Rate",
      rate: stats.approvalRate,
      denom: stats.approvalDenom,
      total: stats.totalTransfers,
      color: "#22c55e",
      icon: <CheckCircle size={20} />,
      iconBg: "#dcfce7",
      iconColor: "#166534",
    },
    {
      label: "Callback Rate",
      rate: stats.callbackRate,
      denom: stats.callbackDenom,
      total: stats.callbackDenomTotal,
      color: "#3b82f6",
      icon: <Phone size={20} />,
      iconBg: "#dbeafe",
      iconColor: "#1e40af",
    },
    {
      label: "DQ Rate",
      rate: stats.dqRate,
      denom: stats.dqDenom,
      total: stats.callbackDenomTotal,
      color: "#ef4444",
      icon: <XCircle size={20} />,
      iconBg: "#fee2e2",
      iconColor: "#991b1b",
    },
    {
      label: "Underwriting",
      rate: stats.underwritingRate,
      denom: stats.underwritingDenom,
      total: stats.callbackDenomTotal,
      color: "#f59e0b",
      icon: <FileCheck size={20} />,
      iconBg: "#fef3c7",
      iconColor: "#b45309",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingBottom: 24 }}>
      {/* Page Title */}
      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#233217", margin: 0 }}>
        Colombian Centers Score Board
      </h1>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }} ref={dropdownRef}>
          {/* Date picker */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowDateDropdown((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 40,
                padding: "0 14px",
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                background: T.cardBg,
                color: T.textDark,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: T.font,
                cursor: "pointer",
                transition: "all 0.15s ease-in-out",
              }}
            >
              <Calendar size={16} color="#647864" />
              <span>{dateDisplay}</span>
              <ChevronDown size={14} color="#647864" style={{ transform: showDateDropdown ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.18s" }} />
            </button>

            {showDateDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  backgroundColor: T.cardBg,
                  borderRadius: T.radiusXl,
                  boxShadow: T.shadowLg,
                  border: `1px solid ${T.border}`,
                  padding: "16px",
                  minWidth: 320,
                  zIndex: 101,
                }}
              >
                {datePreset !== "custom" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {[
                      { value: "today" as DatePreset, label: "Today" },
                      { value: "yesterday" as DatePreset, label: "Yesterday" },
                      { value: "7" as DatePreset, label: "Last 7 Days" },
                      { value: "30" as DatePreset, label: "Last 30 Days" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handlePresetSelect(option.value)}
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "none",
                          backgroundColor: datePreset === option.value ? T.blueFaint : "transparent",
                          color: datePreset === option.value ? T.blue : T.textDark,
                          fontSize: 13,
                          fontWeight: datePreset === option.value ? 700 : 500,
                          borderRadius: T.radiusMd,
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 150ms",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                        onMouseEnter={(e) => {
                          if (datePreset !== option.value) {
                            e.currentTarget.style.backgroundColor = T.pageBg;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (datePreset !== option.value) {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }
                        }}
                      >
                        <span>{option.label}</span>
                        {datePreset === option.value && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                    <div style={{ height: 1, backgroundColor: T.border, margin: "8px 0" }} />
                    <button
                      onClick={() => handlePresetSelect("custom")}
                      style={{
                        width: "100%",
                        padding: "12px",
                        border: `1.5px dashed ${T.border}`,
                        backgroundColor: "transparent",
                        color: T.blue,
                        fontSize: 13,
                        fontWeight: 600,
                        borderRadius: T.radiusMd,
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 150ms",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = T.blue;
                        e.currentTarget.style.backgroundColor = T.blueFaint;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = T.border;
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      Custom Date Range...
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <button
                      onClick={() => setDatePreset("today")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        border: "none",
                        background: "none",
                        color: T.textMuted,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                      </svg>
                      Back to Presets
                    </button>
                    <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: T.textDark }}>Select Date Range</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Start Date</label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          max={customEndDate}
                          style={{
                            width: "100%",
                            padding: "10px",
                            border: `1.5px solid ${T.border}`,
                            borderRadius: T.radiusMd,
                            fontSize: 14,
                            fontFamily: "inherit",
                            color: T.textDark,
                            backgroundColor: T.cardBg,
                            outline: "none",
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>End Date</label>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          min={customStartDate}
                          max={formatDateForInput(new Date())}
                          style={{
                            width: "100%",
                            padding: "10px",
                            border: `1.5px solid ${T.border}`,
                            borderRadius: T.radiusMd,
                            fontSize: 14,
                            fontFamily: "inherit",
                            color: T.textDark,
                            backgroundColor: T.cardBg,
                            outline: "none",
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => setDatePreset("today")}
                        style={{
                          flex: 1,
                          padding: "10px",
                          border: `1.5px solid ${T.border}`,
                          backgroundColor: "transparent",
                          color: T.textMuted,
                          fontSize: 13,
                          fontWeight: 600,
                          borderRadius: T.radiusMd,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleApplyCustomRange}
                        disabled={!customStartDate || !customEndDate}
                        style={{
                          flex: 2,
                          padding: "10px",
                          border: "none",
                          backgroundColor: !customStartDate || !customEndDate ? T.border : "#233217",
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 700,
                          borderRadius: T.radiusMd,
                          cursor: !customStartDate || !customEndDate ? "not-allowed" : "pointer",
                          opacity: !customStartDate || !customEndDate ? 0.5 : 1,
                        }}
                      >
                        Apply Range
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Retention Stats Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#647864" }}>Retention Stats</span>
          <button
            onClick={() => setRetentionStats((v) => !v)}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              border: "none",
              backgroundColor: retentionStats ? "#233217" : "#c8d4bb",
              cursor: "pointer",
              position: "relative",
              transition: "background-color 0.2s ease-in-out",
              padding: 0,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                backgroundColor: "#fff",
                position: "absolute",
                top: 2,
                left: retentionStats ? 22 : 2,
                transition: "left 0.2s ease-in-out",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </button>
        </div>
      </div>

      {noCentersConfigured ? (
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
            gap: 16,
          }}
        >
          <AlertTriangle size={40} color="#b45309" />
          <span style={{ fontSize: 16, fontWeight: 600, color: T.textDark }}>No Colombian centers configured</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: T.textMuted, textAlign: "center" }}>
            Please add Colombian call centers and active thresholds to view this score board.
          </span>
        </div>
      ) : loading ? (
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
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: `3px solid ${T.border}`,
              borderTopColor: "#233217",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 500, color: T.textMuted }}>Loading Colombian Centers Score Board...</span>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#233217", margin: "0 0 20px" }}>Key Metrics</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 20 }}>
              {keyMetrics.map((metric, i) => (
                <StatCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  trend={metric.trend}
                  icon={metric.icon}
                  iconBg={metric.iconBg}
                  iconColor={metric.iconColor}
                  hovered={hoveredKeyCard === i}
                  onHover={(v) => setHoveredKeyCard(v ? i : null)}
                />
              ))}
            </div>
          </div>

          {/* Performance Rates */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#233217", margin: "0 0 20px" }}>Performance Rates</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20 }}>
              {rateMetrics.map((metric, i) => (
                <RateCard
                  key={metric.label}
                  label={metric.label}
                  rate={metric.rate}
                  denom={metric.denom}
                  total={metric.total}
                  color={metric.color}
                  icon={metric.icon}
                  iconBg={metric.iconBg}
                  iconColor={metric.iconColor}
                  hovered={hoveredRateCard === i}
                  onHover={(v) => setHoveredRateCard(v ? i : null)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
