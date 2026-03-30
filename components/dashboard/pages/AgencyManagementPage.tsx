"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { Pagination, Table, DataGrid, EmptyState } from "@/components/ui";
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
  createdAt: string;
}

export default function AgencyManagementPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  
  // View state
  const [view, setView] = useState<"list" | "edit">("list");
  
  // Data states
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [imos, setImos] = useState<IMO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Search and pagination
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  
  // Form states
  const [editingAgencyId, setEditingAgencyId] = useState<number | null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [selectedImoId, setSelectedImoId] = useState("");

  // Fetch data
  async function fetchData() {
    setLoading(true);
    try {
      // Fetch IMOs for dropdown
      const { data: imosData } = await supabase
        .from("imos")
        .select("id, name")
        .order("name");
      setImos((imosData ?? []).map((i: any) => ({ id: Number(i.id), name: i.name })));

      // Fetch Agencies with IMO names
      const { data, error } = await supabase
        .from("agencies")
        .select(`
          id, 
          name, 
          imo_id,
          imos:imo_id (name),
          created_at
        `)
        .order("name");

      if (error) {
        console.error("Error fetching agencies:", error);
      } else {
        setAgencies(
          (data ?? []).map((agency: any) => ({
            id: Number(agency.id),
            name: agency.name,
            imoId: Number(agency.imo_id),
            imoName: agency.imos?.name || '-',
            createdAt: new Date(agency.created_at).toLocaleString(),
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
  }, []);

  function handleOpenCreate() {
    setEditingAgencyId(null);
    setAgencyName("");
    setSelectedImoId(imos.length > 0 ? String(imos[0].id) : "");
    setView("edit");
  }

  function handleOpenEdit(agency: Agency) {
    setEditingAgencyId(agency.id);
    setAgencyName(agency.name);
    setSelectedImoId(String(agency.imoId));
    setView("edit");
  }

  async function handleSave() {
    const trimmed = agencyName.trim();
    if (!trimmed || !selectedImoId) return;
    
    setSaving(true);
    try {
      if (editingAgencyId) {
        // Update Agency
        const { error } = await supabase
          .from("agencies")
          .update({ 
            name: trimmed,
            imo_id: Number(selectedImoId)
          })
          .eq("id", editingAgencyId);
        
        if (error) throw error;
      } else {
        // Create Agency
        const { error } = await supabase
          .from("agencies")
          .insert([{ 
            name: trimmed,
            imo_id: Number(selectedImoId)
          }]);
        
        if (error) throw error;
      }

      await fetchData();
      setView("list");
    } catch (error) {
      console.error("Error saving agency:", error);
      alert("Error saving agency. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAgency(agency: Agency) {
    const ok = window.confirm(`Delete agency "${agency.name}"? This will also remove the association from all agents. This action cannot be undone.`);
    if (!ok) return;

    try {
      const { error } = await supabase.from("agencies").delete().eq("id", agency.id);
      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error("Error deleting agency:", error);
      alert("Error deleting agency. Please try again.");
    }
  }

  // Filter and paginate agencies
  const filteredAgencies = agencies.filter(agency =>
    agency.name.toLowerCase().includes(search.toLowerCase()) ||
    agency.imoName.toLowerCase().includes(search.toLowerCase())
  );
  
  const totalPages = Math.max(1, Math.ceil(filteredAgencies.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedAgencies = filteredAgencies.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

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
            Back to Agencies
          </button>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{editingAgencyId ? "Edit Agency" : "Add New Agency"}</h1>
        </div>

        <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 32, maxWidth: 600 }}>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Agency Name *</label>
            <input 
              autoFocus
              value={agencyName}
              onChange={e => setAgencyName(e.target.value)}
              placeholder="e.g. Wunder Agency"
              style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15, outline: "none", color: T.textDark, fontWeight: 600 }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>IMO *</label>
            <select
              value={selectedImoId}
              onChange={e => setSelectedImoId(e.target.value)}
              style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15, outline: "none", color: T.textDark, fontWeight: 600, backgroundColor: "#fff", cursor: "pointer" }}
            >
              <option value="">Select IMO...</option>
              {imos.map(imo => (
                <option key={imo.id} value={imo.id}>{imo.name}</option>
              ))}
            </select>
            {imos.length === 0 && (
              <div style={{ fontSize: 12, color: "#3b5229", marginTop: 8 }}>
                No IMOs found. Please create an IMO first.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, paddingTop: 12, borderTop: `1.5px solid ${T.borderLight}` }}>
            <button 
              onClick={handleSave} 
              disabled={saving || !agencyName.trim() || !selectedImoId}
              style={{ 
                backgroundColor: T.blue, 
                color: "#fff", 
                border: "none", 
                borderRadius: 8, 
                padding: "12px 24px", 
                fontSize: 14, 
                fontWeight: 800, 
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving || !agencyName.trim() || !selectedImoId ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Agency"}
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
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px" }}>Agencies</h1>
        </div>
        <button 
          onClick={handleOpenCreate} 
          style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: `0 4px 12px ${T.blue}44` }}
        >
          + Add Agency
        </button>
      </div>

      <DataGrid
        search={search}
        onSearchChange={(s) => { setSearch(s); setPage(1); }}
        searchPlaceholder="Search agencies by name or IMO..."
        pagination={
          <Pagination
            page={currentPage}
            totalItems={filteredAgencies.length}
            itemsPerPage={itemsPerPage}
            itemLabel="agencies"
            onPageChange={setPage}
          />
        }
      >
        <Table
          data={paginatedAgencies}
          hoverEffect={false}
          onRowClick={(agency) => handleOpenEdit(agency)}
          columns={[
            {
              header: "Agency Name",
              key: "name",
              render: (agency) => (
                <span style={{ fontWeight: 700, color: T.textDark }}>
                  {agency.name}
                </span>
              )
            },
            {
              header: "IMO",
              key: "imoName",
              render: (agency) => (
                <span style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>
                  {agency.imoName}
                </span>
              )
            },
            {
              header: "Created",
              key: "createdAt",
              render: (agency) => <span style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>{agency.createdAt}</span>
            },
            {
              header: "Actions",
              key: "actions",
              align: "center",
              render: (agency) => (
                <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(agency); }}
                    style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", padding: 6, borderRadius: 6 }} 
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = T.rowBg} 
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    title="Edit agency"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteAgency(agency); }}
                    style={{ background: "none", border: "none", color: "#3b5229", cursor: "pointer", padding: 6, borderRadius: 6 }} 
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#fef2f2"} 
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    title="Delete agency"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              )
            }
          ]}
        />

        {!loading && filteredAgencies.length === 0 && (
          <EmptyState title="No agencies found" description="Add an agency or adjust your search filters." compact />
        )}
      </DataGrid>
    </div>
  );
}
