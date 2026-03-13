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
    id: "PN0001290", name: "Corporate Portal Redesign", created: "May 28, 2020",
    priority: "Low" as const, allTasks: 23, activeTasks: 20,
    assignees: ["#64748b","#4285f4","#ec4899","#8b5cf6"], extraAssignees: 5,
    emoji: "🛵", color: "#fdf4ff", progress: 87,
    description: "Redesign of the company's internal HR and information portal with modern UX and accessibility improvements.",
    tags: ["Design","HR","Internal"],
  },
];

const NEAREST_EVENTS = [
  { title: "Presentation of the new department", time: "Today | 5:00 PM", duration: "4h", accent: C.blue, direction: "up" as const },
  { title: "Anna's Birthday", time: "Today | 6:00 PM", duration: "4h", accent: "#e879a0", direction: "down" as const },
  { title: "Ray's Birthday", time: "Tomorrow | 2:00 PM", duration: "4h", accent: "#a855f7", direction: "down" as const },
];

const EXTRA_ACTIVITY = [
  { user: { initials: "JP", name: "Joel Phillips", role: "UI/UX Designer", color: "#14b8a6" }, actions: [{ type: "attach" as const, text: "Uploaded 3 design assets to Medical App project" }] },
  { user: { initials: "LC", name: "Louis Castro", role: "Copywriter", color: "#8b5cf6" }, actions: [{ type: "status" as const, text: "Completed the homepage copy for Food Delivery Service" }] },
];

interface Props { onViewAllEvents: () => void; searchQuery: string; }

export default function MainDashboard({ onViewAllEvents, searchQuery }: Props) {
  const [selectedMember, setSelectedMember] = useState<typeof MEMBERS[0] | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const q = searchQuery.toLowerCase().trim();

  const filteredMembers = useMemo(() =>
    MEMBERS.filter((m) => !q || m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q) || m.level.toLowerCase().includes(q)),
    [q]);

  const filteredProjects = useMemo(() =>
    PROJECTS.filter((p) => !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))),
    [q]);

  return (
    <>
      {/* Welcome + date */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 14, color: C.textMuted, fontWeight: 600, margin: 0, marginBottom: 4 }}>Welcome back, Evan!</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.textDark, margin: 0 }}>Dashboard</h1>
        </div>
        <DateRangeButton />
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* ── Left/main column ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Workload */}
          <div style={{ backgroundColor: C.white, borderRadius: 20, padding: "24px 24px 28px", marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.textDark }}>
                Workload
                {q && <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginLeft: 8 }}>({filteredMembers.length} found)</span>}
              </h2>
              <ViewAllBtn />
            </div>

            {filteredMembers.length === 0 ? (
              <EmptyState text="No members match your search" />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {filteredMembers.map((m) => (
                  <MemberCard key={m.name} {...m} onClick={() => setSelectedMember(m)} />
                ))}
              </div>
            )}
          </div>

          {/* Daily Deal Flow */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.textDark }}>
                Projects
                {q && <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginLeft: 8 }}>({filteredProjects.length} found)</span>}
              </h2>
              <ViewAllBtn />
            </div>
            {filteredProjects.length === 0 ? (
              <EmptyState text="No deal records match your search" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredProjects.map((p) => (
                  <ProjectRow
                    key={p.id}
                    {...p}
                    isExpanded={expandedProject === p.id}
                    onToggle={() => setExpandedProject(expandedProject === p.id ? null : p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ── */}
        <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Nearest Events */}
          <div style={{ backgroundColor: C.white, borderRadius: 20, padding: "24px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.textDark }}>Nearest Events</h2>
              <button id="nearest-events-view-all" onClick={onViewAllEvents} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: C.blue, fontFamily: "inherit", padding: 0, transition: "opacity 0.15s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              >
                View all
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3L7.5 6L4.5 9" stroke={C.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
            {NEAREST_EVENTS.map((ev, i) => (
              <EventRow key={i} {...ev} last={i === NEAREST_EVENTS.length - 1} />
            ))}
          </div>

          {/* Activity Stream */}
          <ActivityStream showAll={showAllActivity} onToggle={() => setShowAllActivity((v) => !v)} extraActivity={EXTRA_ACTIVITY} />
        </div>
      </div>

      {/* ── Member Drawer ── */}
      {selectedMember && (
        <MemberDrawer member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DateRangeButton() {
  const [open, setOpen] = useState(false);
  const RANGES = ["Last 7 days","Last 30 days","Nov 16 – Dec 16, 2020","Custom range…"];
  const [selected, setSelected] = useState(RANGES[2]);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        display: "flex", alignItems: "center", gap: 8, backgroundColor: "#f4f9fd",
        border: "none", borderRadius: 12, padding: "10px 18px",
        fontSize: 13, fontWeight: 700, color: C.textMid, cursor: "pointer", whiteSpace: "nowrap",
        fontFamily: "inherit", transition: "background-color 0.15s",
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="10" rx="2" stroke={C.textMuted} strokeWidth="1.3" /><path d="M4 1V3.5M10 1V3.5" stroke={C.textMuted} strokeWidth="1.3" strokeLinecap="round" /><path d="M1 6H13" stroke={C.textMuted} strokeWidth="1.3" /></svg>
        {selected}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transition: "transform 0.18s", transform: open ? "rotate(180deg)" : "rotate(0)" }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke={C.textMuted} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, backgroundColor: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 150, overflow: "hidden", minWidth: 200, animation: "fadeInDown 0.15s ease" }}>
          {RANGES.map((r) => (
            <button key={r} onClick={() => { setSelected(r); setOpen(false); }} style={{
              display: "block", width: "100%", padding: "10px 16px", border: "none", background: r === selected ? "#f0f7ff" : "none",
              cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: r === selected ? 700 : 600,
              color: r === selected ? C.blue : C.textMid, textAlign: "left", transition: "background-color 0.15s",
            }}
              onMouseEnter={(e) => { if (r !== selected) (e.currentTarget as HTMLElement).style.backgroundColor = "#f8fafc"; }}
              onMouseLeave={(e) => { if (r !== selected) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
            >{r}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function ViewAllBtn() {
  return (
    <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 700, color: C.blue, fontFamily: "inherit", padding: 0, transition: "opacity 0.15s" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
    >
      View all
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3.5L8.5 7L5 10.5" stroke={C.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: "28px 0", textAlign: "center" }}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ marginBottom: 10, opacity: 0.3 }}>
        <circle cx="18" cy="18" r="10" stroke="#8a94a6" strokeWidth="2" />
        <path d="M26 26L34 34" stroke="#8a94a6" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p style={{ margin: 0, fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{text}</p>
    </div>
  );
}

function MemberCard({ initials, name, role, level, color, tasks, done, onClick }: typeof MEMBERS[0] & { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const pct = Math.round((done / tasks) * 100);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: hovered ? "#f0f7ff" : C.bg,
        borderRadius: 14, padding: "16px 12px 14px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        cursor: "pointer", transition: "background-color 0.18s, transform 0.18s, box-shadow 0.18s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered ? "0 4px 16px rgba(66,133,244,0.12)" : "none",
        border: `1.5px solid ${hovered ? color + "44" : "transparent"}`,
      }}
    >
      <div style={{ width: 60, height: 60, borderRadius: "50%", border: `2.5px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: color + "18", marginBottom: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color }}>{initials}</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.textDark, textAlign: "center", marginTop: 4 }}>{name}</p>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: C.textMuted, textAlign: "center", marginBottom: 6 }}>{role}</p>
      <span style={{ border: `1px solid #cbd5e1`, borderRadius: 4, padding: "1px 8px", fontSize: 11, fontWeight: 600, color: C.textMuted, backgroundColor: "transparent" }}>{level}</span>
    </div>
  );
}

function MemberDrawer({ member, onClose }: { member: typeof MEMBERS[0]; onClose: () => void }) {
  const pct = Math.round((member.done / member.tasks) * 100);
  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.2)", zIndex: 300, animation: "fadeIn 0.2s ease" }} />
      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 340,
        backgroundColor: "#fff", zIndex: 301, boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
        display: "flex", flexDirection: "column", animation: "slideInRight 0.25s ease",
      }}>
        {/* Header */}
        <div style={{ padding: "24px 24px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", border: `3px solid ${member.color}`, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: member.color + "18", flexShrink: 0 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: member.color }}>{member.initials}</span>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.textDark }}>{member.name}</p>
              <p style={{ margin: 0, fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{member.role}</p>
              <span style={{ display: "inline-block", border: `1.5px solid ${C.border}`, borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 700, color: C.textMuted, backgroundColor: C.bg, marginTop: 4 }}>{member.level}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 18, padding: 4, borderRadius: 8, lineHeight: 1, transition: "color 0.15s, background-color 0.15s" }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = "#f3f6fb"; el.style.color = "#ef4444"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = "transparent"; el.style.color = C.textMuted; }}
          >✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {/* Task progress */}
          <div style={{ backgroundColor: C.bg, borderRadius: 14, padding: "16px 18px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.textDark }}>Task Progress</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: member.color }}>{pct}%</span>
            </div>
            <div style={{ height: 8, backgroundColor: "#e2e8f0", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${pct}%`, backgroundColor: member.color, borderRadius: 4, transition: "width 0.8s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{member.done} completed</span>
              <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{member.tasks - member.done} remaining</span>
            </div>
          </div>

          {/* Mini activity chart */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.textDark }}>Activity (last 7 days)</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
              {[40, 70, 50, 90, 60, 80, pct].map((h, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ width: "100%", height: `${h}%`, backgroundColor: i === 6 ? member.color : member.color + "44", borderRadius: "4px 4px 0 0", transition: "height 0.6s ease", minHeight: 4 }} />
                  <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 600 }}>
                    {["M","T","W","T","F","S","T"][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Skills */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.textDark }}>Skills</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {member.skills.map((s) => (
                <span key={s} style={{ backgroundColor: member.color + "14", color: member.color, border: `1.5px solid ${member.color}30`, borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>{s}</span>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Total Tasks", value: member.tasks },
              { label: "Completed", value: member.done },
              { label: "In Progress", value: member.tasks - member.done },
              { label: "Completion", value: `${pct}%` },
            ].map(({ label, value }) => (
              <div key={label} style={{ backgroundColor: C.bg, borderRadius: 12, padding: "12px 14px" }}>
                <p style={{ margin: 0, fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 4 }}>{label}</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.textDark }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
          <button style={{
            flex: 1, backgroundColor: member.color, color: "#fff", border: "none", borderRadius: 12,
            padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            transition: "opacity 0.15s, transform 0.1s",
          }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.opacity = "0.85"; el.style.transform = "scale(0.99)"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.opacity = "1"; el.style.transform = "scale(1)"; }}
          >Assign Task</button>
          <button style={{
            flex: 1, backgroundColor: "transparent", color: C.textMid, border: `1.5px solid ${C.border}`,
            borderRadius: 12, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            transition: "border-color 0.15s, background-color 0.15s",
          }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = C.blue; el.style.backgroundColor = "#f0f7ff"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = C.border; el.style.backgroundColor = "transparent"; }}
          >Message</button>
        </div>
      </div>
    </>
  );
}

function ProjectRow({ id, name, created, priority, allTasks, activeTasks, assignees, extraAssignees, emoji, color, progress, description, tags, isExpanded, onToggle }: typeof PROJECTS[0] & { isExpanded: boolean; onToggle: () => void }) {
  const [hovered, setHovered] = useState(false);
  const pColor = priority === "Medium" ? C.arrowUp : C.arrowDown;
  const pArrow = priority === "Medium" ? "↑" : "↓";
  const completedTasks = allTasks - activeTasks;

  return (
    <div style={{
      backgroundColor: C.white, borderRadius: 16, overflow: "hidden",
      boxShadow: hovered || isExpanded ? "0 4px 20px rgba(0,0,0,0.08)" : "0 2px 8px rgba(0,0,0,0.04)",
      border: `1.5px solid ${isExpanded ? C.blue + "44" : "transparent"}`,
      transition: "box-shadow 0.2s, border-color 0.2s",
      cursor: "pointer",
    }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggle}
    >
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {/* Left */}
        <div style={{ flex: 1, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, borderRight: `1.5px solid ${C.border}` }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{emoji}</div>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 3 }}>{id}</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.textDark, marginBottom: 6 }}>{name}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CalIcon />
              <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>Created {created}</span>
              <span style={{ fontSize: 12, color: pColor, fontWeight: 700, marginLeft: 6 }}>{pArrow} {priority}</span>
            </div>
          </div>
        </div>
        {/* Right */}
        <div style={{ padding: "18px 24px", display: "flex", alignItems: "center", gap: 24, minWidth: 260 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>Project Data</p>
            <div style={{ display: "flex", gap: 20 }}>
              {[["All tasks", allTasks], ["Active tasks", activeTasks]].map(([l, v]) => (
                <div key={l as string}>
                  <p style={{ margin: 0, fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 2 }}>{l}</p>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.textDark }}>{v}</p>
                </div>
              ))}
              <div>
                <p style={{ margin: 0, fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 2 }}>Assignees</p>
                <div style={{ display: "flex", alignItems: "center", marginTop: 2 }}>
                  {assignees.slice(0, 3).map((c, i) => (
                    <div key={i} style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: c, border: "2px solid #fff", marginLeft: i === 0 ? 0 : -6 }} />
                  ))}
                  {extraAssignees > 0 && <div style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: C.blue, border: "2px solid #fff", marginLeft: -6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff" }}>+{extraAssignees}</div>}
                </div>
              </div>
            </div>
          </div>
          {/* Expand chevron */}
          <div style={{ marginLeft: "auto", transition: "transform 0.2s, color 0.15s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)", color: isExpanded ? C.blue : C.textMuted }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div style={{ padding: "0 24px 22px", borderTop: `1px solid ${C.border}`, animation: "fadeInDown 0.18s ease" }} onClick={(e) => e.stopPropagation()}>
          <div style={{ paddingTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Description + tags */}
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: C.textDark }}>Description</p>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: C.textMuted, fontWeight: 600, lineHeight: 1.6 }}>{description}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {tags.map((t) => (
                  <span key={t} style={{ backgroundColor: "#f0f7ff", color: C.blue, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, border: `1px solid ${C.blue}22` }}>{t}</span>
                ))}
              </div>
            </div>
            {/* Progress */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.textDark }}>Overall Progress</p>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.blue }}>{progress}%</span>
              </div>
              <div style={{ height: 8, backgroundColor: "#e2e8f0", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                <div style={{ height: "100%", width: `${progress}%`, backgroundColor: C.blue, borderRadius: 4, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[["Completed", completedTasks], ["Remaining", activeTasks]].map(([l, v]) => (
                  <div key={l as string} style={{ backgroundColor: C.bg, borderRadius: 10, padding: "10px 12px" }}>
                    <p style={{ margin: 0, fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{l}</p>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.textDark }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button style={{ backgroundColor: C.blue, color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            >Open Project</button>
            <button style={{ backgroundColor: "transparent", color: C.textMid, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "9px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "border-color 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.blue; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
            >View Tasks</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityStream({ showAll, onToggle, extraActivity }: { showAll: boolean; onToggle: () => void; extraActivity: typeof EXTRA_ACTIVITY }) {
  const baseActivity = [
    { user: { initials: "OH", name: "Oscar Holloway", role: "UI/UX Designer", color: "#f97316" }, actions: [{ type: "status" as const, text: "Updated the status of Mind Map task to In Progress" }, { type: "attach" as const, text: "Attached files to the task" }] },
    { user: { initials: "ET", name: "Emily Tyler", role: "Copywriter", color: "#ec4899" }, actions: [{ type: "status" as const, text: "Updated the status of Mind Map task to In Progress" }] },
  ];
  const groups = showAll ? [...baseActivity, ...extraActivity] : baseActivity;
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 20, padding: "24px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 800, color: C.textDark }}>Activity Stream</h2>
      {groups.map((group, gi) => (
        <div key={gi} style={{ marginBottom: gi < groups.length - 1 ? 16 : 0, animation: gi >= 2 ? "fadeInDown 0.2s ease" : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: group.user.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{group.user.initials}</div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.textDark }}>{group.user.name}</p>
              <p style={{ margin: 0, fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{group.user.role}</p>
            </div>
          </div>
          {group.actions.map((action, ai) => (
            <div key={ai} style={{ display: "flex", alignItems: "flex-start", gap: 10, backgroundColor: C.bg, borderRadius: 10, padding: "10px 12px", marginBottom: ai < group.actions.length - 1 ? 8 : 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: action.type === "status" ? "#dbeafe" : "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {action.type === "status" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="7" fill="#dbeafe" /><path d="M7 10V4M4.5 6.5L7 4L9.5 6.5" stroke="#4285f4" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="7" fill="#d1fae5" /><path d="M4 5H10M4 7H8" stroke="#16a34a" strokeWidth="1.2" strokeLinecap="round" /><circle cx="9.5" cy="9" r="2" stroke="#16a34a" strokeWidth="1.2" /></svg>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: C.textMid, fontWeight: 600, lineHeight: 1.5 }}>{action.text}</p>
            </div>
          ))}
        </div>
      ))}
      <button id="activity-view-more" onClick={onToggle} style={{
        background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center",
        gap: 4, fontSize: 12, fontWeight: 700, color: C.blue, fontFamily: "inherit", padding: 0, marginTop: 14, transition: "opacity 0.15s",
      }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      >
        {showAll ? "Show less" : "View more"}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transition: "transform 0.2s", transform: showAll ? "rotate(180deg)" : "rotate(0)" }}>
          <path d="M3 4.5L6 7.5L9 4.5" stroke={C.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

function EventRow({ title, time, duration, accent, direction, last }: { title: string; time: string; duration: string; accent: string; direction: "up" | "down"; last: boolean; }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: last ? "none" : `1px solid ${C.border}`, paddingBottom: last ? 0 : 14, marginBottom: last ? 0 : 14,
        cursor: "pointer", borderRadius: 8,
        backgroundColor: hovered ? "#f8fafc" : "transparent",
        transition: "background-color 0.15s",
        padding: hovered ? "6px 8px" : "0 0 14px",
        margin: hovered ? "0 -8px 6px" : "0 0 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
        <div style={{ width: 3, borderRadius: 2, backgroundColor: accent, alignSelf: "stretch", marginRight: 12, minHeight: 40, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.textDark, flex: 1, paddingRight: 8, lineHeight: 1.4 }}>{title}</p>
            {direction === "up"
              ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 12V4M4 8L8 4L12 8" stroke={C.arrowUp} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 4V12M4 8L8 12L12 8" stroke={C.arrowDown} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            }
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{time}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.textMuted, fontWeight: 600, backgroundColor: C.bg, borderRadius: 6, padding: "2px 8px" }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="#8a94a6" strokeWidth="1.2" /><path d="M5.5 3V5.5L7 7" stroke="#8a94a6" strokeWidth="1.2" strokeLinecap="round" /></svg>
              {duration}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalIcon() {
  return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="2.5" width="11" height="10" rx="2" stroke="#8a94a6" strokeWidth="1.2" /><path d="M3.5 1V3.5M9.5 1V3.5" stroke="#8a94a6" strokeWidth="1.2" strokeLinecap="round" /><path d="M1 5.5H12" stroke="#8a94a6" strokeWidth="1.2" /></svg>;
}
