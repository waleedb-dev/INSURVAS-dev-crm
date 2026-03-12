"use client";
import { useState } from "react";
import { T } from "@/lib/theme";

type CommStatus = "Pending" | "Paid" | "Under Review" | "On Hold";

interface Commission {
  id: string;
  agent: string;
  agentColor: string;
  policyNum: string;
  client: string;
  type: string;
  carrier: string;
  premium: number;
  rate: number;
  amount: number;
  status: CommStatus;
  payDate: string;
}

const STATUS_CFG: Record<CommStatus, { bg: string; color: string }> = {
  "Paid":         { bg: "#dcfce7", color: "#16a34a" },
  "Pending":      { bg: "#fef9c3", color: "#ca8a04" },
  "Under Review": { bg: T.blueLight, color: T.blue },
  "On Hold":      { bg: "#fee2e2", color: "#dc2626" },
};

const COMMISSIONS: Commission[] = [
  { id:"C-001", agent:"Shawn Stone",    agentColor:"#4285f4", policyNum:"POL-88821", client:"James Whitfield",   type:"Auto",       carrier:"Progressive",  premium:1240,  rate:12, amount:148.8,   status:"Paid",         payDate:"Mar 01, 2026" },
  { id:"C-002", agent:"Emily Tyler",    agentColor:"#ec4899", policyNum:"POL-88822", client:"Maria Gonzalez",    type:"Home",       carrier:"State Farm",    premium:2180,  rate:10, amount:218.0,   status:"Pending",      payDate:"Mar 15, 2026" },
  { id:"C-003", agent:"Louis Castro",   agentColor:"#8b5cf6", policyNum:"POL-88823", client:"Robert Chen",       type:"Life",       carrier:"NY Life",       premium:4500,  rate:15, amount:675.0,   status:"Paid",         payDate:"Feb 28, 2026" },
  { id:"C-004", agent:"Blake Silva",    agentColor:"#0ea5e9", policyNum:"POL-88824", client:"Angela Brooks",     type:"Health",     carrier:"Blue Cross",    premium:3200,  rate:8,  amount:256.0,   status:"Under Review", payDate:"Mar 15, 2026" },
  { id:"C-005", agent:"Randy Delgado",  agentColor:"#f59e0b", policyNum:"POL-88825", client:"Tom Harrington",    type:"Commercial", carrier:"Travelers",     premium:8750,  rate:10, amount:875.0,   status:"Pending",      payDate:"Mar 15, 2026" },
  { id:"C-006", agent:"Oscar Holloway", agentColor:"#f97316", policyNum:"POL-88826", client:"Sarah Kim",         type:"Auto",       carrier:"Geico",         premium:980,   rate:12, amount:117.6,   status:"Paid",         payDate:"Mar 01, 2026" },
  { id:"C-007", agent:"Joel Phillips",  agentColor:"#14b8a6", policyNum:"POL-88827", client:"Derek Mason",       type:"Home",       carrier:"Allstate",      premium:1875,  rate:10, amount:187.5,   status:"On Hold",      payDate:"—" },
  { id:"C-008", agent:"Wayne Marsh",    agentColor:"#64748b", policyNum:"POL-88828", client:"Priya Patel",       type:"Life",       carrier:"MetLife",       premium:6200,  rate:15, amount:930.0,   status:"Pending",      payDate:"Mar 15, 2026" },
  { id:"C-009", agent:"Shawn Stone",    agentColor:"#4285f4", policyNum:"POL-88829", client:"Carlos Rivera",     type:"Health",     carrier:"Aetna",         premium:2900,  rate:8,  amount:232.0,   status:"Paid",         payDate:"Mar 01, 2026" },
  { id:"C-010", agent:"Emily Tyler",    agentColor:"#ec4899", policyNum:"POL-88830", client:"Linda Tran",        type:"Commercial", carrier:"Hartford",      premium:12400, rate:10, amount:1240.0,  status:"Under Review", payDate:"Mar 15, 2026" },
  { id:"C-011", agent:"Louis Castro",   agentColor:"#8b5cf6", policyNum:"POL-88831", client:"Nathan Ford",       type:"Auto",       carrier:"Progressive",   premium:1100,  rate:12, amount:132.0,   status:"Paid",         payDate:"Feb 28, 2026" },
  { id:"C-012", agent:"Blake Silva",    agentColor:"#0ea5e9", policyNum:"POL-88832", client:"Grace Nakamura",    type:"Home",       carrier:"State Farm",    premium:3450,  rate:10, amount:345.0,   status:"Paid",         payDate:"Mar 01, 2026" },
];

export default function CommissionsPage({ canApproveActions = true }: { canApproveActions?: boolean }) {
  const [filter, setFilter] = useState<CommStatus | "All">("All");

  const total   = COMMISSIONS.reduce((s, c) => s + c.amount, 0);
  const paid    = COMMISSIONS.filter((c) => c.status === "Paid").reduce((s, c) => s + c.amount, 0);
  const pending = COMMISSIONS.filter((c) => c.status === "Pending").reduce((s, c) => s + c.amount, 0);

  const filtered = COMMISSIONS.filter((c) => filter === "All" || c.status === filter);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>March 2026</p>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textDark, margin: 0 }}>Commissions</h1>
      </div>

      {/* Summary cards */}
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

      <div style={{ backgroundColor: T.cardBg, borderRadius: T.radiusXl, boxShadow: T.shadowSm, overflow: "hidden" }}>
        {/* Filters */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["All", "Paid", "Pending", "Under Review", "On Hold"] as const).map((s) => (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                backgroundColor: filter === s ? T.blue : T.rowBg, color: filter === s ? "#fff" : T.textMuted,
                fontSize: 12, fontWeight: 700, fontFamily: T.font, transition: "all 0.15s",
              }}>{s}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={!canApproveActions}
              title={!canApproveActions ? "Missing permission: action.commissions.approve" : undefined}
              style={{
                backgroundColor: canApproveActions ? "#16a34a" : T.border,
                color: "#fff",
                border: "none",
                borderRadius: T.radiusSm,
                padding: "7px 16px",
                fontSize: 12,
                fontWeight: 700,
                cursor: canApproveActions ? "pointer" : "not-allowed",
                fontFamily: T.font,
              }}
            >
              Approve Batch
            </button>
            <button style={{ backgroundColor: T.rowBg, color: T.textMid, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: T.font }}>Export Statement</button>
          </div>
        </div>

        {/* Table */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: T.rowBg }}>
              {["Agent","Policy #","Client","Type","Carrier","Premium","Rate","Commission","Status","Pay Date"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: T.textMuted, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const sc = STATUS_CFG[c.status];
              return (
                <tr key={c.id} style={{ borderTop: `1px solid ${T.border}`, backgroundColor: i % 2 === 0 ? T.cardBg : "#fafbfd", transition: "background-color 0.12s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.blueFaint; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = i % 2 === 0 ? T.cardBg : "#fafbfd"; }}
                >
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: c.agentColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 800 }}>{c.agent.split(" ").map(n=>n[0]).join("")}</div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.textMid }}>{c.agent}</span>
                    </div>
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 700, color: T.blue }}>{c.policyNum}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600, color: T.textDark }}>{c.client}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{c.type}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{c.carrier}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 700, color: T.textDark }}>${c.premium.toLocaleString()}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 700, color: T.textDark }}>{c.rate}%</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 800, color: "#16a34a" }}>${c.amount.toFixed(2)}</td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ backgroundColor: sc.bg, color: sc.color, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>{c.status}</span>
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{c.payDate}</td>
                </tr>
              );
            })}
          </tbody>
          {/* Footer totals */}
          <tfoot>
            <tr style={{ backgroundColor: T.rowBg, borderTop: `2px solid ${T.border}` }}>
              <td colSpan={7} style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: T.textMid }}>Total ({filtered.length} records)</td>
              <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 800, color: "#16a34a" }}>${filtered.reduce((s,c)=>s+c.amount,0).toFixed(2)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
