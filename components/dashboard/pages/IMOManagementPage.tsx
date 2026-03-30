"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { Pagination, Table, DataGrid, EmptyState } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// Types
interface IMO {
  id: number;
  name: string;
  agencyCount: number;
  agentCount: number;
  createdAt: string;
}

interface Agency {
  id: number;
  name: string;
  imoId: number;
  imoName: string;
  agentCount: number;
  createdAt: string;
}

interface Agent {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  slackUsername: string;
  status: 'Active' | 'Inactive';
  carrierCount: number;
  stateCount: number;
  createdAt: string;
  uplineId?: number;
  language?: string;
}

interface Carrier {
  id: number;
  name: string;
  requiresStateAppointment: boolean;
}

interface State {
  code: string;
  name: string;
}

interface UplineCarrierState {
  carrierId: number;
  stateCode: string;
}

interface User {
  id: string;
  email: string;
  fullName?: string;
}

// View types
type ViewMode = 
  | 'imo-list' 
  | 'imo-view' 
  | 'agency-list' 
  | 'agency-view' 
  | 'agent-list' 
  | 'agent-wizard' 
  | 'agent-view';

export default function IMOManagementPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  
  // Navigation state
  const [view, setView] = useState<ViewMode>('imo-list');
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{label: string, view: ViewMode, id?: number}>>([
    { label: 'IMOs', view: 'imo-list' }
  ]);
  
  // Selected items
  const [selectedIMO, setSelectedIMO] = useState<IMO | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  
  // Data states
  const [imos, setImos] = useState<IMO[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [uplineCarrierStates, setUplineCarrierStates] = useState<UplineCarrierState[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Search and pagination
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // Form states for IMO/Agency
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  
  // Agent editing state
  const [editingAgentId, setEditingAgentId] = useState<number | null>(null);
  
  // Agent wizard state
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [agentForm, setAgentForm] = useState({
    firstName: "",
    lastName: "",
    userId: "",
    slackUsername: "",
    status: "Active" as 'Active' | 'Inactive',
    uplineId: null as number | null,
    language: "English" as string,
  });
  const [selectedCarriers, setSelectedCarriers] = useState<Set<number>>(new Set());
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set());
  // Carrier-specific state appointments: Map<carrierId, Set<stateCode>>
  const [carrierSpecificStates, setCarrierSpecificStates] = useState<Map<number, Set<string>>>(new Map());
  // Track which carriers are expanded in Step 4
  const [expandedCarriers, setExpandedCarriers] = useState<Set<number>>(new Set());

  // Fetch all reference data
  async function fetchReferenceData() {
    try {
      const [{ data: carriersData, error: carriersError }, { data: statesData, error: statesError }, { data: usersData, error: usersError }, { data: uplineData, error: uplineError }] = await Promise.all([
        supabase.from("carriers").select("id, name, requires_state_appointment").order("name"),
        supabase.from("states").select("code, name").order("name"),
        supabase.from("users").select("id, email, full_name").order("email"),
        supabase.from("upline_carrier_states").select("carrier_id, state_code"),
      ]);
      
      if (carriersError) console.error("Error fetching carriers:", carriersError.message);
      if (statesError) console.error("Error fetching states:", statesError.message);
      if (usersError) console.error("Error fetching users:", usersError.message);
      if (uplineError) console.error("Error fetching upline carrier states:", uplineError.message);
      
      setCarriers((carriersData ?? []).map((c: any) => ({ 
        id: Number(c.id), 
        name: c.name,
        requiresStateAppointment: c.requires_state_appointment ?? false 
      })));
      setStates((statesData ?? []).map((s: any) => ({ code: s.code, name: s.name })));
      setUsers((usersData ?? []).map((u: any) => ({ id: u.id, email: u.email, fullName: u.full_name })));
      setUplineCarrierStates((uplineData ?? []).map((u: any) => ({ 
        carrierId: Number(u.carrier_id), 
        stateCode: u.state_code 
      })));
    } catch (error: any) {
      console.error("Error fetching reference data:", error?.message || error);
    }
  }

  // Fetch IMOs with counts
  async function fetchIMOs() {
    setLoading(true);
    try {
      // First fetch all IMOs
      const { data: imosData, error: imosError } = await supabase
        .from("imos")
        .select("id, name, created_at")
        .order("name");

      if (imosError) {
        console.error("Error fetching IMOs:", imosError.message);
        throw imosError;
      }

      // Fetch all agencies with their imo_id
      const { data: agenciesData, error: agenciesError } = await supabase
        .from("agencies")
        .select("id, imo_id");

      if (agenciesError) {
        console.error("Error fetching agencies:", agenciesError.message);
      }

      // Fetch all agents with their agency_id
      const { data: agentsData, error: agentsError } = await supabase
        .from("agents")
        .select("id, agency_id");

      if (agentsError) {
        console.error("Error fetching agents:", agentsError.message);
      }

      // Build agency to IMO mapping
      const agencyToIMOMap = new Map<number, number>();
      (agenciesData ?? []).forEach((row: any) => {
        agencyToIMOMap.set(row.id, row.imo_id);
      });

      // Build count maps
      const agencyCountMap = new Map<number, number>();
      (agenciesData ?? []).forEach((row: any) => {
        agencyCountMap.set(row.imo_id, (agencyCountMap.get(row.imo_id) || 0) + 1);
      });

      // Count agents per IMO by looking up agency's imo_id
      const agentCountMap = new Map<number, number>();
      (agentsData ?? []).forEach((row: any) => {
        const imoId = agencyToIMOMap.get(row.agency_id);
        if (imoId) {
          agentCountMap.set(imoId, (agentCountMap.get(imoId) || 0) + 1);
        }
      });

      setImos((imosData ?? []).map((imo: any) => ({
        id: Number(imo.id),
        name: imo.name,
        agencyCount: agencyCountMap.get(imo.id) || 0,
        agentCount: agentCountMap.get(imo.id) || 0,
        createdAt: new Date(imo.created_at).toLocaleDateString(),
      })));
    } catch (error: any) {
      console.error("Error in fetchIMOs:", error?.message || error);
    } finally {
      setLoading(false);
    }
  }

  // Fetch agencies for an IMO
  async function fetchAgencies(imoId: number) {
    setLoading(true);
    try {
      // Fetch agencies
      const { data: agenciesData, error: agenciesError } = await supabase
        .from("agencies")
        .select(`
          id, 
          name, 
          imo_id,
          imos:imo_id (name),
          created_at
        `)
        .eq("imo_id", imoId)
        .order("name");

      if (agenciesError) {
        console.error("Error fetching agencies:", agenciesError.message);
        throw agenciesError;
      }

      // Fetch agent counts per agency
      const { data: agentData, error: agentError } = await supabase
        .from("agents")
        .select("agency_id")
        .in("agency_id", (agenciesData ?? []).map((a: any) => a.id));

      if (agentError) {
        console.error("Error fetching agent counts:", agentError.message);
      }

      // Build agent count map
      const agentCountMap = new Map<number, number>();
      (agentData ?? []).forEach((row: any) => {
        agentCountMap.set(row.agency_id, (agentCountMap.get(row.agency_id) || 0) + 1);
      });

      setAgencies((agenciesData ?? []).map((agency: any) => ({
        id: Number(agency.id),
        name: agency.name,
        imoId: Number(agency.imo_id),
        imoName: agency.imos?.name || '',
        agentCount: agentCountMap.get(agency.id) || 0,
        createdAt: new Date(agency.created_at).toLocaleDateString(),
      })));
    } catch (error: any) {
      console.error("Error in fetchAgencies:", error?.message || error);
    } finally {
      setLoading(false);
    }
  }

  // Fetch agents for an agency
  async function fetchAgents(agencyId: number) {
    setLoading(true);
    try {
      // Fetch agents
      const { data: agentsData, error: agentsError } = await supabase
        .from("agents")
        .select(`
          id, 
          first_name, 
          last_name,
          user_id,
          users:user_id (email),
          slack_username,
          status,
          upline_id,
          language,
          created_at
        `)
        .eq("agency_id", agencyId)
        .order("last_name");

      if (agentsError) {
        console.error("Error fetching agents:", agentsError.message);
        throw agentsError;
      }

      const agentIds = (agentsData ?? []).map((a: any) => a.id);

      // Fetch carrier counts
      const { data: carrierData, error: carrierError } = await supabase
        .from("agent_carriers")
        .select("agent_id")
        .in("agent_id", agentIds);

      if (carrierError) {
        console.error("Error fetching carrier counts:", carrierError.message);
      }

      // Fetch state counts
      const { data: stateData, error: stateError } = await supabase
        .from("agent_states")
        .select("agent_id")
        .in("agent_id", agentIds);

      if (stateError) {
        console.error("Error fetching state counts:", stateError.message);
      }

      // Build count maps
      const carrierCountMap = new Map<number, number>();
      (carrierData ?? []).forEach((row: any) => {
        carrierCountMap.set(row.agent_id, (carrierCountMap.get(row.agent_id) || 0) + 1);
      });

      const stateCountMap = new Map<number, number>();
      (stateData ?? []).forEach((row: any) => {
        stateCountMap.set(row.agent_id, (stateCountMap.get(row.agent_id) || 0) + 1);
      });

      setAgents((agentsData ?? []).map((agent: any) => ({
        id: Number(agent.id),
        firstName: agent.first_name,
        lastName: agent.last_name,
        fullName: `${agent.first_name} ${agent.last_name}`,
        email: agent.users?.email || '-',
        slackUsername: agent.slack_username || '-',
        status: agent.status,
        carrierCount: carrierCountMap.get(agent.id) || 0,
        stateCount: stateCountMap.get(agent.id) || 0,
        createdAt: new Date(agent.created_at).toLocaleDateString(),
        uplineId: agent.upline_id ? Number(agent.upline_id) : undefined,
        language: agent.language || 'English',
      })));
    } catch (error: any) {
      console.error("Error in fetchAgents:", error?.message || error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchIMOs();
    fetchReferenceData();
  }, []);

  // Navigation handlers
  function navigateToIMOList() {
    setView('imo-list');
    setBreadcrumbs([{ label: 'IMOs', view: 'imo-list' }]);
    setSelectedIMO(null);
    setSelectedAgency(null);
    setSelectedAgent(null);
    fetchIMOs();
  }

  function navigateToIMOView(imo: IMO) {
    setSelectedIMO(imo);
    setView('imo-view');
    setBreadcrumbs([
      { label: 'IMOs', view: 'imo-list' },
      { label: imo.name, view: 'imo-view', id: imo.id }
    ]);
  }

  function navigateToAgencyList(imo: IMO) {
    setSelectedIMO(imo);
    setView('agency-list');
    setBreadcrumbs([
      { label: 'IMOs', view: 'imo-list' },
      { label: imo.name, view: 'agency-list', id: imo.id },
      { label: 'Agencies', view: 'agency-list' }
    ]);
    fetchAgencies(imo.id);
  }

  function navigateToAgencyView(agency: Agency) {
    setSelectedAgency(agency);
    setView('agency-view');
    setBreadcrumbs([
      { label: 'IMOs', view: 'imo-list' },
      { label: agency.imoName, view: 'agency-list', id: agency.imoId },
      { label: agency.name, view: 'agency-view', id: agency.id }
    ]);
  }

  function navigateToAgentList(agency: Agency) {
    setSelectedAgency(agency);
    setView('agent-list');
    setBreadcrumbs([
      { label: 'IMOs', view: 'imo-list' },
      { label: agency.imoName, view: 'agency-list', id: agency.imoId },
      { label: agency.name, view: 'agent-list', id: agency.id },
      { label: 'Agents', view: 'agent-list' }
    ]);
    fetchAgents(agency.id);
  }

  function navigateToAgentWizard(agency: Agency) {
    setSelectedAgency(agency);
    setView('agent-wizard');
    setWizardStep(1);
    setAgentForm({
      firstName: "",
      lastName: "",
      userId: "",
      slackUsername: "",
      status: "Active",
      uplineId: null,
      language: "English",
    });
    setSelectedCarriers(new Set());
    setSelectedStates(new Set());
    setCarrierSpecificStates(new Map());
    setEditingAgentId(null);
  }

  async function handleOpenEditAgent(agent: Agent) {
    setEditingAgentId(agent.id);
    setAgentForm({
      firstName: agent.firstName,
      lastName: agent.lastName,
      userId: users.find(u => u.email === agent.email)?.id || "",
      slackUsername: agent.slackUsername === '-' ? '' : agent.slackUsername,
      status: agent.status,
      uplineId: agent.uplineId || null,
      language: agent.language || "English",
    });
    
    // Fetch agent's carriers
    const { data: carrierData } = await supabase
      .from("agent_carriers")
      .select("carrier_id")
      .eq("agent_id", agent.id);
    setSelectedCarriers(new Set((carrierData ?? []).map((c: any) => c.carrier_id)));
    
    // Fetch agent's states
    const { data: stateData } = await supabase
      .from("agent_states")
      .select("state_code")
      .eq("agent_id", agent.id);
    setSelectedStates(new Set((stateData ?? []).map((s: any) => s.state_code)));
    
    // Fetch carrier-specific state appointments
    const { data: carrierStateData } = await supabase
      .from("agent_carrier_states")
      .select("carrier_id, state_code")
      .eq("agent_id", agent.id);
    
    const carrierStateMap = new Map<number, Set<string>>();
    (carrierStateData ?? []).forEach((row: any) => {
      if (!carrierStateMap.has(row.carrier_id)) {
        carrierStateMap.set(row.carrier_id, new Set());
      }
      carrierStateMap.get(row.carrier_id)?.add(row.state_code);
    });
    setCarrierSpecificStates(carrierStateMap);
    
    setWizardStep(1);
    setView('agent-wizard');
  }

  // CRUD Operations
  async function saveIMO() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingId && editingId > 0) {
        await supabase.from("imos").update({ name: formName.trim() }).eq("id", editingId);
      } else {
        await supabase.from("imos").insert([{ name: formName.trim() }]);
      }
      await fetchIMOs();
      setFormName("");
      setEditingId(null);
    } catch (error) {
      console.error("Error saving IMO:", error);
      alert("Error saving IMO");
    } finally {
      setSaving(false);
    }
  }

  async function saveAgency() {
    if (!formName.trim() || !selectedIMO) return;
    setSaving(true);
    try {
      if (editingId && editingId > 0) {
        await supabase.from("agencies").update({ name: formName.trim() }).eq("id", editingId);
      } else {
        await supabase.from("agencies").insert([{ name: formName.trim(), imo_id: selectedIMO.id }]);
      }
      await fetchAgencies(selectedIMO.id);
      setFormName("");
      setEditingId(null);
    } catch (error) {
      console.error("Error saving agency:", error);
      alert("Error saving agency");
    } finally {
      setSaving(false);
    }
  }

  async function saveAgent() {
    if (!agentForm.firstName.trim() || !agentForm.lastName.trim() || !selectedAgency) return;
    
    setSaving(true);
    try {
      let agentId: number;
      
      if (editingAgentId) {
        // Update existing agent
        const { error } = await supabase
          .from("agents")
          .update({
            first_name: agentForm.firstName.trim(),
            last_name: agentForm.lastName.trim(),
            user_id: agentForm.userId || null,
            slack_username: agentForm.slackUsername.trim() || null,
            status: agentForm.status,
            upline_id: agentForm.uplineId,
            language: agentForm.language,
          })
          .eq("id", editingAgentId);
        
        if (error) throw error;
        agentId = editingAgentId;
        
        // Delete existing relationships
        await supabase.from("agent_carriers").delete().eq("agent_id", agentId);
        await supabase.from("agent_states").delete().eq("agent_id", agentId);
        await supabase.from("agent_carrier_states").delete().eq("agent_id", agentId);
      } else {
        // Create new agent
        const { data, error } = await supabase
          .from("agents")
          .insert([{
            first_name: agentForm.firstName.trim(),
            last_name: agentForm.lastName.trim(),
            agency_id: selectedAgency.id,
            user_id: agentForm.userId || null,
            slack_username: agentForm.slackUsername.trim() || null,
            status: agentForm.status,
            upline_id: agentForm.uplineId,
            language: agentForm.language,
          }])
          .select()
          .single();

        if (error) throw error;
        agentId = data.id;
      }

      // Save carriers
      if (selectedCarriers.size > 0) {
        const carrierPayload = Array.from(selectedCarriers).map(id => ({
          agent_id: agentId,
          carrier_id: id,
        }));
        await supabase.from("agent_carriers").insert(carrierPayload);
      }

      // Save states
      if (selectedStates.size > 0) {
        const statePayload = Array.from(selectedStates).map(code => ({
          agent_id: agentId,
          state_code: code,
        }));
        await supabase.from("agent_states").insert(statePayload);
      }

      // Save carrier-specific state appointments
      const carrierStatePayload: { agent_id: number; carrier_id: number; state_code: string }[] = [];
      carrierSpecificStates.forEach((stateCodes, carrierId) => {
        stateCodes.forEach(stateCode => {
          carrierStatePayload.push({
            agent_id: agentId,
            carrier_id: carrierId,
            state_code: stateCode,
          });
        });
      });
      
      if (carrierStatePayload.length > 0) {
        await supabase.from("agent_carrier_states").insert(carrierStatePayload);
      }

      navigateToAgentList(selectedAgency);
    } catch (error) {
      console.error("Error saving agent:", error);
      alert("Error saving agent");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(type: 'imo' | 'agency' | 'agent', id: number, name: string) {
    const ok = confirm(`Delete ${type} "${name}"? This action cannot be undone.`);
    if (!ok) return;

    try {
      await supabase.from(`${type}s`).delete().eq("id", id);
      if (type === 'imo') fetchIMOs();
      else if (type === 'agency' && selectedIMO) fetchAgencies(selectedIMO.id);
      else if (type === 'agent' && selectedAgency) fetchAgents(selectedAgency.id);
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      alert(`Error deleting ${type}`);
    }
  }

  // Helper function to check if any selected carrier+state requires an upline
  function getUplineRequirements(): Array<{carrier: string; state: string}> {
    const requirements: Array<{carrier: string; state: string}> = [];
    
    // Check global states (from Step 3) against carriers
    selectedCarriers.forEach(carrierId => {
      const carrier = carriers.find(c => c.id === carrierId);
      if (!carrier) return;
      
      selectedStates.forEach(stateCode => {
        const requiresUpline = uplineCarrierStates.some(
          ucs => ucs.carrierId === carrierId && ucs.stateCode === stateCode
        );
        if (requiresUpline) {
          const state = states.find(s => s.code === stateCode);
          requirements.push({
            carrier: carrier.name,
            state: state ? `${state.code} - ${state.name}` : stateCode
          });
        }
      });
    });
    
    // Check carrier-specific states (from Step 4)
    carrierSpecificStates.forEach((stateCodes, carrierId) => {
      const carrier = carriers.find(c => c.id === carrierId);
      if (!carrier) return;
      
      stateCodes.forEach(stateCode => {
        const requiresUpline = uplineCarrierStates.some(
          ucs => ucs.carrierId === carrierId && ucs.stateCode === stateCode
        );
        if (requiresUpline) {
          const state = states.find(s => s.code === stateCode);
          const alreadyAdded = requirements.some(
            r => r.carrier === carrier.name && r.state.includes(stateCode)
          );
          if (!alreadyAdded) {
            requirements.push({
              carrier: carrier.name,
              state: state ? `${state.code} - ${state.name}` : stateCode
            });
          }
        }
      });
    });
    
    return requirements;
  }

  // Render breadcrumbs
  function renderBreadcrumbs() {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13 }}>
        {breadcrumbs.map((crumb, idx) => (
          <span key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {idx > 0 && <span style={{ color: T.textMuted }}>/</span>}
            <button
              onClick={() => {
                if (crumb.view === 'imo-list') navigateToIMOList();
                else if (crumb.view === 'agency-list' && crumb.id) {
                  const imo = imos.find(i => i.id === crumb.id);
                  if (imo) navigateToAgencyList(imo);
                }
              }}
              style={{
                background: "none",
                border: "none",
                color: idx === breadcrumbs.length - 1 ? T.textDark : T.blue,
                fontWeight: idx === breadcrumbs.length - 1 ? 700 : 600,
                cursor: idx === breadcrumbs.length - 1 ? "default" : "pointer",
                padding: 0,
              }}
            >
              {crumb.label}
            </button>
          </span>
        ))}
      </div>
    );
  }

  // VIEWS

  // 1. IMO LIST VIEW
  if (view === 'imo-list') {
    const filtered = imos.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const currentPage = Math.min(page, totalPages);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
      <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px" }}>IMO Management</h1>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {editingId === -1 ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  autoFocus
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="IMO Name"
                  style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 14 }}
                />
                <button onClick={saveIMO} disabled={saving} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700 }}>
                  Save
                </button>
                <button onClick={() => { setEditingId(null); setFormName(""); }} style={{ backgroundColor: "transparent", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 16px" }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => { setEditingId(-1); setFormName(""); }} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "12px 20px", fontSize: 14, fontWeight: 800 }}>
                + Add IMO
              </button>
            )}
          </div>
        </div>

        <DataGrid
          search={search}
          onSearchChange={(s) => { setSearch(s); setPage(1); }}
          searchPlaceholder="Search IMOs..."
          pagination={
            <Pagination page={currentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} itemLabel="IMOs" onPageChange={setPage} />
          }
        >
          <Table
            data={paginated}
            hoverEffect={false}
            columns={[
              { header: "IMO Name", key: "name", render: (imo) => <span style={{ fontWeight: 700, color: T.textDark }}>{imo.name}</span> },
              { header: "Agencies", key: "agencyCount", align: "center", render: (imo) => <span style={{ fontWeight: 700, color: T.blue, backgroundColor: T.blueFaint, padding: "4px 12px", borderRadius: 999 }}>{imo.agencyCount}</span> },
              { header: "Agents", key: "agentCount", align: "center", render: (imo) => <span style={{ fontWeight: 700, color: T.blue, backgroundColor: T.blueFaint, padding: "4px 12px", borderRadius: 999 }}>{imo.agentCount}</span> },
              { header: "Created", key: "createdAt", render: (imo) => <span style={{ fontSize: 13, color: T.textMid }}>{imo.createdAt}</span> },
              {
                header: "Actions",
                key: "actions",
                align: "center",
                render: (imo) => (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                    <button onClick={() => navigateToIMOView(imo)} title="View Structure" style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", padding: 6 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button onClick={() => navigateToAgencyList(imo)} title="Manage Agencies" style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", padding: 6 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </button>
                    <button onClick={() => { setEditingId(imo.id); setFormName(imo.name); }} title="Edit" style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", padding: 6 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => deleteItem('imo', imo.id, imo.name)} title="Delete" style={{ background: "none", border: "none", color: "#3b5229", cursor: "pointer", padding: 6 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                )
              }
            ]}
          />
          {!loading && filtered.length === 0 && <EmptyState title="No IMOs found" description="Add an IMO to get started" compact />}
        </DataGrid>
      </div>
    );
  }

  // 2. AGENCY LIST VIEW
  if (view === 'agency-list' && selectedIMO) {
    const filtered = agencies.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const currentPage = Math.min(page, totalPages);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
      <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
        {renderBreadcrumbs()}
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px" }}>Agencies - {selectedIMO.name}</h1>
            <p style={{ fontSize: 14, color: T.textMuted, fontWeight: 600 }}>Manage agencies under this IMO</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {editingId === -1 ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  autoFocus
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Agency Name"
                  style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 14 }}
                />
                <button onClick={saveAgency} disabled={saving} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700 }}>
                  Save
                </button>
                <button onClick={() => { setEditingId(null); setFormName(""); }} style={{ backgroundColor: "transparent", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 16px" }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => { setEditingId(-1); setFormName(""); }} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "12px 20px", fontSize: 14, fontWeight: 800 }}>
                + Add Agency
              </button>
            )}
          </div>
        </div>

        <DataGrid
          search={search}
          onSearchChange={(s) => { setSearch(s); setPage(1); }}
          searchPlaceholder="Search agencies..."
          pagination={
            <Pagination page={currentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} itemLabel="agencies" onPageChange={setPage} />
          }
        >
          <Table
            data={paginated}
            hoverEffect={false}
            columns={[
              { header: "Agency Name", key: "name", render: (a) => <span style={{ fontWeight: 700, color: T.textDark }}>{a.name}</span> },
              { header: "Agents", key: "agentCount", align: "center", render: (a) => <span style={{ fontWeight: 700, color: T.blue, backgroundColor: T.blueFaint, padding: "4px 12px", borderRadius: 999 }}>{a.agentCount}</span> },
              { header: "Created", key: "createdAt", render: (a) => <span style={{ fontSize: 13, color: T.textMid }}>{a.createdAt}</span> },
              {
                header: "Actions",
                key: "actions",
                align: "center",
                render: (a) => (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                    <button onClick={() => navigateToAgentList(a)} title="Manage Agents" style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", padding: 6 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </button>
                    <button onClick={() => { setEditingId(a.id); setFormName(a.name); }} title="Edit" style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", padding: 6 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => deleteItem('agency', a.id, a.name)} title="Delete" style={{ background: "none", border: "none", color: "#3b5229", cursor: "pointer", padding: 6 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                )
              }
            ]}
          />
          {!loading && filtered.length === 0 && <EmptyState title="No agencies found" description="Add an agency to get started" compact />}
        </DataGrid>
      </div>
    );
  }

  // 3. AGENT LIST VIEW
  if (view === 'agent-list' && selectedAgency) {
    const filtered = agents.filter(a => 
      a.fullName.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
    );
    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const currentPage = Math.min(page, totalPages);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
      <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
        {renderBreadcrumbs()}
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px" }}>Agents - {selectedAgency.name}</h1>
            <p style={{ fontSize: 14, color: T.textMuted, fontWeight: 600 }}>Manage agents under this agency</p>
          </div>
          <button onClick={() => navigateToAgentWizard(selectedAgency)} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "12px 20px", fontSize: 14, fontWeight: 800 }}>
            + Add Agent
          </button>
        </div>

        <DataGrid
          search={search}
          onSearchChange={(s) => { setSearch(s); setPage(1); }}
          searchPlaceholder="Search agents..."
          pagination={
            <Pagination page={currentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} itemLabel="agents" onPageChange={setPage} />
          }
        >
          <Table
            data={paginated}
            hoverEffect={false}
            columns={[
              { 
                header: "Agent Name", 
                key: "fullName", 
                render: (a) => (
                  <div>
                    <span style={{ fontWeight: 700, color: T.textDark }}>{a.fullName}</span>
                    {a.slackUsername !== '-' && <div style={{ fontSize: 12, color: T.textMuted }}>Slack: {a.slackUsername}</div>}
                  </div>
                ) 
              },
              { header: "Email", key: "email", render: (a) => <span style={{ fontSize: 13, color: T.textMid }}>{a.email}</span> },
              { 
                header: "Status", 
                key: "status",
                render: (a) => (
                  <span style={{ 
                    display: "inline-flex", 
                    alignItems: "center", 
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 999,
                    backgroundColor: a.status === 'Active' ? '#dcfce7' : '#fee2e2',
                    color: a.status === 'Active' ? '#166534' : '#991b1b',
                    fontSize: 12,
                    fontWeight: 700
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: a.status === 'Active' ? '#638b4b' : '#3b5229' }}/>
                    {a.status}
                  </span>
                )
              },
              { header: "Carriers", key: "carrierCount", align: "center", render: (a) => <span style={{ fontWeight: 700 }}>{a.carrierCount}</span> },
              { header: "States", key: "stateCount", align: "center", render: (a) => <span style={{ fontWeight: 700 }}>{a.stateCount}</span> },
              {
                header: "Actions",
                key: "actions",
                align: "center",
                render: (a) => (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                    <button onClick={() => handleOpenEditAgent(a)} title="Edit" style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", padding: 6 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => deleteItem('agent', a.id, a.fullName)} title="Delete" style={{ background: "none", border: "none", color: "#3b5229", cursor: "pointer", padding: 6 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                )
              }
            ]}
          />
          {!loading && filtered.length === 0 && <EmptyState title="No agents found" description="Add an agent to get started" compact />}
        </DataGrid>
      </div>
    );
  }

  // 4. AGENT WIZARD
  if (view === 'agent-wizard' && selectedAgency) {
    // Determine if any selected carriers require state appointments
    const carriersRequiringAppointment = Array.from(selectedCarriers).filter(
      id => carriers.find(c => c.id === id)?.requiresStateAppointment
    );
    const hasCarriersRequiringAppointments = carriersRequiringAppointment.length > 0;
    const totalSteps = hasCarriersRequiringAppointments ? 4 : 3;
    
    const steps = [
      { num: 1, label: "Information" },
      { num: 2, label: "Carriers" },
      { num: 3, label: "States" },
      ...(hasCarriersRequiringAppointments ? [{ num: 4, label: "Carrier States" }] : []),
    ];

    return (
      <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
        {renderBreadcrumbs()}
        
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px" }}>
            {editingAgentId ? 'Edit Agent' : 'Add New Agent'} - {selectedAgency.name}
          </h1>
          <p style={{ fontSize: 14, color: T.textMuted, fontWeight: 600 }}>
            {editingAgentId ? 'Update agent information' : 'Complete all steps to create the agent'}
          </p>
        </div>

        {/* Progress Steps */}
        <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
          {steps.map((step) => (
            <div key={step.num} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: wizardStep >= step.num ? T.blue : T.border,
                color: wizardStep >= step.num ? "#fff" : T.textMuted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 16,
              }}>
                {step.num}
              </div>
              <div>
                <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>Step {step.num}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: wizardStep >= step.num ? T.textDark : T.textMuted }}>{step.label}</div>
              </div>
              {step.num < 3 && <div style={{ flex: 1, height: 2, backgroundColor: wizardStep > step.num ? T.blue : T.border, marginLeft: 16 }} />}
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 32, maxWidth: 1400, width: "100%" }}>
          {/* Step 1: Information */}
          {wizardStep === 1 && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>
                {editingAgentId ? 'Edit Agent Information' : 'Agent Information'}
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginBottom: 24 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>First Name *</label>
                  <input 
                    value={agentForm.firstName}
                    onChange={e => setAgentForm({...agentForm, firstName: e.target.value})}
                    placeholder="John"
                    style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15, outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>Last Name *</label>
                  <input 
                    value={agentForm.lastName}
                    onChange={e => setAgentForm({...agentForm, lastName: e.target.value})}
                    placeholder="Smith"
                    style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15, outline: "none" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>User Account</label>
                <select
                  value={agentForm.userId}
                  onChange={e => setAgentForm({...agentForm, userId: e.target.value})}
                  style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15 }}
                >
                  <option value="">No User Account</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.email} {u.fullName ? `(${u.fullName})` : ''}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>Slack Username</label>
                <input 
                  value={agentForm.slackUsername}
                  onChange={e => setAgentForm({...agentForm, slackUsername: e.target.value})}
                  placeholder="@john.smith"
                  style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15 }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>Status</label>
                <div style={{ display: "flex", gap: 12 }}>
                  {(['Active', 'Inactive'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setAgentForm({...agentForm, status })}
                      style={{
                        flex: 1,
                        padding: "12px",
                        border: `1.5px solid ${agentForm.status === status ? T.blue : T.border}`,
                        borderRadius: 8,
                        backgroundColor: agentForm.status === status ? T.blueFaint : "#fff",
                        color: agentForm.status === status ? T.blue : T.textDark,
                        fontWeight: 800,
                      }}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>Language</label>
                <select
                  value={agentForm.language}
                  onChange={e => setAgentForm({...agentForm, language: e.target.value})}
                  style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15 }}
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Portuguese">Portuguese</option>
                  <option value="Italian">Italian</option>
                  <option value="Chinese">Chinese</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Korean">Korean</option>
                  <option value="Arabic">Arabic</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Tagalog">Tagalog</option>
                  <option value="Vietnamese">Vietnamese</option>
                  <option value="Russian">Russian</option>
                  <option value="Polish">Polish</option>
                </select>
                <p style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>
                  Select the agent's primary language for communication
                </p>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>Upline Agent</label>
                <select
                  value={agentForm.uplineId || ""}
                  onChange={e => setAgentForm({...agentForm, uplineId: e.target.value ? Number(e.target.value) : null})}
                  style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15 }}
                >
                  <option value="">No Upline Agent</option>
                  {agents
                    .filter(a => a.id !== editingAgentId)
                    .map(a => (
                      <option key={a.id} value={a.id}>{a.fullName} ({a.email})</option>
                    ))}
                </select>
                <p style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>
                  Select the agent's upline for compliance routing
                </p>
              </div>

              {/* Upline Requirements Info */}
              {(() => {
                const requirements = getUplineRequirements();
                const hasUpline = agentForm.uplineId !== null;
                
                if (requirements.length > 0 && !hasUpline) {
                  return (
                    <div style={{ 
                      backgroundColor: '#e0f2fe', 
                      border: '1.5px solid #38bdf8', 
                      borderRadius: 8, 
                      padding: 16,
                      marginBottom: 24
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="16" x2="12" y2="12"/>
                          <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: 8 }}>
                            Upline Agent Recommended
                          </div>
                          <div style={{ fontSize: 13, color: '#0c4a6e', marginBottom: 8 }}>
                            The following carrier/state combinations typically require an upline agent:
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: '#0c4a6e' }}>
                            {requirements.map((req, idx) => (
                              <li key={idx}>{req.carrier} - {req.state}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </>
          )}

          {/* Step 2: Carriers */}
          {wizardStep === 2 && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Select Carriers</h2>
              <p style={{ fontSize: 14, color: T.textMuted, marginBottom: 24 }}>Choose which carriers this agent is appointed with</p>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {carriers.map(carrier => {
                  const checked = selectedCarriers.has(carrier.id);
                  return (
                    <div
                      key={carrier.id}
                      onClick={() => {
                        const next = new Set(selectedCarriers);
                        if (next.has(carrier.id)) next.delete(carrier.id);
                        else next.add(carrier.id);
                        setSelectedCarriers(next);
                      }}
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
                      <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? T.blue : T.border}`, backgroundColor: checked ? T.blue : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>}
                      </div>
                      <span style={{ fontWeight: 700 }}>{carrier.name}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Step 3: States */}
          {wizardStep === 3 && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Select States</h2>
              <p style={{ fontSize: 14, color: T.textMuted, marginBottom: 24 }}>Choose which states this agent is licensed in</p>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {states.map(state => {
                  const checked = selectedStates.has(state.code);
                  return (
                    <div
                      key={state.code}
                      onClick={() => {
                        const next = new Set(selectedStates);
                        if (next.has(state.code)) next.delete(state.code);
                        else next.add(state.code);
                        setSelectedStates(next);
                      }}
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
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? T.blue : T.border}`, backgroundColor: checked ? T.blue : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {checked && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{state.code}</span>
                      <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{state.name}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Step 4: Carrier-Specific State Appointments (only shown if carriers require it) */}
          {wizardStep === 4 && hasCarriersRequiringAppointments && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Carrier-Specific State Appointments</h2>
              <p style={{ fontSize: 14, color: T.textMuted, marginBottom: 24 }}>
                Click on a carrier to expand and select which states this agent is appointed for
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {carriersRequiringAppointment.map(carrierId => {
                  const carrier = carriers.find(c => c.id === carrierId);
                  if (!carrier) return null;
                  
                  const carrierStates = carrierSpecificStates.get(carrierId) || new Set<string>();
                  const isExpanded = expandedCarriers.has(carrierId);
                  
                  return (
                    <div key={carrierId} style={{ border: `1.5px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                      {/* Carrier Header - Click to expand/collapse */}
                      <div 
                        onClick={() => {
                          const next = new Set(expandedCarriers);
                          if (next.has(carrierId)) {
                            next.delete(carrierId);
                          } else {
                            next.add(carrierId);
                          }
                          setExpandedCarriers(next);
                        }}
                        style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: 12, 
                          padding: 16,
                          backgroundColor: isExpanded ? T.blueFaint : "#fff",
                          cursor: "pointer",
                          transition: "background-color 0.2s ease",
                        }}
                      >
                        <div style={{ 
                          width: 32, 
                          height: 32, 
                          borderRadius: 8, 
                          backgroundColor: isExpanded ? T.blue : T.blueFaint, 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center" 
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isExpanded ? "#fff" : T.blue} strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                          </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: T.textDark }}>{carrier.name}</div>
                          <div style={{ fontSize: 12, color: T.blue, fontWeight: 600 }}>Requires State Appointment</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, backgroundColor: isExpanded ? "#fff" : T.blueFaint, padding: "4px 10px", borderRadius: 999 }}>
                            {carrierStates.size} states selected
                          </div>
                          <svg 
                            width="20" 
                            height="20" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke={T.textMuted} 
                            strokeWidth="2"
                            style={{ 
                              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s ease",
                            }}
                          >
                            <path d="M6 9l6 6 6-6"/>
                          </svg>
                        </div>
                      </div>
                      
                      {/* States Grid - Only show when expanded */}
                      {isExpanded && (
                        <div style={{ padding: 16, borderTop: `1.5px solid ${T.border}`, backgroundColor: "#fff" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                            {states.map(state => {
                              const checked = carrierStates.has(state.code);
                              return (
                                <div
                                  key={`${carrierId}-${state.code}`}
                                  onClick={() => {
                                    const next = new Map(carrierSpecificStates);
                                    const currentStates = new Set(next.get(carrierId) || []);
                                    if (currentStates.has(state.code)) {
                                      currentStates.delete(state.code);
                                    } else {
                                      currentStates.add(state.code);
                                    }
                                    next.set(carrierId, currentStates);
                                    setCarrierSpecificStates(next);
                                  }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "10px 12px",
                                    borderRadius: 6,
                                    border: `1.5px solid ${checked ? T.blue : T.border}`,
                                    backgroundColor: checked ? T.blueFaint : "#fff",
                                    cursor: "pointer",
                                  }}
                                >
                                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? T.blue : T.border}`, backgroundColor: checked ? T.blue : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>}
                                  </div>
                                  <span style={{ fontWeight: 700, fontSize: 13 }}>{state.code}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Final Step Upline Warning (Informational Only) */}
          {wizardStep === totalSteps && (() => {
            const requirements = getUplineRequirements();
            const hasUpline = agentForm.uplineId !== null;
            
            if (requirements.length > 0 && !hasUpline) {
              return (
                <div style={{ 
                  backgroundColor: '#e0f2fe', 
                  border: '1.5px solid #38bdf8', 
                  borderRadius: 8, 
                  padding: 16,
                  marginBottom: 24
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="16" x2="12" y2="12"/>
                      <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: 8 }}>
                        Upline Agent Recommended
                      </div>
                      <div style={{ fontSize: 13, color: '#0c4a6e', marginBottom: 8 }}>
                        The following carrier/state combinations typically require an upline agent for compliance:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: '#0c4a6e' }}>
                        {requirements.map((req, idx) => (
                          <li key={idx}>{req.carrier} - {req.state}</li>
                        ))}
                      </ul>
                      <div style={{ fontSize: 13, color: '#0c4a6e', marginTop: 8 }}>
                        You can still save without an upline, but you may want to assign one for compliance purposes.
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Navigation Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, paddingTop: 24, borderTop: `1.5px solid ${T.borderLight}` }}>
            <button 
              onClick={() => {
                if (wizardStep > 1) {
                  setWizardStep(s => s - 1);
                } else {
                  navigateToAgentList(selectedAgency);
                  setEditingAgentId(null);
                }
              }}
              style={{ backgroundColor: "transparent", color: T.textMid, border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "12px 24px", fontWeight: 800 }}
            >
              {wizardStep === 1 ? "Cancel" : "Back"}
            </button>
            
            {wizardStep < totalSteps ? (
              <button 
                onClick={() => setWizardStep(s => s + 1)}
                disabled={wizardStep === 1 && (!agentForm.firstName.trim() || !agentForm.lastName.trim())}
                style={{ 
                  backgroundColor: T.blue, 
                  color: "#fff", 
                  border: "none", 
                  borderRadius: 8, 
                  padding: "12px 24px", 
                  fontWeight: 800,
                  opacity: wizardStep === 1 && (!agentForm.firstName.trim() || !agentForm.lastName.trim()) ? 0.5 : 1,
                }}
              >
                Next Step
              </button>
            ) : (
              <button 
                onClick={saveAgent}
                disabled={saving}
                style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontWeight: 800 }}
              >
                {saving ? "Saving..." : (editingAgentId ? "Update Agent" : "Create Agent")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 5. IMO STRUCTURE VIEW
  if (view === 'imo-view' && selectedIMO) {
    return (
      <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
        {renderBreadcrumbs()}
        
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px" }}>{selectedIMO.name} - Structure</h1>
          <p style={{ fontSize: 14, color: T.textMuted, fontWeight: 600 }}>Complete organization hierarchy</p>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
          <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, marginBottom: 8 }}>AGENCIES</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: T.blue }}>{selectedIMO.agencyCount}</div>
          </div>
          <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, marginBottom: 8 }}>TOTAL AGENTS</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: T.blue }}>{selectedIMO.agentCount}</div>
          </div>
          <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, marginBottom: 8 }}>AVG AGENTS/AGENCY</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: T.blue }}>
              {selectedIMO.agencyCount > 0 ? Math.round(selectedIMO.agentCount / selectedIMO.agencyCount) : 0}
            </div>
          </div>
        </div>

        {/* Hierarchy Tree */}
        <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24 }}>Organization Tree</h2>
          
          {/* IMO Level */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: T.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.textDark }}>{selectedIMO.name}</div>
              <div style={{ fontSize: 13, color: T.textMuted }}>Insurance Marketing Organization</div>
            </div>
          </div>

          {/* Connector Line */}
          <div style={{ marginLeft: 24, paddingLeft: 24, borderLeft: `2px solid ${T.border}` }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Loading structure...</div>
            ) : agencies.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>No agencies found</div>
            ) : (
              agencies.map((agency, idx) => (
                <div key={agency.id} style={{ marginBottom: 24 }}>
                  {/* Agency Level */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: T.blueFaint, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: T.textDark }}>{agency.name}</div>
                      <div style={{ fontSize: 12, color: T.textMuted }}>{agency.agentCount} agents</div>
                    </div>
                  </div>

                  {/* Agents under this agency */}
                  {agency.agentCount > 0 && (
                    <div style={{ marginLeft: 20, paddingLeft: 20, borderLeft: `2px solid ${T.borderLight}` }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {agents.filter(a => a.id === agency.id).map(agent => (
                          <div key={agent.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", backgroundColor: "#f8fafc", borderRadius: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: agent.status === 'Active' ? '#638b4b' : '#3b5229' }}/>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{agent.fullName}</span>
                          </div>
                        ))}
                        {agents.filter(a => a.id === agency.id).length === 0 && (
                          <span style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>Agents: {agency.agentCount}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
