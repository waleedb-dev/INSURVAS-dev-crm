"use client";
import { useState } from "react";
import { T } from "@/lib/theme";

type Stage = "New Lead" | "Contacted" | "Quoted" | "Negotiating" | "Won" | "Lost";

interface Lead {
  id: string;
  name: string;
  type: string;
  premium: number;
  source: string;
  agent: string;
  agentColor: string;
  daysInStage: number;
  stage: Stage;
}

const STAGES: Stage[] = ["New Lead", "Contacted", "Quoted", "Negotiating", "Won", "Lost"];

const STAGE_CONFIG: Record<Stage, { color: string; bg: string; header: string }> = {
  "New Lead":    { color: "#3b82f6", bg: "#eff6ff", header: "#dbeafe" },
  "Contacted":   { color: "#8b5cf6", bg: "#f5f3ff", header: "#ede9fe" },
  "Quoted":      { color: "#f59e0b", bg: "#fffbeb", header: "#fef3c7" },
  "Negotiating": { color: "#f97316", bg: "#fff7ed", header: "#ffedd5" },
  "Won":         { color: "#16a34a", bg: "#f0fdf4", header: "#dcfce7" },
  "Lost":        { color: "#dc2626", bg: "#fef2f2", header: "#fee2e2" },
};

const TYPE_COLORS: Record<string, string> = {
  Auto: "#3b82f6", Home: "#9333ea", Life: "#16a34a", Health: "#ea580c", Commercial: "#64748b",
};

const INITIAL_LEADS: Lead[] = [
  { id:"P-001", name:"James Whitfield",   type:"Auto",       premium:1240,  source:"Web",      agent:"SS", agentColor:"#4285f4", daysInStage:0, stage:"New Lead" },
  { id:"P-002", name:"Maria Gonzalez",    type:"Home",       premium:2180,  source:"Referral", agent:"ET", agentColor:"#ec4899", daysInStage:1, stage:"New Lead" },
  { id:"P-003", name:"Robert Chen",       type:"Life",       premium:4500,  source:"Walk-in",  agent:"LC", agentColor:"#8b5cf6", daysInStage:2, stage:"Contacted" },
  { id:"P-004", name:"Angela Brooks",     type:"Health",     premium:3200,  source:"Phone",    agent:"BS", agentColor:"#0ea5e9", daysInStage:3, stage:"Contacted" },
  { id:"P-005", name:"Tom Harrington",    type:"Commercial", premium:8750,  source:"Web",      agent:"RD", agentColor:"#f59e0b", daysInStage:4, stage:"Quoted" },
  { id:"P-006", name:"Sarah Kim",         type:"Auto",       premium:980,   source:"Referral", agent:"OH", agentColor:"#f97316", daysInStage:2, stage:"Quoted" },
  { id:"P-007", name:"Derek Mason",       type:"Home",       premium:1875,  source:"Email",    agent:"JP", agentColor:"#14b8a6", daysInStage:5, stage:"Negotiating" },
  { id:"P-008", name:"Priya Patel",       type:"Life",       premium:6200,  source:"Walk-in",  agent:"WM", agentColor:"#64748b", daysInStage:6, stage:"Negotiating" },
  { id:"P-009", name:"Carlos Rivera",     type:"Health",     premium:2900,  source:"Web",      agent:"SS", agentColor:"#4285f4", daysInStage:8, stage:"Won" },
  { id:"P-010", name:"Linda Tran",        type:"Commercial", premium:12400, source:"Referral", agent:"ET", agentColor:"#ec4899", daysInStage:9, stage:"Won" },
  { id:"P-011", name:"Nathan Ford",       type:"Auto",       premium:1100,  source:"Phone",    agent:"LC", agentColor:"#8b5cf6", daysInStage:12, stage:"Lost" },
  { id:"P-012", name:"Grace Nakamura",    type:"Home",       premium:3450,  source:"Web",      agent:"BS", agentColor:"#0ea5e9", daysInStage:7, stage:"Quoted" },
  { id:"P-013", name:"Kevin O'Brien",     type:"Life",       premium:5100,  source:"Referral", agent:"RD", agentColor:"#f59e0b", daysInStage:3, stage:"Contacted" },
  { id:"P-014", name:"Amanda Foster",     type:"Auto",       premium:790,   source:"Web",      agent:"OH", agentColor:"#f97316", daysInStage:15, stage:"Lost" },
];

export default function LeadPipelinePage() {
  const [leads, setLeads] = useState(INITIAL_LEADS);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Stage | null>(null);

  const byStage = (stage: Stage) => leads.filter((l) => l.stage === stage);
  const stageValue = (stage: Stage) => byStage(stage).reduce((s, l) => s + l.premium, 0);

  const handleDrop = (stage: Stage) => {
    if (dragId) {
      setLeads((prev) => prev.map((l) => l.id === dragId ? { ...l, stage, daysInStage: 0 } : l));
    }
    setDragId(null);
    setDragOver(null);
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>Sales Funnel</p>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textDark, margin: 0 }}>Lead Pipeline</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted, fontWeight: 600 }}>Drag cards between columns to update stage</p>
      </div>

      {/* Summary banner */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 24 }}>
        {STAGES.map((s) => {
          const cfg = STAGE_CONFIG[s];
          return (
            <div key={s} style={{ backgroundColor: cfg.bg, borderRadius: T.radiusMd, padding: "12px 14px", border: `1.5px solid ${cfg.color}22` }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: cfg.color }}>{s}</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>{byStage(s).length}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted, fontWeight: 600 }}>${stageValue(s).toLocaleString()}</p>
            </div>
          );
        })}
      </div>

      {/* Kanban board */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, alignItems: "start" }}>
        {STAGES.map((stage) => {
          const cfg = STAGE_CONFIG[stage];
          const stageLeads = byStage(stage);
          const isOver = dragOver === stage;
          return (
            <div
              key={stage}
              onDragOver={(e) => { e.preventDefault(); setDragOver(stage); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(stage)}
              style={{ backgroundColor: isOver ? cfg.bg : T.rowBg, borderRadius: T.radiusLg, border: `2px dashed ${isOver ? cfg.color : "transparent"}`, transition: "all 0.15s", minHeight: 120 }}
            >
              {/* Column header */}
              <div style={{ backgroundColor: cfg.header, borderRadius: "12px 12px 0 0", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: cfg.color }}>{stage}</span>
                <span style={{ backgroundColor: cfg.color, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{stageLeads.length}</span>
              </div>

              <div style={{ padding: "10px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragId(lead.id)}
                    onDragEnd={() => { setDragId(null); setDragOver(null); }}
                    style={{
                      backgroundColor: T.cardBg, borderRadius: T.radiusSm, padding: "12px 10px",
                      boxShadow: T.shadowSm, cursor: "grab", opacity: dragId === lead.id ? 0.5 : 1,
                      borderLeft: `3px solid ${cfg.color}`, transition: "opacity 0.15s",
                    }}
                  >
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 800, color: T.textDark, lineHeight: 1.3 }}>{lead.name}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: TYPE_COLORS[lead.type] ?? T.textMuted, backgroundColor: TYPE_COLORS[lead.type] ? TYPE_COLORS[lead.type] + "15" : T.rowBg, borderRadius: 4, padding: "1px 6px" }}>{lead.type}</span>
                    </div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 800, color: T.textDark }}>${lead.premium.toLocaleString()}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: lead.agentColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 8, fontWeight: 800 }}>{lead.agent}</div>
                      <span style={{ fontSize: 10, color: lead.daysInStage > 7 ? T.danger : T.textMuted, fontWeight: 600 }}>{lead.daysInStage}d</span>
                    </div>
                  </div>
                ))}
                {stageLeads.length === 0 && (
                  <div style={{ padding: "20px 0", textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: 11, color: T.textMuted, fontWeight: 600 }}>Drop here</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
