"use client";

import { ReactNode, useState, useRef, useEffect } from "react";
import { T } from "@/lib/theme";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import {
  LayoutDashboard,
  Briefcase,
  GitBranch,
  ArrowLeftRight,
  DollarSign,
  ScrollText,
  Users,
  Layers,
  Building2,
  Headphones,
  Settings,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  Moon,
  Sun,
  LogOut,
  ChevronDown,
  Menu,
  BookOpen,
  Phone,
  LifeBuoy,
  RefreshCw,
  Upload,
} from "lucide-react";
import { callCenterNameInitials, displayCallCenterName } from "@/lib/callCenterBranding";

export type DashPage =
  | "dashboard" | "nearest-events"
  | "daily-deal-flow" | "lead-pipeline"
  | "support-tickets"
  | "call-center-lead-intake"
  | "transfer-check-tester"
  | "crm-sync"
  | "ghl-data-import"
  | "users-access" | "pipeline-management"
  | "carrier-management" | "bpo-centres"
  | "commissions" | "policies" | "carrier-updates"
  | "imo-management" | "upline-carrier-states" | "imo-settings"
  | "product-guide"
  | "announcements"
  | "bpo-score-board";

interface Props {
  activePage: DashPage;
  onNavigate: (page: DashPage) => void;
  onSignOut: () => void;
  onSupportClick: () => void;
  children: ReactNode;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  visiblePages?: DashPage[];
  userDisplayName?: string;
  userEmail?: string;
  userInitials?: string;
  /** Logged-in user's call centre (when `call_center_id` is set). Shown in header instead of theme toggle. */
  callCenter?: { name: string; logoUrl: string | null } | null;
}

const SIDEBAR_W  = 260;
const SIDEBAR_SM = 72;

const INSURVAS_SIDEBAR_BG = "#233217";
const INSURVAS_TEXT_MUTED = "#C2D5C2";
const INSURVAS_TEXT_WHITE = "#ffffff";
const INSURVAS_ACCENT = "#DCEBDC";

interface NavItem {
  id: DashPage;
  label: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Overview", icon: <LayoutDashboard size={22} strokeWidth={1.8} /> },
  { id: "daily-deal-flow", label: "Daily Deal Flow", icon: <Briefcase size={22} strokeWidth={1.8} /> },
  { id: "lead-pipeline", label: "Lead Pipeline", icon: <GitBranch size={22} strokeWidth={1.8} /> },
  { id: "support-tickets", label: "Support Tickets", icon: <LifeBuoy size={22} strokeWidth={1.8} /> },
  { id: "call-center-lead-intake", label: "Transfer Leads", icon: <ArrowLeftRight size={22} strokeWidth={1.8} /> },
  {
    id: "transfer-check-tester",
    label: "Transfer Checker",
    icon: <Phone size={22} strokeWidth={1.8} />,
  },
  {
    id: "crm-sync",
    label: "CRM Sync Operations",
    icon: <RefreshCw size={22} strokeWidth={1.8} />,
  },
  {
    id: "ghl-data-import",
    label: "GHL Data Import",
    icon: <Upload size={22} strokeWidth={1.8} />,
  },
  {
    id: "carrier-updates",
    label: "Carrier Updates",
    icon: <DollarSign size={22} strokeWidth={1.8} />,
    children: [
      { id: "commissions", label: "Commissions", icon: <DollarSign size={18} strokeWidth={1.8} /> },
      { id: "policies", label: "Policies", icon: <ScrollText size={18} strokeWidth={1.8} /> },
    ],
  },
  { id: "users-access", label: "Users & Access", icon: <Users size={22} strokeWidth={1.8} /> },
  { id: "pipeline-management", label: "Pipelines", icon: <Layers size={22} strokeWidth={1.8} /> },
  { id: "bpo-centres", label: "BPO Centres", icon: <Headphones size={22} strokeWidth={1.8} /> },
  { id: "product-guide", label: "Product Guide", icon: <BookOpen size={22} strokeWidth={1.8} /> },
  {
    id: "imo-settings",
    label: "IMO Settings",
    icon: <Settings size={22} strokeWidth={1.8} />,
    children: [
      { id: "carrier-management", label: "Carriers", icon: <Building2 size={18} strokeWidth={1.8} /> },
      { id: "imo-management", label: "IMO Management", icon: <Settings size={18} strokeWidth={1.8} /> },
      { id: "upline-carrier-states", label: "Upline States", icon: <MapPin size={18} strokeWidth={1.8} /> },
    ],
  },
  { id: "announcements", label: "Announcements", icon: <Bell size={22} strokeWidth={1.8} /> },
  { id: "bpo-score-board", label: "Score Board", icon: <LayoutDashboard size={22} strokeWidth={1.8} /> },
];

const PAGE_TITLE: Record<DashPage, string> = {
  dashboard: "Overview",
  "nearest-events": "Nearest Events",
  "daily-deal-flow": "Daily Deal Flow",
  "lead-pipeline": "Lead Pipeline",
  "support-tickets": "Support Tickets",
  "call-center-lead-intake": "Transfer Leads",
  "transfer-check-tester": "Transfer Checker",
  "crm-sync": "CRM Sync Operations",
  "ghl-data-import": "GHL Data Import",
  "users-access": "Users & Access",
  "pipeline-management": "Pipelines",
  "carrier-management": "Carriers",
  "bpo-centres": "BPO Centres",
  commissions: "Commissions",
  policies: "Policies",
  "carrier-updates": "Carrier Updates",
  "imo-settings": "IMO Settings",
  "imo-management": "IMO Management",
  "upline-carrier-states": "Upline States",
  "product-guide": "Product Guide",
  "announcements": "Announcements",
  "bpo-score-board": "Score Board",
};

const NOTIFICATIONS = [
  { id: 1, text: "Oscar Holloway updated Mind Map task to In Progress", time: "2m ago",  read: false },
  { id: 2, text: "Emily Tyler attached files to the task",               time: "15m ago", read: false },
  { id: 3, text: "New project PN0001291 was created",                    time: "1h ago",  read: true  },
  { id: 4, text: "Anna's Birthday is today at 6:00 PM",                  time: "3h ago",  read: true  },
];

export default function DashboardLayout({
  activePage, onNavigate, onSignOut, onSupportClick,
  children, searchQuery, onSearchChange, visiblePages,
  userDisplayName = "User",
  userEmail = "",
  userInitials = "U",
  callCenter = null,
}: Props) {
  const { pageHeaderTitle, pageHeaderActions } = useDashboardContext();
  const [collapsed, setCollapsed]             = useState(false);
  const [showNotif,  setShowNotif]            = useState(false);
  const [showUser,   setShowUser]             = useState(false);
  const [hoveredNav, setHoveredNav]           = useState<string | null>(null);
  const [notifs,     setNotifs]               = useState(NOTIFICATIONS);
  const [isDark,     setIsDark]               = useState(false);
  const [expandedSubs, setExpandedSubs]        = useState<Set<string>>(new Set());

  // Read initial theme from HTML class or localStorage on mount
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark-theme") || localStorage.getItem("theme") === "dark");
  }, []);

  // Update theme when toggled
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark-theme");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark-theme");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef  = useRef<HTMLDivElement>(null);

  const unread     = notifs.filter((n) => !n.read).length;
  const sidebarW   = collapsed ? SIDEBAR_SM : SIDEBAR_W;
  const activeNav  = activePage === "nearest-events" ? "dashboard" : activePage;
  const visiblePageSet = new Set<DashPage>(visiblePages ?? NAV_ITEMS.map((item) => item.id));
  const headerTitle = pageHeaderTitle ?? PAGE_TITLE[activePage];
  const centerLogoOk = Boolean(callCenter?.logoUrl && callCenter.logoUrl.trim() !== "");
  const centerDisplayName =
    callCenter?.name != null && String(callCenter.name).trim() !== ""
      ? displayCallCenterName(String(callCenter.name))
      : "";
  const showCallCenterHeader = Boolean(callCenter && (centerLogoOk || centerDisplayName.length > 0));
  const centerInitials = callCenterNameInitials(callCenter?.name?.trim() ? callCenter.name : centerDisplayName || "Centre");

  // close dropdowns on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (userRef.current  && !userRef.current.contains(e.target  as Node)) setShowUser(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const markAllRead = () => setNotifs((n) => n.map((x) => ({ ...x, read: true })));

  return (
    <div className={isDark ? "dark-theme" : ""} style={{ display: "flex", minHeight: "100vh", backgroundColor: T.pageBg, fontFamily: T.font, color: T.textDark }}>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside style={{
        width: sidebarW, flexShrink: 0,
        backgroundColor: INSURVAS_SIDEBAR_BG,
        display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100,
        transition: "width 0.22s cubic-bezier(.4,0,.2,1)",
        overflow: "visible",
        paddingTop: 20, paddingBottom: 20,
      }}>

        {/* Logo row */}
        <div style={{
          padding: `0 ${collapsed ? 16 : 20}px`,
          marginBottom: 24,
          display: "flex", alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          transition: "padding 0.22s",
        }}>
          <div
            onClick={() => onNavigate("dashboard")}
            style={{
              height: 36,
              width: collapsed ? 36 : 160,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
              transition: "all 0.15s ease-in-out",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.02)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
          >
            {collapsed ? (
              <div style={{ 
                width: 36, 
                height: 36, 
                borderRadius: 10, 
                backgroundColor: INSURVAS_ACCENT, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
              }}>
                <Menu size={18} color={INSURVAS_SIDEBAR_BG} />
              </div>
            ) : (
              <img 
                src="/logo-expanded.png" 
                alt="Logo" 
                style={{ 
                  width: "100%", 
                  height: "100%", 
                  objectFit: "contain", 
                  objectPosition: "left center",
                  filter: "brightness(0) invert(1)",
                }} 
              />
            )}
          </div>

          {!collapsed && (
            <button 
              onClick={() => setCollapsed(true)} 
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 8,
                borderRadius: 8, color: INSURVAS_TEXT_MUTED, transition: "all 0.15s ease-in-out",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onMouseEnter={(e) => { 
                const el = e.currentTarget as HTMLElement;
                el.style.color = INSURVAS_TEXT_WHITE;
                el.style.backgroundColor = "rgba(255,255,255,0.08)";
              }}
              onMouseLeave={(e) => { 
                const el = e.currentTarget as HTMLElement;
                el.style.color = INSURVAS_TEXT_MUTED;
                el.style.backgroundColor = "transparent";
              }}
              title="Collapse sidebar"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <button 
              onClick={() => setCollapsed(false)} 
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 8,
                borderRadius: 8, color: INSURVAS_TEXT_MUTED, transition: "all 0.15s ease-in-out",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onMouseEnter={(e) => { 
                const el = e.currentTarget as HTMLElement;
                el.style.color = INSURVAS_TEXT_WHITE;
                el.style.backgroundColor = "rgba(255,255,255,0.08)";
              }}
              onMouseLeave={(e) => { 
                const el = e.currentTarget as HTMLElement;
                el.style.color = INSURVAS_TEXT_MUTED;
                el.style.backgroundColor = "transparent";
              }}
              title="Expand sidebar"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Search bar */}
        {!collapsed && (
          <div style={{ padding: "0 16px", marginBottom: 24 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 10,
              padding: "10px 14px",
              cursor: "text",
              transition: "all 0.15s ease-in-out",
            }}
              onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                el.style.borderColor = "rgba(255, 255, 255, 0.15)";
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.backgroundColor = "rgba(255, 255, 255, 0.04)";
                el.style.borderColor = "rgba(255, 255, 255, 0.08)";
              }}
            >
              <Search size={16} color={INSURVAS_TEXT_MUTED} style={{ flexShrink: 0 }} />
              <input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search..."
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: INSURVAS_TEXT_WHITE, fontSize: 13, fontFamily: T.font,
                  minWidth: 0,
                }}
              />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ padding: `0 ${collapsed ? 12 : 12}px`, overflowY: "auto", transition: "padding 0.22s", flex: 1 }}>
          {!collapsed && (
            <div style={{ 
              fontSize: 10, 
              fontWeight: 700, 
              color: INSURVAS_TEXT_MUTED, 
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "0 14px",
              marginBottom: 12,
            }}>
              Menu
            </div>
          )}
          {NAV_ITEMS.filter((item) => visiblePageSet.has(item.id) || (item.children && item.children.some(c => visiblePageSet.has(c.id)))).map((item) => {
            const isActive = item.id === activeNav;
            const hasChildren = !!item.children && item.children.length > 0;
            const isExpanded = expandedSubs.has(item.id);
            const childIds = item.children?.map(c => c.id) || [];
            const isChildActive = childIds.includes(activeNav);

            if (hasChildren) {
              return (
                <div key={item.id}>
                  <button
                    id={`nav-${item.id}`}
                    onClick={() => {
                      if (collapsed) {
                        onNavigate(item.children![0].id);
                      } else {
                        setExpandedSubs(prev => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        });
                      }
                    }}
                    title={collapsed ? item.label : undefined}
                    style={{
                      display: "flex", alignItems: "center",
                      gap: collapsed ? 0 : 14,
                      justifyContent: collapsed ? "center" : "flex-start",
                      width: "100%",
                      padding: collapsed ? "14px 0" : "14px 16px",
                      borderRadius: 12, border: "none", cursor: "pointer",
                      backgroundColor: isActive || isChildActive ? INSURVAS_ACCENT : "transparent",
                      color: isActive || isChildActive ? INSURVAS_SIDEBAR_BG : (hoveredNav === item.id ? INSURVAS_TEXT_WHITE : INSURVAS_TEXT_MUTED),
                      fontSize: 15, fontWeight: isActive || isChildActive ? 700 : 600,
                      marginBottom: 4, fontFamily: T.font,
                      transition: "all 0.15s ease-in-out",
                      overflow: "hidden", whiteSpace: "nowrap",
                      textAlign: "left",
                      transform: hoveredNav === item.id && !isActive ? "scale(1.01)" : "scale(1)",
                      position: "relative",
                    }}
                    onMouseEnter={() => setHoveredNav(item.id)}
                    onMouseLeave={() => setHoveredNav(null)}
                  >
                    {isChildActive && !isActive && (
                      <span style={{
                        position: "absolute",
                        left: 0,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 3,
                        height: 20,
                        backgroundColor: INSURVAS_SIDEBAR_BG,
                        borderRadius: "0 3px 3px 0",
                      }} />
                    )}
                    <span style={{ flexShrink: 0, display: "flex" }}>{item.icon}</span>
                    {!collapsed && (
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>{item.label}</span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          style={{
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                            flexShrink: 0,
                          }}
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    )}
                  </button>
                  {!collapsed && isExpanded && item.children && (
                    <div style={{ marginLeft: 20, marginBottom: 8 }}>
                      {item.children.filter(c => visiblePageSet.has(c.id)).map(child => {
                        const isChildActive = child.id === activeNav;
                        return (
                          <button
                            key={child.id}
                            id={`nav-${child.id}`}
                            onClick={() => onNavigate(child.id)}
                            style={{
                              display: "flex", alignItems: "center",
                              gap: 14,
                              width: "100%",
                              padding: "10px 16px",
                              borderRadius: 10, border: "none", cursor: "pointer",
                              backgroundColor: isChildActive ? INSURVAS_ACCENT : "transparent",
                              color: isChildActive ? INSURVAS_SIDEBAR_BG : (hoveredNav === child.id ? INSURVAS_TEXT_WHITE : INSURVAS_TEXT_MUTED),
                              fontSize: 14, fontWeight: isChildActive ? 700 : 500,
                              marginBottom: 2, fontFamily: T.font,
                              transition: "all 0.15s ease-in-out",
                              overflow: "hidden", whiteSpace: "nowrap",
                              textAlign: "left",
                              position: "relative",
                            }}
                            onMouseEnter={() => setHoveredNav(child.id)}
                            onMouseLeave={() => setHoveredNav(null)}
                          >
                            {isChildActive && (
                              <span style={{
                                position: "absolute",
                                left: 0,
                                top: "50%",
                                transform: "translateY(-50%)",
                                width: 3,
                                height: 16,
                                backgroundColor: INSURVAS_SIDEBAR_BG,
                                borderRadius: "0 3px 3px 0",
                              }} />
                            )}
                            <span style={{ flexShrink: 0, display: "flex" }}>{child.icon}</span>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                style={{
                  display: "flex", alignItems: "center",
                  gap: collapsed ? 0 : 14,
                  justifyContent: collapsed ? "center" : "flex-start",
                  width: "100%",
                  padding: collapsed ? "14px 0" : "14px 16px",
                  borderRadius: 12, border: "none", cursor: "pointer",
                  backgroundColor: isActive ? INSURVAS_ACCENT : "transparent",
                  color: isActive ? INSURVAS_SIDEBAR_BG : (hoveredNav === item.id ? INSURVAS_TEXT_WHITE : INSURVAS_TEXT_MUTED),
                  fontSize: 15, fontWeight: isActive ? 700 : 600,
                  marginBottom: 4, fontFamily: T.font,
                  transition: "all 0.15s ease-in-out",
                  overflow: "hidden", whiteSpace: "nowrap",
                  textAlign: "left",
                  transform: hoveredNav === item.id && !isActive ? "scale(1.01)" : "scale(1)",
                  position: "relative",
                }}
                onMouseEnter={() => setHoveredNav(item.id)}
                onMouseLeave={() => setHoveredNav(null)}
              >
                {isActive && (
                  <span style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 3,
                    height: 20,
                    backgroundColor: INSURVAS_SIDEBAR_BG,
                    borderRadius: "0 3px 3px 0",
                  }} />
                )}
                <span style={{ flexShrink: 0, display: "flex" }}>{item.icon}</span>
                {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>}
              </button>
            );
          })}
        </nav>

      </aside>

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <div style={{
        marginLeft: sidebarW, flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh",
        minWidth: 0,
        transition: "margin-left 0.22s cubic-bezier(.4,0,.2,1)",
      }}>

        {/* Top bar */}
        <header style={{
          height: 68, backgroundColor: T.sidebarBg,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 28px", gap: 20,
          position: "sticky", top: 0, zIndex: 50,
          borderBottom: `1px solid ${T.borderLight}`,
          minWidth: 0,
        }}>
          <h1 style={{
            fontSize: 26,
            fontWeight: 800,
            color: T.textDark,
            margin: 0,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.15,
            paddingRight: 16,
          }}>{headerTitle}</h1>

          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
            <div ref={notifRef} style={{ position: "relative" }}>
              <button
                id="header-notification-btn"
                type="button"
                onClick={() => { setShowNotif((v) => !v); setShowUser(false); }}
                title="Notifications"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: `1px solid ${T.border}`,
                  background: showNotif ? T.cardBg : T.pageBg,
                  color: T.textMid,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ position: "relative", display: "flex" }}>
                  <Bell size={20} />
                  {unread > 0 && (
                    <span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", backgroundColor: T.danger, border: `2px solid ${T.cardBg}` }} />
                  )}
                </span>
              </button>
              {showNotif && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 10px)", width: 310, backgroundColor: T.cardBg, borderRadius: T.radiusLg, boxShadow: T.shadowLg, border: `1px solid ${T.border}`, zIndex: 250, overflow: "hidden", animation: "fadeInDown 0.15s ease" }}>
                  <div style={{ padding: "13px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.borderLight}` }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: T.textDark }}>Notifications</span>
                    {unread > 0 && <button type="button" onClick={markAllRead} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.blue, fontFamily: T.font }}>Mark all read</button>}
                  </div>
                  {notifs.map((n) => (
                    <div key={n.id} onClick={() => setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 16px", backgroundColor: n.read ? T.cardBg : T.blueFaint, cursor: "pointer", borderBottom: `1px solid ${T.borderLight}`, transition: "background-color 0.15s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = n.read ? T.cardBg : T.blueFaint; }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: n.read ? "transparent" : T.blue, flexShrink: 0, marginTop: 5 }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 12, color: T.textMid, fontWeight: 600, lineHeight: 1.5 }}>{n.text}</p>
                        <p style={{ margin: 0, fontSize: 11, color: T.textMuted, fontWeight: 600, marginTop: 2 }}>{n.time}</p>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: "10px 16px", textAlign: "center" }}>
                    <button type="button" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.blue, fontFamily: T.font }}>View all notifications</button>
                  </div>
                </div>
              )}
            </div>

            {showCallCenterHeader && (
              <div
                title={centerDisplayName}
                style={{
                  height: 40,
                  maxWidth: 280,
                  padding: "0 12px 0 6px",
                  borderRadius: 12,
                  border: `1px solid ${T.border}`,
                  background: T.pageBg,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: T.font,
                  minWidth: 0,
                }}
              >
                {callCenter?.logoUrl && callCenter.logoUrl.trim() !== "" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={callCenter.logoUrl.trim()}
                    alt=""
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      objectFit: "cover",
                      flexShrink: 0,
                      border: `1px solid ${T.borderLight}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: INSURVAS_SIDEBAR_BG,
                      color: INSURVAS_ACCENT,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 800,
                      flexShrink: 0,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {centerInitials}
                  </div>
                )}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: T.textDark,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  {centerDisplayName || "Call centre"}
                </span>
              </div>
            )}

            <div ref={userRef} style={{ position: "relative" }}>
              <button
                type="button"
                id="header-user-menu-btn"
                onClick={() => { setShowUser((v) => !v); setShowNotif(false); }}
                title={userDisplayName}
                style={{
                  height: 40,
                  padding: "0 12px 0 8px",
                  borderRadius: 12,
                  border: `1px solid ${T.border}`,
                  background: showUser ? T.cardBg : T.pageBg,
                  color: T.textDark,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  fontFamily: T.font,
                }}
              >
                <div style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: T.blue, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{userInitials}</div>
                <span style={{ fontSize: 13, fontWeight: 700, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userDisplayName}</span>
                <ChevronDown size={14} style={{ flexShrink: 0, transition: "transform 0.18s", transform: showUser ? "rotate(180deg)" : "rotate(0)" }} />
              </button>
              {showUser && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 10px)", width: 220, backgroundColor: T.cardBg, borderRadius: T.radiusLg, boxShadow: T.shadowLg, border: `1px solid ${T.border}`, zIndex: 250, overflow: "hidden", animation: "fadeInDown 0.15s ease" }}>
                  <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.borderLight}` }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.textDark }}>{userDisplayName}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: T.textMuted, fontWeight: 600, wordBreak: "break-all" }}>{userEmail}</p>
                  </div>
                  {["My Profile", "Account Settings", "Notifications"].map((label) => (
                    <button key={label} type="button" style={{ width: "100%", display: "block", padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.textMid, textAlign: "left", transition: "background-color 0.15s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                    >{label}</button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsDark((v) => !v)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.textMid, textAlign: "left", transition: "background-color 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                  >
                    {isDark ? <Sun size={16} style={{ flexShrink: 0 }} /> : <Moon size={16} style={{ flexShrink: 0 }} />}
                    {isDark ? "Light mode" : "Dark mode"}
                  </button>
                  <button type="button" onClick={() => { onSupportClick(); setShowUser(false); }} style={{ width: "100%", display: "block", padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.textMid, textAlign: "left", transition: "background-color 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                  >Help &amp; Support</button>
                  <div style={{ borderTop: `1px solid ${T.borderLight}` }}>
                    <button type="button" id="header-logout-btn" onClick={() => { setShowUser(false); onSignOut(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: T.font, fontSize: 13, fontWeight: 700, color: T.danger, textAlign: "left", transition: "background-color 0.15s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#f2f8ee"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                    >
                      <LogOut size={16} />Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {pageHeaderActions}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: "28px 28px", display: "flex", flexDirection: "column", minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}


