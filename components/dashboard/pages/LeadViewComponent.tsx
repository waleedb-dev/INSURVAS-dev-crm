import { useState, useEffect, useMemo } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Lead {
  name: string;
  email: string;
  phone: string;
  premium: number;
  type: string;
  source: string;
  pipeline: string;
  stage: string;
}

interface LeadViewProps {
  leadId?: string;
  leadName?: string;
  isCreation?: boolean;
  onSubmit?: (lead: Lead) => void;
  onBack: () => void;
  defaultPipeline?: string;
  defaultStage?: string;
}

type TabType = "Overview" | "Timeline" | "Documents" | "Notes" | "Policy Details";

export default function LeadViewComponent({ leadId, leadName, isCreation, onSubmit, onBack, defaultPipeline, defaultStage }: LeadViewProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [activeTab, setActiveTab] = useState<TabType>("Overview");
  const [pipelines, setPipelines] = useState<{name: string, stages: string[]}[]>([]);
  
  // State for creation/edit
  const [formData, setFormData] = useState<Lead>({
    name: leadName || "",
    email: leadName ? `${leadName.split(" ")[0].toLowerCase()}@example.com` : "",
    phone: "+1 (555) 000-0000",
    premium: 0,
    type: "Auto Insurance",
    source: "Manual Entry",
    pipeline: defaultPipeline || "Sales Pipeline",
    stage: defaultStage || "New Lead"
  });

  useEffect(() => {
    fetchPipelines();
  }, []);

  async function fetchPipelines() {
    const { data: pipelinesData, error: pError } = await supabase
      .from("pipelines")
      .select("id, name");
    
    if (pError) {
      console.error("Error fetching pipelines:", pError);
      return;
    }

    const { data: stagesData, error: sError } = await supabase
      .from("pipeline_stages")
      .select("pipeline_id, name")
      .order("position");

    if (sError) {
      console.error("Error fetching stages:", sError);
      return;
    }

    const built = pipelinesData.map(p => ({
      name: p.name,
      stages: stagesData.filter(s => s.pipeline_id === p.id).map(s => s.name)
    }));
    
    setPipelines(built);
    
    if (isCreation && built.length > 0) {
      const requestedPipeline = defaultPipeline || formData.pipeline;
      const selectedPipeline = built.find((pipeline) => pipeline.name === requestedPipeline) || built[0];
      const hasRequestedStage = selectedPipeline.stages.includes(defaultStage || formData.stage);

      setFormData(prev => ({
        ...prev,
        pipeline: selectedPipeline.name,
        stage: hasRequestedStage
          ? (defaultStage || prev.stage)
          : (selectedPipeline.stages[0] || "")
      }));
    }
  }

  const currentPipeline = pipelines.find(p => p.name === formData.pipeline) || pipelines[0];

  const leadData = {
    status: formData.stage,
    type: formData.type,
    premium: formData.premium,
    probability: "75%",
    agent: "Shawn Stone",
    created: "Oct 12, 2023",
    email: formData.email,
    phone: formData.phone,
    address: "123 Main St, New York, NY 10001",
    source: formData.source,
    tags: ["High Value", "Urgent", "New Car"],
  };

  const handleSave = () => {
    if (onSubmit) onSubmit(formData);
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out", color: T.textDark }}>
      {/* Top Navigation / Breadcrumbs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button 
            onClick={onBack} 
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
              <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>Leads</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              <span style={{ fontSize: 13, color: T.blue, fontWeight: 700 }}>{isCreation ? "Create New Lead" : "Lead Profile"}</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>{isCreation ? "New Lead Entry" : (leadName || "Lead Details")}</h1>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {isCreation ? (
            <>
              <button onClick={onBack} style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textDark }}>Cancel</button>
              <button onClick={handleSave} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: T.radiusMd, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${T.blue}44` }}>Create Lead</button>
            </>
          ) : (
            <>
              <button style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textDark }}>Edit Lead</button>
              <button style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: T.radiusMd, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${T.blue}44` }}>Convert to Client</button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        {/* Left Column: Essential Info & Stats */}
        <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Profile Card */}
          <div style={{ backgroundColor: "#fff", borderRadius: "24px", padding: "32px 24px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)", border: `1.5px solid ${T.border}`, textAlign: "center" }}>
            <div style={{ position: "relative", width: 90, height: 90, margin: "0 auto 20px" }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: `linear-gradient(135deg, ${T.blue} 0%, #4f46e5 100%)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800 }}>
                {isCreation ? "+" : (leadName ? leadName.split(" ").map(n => n[0]).join("") : "?")}
              </div>
            </div>
            
            {isCreation ? (
               <input 
                 value={formData.name} 
                 onChange={e => setFormData({...formData, name: e.target.value})} 
                 placeholder="Full Name"
                 style={{ width: "100%", padding: "10px", borderRadius: "10px", border: `1.5px solid ${T.border}`, textAlign: "center", fontSize: 18, fontWeight: 800, marginBottom: 16 }}
               />
            ) : (
              <>
                <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>{leadName}</h2>
                <p style={{ margin: "0 0 16px", fontSize: 13, color: T.textMuted, fontWeight: 600 }}>ID: {leadId}</p>
              </>
            )}
            
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
              {leadData.tags.map(tag => (
                <span key={tag} style={{ backgroundColor: T.rowBg, color: T.textMid, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: "8px" }}>{tag}</span>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: `1.5px solid ${T.borderLight}`, paddingTop: 24, textAlign: "left" }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Status</p>
                <span style={{ backgroundColor: "#fef3c7", color: "#d97706", fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: "6px" }}>{isCreation ? "Draft" : leadData.status}</span>
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Monthly Premium</p>
                {isCreation ? (
                  <input type="number" value={formData.premium} onChange={e => setFormData({...formData, premium: Number(e.target.value)})} style={{ width: "100%", padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 14, fontWeight: 800 }} />
                ) : (
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>${leadData.premium.toLocaleString()}</p>
                )}
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div style={{ backgroundColor: "#fff", borderRadius: "24px", padding: "24px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)", border: `1.5px solid ${T.border}` }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 800 }}>Contact Information</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "Email", key: "email", value: formData.email, fixed: leadData.email, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg> },
                { label: "Phone", key: "phone", value: formData.phone, fixed: leadData.phone, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.81 12.81 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg> },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "10px", backgroundColor: T.rowBg, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMid, flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>{item.label}</p>
                    {isCreation ? (
                      <input value={item.value} onChange={e => setFormData({...formData, [item.key as any]: e.target.value})} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 13, fontWeight: 700 }} />
                    ) : (
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.textDark, wordBreak: "break-word" }}>{item.fixed}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Content & Tabs */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Tab Navigation */}
          <div style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "8px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: `1.5px solid ${T.border}`, display: "flex", gap: 4 }}>
            {(["Overview", "Timeline", "Documents", "Notes", "Policy Details"] as TabType[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: "12px 0", border: "none", borderRadius: "12px",
                  cursor: "pointer", fontSize: 14, fontWeight: activeTab === tab ? 800 : 600,
                  backgroundColor: activeTab === tab ? T.blueFaint : "transparent",
                  color: activeTab === tab ? T.blue : T.textMuted,
                  transition: "all 0.2s", fontFamily: T.font
                }}
              >{tab}</button>
            ))}
          </div>

          {/* Main Content Area */}
          <div style={{ backgroundColor: "#fff", borderRadius: "24px", padding: "32px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)", border: `1.5px solid ${T.border}`, minHeight: 600 }}>
            {activeTab === "Overview" && (
              <div style={{ animation: "fadeInUp 0.3s ease-out" }}>
                <h3 style={{ margin: "0 0 28px", fontSize: 20, fontWeight: 800 }}>Lead Details</h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 40 }}>
                   <div style={{ backgroundColor: T.pageBg, border: `1.5px solid ${T.borderLight}`, borderRadius: "16px", padding: "20px" }}>
                    <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: T.textDark }}>Policy Information</p>
                    {isCreation ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                         <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Policy Type</label>
                         <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} style={{ padding: "10px", borderRadius: "10px", border: `1.5px solid ${T.border}`, fontWeight: 700 }}>
                           <option value="Auto">Auto Insurance</option>
                           <option value="Home">Home Insurance</option>
                           <option value="Life">Life Insurance</option>
                           <option value="Health">Health Insurance</option>
                           <option value="Commercial">Commercial Insurance</option>
                         </select>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ padding: "8px 16px", backgroundColor: T.blueFaint, color: T.blue, borderRadius: 8, fontWeight: 800, fontSize: 14 }}>{leadData.type}</div>
                      </div>
                    )}
                  </div>
                  <div style={{ backgroundColor: T.pageBg, border: `1.5px solid ${T.borderLight}`, borderRadius: "16px", padding: "20px" }}>
                    <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: T.textDark }}>Lead Lifecycle</p>
                    {isCreation ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                         <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                           <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Pipeline</label>
                           <select 
                             value={formData.pipeline} 
                             onChange={e => {
                               const pName = e.target.value;
                               const p = pipelines.find(pl => pl.name === pName);
                               setFormData({...formData, pipeline: pName, stage: p ? p.stages[0] : ""});
                             }} 
                             style={{ padding: "10px", borderRadius: "10px", border: `1.5px solid ${T.border}`, fontWeight: 700, outline: "none" }}
                           >
                             {pipelines.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                           </select>
                         </div>
                         <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                           <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Stage</label>
                           <select 
                             value={formData.stage} 
                             onChange={e => setFormData({...formData, stage: e.target.value})} 
                             style={{ padding: "10px", borderRadius: "10px", border: `1.5px solid ${T.border}`, fontWeight: 700, outline: "none" }}
                           >
                             {currentPipeline?.stages.map(s => <option key={s} value={s}>{s}</option>)}
                           </select>
                         </div>
                      </div>
                    ) : (
                       <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "#f59e0b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>SS</div>
                        <div>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{leadData.agent}</p>
                          <p style={{ margin: 0, fontSize: 12, color: T.textMuted, fontWeight: 600 }}>Assigned Advisor • {formData.pipeline}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {!isCreation && (
                  <>
                    <h4 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 800 }}>Recent Activity</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {[
                        { action: "Status Updated", desc: "Lead status changed from 'Presentation' to 'Quoted'", time: "Today, 10:45 AM", user: "Shawn Stone", color: T.blue },
                        { action: "Document Uploaded", desc: "Auto_Quote_Draft_V2.pdf was added to files", time: "Yesterday, 4:20 PM", user: "System", color: "#10b981" },
                        { action: "Outbound Call", desc: "Discussed multi-policy discounts with prospect", time: "Oct 14, 2:15 PM", user: "Shawn Stone", color: "#6366f1" },
                      ].map((item, i) => (
                        <div key={i} style={{ display: "flex", gap: 20 }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: item.color, border: `3px solid ${item.color}33`, flexShrink: 0 }} />
                            {i < 2 && <div style={{ width: 2, flex: 1, backgroundColor: T.borderLight, margin: "4px 0" }} />}
                          </div>
                          <div style={{ paddingBottom: 24 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{item.action}</p>
                              <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{item.time}</span>
                            </div>
                            <p style={{ margin: "0 0 8px", fontSize: 13, color: T.textMid, fontWeight: 600, lineHeight: 1.5 }}>{item.desc}</p>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: T.pageBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800 }}>{item.user[0]}</div>
                              <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 700 }}>{item.user}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                
                {isCreation && (
                   <div style={{ border: `2px dashed ${T.border}`, borderRadius: "24px", padding: 40, textAlign: "center", color: T.textMuted }}>
                      <p style={{ fontWeight: 600 }}>Additional fields and full timeline will be available after lead creation.</p>
                   </div>
                )}
              </div>
            )}

            {activeTab === "Timeline" && (
               <div style={{ textAlign: "center", paddingTop: 80 }}>
                  <div style={{ width: 60, height: 60, borderRadius: "50%", backgroundColor: T.rowBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  </div>
                  <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>Full Timeline View</h3>
                  <p style={{ margin: 0, fontSize: 14, color: T.textMuted, fontWeight: 600 }}>A detailed chronological history of every interaction is coming soon.</p>
               </div>
            )}

            {activeTab === "Documents" && (
              <div style={{ animation: "fadeInUp 0.3s ease-out" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Attached Files</h3>
                  <button style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Upload New</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {[
                    { name: "Quote_Summary_2023.pdf", size: "1.2 MB", date: "Oct 15, 2023", type: "pdf" },
                    { name: "Driver_License_Front.jpg", size: "2.4 MB", date: "Oct 14, 2023", type: "img" },
                    { name: "Insurance_Disclosure.docx", size: "840 KB", date: "Oct 12, 2023", type: "doc" },
                  ].map((file, i) => (
                    <div key={i} style={{ border: `1.5px solid ${T.border}`, borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: 16, transition: "all 0.2s", cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.backgroundColor = T.rowBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: file.type === "pdf" ? "#fee2e2" : "#dcfce7", color: file.type === "pdf" ? "#ef4444" : "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, flexShrink: 0 }}>
                        {file.type.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 800, color: T.textDark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{file.size} • {file.date}</p>
                      </div>
                      <button style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v4M7 10l5 5 5-5M12 15V3"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "Notes" && (
              <div style={{ animation: "fadeInUp 0.3s ease-out" }}>
                <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800 }}>Internal Notes</h3>
                <textarea 
                  placeholder="Type a new note here..."
                  style={{ width: "100%", height: 120, borderRadius: "16px", border: `1.5px solid ${T.border}`, padding: "16px", outline: "none", fontFamily: T.font, fontSize: 14, marginBottom: 16, resize: "none" }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 24px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Add Note</button>
                </div>

                <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 20 }}>
                  {[
                    { text: "Prospect is interested in bundling with Home insurance. Need to prepare a revised quote by Friday.", author: "Shawn Stone", date: "Yesterday" },
                    { text: "Called and left a voicemail regarding missing driver information.", author: "Shawn Stone", date: "Oct 12" },
                  ].map((note, i) => (
                    <div key={i} style={{ backgroundColor: T.rowBg, borderRadius: "16px", padding: "20px", position: "relative" }}>
                      <p style={{ margin: "0 0 12px", fontSize: 14, color: T.textMid, fontWeight: 600, lineHeight: 1.6 }}>"{note.text}"</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: T.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>{note.author[0]}</div>
                          <span style={{ fontSize: 12, fontWeight: 800 }}>{note.author}</span>
                        </div>
                        <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 700 }}>{note.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
