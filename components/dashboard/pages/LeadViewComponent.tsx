"use client";
import { useState } from "react";
import { T } from "@/lib/theme";

interface LeadViewProps {
  leadId: string;
  leadName: string;
  onBack: () => void;
}

export default function LeadViewComponent({ leadId, leadName, onBack }: LeadViewProps) {
  const [activeTab, setActiveTab] = useState<"Updates" | "Documents" | "Leads">("Updates");

  return (
    <div style={{ animation: "fadeIn 0.2s ease" }}>
      {/* Header with back button */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <button onClick={onBack} style={{
          background: T.cardBg, border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd,
          width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: T.textDark, transition: "background-color 0.15s"
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div>
          <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>Lead Profile</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textDark, margin: 0 }}>{leadName}</h1>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* Left column: Profile Card */}
        <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ backgroundColor: T.cardBg, borderRadius: T.radiusXl, padding: "28px 24px", boxShadow: T.shadowSm, textAlign: "center" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", backgroundColor: T.blueFaint, color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, margin: "0 auto 16px" }}>
              {leadName.split(" ").map(n => n[0]).join("")}
            </div>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: T.textDark }}>{leadName}</h2>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: T.textMuted, fontWeight: 600 }}>{leadId}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left", marginTop: 24, borderTop: `1px solid ${T.borderLight}`, paddingTop: 20 }}>
              {[
                { l: "Email", v: `${leadName.split(" ")[0].toLowerCase()}@example.com` },
                { l: "Phone", v: "+1 (555) 123-4567" },
                { l: "Address", v: "123 Main St, New York, NY" },
                { l: "Source", v: "Website Form" }
              ].map(({ l, v }) => (
                <div key={l}>
                  <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: T.textMuted }}>{l}</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.textDark }}>{v}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ backgroundColor: T.cardBg, borderRadius: T.radiusXl, padding: "20px 24px", boxShadow: T.shadowSm }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: T.textDark }}>Quick Actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button style={{ width: "100%", padding: "12px", border: "none", borderRadius: T.radiusMd, backgroundColor: T.blue, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: T.font }}>Send Email</button>
              <button style={{ width: "100%", padding: "12px", border: `1.5px solid ${T.danger}`, borderRadius: T.radiusMd, backgroundColor: "transparent", color: T.danger, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: T.font }}>Delete Lead</button>
            </div>
          </div>
        </div>

        {/* Right column: Multi-tabs */}
        <div style={{ flex: 1, backgroundColor: T.cardBg, borderRadius: T.radiusXl, boxShadow: T.shadowSm, overflow: "hidden", minHeight: 600 }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
            {(["Updates", "Documents", "Leads"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: "16px", border: "none", background: "none", cursor: "pointer",
                  fontSize: 14, fontWeight: activeTab === tab ? 800 : 600, color: activeTab === tab ? T.blue : T.textMuted,
                  borderBottom: `3px solid ${activeTab === tab ? T.blue : "transparent"}`,
                  fontFamily: T.font, transition: "color 0.15s"
                }}
              >{tab}</button>
            ))}
          </div>

          <div style={{ padding: "32px 28px" }}>
            {activeTab === "Updates" && (
              <div>
                <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 800, color: T.textDark }}>Recent Activity</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {[
                    { a: "Status changed to Quoted", t: "2 hours ago", u: "System" },
                    { a: "Emailed initial quote documentation", t: "1 day ago", u: "Agent" },
                    { a: "Lead pipeline updated", t: "3 days ago", u: "Manager" }
                  ].map((act, i) => (
                    <div key={i} style={{ display: "flex", gap: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: T.rowBg, display: "flex", alignItems: "center", justifyContent: "center", color: T.blue, flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <div style={{ paddingTop: 8 }}>
                        <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: T.textDark }}>{act.a}</p>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: T.textMuted }}>{act.t} by {act.u}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === "Documents" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.textDark }}>Files</h3>
                  <button style={{ padding: "8px 16px", border: `1.5px solid ${T.blue}`, borderRadius: T.radiusMd, backgroundColor: "transparent", color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: T.font }}>+ Upload</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {["Quote_Summary.pdf", "Insurance_Policy_Draft.docx"].map((doc) => (
                    <div key={doc} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", border: `1px solid ${T.borderLight}`, borderRadius: T.radiusMd }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 32, height: 32, backgroundColor: "#fee2e2", color: "#ef4444", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>PDF</div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>{doc}</span>
                      </div>
                      <button style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: T.font }}>Download</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === "Leads" && (
              <div>
                <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 800, color: T.textDark }}>Related Deals/Leads</h3>
                <p style={{ margin: 0, fontSize: 14, color: T.textMuted, fontWeight: 600 }}>No additional leads associated with this profile at this time.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
