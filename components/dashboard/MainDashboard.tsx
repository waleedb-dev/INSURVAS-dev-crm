"use client";

import { useState, useMemo } from "react";
import { T } from "@/lib/theme";

// Alias so we don't need to touch every reference below
const C = {
  bg: T.pageBg, white: T.cardBg, blue: T.blue,
  textDark: T.textDark, textMid: T.textMid, textMuted: T.textMuted,
  border: T.border, arrowUp: T.priorityHigh, arrowDown: T.priorityLow,
};

// ── Data ─────────────────────────────────────────────────────────────────────
const MEMBERS = [
  { initials: "SS", name: "Shawn Stone",    role: "UI/UX Designer", level: "Middle", color: "#4285f4", tasks: 8,  done: 5,  skills: ["Figma","Prototyping","User Research"] },
  { initials: "RD", name: "Randy Delgado",  role: "UI/UX Designer", level: "Junior", color: "#f59e0b", tasks: 4,  done: 2,  skills: ["Figma","Illustration"] },
  { initials: "ET", name: "Emily Tyler",    role: "Copywriter",     level: "Middle", color: "#ec4899", tasks: 11, done: 7,  skills: ["SEO","Content Strategy","Editing"] },
  { initials: "LC", name: "Louis Castro",   role: "Copywriter",     level: "Senior", color: "#8b5cf6", tasks: 14, done: 12, skills: ["Brand Voice","Copy","Content"] },
  { initials: "BS", name: "Blake Silva",    role: "IOS Developer",  level: "Senior", color: "#0ea5e9", tasks: 19, done: 16, skills: ["Swift","Xcode","UIKit","Core Data"] },
  { initials: "JP", name: "Joel Phillips",  role: "UI/UX Designer", level: "Middle", color: "#14b8a6", tasks: 7,  done: 4,  skills: ["Figma","Design Systems"] },
  { initials: "WM", name: "Wayne Marsh",    role: "Copywriter",     level: "Junior", color: "#64748b", tasks: 3,  done: 1,  skills: ["Blogging","Research"] },
  { initials: "OH", name: "Oscar Holloway", role: "UI/UX Designer", level: "Middle", color: "#f97316", tasks: 9,  done: 6,  skills: ["Figma","Motion","Illustration"] },
];

const PROJECTS = [
  {
    id: "PN0001265", name: "Medical App (iOS native)", created: "Sep 12, 2020",
    priority: "Medium" as const, allTasks: 34, activeTasks: 13,
    assignees: ["#4285f4","#f59e0b","#ec4899","#8b5cf6"], extraAssignees: 2,
    emoji: "💊", color: "#e8edf8", progress: 38,
    description: "A fully native iOS medical application for patient management, appointment scheduling, and telemedicine consultations.",
    tags: ["iOS","Healthcare","Mobile"],
  },
  {
    id: "PN0001221", name: "Food Delivery Service", created: "Sep 10, 2020",
    priority: "Medium" as const, allTasks: 50, activeTasks: 24,
    assignees: ["#14b8a6","#f97316","#0ea5e9"], extraAssignees: 0,
    emoji: "🍔", color: "#f0fdf4", progress: 52,
    description: "End-to-end food delivery platform with real-time order tracking, restaurant dashboard, and driver apps.",
    tags: ["Web","Mobile","Logistics"],
  },
  {
    id: "PN0001290", name: "Food Delivery Service", created: "May 28, 2020",
    priority: "Low" as const, allTasks: 23, activeTasks: 20,
    assignees: ["#4285f4","#ec4899","#8b5cf6"], extraAssignees: 5,
    emoji: "📦", color: "#fdf4ff", progress: 86,
    description: "Cloud-based logistics platform.",
    tags: ["Web","Logistics"],
  },
];

const ACTIVITIES = [
  { 
    id: 1, 
    user: "Oscar Holloway", role: "UI/UX Designer", 
    avatar: "OH", color: "#f97316",
    action: "Updated the status of Mind Map task to In Progress",
    time: "2 mins ago", icon: "☁️"
  },
  { 
    id: 2, 
    user: "System", role: "Automated Service", 
    avatar: "?", color: T.blue,
    action: "Attached files to the task",
    time: "10 mins ago", icon: "📎"
  },
  { 
    id: 3, 
    user: "Emily Tyler", role: "Copywriter", 
    avatar: "ET", color: "#ec4899",
    action: "Updated the status of Mind Map task to In Progress",
    time: "45 mins ago", icon: "☁️"
  }
];

const NEAREST_EVENTS = [
  { title: "Presentation of the new department", time: "Today | 5:00 PM", icon: "🔥", color: "#f59e0b" },
  { title: "Anna's Birthday", time: "Today | 6:00 PM", icon: "⏲️", color: "#16a34a" },
  { title: "Ray's Birthday", time: "Tomorrow | 2:00 PM", icon: "⏲️", color: "#16a34a" },
];

interface Props { onViewAllEvents: () => void; searchQuery: string; }

export default function MainDashboard({ onViewAllEvents, searchQuery }: Props) {
  const [selectedMember, setSelectedMember] = useState<typeof MEMBERS[0] | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const q = searchQuery.toLowerCase().trim();

  const filteredMembers = useMemo(() =>
    MEMBERS.filter((m) => !q || m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q) || m.level.toLowerCase().includes(q)),
    [q]);

  const filteredProjects = useMemo(() =>
    PROJECTS.filter((p) => !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))),
    [q]);

  return (
    <div style={{ padding: "0" }}>
      {/* Welcome + date - Figma Style */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", width: "100%", maxWidth: 1125, marginBottom: 32 }}>
        <div>
          <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>Welcome back, Evan!</p>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: T.textDark, margin: 0 }}>Dashboard</h1>
        </div>
        
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ backgroundColor: "#eff6ff", borderRadius: T.radiusMd, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, border: `1px solid ${T.blue}22` }}>
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
             <span style={{ fontSize: 13, fontWeight: 700, color: T.blue }}>Nov 16, 2020 - Dec 16, 2020</span>
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* ── Left/main column: Workload (781x470) ── */}
        <div style={{ 
          backgroundColor: "#ffffff", 
          borderRadius: T.radiusXl, 
          border: `1.5px solid ${T.border}`, 
          padding: "24px", 
          width: 781, 
          height: 470, 
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, margin: 0 }}>Workload</h2>
            <button style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              View all <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
            {filteredMembers.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 13, color: T.textMuted, fontWeight: 600 }}>No members found</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {filteredMembers.map((m) => (
                  <MemberCard key={m.name} {...m} onClick={() => setSelectedMember(m)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: Nearest Events (320x470) ── */}
        <div style={{ 
          backgroundColor: "#ffffff", 
          borderRadius: T.radiusXl, 
          border: `1.5px solid ${T.border}`, 
          padding: "24px", 
          width: 320,
          height: 470,
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, margin: 0 }}>Nearest Events</h3>
            <button onClick={onViewAllEvents} style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              View all <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {NEAREST_EVENTS.map((ev, idx) => (
              <div key={idx} style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingLeft: 12, borderLeft: `3px solid ${ev.color}` }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: T.textDark, lineHeight: 1.3 }}>{ev.title}</p>
                  <p style={{ margin: 0, fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{ev.time}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.textMuted }}>
                   <span style={{ fontSize: 14 }}>{ev.icon}</span>
                   <span style={{ fontSize: 12, fontWeight: 700 }}>4h</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, marginTop: 32, alignItems: "stretch" }}>
        {/* ── Bottom Left: Daily Deal Flow (781px) ── */}
        <div style={{ width: 781, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: T.textDark, margin: 0 }}>Daily Deal Flow</h2>
            <button style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              View all <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            {filteredProjects.map((p) => (
              <ProjectCard key={p.id} {...p} />
            ))}
          </div>
        </div>

        {/* ── Bottom Right: Activity Stream (320px) ── */}
        <div style={{ width: 320, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: T.textDark, margin: 0 }}>Activity Stream</h3>
          </div>
          
          <div style={{ 
            backgroundColor: "#ffffff", 
            borderRadius: T.radiusXl, 
            border: `1.5px solid ${T.border}`, 
            padding: "20px", 
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
            display: "flex",
            flexDirection: "column",
            flex: 1
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {ACTIVITIES.map((act) => (
                <div key={act.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: act.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800 }}>
                      {act.avatar}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.textDark, lineHeight: 1 }}>{act.user}</p>
                      <p style={{ margin: 0, fontSize: 10, color: T.textMuted }}>{act.role}</p>
                    </div>
                  </div>
                  <div style={{ backgroundColor: "#f0f4ff", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 12 }}>{act.icon}</span>
                    <p style={{ margin: 0, fontSize: 11, color: T.textDark, fontWeight: 600, lineHeight: 1.3 }}>{act.action}</p>
                  </div>
                </div>
              ))}
            </div>

            <button style={{ background: "none", border: "none", color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: "auto", paddingTop: 16 }}>
              View more <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Member Drawer */}
      {selectedMember && (
        <MemberDrawer member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MemberCard({ initials, name, role, level, color, onClick }: any) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: T.pageBg,
        borderRadius: 14, padding: "16px 12px 14px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        cursor: "pointer", transition: "all 0.18s",
        border: `1px solid ${T.border}`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ width: 48, height: 48, borderRadius: "50%", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: color + "15", marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color }}>{initials}</span>
      </div>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: T.textDark, textAlign: "center" }}>{name}</p>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: T.textMuted, textAlign: "center" }}>{role}</p>
      <span style={{ borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700, color: T.textMuted, backgroundColor: T.rowBg, marginTop: 4 }}>{level}</span>
    </div>
  );
}


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

function MemberDrawer({ member, onClose }: any) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.2)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 340, backgroundColor: "#fff", zIndex: 301, padding: 24, boxShadow: "-8px 0 40px rgba(0,0,0,0.1)" }}>
        <h2>{member.name}</h2>
        <button onClick={onClose}>Close</button>
      </div>
    </>
  );
}
