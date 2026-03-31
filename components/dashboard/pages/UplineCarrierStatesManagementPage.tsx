"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { Pagination, Table, DataGrid, EmptyState } from "@/components/ui";
import { AppSelect } from "@/components/ui/app-select";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Carrier {
  id: number;
  name: string;
}

interface State {
  code: string;
  name: string;
}

interface UplineCarrierState {
  id: string;
  carrierId: number;
  carrierName: string;
  stateCode: string;
  stateName: string;
  createdAt: string;
}

export default function UplineCarrierStatesManagementPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [uplineCarrierStates, setUplineCarrierStates] = useState<UplineCarrierState[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>("");
  const [selectedStateCode, setSelectedStateCode] = useState<string>("");

  async function fetchReferenceData() {
    try {
      const [{ data: carriersData, error: carriersError }, { data: statesData, error: statesError }] = await Promise.all([
        supabase.from("carriers").select("id, name").order("name"),
        supabase.from("states").select("code, name").order("name"),
      ]);
      
      if (carriersError) console.error("Error fetching carriers:", carriersError.message);
      if (statesError) console.error("Error fetching states:", statesError.message);
      
      setCarriers((carriersData ?? []).map((c: any) => ({ id: Number(c.id), name: c.name })));
      setStates((statesData ?? []).map((s: any) => ({ code: s.code, name: s.name })));
    } catch (error: any) {
      console.error("Error fetching reference data:", error?.message || error);
    }
  }

  async function fetchUplineCarrierStates() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("upline_carrier_states")
        .select("carrier_id, state_code, created_at, carriers:carrier_id (name), states:state_code (name)")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching upline carrier states:", error.message);
        throw error;
      }

      setUplineCarrierStates((data ?? []).map((item: any) => ({
        id: `${item.carrier_id}-${item.state_code}`,
        carrierId: Number(item.carrier_id),
        carrierName: item.carriers?.name || 'Unknown',
        stateCode: item.state_code,
        stateName: item.states?.name || 'Unknown',
        createdAt: new Date(item.created_at).toLocaleDateString(),
      })));
    } catch (error: any) {
      console.error("Error in fetchUplineCarrierStates:", error?.message || error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReferenceData();
    fetchUplineCarrierStates();
  }, []);

  async function saveUplineCarrierState() {
    if (!selectedCarrierId || !selectedStateCode) {
      alert("Please select both a carrier and a state");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("upline_carrier_states")
        .insert([{
          carrier_id: Number(selectedCarrierId),
          state_code: selectedStateCode,
        }]);

      if (error) {
        if (error.message.includes("duplicate key")) {
          alert("This carrier and state combination already exists");
        } else {
          throw error;
        }
      } else {
        await fetchUplineCarrierStates();
        setSelectedCarrierId("");
        setSelectedStateCode("");
      }
    } catch (error: any) {
      console.error("Error saving upline carrier state:", error);
      alert("Error saving: " + (error?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteUplineCarrierState(carrierId: number, stateCode: string) {
    const carrier = carriers.find(c => c.id === carrierId)?.name || 'Unknown';
    const state = states.find(s => s.code === stateCode)?.name || stateCode;
    const ok = confirm(`Delete requirement for "${carrier} - ${state}"?`);
    if (!ok) return;

    try {
      await supabase
        .from("upline_carrier_states")
        .delete()
        .eq("carrier_id", carrierId)
        .eq("state_code", stateCode);
      
      await fetchUplineCarrierStates();
    } catch (error) {
      console.error("Error deleting upline carrier state:", error);
      alert("Error deleting entry");
    }
  }

  const filtered = uplineCarrierStates.filter(item => 
    item.carrierName.toLowerCase().includes(search.toLowerCase()) ||
    item.stateName.toLowerCase().includes(search.toLowerCase()) ||
    item.stateCode.toLowerCase().includes(search.toLowerCase())
  );
  
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px" }}>Upline Carrier States</h1>
          <p style={{ fontSize: 14, color: T.textMuted, fontWeight: 600 }}>
            Manage which carrier and state combinations require an upline agent
          </p>
        </div>
      </div>

      {/* Add New Entry Form */}
      <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 24, marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Add New Requirement</h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginBottom: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>
              Carrier *
            </label>
            <AppSelect
              value={selectedCarrierId}
              onChange={(e: any) => setSelectedCarrierId(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                border: `1.5px solid ${T.border}`, 
                borderRadius: 8, 
                fontSize: 15,
                backgroundColor: "#fff"
              }}
            >
              <option value="">Select a carrier...</option>
              {carriers.map(carrier => (
                <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
              ))}
            </AppSelect>
          </div>
          
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>
              State *
            </label>
            <AppSelect
              value={selectedStateCode}
              onChange={(e: any) => setSelectedStateCode(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                border: `1.5px solid ${T.border}`, 
                borderRadius: 8, 
                fontSize: 15,
                backgroundColor: "#fff"
              }}
            >
              <option value="">Select a state...</option>
              {states.map(state => (
                <option key={state.code} value={state.code}>{state.code} - {state.name}</option>
              ))}
            </AppSelect>
          </div>
        </div>
        
        <button 
          onClick={saveUplineCarrierState}
          disabled={saving || !selectedCarrierId || !selectedStateCode}
          style={{ 
            backgroundColor: T.blue, 
            color: "#fff", 
            border: "none", 
            borderRadius: 8, 
            padding: "12px 24px", 
            fontWeight: 800,
            opacity: saving || !selectedCarrierId || !selectedStateCode ? 0.5 : 1,
          }}
        >
          {saving ? "Saving..." : "Add Requirement"}
        </button>
      </div>

      {/* List of Existing Entries */}
      <DataGrid
        search={search}
        onSearchChange={(s) => { setSearch(s); setPage(1); }}
        searchPlaceholder="Search by carrier or state..."
        pagination={
          <Pagination 
            page={currentPage} 
            totalItems={filtered.length} 
            itemsPerPage={itemsPerPage} 
            itemLabel="requirements" 
            onPageChange={setPage} 
          />
        }
      >
        <Table
          data={paginated}
          hoverEffect={false}
          columns={[
            { 
              header: "Carrier", 
              key: "carrierName", 
              render: (item) => (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: 8, 
                    backgroundColor: T.blueFaint, 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center" 
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="M2 17l10 5 10-5"/>
                      <path d="M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <span style={{ fontWeight: 700, color: T.textDark }}>{item.carrierName}</span>
                </div>
              ) 
            },
            { 
              header: "State", 
              key: "stateName", 
              render: (item) => (
                <div>
                  <span style={{ fontWeight: 700, color: T.textDark }}>{item.stateCode}</span>
                  <span style={{ fontSize: 13, color: T.textMuted, marginLeft: 8 }}>{item.stateName}</span>
                </div>
              ) 
            },
            { 
              header: "Created", 
              key: "createdAt", 
              render: (item) => <span style={{ fontSize: 13, color: T.textMid }}>{item.createdAt}</span> 
            },
            {
              header: "Actions",
              key: "actions",
              align: "center",
              render: (item) => (
                <button 
                  onClick={() => deleteUplineCarrierState(item.carrierId, item.stateCode)}
                  title="Delete"
                  style={{ 
                    background: "none", 
                    border: "none", 
                    color: "#3b5229", 
                    cursor: "pointer", 
                    padding: 6 
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              )
            }
          ]}
        />
        {!loading && filtered.length === 0 && (
          <EmptyState 
            title="No requirements found" 
            description="Add a carrier and state combination to get started" 
            compact 
          />
        )}
      </DataGrid>
    </div>
  );
}
