"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/shadcn/table";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Search, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
          color: value ? T.textDark : T.textMuted,
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
          {value
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
  
  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState<UplineCarrierState | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deletingInProgress, setDeletingInProgress] = useState(false);

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

  function openAddModal() {
    setSelectedCarrierId("");
    setSelectedStateCode("");
    setAddError(null);
    setShowAddModal(true);
  }

  function openDeleteModal(item: UplineCarrierState) {
    setDeletingItem(item);
    setDeleteConfirmName("");
    setShowDeleteModal(true);
  }

  async function saveUplineCarrierState() {
    if (!selectedCarrierId || !selectedStateCode) {
      setAddError("Please select both a carrier and a state");
      return;
    }

    setSaving(true);
    setAddError(null);
    try {
      const { error } = await supabase
        .from("upline_carrier_states")
        .insert([{
          carrier_id: Number(selectedCarrierId),
          state_code: selectedStateCode,
        }]);

      if (error) {
        if (error.message.includes("duplicate key")) {
          setAddError("This carrier and state combination already exists");
        } else {
          throw error;
        }
      } else {
        await fetchUplineCarrierStates();
        setShowAddModal(false);
        setSelectedCarrierId("");
        setSelectedStateCode("");
      }
    } catch (error: any) {
      console.error("Error saving upline carrier state:", error);
      setAddError("Error: " + (error?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem() {
    if (!deletingItem) return;
    
    setDeletingInProgress(true);
    try {
      await supabase
        .from("upline_carrier_states")
        .delete()
        .eq("carrier_id", deletingItem.carrierId)
        .eq("state_code", deletingItem.stateCode);
      
      await fetchUplineCarrierStates();
      setShowDeleteModal(false);
      setDeletingItem(null);
    } catch (error) {
      console.error("Error deleting upline carrier state:", error);
    } finally {
      setDeletingInProgress(false);
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

  const uniqueCarriers = new Set(uplineCarrierStates.map(item => item.carrierId)).size;
  const uniqueStates = new Set(uplineCarrierStates.map(item => item.stateCode)).size;

  return (
    <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          [
            { label: "Total Requirements", value: uplineCarrierStates.length.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              ) },
            { label: "Carriers", value: uniqueCarriers.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
              ) },
            { label: "States", value: uniqueStates.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ) },
            { label: "This Month", value: uplineCarrierStates.filter(item => {
              const itemDate = new Date(item.createdAt);
              const now = new Date();
              return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
            }).length.toString(), color: "#233217", icon: (
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
            borderBottom: "none",
            borderRadius: "16px 16px 0 0",
            padding: "14px 20px",
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
                placeholder="Search by carrier or state..."
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
              onClick={openAddModal}
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
              Add Requirement
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
            <LoadingSpinner size={48} label="Loading requirements..." />
          </div>
        ) : paginated.length === 0 ? (
          <div
            style={{
              padding: "60px 40px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>No requirements found</div>
            <div style={{ fontSize: 14, color: T.textMid }}>Add a carrier and state combination to get started.</div>
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
                      { label: "Carrier", align: "left" as const },
                      { label: "State", align: "left" as const },
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
                  {paginated.map((item) => (
                    <TableRow 
                      key={item.id}
                      style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                      className="hover:bg-muted/30 transition-all duration-150"
                    >
                      <TableCell style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ 
                            width: 32, 
                            height: 32, 
                            borderRadius: 8, 
                            backgroundColor: "#DCEBDC", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center" 
                          }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#233217" strokeWidth="2">
                              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                              <path d="M2 17l10 5 10-5"/>
                              <path d="M2 12l10 5 10-5"/>
                            </svg>
                          </div>
                          <span style={{ fontWeight: 500, color: T.textDark }}>{item.carrierName}</span>
                        </div>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <div>
                          <span style={{ fontWeight: 700, color: "#233217" }}>{item.stateCode}</span>
                          <span style={{ fontSize: 13, color: T.textMuted, marginLeft: 8 }}>{item.stateName}</span>
                        </div>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 13, color: T.textMid, fontWeight: 400 }}>{item.createdAt}</span>
                      </TableCell>
                      <TableCell style={{ padding: "12px 16px", textAlign: "center" }}>
                        <div
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, whiteSpace: "nowrap" }}
                        >
                          <button 
                            onClick={() => openDeleteModal(item)}
                            style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 6, borderRadius: 6 }}
                            title="Delete Requirement"
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
                Showing {paginated.length} of {filtered.length} requirements
              </span>
            </div>
          </>
        )}
      </div>

      {/* Add Requirement Modal */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Add Requirement</h2>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {addError && (
              <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 500 }}>{addError}</div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Carrier</label>
              <StyledSelect
                value={selectedCarrierId}
                onValueChange={setSelectedCarrierId}
                options={carriers.map(c => ({ value: String(c.id), label: c.name }))}
                placeholder="Select a carrier..."
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>State</label>
              <StyledSelect
                value={selectedStateCode}
                onValueChange={setSelectedStateCode}
                options={states.map(s => ({ value: s.code, label: `${s.code} - ${s.name}` }))}
                placeholder="Select a state..."
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowAddModal(false)}
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
                onClick={saveUplineCarrierState}
                disabled={saving || !selectedCarrierId || !selectedStateCode}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: selectedCarrierId && selectedStateCode && !saving ? "#233217" : T.border,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: selectedCarrierId && selectedStateCode && !saving ? "pointer" : "not-allowed",
                  boxShadow: selectedCarrierId && selectedStateCode && !saving ? "0 4px 12px rgba(35, 50, 23, 0.2)" : "none",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                {saving ? "Adding..." : "Add Requirement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Requirement Modal */}
      {showDeleteModal && deletingItem && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#dc2626" }}>Delete Requirement</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#991b1b", lineHeight: 1.6 }}>
                <strong>Warning:</strong> This will permanently delete the requirement for <strong>"{deletingItem.carrierName} - {deletingItem.stateCode}"</strong>. This action cannot be undone.
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                Type <strong>{deletingItem.carrierName} - {deletingItem.stateCode}</strong> to confirm deletion
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteConfirmName === `${deletingItem.carrierName} - ${deletingItem.stateCode}`) void deleteItem();
                  if (e.key === 'Escape') setShowDeleteModal(false);
                }}
                placeholder={`${deletingItem.carrierName} - ${deletingItem.stateCode}`}
                autoFocus
                style={{
                  width: "100%",
                  height: 44,
                  border: `1.5px solid ${deleteConfirmName === `${deletingItem.carrierName} - ${deletingItem.stateCode}` ? "#dc2626" : T.border}`,
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
                  e.currentTarget.style.borderColor = deleteConfirmName === `${deletingItem.carrierName} - ${deletingItem.stateCode}` ? "#dc2626" : "#233217";
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${deleteConfirmName === `${deletingItem.carrierName} - ${deletingItem.stateCode}` ? "rgba(220, 38, 38, 0.1)" : "rgba(35, 50, 23, 0.1)"}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = deleteConfirmName === `${deletingItem.carrierName} - ${deletingItem.stateCode}` ? "#dc2626" : T.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDeleteModal(false)}
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
                onClick={deleteItem}
                disabled={deleteConfirmName !== `${deletingItem.carrierName} - ${deletingItem.stateCode}` || deletingInProgress}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: deleteConfirmName === `${deletingItem.carrierName} - ${deletingItem.stateCode}` && !deletingInProgress ? "#dc2626" : T.border,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: deleteConfirmName === `${deletingItem.carrierName} - ${deletingItem.stateCode}` && !deletingInProgress ? "pointer" : "not-allowed",
                  boxShadow: deleteConfirmName === `${deletingItem.carrierName} - ${deletingItem.stateCode}` && !deletingInProgress ? "0 4px 12px rgba(220, 38, 38, 0.2)" : "none",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                {deletingInProgress ? "Deleting..." : "Delete Requirement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}