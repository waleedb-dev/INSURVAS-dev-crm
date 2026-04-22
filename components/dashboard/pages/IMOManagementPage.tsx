"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/shadcn/table";
import { AppSelect } from "@/components/ui/app-select";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Search, Filter, Plus, Eye, Edit2, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tree, TreeNode } from "react-organizational-chart";
import styled from "styled-components";

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
  agencyId?: number;
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

function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select..."
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={(val) => onValueChange(val || "")}>
      <SelectTrigger
        style={{
          width: "100%",
          height: 38,
          borderRadius: 10,
          border: `1px solid ${T.border}`,
          backgroundColor: T.cardBg,
          color: value && value !== "All" ? T.textDark : T.textMuted,
          fontSize: 13,
          fontWeight: 500,
          paddingLeft: 14,
          paddingRight: 12,
          transition: "all 0.15s ease-in-out",
          position: "relative",
          zIndex: 1,
        }}
        className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
      >
        <SelectValue placeholder={placeholder}>
          {value && value !== "All"
            ? options.find(o => o.value === value)?.label || value
            : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        style={{
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          backgroundColor: T.cardBg,
          padding: 6,
          maxHeight: 300,
          zIndex: 50,
        }}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            style={{
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 400,
              color: T.textDark,
              cursor: "pointer",
              transition: "all 0.1s ease-in-out",
            }}
            className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LoadingSpinner({ size = 40, label = "Loading..." }: { size?: number; label?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `3px solid ${T.border}`,
          borderTopColor: "#233217",
          animation: "spin 0.8s linear infinite",
        }}
      />
      {label && (
        <span style={{ fontSize: 14, fontWeight: 500, color: T.textMuted }}>{label}</span>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const OrgCard = styled.div`
  padding: 12px 16px;
  border-radius: 12px;
  border: 1.5px solid #D2E1D2;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.15s ease-in-out;
  cursor: pointer;
  min-width: 180px;

  &:hover {
    border-color: #233217;
    box-shadow: 0 4px 16px rgba(35, 50, 23, 0.1);
    transform: translateY(-2px);
  }
`;

const OrgCardImo = styled(OrgCard)`
  background: linear-gradient(135deg, #233217 0%, #2d3d22 100%);
  border-color: #233217;
  color: #fff;

  &:hover {
    background: linear-gradient(135deg, #2d3d22 0%, #364928 100%);
  }
`;

const OrgNodeLabel = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: #233217;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
`;

const OrgNodeSubtext = styled.div`
  font-size: 11px;
  color: #647864;
  margin-top: 2px;
`;

const OrgNodeIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #EEF5EE;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  flex-shrink: 0;
`;

const OrgNodeIconImo = styled(OrgNodeIcon)`
  background: rgba(255, 255, 255, 0.2);
`;

function StatSkeleton() {
  return (
    <Card
      style={{
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        borderBottom: "4px solid #DCEBDC",
        background: T.cardBg,
        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
        padding: "20px 24px",
        minHeight: 100,
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: 1 }}>
        <div style={{ width: 80, height: 10, borderRadius: 4, background: "linear-gradient(90deg, #E8E8E8 25%, #F0F0F0 50%, #E8E8E8 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
        <div style={{ width: 60, height: 26, borderRadius: 6, background: "linear-gradient(90deg, #E8E8E8 25%, #F0F0F0 50%, #E8E8E8 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      </div>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "linear-gradient(90deg, #E8E8E8 25%, #F0F0F0 50%, #E8E8E8 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </Card>
  );
}

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

  // Filter panel state
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);
  
  // Modal states for IMO
  const [showCreateImoModal, setShowCreateImoModal] = useState(false);
  const [showEditImoModal, setShowEditImoModal] = useState(false);
  const [editingImo, setEditingImo] = useState<IMO | null>(null);
  const [editImoName, setEditImoName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingImo, setCreatingImo] = useState(false);
  const [showDeleteImoModal, setShowDeleteImoModal] = useState(false);
  const [deletingImo, setDeletingImo] = useState<IMO | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);
  
  // Modal states for Agency
  const [showCreateAgencyModal, setShowCreateAgencyModal] = useState(false);
  const [showEditAgencyModal, setShowEditAgencyModal] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [editAgencyName, setEditAgencyName] = useState("");
  const [createAgencyError, setCreateAgencyError] = useState<string | null>(null);
  const [creatingAgency, setCreatingAgency] = useState(false);
  const [showDeleteAgencyModal, setShowDeleteAgencyModal] = useState(false);
  const [deletingAgency, setDeletingAgency] = useState<Agency | null>(null);
  const [deletingAgencyInProgress, setDeletingAgencyInProgress] = useState(false);
  
  // Modal states for Agent
  const [showDeleteAgentModal, setShowDeleteAgentModal] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const [deletingAgentInProgress, setDeletingAgentInProgress] = useState(false);
  
  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);

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

  async function navigateToIMOView(imo: IMO) {
    setSelectedIMO(imo);
    setView('imo-view');
    setBreadcrumbs([
      { label: 'IMOs', view: 'imo-list' },
      { label: imo.name, view: 'imo-view', id: imo.id }
    ]);
    setLoading(true);
    try {
      await fetchAgencies(imo.id);
      // Also fetch all agents for all agencies under this IMO for the org chart
      const { data: agenciesData } = await supabase
        .from("agencies")
        .select("id")
        .eq("imo_id", imo.id);
      
      if (agenciesData && agenciesData.length > 0) {
        const agencyIds = agenciesData.map((a: any) => a.id);
        const { data: agentsData } = await supabase
          .from("agents")
          .select(`
            id, 
            agency_id,
            first_name, 
            last_name,
            users:user_id (email),
            status
          `)
          .in("agency_id", agencyIds);
        
        // Fetch carrier counts
        const agentIds = (agentsData ?? []).map((a: any) => a.id);
        const { data: carrierData } = await supabase
          .from("agent_carriers")
          .select("agent_id")
          .in("agent_id", agentIds);
        
        const carrierCountMap = new Map<number, number>();
        (carrierData ?? []).forEach((row: any) => {
          carrierCountMap.set(row.agent_id, (carrierCountMap.get(row.agent_id) || 0) + 1);
        });
        
        setAgents((agentsData ?? []).map((agent: any) => ({
          id: Number(agent.id),
          agencyId: Number(agent.agency_id),
          firstName: agent.first_name,
          lastName: agent.last_name,
          fullName: `${agent.first_name} ${agent.last_name}`,
          email: agent.users?.email || '-',
          slackUsername: '-',
          status: agent.status || 'Active',
          carrierCount: carrierCountMap.get(agent.id) || 0,
          stateCount: 0,
          createdAt: '',
          uplineId: undefined,
          language: 'English',
        })));
      } else {
        setAgents([]);
      }
    } catch (error) {
      console.error("Error fetching IMO structure:", error);
    } finally {
      setLoading(false);
    }
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

  // IMO Modal Helpers
  function openCreateImoModal() {
    setEditImoName("");
    setCreateError(null);
    setShowCreateImoModal(true);
  }

  function openEditImoModal(imo: IMO) {
    setEditingImo(imo);
    setEditImoName(imo.name);
    setShowEditImoModal(true);
  }

  function openDeleteImoModal(imo: IMO) {
    setDeletingImo(imo);
    setShowDeleteImoModal(true);
  }

  // Agency Modal Helpers
  function openCreateAgencyModal() {
    setEditAgencyName("");
    setCreateAgencyError(null);
    setShowCreateAgencyModal(true);
  }

  function openEditAgencyModal(agency: Agency) {
    setEditingAgency(agency);
    setEditAgencyName(agency.name);
    setShowEditAgencyModal(true);
  }

  function openDeleteAgencyModal(agency: Agency) {
    setDeletingAgency(agency);
    setShowDeleteAgencyModal(true);
  }

  // Agent Modal Helpers
  function openDeleteAgentModal(agent: Agent) {
    setDeletingAgent(agent);
    setShowDeleteAgentModal(true);
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

  async function deleteItem(type: 'imo' | 'agency' | 'agent', id: number) {
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          ) : (
            [
              { label: "Total IMOs", value: imos.length.toString(), color: "#233217", icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                ) },
              { label: "Total Agencies", value: imos.reduce((sum, imo) => sum + imo.agencyCount, 0).toString(), color: "#233217", icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                ) },
              { label: "Total Agents", value: imos.reduce((sum, imo) => sum + imo.agentCount, 0).toString(), color: "#233217", icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                ) },
              { label: "This Month", value: imos.filter(i => new Date(i.createdAt).getMonth() === new Date().getMonth()).length.toString(), color: "#233217", icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ) },
            ].map(({ label, value, color, icon }, i) => (
                <Card
                  key={label}
                  onMouseEnter={() => setHoveredStatIdx(i)}
                  onMouseLeave={() => setHoveredStatIdx(null)}
                  style={{
                    borderRadius: 16,
                    border: `1px solid ${T.border}`,
                    borderBottom: `4px solid ${color}`,
                    background: `linear-gradient(135deg, color-mix(in srgb, ${color} 20%, ${T.cardBg}) 0%, ${T.cardBg} 80%)`,
                    boxShadow:
                      hoveredStatIdx === i
                        ? "0 14px 40px rgba(28, 32, 26, 0.08), 0 4px 14px rgba(28, 32, 26, 0.05)"
                        : "0 4px 12px rgba(0,0,0,0.03)",
                    transform: hoveredStatIdx === i ? "translateY(-3px)" : "translateY(0)",
                    transition:
                      "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
                    padding: "20px 24px",
                    minHeight: 100,
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    cursor: "default",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#233217", letterSpacing: "0.45px", textTransform: "uppercase", lineHeight: 1.25 }}>{label}</span>
                    <div style={{ fontSize: 26, fontWeight: 800, color: color, lineHeight: 1.05, wordBreak: "break-all" }}>
                      {value}
                    </div>
                  </div>
                  <div
                    style={{
                      color,
                      backgroundColor:
                        hoveredStatIdx === i
                          ? `color-mix(in srgb, ${color} 24%, transparent)`
                          : `color-mix(in srgb, ${color} 15%, transparent)`,
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition:
                        "background-color 0.32s cubic-bezier(0.22, 1, 0.36, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
                      transform: hoveredStatIdx === i ? "scale(1.04)" : "scale(1)",
                    }}
                  >
                    {icon}
                  </div>
                </Card>
            ))
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 14 }}>
          <div
            style={{
              width: "100%",
              background: T.cardBg,
              border: `1px solid ${T.border}`,
              borderBottom: filterPanelExpanded ? "none" : `1px solid ${T.border}`,
              borderRadius: filterPanelExpanded ? "16px 16px 0 0" : 16,
              padding: "14px 20px",
              boxShadow: filterPanelExpanded ? "none" : T.shadowSm,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search
                  size={16}
                  style={{ position: "absolute", left: 12, pointerEvents: "none", zIndex: 1, color: T.textMuted }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search IMOs..."
                  style={{
                    height: 38,
                    minWidth: 260,
                    paddingLeft: 38,
                    paddingRight: 14,
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    fontSize: 14,
                    color: T.textDark,
                    background: T.pageBg,
                    outline: "none",
                    fontFamily: T.font,
                    transition: "all 0.15s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#233217";
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => setFilterPanelExpanded((v) => !v)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 38,
                  padding: "0 16px",
                  borderRadius: 10,
                  border: filterPanelExpanded ? `1.5px solid #233217` : `1px solid ${T.border}`,
                  background: filterPanelExpanded ? "#DCEBDC" : T.pageBg,
                  color: filterPanelExpanded ? "#233217" : T.textDark,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: "pointer",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                <Filter size={16} />
                Filters
              </button>

              <button
                onClick={() => openCreateImoModal()}
                style={{
                  height: 38,
                  padding: "0 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "#233217",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(35, 50, 23, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Plus size={16} />
                Add IMO
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            overflow: "hidden",
            backgroundColor: T.cardBg,
          }}
        >
          {loading ? (
            <div
              style={{
                padding: "80px 40px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 20,
              }}
            >
              <LoadingSpinner size={48} label="Loading IMOs..." />
            </div>
          ) : paginated.length === 0 ? (
            <div
              style={{
                padding: "60px 40px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>No IMOs found</div>
              <div style={{ fontSize: 14, color: T.textMid }}>Add an IMO or adjust your search filters.</div>
            </div>
          ) : (
            <>
              <div
                style={{
                  borderBottom: `1px solid ${T.border}`,
                  overflow: "hidden",
                  backgroundColor: T.cardBg,
                }}
              >
                <ShadcnTable>
                  <TableHeader style={{ backgroundColor: "#233217" }}>
                    <TableRow style={{ borderBottom: "none" }} className="hover:bg-transparent">
                      {[
                        { label: "IMO Name", align: "left" as const },
                        { label: "Agencies", align: "center" as const },
                        { label: "Agents", align: "center" as const },
                        { label: "Created", align: "left" as const },
                        { label: "Actions", align: "center" as const },
                      ].map(({ label, align }) => (
                        <TableHead key={label} style={{ 
                          color: "#ffffff", 
                          fontWeight: 700, 
                          fontSize: 12, 
                          letterSpacing: "0.3px",
                          padding: "16px 20px",
                          whiteSpace: "nowrap",
                          textAlign: align
                        }}>
                          {label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((imo) => (
                      <TableRow 
                        key={imo.id}
                        onClick={() => navigateToIMOView(imo)}
                        style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                        className="hover:bg-muted/30 transition-all duration-150"
                      >
                        <TableCell style={{ padding: "14px 20px" }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: T.textDark }}>
                            {imo.name}
                          </span>
                        </TableCell>
                        <TableCell style={{ padding: "14px 20px", textAlign: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#233217" }}>{imo.agencyCount}</span>
                        </TableCell>
                        <TableCell style={{ padding: "14px 20px", textAlign: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#233217" }}>{imo.agentCount}</span>
                        </TableCell>
                        <TableCell style={{ padding: "14px 20px" }}>
                          <span style={{ fontSize: 13, color: T.textMid, fontWeight: 400 }}>{imo.createdAt}</span>
                        </TableCell>
                        <TableCell style={{ padding: "12px 16px", textAlign: "center" }}>
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, whiteSpace: "nowrap" }}
                          >
                            <button 
                              onClick={() => navigateToIMOView(imo)}
                              style={{ background: "none", border: "none", color: "#233217", cursor: "pointer", padding: 6, borderRadius: 6 }}
                              title="View Structure"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            <button 
                              onClick={() => navigateToAgencyList(imo)}
                              style={{ background: "none", border: "none", color: "#233217", cursor: "pointer", padding: 6, borderRadius: 6 }}
                              title="Manage Agencies"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            </button>
                            <button 
                              onClick={() => openEditImoModal(imo)}
                              style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", padding: 6, borderRadius: 6 }}
                              title="Edit IMO"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button 
                              onClick={() => openDeleteImoModal(imo)}
                              style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 6, borderRadius: 6 }}
                              title="Delete IMO"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </ShadcnTable>
              </div>

              <div
                style={{
                  backgroundColor: T.cardBg,
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: `1px solid ${T.border}`,
                }}
              >
                <span style={{ fontSize: 13, color: "#233217", fontWeight: 500 }}>
                  Showing {paginated.length} of {imos.length} IMOs
                </span>
              </div>
            </>
          )}
        </div>

        {/* Create IMO Modal */}
        {showCreateImoModal && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Add IMO</h2>
                <button
                  onClick={() => setShowCreateImoModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              {createError && (
                <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 500 }}>{createError}</div>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>IMO name</label>
                <input
                  type="text"
                  value={editImoName}
                  onChange={(e) => setEditImoName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editImoName.trim()) void saveIMO();
                    if (e.key === 'Escape') setShowCreateImoModal(false);
                  }}
                  placeholder="Enter IMO name"
                  autoFocus
                  style={{
                    width: "100%",
                    height: 44,
                    border: `1.5px solid ${T.border}`,
                    borderRadius: 10,
                    fontSize: 14,
                    color: T.textDark,
                    padding: "0 14px",
                    boxSizing: "border-box",
                    background: T.cardBg,
                    outline: "none",
                    fontFamily: T.font,
                    transition: "all 0.15s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#233217";
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowCreateImoModal(false)}
                  style={{
                    height: 42,
                    padding: "0 20px",
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    background: "#fff",
                    color: T.textDark,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!editImoName.trim()) return;
                    setCreatingImo(true);
                    setCreateError(null);
                    try {
                      const { error } = await supabase.from("imos").insert([{ name: editImoName.trim() }]);
                      if (error) throw error;
                      setShowCreateImoModal(false);
                      void fetchIMOs();
                    } catch (err: any) {
                      setCreateError(err.message || "Failed to create IMO");
                    } finally {
                      setCreatingImo(false);
                    }
                  }}
                  disabled={!editImoName.trim() || creatingImo}
                  style={{
                    height: 42,
                    padding: "0 20px",
                    borderRadius: 10,
                    border: "none",
                    background: editImoName.trim() && !creatingImo ? "#233217" : T.border,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: editImoName.trim() && !creatingImo ? "pointer" : "not-allowed",
                    boxShadow: editImoName.trim() && !creatingImo ? "0 4px 12px rgba(35, 50, 23, 0.2)" : "none",
                    transition: "all 0.15s ease-in-out",
                  }}
                >
                  {creatingImo ? "Creating..." : "Add IMO"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit IMO Modal */}
        {showEditImoModal && editingImo && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Edit IMO</h2>
                <button
                  onClick={() => setShowEditImoModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>IMO name</label>
                <input
                  type="text"
                  value={editImoName}
                  onChange={(e) => setEditImoName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editImoName.trim()) void saveIMO();
                    if (e.key === 'Escape') setShowEditImoModal(false);
                  }}
                  placeholder="Enter IMO name"
                  autoFocus
                  style={{
                    width: "100%",
                    height: 44,
                    border: `1.5px solid ${T.border}`,
                    borderRadius: 10,
                    fontSize: 14,
                    color: T.textDark,
                    padding: "0 14px",
                    boxSizing: "border-box",
                    background: T.cardBg,
                    outline: "none",
                    fontFamily: T.font,
                    transition: "all 0.15s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#233217";
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowEditImoModal(false)}
                  style={{
                    height: 42,
                    padding: "0 20px",
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    background: "#fff",
                    color: T.textDark,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!editImoName.trim() || !editingImo) return;
                    setSaving(true);
                    try {
                      const { error } = await supabase.from("imos").update({ name: editImoName.trim() }).eq("id", editingImo.id);
                      if (error) throw error;
                      setShowEditImoModal(false);
                      void fetchIMOs();
                    } catch (err: any) {
                      console.error("Error updating IMO:", err);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={!editImoName.trim() || saving}
                  style={{
                    height: 42,
                    padding: "0 20px",
                    borderRadius: 10,
                    border: "none",
                    background: editImoName.trim() && !saving ? "#233217" : T.border,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: editImoName.trim() && !saving ? "pointer" : "not-allowed",
                    boxShadow: editImoName.trim() && !saving ? "0 4px 12px rgba(35, 50, 23, 0.2)" : "none",
                    transition: "all 0.15s ease-in-out",
                  }}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete IMO Modal */}
        {showDeleteImoModal && deletingImo && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#dc2626" }}>Delete IMO</h2>
                <button
                  onClick={() => setShowDeleteImoModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 14, color: "#991b1b", lineHeight: 1.6 }}>
                  Are you sure you want to permanently delete <strong>&quot;{deletingImo.name}&quot;</strong>? This action cannot be undone.
                </p>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowDeleteImoModal(false)}
                  style={{
                    height: 42,
                    padding: "0 20px",
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    background: "#fff",
                    color: T.textDark,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setDeletingInProgress(true);
                    try {
                      await deleteItem('imo', deletingImo.id);
                      setShowDeleteImoModal(false);
                    } finally {
                      setDeletingInProgress(false);
                    }
                  }}
                  disabled={deletingInProgress}
                  style={{
                    height: 42,
                    padding: "0 20px",
                    borderRadius: 10,
                    border: "none",
                    background: !deletingInProgress ? "#dc2626" : T.border,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: !deletingInProgress ? "pointer" : "not-allowed",
                    boxShadow: !deletingInProgress ? "0 4px 12px rgba(220, 38, 38, 0.2)" : "none",
                    transition: "all 0.15s ease-in-out",
                  }}
                >
                  {deletingInProgress ? "Deleting..." : "Delete IMO"}
                </button>
              </div>
            </div>
          </div>
        )}
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
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          ) : (
            [
              { label: "Total Agencies", value: agencies.length.toString(), color: "#233217", icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                ) },
              { label: "Total Agents", value: agencies.reduce((sum, a) => sum + a.agentCount, 0).toString(), color: "#233217", icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                ) },
              { label: "Avg per Agency", value: agencies.length > 0 ? Math.round(agencies.reduce((sum, a) => sum + a.agentCount, 0) / agencies.length).toString() : "0", color: "#233217", icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                ) },
              { label: "This Month", value: agencies.filter(a => new Date(a.createdAt).getMonth() === new Date().getMonth()).length.toString(), color: "#233217", icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ) },
            ].map(({ label, value, color, icon }, i) => (
                <Card
                  key={label}
                  onMouseEnter={() => setHoveredStatIdx(i)}
                  onMouseLeave={() => setHoveredStatIdx(null)}
                  style={{
                    borderRadius: 16,
                    border: `1px solid ${T.border}`,
                    borderBottom: `4px solid ${color}`,
                    background: `linear-gradient(135deg, color-mix(in srgb, ${color} 20%, ${T.cardBg}) 0%, ${T.cardBg} 80%)`,
                    boxShadow:
                      hoveredStatIdx === i
                        ? "0 14px 40px rgba(28, 32, 26, 0.08), 0 4px 14px rgba(28, 32, 26, 0.05)"
                        : "0 4px 12px rgba(0,0,0,0.03)",
                    transform: hoveredStatIdx === i ? "translateY(-3px)" : "translateY(0)",
                    transition:
                      "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
                    padding: "20px 24px",
                    minHeight: 100,
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    cursor: "default",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#233217", letterSpacing: "0.45px", textTransform: "uppercase", lineHeight: 1.25 }}>{label}</span>
                    <div style={{ fontSize: 26, fontWeight: 800, color: color, lineHeight: 1.05, wordBreak: "break-all" }}>
                      {value}
                    </div>
                  </div>
                  <div
                    style={{
                      color,
                      backgroundColor:
                        hoveredStatIdx === i
                          ? `color-mix(in srgb, ${color} 24%, transparent)`
                          : `color-mix(in srgb, ${color} 15%, transparent)`,
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition:
                        "background-color 0.32s cubic-bezier(0.22, 1, 0.36, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
                      transform: hoveredStatIdx === i ? "scale(1.04)" : "scale(1)",
                    }}
                  >
                    {icon}
                  </div>
                </Card>
            ))
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 14 }}>
          <div
            style={{
              width: "100%",
              background: T.cardBg,
              border: `1px solid ${T.border}`,
              borderBottom: filterPanelExpanded ? "none" : `1px solid ${T.border}`,
              borderRadius: filterPanelExpanded ? "16px 16px 0 0" : 16,
              padding: "14px 20px",
              boxShadow: filterPanelExpanded ? "none" : T.shadowSm,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search
                  size={16}
                  style={{ position: "absolute", left: 12, pointerEvents: "none", zIndex: 1, color: T.textMuted }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search agencies..."
                  style={{
                    height: 38,
                    minWidth: 260,
                    paddingLeft: 38,
                    paddingRight: 14,
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    fontSize: 14,
                    color: T.textDark,
                    background: T.pageBg,
                    outline: "none",
                    fontFamily: T.font,
                    transition: "all 0.15s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#233217";
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => openCreateAgencyModal()}
                style={{
                  height: 38,
                  padding: "0 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "#233217",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(35, 50, 23, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Plus size={16} />
                Add Agency
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            overflow: "hidden",
            backgroundColor: T.cardBg,
          }}
        >
          {loading ? (
            <div
              style={{
                padding: "80px 40px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 20,
              }}
            >
              <LoadingSpinner size={48} label="Loading agencies..." />
            </div>
          ) : paginated.length === 0 ? (
            <div
              style={{
                padding: "60px 40px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>No agencies found</div>
              <div style={{ fontSize: 14, color: T.textMid }}>Add an agency or adjust your search filters.</div>
            </div>
          ) : (
            <>
              <div
                style={{
                  borderBottom: `1px solid ${T.border}`,
                  overflow: "hidden",
                  backgroundColor: T.cardBg,
                }}
              >
                <ShadcnTable>
                  <TableHeader style={{ backgroundColor: "#233217" }}>
                    <TableRow style={{ borderBottom: "none" }} className="hover:bg-transparent">
                      {[
                        { label: "Agency Name", align: "left" as const },
                        { label: "Agents", align: "center" as const },
                        { label: "Created", align: "left" as const },
                        { label: "Actions", align: "center" as const },
                      ].map(({ label, align }) => (
                        <TableHead key={label} style={{ 
                          color: "#ffffff", 
                          fontWeight: 700, 
                          fontSize: 12, 
                          letterSpacing: "0.3px",
                          padding: "16px 20px",
                          whiteSpace: "nowrap",
                          textAlign: align
                        }}>
                          {label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((agency) => (
                      <TableRow 
                        key={agency.id}
                        onClick={() => navigateToAgentList(agency)}
                        style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                        className="hover:bg-muted/30 transition-all duration-150"
                      >
                        <TableCell style={{ padding: "14px 20px" }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: T.textDark }}>
                            {agency.name}
                          </span>
                        </TableCell>
                        <TableCell style={{ padding: "14px 20px", textAlign: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#233217" }}>{agency.agentCount}</span>
                        </TableCell>
                        <TableCell style={{ padding: "14px 20px" }}>
                          <span style={{ fontSize: 13, color: T.textMid, fontWeight: 400 }}>{agency.createdAt}</span>
                        </TableCell>
                        <TableCell style={{ padding: "12px 16px", textAlign: "center" }}>
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, whiteSpace: "nowrap" }}
                          >
                            <button 
                              onClick={() => navigateToAgentList(agency)}
                              style={{ background: "none", border: "none", color: "#233217", cursor: "pointer", padding: 6, borderRadius: 6 }}
                              title="Manage Agents"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </button>
                            <button 
                              onClick={() => openEditAgencyModal(agency)}
                              style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", padding: 6, borderRadius: 6 }}
                              title="Edit Agency"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button 
                              onClick={() => openDeleteAgencyModal(agency)}
                              style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 6, borderRadius: 6 }}
                              title="Delete Agency"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </ShadcnTable>
              </div>

              <div
                style={{
                  backgroundColor: T.cardBg,
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: `1px solid ${T.border}`,
                }}
              >
                <span style={{ fontSize: 13, color: "#233217", fontWeight: 500 }}>
                  Showing {paginated.length} of {agencies.length} agencies
                </span>
              </div>
            </>
          )}
        </div>

        {/* Create Agency Modal */}
        {showCreateAgencyModal && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Add Agency</h2>
                <button
                  onClick={() => setShowCreateAgencyModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              {createAgencyError && (
                <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 500 }}>{createAgencyError}</div>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Agency name</label>
                <input
                  type="text"
                  value={editAgencyName}
                  onChange={(e) => setEditAgencyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editAgencyName.trim()) void saveAgency();
                    if (e.key === 'Escape') setShowCreateAgencyModal(false);
                  }}
                  placeholder="Enter agency name"
                  autoFocus
                  style={{
                    width: "100%",
                    height: 44,
                    border: `1.5px solid ${T.border}`,
                    borderRadius: 10,
                    fontSize: 14,
                    color: T.textDark,
                    padding: "0 14px",
                    boxSizing: "border-box",
                    background: T.cardBg,
                    outline: "none",
                    fontFamily: T.font,
                    transition: "all 0.15s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#233217";
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowCreateAgencyModal(false)}
                  style={{
                    height: 42,
                    padding: "0 20px",
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    background: "#fff",
                    color: T.textDark,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!editAgencyName.trim() || !selectedIMO) return;
                    setCreatingAgency(true);
                    setCreateAgencyError(null);
                    try {
                      const { error } = await supabase.from("agencies").insert([{ name: editAgencyName.trim(), imo_id: selectedIMO.id }]);
                      if (error) throw error;
                      setShowCreateAgencyModal(false);
                      void fetchAgencies(selectedIMO.id);
                    } catch (err: any) {
                      setCreateAgencyError(err.message || "Failed to create agency");
                    } finally {
                      setCreatingAgency(false);
                    }
                  }}
                  disabled={!editAgencyName.trim() || creatingAgency}
                  style={{
                    height: 42,
                    padding: "0 20px",
                    borderRadius: 10,
                    border: "none",
                    background: editAgencyName.trim() && !creatingAgency ? "#233217" : T.border,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: editAgencyName.trim() && !creatingAgency ? "pointer" : "not-allowed",
                    boxShadow: editAgencyName.trim() && !creatingAgency ? "0 4px 12px rgba(35, 50, 23, 0.2)" : "none",
                    transition: "all 0.15s ease-in-out",
                  }}
                >
                  {creatingAgency ? "Creating..." : "Add Agency"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Agency Modal */}
        {showEditAgencyModal && editingAgency && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Edit Agency</h2>
                <button
                  onClick={() => setShowEditAgencyModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Agency name</label>
                <input
                  type="text"
                  value={editAgencyName}
                  onChange={(e) => setEditAgencyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editAgencyName.trim()) void saveAgency();
                    if (e.key === 'Escape') setShowEditAgencyModal(false);
                  }}
                  placeholder="Enter agency name"
                  autoFocus
                  style={{
                    width: "100%",
                    height: 44,
                    border: `1.5px solid ${T.border}`,
                    borderRadius: 10,
                    fontSize: 14,
                    color: T.textDark,
                    padding: "0 14px",
                    boxSizing: "border-box",
                    background: T.cardBg,
                    outline: "none",
                    fontFamily: T.font,
                    transition: "all 0.15s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#233217";
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowEditAgencyModal(false)}
                  style={{
                    height: 42,
                    padding: "0 20px",
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    background: "#fff",
                    color: T.textDark,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!editAgencyName.trim() || !editingAgency) return;
                    setSaving(true);
                    try {
                      const { error } = await supabase.from("agencies").update({ name: editAgencyName.trim() }).eq("id", editingAgency.id);
                      if (error) throw error;
                      setShowEditAgencyModal(false);
                      if (selectedIMO) void fetchAgencies(selectedIMO.id);
                    } catch (err: any) {
                      console.error("Error updating agency:", err);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={!editAgencyName.trim() || saving}
                  style={{
                    height: 42,
                    padding: "0 20px",
                    borderRadius: 10,
                    border: "none",
                    background: editAgencyName.trim() && !saving ? "#233217" : T.border,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: editAgencyName.trim() && !saving ? "pointer" : "not-allowed",
                    boxShadow: editAgencyName.trim() && !saving ? "0 4px 12px rgba(35, 50, 23, 0.2)" : "none",
                    transition: "all 0.15s ease-in-out",
                  }}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Agency Modal */}
        {showDeleteAgencyModal && deletingAgency && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#dc2626" }}>Delete Agency</h2>
                <button
                  onClick={() => setShowDeleteAgencyModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 14, color: "#991b1b", lineHeight: 1.6 }}>
                  Are you sure you want to permanently delete <strong>&quot;{deletingAgency.name}&quot;</strong> and unassign all agents? This action cannot be undone.
                </p>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowDeleteAgencyModal(false)}
                  style={{
                    height: 42,
                    padding: "0 20px",
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    background: "#fff",
                    color: T.textDark,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setDeletingAgencyInProgress(true);
                    try {
                      await deleteItem('agency', deletingAgency.id);
                      setShowDeleteAgencyModal(false);
                    } finally {
                      setDeletingAgencyInProgress(false);
                    }
                  }}
                  disabled={deletingAgencyInProgress}
                  style={{
                    height: 42,
                    padding: "0 20px",
                    borderRadius: 10,
                    border: "none",
                    background: !deletingAgencyInProgress ? "#dc2626" : T.border,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: !deletingAgencyInProgress ? "pointer" : "not-allowed",
                    boxShadow: !deletingAgencyInProgress ? "0 4px 12px rgba(220, 38, 38, 0.2)" : "none",
                    transition: "all 0.15s ease-in-out",
                  }}
                >
                  {deletingAgencyInProgress ? "Deleting..." : "Delete Agency"}
                </button>
              </div>
            </div>
          </div>
        )}
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
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          ) : (
            [
              { label: "Total Agents", value: agents.length.toString(), color: "#233217", icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                ) },
              { label: "Active Agents", value: agents.filter(a => a.status === 'Active').length.toString(), color: "#233217", icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                ) },
              { label: "Total Carriers", value: carriers.length.toString(), color: "#233217", icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
                ) },
              { label: "Total States", value: states.length.toString(), color: "#233217", icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                ) },
            ].map(({ label, value, color, icon }, i) => (
                <Card
                  key={label}
                  onMouseEnter={() => setHoveredStatIdx(i)}
                  onMouseLeave={() => setHoveredStatIdx(null)}
                  style={{
                    borderRadius: 16,
                    border: `1px solid ${T.border}`,
                    borderBottom: `4px solid ${color}`,
                    background: `linear-gradient(135deg, color-mix(in srgb, ${color} 20%, ${T.cardBg}) 0%, ${T.cardBg} 80%)`,
                    boxShadow:
                      hoveredStatIdx === i
                        ? "0 14px 40px rgba(28, 32, 26, 0.08), 0 4px 14px rgba(28, 32, 26, 0.05)"
                        : "0 4px 12px rgba(0,0,0,0.03)",
                    transform: hoveredStatIdx === i ? "translateY(-3px)" : "translateY(0)",
                    transition:
                      "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
                    padding: "20px 24px",
                    minHeight: 100,
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    cursor: "default",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#233217", letterSpacing: "0.45px", textTransform: "uppercase", lineHeight: 1.25 }}>{label}</span>
                    <div style={{ fontSize: 26, fontWeight: 800, color: color, lineHeight: 1.05, wordBreak: "break-all" }}>
                      {value}
                    </div>
                  </div>
                  <div
                    style={{
                      color,
                      backgroundColor:
                        hoveredStatIdx === i
                          ? `color-mix(in srgb, ${color} 24%, transparent)`
                          : `color-mix(in srgb, ${color} 15%, transparent)`,
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition:
                        "background-color 0.32s cubic-bezier(0.22, 1, 0.36, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
                      transform: hoveredStatIdx === i ? "scale(1.04)" : "scale(1)",
                    }}
                  >
                    {icon}
                  </div>
                </Card>
            ))
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 14 }}>
          <div
            style={{
              width: "100%",
              background: T.cardBg,
              border: `1px solid ${T.border}`,
              borderBottom: filterPanelExpanded ? "none" : `1px solid ${T.border}`,
              borderRadius: filterPanelExpanded ? "16px 16px 0 0" : 16,
              padding: "14px 20px",
              boxShadow: filterPanelExpanded ? "none" : T.shadowSm,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search
                  size={16}
                  style={{ position: "absolute", left: 12, pointerEvents: "none", zIndex: 1, color: T.textMuted }}
                />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search agents..."
                  style={{
                    height: 38,
                    minWidth: 260,
                    paddingLeft: 38,
                    paddingRight: 14,
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    fontSize: 14,
                    color: T.textDark,
                    background: T.pageBg,
                    outline: "none",
                    fontFamily: T.font,
                    transition: "all 0.15s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#233217";
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => navigateToAgentWizard(selectedAgency)}
                style={{
                  height: 38,
                  padding: "0 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "#233217",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(35, 50, 23, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Plus size={16} />
                Add Agent
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            overflow: "hidden",
            backgroundColor: T.cardBg,
          }}
        >
          {loading ? (
            <div
              style={{
                padding: "80px 40px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 20,
              }}
            >
              <LoadingSpinner size={48} label="Loading agents..." />
            </div>
          ) : paginated.length === 0 ? (
            <div
              style={{
                padding: "60px 40px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>No agents found</div>
              <div style={{ fontSize: 14, color: T.textMid }}>Add an agent or adjust your search filters.</div>
            </div>
          ) : (
            <>
              <div
                style={{
                  borderBottom: `1px solid ${T.border}`,
                  overflow: "hidden",
                  backgroundColor: T.cardBg,
                }}
              >
                <ShadcnTable>
                  <TableHeader style={{ backgroundColor: "#233217" }}>
                    <TableRow style={{ borderBottom: "none" }} className="hover:bg-transparent">
                      {[
                        { label: "Agent Name", align: "left" as const },
                        { label: "Email", align: "left" as const },
                        { label: "Status", align: "center" as const },
                        { label: "Carriers", align: "center" as const },
                        { label: "States", align: "center" as const },
                        { label: "Actions", align: "center" as const },
                      ].map(({ label, align }) => (
                        <TableHead key={label} style={{ 
                          color: "#ffffff", 
                          fontWeight: 700, 
                          fontSize: 12, 
                          letterSpacing: "0.3px",
                          padding: "16px 20px",
                          whiteSpace: "nowrap",
                          textAlign: align
                        }}>
                          {label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((agent) => (
                      <TableRow 
                        key={agent.id}
                        style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                        className="hover:bg-muted/30 transition-all duration-150"
                      >
                        <TableCell style={{ padding: "14px 20px" }}>
                          <div>
                            <span style={{ fontSize: 14, fontWeight: 500, color: T.textDark }}>
                              {agent.fullName}
                            </span>
                            {agent.slackUsername !== '-' && (
                              <div style={{ fontSize: 12, color: T.textMuted }}>Slack: {agent.slackUsername}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell style={{ padding: "14px 20px" }}>
                          <span style={{ fontSize: 13, color: T.textMid, fontWeight: 400 }}>{agent.email}</span>
                        </TableCell>
                        <TableCell style={{ padding: "14px 20px", textAlign: "center" }}>
                          <span style={{ 
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
                            <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: agent.status === 'Active' ? '#638b4b' : '#b91c1c' }}/>
                            {agent.status}
                          </span>
                        </TableCell>
                        <TableCell style={{ padding: "14px 20px", textAlign: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#233217" }}>{agent.carrierCount}</span>
                        </TableCell>
                        <TableCell style={{ padding: "14px 20px", textAlign: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#233217" }}>{agent.stateCount}</span>
                        </TableCell>
                        <TableCell style={{ padding: "12px 16px", textAlign: "center" }}>
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, whiteSpace: "nowrap" }}
                          >
                            <button 
                              onClick={() => handleOpenEditAgent(agent)}
                              style={{ background: "none", border: "none", color: "#233217", cursor: "pointer", padding: 6, borderRadius: 6 }}
                              title="Edit Agent"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button 
                              onClick={() => openDeleteAgentModal(agent)}
                              style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 6, borderRadius: 6 }}
                              title="Delete Agent"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </ShadcnTable>
              </div>

              <div
                style={{
                  backgroundColor: T.cardBg,
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: `1px solid ${T.border}`,
                }}
              >
                <span style={{ fontSize: 13, color: "#233217", fontWeight: 500 }}>
                  Showing {paginated.length} of {filtered.length} agents
                </span>
              </div>
            </>
          )}
        </div>

        {/* Delete Agent Modal */}
        {showDeleteAgentModal && deletingAgent && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#dc2626" }}>Delete Agent</h2>
                <button
                  onClick={() => setShowDeleteAgentModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 14, color: "#991b1b", lineHeight: 1.6 }}>
                  Are you sure you want to permanently delete <strong>&quot;{deletingAgent.fullName}&quot;</strong>? This action cannot be undone.
                </p>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowDeleteAgentModal(false)}
                  style={{
                    height: 42,
                    padding: "0 20px",
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    background: "#fff",
                    color: T.textDark,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setDeletingAgentInProgress(true);
                    try {
                      await deleteItem('agent', deletingAgent.id);
                      setShowDeleteAgentModal(false);
                    } finally {
                      setDeletingAgentInProgress(false);
                    }
                  }}
                  disabled={deletingAgentInProgress}
                  style={{
                    height: 42,
                    padding: "0 20px",
                    borderRadius: 10,
                    border: "none",
                    background: !deletingAgentInProgress ? "#dc2626" : T.border,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: !deletingAgentInProgress ? "pointer" : "not-allowed",
                    boxShadow: !deletingAgentInProgress ? "0 4px 12px rgba(220, 38, 38, 0.2)" : "none",
                    transition: "all 0.15s ease-in-out",
                  }}
                >
                  {deletingAgentInProgress ? "Deleting..." : "Delete Agent"}
                </button>
              </div>
            </div>
          </div>
        )}
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
                <AppSelect
                  value={agentForm.userId}
                  onChange={e => setAgentForm({...agentForm, userId: e.target.value})}
                  style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15 }}
                >
                  <option value="">No User Account</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.email} {u.fullName ? `(${u.fullName})` : ''}</option>)}
                </AppSelect>
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
                <AppSelect
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
                </AppSelect>
                <p style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>
                  Select the agent's primary language for communication
                </p>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>Upline Agent</label>
                <AppSelect
                  value={String(agentForm.uplineId ?? "")}
                  onChange={e => setAgentForm({...agentForm, uplineId: e.target.value ? Number(e.target.value) : null})}
                  style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15 }}
                >
                  <option value="">No Upline Agent</option>
                  {agents
                    .filter(a => a.id !== editingAgentId)
                    .map(a => (
                      <option key={a.id} value={a.id}>{a.fullName} ({a.email})</option>
                    ))}
                </AppSelect>
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
            <div style={{ fontSize: 32, fontWeight: 800, color: "#233217" }}>{selectedIMO.agencyCount}</div>
          </div>
          <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, marginBottom: 8 }}>TOTAL AGENTS</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#233217" }}>{selectedIMO.agentCount}</div>
          </div>
          <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, marginBottom: 8 }}>AVG AGENTS/AGENCY</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#233217" }}>
              {selectedIMO.agencyCount > 0 ? Math.round(selectedIMO.agentCount / selectedIMO.agencyCount) : 0}
            </div>
          </div>
        </div>

        {/* Org Chart */}
        <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 24, overflowX: "auto" }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24 }}>Organization Tree</h2>
          
          {loading ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <LoadingSpinner size={48} label="Loading organization structure..." />
            </div>
          ) : agencies.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: T.textMuted }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No agencies found</div>
              <div style={{ fontSize: 14 }}>Add agencies to see the organization structure</div>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "flex-start", padding: "20px 0" }}>
              <Tree
                lineWidth={'2px'}
                lineColor={'#D2E1D2'}
                lineBorderRadius={'10px'}
                nodePadding={'12px'}
                label={
                  <OrgCardImo>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <OrgNodeIconImo>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                      </OrgNodeIconImo>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{selectedIMO.name}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>IMO</div>
                      </div>
                    </div>
                  </OrgCardImo>
                }
              >
                {agencies.map((agency) => (
                  <TreeNode
                    key={agency.id}
                    label={
                      <OrgCard>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <OrgNodeIcon>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#233217" strokeWidth="2">
                              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                              <polyline points="9 22 9 12 15 12 15 22"/>
                            </svg>
                          </OrgNodeIcon>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#233217", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agency.name}</div>
                            <OrgNodeSubtext>{agency.agentCount} agents</OrgNodeSubtext>
                          </div>
                        </div>
                      </OrgCard>
                    }
                  >
                    {agents.filter(a => a.agencyId === agency.id).map((agent) => (
                      <TreeNode
                        key={agent.id}
                        label={
                          <OrgCard style={{ minWidth: 140 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: agent.status === 'Active' ? '#638b4b' : '#94a3b8', flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.fullName}</div>
                                <div style={{ fontSize: 10, color: "#647864" }}>{agent.email}</div>
                              </div>
                            </div>
                          </OrgCard>
                        }
                      />
                    ))}
                  </TreeNode>
                ))}
              </Tree>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
