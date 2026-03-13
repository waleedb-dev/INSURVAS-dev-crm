"use client";
import { useState } from "react";
import { T } from "@/lib/theme";

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
  const [filter, setFilter] = useState<DealStatus | "All">("All");
  const [search, setSearch] = useState("");

  const total   = COMMISSIONS.reduce((s, c) => s + c.amount, 0);
  const paid    = COMMISSIONS.filter((c) => c.status === "Paid").reduce((s, c) => s + c.amount, 0);
  const pending = COMMISSIONS.filter((c) => c.status === "Pending").reduce((s, c) => s + c.amount, 0);

  const filtered = DEALS.filter((d) => {
    const matchStatus = filter === "All" || d.status === filter;
    const matchSearch = !search || d.client.toLowerCase().includes(search.toLowerCase()) || d.agent.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>Today — {new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}</p>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textDark, margin: 0 }}>Daily Deal Flow</h1>
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
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["All", "Approved", "Under Review", "Pending Docs", "Submitted", "Declined"] as const).map((s) => (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                backgroundColor: filter === s ? T.blue : T.rowBg, color: filter === s ? "#fff" : T.textMuted,
                fontSize: 12, fontWeight: 700, fontFamily: T.font, transition: "all 0.15s",
              }}>{s}</button>
            ))}
          </div>
          <div style={{ position: "relative" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="7" cy="7" r="5.5" stroke={T.textMuted} strokeWidth="1.5" />
              <path d="M11 11L14 14" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search deals, agents…" style={{ padding: "7px 14px 7px 32px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontFamily: T.font, color: T.textMid, width: 220 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = T.blue; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = T.border; }}
            />
          </div>
        </div>

        {/* Table */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: T.rowBg }}>
              {["Deal ID","Client","Policy Type","Agent","Carrier","Premium","Submitted","Status"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: T.textMuted, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => {
              const sc = STATUS_CONFIG[d.status];
              const pc = POLICY_CONFIG[d.policyType];
              return (
                <tr key={d.id} style={{ borderTop: `1px solid ${T.border}`, backgroundColor: i % 2 === 0 ? T.cardBg : "#fafbfd", transition: "background-color 0.12s", cursor: "pointer" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.blueFaint; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = i % 2 === 0 ? T.cardBg : "#fafbfd"; }}
                >
                  <td style={{ padding: "12px 16px", fontSize: 12, fontWeight: 700, color: T.blue }}>{d.id}</td>
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
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ backgroundColor: sc.bg, color: sc.color, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{d.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>Showing {filtered.length} of {DEALS.length} deals</span>
          <button
            disabled={!canProcessActions}
            title={!canProcessActions ? "Missing permission: action.daily_deal_flow.process" : undefined}
            style={{
              backgroundColor: canProcessActions ? T.blue : T.border,
              color: "#fff",
              border: "none",
              borderRadius: T.radiusSm,
              padding: "8px 18px",
              fontSize: 12,
              fontWeight: 700,
              cursor: canProcessActions ? "pointer" : "not-allowed",
              fontFamily: T.font,
            }}
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
