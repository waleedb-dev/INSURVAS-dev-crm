"use client";
import React, { useState } from "react";
import { T } from "@/lib/theme";

interface UserEditorProps {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    phone?: string;
    extension?: string;
  };
  onClose: () => void;
  onSubmit: (data: any) => void;
}

type TabType = "User Info" | "Roles & Permissions" | "Call & Voicemail Settings" | "User Availability" | "Calendar Configuration";

export default function UserEditorComponent({ user, onClose, onSubmit }: UserEditorProps) {
  const [activeTab, setActiveTab] = useState<TabType>("User Info");
  const [firstName, setFirstName] = useState(user?.name.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(user?.name.split(" ").slice(1).join(" ") ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [extension, setExtension] = useState(user?.extension ?? "");

  const tabs: TabType[] = [
    "User Info",
    "Roles & Permissions",
    "Call & Voicemail Settings",
    "User Availability",
    "Calendar Configuration",
  ];

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    border: `1px solid ${T.border}`,
    borderRadius: "8px",
    fontSize: 14,
    color: T.textDark,
    fontFamily: T.font,
    backgroundColor: "#fff",
    outline: "none",
    transition: "all 0.2s",
  };

  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: T.textDark,
    marginBottom: 8,
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out", color: T.textDark, backgroundColor: T.pageBg, minHeight: "100%", padding: "20px 40px" }}>
      {/* Top Navigation / Breadcrumbs */}
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
              <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>Staff Management</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              <span style={{ fontSize: 13, color: T.blue, fontWeight: 700 }}>{user ? "Edit Profile" : "New Team Member"}</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>{user ? `Managing ${user.name}` : "Team Member Onboarding"}</h1>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onClose} style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textDark }}>Cancel</button>
          <button onClick={() => onSubmit({ firstName, lastName, email, phone, extension })} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: T.radiusMd, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${T.blue}44` }}>{user ? "Save Changes" : "Create User"}</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        {/* Left Column: Profile Card & Summary */}
        <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "24px", padding: "32px 24px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)", border: `1.5px solid ${T.border}`, textAlign: "center" }}>
            <div style={{ position: "relative", width: 100, height: 100, margin: "0 auto 20px" }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: `linear-gradient(135deg, ${T.blue} 0%, #444cf7 100%)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800, border: "4px solid #fff", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
                {(firstName[0] || "?")}{(lastName[0] || "")}
              </div>
              <button style={{ position: "absolute", bottom: 0, right: 0, width: 32, height: 32, borderRadius: "50%", backgroundColor: "#fff", border: `1.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </button>
            </div>
            
            <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: T.textDark }}>{firstName} {lastName}</h2>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: T.textMuted, fontWeight: 600 }}>{user?.role || "Global Administrator"}</p>
            
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
              <span style={{ backgroundColor: T.rowBg, color: T.textMid, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: "8px" }}>ACCOUNT-AGENT</span>
              {user && <span style={{ backgroundColor: "#ecfdf5", color: "#059669", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: "8px" }}>Active</span>}
            </div>

            <div style={{ borderTop: `1.5px solid ${T.borderLight}`, paddingTop: 24, textAlign: "left" }}>
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Email Address</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.textDark, wordBreak: "break-all" }}>{email || "—"}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Phone</p>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.textDark }}>{phone || "—"}</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Ext.</p>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.textDark }}>{extension || "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tabbed Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Main Content Area */}
          <div style={{ backgroundColor: "#fff", borderRadius: "24px", padding: 0, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)", border: `1.5px solid ${T.border}`, minHeight: 650, display: "flex", flexDirection: "column" }}>
            {/* Inner Tabs Navigation */}
            <div style={{ padding: "8px", borderBottom: `1.5px solid ${T.borderLight}`, display: "flex", gap: 4 }}>
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "12px 20px", border: "none", borderRadius: "12px",
                    cursor: "pointer", fontSize: 13, fontWeight: activeTab === tab ? 800 : 600,
                    backgroundColor: activeTab === tab ? T.blueFaint : "transparent",
                    color: activeTab === tab ? T.blue : T.textMuted,
                    transition: "all 0.2s", fontFamily: T.font
                  }}
                >{tab}</button>
              ))}
            </div>

            <div style={{ padding: 40, flex: 1 }}>
              {activeTab === "User Info" && (
                <div style={{ animation: "fadeInUp 0.3s ease-out" }}>
                  <h3 style={{ margin: "0 0 32px", fontSize: 18, fontWeight: 800 }}>Primary Identity</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
                    <div>
                      <label style={labelStyle}>Given Name <span style={{ color: T.danger }}>*</span></label>
                      <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="e.g. Shawn" style={inputStyle} onFocus={e => e.currentTarget.style.borderColor = T.blue} onBlur={e => e.currentTarget.style.borderColor = T.border} />
                    </div>
                    <div>
                      <label style={labelStyle}>Family Name <span style={{ color: T.danger }}>*</span></label>
                      <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="e.g. Stone" style={inputStyle} onFocus={e => e.currentTarget.style.borderColor = T.blue} onBlur={e => e.currentTarget.style.borderColor = T.border} />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <label style={labelStyle}>Business Email Address <span style={{ color: T.danger }}>*</span></label>
                      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="shawn@unlimited-ins.com" style={inputStyle} onFocus={e => e.currentTarget.style.borderColor = T.blue} onBlur={e => e.currentTarget.style.borderColor = T.border} />
                    </div>
                  </div>

                  <h3 style={{ margin: "40px 0 32px", fontSize: 18, fontWeight: 800 }}>Communication Channels</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
                    <div>
                      <label style={labelStyle}>Primary Direct Phone</label>
                      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" style={inputStyle} onFocus={e => e.currentTarget.style.borderColor = T.blue} onBlur={e => e.currentTarget.style.borderColor = T.border} />
                    </div>
                    <div>
                      <label style={labelStyle}>Internal Ext.</label>
                      <input value={extension} onChange={e => setExtension(e.target.value)} placeholder="101" style={inputStyle} onFocus={e => e.currentTarget.style.borderColor = T.blue} onBlur={e => e.currentTarget.style.borderColor = T.border} />
                    </div>
                  </div>

                  <div style={{ marginTop: 48, padding: "24px", backgroundColor: T.pageBg, borderRadius: "16px", border: `1.5px solid ${T.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800 }}>Advanced Security Verification</h4>
                      <p style={{ margin: 0, fontSize: 13, color: T.textMuted, fontWeight: 600 }}>Configure SSO, 2FA, and granular API access keys.</p>
                    </div>
                    <button style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: "10px", padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Configure Settings</button>
                  </div>
                </div>
              )}

              {activeTab !== "User Info" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", color: T.textMuted }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: T.pageBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15v5m-3-4v4m6-6v6M3 11l18-5v12L3 18V11z"/></svg>
                  </div>
                  <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: T.textDark }}>{activeTab} Module</h3>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, maxWidth: 300 }}>Comprehensive {activeTab.toLowerCase()} will be unlocked after the initial profile setup.</p>
                </div>
              )}
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
