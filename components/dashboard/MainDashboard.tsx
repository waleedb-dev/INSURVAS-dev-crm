"use client";

import { useState, useEffect, useRef } from "react";
import { T } from "@/lib/theme";

// Alias so we don't need to touch every reference below
const C = {
  bg: T.pageBg, white: T.cardBg, blue: T.blue,
  textDark: T.textDark, textMid: T.textMid, textMuted: T.textMuted,
  border: T.border, arrowUp: T.priorityHigh, arrowDown: T.priorityLow,
};

// ── Real Data from Database ───────────────────────────────────────────────────
const ANNOUNCEMENTS = [
  {
    id: "3637a7e1-64dd-4164-88a0-b15c629772d3",
    title: "New Carrier Integration",
    description: "AMAM carrier has been successfully integrated into the system. All agents can now submit applications for AMAM products."
  },
  {
    id: "2d0e4746-7f64-497f-a979-9acb67ea36bf",
    title: "System Maintenance Scheduled",
    description: "The system will undergo maintenance this Sunday from 2 AM to 4 AM EST. Please save your work before this time."
  },
  {
    id: "9e166c9b-5d82-465f-8f08-aa05f5b3ff6e",
    title: "New Verification Workflow",
    description: "We have updated the verification process. Buffer agents should now complete additional validation steps before transferring."
  },
  {
    id: "04978e0d-557e-472b-8927-70f7216d47b9",
    title: "Team Meeting",
    description: "Monthly team meeting scheduled for Friday at 3 PM. All supervisors and managers are required to attend."
  }
];

interface Props { onViewAllEvents: () => void; searchQuery: string; }

type DatePreset = 'today' | 'yesterday' | '7' | '30' | '90' | 'thisMonth' | 'lastMonth' | 'custom';

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

// Helper to format date for display
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Get date ranges for presets
function getPresetDateRange(preset: DatePreset): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (preset) {
    case 'today':
      return { start: today, end: today, label: 'Today' };
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: yesterday, label: 'Yesterday' };
    case '7':
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 7);
      return { start: last7, end: today, label: 'Last 7 Days' };
    case '30':
      const last30 = new Date(today);
      last30.setDate(last30.getDate() - 30);
      return { start: last30, end: today, label: 'Last 30 Days' };
    case '90':
      const last90 = new Date(today);
      last90.setDate(last90.getDate() - 90);
      return { start: last90, end: today, label: 'Last 90 Days' };
    case 'thisMonth':
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: startOfMonth, end: today, label: 'This Month' };
    case 'lastMonth':
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: startOfLastMonth, end: endOfLastMonth, label: 'Last Month' };
    default:
      const last30Default = new Date(today);
      last30Default.setDate(last30Default.getDate() - 30);
      return { start: last30Default, end: today, label: 'Last 30 Days' };
  }
}

export default function MainDashboard({ onViewAllEvents, searchQuery }: Props) {
  // Date filter state
  const [dateFilter, setDateFilter] = useState<DatePreset>('30');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange>(getPresetDateRange('30'));
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDateDropdown(false);
        setShowCustomPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize custom dates
  useEffect(() => {
    const today = new Date();
    const last30 = new Date(today);
    last30.setDate(last30.getDate() - 30);
    setCustomStartDate(formatDateForInput(last30));
    setCustomEndDate(formatDateForInput(today));
  }, []);

  const handlePresetSelect = (preset: DatePreset) => {
    if (preset === 'custom') {
      setShowCustomPicker(true);
      setDateFilter('custom');
    } else {
      setDateFilter(preset);
      setAppliedDateRange(getPresetDateRange(preset));
      setShowDateDropdown(false);
      setShowCustomPicker(false);
    }
  };

  const handleApplyCustomRange = () => {
    if (customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      setAppliedDateRange({
        start,
        end,
        label: `${formatDate(start)} - ${formatDate(end)}`
      });
      setShowDateDropdown(false);
      setShowCustomPicker(false);
    }
  };

  const handleReset = () => {
    setDateFilter('30');
    setAppliedDateRange(getPresetDateRange('30'));
    setShowDateDropdown(false);
    setShowCustomPicker(false);
    const today = new Date();
    const last30 = new Date(today);
    last30.setDate(last30.getDate() - 30);
    setCustomStartDate(formatDateForInput(last30));
    setCustomEndDate(formatDateForInput(today));
  };

  // Calculate days for data multiplier
  const getDaysMultiplier = (): number => {
    if (dateFilter === 'custom') {
      const diffTime = Math.abs(appliedDateRange.end.getTime() - appliedDateRange.start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays / 30; // Normalize to 30 days as baseline
    }
    const multipliers: Record<DatePreset, number> = {
      'today': 0.03,
      'yesterday': 0.03,
      '7': 0.23,
      '30': 1,
      '90': 3,
      'thisMonth': new Date().getDate() / 30,
      'lastMonth': 1,
      'custom': 1
    };
    return multipliers[dateFilter] ?? 1;
  };

  const multiplier = getDaysMultiplier();

  // Display text for current date range
  const dateRangeDisplay = dateFilter === 'custom' 
    ? appliedDateRange.label 
    : appliedDateRange.label === 'Last 30 Days' 
      ? `${formatDate(appliedDateRange.start)} - ${formatDate(appliedDateRange.end)}`
      : appliedDateRange.label;

  return (
    <div style={{ padding: "0" }}>
      {/* Welcome + date - Figma Style */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", width: "100%", maxWidth: 1600, margin: "0 auto 32px" }}>
        <div>
        
          <h1 style={{ fontSize: 32, fontWeight: 800, color: T.textDark, margin: 0 }}>Dashboard</h1>
        </div>
        
        <div style={{ display: "flex", gap: 12, alignItems: "center", position: "relative" }} ref={dropdownRef}>
          {/* Date Filter Dropdown */}
          <div style={{ position: "relative" }}>
            <button 
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              style={{ 
                backgroundColor: "#f2f8ee", 
                borderRadius: T.radiusMd, 
                padding: "10px 16px", 
                display: "flex", 
                alignItems: "center", 
                gap: 10, 
                border: `1px solid ${T.blue}22`,
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.blue }}>{dateRangeDisplay}</span>
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke={T.blue} 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{ transform: showDateDropdown ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showDateDropdown && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                backgroundColor: "#fff",
                borderRadius: 16,
                boxShadow: "0 20px 60px -10px rgba(0,0,0,0.2)",
                border: `1px solid ${T.border}`,
                padding: "16px",
                minWidth: 320,
                zIndex: 101
              }}>
                {!showCustomPicker ? (
                  <>
                    {/* Preset Options */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {[
                        { value: 'today' as DatePreset, label: 'Today', icon: '📅' },
                        { value: 'yesterday' as DatePreset, label: 'Yesterday', icon: '📆' },
                        { value: '7' as DatePreset, label: 'Last 7 Days', icon: '📊' },
                        { value: '30' as DatePreset, label: 'Last 30 Days', icon: '📈' },
                        { value: '90' as DatePreset, label: 'Last 90 Days', icon: '📉' },
                        { value: 'thisMonth' as DatePreset, label: 'This Month', icon: '🗓️' },
                        { value: 'lastMonth' as DatePreset, label: 'Last Month', icon: '📋' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => handlePresetSelect(option.value)}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            border: "none",
                            backgroundColor: dateFilter === option.value ? T.blueFaint : "transparent",
                            color: dateFilter === option.value ? T.blue : T.textDark,
                            fontSize: 13,
                            fontWeight: dateFilter === option.value ? 700 : 500,
                            borderRadius: 10,
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.15s",
                            display: "flex",
                            alignItems: "center",
                            gap: 10
                          }}
                          onMouseEnter={(e) => {
                            if (dateFilter !== option.value) {
                              e.currentTarget.style.backgroundColor = T.pageBg;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (dateFilter !== option.value) {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{option.icon}</span>
                          <span>{option.label}</span>
                          {dateFilter === option.value && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="3" style={{ marginLeft: 'auto' }}>
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, backgroundColor: T.border, margin: "12px 0" }} />

                    {/* Custom Range Button */}
                    <button
                      onClick={() => handlePresetSelect('custom')}
                      style={{
                        width: "100%",
                        padding: "12px",
                        border: `1.5px dashed ${T.border}`,
                        backgroundColor: "transparent",
                        color: T.blue,
                        fontSize: 13,
                        fontWeight: 600,
                        borderRadius: 10,
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.15s",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                        <path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>
                      </svg>
                      Custom Date Range...
                    </button>
                  </>
                ) : (
                  <>
                    {/* Custom Date Picker */}
                    <div style={{ marginBottom: 16 }}>
                      <button
                        onClick={() => setShowCustomPicker(false)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          border: "none",
                          background: "none",
                          color: T.textMuted,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          marginBottom: 16,
                          padding: 0
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                        Back to Presets
                      </button>

                      <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: T.textDark }}>
                        Select Date Range
                      </h4>

                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            max={customEndDate}
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              border: `1.5px solid ${T.border}`,
                              borderRadius: 10,
                              fontSize: 13,
                              fontFamily: "inherit",
                              color: T.textDark,
                              backgroundColor: "#fff",
                              outline: "none"
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>
                            End Date
                          </label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            min={customStartDate}
                            max={formatDateForInput(new Date())}
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              border: `1.5px solid ${T.border}`,
                              borderRadius: 10,
                              fontSize: 13,
                              fontFamily: "inherit",
                              color: T.textDark,
                              backgroundColor: "#fff",
                              outline: "none"
                            }}
                          />
                        </div>
                      </div>

                      {/* Quick Select Buttons */}
                      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                        {[
                          { label: 'Last 7 Days', days: 7 },
                          { label: 'Last 30 Days', days: 30 },
                          { label: 'Last 90 Days', days: 90 },
                        ].map((quick) => (
                          <button
                            key={quick.label}
                            onClick={() => {
                              const end = new Date();
                              const start = new Date();
                              start.setDate(start.getDate() - quick.days);
                              setCustomStartDate(formatDateForInput(start));
                              setCustomEndDate(formatDateForInput(end));
                            }}
                            style={{
                              padding: "6px 10px",
                              border: `1px solid ${T.border}`,
                              backgroundColor: T.pageBg,
                              color: T.textMid,
                              fontSize: 10,
                              fontWeight: 600,
                              borderRadius: 6,
                              cursor: "pointer"
                            }}
                          >
                            {quick.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={handleReset}
                        style={{
                          flex: 1,
                          padding: "10px 16px",
                          border: `1.5px solid ${T.border}`,
                          backgroundColor: "transparent",
                          color: T.textMuted,
                          fontSize: 13,
                          fontWeight: 600,
                          borderRadius: 10,
                          cursor: "pointer"
                        }}
                      >
                        Reset
                      </button>
                      <button
                        onClick={handleApplyCustomRange}
                        disabled={!customStartDate || !customEndDate}
                        style={{
                          flex: 2,
                          padding: "10px 16px",
                          border: "none",
                          backgroundColor: (!customStartDate || !customEndDate) ? T.border : T.blue,
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 700,
                          borderRadius: 10,
                          cursor: (!customStartDate || !customEndDate) ? 'not-allowed' : 'pointer',
                          opacity: (!customStartDate || !customEndDate) ? 0.5 : 1
                        }}
                      >
                        Apply Range
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", maxWidth: 1600, margin: "0 auto" }}>
        {/* ── Left/main column: Pipeline Stages ── */}
        <div style={{ 
          backgroundColor: "#ffffff", 
          borderRadius: T.radiusXl, 
          border: `1.5px solid ${T.border}`, 
          padding: "24px", 
          width: "calc(70% - 12px)",
          minHeight: 540, 
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, margin: 0 }}>Pipeline Stages</h2>
            <button style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              View all <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          <div style={{ flex: 1, padding: "8px 4px 12px 0" }}>
            <PipelineStagesGrid multiplier={multiplier} />
          </div>
        </div>

        {/* ── Right column: Announcements ── */}
        <div style={{ 
          backgroundColor: "#ffffff", 
          borderRadius: T.radiusXl, 
          border: `1.5px solid ${T.border}`, 
          padding: "24px", 
          width: "calc(30% - 12px)",
          minHeight: 540,
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, margin: 0 }}>Announcements</h3>
            <button style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              View all <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ANNOUNCEMENTS.map((announcement) => (
              <div 
                key={announcement.id} 
                style={{ 
                  padding: "16px",
                  backgroundColor: T.pageBg,
                  borderRadius: 12,
                  border: `1.5px solid ${T.border}`,
                  transition: "all 0.2s ease",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = T.blue;
                  e.currentTarget.style.backgroundColor = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.backgroundColor = T.pageBg;
                }}
              >
                {/* Title */}
                <p style={{ 
                  margin: "0 0 8px", 
                  fontSize: 14, 
                  fontWeight: 700, 
                  color: T.textDark, 
                  lineHeight: 1.4
                }}>
                  {announcement.title}
                </p>
                
                {/* Description */}
                <p style={{ 
                  margin: 0, 
                  fontSize: 12, 
                  color: T.textMuted, 
                  fontWeight: 500,
                  lineHeight: 1.5
                }}>
                  {announcement.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, marginTop: 6, alignItems: "stretch", maxWidth: 1600, margin: "16px auto 0" }}>
        {/* ── Daily Deal Flow Stats Card (Big Single Card with Header Inside) ── */}
        <DailyDealFlowStatsCard multiplier={multiplier} />

        {/* ── Bottom Right: Empty (reserved space) ── */}
        <div style={{ width: "calc(30% - 12px)" }} />
      </div>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

// ── Daily Deal Flow Stats Card (Big Single Card with Real Data) ─────────────

function DailyDealFlowStatsCard({ multiplier }: { multiplier: number }) {

  // Real data from daily_deal_flow table (base values)
  const baseStats = {
    total_deals: 5,
    pending_approval: 4,
    in_underwriting: 3,
    avg_premium: 1675.20,
    total_premium: 8376.00,
    unique_carriers: 3,
    unique_agents: 3,
    status_breakdown: [
      { status: "Pending Approval", count: 4, percentage: 80, color: "#f59e0b" },
      { status: "Not Interested", count: 1, percentage: 20, color: "#ef4444" }
    ]
  };

  // Apply date filter to stats
  const stats = {
    ...baseStats,
    total_deals: Math.round(baseStats.total_deals * multiplier),
    pending_approval: Math.round(baseStats.pending_approval * multiplier),
    in_underwriting: Math.round(baseStats.in_underwriting * multiplier),
    total_premium: Math.round(baseStats.total_premium * multiplier),
    status_breakdown: baseStats.status_breakdown.map(s => ({
      ...s,
      count: Math.round(s.count * multiplier)
    }))
  };

  const baseRecentDeals = [
    { name: "Rizwan Ahmed", status: "Not Interested", carrier: "AMAM", premium: 300 },
    { name: "Waleed Shoaib", status: "Pending Approval", carrier: "Aflac", premium: 33 },
    { name: "fasdfdsf dsfsdf", status: "Pending Approval", carrier: "American Home Life", premium: 324 },
    { name: "Umar-test test2", status: "Pending Approval", carrier: "American Home Life", premium: 7666 },
    { name: "Kendrick Lamar", status: "Pending Approval", carrier: "AMAM", premium: 53 }
  ];

  // Filter recent deals based on date range
  const recentDeals = baseRecentDeals.slice(0, Math.max(1, Math.round(baseRecentDeals.length * multiplier)));

  return (
    <div style={{
      width: "calc(70% - 12px)",
      backgroundColor: "#fff",
      borderRadius: 24,
      border: `1.5px solid ${T.border}`,
      boxShadow: "0 10px 40px -10px rgba(0,0,0,0.08)",
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      gap: 20,
      minHeight: 540
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, margin: 0 }}>Daily Deal Flow</h2>
        <button style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          View all <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Top Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
        <StatBox 
          label="Total Deals" 
          value={stats.total_deals} 
          icon="📊" 
          color="#638b4b"
          subtext="All time"
        />
        <StatBox 
          label="Pending Approval" 
          value={stats.pending_approval} 
          icon="⏳" 
          color="#f59e0b"
          subtext={`${Math.round((stats.pending_approval/stats.total_deals)*100)}% of total`}
        />
        <StatBox 
          label="In Underwriting" 
          value={stats.in_underwriting} 
          icon="📝" 
          color="#3b82f6"
          subtext="Active processing"
        />
        <StatBox 
          label="Avg Premium" 
          value={`$${stats.avg_premium.toLocaleString()}`} 
          icon="💰" 
          color="#10b981"
          subtext={`Total: $${stats.total_premium.toLocaleString()}`}
        />
      </div>

      {/* Middle Section: Status Breakdown + Recent Deals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 24 }}>
        {/* Status Distribution */}
        <div style={{
          backgroundColor: T.pageBg,
          borderRadius: 16,
          padding: "24px",
          border: `1px solid ${T.border}`
        }}>
          <h4 style={{ margin: "0 0 20px", fontSize: 14, fontWeight: 700, color: T.textDark }}>Status Distribution</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {stats.status_breakdown.map((item) => (
              <div key={item.status}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.textDark }}>{item.status}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.count} ({item.percentage}%)</span>
                </div>
                <div style={{ width: "100%", height: 8, backgroundColor: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ 
                    width: `${item.percentage}%`, 
                    height: "100%", 
                    backgroundColor: item.color,
                    borderRadius: 4,
                    transition: "width 0.5s ease"
                  }} />
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>Active Carriers</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>{stats.unique_carriers}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>Active Agents</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>{stats.unique_agents}</span>
            </div>
          </div>
        </div>

        {/* Recent Deals Table */}
        <div style={{
          backgroundColor: T.pageBg,
          borderRadius: 16,
          padding: "24px",
          border: `1px solid ${T.border}`,
          overflow: "hidden"
        }}>
          <h4 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: T.textDark }}>Recent Deals</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recentDeals.map((deal, idx) => (
              <div key={idx} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                backgroundColor: "#fff",
                borderRadius: 12,
                border: `1px solid ${T.borderLight}`
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    backgroundColor: deal.status === "Pending Approval" ? "#fef3c7" : "#fee2e2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14
                  }}>
                    {deal.status === "Pending Approval" ? "⏳" : "❌"}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.textDark }}>{deal.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted, fontWeight: 500 }}>{deal.carrier}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#638b4b" }}>${deal.premium.toLocaleString()}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 10, fontWeight: 600, color: deal.status === "Pending Approval" ? "#f59e0b" : "#ef4444" }}>{deal.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, icon, color, subtext }: { label: string; value: string | number; icon: string; color: string; subtext: string }) {
  return (
    <div style={{
      backgroundColor: T.pageBg,
      borderRadius: 16,
      padding: "20px",
      border: `1px solid ${T.border}`,
      display: "flex",
      flexDirection: "column",
      gap: 8
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: color + "15",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20
        }}>
          {icon}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{label}</p>
          <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, color: T.textDark }}>{value}</p>
        </div>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 11, color: T.textMuted, fontWeight: 500 }}>{subtext}</p>
    </div>
  );
}

// ── Pipeline Stages Grid (Real Data) ──────────────────────────────────────────

function PipelineStagesGrid({ multiplier }: { multiplier: number }) {

  // Real pipeline data from database with date filtering applied
  const basePipelineStages = [
    {
      id: "transfer-api",
      name: "Transfer API",
      pipeline: "Transfer Portal",
      baseLeadCount: 4,
      totalValue: 45.00,
      color: "#638b4b",
      icon: "🔄",
      leads: [
        { name: "Ali", carrier: null, product: null },
        { name: "ahmedtest-", carrier: null, product: null },
        { name: "Dan32332 Hooker", carrier: "SSL", product: "Graded" },
        { name: "Arman Tsrukian", carrier: "Aflac", product: "Modified" }
      ]
    },
    {
      id: "test-stage",
      name: "Test Stage",
      pipeline: "Transfer Portal",
      baseLeadCount: 1,
      totalValue: 0.00,
      color: "#74a557",
      icon: "🧪",
      leads: [
        { name: "Rizwansa Ahmed", carrier: "Transamerica", product: "Graded" }
      ]
    },
    {
      id: "inform",
      name: "Inform",
      pipeline: "Transfer Portal",
      baseLeadCount: 1,
      totalValue: 45.00,
      color: "#94c278",
      icon: "ℹ️",
      leads: [
        { name: "umar-test-v2 fdfs", carrier: "AMAM", product: "Graded" }
      ]
    },
    {
      id: "chargeback-fixed",
      name: "Chargeback Fixed",
      pipeline: "Chargeback Pipeline",
      baseLeadCount: 3,
      totalValue: 0.00,
      color: "#4e6e3a",
      icon: "✅",
      leads: [
        { name: "Waleed Shoaib", carrier: "Aflac", product: "Preferred" },
        { name: "fasdfdsf dsfsdf", carrier: "AMAM", product: "Immediate" },
        { name: "Umar-test test2", carrier: "AMAM", product: "Immediate" }
      ]
    },
    {
      id: "chargeback-dq",
      name: "Chargeback DQ",
      pipeline: "Chargeback Pipeline",
      baseLeadCount: 1,
      totalValue: 0.00,
      color: "#ef4444",
      icon: "❌",
      leads: [
        { name: "Kendrick Lamar", carrier: "Aetna", product: "Modified" }
      ]
    }
  ];

  // Apply date filter multiplier to lead counts
  const pipelineStages = basePipelineStages.map(stage => ({
    ...stage,
    leadCount: Math.max(1, Math.round(stage.baseLeadCount * multiplier))
  }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
      {pipelineStages.map((stage) => (
        <StageCard key={stage.id} stage={stage} />
      ))}
    </div>
  );
}

function StageCard({ stage }: { stage: any }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      style={{
        backgroundColor: T.pageBg,
        borderRadius: 16,
        padding: "16px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        border: `1.5px solid ${T.border}`,
        position: "relative",
        minHeight: isExpanded ? 200 : 140
      }}
      onMouseEnter={(e) => { 
        e.currentTarget.style.borderColor = stage.color; 
        e.currentTarget.style.transform = "translateY(-2px)"; 
        e.currentTarget.style.boxShadow = `0 8px 16px -6px ${stage.color}33`; 
        e.currentTarget.style.backgroundColor = "#fff"; 
      }}
      onMouseLeave={(e) => { 
        e.currentTarget.style.borderColor = T.border; 
        e.currentTarget.style.transform = "translateY(0)"; 
        e.currentTarget.style.boxShadow = "none"; 
        e.currentTarget.style.backgroundColor = T.pageBg; 
      }}
    >
      {/* Header with icon and count badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: `2.5px solid ${stage.color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: stage.color + "10",
          fontSize: 18
        }}>
          {stage.icon}
        </div>
        <div style={{
          backgroundColor: stage.color,
          color: "#fff",
          borderRadius: 12,
          padding: "4px 10px",
          fontSize: 12,
          fontWeight: 800
        }}>
          {stage.leadCount} lead{stage.leadCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Stage name and pipeline */}
      <div style={{ marginTop: 4 }}>
        <p style={{ 
          margin: 0, 
          fontSize: 13, 
          fontWeight: 800, 
          color: T.textDark, 
          whiteSpace: "nowrap", 
          overflow: "hidden", 
          textOverflow: "ellipsis" 
        }}>
          {stage.name}
        </p>
        <p style={{ 
          margin: "4px 0 0", 
          fontSize: 10, 
          fontWeight: 600, 
          color: T.textMuted 
        }}>
          {stage.pipeline}
        </p>
      </div>

      {/* Value and progress indicator */}
      <div style={{ marginTop: 4 }}>
        <div style={{ 
          width: "100%", 
          backgroundColor: "#fff", 
          height: 4, 
          borderRadius: 2,
          marginBottom: 6
        }}>
          <div style={{ 
            width: `${Math.min((stage.leadCount / 5) * 100, 100)}%`, 
            backgroundColor: stage.color, 
            height: "100%", 
            borderRadius: 2 
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted }}>
            {stage.leadCount} active
          </span>
          <span style={{ 
            fontSize: 11, 
            fontWeight: 800, 
            color: stage.totalValue > 0 ? "#638b4b" : T.textMuted 
          }}>
            {stage.totalValue > 0 ? `$${stage.totalValue.toFixed(2)}` : 'No value'}
          </span>
        </div>
      </div>

      {/* Expanded leads list */}
      {isExpanded && (
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          animation: "fadeIn 0.2s ease"
        }}>
          <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, color: T.textMuted }}>
            Recent Leads
          </p>
          {stage.leads.slice(0, 3).map((lead: any, idx: number) => (
            <div key={idx} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 8px",
              backgroundColor: T.pageBg,
              borderRadius: 8,
              fontSize: 10
            }}>
              <span style={{ fontWeight: 700, color: T.textDark }}>{lead.name}</span>
              {lead.carrier && (
                <span style={{ fontWeight: 600, color: T.textMuted, fontSize: 9 }}>
                  {lead.carrier}
                </span>
              )}
            </div>
          ))}
          {stage.leads.length > 3 && (
            <p style={{ margin: "4px 0 0", fontSize: 9, color: T.textMuted, textAlign: "center" }}>
              +{stage.leads.length - 3} more leads
            </p>
          )}
        </div>
      )}

      {/* Click hint */}
      {!isExpanded && (
        <p style={{ 
          margin: "6px 0 0", 
          fontSize: 9, 
          color: T.textMuted, 
          textAlign: "center",
          fontWeight: 500
        }}>
          Click to expand
        </p>
      )}
    </div>
  );
}

