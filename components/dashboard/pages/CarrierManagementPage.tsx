"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { Button, Input, Pagination, Table } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Carrier {
  id: string;
  name: string;
  createdAt: string;
}

export default function CarrierManagementPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newCarrierName, setNewCarrierName] = useState("");
  const [editingCarrierId, setEditingCarrierId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [view, setView] = useState<"list" | "edit">("list");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  async function fetchCarriers() {
    const { data, error } = await supabase
      .from("carriers")
      .select("id, name, created_at")
      .order("name");

    if (error) {
      console.error("Error fetching carriers:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
    } else {
      setCarriers(
        (data ?? []).map((carrier) => ({
          id: String(carrier.id),
          name: carrier.name,
          createdAt: new Date(carrier.created_at).toLocaleString(),
        })),
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchCarriers();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function handleOpenCreate() {
    setEditingCarrierId(null);
    setEditingName("");
    setView("edit");
  }

  function handleOpenEdit(carrier: Carrier) {
    setEditingCarrierId(carrier.id);
    setEditingName(carrier.name);
    setView("edit");
  }

  async function handleSave() {
    const trimmed = editingName.trim();
    if (!trimmed) return;

    if (editingCarrierId) {
      // Update
      const { error } = await supabase
        .from("carriers")
        .update({ name: trimmed })
        .eq("id", editingCarrierId);

      if (error) {
        console.error("Error updating carrier:", error);
        return;
      }
      setCarriers(prev => prev.map(c => c.id === editingCarrierId ? { ...c, name: trimmed } : c));
    } else {
      // Create
      const { data, error } = await supabase
        .from("carriers")
        .insert([{ name: trimmed }])
        .select()
        .single();

      if (error) {
        console.error("Error creating carrier:", error);
        return;
      }
      if (data) {
        const newC = { id: String(data.id), name: data.name, createdAt: new Date(data.created_at).toLocaleString() };
        setCarriers(prev => [newC, ...prev]);
      }
    }
    setView("list");
  }

  async function handleDeleteCarrier(id: string) {
    const { error } = await supabase.from("carriers").delete().eq("id", id);

    if (error) {
      console.error("Error deleting carrier:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return;
    }

    setCarriers((prev) => prev.filter((carrier) => carrier.id !== id));
  }

  const filteredCarriers = carriers.filter((carrier) =>
    carrier.name.toLowerCase().includes(search.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filteredCarriers.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedCarriers = filteredCarriers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  if (view === "edit") {
    return (
      <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
        <div style={{ marginBottom: 24 }}>
          <button 
            onClick={() => setView("list")} 
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: T.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to Carriers
          </button>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{editingCarrierId ? "Edit Carrier" : "Add New Carrier"}</h1>
        </div>

        <div style={{ display: "flex", gap: 32, borderBottom: `1.5px solid ${T.border}`, marginBottom: 24 }}>
          <button style={{ padding: "12px 4px", border: "none", borderBottom: `3px solid ${T.blue}`, background: "none", color: T.blue, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>General Settings</button>
        </div>

        <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 32, maxWidth: 640 }}>
           <div style={{ marginBottom: 24 }}>
             <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Carrier Name</label>
             <input 
               autoFocus
               value={editingName}
               onChange={e => setEditingName(e.target.value)}
               placeholder="e.g. Progressive, Humana..."
               style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15, outline: "none", color: T.textDark, fontWeight: 600 }}
               onKeyDown={e => e.key === 'Enter' && handleSave()}
             />
           </div>
           <div style={{ display: "flex", gap: 12, paddingTop: 12, borderTop: `1.5px solid ${T.borderLight}` }}>
             <button onClick={handleSave} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Save Carrier</button>
             <button onClick={() => setView("list")} style={{ backgroundColor: "transparent", color: T.textMid, border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Cancel</button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px" }}>Carriers</h1>
          <p style={{ fontSize: 14, color: T.textMuted, fontWeight: 600 }}>Manage insurance carriers that provide policies to your clients. These carriers will be selectable in the deal editor.</p>
        </div>
        <button 
          onClick={handleOpenCreate} 
          style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: `0 4px 12px ${T.blue}44` }}
        >
          + Add Carrier
        </button>
      </div>

      <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "20px", borderBottom: `1.5px solid ${T.border}` }}>
          <div style={{ position: "relative", width: 220 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="3" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input 
              placeholder="Search Carriers" 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ width: "100%", padding: "8px 12px 8px 36px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none" }} 
            />
          </div>
        </div>

          <Table
            data={paginatedCarriers}
            hoverEffect={false}
            onRowClick={(c) => handleOpenEdit(c)}
            columns={[
              {
                header: (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 18, height: 18, backgroundColor: T.border, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: T.textMid }}>A</div>
                    Carrier Name
                  </div>
                ),
                key: "name",
                render: (carrier) => (
                    <span style={{ fontWeight: 700, color: T.textDark }}>
                      {carrier.name}
                    </span>
                )
              },
              {
                header: (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><path d="M3 10h18"/></svg>
                    Added on
                  </div>
                ),
                key: "createdAt",
                render: (carrier) => <span style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>{carrier.createdAt}</span>
              },
              {
                header: "Actions",
                key: "actions",
                align: "center",
                width: 100,
                render: (carrier) => (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenEdit(carrier); }}
                      style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", padding: 6, borderRadius: 6 }} 
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = T.rowBg} 
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteCarrier(carrier.id); }}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 6, borderRadius: 6 }} 
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = "#fef2f2"} 
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  </div>
                )
              }
            ]}
          />

          {!loading && filteredCarriers.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: T.textMuted, fontWeight: 700 }}>
              No carriers found.
            </div>
          )}

          <div style={{ padding: "16px 20px", borderTop: `1.5px solid ${T.border}` }}>
            <Pagination
              page={currentPage}
              totalItems={filteredCarriers.length}
              itemsPerPage={itemsPerPage}
              itemLabel="carriers"
              onPageChange={setPage}
            />
          </div>
        </div>
    </div>
  );
}
