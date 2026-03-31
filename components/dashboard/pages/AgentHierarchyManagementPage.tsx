"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { Pagination, Table, DataGrid, EmptyState } from "@/components/ui";
import { AppSelect } from "@/components/ui/app-select";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface IMO {
  id: number;
  name: string;
}

interface Agency {
  id: number;
  name: string;
  imoId: number;
  imoName: string;
}

interface User {
  id: string;
  email: string;
  fullName?: string;
}

interface Agent {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  agencyId: number | null;
  agencyName: string;
  imoName: string;
  userId: string | null;
  userEmail: string;
  slackUsername: string;
  status: 'Active' | 'Inactive';
}

interface Carrier {
  id: number;
  name: string;
}

interface State {
  code: string;
  name: string;
}

export default function AgentHierarchyManagementPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  
  // View state
  const [view, setView] = useState<"list" | "edit" | "view">("list");
  const [activeTab, setActiveTab] = useState<'general' | 'carriers' | 'states'>('general');
  
  // Data states
  const [agents, setAgents] = useState<Agent[]>([]);
  const [imos, setImos] = useState<IMO[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [states, setStates] = useState<State[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Search and pagination
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  
  // Form states
  const [editingAgentId, setEditingAgentId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    imoId: "",
    agencyId: "",
    userId: "",
    slackUsername: "",
    status: "Active" as 'Active' | 'Inactive',
  });
  
  // Carrier and state selections
  const [selectedCarrierIds, setSelectedCarrierIds] = useState<Set<number>>(new Set());
  const [selectedStateCodes, setSelectedStateCodes] = useState<Set<string>>(new Set());

  // Fetch all data
  async function fetchAllData() {
    setLoading(true);
    try {
      // Fetch IMOs
      const { data: imosData } = await supabase
        .from("imos")
        .select("id, name")
        .order("name");
      setImos((imosData ?? []).map((i: any) => ({ id: Number(i.id), name: i.name })));

      // Fetch Agencies with IMO names
      const { data: agenciesData } = await supabase
        .from("agencies")
        .select(`
          id, 
          name, 
          imo_id,
          imos:imo_id (name)
        `)
        .order("name");
      setAgencies((agenciesData ?? []).map((a: any) => ({
        id: Number(a.id),
        name: a.name,
        imoId: Number(a.imo_id),
        imoName: a.imos?.name || '',
      })));

      // Fetch Users
      const { data: usersData } = await supabase
        .from("users")
        .select("id, email, full_name")
        .order("email");
      setUsers((usersData ?? []).map((u: any) => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
      })));

      // Fetch Carriers
      const { data: carriersData } = await supabase
        .from("carriers")
        .select("id, name")
        .order("name");
      setCarriers((carriersData ?? []).map((c: any) => ({
        id: Number(c.id),
        name: c.name,
      })));

      // Fetch States
      const { data: statesData } = await supabase
        .from("states")
        .select("code, name")
        .order("name");
      setStates((statesData ?? []).map((s: any) => ({
        code: s.code,
        name: s.name,
      })));

      // Fetch Agents with hierarchy
      await fetchAgents();
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAgents() {
    const { data, error } = await supabase
      .from("agents")
      .select(`
        id, 
        first_name, 
        last_name,
        agency_id,
        agencies:agency_id (
          name,
          imos:imo_id (name)
        ),
        user_id,
        users:user_id (email),
        slack_username,
        status
      `)
      .order("last_name");

    if (error) {
      console.error("Error fetching agents:", error);
    } else {
      setAgents((data ?? []).map((a: any) => ({
        id: Number(a.id),
        firstName: a.first_name,
        lastName: a.last_name,
        fullName: `${a.first_name} ${a.last_name}`,
        agencyId: a.agency_id ? Number(a.agency_id) : null,
        agencyName: a.agencies?.name || '-',
        imoName: a.agencies?.imos?.name || '-',
        userId: a.user_id,
        userEmail: a.users?.email || '-',
        slackUsername: a.slack_username || '-',
        status: a.status,
      })));
    }
  }

  useEffect(() => {
    void fetchAllData();
  }, []);

  // Fetch agent's carriers and states
  async function fetchAgentRelations(agentId: number) {
    try {
      const [{ data: carrierData }, { data: stateData }] = await Promise.all([
        supabase.from("agent_carriers").select("carrier_id").eq("agent_id", agentId),
        supabase.from("agent_states").select("state_code").eq("agent_id", agentId),
      ]);
      
      setSelectedCarrierIds(new Set((carrierData ?? []).map((c: any) => Number(c.carrier_id))));
      setSelectedStateCodes(new Set((stateData ?? []).map((s: any) => s.state_code)));
    } catch (error) {
      console.error("Error fetching agent relations:", error);
    }
  }

  function handleOpenCreate() {
    setEditingAgentId(null);
    setFormData({
      firstName: "",
      lastName: "",
      imoId: "",
      agencyId: "",
      userId: "",
      slackUsername: "",
      status: "Active",
    });
    setSelectedCarrierIds(new Set());
    setSelectedStateCodes(new Set());
    setActiveTab('general');
    setView("edit");
  }

  function handleOpenEdit(agent: Agent) {
    setEditingAgentId(agent.id);
    
    // Find agency and IMO
    const agency = agencies.find(a => a.id === agent.agencyId);
    
    setFormData({
      firstName: agent.firstName,
      lastName: agent.lastName,
      imoId: agency?.imoId?.toString() || "",
      agencyId: agent.agencyId?.toString() || "",
      userId: agent.userId || "",
      slackUsername: agent.slackUsername === '-' ? '' : agent.slackUsername,
      status: agent.status,
    });
    
    void fetchAgentRelations(agent.id);
    setActiveTab('general');
    setView("edit");
  }

  function handleOpenView(agent: Agent) {
    setEditingAgentId(agent.id);
    setFormData({
      firstName: agent.firstName,
      lastName: agent.lastName,
      imoId: agencies.find(a => a.id === agent.agencyId)?.imoId?.toString() || "",
      agencyId: agent.agencyId?.toString() || "",
      userId: agent.userId || "",
      slackUsername: agent.slackUsername === '-' ? '' : agent.slackUsername,
      status: agent.status,
    });
    void fetchAgentRelations(agent.id);
    setView("view");
  }

  async function handleSave() {
    if (!formData.firstName.trim() || !formData.lastName.trim()) return;
    
    setSaving(true);
    try {
      const payload = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        agency_id: formData.agencyId ? Number(formData.agencyId) : null,
        user_id: formData.userId || null,
        slack_username: formData.slackUsername.trim() || null,
        status: formData.status,
      };

      let agentId = editingAgentId;

      if (editingAgentId) {
        // Update agent
        const { error } = await supabase
          .from("agents")
          .update(payload)
          .eq("id", editingAgentId);
        
        if (error) throw error;
      } else {
        // Create agent
        const { data, error } = await supabase
          .from("agents")
          .insert([payload])
          .select()
          .single();
        
        if (error) throw error;
        agentId = data.id;
      }

      // Save carrier relations
      if (agentId) {
        await supabase.from("agent_carriers").delete().eq("agent_id", agentId);
        if (selectedCarrierIds.size > 0) {
          const carrierPayload = Array.from(selectedCarrierIds).map(carrierId => ({
            agent_id: agentId,
            carrier_id: carrierId,
          }));
          await supabase.from("agent_carriers").insert(carrierPayload);
        }

        // Save state relations
        await supabase.from("agent_states").delete().eq("agent_id", agentId);
        if (selectedStateCodes.size > 0) {
          const statePayload = Array.from(selectedStateCodes).map(stateCode => ({
            agent_id: agentId,
            state_code: stateCode,
          }));
          await supabase.from("agent_states").insert(statePayload);
        }
      }

      await fetchAgents();
      setView("list");
    } catch (error) {
      console.error("Error saving agent:", error);
      alert("Error saving agent. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAgent(agent: Agent) {
    const ok = window.confirm(`Delete agent "${agent.fullName}"? This action cannot be undone.`);
    if (!ok) return;

    try {
      const { error } = await supabase.from("agents").delete().eq("id", agent.id);
      if (error) throw error;
      await fetchAgents();
    } catch (error) {
      console.error("Error deleting agent:", error);
      alert("Error deleting agent. Please try again.");
    }
  }

  // Toggle selections
  function toggleCarrier(id: number) {
    setSelectedCarrierIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleState(code: string) {
    setSelectedStateCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  // Filtered agencies based on selected IMO
  const filteredAgencies = useMemo(() => {
    if (!formData.imoId) return agencies;
    return agencies.filter(a => a.imoId === Number(formData.imoId));
  }, [agencies, formData.imoId]);

  // Filter and paginate agents
  const filteredAgents = agents.filter(agent =>
    agent.fullName.toLowerCase().includes(search.toLowerCase()) ||
    agent.agencyName.toLowerCase().includes(search.toLowerCase()) ||
    agent.imoName.toLowerCase().includes(search.toLowerCase())
  );
  
  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedAgents = filteredAgents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // VIEW MODE
  if (view === "view" && editingAgentId) {
    const agent = agents.find(a => a.id === editingAgentId);
    if (!agent) return null;

    return (
      <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
        <div style={{ marginBottom: 24 }}>
          <button 
            onClick={() => setView("list")} 
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: T.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to Agents
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{agent.fullName}</h1>
              <p style={{ fontSize: 14, color: T.textMuted, margin: "8px 0 0" }}>
                {agent.imoName} → {agent.agencyName}
              </p>
            </div>
            <button 
              onClick={() => handleOpenEdit(agent)}
              style={{ 
                backgroundColor: T.blue, 
                color: "#fff", 
                border: "none", 
                borderRadius: 8, 
                padding: "10px 20px", 
                fontSize: 14, 
                fontWeight: 800, 
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit Agent
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginBottom: 32 }}>
          {/* Status Card */}
          <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Status</div>
            <div style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: 8,
              padding: "6px 14px",
              borderRadius: 999,
              backgroundColor: agent.status === 'Active' ? '#dcfce7' : '#fee2e2',
              color: agent.status === 'Active' ? '#166534' : '#991b1b',
              fontSize: 14,
              fontWeight: 700
            }}>
              <div style={{ 
                width: 8, 
                height: 8, 
                borderRadius: "50%", 
                backgroundColor: agent.status === 'Active' ? '#638b4b' : '#3b5229' 
              }}/>
              {agent.status}
            </div>
          </div>

          {/* User Account Card */}
          <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>User Account</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textDark }}>
              {agent.userEmail}
            </div>
          </div>

          {/* Slack Username Card */}
          <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Slack Username</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textDark }}>
              {agent.slackUsername}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
          {/* Carriers Section */}
          <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 10, 
                  backgroundColor: T.blueFaint, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center" 
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2">
                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: T.textDark }}>Licensed Carriers</h2>
                  <p style={{ fontSize: 12, color: T.textMuted, margin: "4px 0 0" }}>Carriers this agent is appointed with</p>
                </div>
              </div>
              <div style={{ 
                fontSize: 14, 
                fontWeight: 800, 
                color: T.blue, 
                backgroundColor: T.blueFaint, 
                padding: "6px 14px", 
                borderRadius: 999 
              }}>
                {selectedCarrierIds.size}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {carriers.filter(c => selectedCarrierIds.has(c.id)).map((carrier) => (
                <div
                  key={carrier.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: `1.5px solid ${T.blue}`,
                    backgroundColor: T.blueFaint,
                  }}
                >
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    border: `2px solid ${T.blue}`,
                    backgroundColor: T.blue,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.textDark }}>{carrier.name}</div>
                </div>
              ))}
              {selectedCarrierIds.size === 0 && (
                <div style={{ padding: "16px", textAlign: "center", color: T.textMuted, fontSize: 14, fontWeight: 600 }}>
                  No carriers assigned
                </div>
              )}
            </div>
          </div>

          {/* States Section */}
          <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 10, 
                  backgroundColor: T.blueFaint, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center" 
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: T.textDark }}>Licensed States</h2>
                  <p style={{ fontSize: 12, color: T.textMuted, margin: "4px 0 0" }}>States where this agent is licensed</p>
                </div>
              </div>
              <div style={{ 
                fontSize: 14, 
                fontWeight: 800, 
                color: T.blue, 
                backgroundColor: T.blueFaint, 
                padding: "6px 14px", 
                borderRadius: 999 
              }}>
                {selectedStateCodes.size}
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {states.filter(s => selectedStateCodes.has(s.code)).map((state) => (
                <div
                  key={state.code}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: `1.5px solid ${T.blue}`,
                    backgroundColor: T.blueFaint,
                    fontSize: 13,
                    fontWeight: 700,
                    color: T.textDark,
                  }}
                >
                  {state.code} - {state.name}
                </div>
              ))}
              {selectedStateCodes.size === 0 && (
                <div style={{ padding: "16px", textAlign: "center", color: T.textMuted, fontSize: 14, fontWeight: 600, width: "100%" }}>
                  No states assigned
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // EDIT MODE
  if (view === "edit") {
    return (
      <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
        <div style={{ marginBottom: 24 }}>
          <button 
            onClick={() => setView("list")} 
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: T.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to Agents
          </button>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{editingAgentId ? "Edit Agent" : "Add New Agent"}</h1>
        </div>

        <div style={{ display: "flex", gap: 32, borderBottom: `1.5px solid ${T.border}`, marginBottom: 24 }}>
          <button 
            onClick={() => setActiveTab('general')}
            style={{ 
              padding: "12px 4px", 
              border: "none", 
              borderBottom: `3px solid ${activeTab === 'general' ? T.blue : 'transparent'}`, 
              background: "none", 
              color: activeTab === 'general' ? T.blue : T.textMuted, 
              fontSize: 14, 
              fontWeight: 800, 
              cursor: "pointer" 
            }}
          >
            General Information
          </button>
          <button 
            onClick={() => setActiveTab('carriers')}
            style={{ 
              padding: "12px 4px", 
              border: "none", 
              borderBottom: `3px solid ${activeTab === 'carriers' ? T.blue : 'transparent'}`, 
              background: "none", 
              color: activeTab === 'carriers' ? T.blue : T.textMuted, 
              fontSize: 14, 
              fontWeight: 800, 
              cursor: "pointer" 
            }}
          >
            Carriers
          </button>
          <button 
            onClick={() => setActiveTab('states')}
            style={{ 
              padding: "12px 4px", 
              border: "none", 
              borderBottom: `3px solid ${activeTab === 'states' ? T.blue : 'transparent'}`, 
              background: "none", 
              color: activeTab === 'states' ? T.blue : T.textMuted, 
              fontSize: 14, 
              fontWeight: 800, 
              cursor: "pointer" 
            }}
          >
            States
          </button>
        </div>

        <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 32, maxWidth: 900 }}>
          {activeTab === 'general' && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginBottom: 24 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>First Name *</label>
                  <input 
                    autoFocus
                    value={formData.firstName}
                    onChange={e => setFormData({...formData, firstName: e.target.value})}
                    placeholder="e.g. John"
                    style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15, outline: "none", color: T.textDark, fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Last Name *</label>
                  <input 
                    value={formData.lastName}
                    onChange={e => setFormData({...formData, lastName: e.target.value})}
                    placeholder="e.g. Smith"
                    style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15, outline: "none", color: T.textDark, fontWeight: 600 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>IMO</label>
                <AppSelect
                  value={formData.imoId}
                  onChange={e => setFormData({...formData, imoId: e.target.value, agencyId: ""})}
                  style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15, outline: "none", color: T.textDark, fontWeight: 600, backgroundColor: "#fff", cursor: "pointer" }}
                >
                  <option value="">Select IMO...</option>
                  {imos.map(imo => (
                    <option key={imo.id} value={imo.id}>{imo.name}</option>
                  ))}
                </AppSelect>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Agency</label>
                <AppSelect
                  value={formData.agencyId}
                  onChange={e => setFormData({...formData, agencyId: e.target.value})}
                  disabled={!formData.imoId}
                  style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15, outline: "none", color: T.textDark, fontWeight: 600, backgroundColor: formData.imoId ? "#fff" : "#f3f4f6", cursor: formData.imoId ? "pointer" : "not-allowed" }}
                >
                  <option value="">Select Agency...</option>
                  {filteredAgencies.map(agency => (
                    <option key={agency.id} value={agency.id}>{agency.name}</option>
                  ))}
                </AppSelect>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>User Account</label>
                <AppSelect
                  value={formData.userId}
                  onChange={e => setFormData({...formData, userId: e.target.value})}
                  style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15, outline: "none", color: T.textDark, fontWeight: 600, backgroundColor: "#fff", cursor: "pointer" }}
                >
                  <option value="">No User Account</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.email} {user.fullName ? `(${user.fullName})` : ''}
                    </option>
                  ))}
                </AppSelect>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Slack Username</label>
                <input 
                  value={formData.slackUsername}
                  onChange={e => setFormData({...formData, slackUsername: e.target.value})}
                  placeholder="e.g. @john.smith"
                  style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15, outline: "none", color: T.textDark, fontWeight: 600 }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Status</label>
                <div style={{ display: "flex", gap: 12 }}>
                  {(['Active', 'Inactive'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFormData({...formData, status })}
                      style={{
                        flex: 1,
                        padding: "12px 24px",
                        border: `1.5px solid ${formData.status === status ? T.blue : T.border}`,
                        borderRadius: 8,
                        backgroundColor: formData.status === status ? T.blueFaint : "#fff",
                        color: formData.status === status ? T.blue : T.textDark,
                        fontSize: 14,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'carriers' && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: T.textDark }}>Licensed Carriers</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.textMuted, marginTop: 4 }}>
                    Select which carriers this agent is appointed with.
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.blue, backgroundColor: T.blueFaint, padding: "6px 14px", borderRadius: 999 }}>
                  {selectedCarrierIds.size} selected
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {carriers.map((carrier) => {
                  const checked = selectedCarrierIds.has(carrier.id);
                  return (
                    <div
                      key={carrier.id}
                      onClick={() => toggleCarrier(carrier.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: `1.5px solid ${checked ? T.blue : T.border}`,
                        backgroundColor: checked ? T.blueFaint : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{
                        width: 18,
                        height: 18,
                        borderRadius: 5,
                        border: `2px solid ${checked ? T.blue : T.border}`,
                        backgroundColor: checked ? T.blue : "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        {checked && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.textDark }}>{carrier.name}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'states' && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: T.textDark }}>Licensed States</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.textMuted, marginTop: 4 }}>
                    Select which states this agent is licensed to sell in.
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.blue, backgroundColor: T.blueFaint, padding: "6px 14px", borderRadius: 999 }}>
                  {selectedStateCodes.size} selected
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {states.map((state) => {
                  const checked = selectedStateCodes.has(state.code);
                  return (
                    <div
                      key={state.code}
                      onClick={() => toggleState(state.code)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: `1.5px solid ${checked ? T.blue : T.border}`,
                        backgroundColor: checked ? T.blueFaint : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        border: `2px solid ${checked ? T.blue : T.border}`,
                        backgroundColor: checked ? T.blue : "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        {checked && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>{state.code}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{state.name}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 24, paddingTop: 24, borderTop: `1.5px solid ${T.borderLight}` }}>
            <button 
              onClick={handleSave} 
              disabled={saving || !formData.firstName.trim() || !formData.lastName.trim()}
              style={{ 
                backgroundColor: T.blue, 
                color: "#fff", 
                border: "none", 
                borderRadius: 8, 
                padding: "12px 24px", 
                fontSize: 14, 
                fontWeight: 800, 
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving || !formData.firstName.trim() || !formData.lastName.trim() ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Agent"}
            </button>
            <button 
              onClick={() => setView("list")} 
              style={{ backgroundColor: "transparent", color: T.textMid, border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // LIST MODE
  return (
    <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px" }}>Agents</h1>
        </div>
        <button 
          onClick={handleOpenCreate} 
          style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: `0 4px 12px ${T.blue}44` }}
        >
          + Add Agent
        </button>
      </div>

      <DataGrid
        search={search}
        onSearchChange={(s) => { setSearch(s); setPage(1); }}
        searchPlaceholder="Search agents by name, agency, or IMO..."
        pagination={
          <Pagination
            page={currentPage}
            totalItems={filteredAgents.length}
            itemsPerPage={itemsPerPage}
            itemLabel="agents"
            onPageChange={setPage}
          />
        }
      >
        <Table
          data={paginatedAgents}
          hoverEffect={false}
          onRowClick={(agent) => handleOpenView(agent)}
          columns={[
            {
              header: "Agent Name",
              key: "fullName",
              render: (agent) => (
                <div>
                  <span style={{ fontWeight: 700, color: T.textDark }}>{agent.fullName}</span>
                  {agent.slackUsername && agent.slackUsername !== '-' && (
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Slack: {agent.slackUsername}</div>
                  )}
                </div>
              )
            },
            {
              header: "Hierarchy",
              key: "hierarchy",
              render: (agent) => (
                <div style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 600, color: T.textDark }}>{agent.agencyName}</div>
                  <div style={{ color: T.textMuted }}>{agent.imoName}</div>
                </div>
              )
            },
            {
              header: "User Account",
              key: "userEmail",
              render: (agent) => (
                <span style={{ fontSize: 13, color: agent.userEmail !== '-' ? T.textDark : T.textMuted }}>
                  {agent.userEmail}
                </span>
              )
            },
            {
              header: "Status",
              key: "status",
              render: (agent) => (
                <div style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  backgroundColor: agent.status === 'Active' ? '#dcfce7' : '#fee2e2',
                  color: agent.status === 'Active' ? '#166534' : '#991b1b',
                  fontSize: 12,
                  fontWeight: 700
                }}>
                  <div style={{ 
                    width: 6, 
                    height: 6, 
                    borderRadius: "50%", 
                    backgroundColor: agent.status === 'Active' ? '#638b4b' : '#3b5229' 
                  }}/>
                  {agent.status}
                </div>
              )
            },
            {
              header: "Actions",
              key: "actions",
              align: "center",
              render: (agent) => (
                <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenView(agent); }}
                    style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", padding: 6, borderRadius: 6 }} 
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = T.rowBg} 
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    title="View agent"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(agent); }}
                    style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", padding: 6, borderRadius: 6 }} 
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = T.rowBg} 
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    title="Edit agent"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteAgent(agent); }}
                    style={{ background: "none", border: "none", color: "#3b5229", cursor: "pointer", padding: 6, borderRadius: 6 }} 
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#fef2f2"} 
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    title="Delete agent"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              )
            }
          ]}
        />

        {!loading && filteredAgents.length === 0 && (
          <EmptyState title="No agents found" description="Add an agent or adjust your search filters." compact />
        )}
      </DataGrid>
    </div>
  );
}
