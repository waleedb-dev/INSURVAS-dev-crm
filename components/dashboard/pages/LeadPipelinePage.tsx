"use client";
import { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { Pagination, Avatar, Badge, Table } from "@/components/ui";
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
  { id:"P-015", name:"William Scott",     type:"Auto",       premium:1850,  source:"Web",      agent:"SS", agentColor:"#4285f4", daysInStage:0, stage:"Attempted Contact" },
  { id:"P-016", name:"Emily Watson",      type:"Home",       premium:2400,  source:"Referral", agent:"ET", agentColor:"#ec4899", daysInStage:1, stage:"Attempted Contact" },
  { id:"P-017", name:"Michael Chang",     type:"Life",       premium:5200,  source:"Walk-in",  agent:"LC", agentColor:"#8b5cf6", daysInStage:2, stage:"Discovery Call" },
  { id:"P-018", name:"Sophie Miller",     type:"Health",     premium:3100,  source:"Phone",    agent:"BS", agentColor:"#0ea5e9", daysInStage:3, stage:"Discovery Call" },
  { id:"P-019", name:"David Wilson",      type:"Commercial", premium:9200,  source:"Web",      agent:"RD", agentColor:"#f59e0b", daysInStage:4, stage:"Needs Quote" },
  { id:"P-020", name:"Rachel Green",      type:"Auto",       premium:1050,  source:"Referral", agent:"OH", agentColor:"#f97316", daysInStage:2, stage:"Needs Quote" },
  { id:"P-021", name:"Chris Evans",       type:"Home",       premium:1950,  source:"Email",    agent:"JP", agentColor:"#14b8a6", daysInStage:5, stage:"Underwriting" },
  { id:"P-022", name:"Jessica Alba",      type:"Life",       premium:6800,  source:"Walk-in",  agent:"WM", agentColor:"#64748b", daysInStage:6, stage:"Underwriting" },
  { id:"P-023", name:"Tony Stark",        type:"Health",     premium:3400,  source:"Web",      agent:"SS", agentColor:"#4285f4", daysInStage:8, stage:"Bound" },
  { id:"P-024", name:"Bruce Wayne",       type:"Commercial", premium:15000, source:"Referral", agent:"ET", agentColor:"#ec4899", daysInStage:9, stage:"Bound" },
  { id:"P-025", name:"Peter Parker",      type:"Auto",       premium:850,   source:"Phone",    agent:"LC", agentColor:"#8b5cf6", daysInStage:1, stage:"New Lead" },
  { id:"P-026", name:"Wanda Maximoff",    type:"Home",       premium:2900,  source:"Web",      agent:"BS", agentColor:"#0ea5e9", daysInStage:4, stage:"Contacted" },
  { id:"P-027", name:"Steve Rogers",      type:"Life",       premium:4200,  source:"Referral", agent:"RD", agentColor:"#f59e0b", daysInStage:2, stage:"Presentation" },
  { id:"P-028", name:"Natasha Romanoff",  type:"Auto",       premium:1300,  source:"Web",      agent:"OH", agentColor:"#f97316", daysInStage:1, stage:"Quoted" },
  { id:"P-029", name:"Clint Barton",      type:"Health",     premium:2100,  source:"Phone",    agent:"JP", agentColor:"#14b8a6", daysInStage:3, stage:"Discovery Call" },
  { id:"P-030", name:"Thor Odinson",      type:"Commercial", premium:25000, source:"Walk-in",  agent:"WM", agentColor:"#64748b", daysInStage:0, stage:"New Lead" },
  { id:"P-031", name:"Sam Wilson",        type:"Auto",       premium:1150,  source:"Email",    agent:"SS", agentColor:"#4285f4", daysInStage:2, stage:"Attempted Contact" },
  { id:"P-032", name:"Bucky Barnes",      type:"Home",       premium:3100,  source:"Web",      agent:"ET", agentColor:"#ec4899", daysInStage:5, stage:"Needs Quote" },
  { id:"P-033", name:"James Rhodes",      type:"Life",       premium:5800,  source:"Referral", agent:"LC", agentColor:"#8b5cf6", daysInStage:1, stage:"Underwriting" },
  { id:"P-034", name:"Scott Lang",        type:"Health",     premium:1900,  source:"Phone",    agent:"BS", agentColor:"#0ea5e9", daysInStage:4, stage:"Bound" },
  { id:"P-035", name:"Hope van Dyne",     type:"Commercial", premium:11000, source:"Web",      agent:"RD", agentColor:"#f59e0b", daysInStage:3, stage:"Won" },
  { id:"P-036", name:"Carol Danvers",     type:"Auto",       premium:1550,  source:"Referral", agent:"OH", agentColor:"#f97316", daysInStage:1, stage:"New Lead" },
  { id:"P-037", name:"T'Challa Udaku",    type:"Home",       premium:4500,  source:"Walk-in",  agent:"JP", agentColor:"#14b8a6", daysInStage:2, stage:"Contacted" },
  { id:"P-038", name:"Nick Fury",         type:"Life",       premium:8000,  source:"Email",    agent:"WM", agentColor:"#64748b", daysInStage:0, stage:"Discovery Call" },
  { id:"P-039", name:"Maria Hill",        type:"Health",     premium:2700,  source:"Phone",    agent:"SS", agentColor:"#4285f4", daysInStage:3, stage:"Presentation" },
];

export default function LeadPipelinePage({ canUpdateActions = true }: { canUpdateActions?: boolean }) {
  const [leads, setLeads] = useState(INITIAL_LEADS);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Stage | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  const [pipeline, setPipeline] = useState<string>("Sales Pipeline");
  const [search, setSearch] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [viewingLead, setViewingLead] = useState<{ id: string, name: string } | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<"Filters" | "Fields">("Filters");
  const [activeTab, setActiveTab] = useState("Opportunities");

  const byStage = (stage: Stage) => leads.filter((l) => l.stage === stage);
  const stageValue = (stage: Stage) => byStage(stage).reduce((s, l) => s + l.premium, 0);

  const handleDrop = (stage: Stage) => {
    if (dragId) {
      setLeads((prev) => prev.map((l) => l.id === dragId ? { ...l, stage, daysInStage: 0 } : l));
    }
    setDragId(null);
    setDragOver(null);
  };

  const toggleCollapse = (stage: Stage) => {
    setCollapsedStages((prev) => ({ ...prev, [stage]: !prev[stage] }));
  };

  const filteredLeads = leads.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.type.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
    if (filteredLeads.length === 0 && page !== 1) setPage(1);
  }, [filteredLeads.length, page, totalPages]);

  const renderKanbanBoard = () => (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <style>{`
        .kanban-container {
          background-color: transparent;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }
        .kanban-board {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 8px 4px;
          align-items: stretch;
          flex: 1;
          min-height: 0;
          scrollbar-width: thin;
          scrollbar-color: ${T.border} transparent;
        }
        .kanban-board::-webkit-scrollbar { height: 6px; }
        .kanban-board::-webkit-scrollbar-track { background: transparent; }
        .kanban-board::-webkit-scrollbar-thumb { background-color: #e2e8f0; border-radius: 10px; }
        
        .kanban-column-wrapper {
          min-width: 300px;
          width: 300px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background-color: transparent;
          overflow: hidden;
          transition: width 0.2s ease;
          height: 100%;
        }
        
        .kanban-column-body {
          overflow-y: auto;
          max-height: calc(100vh - 320px);
          min-height: 480px;
          padding: 12px 2px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .kanban-column-body::-webkit-scrollbar { width: 5px; }
        .kanban-column-body::-webkit-scrollbar-track { background: transparent; }
        .kanban-column-body::-webkit-scrollbar-thumb { background-color: #e2e8f0; border-radius: 10px; }
      `}</style>
      
      <div className="kanban-container">
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
                  minWidth: isCollapsed ? 50 : 280,
                  width: isCollapsed ? 50 : 280,
                }}
              >
                {isCollapsed ? (
                  <div style={{ backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "16px 0", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }} onClick={() => toggleCollapse(stage)}>
                    <div style={{ backgroundColor: cfg.color, color: "#fff", borderRadius: 10, padding: "2px 7px", fontSize: 11, fontWeight: 800, marginBottom: 16 }}>
                      {stageLeads.length}
                    </div>
                    <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 13, fontWeight: 800, color: cfg.color, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>
                      {stage}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ backgroundColor: "#fff", padding: "12px 16px", border: `1px solid ${T.border}`, borderTop: `4px solid ${cfg.color}`, borderRadius: "8px 8px 0 0", flexShrink: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: T.textDark }}>{stage}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                           <button onClick={() => toggleCollapse(stage)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: T.textMuted }}>
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                           </button>
                        </div>
                      </div>
                      <div style={{ marginTop: 4, display: "flex", gap: 12, fontSize: 12 }}>
                        <span style={{ color: T.textMuted, fontWeight: 600 }}>{stageLeads.length} Opportunities</span>
                        <span style={{ color: T.textDark, fontWeight: 800 }}>${stageValue(stage).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="kanban-column-body" style={{ backgroundColor: isOver ? cfg.bg + "40" : "transparent", transition: "background-color 0.2s" }}>
                      {stageLeads.map((lead) => (
                        <div
                          key={lead.id}
                          onClick={() => setViewingLead({ id: lead.id, name: lead.name })}
                          draggable={canUpdateActions}
                          onDragStart={() => { if (canUpdateActions) setDragId(lead.id); }}
                          onDragEnd={() => { setDragId(null); setDragOver(null); }}
                          style={{
                            backgroundColor: "#fff", borderRadius: 8, padding: "16px",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${T.border}`,
                            borderLeft: `3px solid ${cfg.color}`,
                            cursor: canUpdateActions ? "grab" : "default",
                            opacity: dragId === lead.id ? 0.5 : 1,
                            transition: "all 0.15s",
                            position: "relative"
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.boxShadow = T.shadowSm; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "flex-start" }}>
                            <div style={{ flex: 1, marginRight: 8 }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.textDark, lineHeight: 1.4 }}>
                                {lead.name} - (555) 000-{lead.id.split('-')[1]}
                              </p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: lead.agentColor, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #fff", boxShadow: "0 0 0 1px #e2e8f0", overflow: "hidden" }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color: "#fff" }}>{lead.agent}</span>
                              </div>
                              <input type="checkbox" onClick={(e) => e.stopPropagation()} style={{ width: 14, height: 14, accentColor: T.blue, cursor: "pointer", border: `1.5px solid ${T.border}`, borderRadius: 3 }} />
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                            <div style={{ display: "flex", fontSize: 12, gap: 8 }}>
                               <span style={{ color: T.textMuted, fontWeight: 500, width: 110 }}>Opportunity Source:</span>
                               <span style={{ color: T.textDark, fontWeight: 600 }}>{lead.source}-call center</span>
                            </div>
                            <div style={{ display: "flex", fontSize: 12, gap: 8 }}>
                               <span style={{ color: T.textMuted, fontWeight: 500, width: 110 }}>Opportunity Value:</span>
                               <span style={{ color: T.textDark, fontWeight: 600 }}>${lead.premium.toLocaleString()}</span>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, borderTop: `1px solid ${T.borderLight}` }}>
                             {[
                               { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> },
                               { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
                               { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>, count: 11 },
                               { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, count: 52 },
                               { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
                               { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
                             ].map((item, idx) => (
                               <div key={idx} style={{ color: T.textMuted, display: "flex", alignItems: "center", position: "relative", cursor: "pointer" }}>
                                 {item.count !== undefined && item.count > 0 && (
                                   <div style={{ position: "absolute", top: -8, right: -10, backgroundColor: T.blue, color: "#fff", fontSize: 8, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #fff", padding: "0 2px" }}>{item.count}</div>
                                 )}
                                 {item.icon}
                               </div>
                             ))}
                          </div>
                        </div>
                      ))}
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

  const [showAddLead, setShowAddLead] = useState(false);

  if (viewingLead) {
    return <LeadViewComponent leadId={viewingLead.id} leadName={viewingLead.name} onBack={() => setViewingLead(null)} />;
  }

  if (showAddLead) {
    return <LeadViewComponent isCreation onBack={() => setShowAddLead(false)} onSubmit={(newLead: any) => {
      const mappedLead: Lead = {
        id: `P-0${leads.length + 1}`,
        name: newLead.name,
        type: newLead.type,
        premium: newLead.premium,
        source: newLead.source,
        agent: "SS",
        agentColor: "#4285f4",
        daysInStage: 0,
        stage: newLead.stage as Stage
      };
      setLeads(prev => [mappedLead, ...prev]);
      setShowAddLead(false);
    }} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0, paddingBottom: 24, position: "relative" }}>
      {/* Drawer Overlay */}
      {isFilterOpen && (
        <div onClick={() => setIsFilterOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.15)", zIndex: 1000, backdropFilter: "blur(2px)" }} />
      )}

      {/* Filter Sidebar */}
      <div style={{ position: "fixed", top: 0, right: isFilterOpen ? 0 : -420, width: 420, bottom: 0, backgroundColor: "#fff", zIndex: 1001, boxShadow: "-8px 0 32px rgba(0,0,0,0.05)", transition: "right 0.3s ease", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px", borderBottom: `1.5px solid ${T.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Customise Card</h2>
          <button onClick={() => setIsFilterOpen(false)} style={{ background: T.rowBg, border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
           {/* Filters Content Placeholder */}
           <p style={{ color: T.textMuted, fontSize: 13 }}>Sidebar filters content matched GHL aesthetic...</p>
        </div>
        <div style={{ padding: "16px 24px", borderTop: `1.5px solid ${T.borderLight}`, display: "flex", gap: 12, justifyContent: "flex-end", backgroundColor: "#f9fafb" }}>
          <button onClick={() => setIsFilterOpen(false)} style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 20px", fontWeight: 700 }}>Cancel</button>
          <button onClick={() => setIsFilterOpen(false)} style={{ background: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700 }}>Apply</button>
        </div>
      </div>

      {/* Pipeline & Filter Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: `1px solid ${T.pageBg}`, flexShrink: 0, gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <select value={pipeline} onChange={(e) => setPipeline(e.target.value)} style={{ padding: "8px 14px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 800, backgroundColor: "#fff", cursor: "pointer", outline: "none" }}>
            <option value="Sales Pipeline">Sales Pipeline</option>
          </select>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.blue, backgroundColor: T.blueFaint, padding: "4px 10px", borderRadius: 20 }}>{leads.length} opportunities</span>
          
          <div style={{ width: 1, height: 24, backgroundColor: T.border, margin: "0 4px" }} />
          
          <button onClick={() => setIsFilterOpen(true)} style={{ padding: "8px 16px", border: `1.5px solid ${T.blue}30`, borderRadius: 20, backgroundColor: T.blueFaint, color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Advanced Filters
          </button>
          <button style={{ padding: "8px 16px", border: `1.5px solid ${T.border}`, borderRadius: 20, backgroundColor: "#fff", color: T.textMid, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
            Sort (1)
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
             <button onClick={() => setViewMode("kanban")} style={{ padding: "8px 10px", background: viewMode === "kanban" ? T.blueFaint : "#fff", color: viewMode === "kanban" ? T.blue : T.textMuted, border: "none", cursor: "pointer" }}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
             </button>
             <button onClick={() => setViewMode("list")} style={{ padding: "8px 10px", background: viewMode === "list" ? T.blueFaint : "#fff", color: viewMode === "list" ? T.blue : T.textMuted, border: "none", borderLeft: `1px solid ${T.border}`, cursor: "pointer" }}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
             </button>
          </div>
          <button onClick={() => setShowAddLead(true)} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Add lead</button>
        </div>
      </div>

      {/* Optimized Search Row */}
      <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", padding: "12px 0", flexShrink: 0 }}>
        <div style={{ position: "relative", width: 320 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", zIndex: 1 }}>
            <circle cx="7" cy="7" r="5.5" stroke={T.textMuted} strokeWidth="2" />
            <path d="M11 11L14 14" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Search Opportunities..." 
            style={{ 
              padding: "12px 42px 12px 44px", 
              border: `1.5px solid ${T.border}`, 
              borderRadius: T.radiusMd, 
              fontSize: 14, 
              fontFamily: T.font, 
              color: T.textDark, 
              width: "100%", 
              backgroundColor: T.rowBg,
              outline: "none",
              transition: "all 0.2s"
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.backgroundColor = T.cardBg; e.currentTarget.style.boxShadow = `0 0 0 4px ${T.blue}15`; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.backgroundColor = T.rowBg; e.currentTarget.style.boxShadow = "none"; }}
          />
          {search && (
            <button 
              onClick={() => setSearch("")}
              style={{ 
                position: "absolute", 
                right: 12, 
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}
        </div>
      </div>

      {/* Main Board Area */}
      {viewMode === "kanban" ? renderKanbanBoard() : (
        <div style={{ flex: 1, backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto" }}>
          <Table
            data={paginatedLeads}
            onRowClick={(lead) => setViewingLead({ id: lead.id, name: lead.name })}
            columns={[
              {
                header: <input type="checkbox" style={{ width: 15, height: 15, accentColor: T.blue }} />,
                key: "checkbox",
                width: 40,
                align: "center",
                render: () => <input type="checkbox" onClick={(e) => e.stopPropagation()} style={{ width: 14, height: 14, accentColor: T.blue }} />
              },
              {
                header: "Opportunity",
                key: "name",
                sortable: true,
                render: (lead) => <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.blue }}>{lead.name} ...</p>
              },
              {
                header: "Contact",
                key: "contact",
                render: (lead) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar name={lead.name} size={26} style={{ border: `1px solid ${T.border}` }} />
                    <span style={{ fontSize: 13, color: T.textMid }}>{lead.name}...</span>
                  </div>
                )
              },
              {
                header: "Stage",
                key: "stage",
                sortable: true,
                render: (lead) => <span style={{ fontSize: 13, color: T.textMid }}>{lead.stage}...</span>
              },
              {
                header: "Opportunity Value",
                key: "premium",
                sortable: true,
                render: (lead) => <span style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>${lead.premium.toLocaleString()}</span>
              },
              {
                header: "Status",
                key: "status",
                render: () => <Badge label="open" variant="custom" color={T.textMid} bgColor={T.pageBg} />
              },
              {
                header: "Opportunity Owner",
                key: "agent",
                render: (lead) => <Avatar name={lead.agent} size={28} style={{ backgroundColor: lead.agentColor }} />
              },
              {
                header: "Tags",
                key: "tags",
                render: () => <span style={{ backgroundColor: T.rowBg, borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700, color: T.textMuted }}>call center</span>
              },
              {
                header: "Created",
                key: "created",
                sortable: true,
                render: () => (
                  <div style={{ fontSize: 11, color: T.textMid }}>
                     <p style={{ margin: 0 }}>Mar 9, 2026</p>
                     <p style={{ margin: 0, fontSize: 10, color: T.textMuted }}>03:51 PM</p>
                  </div>
                )
              },
              {
                header: "Updated",
                key: "updated",
                sortable: true,
                render: () => (
                  <div style={{ fontSize: 11, color: T.textMid }}>
                     <p style={{ margin: 0 }}>Mar 16, 2026</p>
                     <p style={{ margin: 0, fontSize: 10, color: T.textMuted }}>10:42 AM</p>
                  </div>
                )
              },
              {
                header: "Actions",
                key: "actions",
                align: "center",
                render: (lead) => (
                  <div style={{ position: "relative" }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === lead.id ? null : lead.id); }} 
                      style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 4, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                    </button>
                    {activeMenu === lead.id && (
                      <div style={{ position: "absolute", top: "calc(100% - 4px)", right: 16, width: 140, backgroundColor: "#fff", borderRadius: T.radiusMd, boxShadow: T.shadowLg, border: `1.5px solid ${T.border}`, zIndex: 100, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { setViewingLead({ id: lead.id, name: lead.name }); setActiveMenu(null); }} style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.textDark, textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = T.rowBg} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>View Details</button>
                        <button style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.textDark, textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = T.rowBg} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>Edit Lead</button>
                        <button style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.danger, textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#fef2f2"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>Delete</button>
                      </div>
                    )}
                  </div>
                )
              }
            ]}
          />
          </div>
          <Pagination page={page} totalItems={filteredLeads.length} itemsPerPage={itemsPerPage} itemLabel="leads" onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
