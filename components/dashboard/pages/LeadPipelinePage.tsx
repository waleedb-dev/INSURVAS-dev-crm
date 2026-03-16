"use client";
import { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { Pagination } from "@/components/ui";
import LeadViewComponent from "./LeadViewComponent";

type Stage = "New Lead" | "Attempted Contact" | "Contacted" | "Discovery Call" | "Presentation" | "Needs Quote" | "Quoted" | "Underwriting" | "Bound" | "Won" | "Lost";

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

const STAGES: Stage[] = [
  "New Lead", "Attempted Contact", "Contacted", "Discovery Call", "Presentation",
  "Needs Quote", "Quoted", "Underwriting", "Bound", "Won", "Lost"
];

const STAGE_CONFIG: Record<Stage, { color: string; bg: string; header: string }> = {
  "New Lead":          { color: "#3b82f6", bg: "#eff6ff", header: "#dbeafe" },
  "Attempted Contact": { color: "#6366f1", bg: "#eef2ff", header: "#e0e7ff" },
  "Contacted":         { color: "#8b5cf6", bg: "#f5f3ff", header: "#ede9fe" },
  "Discovery Call":    { color: "#d946ef", bg: "#fdf4ff", header: "#fae8ff" },
  "Presentation":      { color: "#ec4899", bg: "#fdf2f8", header: "#fce7f3" },
  "Needs Quote":       { color: "#f43f5e", bg: "#fff1f2", header: "#ffe4e6" },
  "Quoted":            { color: "#f59e0b", bg: "#fffbeb", header: "#fef3c7" },
  "Underwriting":      { color: "#eab308", bg: "#fefce8", header: "#fef08a" },
  "Bound":             { color: "#84cc16", bg: "#f7fee7", header: "#d9f99d" },
  "Won":               { color: "#16a34a", bg: "#f0fdf4", header: "#dcfce7" },
  "Lost":              { color: "#dc2626", bg: "#fef2f2", header: "#fee2e2" },
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
  { id:"P-007", name:"Derek Mason",       type:"Home",       premium:1875,  source:"Email",    agent:"JP", agentColor:"#14b8a6", daysInStage:5, stage:"Presentation" },
  { id:"P-008", name:"Priya Patel",       type:"Life",       premium:6200,  source:"Walk-in",  agent:"WM", agentColor:"#64748b", daysInStage:6, stage:"Presentation" },
  { id:"P-009", name:"Carlos Rivera",     type:"Health",     premium:2900,  source:"Web",      agent:"SS", agentColor:"#4285f4", daysInStage:8, stage:"Won" },
  { id:"P-010", name:"Linda Tran",        type:"Commercial", premium:12400, source:"Referral", agent:"ET", agentColor:"#ec4899", daysInStage:9, stage:"Won" },
  { id:"P-011", name:"Nathan Ford",       type:"Auto",       premium:1100,  source:"Phone",    agent:"LC", agentColor:"#8b5cf6", daysInStage:12, stage:"Lost" },
  { id:"P-012", name:"Grace Nakamura",    type:"Home",       premium:3450,  source:"Web",      agent:"BS", agentColor:"#0ea5e9", daysInStage:7, stage:"Quoted" },
  { id:"P-013", name:"Kevin O'Brien",     type:"Life",       premium:5100,  source:"Referral", agent:"RD", agentColor:"#f59e0b", daysInStage:3, stage:"Contacted" },
  { id:"P-014", name:"Amanda Foster",     type:"Auto",       premium:790,   source:"Web",      agent:"OH", agentColor:"#f97316", daysInStage:15, stage:"Lost" },
];

export default function LeadPipelinePage({ canUpdateActions = true }: { canUpdateActions?: boolean }) {
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

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  const toggleCollapse = (stage: Stage) => {
    setCollapsedStages((prev) => ({ ...prev, [stage]: !prev[stage] }));
  };

  const [pipeline, setPipeline] = useState<string>("Sales Pipeline");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [viewingLead, setViewingLead] = useState<{ id: string, name: string } | null>(null);
  const itemsPerPage = 8;

  const filteredLeads = leads.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.type.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
    if (filteredLeads.length === 0 && page !== 1) {
      setPage(1);
    }
  }, [filteredLeads.length, page, totalPages]);

  const renderKanbanBoard = () => (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <style>{`
        .kanban-container {
          background-color: #ffffff;
          border: 1.5px solid ${T.border};
          border-radius: ${T.radiusXl}px;
          padding-top: 24px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          min-width: 0;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
        }
        .kanban-board {
          display: flex;
          gap: 20px;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 0 24px 8px 24px;
          align-items: stretch;
          flex: 1;
          min-height: 0;
          scrollbar-width: thin;
          scrollbar-color: ${T.border} transparent;
        }
        .kanban-board::-webkit-scrollbar { height: 8px; }
        .kanban-board::-webkit-scrollbar-track { background: transparent; border-radius: 4px; }
        .kanban-board::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; border: 2px solid transparent; background-clip: padding-box; }
        .kanban-board::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
        
        .kanban-column-wrapper {
          min-width: 250px;
          width: 250px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background-color: #fbfcfe;
          border-radius: ${T.radiusLg}px;
          border: 1px solid ${T.border};
          overflow: hidden;
          transition: min-width 0.2s ease, width 0.2s ease;
          height: 100%;
        }
        
        .kanban-column-body {
          overflow-y: auto;
          flex: 1;
          min-height: 0;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scrollbar-width: thin;
        }
        .kanban-column-body::-webkit-scrollbar { width: 6px; }
        .kanban-column-body::-webkit-scrollbar-track { background: transparent; }
        .kanban-column-body::-webkit-scrollbar-thumb { background-color: #e2e8f0; border-radius: 4px; border: 1px solid transparent; background-clip: padding-box; }
        .kanban-column-body::-webkit-scrollbar-thumb:hover { background-color: #cbd5e1; }
      `}</style>
      
      <div className="kanban-container">
        <div style={{ padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, margin: 0 }}>Workload</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", backgroundColor: T.rowBg, borderRadius: T.radiusMd, padding: 4 }}>
              <button onClick={() => setViewMode("kanban")} style={{ padding: "6px 12px", border: "none", borderRadius: T.radiusSm, cursor: "pointer", fontSize: 12, fontWeight: 700, backgroundColor: viewMode === "kanban" ? "#fff" : "transparent", color: viewMode === "kanban" ? T.blue : T.textMuted, boxShadow: viewMode === "kanban" ? T.shadowSm : "none", fontFamily: T.font, transition: "all 0.15s" }}>Kanban</button>
              <button onClick={() => setViewMode("list")} style={{ padding: "6px 12px", border: "none", borderRadius: T.radiusSm, cursor: "pointer", fontSize: 12, fontWeight: 700, backgroundColor: viewMode === "list" ? "#fff" : "transparent", color: viewMode === "list" ? T.blue : T.textMuted, boxShadow: viewMode === "list" ? T.shadowSm : "none", fontFamily: T.font, transition: "all 0.15s" }}>List</button>
            </div>
            <button style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              View all <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>
        <div className="kanban-board">
          {STAGES.map((stage) => {
            const cfg = STAGE_CONFIG[stage];
            const stageLeads = byStage(stage).filter(l => filteredLeads.includes(l));
            const isCollapsed = collapsedStages[stage];
            const isOver = dragOver === stage;
            return (
              <div
                key={stage}
                onDragOver={(e) => {
                  if (!canUpdateActions || isCollapsed) return;
                  e.preventDefault();
                  setDragOver(stage);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => {
                  if (!canUpdateActions || isCollapsed) return;
                  handleDrop(stage);
                }}
                className="kanban-column-wrapper"
                style={{ 
                  borderColor: isOver ? cfg.color : T.border,
                  backgroundColor: isOver ? cfg.bg : isCollapsed ? cfg.bg : "#fff",
                  minWidth: isCollapsed ? 50 : 250,
                  width: isCollapsed ? 50 : 250,
                  maxHeight: isCollapsed ? "100%" : 380,
                  height: isCollapsed ? "100%" : undefined
                }}
              >
                {isCollapsed ? (
                  <div style={{ padding: "16px 0", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", opacity: 0.8 }} onClick={() => toggleCollapse(stage)}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0.8"}
                  >
                    <div style={{ backgroundColor: cfg.color, color: "#fff", borderRadius: 10, padding: "2px 7px", fontSize: 11, fontWeight: 800, marginBottom: 16 }}>
                      {stageLeads.length}
                    </div>
                    <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 13, fontWeight: 800, color: cfg.color, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>
                      {stage}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ backgroundColor: cfg.bg, padding: "12px 14px", borderBottom: `2.5px solid ${cfg.header}`, flexShrink: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button onClick={() => toggleCollapse(stage)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: cfg.color }} title="Collapse Column">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                          <span style={{ fontSize: 12, fontWeight: 800, color: cfg.color, textTransform: "uppercase" }}>{stage}</span>
                        </div>
                        <span style={{ backgroundColor: cfg.color, color: "#fff", borderRadius: 10, padding: "2px 7px", fontSize: 11, fontWeight: 800 }}>{stageLeads.length}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.textMuted }}>${stageValue(stage).toLocaleString()}</span>
                    </div>

                <div className="kanban-column-body">
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => setViewingLead({ id: lead.id, name: lead.name })}
                      draggable={canUpdateActions}
                      onDragStart={() => { if (canUpdateActions) setDragId(lead.id); }}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      style={{
                        backgroundColor: T.cardBg, borderRadius: T.radiusSm, padding: "12px 10px",
                        boxShadow: T.shadowSm, cursor: canUpdateActions ? "grab" : "default",
                        opacity: dragId === lead.id ? 0.5 : 1,
                        borderLeft: `3px solid ${cfg.color}`,
                      }}
                    >
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 800, color: T.textDark }}>{lead.name}</p>
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
                    <div style={{ padding: "40px 0", textAlign: "center", border: `1px dashed ${T.border}`, borderRadius: T.radiusMd }}>
                      <p style={{ margin: 0, fontSize: 11, color: T.textMuted, fontWeight: 600 }}>No leads</p>
                    </div>
                  )}
                </div>
                </>
              )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (viewingLead) {
    return (
      <LeadViewComponent
        leadId={viewingLead.id}
        leadName={viewingLead.name}
        onBack={() => setViewingLead(null)}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0, paddingBottom: 24 }}>
      <div style={{ marginBottom: 24, flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>Sales Funnel</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textDark, margin: 0 }}>Lead Pipeline</h1>
            <select value={pipeline} onChange={(e) => setPipeline(e.target.value)} style={{ padding: "6px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 700, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}>
              <option value="Sales Pipeline">Sales Pipeline</option>
              <option value="Renewals Pipeline">Renewals Pipeline</option>
              <option value="Service Pipeline">Service Pipeline</option>
            </select>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: T.textMuted, fontWeight: 600 }}>
            {canUpdateActions
              ? "Drag cards between columns to update stage"
              : "View-only mode: no permission to move leads between stages."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: T.radiusMd, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: T.font, display: "flex", alignItems: "center", gap: 8 }}>
            Add Lead
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20, flexShrink: 0, display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 450 }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", zIndex: 1 }}>
            <circle cx="7" cy="7" r="5.5" stroke={T.textMuted} strokeWidth="2" />
            <path d="M11 11L14 14" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search leads by name or type..." 
            style={{ 
              width: "100%", 
              padding: "11px 40px 11px 38px", 
              border: `1.5px solid ${T.border}`, 
              borderRadius: T.radiusMd, 
              outline: "none", 
              fontSize: 14, 
              fontFamily: T.font, 
              color: T.textDark,
              backgroundColor: "#fff",
              transition: "all 0.2s"
            }} 
            onFocus={(e) => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.boxShadow = `0 0 0 4px ${T.blue}15`; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
          />
          {search && (
            <button 
              onClick={() => setSearch("")}
              style={{ 
                position: "absolute", 
                right: 10, 
                top: "50%", 
                transform: "translateY(-50%)", 
                background: "none", 
                border: "none", 
                cursor: "pointer", 
                color: T.textMuted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 4,
                borderRadius: "50%",
                transition: "background-color 0.2s",
                zIndex: 2
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}
        </div>
        <button style={{ padding: "10px 16px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, backgroundColor: "#fff", color: T.textMid, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: T.font, transition: "all 0.15s" }}>Filter</button>
        <button style={{ padding: "10px 16px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, backgroundColor: "#fff", color: T.textMid, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: T.font, transition: "all 0.15s" }}>Sort</button>
      </div>

      {/* Kanban / List Board */}
      {viewMode === "kanban" ? (
        renderKanbanBoard()
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: 24 }}>
          <div style={{ backgroundColor: T.cardBg, borderRadius: T.radiusXl, boxShadow: T.shadowSm, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: T.rowBg }}>
                {["Lead Name", "Type", "Stage", "Premium", "Source", "Agent", "Days In Stage"].map(th => (
                  <th key={th} style={{ padding: "14px 16px", fontSize: 11, fontWeight: 700, color: T.textMuted, textAlign: "left" }}>{th}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedLeads.map((lead, i) => (
                <tr key={lead.id} onClick={() => setViewingLead({ id: lead.id, name: lead.name })} style={{ borderTop: `1px solid ${T.border}`, backgroundColor: i % 2 === 0 ? T.cardBg : "#fafbfd", cursor: "pointer", transition: "background-color 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = i % 2 === 0 ? T.cardBg : "#fafbfd"; }}
                >
                  <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: T.textDark }}>{lead.name}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLORS[lead.type] ?? T.textMuted, backgroundColor: TYPE_COLORS[lead.type] ? TYPE_COLORS[lead.type] + "15" : T.rowBg, borderRadius: 4, padding: "2px 8px" }}>{lead.type}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ backgroundColor: STAGE_CONFIG[lead.stage].bg, color: STAGE_CONFIG[lead.stage].color, border: `1px solid ${STAGE_CONFIG[lead.stage].color}44`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>{lead.stage}</span>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 800, color: T.textDark }}>${lead.premium.toLocaleString()}</td>
                  <td style={{ padding: "14px 16px", fontSize: 12, fontWeight: 600, color: T.textMuted }}>{lead.source}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: lead.agentColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 8, fontWeight: 800 }}>{lead.agent}</div>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 12, fontWeight: 600, color: lead.daysInStage > 7 ? T.danger : T.textMuted }}>{lead.daysInStage} days</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={page}
            totalItems={filteredLeads.length}
            itemsPerPage={itemsPerPage}
            itemLabel="leads"
            onPageChange={setPage}
          />
        </div>
        </div>
      )}
    </div>
  );
}
