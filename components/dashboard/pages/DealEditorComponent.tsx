"use client";
import React, { useState } from "react";
import { T } from "@/lib/theme";
import { AppSelect } from "@/components/ui/app-select";

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

interface DealEditorProps {
  deal?: Deal;
  agents: string[];
  onClose: () => void;
  onSubmit: (deal: Deal) => void;
  existingCount: number;
  initialAgentColorMap: Record<string, string>;
}

export default function DealEditorComponent({
  deal,
  agents,
  onClose,
  onSubmit,
  existingCount,
  initialAgentColorMap,
}: DealEditorProps) {
  const [client, setClient] = useState(deal?.client ?? "");
  const [policyType, setPolicyType] = useState<PolicyType>(deal?.policyType ?? "Auto");
  const [agent, setAgent] = useState(deal?.agent ?? agents[0] ?? "Shawn Stone");
  const [carrier, setCarrier] = useState(deal?.carrier ?? "");
  const [premium, setPremium] = useState(deal ? String(deal.premium) : "");
  const [submittedAt, setSubmittedAt] = useState(deal?.submittedAt ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [status, setStatus] = useState<DealStatus>(deal?.status ?? "Submitted");

  const handleSubmit = () => {
    const premiumValue = Number(premium.replace(/,/g, ""));
    if (!client.trim() || !carrier.trim() || !submittedAt.trim() || !Number.isFinite(premiumValue) || premiumValue <= 0) {
      alert("Please fill in all fields correctly.");
      return;
    }

    const nextNumber = existingCount + 1;

    onSubmit({
      id: deal?.id ?? `DL-2024-${String(nextNumber).padStart(3, "0")}`,
      client: client.trim(),
      policyType,
      agent,
      agentColor: initialAgentColorMap[agent] ?? T.blue,
      premium: premiumValue,
      submittedAt: submittedAt.trim(),
      status,
      carrier: carrier.trim(),
    });
  };

  const inputStyle = {
    width: "100%",
    padding: "14px 16px",
    border: `1.5px solid ${T.border}`,
    borderRadius: "12px",
    fontSize: 14,
    color: T.textDark,
    fontFamily: T.font,
    backgroundColor: "#fff",
    boxSizing: "border-box" as const,
    outline: "none",
    transition: "all 0.2s",
  };

  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: T.textMuted,
    marginBottom: 8,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out", color: T.textDark }}>
      {/* Top Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button 
            onClick={onClose} 
            style={{
              background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: "12px",
              width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: T.textMid, transition: "all 0.2s",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.color = T.blue; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>Deals</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              <span style={{ fontSize: 13, color: T.blue, fontWeight: 700 }}>{deal ? "Edit Deal" : "Create New Deal"}</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>{deal ? `Edit: ${deal.client}` : "Create New Deal"}</h1>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button 
            onClick={onClose}
            style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textDark, transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = T.rowBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#fff"; }}
          >Cancel</button>
          <button 
            onClick={handleSubmit}
            style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: T.radiusMd, padding: "10px 28px", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", boxShadow: `0 4px 12px ${T.blue}44` }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 6px 16px ${T.blue}66`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 4px 12px ${T.blue}44`; }}
          >{deal ? "Update Deal" : "Save Deal"}</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        {/* Left Column: Summary Info */}
        <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "24px", padding: "32px 24px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)", border: `1.5px solid ${T.border}`, textAlign: "center" }}>
            <div style={{ width: 80, height: 80, borderRadius: "20px", background: T.blueFaint, color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>{client || "New Client"}</h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: T.textMuted, fontWeight: 600 }}>{carrier || "Carrier Name"}</p>
            
            <div style={{ borderTop: `1.5px solid ${T.borderLight}`, paddingTop: 24, textAlign: "left" }}>
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, color: T.textMuted, textTransform: "uppercase" }}>Policy Type</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                   <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: T.blue }}></div>
                   <span style={{ fontSize: 15, fontWeight: 700 }}>{policyType}</span>
                </div>
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, color: T.textMuted, textTransform: "uppercase" }}>Estimated Premium</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.textDark }}>${(Number(premium) || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: "#fff", borderRadius: "24px", padding: "24px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)", border: `1.5px solid ${T.border}` }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800 }}>Deal Tip</h3>
            <p style={{ margin: 0, fontSize: 13, color: T.textMuted, fontWeight: 600, lineHeight: 1.6 }}>
              Make sure to verify the carrier guidelines for {policyType} policies before submitting the final quote. Accurate data entry ensures faster approval.
            </p>
          </div>
        </div>

        {/* Right Column: Main Form */}
        <div style={{ flex: 1, backgroundColor: "#fff", borderRadius: "24px", padding: "40px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)", border: `1.5px solid ${T.border}` }}>
          <h3 style={{ margin: "0 0 32px", fontSize: 22, fontWeight: 800 }}>Deal Details</h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <label style={labelStyle}>Client Name</label>
              <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="James Whitfield" style={inputStyle} onFocus={e => e.currentTarget.style.borderColor = T.blue} onBlur={e => e.currentTarget.style.borderColor = T.border} />
            </div>
            
            <div>
              <label style={labelStyle}>Insurance Carrier</label>
              <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Progressive" style={inputStyle} onFocus={e => e.currentTarget.style.borderColor = T.blue} onBlur={e => e.currentTarget.style.borderColor = T.border} />
            </div>

            <div>
              <label style={labelStyle}>Policy Type</label>
              <AppSelect value={policyType} onChange={(e: any) => setPolicyType(e.target.value as PolicyType)} style={inputStyle}>
                {(["Auto", "Home", "Life", "Health", "Commercial"] as PolicyType[]).map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </AppSelect>
            </div>

            <div>
              <label style={labelStyle}>Assigned Agent</label>
              <AppSelect value={agent} onChange={(e: any) => setAgent(e.target.value)} style={inputStyle}>
                {agents.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </AppSelect>
            </div>

            <div>
              <label style={labelStyle}>Annual Premium ($)</label>
              <div style={{ position: "relative" }}>
                 <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontWeight: 700, color: T.textMuted }}>$</span>
                 <input value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="1,240" style={{ ...inputStyle, paddingLeft: 30 }} onFocus={e => e.currentTarget.style.borderColor = T.blue} onBlur={e => e.currentTarget.style.borderColor = T.border} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Submission Time</label>
              <input value={submittedAt} onChange={(e) => setSubmittedAt(e.target.value)} placeholder="02:30 PM" style={inputStyle} onFocus={e => e.currentTarget.style.borderColor = T.blue} onBlur={e => e.currentTarget.style.borderColor = T.border} />
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle}>Current Status</label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {(["Approved", "Under Review", "Pending Docs", "Submitted", "Declined"] as DealStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "10px",
                      border: "1.5px solid",
                      borderColor: status === s ? T.blue : T.border,
                      backgroundColor: status === s ? T.blueFaint : "transparent",
                      color: status === s ? T.blue : T.textMuted,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      fontFamily: T.font
                    }}
                  >{s}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
