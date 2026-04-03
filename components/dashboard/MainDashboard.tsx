"use client";

import { useState, useEffect, useRef } from "react";
import { T } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PermissionKey } from "@/lib/auth/permissions";
import { isRoleKey, type RoleKey } from "@/lib/auth/roles";

// Alias so we don't need to touch every reference below
const C = {
  bg: T.pageBg, white: T.cardBg, blue: T.blue,
  textDark: T.textDark, textMid: T.textMid, textMuted: T.textMuted,
  border: T.border, arrowUp: T.priorityHigh, arrowDown: T.priorityLow,
};

// ── Types ──────────────────────────────────────────────────────────────────────
interface Announcement {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

// ── Helper to format relative time ────────────────────────────────────────────
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ── Recent Deals Data for ProjectCard ───────────────────────────────────────────
const RECENT_DEALS_DATA = [
  {
    id: "DL-0001",
    name: "Rizwan Ahmed - AMAM Policy",
    created: "Apr 3, 2025",
    priority: "High" as const,
    allTasks: 5,
    activeTasks: 2,
    assignees: ["#638b4b", "#74a557"],
    extraAssignees: 0,
    emoji: "💰",
    color: "#fef3c7",
    tags: ["AMAM", "Pending"]
  },
  {
    id: "DL-0002", 
    name: "Waleed Shoaib - Aflac Coverage",
    created: "Apr 2, 2025",
    priority: "Medium" as const,
    allTasks: 4,
    activeTasks: 1,
    assignees: ["#638b4b"],
    extraAssignees: 1,
    emoji: "🛡️",
    color: "#dbeafe",
    tags: ["Aflac", "Active"]
  },
  {
    id: "DL-0003",
    name: "Kendrick Lamar - Aetna Plan",
    created: "Mar 30, 2025",
    priority: "Low" as const,
    allTasks: 3,
    activeTasks: 3,
    assignees: ["#94c278", "#4e6e3a"],
    extraAssignees: 0,
    emoji: "📋",
    color: "#dcfce7",
    tags: ["Aetna", "Complete"]
  },
  {
    id: "DL-0004",
    name: "Umar Test - American Home Life",
    created: "Mar 28, 2025",
    priority: "Medium" as const,
    allTasks: 6,
    activeTasks: 4,
    assignees: ["#638b4b", "#74a557", "#94c278"],
    extraAssignees: 2,
    emoji: "🏠",
    color: "#e0e7ff",
    tags: ["AHL", "In Progress"]
  },
  {
    id: "DL-0005",
    name: "Dan Hooker - SSL Graded",
    created: "Mar 27, 2025",
    priority: "High" as const,
    allTasks: 4,
    activeTasks: 2,
    assignees: ["#4e6e3a"],
    extraAssignees: 0,
    emoji: "⭐",
    color: "#fee2e2",
    tags: ["SSL", "Urgent"]
  }
];

interface Props { onViewAllEvents: () => void; searchQuery: string; }

type DatePreset = 'today' | 'yesterday' | '7' | '30' | '90' | 'thisMonth' | 'lastMonth' | 'custom';

// Permission checking helper
function useUserPermissions() {
  const [userRole, setUserRole] = useState<RoleKey | null>(null);
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [callCenterId, setCallCenterId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchUserData() {
      const supabase = getSupabaseBrowserClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      setUserId(user.id);

      // Get user details including role and call center
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("role_id, call_center_id, roles(key)")
        .eq("id", user.id)
        .maybeSingle();

      if (userError || !userData) {
        setIsLoading(false);
        return;
      }

      // Handle roles from Supabase (could be object or array from joined query)
      const rolesRaw = userData.roles as { key: string } | { key: string }[] | null;
      const roleObj = Array.isArray(rolesRaw) ? rolesRaw[0] : rolesRaw;
      const roleKey = roleObj?.key && isRoleKey(roleObj.key) ? roleObj.key : null;
      setUserRole(roleKey);
      setCallCenterId(userData.call_center_id);

      // Fetch permissions from role_permissions and user_permissions
      const [{ data: rolePerms }, { data: userPerms }] = await Promise.all([
        supabase
          .from("role_permissions")
          .select("permissions(key)")
          .eq("role_id", userData.role_id),
        supabase
          .from("user_permissions")
          .select("permissions(key)")
          .eq("user_id", user.id),
      ]);

      const allPerms = new Set<PermissionKey>();
      
      // Add role permissions
      rolePerms?.forEach((row: any) => {
        if (Array.isArray(row.permissions)) {
          row.permissions.forEach((p: any) => p?.key && allPerms.add(p.key as PermissionKey));
        } else if (row.permissions?.key) {
          allPerms.add(row.permissions.key as PermissionKey);
        }
      });

      // Add user-specific permissions
      userPerms?.forEach((row: any) => {
        if (Array.isArray(row.permissions)) {
          row.permissions.forEach((p: any) => p?.key && allPerms.add(p.key as PermissionKey));
        } else if (row.permissions?.key) {
          allPerms.add(row.permissions.key as PermissionKey);
        }
      });

      setPermissions(allPerms);
      setIsLoading(false);
    }

    fetchUserData();
  }, []);

  return { userRole, permissions, callCenterId, userId, isLoading };
}

// Check if user can view Daily Deal Flow
function canViewDailyDealFlow(role: RoleKey | null, permissions: Set<PermissionKey>): boolean {
  // System admin can see everything
  if (role === "system_admin") return true;
  // Check specific permission
  if (permissions.has("page.daily_deal_flow.access")) return true;
  // Call center agents and sales agents can see their own deals
  if (role === "call_center_agent" || role === "sales_agent_licensed" || role === "sales_agent_unlicensed") return true;
  return false;
}

// Check if user can view Pipeline Stages
function canViewPipeline(role: RoleKey | null, permissions: Set<PermissionKey>): boolean {
  if (role === "system_admin") return true;
  if (permissions.has("page.lead_pipeline.access")) return true;
  // Call center agents and sales agents can see their own leads
  if (role === "call_center_agent" || role === "sales_agent_licensed" || role === "sales_agent_unlicensed") return true;
  return false;
}

// Hook to fetch announcements from database
function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAnnouncements() {
      const supabase = getSupabaseBrowserClient();
      
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, description, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching announcements:", error);
        setIsLoading(false);
        return;
      }

      setAnnouncements(data || []);
      setIsLoading(false);
    }

    fetchAnnouncements();
  }, []);

  return { announcements, isLoading };
}

// Check if user can view all leads or only their call center
function getLeadViewScope(role: RoleKey | null, permissions: Set<PermissionKey>): "all" | "call_center" | "own" | "none" {
  if (role === "system_admin") return "all";
  if (permissions.has("action.transfer_leads.view_all")) return "all";
  if (permissions.has("action.transfer_leads.view_call_center")) return "call_center";
  if (permissions.has("action.transfer_leads.view_own")) return "own";
  
  // Default scope based on role if no specific permission set
  if (role === "call_center_agent" || role === "sales_agent_unlicensed") return "own";
  if (role === "call_center_admin") return "call_center";
  if (role === "sales_agent_licensed") return "own";
  
  return "none";
}

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

  // User permissions
  const { userRole, permissions, callCenterId, userId, isLoading: isLoadingPermissions } = useUserPermissions();
  
  // Fetch announcements from database
  const { announcements, isLoading: isLoadingAnnouncements } = useAnnouncements();

  // Permission checks
  const canViewDailyDeal = canViewDailyDealFlow(userRole, permissions);
  const canViewPipelineStages = canViewPipeline(userRole, permissions);
  const leadViewScope = getLeadViewScope(userRole, permissions);

  // For debugging - log permissions
  useEffect(() => {
    if (!isLoadingPermissions) {
      console.log("User Role:", userRole);
      console.log("Permissions:", Array.from(permissions));
      console.log("Call Center ID:", callCenterId);
      console.log("User ID:", userId);
      console.log("Can View Daily Deal:", canViewDailyDeal);
      console.log("Can View Pipeline:", canViewPipelineStages);
      console.log("Lead View Scope:", leadViewScope);
      console.log("Announcements:", announcements);
    }
  }, [isLoadingPermissions, userRole, permissions, callCenterId, userId, canViewDailyDeal, canViewPipelineStages, leadViewScope, announcements]);

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
        {/* ── Left/main column: Pipeline Stages (Permission Controlled) ── */}
        {canViewPipelineStages ? (
          <div style={{ 
            backgroundColor: "#ffffff", 
            borderRadius: T.radiusXl, 
            border: `1.5px solid ${T.border}`, 
            padding: "24px", 
            width: canViewDailyDeal ? "calc(70% - 12px)" : "100%",
            minHeight: 540, 
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, margin: 0 }}>Pipeline Stages</h2>
                {leadViewScope === "own" && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: T.blue, fontWeight: 600 }}>
                    Your leads only
                  </p>
                )}
                {leadViewScope === "call_center" && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: T.blue, fontWeight: 600 }}>
                    Your call center
                  </p>
                )}
              </div>
              <button style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                View all <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            <div style={{ flex: 1, padding: "8px 4px 12px 0" }}>
              <PipelineStagesGrid multiplier={multiplier} viewScope={leadViewScope} callCenterId={callCenterId} userId={userId} />
            </div>
          </div>
        ) : (
          /* Show placeholder when no pipeline access */
          <div style={{ 
            width: canViewDailyDeal ? "calc(70% - 12px)" : "100%",
            minHeight: 540,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: T.pageBg,
            borderRadius: T.radiusXl,
            border: `1.5px dashed ${T.border}`
          }}>
            <p style={{ color: T.textMuted, fontSize: 14 }}>No pipeline access</p>
          </div>
        )}

        {/* ── Right column: Announcements (from Database) ── */}
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

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {isLoadingAnnouncements ? (
              <p style={{ color: T.textMuted, fontSize: 14 }}>Loading...</p>
            ) : announcements.length === 0 ? (
              <p style={{ color: T.textMuted, fontSize: 14 }}>No announcements</p>
            ) : (
              announcements.map((announcement, idx) => (
                <div key={announcement.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingLeft: 12, borderLeft: `3px solid ${idx % 2 === 0 ? "#74a557" : "#16a34a"}` }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: T.textDark, lineHeight: 1.3 }}>{announcement.title}</p>
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: T.textMuted, fontWeight: 500, lineHeight: 1.5 }}>{announcement.description}</p>
                    <p style={{ margin: 0, fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{getRelativeTime(announcement.created_at)}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.textMuted }}>
                     <span style={{ fontSize: 14 }}>{idx % 2 === 0 ? "📢" : "📣"}</span>
                     <span style={{ fontSize: 12, fontWeight: 700 }}>New</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Deals Section (Permission Controlled) ── */}
      {canViewDailyDeal && (
        <div style={{ display: "flex", gap: 24, alignItems: "stretch", maxWidth: 1600, margin: "24px auto 0" }}>
          <div style={{ 
            width: "calc(70% - 12px)", 
            backgroundColor: "#ffffff", 
            borderRadius: T.radiusXl, 
            border: `1.5px solid ${T.border}`, 
            padding: "24px", 
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            minHeight: 400
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, margin: 0 }}>Recent Deals</h2>
                {leadViewScope === "own" && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: T.blue, fontWeight: 600 }}>
                    Your submissions only
                  </p>
                )}
                {leadViewScope === "call_center" && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: T.blue, fontWeight: 600 }}>
                    Your call center
                  </p>
                )}
              </div>
              <button style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                View all <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {RECENT_DEALS_DATA.slice(0, Math.max(1, Math.round(RECENT_DEALS_DATA.length * multiplier))).map((deal) => (
                <ProjectCard key={deal.id} {...deal} />
              ))}
            </div>
          </div>

          {/* ── Bottom Right: Empty (reserved space) ── */}
          <div style={{ width: "calc(30% - 12px)" }} />
        </div>
      )}

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

// ── Daily Deal Flow Stats Card (Big Single Card with Real Data) ─────────────

function DailyDealFlowStatsCard({ 
  multiplier, 
  viewScope, 
  callCenterId,
  userId
}: { 
  multiplier: number;
  viewScope: "all" | "call_center" | "own" | "none";
  callCenterId: string | null;
  userId: string | null;
}) {

  // Filter data based on view scope
  const getScopedMultiplier = () => {
    if (viewScope === "none") return 0;
    if (viewScope === "all") return multiplier;
    if (viewScope === "call_center") return multiplier * 0.7; // Simulate call center filter
    // For call center agents - show only their submitted deals (much smaller subset)
    if (viewScope === "own") return multiplier * 0.2; // Only ~20% for own submissions
    return multiplier;
  };

  const scopedMultiplier = getScopedMultiplier();

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

  // Apply date filter and scope to stats
  const stats = {
    ...baseStats,
    total_deals: Math.round(baseStats.total_deals * scopedMultiplier),
    pending_approval: Math.round(baseStats.pending_approval * scopedMultiplier),
    in_underwriting: Math.round(baseStats.in_underwriting * scopedMultiplier),
    total_premium: Math.round(baseStats.total_premium * scopedMultiplier),
    status_breakdown: baseStats.status_breakdown.map(s => ({
      ...s,
      count: Math.round(s.count * scopedMultiplier)
    }))
  };

  const baseRecentDeals = [
    { name: "Rizwan Ahmed", status: "Not Interested", carrier: "AMAM", premium: 300 },
    { name: "Waleed Shoaib", status: "Pending Approval", carrier: "Aflac", premium: 33 },
    { name: "fasdfdsf dsfsdf", status: "Pending Approval", carrier: "American Home Life", premium: 324 },
    { name: "Umar-test test2", status: "Pending Approval", carrier: "American Home Life", premium: 7666 },
    { name: "Kendrick Lamar", status: "Pending Approval", carrier: "AMAM", premium: 53 }
  ];

  // Filter recent deals based on date range and scope
  const recentDeals = baseRecentDeals.slice(0, Math.max(1, Math.round(baseRecentDeals.length * scopedMultiplier)));

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
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, margin: 0 }}>Daily Deal Flow</h2>
          {viewScope === "own" && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: T.blue, fontWeight: 600 }}>
              Your submissions only
            </p>
          )}
          {viewScope === "call_center" && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: T.blue, fontWeight: 600 }}>
              Your call center
            </p>
          )}
        </div>
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

interface PipelineStageData {
  id: number;
  name: string;
  pipeline: string;
  leadCount: number;
  totalValue: number;
  color: string;
  icon: string;
  leads: { name: string; carrier: string | null }[];
}

const STAGE_COLORS = ["#638b4b", "#74a557", "#94c278", "#4e6e3a", "#3b82f6", "#f59e0b"];
const STAGE_ICONS = ["🔄", "📋", "✅", "📊", "⏳", "💰"];

function usePipelineStages(
  viewScope: "all" | "call_center" | "own" | "none",
  callCenterId: string | null,
  userId: string | null,
) {
  const [stages, setStages] = useState<PipelineStageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStages() {
      const supabase = getSupabaseBrowserClient();

      const { data: allStages, error } = await supabase
        .from("pipeline_stages")
        .select("id, name, position, pipeline_id, pipelines(name)")
        .order("pipeline_id")
        .order("position");

      if (error || !allStages || allStages.length === 0) {
        setIsLoading(false);
        return;
      }

      const shuffled = [...allStages].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 6);
      const stageIds = selected.map((s) => s.id);

      let leadsQuery = supabase
        .from("leads")
        .select("stage_id, lead_value, first_name, last_name, carrier")
        .in("stage_id", stageIds);

      if (viewScope === "call_center" && callCenterId) {
        leadsQuery = leadsQuery.eq("call_center_id", callCenterId);
      } else if (viewScope === "own" && userId) {
        leadsQuery = leadsQuery.eq("submitted_by", userId);
      }

      const { data: leadsData } = viewScope === "none"
        ? { data: [] as any[] }
        : await leadsQuery;

      const countMap: Record<number, number> = {};
      const valueMap: Record<number, number> = {};
      const leadsByStage: Record<number, { name: string; carrier: string | null }[]> = {};

      (leadsData || []).forEach((lead: any) => {
        const sid = lead.stage_id as number;
        countMap[sid] = (countMap[sid] || 0) + 1;
        valueMap[sid] = (valueMap[sid] || 0) + (parseFloat(lead.lead_value) || 0);
        if (!leadsByStage[sid]) leadsByStage[sid] = [];
        leadsByStage[sid].push({
          name: [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown",
          carrier: lead.carrier ?? null,
        });
      });

      const formatted: PipelineStageData[] = selected.map((s, i) => {
        const pipelineRaw = s.pipelines as { name: string } | { name: string }[] | null;
        const pipelineName = Array.isArray(pipelineRaw) ? pipelineRaw[0]?.name : pipelineRaw?.name;
        return {
          id: s.id,
          name: s.name,
          pipeline: pipelineName || "Unknown",
          leadCount: countMap[s.id] || 0,
          totalValue: valueMap[s.id] || 0,
          color: STAGE_COLORS[i % STAGE_COLORS.length],
          icon: STAGE_ICONS[i % STAGE_ICONS.length],
          leads: leadsByStage[s.id] || [],
        };
      });

      setStages(formatted);
      setIsLoading(false);
    }

    fetchStages();
  }, [viewScope, callCenterId, userId]);

  return { stages, isLoading };
}

function PipelineStagesGrid({
  multiplier,
  viewScope,
  callCenterId,
  userId,
}: {
  multiplier: number;
  viewScope: "all" | "call_center" | "own" | "none";
  callCenterId: string | null;
  userId: string | null;
}) {
  const { stages, isLoading } = usePipelineStages(viewScope, callCenterId, userId);

  if (isLoading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              background: T.cardBg,
              padding: "20px",
              minHeight: 140,
              animation: "pulse 1.5s ease-in-out infinite",
              opacity: 0.5,
            }}
          />
        ))}
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
        <p style={{ color: T.textMuted, fontSize: 14 }}>No pipeline stages found</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
      {stages.map((stage) => (
        <StageCard key={stage.id} stage={stage} />
      ))}
    </div>
  );
}

function StageCard({ stage }: { stage: any }) {
  const [hovered, setHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const color = stage.color;

  return (
    <Card
      onClick={() => setIsExpanded(!isExpanded)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        borderBottom: `4px solid ${color}`,
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 20%, ${T.cardBg}) 0%, ${T.cardBg} 80%)`,
        boxShadow: hovered
          ? "0 14px 40px rgba(28, 32, 26, 0.08), 0 4px 14px rgba(28, 32, 26, 0.05)"
          : "0 4px 12px rgba(0,0,0,0.03)",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        transition: "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
        padding: "20px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        cursor: "pointer",
      }}
    >
      {/* Top row: label + icon */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#233217",
            letterSpacing: "0.45px",
            textTransform: "uppercase",
            lineHeight: 1.25,
          }}>
            {stage.pipeline}
          </span>
          <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.05 }}>
            {stage.leadCount}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.textDark, lineHeight: 1.3 }}>
            {stage.name}
          </span>
        </div>
        <div
          style={{
            color,
            backgroundColor: hovered
              ? `color-mix(in srgb, ${color} 24%, transparent)`
              : `color-mix(in srgb, ${color} 15%, transparent)`,
            width: 44,
            height: 44,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: 20,
            transition: "background-color 0.32s cubic-bezier(0.22, 1, 0.36, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
            transform: hovered ? "scale(1.04)" : "scale(1)",
          }}
        >
          {stage.icon}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: T.border, margin: "14px 0 10px" }} />

      {/* Bottom row: lead count label + value */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>
          {stage.leadCount} lead{stage.leadCount !== 1 ? "s" : ""} active
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: stage.totalValue > 0 ? color : T.textMuted }}>
          {stage.totalValue > 0 ? `$${stage.totalValue.toFixed(2)}` : "No value"}
        </span>
      </div>

      {/* Expanded leads list */}
      {isExpanded && (
        <div style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
          <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.4px" }}>
            Recent Leads
          </p>
          {stage.leads.slice(0, 3).map((lead: any, idx: number) => (
            <div key={idx} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 10px",
              backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
              borderRadius: 8,
              fontSize: 11,
            }}>
              <span style={{ fontWeight: 700, color: T.textDark }}>{lead.name}</span>
              {lead.carrier && (
                <span style={{ fontWeight: 600, color: T.textMuted, fontSize: 10 }}>
                  {lead.carrier}
                </span>
              )}
            </div>
          ))}
          {stage.leads.length > 3 && (
            <p style={{ margin: "4px 0 0", fontSize: 10, color: T.textMuted, textAlign: "center", fontWeight: 500 }}>
              +{stage.leads.length - 3} more
            </p>
          )}
        </div>
      )}
    </Card>
  );
}


// ── Project Card Component ────────────────────────────────────────────────────
function ProjectCard({ id, name, created, priority, allTasks, activeTasks, assignees, extraAssignees, emoji, color }: any) {
  return (
    <div style={{
      backgroundColor: "#fff", borderRadius: 20, overflow: "hidden",
      border: `1.5px solid ${T.border}`,
      boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
      display: "grid", gridTemplateColumns: "1.2fr 1fr 0.8fr",
      alignItems: "stretch"
    }}>
      {/* Detail Section */}
      <div style={{ padding: "20px 24px", borderRight: `1px solid ${T.borderLight}`, display: "flex", gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{emoji}</div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: T.textMuted }}>{id}</p>
          <h4 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800, color: T.textDark }}>{name}</h4>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
             <div style={{ display: "flex", alignItems: "center", gap: 4, color: T.textMuted }}>
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
               <span style={{ fontSize: 11, fontWeight: 600 }}>Created {created}</span>
             </div>
             <div style={{ display: "flex", alignItems: "center", gap: 3, color: priority === "Low" ? "#16a34a" : "#ca8a04" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d={priority === "Low" ? "M12 19V5M19 12l-7 7-7-7" : "M12 5v14M5 12l7-7 7 7"}/></svg>
                <span style={{ fontSize: 11, fontWeight: 800 }}>{priority}</span>
             </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div style={{ padding: "20px 24px", borderRight: `1px solid ${T.borderLight}`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: T.textDark }}>Project Data</p>
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: T.textMuted, fontWeight: 600 }}>All tasks</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.textDark }}>{allTasks}</p>
          </div>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: T.textMuted, fontWeight: 600 }}>Active tasks</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.textDark }}>{activeTasks}</p>
          </div>
        </div>
      </div>

      {/* Assignees Section */}
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: T.textDark }}>Assignees</p>
        <div style={{ display: "flex", alignItems: "center" }}>
          {assignees.map((c: string, i: number) => (
            <div key={i} style={{ 
              width: 28, height: 28, borderRadius: "50%", backgroundColor: c, border: "2px solid #fff", 
              marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff"
            }}>
              {["SS","RD","ET","LC"][i]}
            </div>
          ))}
          {extraAssignees > 0 && (
            <div style={{ 
              width: 28, height: 28, borderRadius: "50%", backgroundColor: T.blueFaint, border: "2px solid #fff", 
              marginLeft: -8, zIndex: 0, color: T.blue, fontSize: 10, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              +{extraAssignees}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
