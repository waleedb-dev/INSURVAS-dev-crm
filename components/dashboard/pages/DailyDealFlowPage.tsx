"use client";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { Pagination } from "@/components/ui";
import LeadViewComponent from "./LeadViewComponent";
import DealEditorComponent from "./DealEditorComponent";

type DealStatus = "Approved" | "Under Review" | "Declined" | "Pending Docs" | "Submitted";
type PolicyType = "Auto" | "Home" | "Life" | "Health" | "Commercial";

interface Deal {
  id: string;
  client: string;
  policyType: PolicyType;
  agent: string;
  agentColor: string;
  premium: number;
  submittedAt: string;
  status: DealStatus;
  carrier: string;
}

const DEALS: Deal[] = [
  { id:"DL-2024-001", client:"James Whitfield",   policyType:"Auto",       agent:"Shawn Stone",    agentColor:"#4285f4", premium:1240,  submittedAt:"09:14 AM", status:"Approved",      carrier:"Progressive" },
  { id:"DL-2024-002", client:"Maria Gonzalez",    policyType:"Home",       agent:"Emily Tyler",    agentColor:"#ec4899", premium:2180,  submittedAt:"09:32 AM", status:"Under Review",  carrier:"State Farm" },
  { id:"DL-2024-003", client:"Robert Chen",       policyType:"Life",       agent:"Louis Castro",   agentColor:"#8b5cf6", premium:4500,  submittedAt:"09:47 AM", status:"Approved",      carrier:"New York Life" },
  { id:"DL-2024-004", client:"Angela Brooks",     policyType:"Health",     agent:"Blake Silva",    agentColor:"#0ea5e9", premium:3200,  submittedAt:"10:05 AM", status:"Pending Docs",  carrier:"Blue Cross" },
  { id:"DL-2024-005", client:"Tom Harrington",    policyType:"Commercial", agent:"Randy Delgado",  agentColor:"#f59e0b", premium:8750,  submittedAt:"10:18 AM", status:"Under Review",  carrier:"Travelers" },
  { id:"DL-2024-006", client:"Sarah Kim",         policyType:"Auto",       agent:"Oscar Holloway", agentColor:"#f97316", premium:980,   submittedAt:"10:33 AM", status:"Approved",      carrier:"Geico" },
  { id:"DL-2024-007", client:"Derek Mason",       policyType:"Home",       agent:"Joel Phillips",  agentColor:"#14b8a6", premium:1875,  submittedAt:"10:51 AM", status:"Declined",      carrier:"Allstate" },
  { id:"DL-2024-008", client:"Priya Patel",       policyType:"Life",       agent:"Wayne Marsh",    agentColor:"#64748b", premium:6200,  submittedAt:"11:04 AM", status:"Submitted",     carrier:"MetLife" },
  { id:"DL-2024-009", client:"Carlos Rivera",     policyType:"Health",     agent:"Shawn Stone",    agentColor:"#4285f4", premium:2900,  submittedAt:"11:22 AM", status:"Approved",      carrier:"Aetna" },
  { id:"DL-2024-010", client:"Linda Tran",        policyType:"Commercial", agent:"Emily Tyler",    agentColor:"#ec4899", premium:12400, submittedAt:"11:38 AM", status:"Pending Docs",  carrier:"Hartford" },
  { id:"DL-2024-011", client:"Nathan Ford",       policyType:"Auto",       agent:"Louis Castro",   agentColor:"#8b5cf6", premium:1100,  submittedAt:"11:55 AM", status:"Approved",      carrier:"Progressive" },
  { id:"DL-2024-012", client:"Grace Nakamura",    policyType:"Home",       agent:"Blake Silva",    agentColor:"#0ea5e9", premium:3450,  submittedAt:"12:10 PM", status:"Under Review",  carrier:"State Farm" },
];

const COMMISSIONS = [
  { id:"C-001", amount:148.8,   status:"Paid" },
  { id:"C-002", amount:218.0,   status:"Pending" },
  { id:"C-003", amount:675.0,   status:"Paid" },
  { id:"C-004", amount:256.0,   status:"Under Review" },
  { id:"C-005", amount:875.0,   status:"Pending" },
  { id:"C-006", amount:117.6,   status:"Paid" },
  { id:"C-007", amount:187.5,   status:"On Hold" },
  { id:"C-008", amount:930.0,   status:"Pending" },
  { id:"C-009", amount:232.0,   status:"Paid" },
  { id:"C-010", amount:1240.0,  status:"Under Review" },
  { id:"C-011", amount:132.0,   status:"Paid" },
  { id:"C-012", amount:345.0,   status:"Paid" },
];

const STATUS_CONFIG: Record<DealStatus, { bg: string; color: string }> = {
  "Approved":     { bg: "#dcfce7", color: "#16a34a" },
  "Under Review": { bg: "#fef9c3", color: "#ca8a04" },
  "Declined":     { bg: "#fee2e2", color: "#dc2626" },
  "Pending Docs": { bg: "#ffe4c4", color: "#c2410c" },
  "Submitted":    { bg: T.blueLight, color: T.blue },
};

const POLICY_CONFIG: Record<PolicyType, { bg: string; color: string }> = {
  "Auto":       { bg: "#eff6ff", color: "#2563eb" },
  "Home":       { bg: "#fdf4ff", color: "#9333ea" },
  "Life":       { bg: "#f0fdf4", color: "#16a34a" },
  "Health":     { bg: "#fff7ed", color: "#ea580c" },
  "Commercial": { bg: "#f8fafc", color: "#475569" },
};

export default function DailyDealFlowPage({ canProcessActions = true }: { canProcessActions?: boolean }) {
  const [deals, setDeals] = useState(DEALS);
  const [filterStatus, setFilterStatus] = useState<DealStatus | "All">("All");
  const [filterAgent, setFilterAgent] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [viewingLead, setViewingLead] = useState<{ id: string, name: string } | null>(null);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  const total   = COMMISSIONS.reduce((s, c) => s + c.amount, 0);
  const paid    = COMMISSIONS.filter((c) => c.status === "Paid").reduce((s, c) => s + c.amount, 0);
  const pending = COMMISSIONS.filter((c) => c.status === "Pending").reduce((s, c) => s + c.amount, 0);

  const filtered = deals.filter((d) => {
    const matchStatus = filterStatus === "All" || d.status === filterStatus;
    const matchAgent = filterAgent === "All" || d.agent === filterAgent;
    const matchType = filterType === "All" || d.policyType === filterType;
    const matchSearch = !search || d.client.toLowerCase().includes(search.toLowerCase()) || d.agent.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchAgent && matchType && matchSearch;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterAgent, filterType, search]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
    if (filtered.length === 0 && page !== 1) {
      setPage(1);
    }
  }, [filtered.length, page, totalPages]);

  const agents = Array.from(new Set(deals.map(d => d.agent)));
  const policyTypes = Array.from(new Set(deals.map(d => d.policyType)));

  const initialAgentColorMap = DEALS.reduce<Record<string, string>>((acc, deal) => {
    acc[deal.agent] = deal.agentColor;
    return acc;
  }, {});

  if (viewingLead) {
    return (
      <LeadViewComponent
        leadId={viewingLead.id}
        leadName={viewingLead.name}
        onBack={() => setViewingLead(null)}
      />
    );
  }

  if (showAddDeal || editingDeal) {
    return (
      <DealEditorComponent
        deal={editingDeal || undefined}
        agents={agents}
        existingCount={deals.length}
        initialAgentColorMap={initialAgentColorMap}
        onClose={() => { setShowAddDeal(false); setEditingDeal(null); }}
        onSubmit={(deal) => {
          if (editingDeal) {
            setDeals((prev) => prev.map((item) => (item.id === deal.id ? deal : item)));
          } else {
            setDeals((prev) => [deal, ...prev]);
            setPage(1);
          }
          setShowAddDeal(false);
          setEditingDeal(null);
        }}
      />
    );
  }

  return (
    <div onClick={() => setActiveMenu(null)}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>Today — {new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textDark, margin: 0 }}>Daily Deal Flow</h1>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            disabled={!canProcessActions}
            title={!canProcessActions ? "Missing permission: action.daily_deal_flow.process" : undefined}
            style={{
              backgroundColor: "transparent",
              color: canProcessActions ? T.blue : T.border,
              border: `1.5px solid ${canProcessActions ? T.blue : T.border}`,
              borderRadius: T.radiusMd,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: canProcessActions ? "pointer" : "not-allowed",
              fontFamily: T.font,
              transition: "all 0.15s"
            }}
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowAddDeal(true)}
            disabled={!canProcessActions}
            title={!canProcessActions ? "Missing permission: action.daily_deal_flow.process" : undefined}
            style={{
              backgroundColor: canProcessActions ? T.blue : T.border,
              color: "#fff",
              border: "none",
              borderRadius: T.radiusMd,
              padding: "10px 22px",
              fontSize: 13,
              fontWeight: 700,
              cursor: canProcessActions ? "pointer" : "not-allowed",
              fontFamily: T.font,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s"
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Add Deal
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Earned (YTD)", value: `$${(total * 8.4).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`, color: T.blue },
          { label: "Paid This Month",    value: `$${paid.toFixed(2)}`,    color: "#16a34a" },
          { label: "Pending Payment",    value: `$${pending.toFixed(2)}`, color: "#ca8a04" },
          { label: "Avg Commission",     value: `$${(total / COMMISSIONS.length).toFixed(0)}`, color: "#7c3aed" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: T.cardBg, borderRadius: T.radiusLg, padding: "18px 20px", boxShadow: T.shadowSm, borderLeft: `4px solid ${color}` }}>
            <p style={{ margin: "0 0 6px", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{label}</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div style={{ backgroundColor: T.cardBg, borderRadius: T.radiusXl, boxShadow: T.shadowSm, overflow: "hidden" }}>
        <div style={{ padding: "20px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 450 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", zIndex: 1 }}>
              <circle cx="7" cy="7" r="5.5" stroke={T.textMuted} strokeWidth="2" />
              <path d="M11 11L14 14" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Search deals, clients…" 
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
          
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}>
              <option value="All">All Statuses</option>
              {["Approved", "Under Review", "Pending Docs", "Submitted", "Declined"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}>
              <option value="All">All Agents</option>
              {agents.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}>
              <option value="All">All Policies</option>
              {policyTypes.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Active Filter Chips */}
        {(filterStatus !== "All" || filterAgent !== "All" || filterType !== "All") && (
          <div style={{ padding: "10px 20px", backgroundColor: "#fafcfe", borderBottom: `1px solid ${T.border}`, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginRight: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Active Filters:</span>
            
            {filterStatus !== "All" && (
              <FilterChip label={`Status: ${filterStatus}`} onClear={() => setFilterStatus("All")} />
            )}
            {filterAgent !== "All" && (
              <FilterChip label={`Agent: ${filterAgent}`} onClear={() => setFilterAgent("All")} />
            )}
            {filterType !== "All" && (
              <FilterChip label={`Policy: ${filterType}`} onClear={() => setFilterType("All")} />
            )}

            <button 
              onClick={() => { setFilterStatus("All"); setFilterAgent("All"); setFilterType("All"); }}
              style={{ background: "none", border: "none", color: T.blue, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "4px 8px", fontFamily: T.font, marginLeft: "auto" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.textDecoration = "underline"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.textDecoration = "none"}
            >
              Reset All
            </button>
          </div>
        )}

        {/* Table */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: T.rowBg }}>
              {["Deal ID","Client","Policy Type","Agent","Carrier","Premium","Submitted","Status","Actions"].map((h) => (
                <th key={h} style={{ padding: "14px 16px", fontSize: 11, fontWeight: 700, color: T.textMuted, textAlign: h === "Actions" ? "center" : "left", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((d, i) => {
              const sc = STATUS_CONFIG[d.status];
              const pc = POLICY_CONFIG[d.policyType];
              return (
                <tr key={d.id} style={{ borderTop: `1px solid ${T.border}`, backgroundColor: i % 2 === 0 ? T.cardBg : "#fafbfd", transition: "background-color 0.12s", cursor: "pointer" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.blueFaint; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = i % 2 === 0 ? T.cardBg : "#fafbfd"; }}
                >
                  <td 
                    onClick={(e) => { e.stopPropagation(); setViewingLead({ id: d.id, name: d.client }); }}
                    style={{ padding: "12px 16px", fontSize: 12, fontWeight: 700, color: T.blue, textDecoration: "underline", cursor: "pointer" }}
                  >
                    {d.id}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: T.textDark }}>{d.client}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ backgroundColor: pc.bg, color: pc.color, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{d.policyType}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: d.agentColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{d.agent.split(" ").map(n=>n[0]).join("")}</div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.textMid }}>{d.agent}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: T.textMuted, fontWeight: 600 }}>{d.carrier}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 800, color: T.textDark }}>${d.premium.toLocaleString()}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{d.submittedAt}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ backgroundColor: "transparent", color: sc.color, border: `1px solid ${sc.color}44`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{d.status}</span>
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center", position: "relative" }}>
                    <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === d.id ? null : d.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 4 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                    </button>
                     {activeMenu === d.id && (
                      <div style={{ position: "absolute", top: "calc(100% - 10px)", right: 40, width: 140, backgroundColor: T.cardBg, borderRadius: T.radiusMd, boxShadow: T.shadowLg, border: `1px solid ${T.border}`, zIndex: 100, overflow: "hidden", animation: "fadeInDown 0.15s ease" }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { setViewingLead({ id: d.id, name: d.client }); setActiveMenu(null); }} style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "none", cursor: "pointer", fontFamily: T.font, fontSize: 12, fontWeight: 600, color: T.textMid, textAlign: "left", transition: "background-color 0.15s" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                        >View Details</button>
                        <button
                            onClick={() => { setEditingDeal(d); setActiveMenu(null); }}
                            style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "none", cursor: "pointer", fontFamily: T.font, fontSize: 12, fontWeight: 600, color: T.textMid, textAlign: "left", transition: "background-color 0.15s" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                        >Edit Deal</button>
                        <button style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "none", cursor: "pointer", fontFamily: T.font, fontSize: 12, fontWeight: 600, color: T.danger, textAlign: "left", transition: "background-color 0.15s" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fef2f2"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                        >Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <Pagination
          page={page}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          itemLabel="deals"
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      gap: 6, 
      backgroundColor: "#fff", 
      border: `1px solid ${T.border}`, 
      borderRadius: 100, 
      padding: "4px 4px 4px 12px", 
      boxShadow: "0 1px 2px rgba(0,0,0,0.02)" 
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.textMid }}>{label}</span>
      <button 
        onClick={onClear}
        style={{ 
          width: 20, 
          height: 20, 
          borderRadius: "50%", 
          border: "none", 
          backgroundColor: T.rowBg, 
          color: T.textMuted, 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          cursor: "pointer",
          transition: "all 0.15s"
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = T.danger + "15"; (e.currentTarget as HTMLElement).style.color = T.danger; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; (e.currentTarget as HTMLElement).style.color = T.textMuted; }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  );
}
