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
  blueFaint: T.blueFaint,
  blueHover: T.blueHover,
  borderLight: T.borderLight,
  // Status colors
  statusWarning: "#f59e0b",
  statusDanger: "#ef4444",
  statusInfo: "#3b82f6",
  statusSuccess: "#10b981",
  // Priority colors
  priorityHigh: T.priorityHigh,
  priorityLow: T.priorityLow,
  // Misc
  gray100: "#e5e7eb",
};

// Text constants
const TEXT = {
  dashboard: "Dashboard",
  today: "Today",
  yesterday: "Yesterday",
  last7Days: "Last 7 Days",
  last30Days: "Last 30 Days",
  last90Days: "Last 90 Days",
  thisMonth: "This Month",
  lastMonth: "Last Month",
  customDateRange: "Custom Date Range...",
  backToPresets: "Back to Presets",
  selectDateRange: "Select Date Range",
  startDate: "Start Date",
  endDate: "End Date",
  reset: "Reset",
  applyRange: "Apply Range",
  viewAll: "View all",
  pipelineStages: "Lead Pipelines Overview",
  announcements: "Announcements",
  recentDeals: "Recent Deals",
  yourLeadsOnly: "Your leads only",
  yourCallCenter: "Your call center",
  yourSubmissionsOnly: "Your submissions only",
  noPipelineAccess: "No pipeline access",
  loading: "Loading...",
  noAnnouncements: "No announcements",
  noPipelineStagesFound: "No pipeline stages found",
  justNow: "Just now",
  noValue: "No value",
  leadsActive: "leads active",
  recentLeads: "Recent Leads",
  more: "more",
  projectData: "Project Data",
  allTasks: "All tasks",
  activeTasks: "Active tasks",
  assignees: "Assignees",
  created: "Created",
  statusDistribution: "Status Distribution",
  activeCarriers: "Active Carriers",
  activeAgents: "Active Agents",
  totalDeals: "Total Deals",
  pendingApproval: "Pending Approval",
  inUnderwriting: "In Underwriting",
  avgPremium: "Avg Premium",
  allTime: "All time",
  activeProcessing: "Active processing",
  ofTotal: "of total",
  dailyDealFlow: "Daily Deal Flow",
  new: "New",
  notInterested: "Not Interested",
  transferPipeline: "Transfer Portal",
  customerPipeline: "Customer Pipeline",
  chargebackPipeline: "Chargeback Pipeline",
};

// SVG Icons
const Icons = {
  calendar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  chevronDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6"/>
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  arrowRight: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  chart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  dollar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  clipboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  ),
  hourglass: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 22h14"/>
      <path d="M5 2h14"/>
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
    </svg>
  ),
  pencil: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
    </svg>
  ),
  xCircle: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  ),
  megaphone: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 11l19-9-9 19-2-8-8-2z"/>
    </svg>
  ),
  megaphoneAlt: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  refresh: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6"/>
      <path d="M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
  x: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
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
  if (role === "publisher_manager") return "call_center";
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
          <h1 style={{ fontSize: 32, fontWeight: 600, color: T.textDark, margin: 0 }}>Welcome to Insurvas Ecosystem</h1>
        </div>
        
        <div style={{ display: "flex", gap: 12, alignItems: "center", position: "relative" }} ref={dropdownRef}>
          {/* Date Filter Dropdown */}
          <div style={{ position: "relative" }}>
            <button 
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              style={{ 
                backgroundColor: T.blueFaint, 
                borderRadius: T.radiusMd, 
                padding: "12px 16px", 
                display: "flex", 
                alignItems: "center", 
                gap: 8, 
                border: `1px solid ${T.blue}22`,
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.blue }}>{dateRangeDisplay}</span>
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke={T.blue} 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{ transform: showDateDropdown ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 150ms' }}
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
                backgroundColor: T.cardBg,
                borderRadius: T.radiusXl,
                boxShadow: T.shadowLg,
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
                        { value: 'today' as DatePreset, label: TEXT.today, icon: Icons.calendar },
                        { value: 'yesterday' as DatePreset, label: TEXT.yesterday, icon: Icons.calendar },
                        { value: '7' as DatePreset, label: TEXT.last7Days, icon: Icons.chart },
                        { value: '30' as DatePreset, label: TEXT.last30Days, icon: Icons.chart },
                        { value: '90' as DatePreset, label: TEXT.last90Days, icon: Icons.chart },
                        { value: 'thisMonth' as DatePreset, label: TEXT.thisMonth, icon: Icons.calendar },
                        { value: 'lastMonth' as DatePreset, label: TEXT.lastMonth, icon: Icons.clipboard },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => handlePresetSelect(option.value)}
                          style={{
                            width: "100%",
                            padding: "12px",
                            border: "none",
                            backgroundColor: dateFilter === option.value ? T.blueFaint : "transparent",
                            color: dateFilter === option.value ? T.blue : T.textDark,
                            fontSize: 12,
                            fontWeight: dateFilter === option.value ? 700 : 500,
                            borderRadius: T.radiusMd,
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 150ms",
                            display: "flex",
                            alignItems: "center",
                            gap: 8
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
                          <span style={{ display: 'flex', color: T.blue }}>{option.icon}</span>
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
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: T.radiusMd,
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 150ms",
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
                      {TEXT.customDateRange}
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
                          gap: 4,
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
                        {TEXT.backToPresets}
                      </button>

                      <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: T.textDark }}>
                        {TEXT.selectDateRange}
                      </h4>

                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>
                            {TEXT.startDate}
                          </label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            max={customEndDate}
                            style={{
                              width: "100%",
                              padding: "12px",
                              border: `1.5px solid ${T.border}`,
                              borderRadius: T.radiusMd,
                              fontSize: 14,
                              fontFamily: "inherit",
                              color: T.textDark,
                              backgroundColor: T.cardBg,
                              outline: "none"
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>
                            {TEXT.endDate}
                          </label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            min={customStartDate}
                            max={formatDateForInput(new Date())}
                            style={{
                              width: "100%",
                              padding: "12px",
                              border: `1.5px solid ${T.border}`,
                              borderRadius: T.radiusMd,
                              fontSize: 14,
                              fontFamily: "inherit",
                              color: T.textDark,
                              backgroundColor: T.cardBg,
                              outline: "none"
                            }}
                          />
                        </div>
                      </div>

                      {/* Quick Select Buttons */}
                      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                        {[
                          { label: TEXT.last7Days, days: 7 },
                          { label: TEXT.last30Days, days: 30 },
                          { label: TEXT.last90Days, days: 90 },
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
                              padding: "8px 12px",
                              border: `1px solid ${T.border}`,
                              backgroundColor: T.pageBg,
                              color: T.textMid,
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: T.radiusSm,
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
                          padding: "12px 16px",
                          border: `1.5px solid ${T.border}`,
                          backgroundColor: "transparent",
                          color: T.textMuted,
                          fontSize: 14,
                          fontWeight: 600,
                          borderRadius: T.radiusMd,
                          cursor: "pointer"
                        }}
                      >
                        {TEXT.reset}
                      </button>
                      <button
                        onClick={handleApplyCustomRange}
                        disabled={!customStartDate || !customEndDate}
                        style={{
                          flex: 2,
                          padding: "12px 16px",
                          border: "none",
                          backgroundColor: (!customStartDate || !customEndDate) ? T.border : T.blue,
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 700,
                          borderRadius: T.radiusMd,
                          cursor: (!customStartDate || !customEndDate) ? 'not-allowed' : 'pointer',
                          opacity: (!customStartDate || !customEndDate) ? 0.5 : 1
                        }}
                      >
                        {TEXT.applyRange}
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
            backgroundColor: T.cardBg, 
            borderRadius: T.radiusXl, 
            border: `1.5px solid ${T.border}`, 
            padding: "24px", 
            width: canViewDailyDeal ? "calc(70% - 12px)" : "100%",
            minHeight: 540, 
            boxShadow: T.shadowMd,
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, margin: 0 }}>{TEXT.pipelineStages}</h2>
                {leadViewScope === "own" && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: T.blue, fontWeight: 600 }}>
                    {TEXT.yourLeadsOnly}
                  </p>
                )}
                {leadViewScope === "call_center" && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: T.blue, fontWeight: 600 }}>
                    {TEXT.yourCallCenter}
                  </p>
                )}
              </div>
              <button style={{ background: "none", border: "none", color: T.blue, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                {TEXT.viewAll} <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            <div style={{ flex: 1, padding: "8px 0 12px 0" }}>
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
            <p style={{ color: T.textMuted, fontSize: 14 }}>{TEXT.noPipelineAccess}</p>
          </div>
        )}

        {/* ── Right column: Announcements (from Database) ── */}
        <div style={{ 
          backgroundColor: T.cardBg, 
          borderRadius: T.radiusXl, 
          border: `1.5px solid ${T.border}`, 
          padding: "24px", 
          width: "calc(30% - 12px)",
          minHeight: 540,
          boxShadow: T.shadowMd,
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, margin: 0 }}>{TEXT.announcements}</h3>
            <button style={{ background: "none", border: "none", color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {TEXT.viewAll} <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {isLoadingAnnouncements ? (
              <p style={{ color: T.textMuted, fontSize: 14 }}>{TEXT.loading}</p>
            ) : announcements.length === 0 ? (
              <p style={{ color: T.textMuted, fontSize: 14 }}>{TEXT.noAnnouncements}</p>
            ) : (
              announcements.map((announcement, idx) => (
                <div key={announcement.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingLeft: 12, borderLeft: `4px solid ${idx % 2 === 0 ? T.blue : T.blueHover}` }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: T.textDark, lineHeight: 1.3 }}>{announcement.title}</p>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: T.textMuted, fontWeight: 500, lineHeight: 1.5 }}>{announcement.description}</p>
                    <p style={{ margin: 0, fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{getRelativeTime(announcement.created_at)}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.textMuted }}>
                     <span style={{ display: 'flex', color: T.blue }}>{idx % 2 === 0 ? Icons.megaphone : Icons.megaphoneAlt}</span>
                     <span style={{ fontSize: 12, fontWeight: 700 }}>{TEXT.new}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

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
      { status: TEXT.pendingApproval, count: 4, percentage: 80, color: C.statusWarning },
      { status: TEXT.notInterested, count: 1, percentage: 20, color: C.statusDanger }
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
      backgroundColor: T.cardBg,
      borderRadius: T.radiusXl,
      border: `1.5px solid ${T.border}`,
      boxShadow: T.shadowLg,
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      gap: 24,
      minHeight: 540
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, margin: 0 }}>{TEXT.dailyDealFlow}</h2>
          {viewScope === "own" && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: T.blue, fontWeight: 600 }}>
              {TEXT.yourSubmissionsOnly}
            </p>
          )}
          {viewScope === "call_center" && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: T.blue, fontWeight: 600 }}>
              {TEXT.yourCallCenter}
            </p>
          )}
        </div>
        <button style={{ background: "none", border: "none", color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          {TEXT.viewAll} <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Top Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
        <StatBox 
          label={TEXT.totalDeals} 
          value={stats.total_deals} 
          icon={Icons.chart} 
          color={T.blue}
          subtext={TEXT.allTime}
        />
        <StatBox 
          label={TEXT.pendingApproval} 
          value={stats.pending_approval} 
          icon={Icons.hourglass} 
          color={C.statusWarning}
          subtext={`${Math.round((stats.pending_approval/stats.total_deals)*100)}% ${TEXT.ofTotal}`}
        />
        <StatBox 
          label={TEXT.inUnderwriting} 
          value={stats.in_underwriting} 
          icon={Icons.pencil} 
          color={C.statusInfo}
          subtext={TEXT.activeProcessing}
        />
        <StatBox 
          label={TEXT.avgPremium} 
          value={`$${stats.avg_premium.toLocaleString()}`} 
          icon={Icons.dollar} 
          color={C.statusSuccess}
          subtext={`Total: $${stats.total_premium.toLocaleString()}`}
        />
      </div>

      {/* Middle Section: Status Breakdown + Recent Deals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 24 }}>
        {/* Status Distribution */}
        <div style={{
          backgroundColor: T.pageBg,
          borderRadius: T.radiusLg,
          padding: "24px",
          border: `1px solid ${T.border}`
        }}>
          <h4 style={{ margin: "0 0 24px", fontSize: 14, fontWeight: 700, color: T.textDark }}>{TEXT.statusDistribution}</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {stats.status_breakdown.map((item) => (
              <div key={item.status}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.textDark }}>{item.status}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.count} ({item.percentage}%)</span>
                </div>
                <div style={{ width: "100%", height: 8, backgroundColor: C.gray100, borderRadius: T.radiusSm, overflow: "hidden" }}>
                  <div style={{ 
                    width: `${item.percentage}%`, 
                    height: "100%", 
                    backgroundColor: item.color,
                    borderRadius: T.radiusSm,
                    transition: "width 150ms"
                  }} />
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{TEXT.activeCarriers}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>{stats.unique_carriers}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{TEXT.activeAgents}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>{stats.unique_agents}</span>
            </div>
          </div>
        </div>

        {/* Recent Deals Table */}
        <div style={{
          backgroundColor: T.pageBg,
          borderRadius: T.radiusLg,
          padding: "24px",
          border: `1px solid ${T.border}`,
          overflow: "hidden"
        }}>
          <h4 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: T.textDark }}>{TEXT.recentDeals}</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {recentDeals.map((deal, idx) => (
              <div key={idx} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                backgroundColor: T.cardBg,
                borderRadius: T.radiusMd,
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
                    color: deal.status === "Pending Approval" ? C.statusWarning : C.statusDanger
                  }}>
                    {deal.status === "Pending Approval" ? Icons.hourglass : Icons.xCircle}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.textDark }}>{deal.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: T.textMuted, fontWeight: 500 }}>{deal.carrier}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.blue }}>${deal.premium.toLocaleString()}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 600, color: deal.status === "Pending Approval" ? C.statusWarning : C.statusDanger }}>{deal.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, icon, color, subtext }: { label: string; value: string | number; icon: React.ReactNode; color: string; subtext: string }) {
  return (
    <div style={{
      backgroundColor: T.pageBg,
      borderRadius: T.radiusLg,
      padding: "20px",
      border: `1px solid ${T.border}`,
      display: "flex",
      flexDirection: "column",
      gap: 8
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: T.radiusMd,
          backgroundColor: color + "15",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: color
        }}>
          {icon}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{label}</p>
          <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800, color: T.textDark }}>{value}</p>
        </div>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: T.textMuted, fontWeight: 500 }}>{subtext}</p>
    </div>
  );
}

// ── Pipeline Stages Grid (Real Data) ──────────────────────────────────────────

interface PipelineStageData {
  id: number;
  name: string;
  pipeline: string;
  pipelineId: number;
  leadCount: number;
  totalValue: number;
  color: string;
  icon: React.ReactNode;
  leads: { name: string; carrier: string | null }[];
}

const STAGE_COLORS = [T.blue, T.blueHover, T.accentPink, "#94c278", C.statusInfo, C.statusWarning];
const STAGE_ICONS: React.ReactNode[] = [
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
];

function usePipelineStages(
  viewScope: "all" | "call_center" | "own" | "none",
  callCenterId: string | null,
  userId: string | null,
) {
  const [stagesByPipeline, setStagesByPipeline] = useState<Record<string, PipelineStageData[]>>({});
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

      const stageIds = allStages.map((s) => s.id);

      let leadsQuery = supabase
        .from("leads")
        .select("stage_id, lead_value, first_name, last_name, carrier")
        .in("stage_id", stageIds);

      if (viewScope === "call_center" && callCenterId) {
        leadsQuery = leadsQuery.eq("call_center_id", callCenterId);
      } else if (viewScope === "own" && userId) {
        leadsQuery = leadsQuery.eq("submitted_by", userId);
      }

      const PAGE_SIZE = 1000;
      const fetchAllRows = async (baseQuery: any) => {
        const all: any[] = [];
        for (let offset = 0; ; offset += PAGE_SIZE) {
          const { data, error } = await baseQuery.range(offset, offset + PAGE_SIZE - 1);
          if (error) throw error;
          const batch = (data ?? []) as any[];
          all.push(...batch);
          if (batch.length < PAGE_SIZE) break;
        }
        return all;
      };

      const leadsData =
        viewScope === "none"
          ? ([] as any[])
          : await fetchAllRows(leadsQuery);

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

      const formatted: PipelineStageData[] = allStages.map((s, i) => {
        const pipelineRaw = s.pipelines as { name: string } | { name: string }[] | null;
        const pipelineName = Array.isArray(pipelineRaw) ? pipelineRaw[0]?.name : pipelineRaw?.name;
        return {
          id: s.id,
          name: s.name,
          pipeline: pipelineName || "Unknown",
          pipelineId: s.pipeline_id,
          leadCount: countMap[s.id] || 0,
          totalValue: valueMap[s.id] || 0,
          color: STAGE_COLORS[i % STAGE_COLORS.length],
          icon: STAGE_ICONS[i % STAGE_ICONS.length],
          leads: leadsByStage[s.id] || [],
        };
      });

      const grouped: Record<string, PipelineStageData[]> = {};
      formatted.forEach((stage) => {
        if (!grouped[stage.pipeline]) {
          grouped[stage.pipeline] = [];
        }
        grouped[stage.pipeline].push(stage);
      });

      setStagesByPipeline(grouped);
      setIsLoading(false);
    }

    fetchStages();
  }, [viewScope, callCenterId, userId]);

  return { stagesByPipeline, isLoading };
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
  const { stagesByPipeline, isLoading } = usePipelineStages(viewScope, callCenterId, userId);

  const pipelineOrder = [TEXT.transferPipeline, TEXT.customerPipeline, TEXT.chargebackPipeline];

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {pipelineOrder.map((pipelineName) => (
          <div key={pipelineName}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: T.radiusLg,
                    border: `1px solid ${T.border}`,
                    background: T.cardBg,
                    padding: "16px",
                    minHeight: 120,
                    animation: "pulse 1.5s ease-in-out infinite",
                    opacity: 0.5,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const TRANSFER_STAGES = ["Needs BPO Callback", "Pending Approval", "DQ'd Can't be sold"];
  const CUSTOMER_STAGES = ["Issued - Pending First Draft", "ACTIVE PLACED - Paid as Earned", "ACTIVE - 3 Months +"];
  const CHARGEBACK_STAGES = ["Pending Lapse", "Chargeback Failed Payment", "Chargeback Cancellation"];

  const pipelineColors: Record<string, string> = {
    [TEXT.transferPipeline]: T.accentPurple,
    [TEXT.customerPipeline]: T.blue,
    [TEXT.chargebackPipeline]: T.danger,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {pipelineOrder.map((pipelineName) => {
        let stages = stagesByPipeline[pipelineName] || [];
        if (stages.length === 0) return null;
        if (pipelineName === TEXT.transferPipeline) {
          stages = stages.filter((s) => TRANSFER_STAGES.includes(s.name));
        }
        if (pipelineName === TEXT.customerPipeline) {
          stages = stages.filter((s) => CUSTOMER_STAGES.includes(s.name));
        }
        if (pipelineName === TEXT.chargebackPipeline) {
          stages = stages.filter((s) => CHARGEBACK_STAGES.includes(s.name));
        }
        const pipelineColor = pipelineColors[pipelineName] || T.blue;
        return (
          <div key={pipelineName}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {stages.map((stage) => (
                <StageCard key={stage.id} stage={stage} pipelineColor={pipelineColor} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StageCard({ stage, pipelineColor }: { stage: any; pipelineColor: string }) {
  const [hovered, setHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const color = pipelineColor;

  return (
    <Card
      onClick={() => setIsExpanded(!isExpanded)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: T.radiusLg,
        border: `1px solid ${T.border}`,
        borderBottom: `4px solid ${color}`,
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 20%, ${T.cardBg}) 0%, ${T.cardBg} 80%)`,
        boxShadow: hovered
          ? T.shadowMd
          : T.shadowSm,
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        transition: "transform 150ms, box-shadow 150ms",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        cursor: "pointer",
      }}
    >
      {/* Top row: label + icon */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.05 }}>
            {stage.leadCount}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.textDark, lineHeight: 1.3 }}>
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
            borderRadius: T.radiusMd,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background-color 150ms, transform 150ms",
            transform: hovered ? "scale(1.04)" : "scale(1)",
          }}
        >
          {stage.icon}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: T.border, margin: "16px 0 8px" }} />

      {/* Bottom row: lead count label + value */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>
          {stage.leadCount} {TEXT.leadsActive}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: stage.totalValue > 0 ? color : T.textMuted }}>
          {stage.totalValue > 0 ? `$${stage.totalValue.toFixed(2)}` : TEXT.noValue}
        </span>
      </div>

      {/* Expanded leads list */}
      {isExpanded && (
        <div style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {TEXT.recentLeads}
          </p>
          {stage.leads.slice(0, 5).map((lead: any, idx: number) => (
            <div key={idx} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 12px",
              backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
              borderRadius: T.radiusSm,
              fontSize: 12,
            }}>
              <span style={{ fontWeight: 700, color: T.textDark }}>{lead.name}</span>
              {lead.carrier && (
                <span style={{ fontWeight: 600, color: T.textMuted, fontSize: 12 }}>
                  {lead.carrier}
                </span>
              )}
            </div>
          ))}
          {stage.leads.length > 5 && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: T.textMuted, textAlign: "center", fontWeight: 500 }}>
              +{stage.leads.length - 5} {TEXT.more}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
