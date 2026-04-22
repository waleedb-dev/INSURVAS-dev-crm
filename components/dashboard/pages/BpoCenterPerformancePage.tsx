"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Calendar, ChevronDown, AlertTriangle, MinusCircle, Award } from "lucide-react";
import type { DailyDealFlowRow } from "./daily-deal-flow/types";

// ── Types ────────────────────────────────────────────────────────────────────

type DatePreset = "today" | "yesterday" | "7" | "30" | "custom";

interface CenterThreshold {
  id: string;
  center_name: string;
  lead_vendor: string;
  tier: "A" | "B" | "C";
  daily_transfer_target: number;
  daily_sales_target: number;
  max_dq_percentage: number;
  min_approval_ratio: number;
  transfer_weight: number;
  approval_ratio_weight: number;
  dq_weight: number;
  underwriting_threshold: number;
  is_active: boolean;
}

interface CenterStats {
  center: CenterThreshold;
  transfers: number;
  pendingApproval: number;
  underwriting: number;
  approved: number;
  dqCount: number;
  dqRate: number;
  approvalRate: number;
  score: number;
  vsYesterday: number;
  trendDirection: "up" | "down" | "flat";
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

function computeCenterStats(
  rows: DailyDealFlowRow[],
  thresholds: CenterThreshold[],
  prevRows: DailyDealFlowRow[]
): CenterStats[] {
  const stats: CenterStats[] = [];

  for (const center of thresholds) {
    if (!center.is_active) continue;

    const centerRows = rows.filter((r) => r.lead_vendor === center.lead_vendor);
    const prevCenterRows = prevRows.filter((r) => r.lead_vendor === center.lead_vendor);

    const transfers = centerRows.length;
    const pendingApproval = centerRows.filter((r) => r.status === "Pending Approval").length;
    const underwriting = centerRows.filter((r) => r.call_result === "Underwriting").length;
    const approved = centerRows.filter((r) => r.call_result === "Submitted").length;

    const dqRows = centerRows.filter(
      (r) =>
        r.status === "Returned To Center - DQ" ||
        r.status === "DQ'd Can't be sold" ||
        r.status === "GI - Currently DQ" ||
        (r.status?.includes("DQ") ?? false)
    );
    const dqCount = dqRows.length;

    const nonPending = transfers - pendingApproval;
    const dqRate = nonPending > 0 ? Math.round((dqCount / nonPending) * 100) : 0;
    const approvalRate = transfers > 0 ? Math.round((pendingApproval / transfers) * 100) : 0;

    // Score calculation based on thresholds
    let score = 0;
    const transferPct = center.daily_transfer_target > 0 ? Math.min(transfers / center.daily_transfer_target, 1) : 0;
    const approvalPct = center.min_approval_ratio > 0 ? Math.min(approvalRate / center.min_approval_ratio, 1) : 0;
    const dqPct = center.max_dq_percentage > 0 ? Math.min(Math.max(1 - dqRate / center.max_dq_percentage, 0), 1) : 0;

    score = Math.round(
      (transferPct * center.transfer_weight) +
      (approvalPct * center.approval_ratio_weight) +
      (dqPct * center.dq_weight)
    );

    // vs Yesterday
    const prevTransfers = prevCenterRows.length;
    const vsYesterday = prevTransfers > 0 ? Math.round(((transfers - prevTransfers) / prevTransfers) * 100) : 0;
    const trendDirection = vsYesterday > 0 ? "up" : vsYesterday < 0 ? "down" : "flat";

    stats.push({
      center,
      transfers,
      pendingApproval,
      underwriting,
      approved,
      dqCount,
      dqRate,
      approvalRate,
      score,
      vsYesterday,
      trendDirection,
    });
  }

  // Sort by score descending
  return stats.sort((a, b) => b.score - a.score);
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CenterCard({ stat, borderColor }: { stat: CenterStats; borderColor: string }) {
  const tierColors: Record<string, string> = {
    A: "#22c55e",
    B: "#f59e0b",
    C: "#ef4444",
  };
  const tierBg: Record<string, string> = {
    A: "#dcfce7",
    B: "#fef3c7",
    C: "#fee2e2",
  };

  const targetPct = stat.center.daily_transfer_target > 0
    ? Math.round((stat.transfers / stat.center.daily_transfer_target) * 100)
    : 0;

  return (
    <Card
      style={{
        borderRadius: 16,
        border: `2px solid ${borderColor}`,
        background: T.cardBg,
        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minHeight: 220,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#233217" }}>{stat.center.center_name}</span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 6,
              backgroundColor: tierBg[stat.center.tier] || "#e5e7eb",
              color: tierColors[stat.center.tier] || "#6b7280",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Tier {stat.center.tier}
          </span>
        </div>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            backgroundColor: stat.score >= 80 ? "#dcfce7" : stat.score >= 50 ? "#fef3c7" : "#fee2e2",
            color: stat.score >= 80 ? "#166534" : stat.score >= 50 ? "#b45309" : "#991b1b",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Score: {stat.score}
        </span>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Transfers */}
        <div
          style={{
            backgroundColor: T.pageBg,
            borderRadius: 12,
            padding: "14px",
            border: `1px solid ${T.border}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#647864", textTransform: "uppercase" }}>
            Transfers
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 800, color: "#233217" }}>{stat.transfers}</p>
          <div style={{ marginTop: 8, width: "100%", height: 4, backgroundColor: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(targetPct, 100)}%`,
                height: "100%",
                backgroundColor: targetPct >= 100 ? "#22c55e" : targetPct >= 50 ? "#f59e0b" : "#ef4444",
                borderRadius: 2,
                transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 11, fontWeight: 600, color: "#647864" }}>
            {targetPct}% of target
          </p>
        </div>

        {/* Submissions */}
        <div
          style={{
            backgroundColor: T.pageBg,
            borderRadius: 12,
            padding: "14px",
            border: `1px solid ${T.border}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#647864", textTransform: "uppercase" }}>
            Submissions
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>{stat.pendingApproval}</p>
        </div>

        {/* DQ Rate */}
        <div
          style={{
            backgroundColor: T.pageBg,
            borderRadius: 12,
            padding: "14px",
            border: `1px solid ${T.border}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#647864", textTransform: "uppercase" }}>
            DQ Rate
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 800, color: stat.dqRate > stat.center.max_dq_percentage ? "#ef4444" : "#233217" }}>
            {stat.dqRate}%
          </p>
        </div>

        {/* Approval % */}
        <div
          style={{
            backgroundColor: T.pageBg,
            borderRadius: 12,
            padding: "14px",
            border: `1px solid ${T.border}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#647864", textTransform: "uppercase" }}>
            Approval %
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 800, color: stat.approvalRate >= stat.center.min_approval_ratio ? "#22c55e" : "#233217" }}>
            {stat.approvalRate}%
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
        <span style={{ fontSize: 12, color: "#647864", fontWeight: 600 }}>vs Yesterday</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: stat.trendDirection === "up" ? "#166534" : stat.trendDirection === "down" ? "#991b1b" : "#647864",
          }}
        >
          {stat.trendDirection === "up" ? "↗" : stat.trendDirection === "down" ? "↘" : "—"} {stat.vsYesterday}%
        </span>
      </div>
    </Card>
  );
}

function SectionHeader({
  icon,
  title,
  count,
  color,
  expanded,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  color: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: expanded ? 16 : 0,
        background: "none",
        border: "none",
        cursor: "pointer",
        width: "100%",
        padding: 0,
        textAlign: "left",
      }}
    >
      <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: color + "15", display: "flex", alignItems: "center", justifyContent: "center", color }}>
        {icon}
      </div>
      <span style={{ fontSize: 16, fontWeight: 700, color: "#233217" }}>{title}</span>
      <span
        style={{
          padding: "2px 10px",
          borderRadius: 12,
          backgroundColor: color + "15",
          color,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {count} Centers
      </span>
      <ChevronDown
        size={18}
        color="#647864"
        style={{
          marginLeft: "auto",
          transform: expanded ? "rotate(180deg)" : "rotate(0)",
          transition: "transform 0.2s ease",
        }}
      />
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function BpoCenterPerformancePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DailyDealFlowRow[]>([]);
  const [prevRows, setPrevRows] = useState<DailyDealFlowRow[]>([]);
  const [thresholds, setThresholds] = useState<CenterThreshold[]>([]);
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    top: true,
    needs: true,
    zero: true,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const fetchThresholds = useCallback(async () => {
    console.log("[BpoCenterPerformance] Fetching active thresholds...");
    const { data, error } = await supabase.from("center_thresholds").select("*").eq("is_active", true);
    if (error) {
      console.error("[BpoCenterPerformance] thresholds error:", error);
      setThresholds([]);
    } else {
      const active = (data || []) as CenterThreshold[];
      console.log("[BpoCenterPerformance] Thresholds fetched:", active.length, "active centers");
      console.log("[BpoCenterPerformance] Center names:", active.map((c) => ({ name: c.center_name, lead_vendor: c.lead_vendor, active: c.is_active })));
      setThresholds(active);
    }
  }, [supabase]);

  const fetchData = useCallback(
    async (start: Date, end: Date) => {
      setLoading(true);
      const fromStr = formatDateForInput(start);
      const toStr = formatDateForInput(end);

      // Fetch current period
      let query = supabase.from("daily_deal_flow").select("*");
      query = query.gte("date", fromStr);
      query = query.lte("date", toStr);

      const { data, error } = await query;
      if (error) {
        console.error("[BpoCenterPerformance] fetch error:", error);
        setRows([]);
      } else {
        setRows((data || []) as DailyDealFlowRow[]);
      }

      // Fetch previous period for comparison
      const durationMs = end.getTime() - start.getTime();
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - durationMs);
      const prevFromStr = formatDateForInput(prevStart);
      const prevToStr = formatDateForInput(prevEnd);

      let prevQuery = supabase.from("daily_deal_flow").select("*");
      prevQuery = prevQuery.gte("date", prevFromStr);
      prevQuery = prevQuery.lte("date", prevToStr);

      const { data: prevData, error: prevError } = await prevQuery;
      if (prevError) {
        console.error("[BpoCenterPerformance] prev fetch error:", prevError);
        setPrevRows([]);
      } else {
        setPrevRows((prevData || []) as DailyDealFlowRow[]);
      }

      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchThresholds();
    }, 0);
    return () => clearTimeout(timeout);
  }, [fetchThresholds]);

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
      setAppliedRange({ start, end, label: `${formatDate(start)} - ${formatDate(end)}` });
      setShowDateDropdown(false);
    }
  };

  const centerStats = useMemo(() => computeCenterStats(rows, thresholds, prevRows), [rows, thresholds, prevRows]);

  const topPerformers = centerStats.filter((s) => s.score >= 80);
  const needsImprovement = centerStats.filter((s) => s.score < 80 && s.transfers > 0);
  const zeroTransfer = centerStats.filter((s) => s.transfers === 0);

  const dateDisplay = datePreset === "custom" ? appliedRange.label : appliedRange.label;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingBottom: 24 }}>
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
          <span style={{ fontSize: 14, fontWeight: 500, color: T.textMuted }}>Loading Center Performance...</span>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {/* Top Performers */}
          <div>
            <SectionHeader
              icon={<Award size={18} />}
              title="Top Performers"
              count={topPerformers.length}
              color="#22c55e"
              expanded={expandedSections.top}
              onToggle={() => setExpandedSections((s) => ({ ...s, top: !s.top }))}
            />
            {expandedSections.top && (
              topPerformers.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
                  {topPerformers.map((stat) => (
                    <CenterCard key={stat.center.id} stat={stat} borderColor="#22c55e" />
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 16,
                    border: `1.5px dashed ${T.border}`,
                    backgroundColor: T.pageBg,
                    padding: "40px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 600, color: T.textMuted }}>No lead vendor matched the criteria</p>
                </div>
              )
            )}
          </div>

          {/* Needs Improvement */}
          <div>
            <SectionHeader
              icon={<AlertTriangle size={18} />}
              title="Needs Improvement"
              count={needsImprovement.length}
              color="#ef4444"
              expanded={expandedSections.needs}
              onToggle={() => setExpandedSections((s) => ({ ...s, needs: !s.needs }))}
            />
            {expandedSections.needs && (
              needsImprovement.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
                  {needsImprovement.map((stat) => (
                    <CenterCard key={stat.center.id} stat={stat} borderColor="#ef4444" />
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 16,
                    border: `1.5px dashed ${T.border}`,
                    backgroundColor: T.pageBg,
                    padding: "40px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 600, color: T.textMuted }}>No lead vendor matched the criteria</p>
                </div>
              )
            )}
          </div>

          {/* Zero Transfer */}
          <div>
            <SectionHeader
              icon={<MinusCircle size={18} />}
              title="Zero Transfer for the Day"
              count={zeroTransfer.length}
              color="#6b7280"
              expanded={expandedSections.zero}
              onToggle={() => setExpandedSections((s) => ({ ...s, zero: !s.zero }))}
            />
            {expandedSections.zero && (
              zeroTransfer.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
                  {zeroTransfer.map((stat) => (
                    <CenterCard key={stat.center.id} stat={stat} borderColor="#6b7280" />
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 16,
                    border: `1.5px dashed ${T.border}`,
                    backgroundColor: T.pageBg,
                    padding: "40px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 600, color: T.textMuted }}>No lead vendor matched the criteria</p>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
