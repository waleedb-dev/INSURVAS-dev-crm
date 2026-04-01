"use client";

import { ReactNode, useState, useRef, useEffect } from "react";
import { T } from "@/lib/theme";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";

export type DashPage =
  | "dashboard" | "nearest-events"
  | "daily-deal-flow" | "lead-pipeline"
  | "call-center-lead-intake"
  | "users-access" | "pipeline-management"
  | "carrier-management" | "bpo-centres"
  | "commissions" | "policies"
  | "imo-management"
  | "upline-carrier-states";

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
}

const SIDEBAR_W  = 230;
const SIDEBAR_SM = 64;

const NAV_ITEMS: { id: DashPage; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: "dashboard",        label: "Overview",         Icon: DashboardIcon },
  { id: "daily-deal-flow",  label: "Daily Deal Flow",  Icon: ProjectsIcon },
  { id: "lead-pipeline",    label: "Lead Pipeline",    Icon: VacationsIcon },
  { id: "call-center-lead-intake", label: "Transfer Leads", Icon: EmployeesIcon },
  { id: "commissions",      label: "Commissions",      Icon: CommissionsIcon },
  { id: "policies",         label: "Policies",         Icon: PoliciesIcon },
  { id: "users-access",     label: "Users & Access",   Icon: MessengerIcon },
  { id: "pipeline-management", label: "Pipelines",     Icon: InfoPortalIcon },
  { id: "carrier-management", label: "Carriers",       Icon: ProjectsIcon },
  { id: "bpo-centres",      label: "BPO Centres",      Icon: VacationsIcon },
  { id: "imo-management",   label: "IMO Management",   Icon: InfoPortalIcon },
  { id: "upline-carrier-states", label: "Upline States", Icon: InfoPortalIcon },
];

const PAGE_TITLE: Record<DashPage, string> = {
  dashboard: "Overview",
  "nearest-events": "Nearest Events",
  "daily-deal-flow": "Daily Deal Flow",
  "lead-pipeline": "Lead Pipeline",
  "call-center-lead-intake": "Transfer Leads",
  "users-access": "Users & Access",
  "pipeline-management": "Pipelines",
  "carrier-management": "Carriers",
  "bpo-centres": "BPO Centres",
  commissions: "Commissions",
  policies: "Policies",
  "imo-management": "IMO Management",
  "upline-carrier-states": "Upline States",
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
}: Props) {
  const { pageHeaderTitle, pageHeaderActions } = useDashboardContext();
  const [collapsed, setCollapsed]             = useState(false);
  const [showNotif,  setShowNotif]            = useState(false);
  const [showUser,   setShowUser]             = useState(false);
  const [hoveredNav, setHoveredNav]           = useState<string | null>(null);
  const [notifs,     setNotifs]               = useState(NOTIFICATIONS);
  const [isDark,     setIsDark]               = useState(false);

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
        backgroundColor: T.asideChrome,
        display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100,
        borderRight: "1px solid rgba(255,255,255,0.1)",
        transition: "width 0.22s cubic-bezier(.4,0,.2,1)",
        /* visible so account / notification panels (position absolute; left: 100%) are not clipped */
        overflow: "visible",
        paddingTop: 24, paddingBottom: 20,
      }}>

        {/* Logo row */}
        <div style={{
          padding: `0 ${collapsed ? 12 : 20}px`,
          marginBottom: 28,
          display: "flex", alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          transition: "padding 0.22s",
        }}>
          <div
            onClick={() => onNavigate("dashboard")}
            style={{
              height: 40,
              width: collapsed ? 40 : 150,
              display: "flex", alignItems: "center", justifyContent: "flex-start",
              cursor: "pointer", flexShrink: 0,
              transition: "transform 0.15s, width 0.22s",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.02)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
          >
            <img 
              src={collapsed ? "/logo-collapsed.png" : "/logo-expanded.png"} 
              alt="Logo" 
              style={{ 
                width: "100%", 
                height: "100%", 
                objectFit: "contain", 
                objectPosition: "left center",
                filter: "brightness(0) invert(1)", // Always white logo
                transition: "filter 0.3s" 
              }} 
            />
          </div>

          {!collapsed && (
            <button onClick={() => setCollapsed(true)} style={{
              background: "none", border: "none", cursor: "pointer", padding: 6,
              borderRadius: 6, color: "#a1a1aa", transition: "color 0.15s",
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#a1a1aa"; }}
              title="Collapse sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <button onClick={() => setCollapsed(false)} style={{
              background: "none", border: "none", cursor: "pointer", padding: 6,
              borderRadius: 6, color: "#a1a1aa", transition: "color 0.15s",
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#a1a1aa"; }}
              title="Expand sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        )}

        {/* Search bar */}
        {!collapsed && (
          <div style={{ padding: "0 16px", marginBottom: 24 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 8,
              padding: "8px 12px",
              cursor: "text",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search..."
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: "#fff", fontSize: 13, fontFamily: T.font,
                  minWidth: 0,
                }}
              />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: `0 ${collapsed ? 8 : 12}px`, overflowY: "auto", transition: "padding 0.22s" }}>
          {NAV_ITEMS.filter((item) => visiblePageSet.has(item.id)).map(({ id, label, Icon }) => {
            const isActive = id === activeNav;
            return (
              <button
                key={id}
                id={`nav-${id}`}
                onClick={() => onNavigate(id)}
                title={collapsed ? label : undefined}
                style={{
                  display: "flex", alignItems: "center",
                  gap: collapsed ? 0 : 12,
                  justifyContent: collapsed ? "center" : "flex-start",
                  width: "100%",
                  padding: collapsed ? "10px 0" : "10px 14px",
                  borderRadius: 8, border: "none", cursor: "pointer",
                  backgroundColor: isActive ? "rgba(255, 255, 255, 0.1)" : (hoveredNav === id ? "rgba(255, 255, 255, 0.05)" : "transparent"),
                  color: isActive ? "#fff" : (hoveredNav === id ? "#fff" : "#a1a1aa"),
                  fontSize: 14, fontWeight: isActive ? 600 : 500,
                  marginBottom: 2, fontFamily: T.font,
                  transition: "color 0.15s, background-color 0.15s",
                  overflow: "hidden", whiteSpace: "nowrap",
                  textAlign: "left",
                }}
                onMouseEnter={() => setHoveredNav(id)}
                onMouseLeave={() => setHoveredNav(null)}
              >
                <span style={{ flexShrink: 0, display: "flex" }}><Icon active={isActive} /></span>
                {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer: notifications, appearance, account (matches reference dashboards) */}
        <div style={{ padding: `10px ${collapsed ? 8 : 12}px 0`, borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: "auto", paddingTop: 14, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <div ref={notifRef} style={{ position: "relative", width: "100%" }}>
            <button
              id="sidebar-notification-btn"
              type="button"
              onClick={() => { setShowNotif((v) => !v); setShowUser(false); }}
              title="Notifications"
              style={{
                display: "flex", alignItems: "center",
                gap: collapsed ? 0 : 12,
                justifyContent: collapsed ? "center" : "flex-start",
                width: "100%",
                padding: collapsed ? "10px 0" : "10px 14px",
                border: "none", borderRadius: 8, cursor: "pointer",
                background: showNotif ? "rgba(255,255,255,0.08)" : "transparent",
                color: "#a1a1aa", fontFamily: T.font, fontSize: 14, fontWeight: 500,
                transition: "background-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => { if (!showNotif) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
              onMouseLeave={(e) => { if (!showNotif) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "#a1a1aa"; }}
            >
              <span style={{ position: "relative", display: "flex", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2C10 2 6 4 6 9V13L4 15H16L14 13V9C14 4 10 2 10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M8.5 15.5C8.5 16.33 9.17 17 10 17C10.83 17 11.5 16.33 11.5 15.5" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                {unread > 0 && (
                  <span style={{ position: "absolute", top: -2, right: -2, width: 7, height: 7, borderRadius: "50%", backgroundColor: T.danger, border: `2px solid ${T.asideChrome}` }} />
                )}
              </span>
              {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Notifications</span>}
            </button>
            {showNotif && (
              <div style={{ position: "absolute", left: "100%", marginLeft: 10, bottom: 0, width: 310, backgroundColor: T.cardBg, borderRadius: T.radiusLg, boxShadow: T.shadowLg, border: `1px solid ${T.border}`, zIndex: 250, overflow: "hidden", animation: "fadeInDown 0.15s ease" }}>
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

          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              display: "flex", alignItems: "center",
              gap: collapsed ? 0 : 12,
              justifyContent: collapsed ? "center" : "flex-start",
              width: "100%",
              padding: collapsed ? "10px 0" : "10px 14px",
              border: "none", borderRadius: 8, cursor: "pointer", background: "none",
              color: "#a1a1aa", fontFamily: T.font, fontSize: 14, fontWeight: 500,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#a1a1aa"; }}
          >
            <span style={{ display: "flex", flexShrink: 0 }}>
              {isDark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </span>
            {!collapsed && <span>Appearance</span>}
          </button>

          <div ref={userRef} style={{ position: "relative", width: "100%" }}>
            <button
              type="button"
              id="sidebar-user-menu-btn"
              onClick={() => { setShowUser((v) => !v); setShowNotif(false); }}
              title={userDisplayName}
              style={{
                display: "flex", alignItems: "center",
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? "center" : "flex-start",
                width: "100%",
                padding: collapsed ? "10px 0" : "10px 14px",
                border: "none", borderRadius: 8, cursor: "pointer",
                background: showUser ? "rgba(255,255,255,0.08)" : "transparent",
                color: "#fff", fontFamily: T.font, transition: "background-color 0.15s",
              }}
              onMouseEnter={(e) => { if (!showUser) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={(e) => { if (!showUser) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
            >
              <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: T.blue, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{userInitials}</div>
              {!collapsed && (
                <>
                  <span style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0, textAlign: "left", color: "#fff" }}>{userDisplayName}</span>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transition: "transform 0.18s", transform: showUser ? "rotate(180deg)" : "rotate(0)" }}>
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
            {showUser && (
              <div style={{ position: "absolute", left: "100%", marginLeft: 10, bottom: 0, width: 220, backgroundColor: T.cardBg, borderRadius: T.radiusLg, boxShadow: T.shadowLg, border: `1px solid ${T.border}`, zIndex: 250, overflow: "hidden", animation: "fadeInDown 0.15s ease" }}>
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
                <button type="button" onClick={() => { onSupportClick(); setShowUser(false); }} style={{ width: "100%", display: "block", padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.textMid, textAlign: "left", transition: "background-color 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >Help &amp; Support</button>
                <div style={{ borderTop: `1px solid ${T.borderLight}` }}>
                  <button type="button" id="sidebar-logout-btn" onClick={() => { setShowUser(false); onSignOut(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: T.font, fontSize: 13, fontWeight: 700, color: T.danger, textAlign: "left", transition: "background-color 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#f2f8ee"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                  >
                    <LogoutIcon />Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
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

          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12, minHeight: 44 }}>
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

// ── Icons ─────────────────────────────────────────────────────────────────────
function DashboardIcon({ active }: { active: boolean }) {
  const c = "currentColor";
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="6" height="6" rx="2" fill={c} /><rect x="11" y="1" width="6" height="6" rx="2" fill={c} /><rect x="1" y="11" width="6" height="6" rx="2" fill={c} /><rect x="11" y="11" width="6" height="6" rx="2" fill={c} /></svg>;
}
function ProjectsIcon({ active }: { active: boolean }) {
  const c = "currentColor";
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4C2 2.9 2.9 2 4 2H7L9 5H14C15.1 5 16 5.9 16 7V14C16 15.1 15.1 16 14 16H4C2.9 16 2 15.1 2 14V4Z" stroke={c} strokeWidth="1.5" /></svg>;
}
function CalendarIcon({ active }: { active: boolean }) {
  const c = "currentColor";
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="13" rx="2" stroke={c} strokeWidth="1.5" /><path d="M5 2V5M13 2V5" stroke={c} strokeWidth="1.5" strokeLinecap="round" /><path d="M2 8H16" stroke={c} strokeWidth="1.5" /></svg>;
}
function VacationsIcon({ active }: { active: boolean }) {
  const c = "currentColor";
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L11 7H16L12 10L14 15L9 12L4 15L6 10L2 7H7L9 2Z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}
function EmployeesIcon({ active }: { active: boolean }) {
  const c = "currentColor";
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="6" r="3.5" stroke={c} strokeWidth="1.5" /><path d="M2 16C2 13.24 5.13 11 9 11C12.87 11 16 13.24 16 16" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function MessengerIcon({ active }: { active: boolean }) {
  const c = "currentColor";
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M16 9C16 12.87 12.87 16 9 16C7.82 16 6.7 15.7 5.73 15.18L2 16L2.82 12.27C2.3 11.3 2 10.18 2 9C2 5.13 5.13 2 9 2C12.87 2 16 5.13 16 9Z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}
function InfoPortalIcon({ active }: { active: boolean }) {
  const c = "currentColor";
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 5H15M3 9H15M3 13H10" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function LogoutIcon() {
  return <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M11 3H14C15.1 3 16 3.9 16 5V13C16 14.1 15.1 15 14 15H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M7 12L11 9L7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M11 9H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function CommissionsIcon({ active }: { active: boolean }) {
  const c = "currentColor";
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke={c} strokeWidth="1.5" /><path d="M9 5v1.5M9 11.5V13M7 8c0-1.1.9-2 2-2s2 .9 2 2-2 2-2 2-2 .9-2 2" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function PoliciesIcon({ active }: { active: boolean }) {
  const c = "currentColor";
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="2" width="12" height="14" rx="2" stroke={c} strokeWidth="1.5" /><path d="M6 6h6M6 9h6M6 12h4" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function MiniSupportIllustration() {
  return (
    <svg width="80" height="68" viewBox="0 0 80 68" fill="none">
      <rect x="8" y="50" width="64" height="5" rx="2.5" fill="#c7d5e8" />
      <rect x="24" y="30" width="34" height="24" rx="4" fill="#fff" stroke="#c7d5e8" strokeWidth="1.5" />
      <rect x="26" y="32" width="30" height="18" rx="2" fill={T.blueLight} />
      <path d="M20 54 L60 54 L57 50 L23 50Z" fill="#c8d4bb" />
      <circle cx="52" cy="20" r="8" fill="#fde68a" />
      <path d="M44 19 Q44 10 52 9 Q60 10 60 19 Q60 14 56.5 13 Q54 11 52 11 Q50 11 47.5 13 Q44 14 44 19Z" fill="#1e1b4b" />
      <ellipse cx="52" cy="28" rx="7" ry="9" fill="#f9a8d4" />
      <rect x="12" y="38" width="14" height="12" rx="3" fill="#60a5fa" />
      <line x1="19" y1="36" x2="19" y2="26" stroke="#4ade80" strokeWidth="1.5" />
      <ellipse cx="19" cy="28" rx="6" ry="8" fill="#66d88a" opacity="0.8" />
    </svg>
  );
}
