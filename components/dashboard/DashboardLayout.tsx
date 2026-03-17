"use client";

import { ReactNode, useState, useRef, useEffect } from "react";
import { T } from "@/lib/theme";

export type DashPage =
  | "dashboard" | "nearest-events"
  | "daily-deal-flow" | "lead-pipeline"
  | "call-center-lead-intake"
  | "users-access" | "pipeline-management"
  | "carrier-management" | "bpo-centres";

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

const SIDEBAR_W  = 210;
const SIDEBAR_SM = 64;

const NAV_ITEMS: { id: DashPage; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: "dashboard",        label: "Overview",         Icon: DashboardIcon },
  { id: "daily-deal-flow",  label: "Daily Deal Flow",  Icon: ProjectsIcon },
  { id: "lead-pipeline",    label: "Lead Pipeline",    Icon: VacationsIcon },
  { id: "call-center-lead-intake", label: "Transfer Leads", Icon: EmployeesIcon },
  { id: "users-access",     label: "Users & Access",   Icon: MessengerIcon },
  { id: "pipeline-management", label: "Pipelines",     Icon: InfoPortalIcon },
  { id: "carrier-management", label: "Carriers",       Icon: ProjectsIcon },
  { id: "bpo-centres",      label: "BPO Centres",      Icon: VacationsIcon },
];

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
  const [collapsed, setCollapsed]             = useState(false);
  const [showNotif,  setShowNotif]            = useState(false);
  const [showUser,   setShowUser]             = useState(false);
  const [notifs,     setNotifs]               = useState(NOTIFICATIONS);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef  = useRef<HTMLDivElement>(null);

  const unread     = notifs.filter((n) => !n.read).length;
  const sidebarW   = collapsed ? SIDEBAR_SM : SIDEBAR_W;
  const activeNav  = activePage === "nearest-events" ? "dashboard" : activePage;
  const visiblePageSet = new Set<DashPage>(visiblePages ?? NAV_ITEMS.map((item) => item.id));

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
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: T.pageBg, fontFamily: T.font }}>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside style={{
        width: sidebarW, flexShrink: 0, backgroundColor: T.sidebarBg,
        display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100,
        boxShadow: "none", borderRight: "1px solid #ffffff",
        transition: "width 0.22s cubic-bezier(.4,0,.2,1)", overflow: "hidden",
        paddingTop: 28, paddingBottom: 24,
      }}>

        {/* Logo row */}
        <div style={{ padding: `0 ${collapsed ? 8 : 20}px`, marginBottom: 32, display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", transition: "padding 0.22s" }}>
          <div
            onClick={() => onNavigate("dashboard")}
            style={{
              width: 44, height: 44, backgroundColor: T.blue, borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
              boxShadow: `0 4px 12px ${T.blue}44`,
              transition: "transform 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.07)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
          >
            <svg width="24" height="24" viewBox="0 0 26 26" fill="none">
              <path d="M10.5 4C10.5 2.895 11.395 2 12.5 2H13.5C14.605 2 15.5 2.895 15.5 4V5H18.5C19.605 5 20.5 5.895 20.5 7V10H21.5C22.605 10 23.5 10.895 23.5 12V13C23.5 14.105 22.605 15 21.5 15H20.5V18C20.5 19.105 19.605 20 18.5 20H15.5V21C15.5 22.105 14.605 23 13.5 23H12.5C11.395 23 10.5 22.105 10.5 21V20H7.5C6.395 20 5.5 19.105 5.5 18V15H4.5C3.395 15 2.5 14.105 2.5 13V12C2.5 10.895 3.395 10 4.5 10H5.5V7C5.5 5.895 6.395 5 7.5 5H10.5V4Z" fill="white" />
            </svg>
          </div>

          {!collapsed && (
            <button onClick={() => setCollapsed(true)} style={{
              background: "none", border: "none", cursor: "pointer", padding: 6,
              borderRadius: 8, color: T.textMuted, transition: "background-color 0.15s, color 0.15s",
            }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = T.rowBg; el.style.color = T.blue; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = "transparent"; el.style.color = T.textMuted; }}
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
              borderRadius: 8, color: T.textMuted, transition: "background-color 0.15s, color 0.15s",
            }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = T.rowBg; el.style.color = T.blue; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = "transparent"; el.style.color = T.textMuted; }}
              title="Expand sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: `0 ${collapsed ? 8 : 12}px`, transition: "padding 0.22s" }}>
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
                  gap: collapsed ? 0 : 10, justifyContent: collapsed ? "center" : "flex-start",
                  width: "100%", padding: collapsed ? "10px 0" : "10px 12px",
                  borderRadius: T.radiusSm, border: "none", cursor: "pointer",
                  backgroundColor: isActive ? T.blue : "transparent",
                  color: isActive ? "#ffffff" : T.textMuted,
                  fontSize: 14, fontWeight: isActive ? 700 : 600,
                  marginBottom: 4, fontFamily: T.font,
                  transition: "background-color 0.15s, color 0.15s",
                  overflow: "hidden", whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = T.rowBg; el.style.color = T.blue; } }}
                onMouseLeave={(e) => { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = "transparent"; el.style.color = T.textMuted; } }}
              >
                <span style={{ flexShrink: 0, display: "flex" }}><Icon active={isActive} /></span>
                {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Support widget – hidden when collapsed */}
        {!collapsed && (
          <div style={{ padding: "0 12px", marginBottom: 20 }}>
            <div style={{ backgroundColor: T.rowBg, borderRadius: T.radiusLg, padding: "14px 12px 12px", textAlign: "center" }}>
              <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>
                <MiniSupportIllustration />
              </div>
              <button
                id="sidebar-support-btn"
                onClick={onSupportClick}
                style={{
                  backgroundColor: T.blue, color: "#ffffff", border: "none",
                  borderRadius: T.radiusSm, padding: "9px 0", width: "100%",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontFamily: T.font, transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.blueHover; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.blue; }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="white" strokeWidth="1.5" /><path d="M5.5 5.5C5.5 4.67 6.17 4 7 4C7.83 4 8.5 4.67 8.5 5.5C8.5 6.17 8.05 6.73 7.44 6.92C7.18 7 7 7.24 7 7.5V8" stroke="white" strokeWidth="1.5" strokeLinecap="round" /><circle cx="7" cy="9.75" r="0.5" fill="white" /></svg>
                Support
              </button>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          id="sidebar-logout-btn"
          onClick={onSignOut}
          title={collapsed ? "Logout" : undefined}
          style={{
            display: "flex", alignItems: "center",
            gap: collapsed ? 0 : 10, justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? "10px 0" : "10px 24px",
            border: "none", background: "none", cursor: "pointer",
            color: T.textMuted, fontSize: 14, fontWeight: 600,
            fontFamily: T.font, transition: "color 0.15s", width: "100%",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.danger; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.textMuted; }}
        >
          <LogoutIcon />
          {!collapsed && <span>Logout</span>}
        </button>
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
          display: "flex", alignItems: "center", padding: "0 28px", gap: 16,
          position: "sticky", top: 0, zIndex: 50,
          borderBottom: `1px solid #ffffff`,
        }}>
          {/* Search */}
          <div style={{ flex: 1, maxWidth: 340, position: "relative" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="7" cy="7" r="5.5" stroke={T.textMuted} strokeWidth="1.5" />
              <path d="M11 11L14 14" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              id="global-search"
              type="text"
              placeholder="Search leads, deals, and users..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                width: "100%", padding: "9px 14px 9px 38px",
                border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd,
                fontSize: 13, color: T.textMid, backgroundColor: T.rowBg,
                fontFamily: T.font, transition: "border-color 0.15s, background-color 0.15s",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.backgroundColor = T.cardBg; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.backgroundColor = T.rowBg; }}
            />
          </div>

          <div style={{ flex: 1 }} />

          {/* Notification bell */}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button
              id="header-notification-btn"
              onClick={() => { setShowNotif((v) => !v); setShowUser(false); }}
              style={{
                background: showNotif ? T.rowBg : "none", border: "none", cursor: "pointer",
                padding: 8, borderRadius: T.radiusSm, display: "flex", alignItems: "center",
                justifyContent: "center", position: "relative", transition: "background-color 0.15s",
              }}
              onMouseEnter={(e) => { if (!showNotif) (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; }}
              onMouseLeave={(e) => { if (!showNotif) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2C10 2 6 4 6 9V13L4 15H16L14 13V9C14 4 10 2 10 2Z" stroke={T.textMuted} strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M8.5 15.5C8.5 16.33 9.17 17 10 17C10.83 17 11.5 16.33 11.5 15.5" stroke={T.textMuted} strokeWidth="1.5" />
              </svg>
              {unread > 0 && (
                <span style={{ position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: "50%", backgroundColor: T.danger, border: `2px solid ${T.sidebarBg}` }} />
              )}
            </button>

            {showNotif && (
              <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, width: 310, backgroundColor: T.cardBg, borderRadius: T.radiusLg, boxShadow: T.shadowLg, border: `1px solid ${T.border}`, zIndex: 200, overflow: "hidden", animation: "fadeInDown 0.15s ease" }}>
                <div style={{ padding: "13px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.borderLight}` }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.textDark }}>Notifications</span>
                  {unread > 0 && <button onClick={markAllRead} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.blue, fontFamily: T.font }}>Mark all read</button>}
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
                  <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.blue, fontFamily: T.font }}>View all notifications</button>
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div ref={userRef} style={{ position: "relative" }}>
            <div
              id="header-user-menu-btn"
              onClick={() => { setShowUser((v) => !v); setShowNotif(false); }}
              style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 10px", borderRadius: T.radiusMd, backgroundColor: showUser ? T.rowBg : "transparent", transition: "background-color 0.15s" }}
              onMouseEnter={(e) => { if (!showUser) (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; }}
              onMouseLeave={(e) => { if (!showUser) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
            >
              <div style={{ width: 34, height: 34, borderRadius: "50%", backgroundColor: T.blue, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{userInitials}</div>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.textDark }}>{userDisplayName}</span>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ transition: "transform 0.18s", transform: showUser ? "rotate(180deg)" : "rotate(0)" }}>
                <path d="M3 4.5L6 7.5L9 4.5" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {showUser && (
              <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, width: 196, backgroundColor: T.cardBg, borderRadius: T.radiusLg, boxShadow: T.shadowLg, border: `1px solid ${T.border}`, zIndex: 200, overflow: "hidden", animation: "fadeInDown 0.15s ease" }}>
                <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.borderLight}` }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.textDark }}>{userDisplayName}</p>
                  <p style={{ margin: 0, fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{userEmail}</p>
                </div>
                {["My Profile", "Account Settings", "Notifications"].map((label) => (
                  <button key={label} style={{ width: "100%", display: "block", padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.textMid, textAlign: "left", transition: "background-color 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                  >{label}</button>
                ))}
                <div style={{ borderTop: `1px solid ${T.borderLight}` }}>
                  <button onClick={onSignOut} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: T.font, fontSize: 13, fontWeight: 700, color: T.danger, textAlign: "left", transition: "background-color 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fff5f5"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                  >
                    <LogoutIcon />Sign out
                  </button>
                </div>
              </div>
            )}
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
  const c = active ? "#fff" : T.textMuted;
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="6" height="6" rx="2" fill={c} /><rect x="11" y="1" width="6" height="6" rx="2" fill={c} /><rect x="1" y="11" width="6" height="6" rx="2" fill={c} /><rect x="11" y="11" width="6" height="6" rx="2" fill={c} /></svg>;
}
function ProjectsIcon({ active }: { active: boolean }) {
  const c = active ? "#fff" : T.textMuted;
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4C2 2.9 2.9 2 4 2H7L9 5H14C15.1 5 16 5.9 16 7V14C16 15.1 15.1 16 14 16H4C2.9 16 2 15.1 2 14V4Z" stroke={c} strokeWidth="1.5" /></svg>;
}
function CalendarIcon({ active }: { active: boolean }) {
  const c = active ? "#fff" : T.textMuted;
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="13" rx="2" stroke={c} strokeWidth="1.5" /><path d="M5 2V5M13 2V5" stroke={c} strokeWidth="1.5" strokeLinecap="round" /><path d="M2 8H16" stroke={c} strokeWidth="1.5" /></svg>;
}
function VacationsIcon({ active }: { active: boolean }) {
  const c = active ? "#fff" : T.textMuted;
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L11 7H16L12 10L14 15L9 12L4 15L6 10L2 7H7L9 2Z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}
function EmployeesIcon({ active }: { active: boolean }) {
  const c = active ? "#fff" : T.textMuted;
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="6" r="3.5" stroke={c} strokeWidth="1.5" /><path d="M2 16C2 13.24 5.13 11 9 11C12.87 11 16 13.24 16 16" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function MessengerIcon({ active }: { active: boolean }) {
  const c = active ? "#fff" : T.textMuted;
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M16 9C16 12.87 12.87 16 9 16C7.82 16 6.7 15.7 5.73 15.18L2 16L2.82 12.27C2.3 11.3 2 10.18 2 9C2 5.13 5.13 2 9 2C12.87 2 16 5.13 16 9Z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}
function InfoPortalIcon({ active }: { active: boolean }) {
  const c = active ? "#fff" : T.textMuted;
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 5H15M3 9H15M3 13H10" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function LogoutIcon() {
  return <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M11 3H14C15.1 3 16 3.9 16 5V13C16 14.1 15.1 15 14 15H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M7 12L11 9L7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M11 9H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function MiniSupportIllustration() {
  return (
    <svg width="80" height="68" viewBox="0 0 80 68" fill="none">
      <rect x="8" y="50" width="64" height="5" rx="2.5" fill="#c7d5e8" />
      <rect x="24" y="30" width="34" height="24" rx="4" fill="#fff" stroke="#c7d5e8" strokeWidth="1.5" />
      <rect x="26" y="32" width="30" height="18" rx="2" fill={T.blueLight} />
      <path d="M20 54 L60 54 L57 50 L23 50Z" fill="#d1d5db" />
      <circle cx="52" cy="20" r="8" fill="#fde68a" />
      <path d="M44 19 Q44 10 52 9 Q60 10 60 19 Q60 14 56.5 13 Q54 11 52 11 Q50 11 47.5 13 Q44 14 44 19Z" fill="#1e1b4b" />
      <ellipse cx="52" cy="28" rx="7" ry="9" fill="#f9a8d4" />
      <rect x="12" y="38" width="14" height="12" rx="3" fill="#60a5fa" />
      <line x1="19" y1="36" x2="19" y2="26" stroke="#4ade80" strokeWidth="1.5" />
      <ellipse cx="19" cy="28" rx="6" ry="8" fill="#66d88a" opacity="0.8" />
    </svg>
  );
}
