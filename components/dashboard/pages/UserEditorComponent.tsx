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
    <div style={{ backgroundColor: "#f9fafb", minHeight: "100%", padding: "20px 40px", animation: "fadeIn 0.3s ease" }}>
      {/* Top Nav */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: T.blue, fontWeight: 700, marginBottom: 8 }}>My Staff</div>
        <button 
          onClick={onClose}
          style={{ 
            display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", 
            color: T.blue, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 16 
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.textDark, margin: 0 }}>{user ? "Edit or manage your team" : "Add team member"}</h1>
      </div>

      <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
        {/* Sidebar Tabs */}
        <div style={{ width: 280, flexShrink: 0, backgroundColor: "#fff", borderRadius: "12px", padding: "12px", border: `1px solid ${T.border}` }}>
          {tabs.map((tab) => {
            const isSel = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  display: "block", width: "100%", padding: "12px 16px", borderRadius: "8px", border: "none",
                  backgroundColor: isSel ? "#ebf2ff" : "transparent",
                  color: isSel ? T.blue : T.textMuted,
                  fontSize: 13, fontWeight: 600, textAlign: "left", cursor: "pointer", transition: "all 0.2s",
                  marginBottom: 4
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, backgroundColor: "#fff", borderRadius: "12px", border: `1px solid ${T.border}`, padding: "40px", minHeight: 500, display: "flex", flexDirection: "column" }}>
          {activeTab === "User Info" && (
            <div style={{ animation: "fadeIn 0.2s ease" }}>
              {/* Profile Image Section */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 40 }}>
                <div style={{ position: "relative" }}>
                   <div style={{ width: 140, height: 140, borderRadius: "50%", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f8f9fa", color: T.textMuted }}>
                      <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                   </div>
                   <button style={{ position: "absolute", bottom: 5, right: 5, width: 32, height: 32, borderRadius: "50%", backgroundColor: "#fff", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                   </button>
                </div>
                <div style={{ marginTop: 16, textAlign: "center" }}>
                   <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Profile Image</h3>
                   <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>The proposed size is 512*512 px no bigger than 2.5 MB</p>
                </div>
              </div>

              {/* Form Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <label style={labelStyle}>First Name <span style={{ color: T.danger }}>*</span></label>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First Name" style={inputStyle} onFocus={e => e.currentTarget.style.borderColor = T.blue} onBlur={e => e.currentTarget.style.borderColor = T.border} />
                </div>
                <div>
                  <label style={labelStyle}>Last Name <span style={{ color: T.danger }}>*</span></label>
                  <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last Name" style={inputStyle} onFocus={e => e.currentTarget.style.borderColor = T.blue} onBlur={e => e.currentTarget.style.borderColor = T.border} />
                </div>
                <div>
                  <label style={labelStyle}>Email <span style={{ color: T.danger }}>*</span></label>
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={inputStyle} onFocus={e => e.currentTarget.style.borderColor = T.blue} onBlur={e => e.currentTarget.style.borderColor = T.border} />
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ flex: 2 }}>
                    <label style={labelStyle}>Phone</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" style={inputStyle} onFocus={e => e.currentTarget.style.borderColor = T.blue} onBlur={e => e.currentTarget.style.borderColor = T.border} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Extension</label>
                    <input value={extension} onChange={e => setExtension(e.target.value)} placeholder="Extension" style={inputStyle} onFocus={e => e.currentTarget.style.borderColor = T.blue} onBlur={e => e.currentTarget.style.borderColor = T.border} />
                  </div>
                </div>
              </div>

              <button style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: T.textDark, fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 32, padding: 0 }}>
                Advanced Settings
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          )}

          {activeTab !== "User Info" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: T.textMuted, fontSize: 14, fontWeight: 600 }}>
              {activeTab} configurations will appear here.
            </div>
          )}

          {/* Footer Actions */}
          <div style={{ marginTop: "auto", paddingTop: 40, borderTop: `1px solid ${T.borderLight}`, display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button 
              onClick={onClose}
              style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: "8px", padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", color: T.textDark }}
            >
              Cancel
            </button>
            <button 
              onClick={() => onSubmit({ firstName, lastName, email, phone, extension })}
              style={{ backgroundColor: "#93c5fd", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 32px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
