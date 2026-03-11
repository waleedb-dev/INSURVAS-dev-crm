"use client";
import { useState } from "react";
import { T } from "@/lib/theme";

interface Lead {
  id: string;
  name: string;
  type: string;
  source: string;
  location: string;
  received: string;
  estimatedPremium: number;
  assignedTo: string | null;
}

const AGENTS = [
  { name: "Shawn Stone",    color: "#4285f4", capacity: 8,  current: 6 },
  { name: "Emily Tyler",    color: "#ec4899", capacity: 10, current: 7 },
  { name: "Louis Castro",   color: "#8b5cf6", capacity: 12, current: 12 },
  { name: "Blake Silva",    color: "#0ea5e9", capacity: 10, current: 4 },
  { name: "Randy Delgado",  color: "#f59e0b", capacity: 8,  current: 3 },
  { name: "Joel Phillips",  color: "#14b8a6", capacity: 10, current: 8 },
  { name: "Wayne Marsh",    color: "#64748b", capacity: 8,  current: 2 },
  { name: "Oscar Holloway", color: "#f97316", capacity: 10, current: 9 },
];

const INITIAL_LEADS: Lead[] = [
  { id:"L-001", name:"Marcus Webb",      type:"Auto",       source:"Web Form",      location:"Houston, TX",      received:"8:22 AM",  estimatedPremium:1100, assignedTo: null },
  { id:"L-002", name:"Donna Fitzgerald", type:"Home",       source:"Referral",      location:"Dallas, TX",       received:"8:45 AM",  estimatedPremium:2400, assignedTo: null },
  { id:"L-003", name:"Steve Nguyen",     type:"Life",       source:"Phone Call",    location:"Austin, TX",       received:"9:02 AM",  estimatedPremium:5000, assignedTo: null },
  { id:"L-004", name:"Rachel Hammond",   type:"Health",     source:"Social Media",  location:"San Antonio, TX",  received:"9:18 AM",  estimatedPremium:3100, assignedTo: null },
  { id:"L-005", name:"Patrick Dunn",     type:"Commercial", source:"Web Form",      location:"Fort Worth, TX",   received:"9:30 AM",  estimatedPremium:9200, assignedTo: null },
  { id:"L-006", name:"Olivia Chen",      type:"Auto",       source:"Email Campaign",location:"Plano, TX",        received:"9:41 AM",  estimatedPremium:850,  assignedTo: null },
  { id:"L-007", name:"Brian Torres",     type:"Home",       source:"Referral",      location:"Arlington, TX",    received:"10:05 AM", estimatedPremium:1980, assignedTo: null },
  { id:"L-008", name:"Monica Lewis",     type:"Life",       source:"Walk-in",       location:"Irving, TX",       received:"10:22 AM", estimatedPremium:7500, assignedTo: null },
];

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  Auto:       { bg: "#eff6ff", color: "#2563eb" },
  Home:       { bg: "#fdf4ff", color: "#9333ea" },
  Life:       { bg: "#f0fdf4", color: "#16a34a" },
  Health:     { bg: "#fff7ed", color: "#ea580c" },
  Commercial: { bg: "#f8fafc", color: "#475569" },
};

export default function AssigningPage() {
  const [leads, setLeads] = useState(INITIAL_LEADS);
  const [agentLoads, setAgentLoads] = useState(AGENTS.map((a) => ({ ...a })));
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const unassigned = leads.filter((l) => !l.assignedTo);
  const assigned   = leads.filter((l) => l.assignedTo);

  const handleAssign = (leadId: string, agentName: string) => {
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, assignedTo: agentName } : l));
    setAgentLoads((prev) => prev.map((a) => a.name === agentName ? { ...a, current: a.current + 1 } : a));
    setAssigningId(null);
    setToast(`Lead assigned to ${agentName}`);
    setTimeout(() => setToast(null), 2500);
  };

  const handleUnassign = (leadId: string, agentName: string) => {
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, assignedTo: null } : l));
    setAgentLoads((prev) => prev.map((a) => a.name === agentName ? { ...a, current: Math.max(0, a.current - 1) } : a));
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>Lead Distribution</p>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textDark, margin: 0 }}>Assigning</h1>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Unassigned Leads", value: unassigned.length, color: T.danger },
          { label: "Assigned Today",   value: assigned.length,   color: "#16a34a" },
          { label: "Total Agents",     value: agentLoads.length, color: T.blue },
          { label: "Avg Capacity",     value: `${Math.round(agentLoads.reduce((s,a)=>(s+(a.current/a.capacity)*100),0)/agentLoads.length)}%`, color: "#7c3aed" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: T.cardBg, borderRadius: T.radiusLg, padding: "18px 20px", boxShadow: T.shadowSm }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{label}</p>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        {/* Left: Lead Queue */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: T.textDark, margin: "0 0 14px" }}>
            Unassigned Queue
            <span style={{ marginLeft: 8, backgroundColor: T.danger, color: "#fff", borderRadius: 10, padding: "2px 8px", fontSize: 11 }}>{unassigned.length}</span>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {unassigned.map((lead) => {
              const tc = TYPE_COLORS[lead.type] ?? { bg: T.rowBg, color: T.textMuted };
              const isOpen = assigningId === lead.id;
              return (
                <div key={lead.id} style={{ backgroundColor: T.cardBg, borderRadius: T.radiusLg, padding: "16px 18px", boxShadow: T.shadowSm, border: `1.5px solid ${isOpen ? T.blue : "transparent"}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>{lead.id}</span>
                        <span style={{ backgroundColor: tc.bg, color: tc.color, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{lead.type}</span>
                        <span style={{ backgroundColor: "#f0fdf4", color: "#16a34a", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>${lead.estimatedPremium.toLocaleString()}</span>
                      </div>
                      <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: T.textDark }}>{lead.name}</p>
                      <div style={{ display: "flex", gap: 12 }}>
                        <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>📍 {lead.location}</span>
                        <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>🔗 {lead.source}</span>
                        <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>⏱ {lead.received}</span>
                      </div>
                    </div>
                    <button onClick={() => setAssigningId(isOpen ? null : lead.id)} style={{ backgroundColor: isOpen ? T.rowBg : T.blue, color: isOpen ? T.textMid : "#fff", border: "none", borderRadius: T.radiusSm, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: T.font, whiteSpace: "nowrap", transition: "all 0.15s", flexShrink: 0 }}>
                      {isOpen ? "Cancel" : "Assign →"}
                    </button>
                  </div>

                  {/* Agent picker */}
                  {isOpen && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, animation: "fadeInDown 0.15s ease" }}>
                      {agentLoads.map((a) => {
                        const pct = Math.round((a.current / a.capacity) * 100);
                        const full = a.current >= a.capacity;
                        return (
                          <button key={a.name} onClick={() => { if (!full) handleAssign(lead.id, a.name); }} disabled={full} style={{
                            backgroundColor: full ? "#f8fafc" : "#fff", border: `1.5px solid ${full ? T.border : a.color + "44"}`, borderRadius: T.radiusSm,
                            padding: "10px 8px", textAlign: "center", cursor: full ? "not-allowed" : "pointer", fontFamily: T.font, opacity: full ? 0.5 : 1, transition: "all 0.15s",
                          }}
                            onMouseEnter={(e) => { if (!full) (e.currentTarget as HTMLElement).style.backgroundColor = a.color + "14"; }}
                            onMouseLeave={(e) => { if (!full) (e.currentTarget as HTMLElement).style.backgroundColor = "#fff"; }}
                          >
                            <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: a.color, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px" }}>{a.name.split(" ").map(p=>p[0]).join("")}</div>
                            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: T.textDark }}>{a.name.split(" ")[0]}</p>
                            <div style={{ height: 3, backgroundColor: T.border, borderRadius: 2, margin: "0 4px" }}>
                              <div style={{ height: "100%", width: `${pct}%`, backgroundColor: full ? T.danger : a.color, borderRadius: 2, transition: "width 0.4s" }} />
                            </div>
                            <p style={{ margin: "4px 0 0", fontSize: 10, color: full ? T.danger : T.textMuted, fontWeight: 600 }}>{a.current}/{a.capacity}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {unassigned.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
                <p style={{ margin: 0, fontSize: 14, color: T.textMuted, fontWeight: 600 }}>All leads have been assigned!</p>
              </div>
            )}
          </div>

          {/* Assigned section */}
          {assigned.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: T.textDark, margin: "0 0 14px" }}>
                Assigned Today
                <span style={{ marginLeft: 8, backgroundColor: "#dcfce7", color: "#16a34a", borderRadius: 10, padding: "2px 8px", fontSize: 11 }}>{assigned.length}</span>
              </h2>
              {assigned.map((lead) => {
                const agent = agentLoads.find((a) => a.name === lead.assignedTo)!;
                const tc = TYPE_COLORS[lead.type] ?? { bg: T.rowBg, color: T.textMuted };
                return (
                  <div key={lead.id} style={{ backgroundColor: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: T.radiusLg, padding: "14px 18px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: agent.color, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:10, fontWeight:800 }}>{agent.name.split(" ").map(p=>p[0]).join("")}</div>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.textDark }}>{lead.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: T.textMuted, fontWeight: 600 }}>→ {lead.assignedTo} · <span style={{ backgroundColor: tc.bg, color: tc.color, borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{lead.type}</span></p>
                      </div>
                    </div>
                    <button onClick={() => handleUnassign(lead.id, lead.assignedTo!)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: T.textMuted, cursor: "pointer", fontFamily: T.font }}>Unassign</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Agent roster */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: T.textDark, margin: "0 0 14px" }}>Agent Capacity</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {agentLoads.map((a) => {
              const pct = Math.round((a.current / a.capacity) * 100);
              const barColor = pct >= 100 ? T.danger : pct >= 80 ? T.priorityHigh : "#16a34a";
              return (
                <div key={a.name} style={{ backgroundColor: T.cardBg, borderRadius: T.radiusLg, padding: "14px 16px", boxShadow: T.shadowSm }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: a.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{a.name.split(" ").map(p=>p[0]).join("")}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.textDark }}>{a.name}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: barColor }}>{a.current}/{a.capacity}</span>
                  </div>
                  <div style={{ height: 6, backgroundColor: T.border, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, backgroundColor: barColor, borderRadius: 3, transition: "width 0.5s ease" }} />
                  </div>
                  <p style={{ margin: "5px 0 0", fontSize: 11, color: pct >= 100 ? T.danger : T.textMuted, fontWeight: 600, textAlign: "right" }}>{pct}% capacity</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", backgroundColor: T.textDark, color: "#fff", borderRadius: T.radiusMd, padding: "12px 24px", fontSize: 13, fontWeight: 700, zIndex: 9999, boxShadow: T.shadowLg, animation: "fadeInDown 0.2s ease" }}>
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
