"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { Pagination, DataGrid, EmptyState } from "@/components/ui";
import { AppSelect } from "@/components/ui/app-select";
import { Card } from "@/components/ui/card";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/shadcn/table";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Search, Filter, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Carrier {
  id: string;
  name: string;
  requiresStateAppointment: boolean;
  createdAt: string;
}

interface Product {
  id: number;
  name: string;
}

interface CarrierInfo {
  id: number;
  carrierId: string;
  groupType: 'Carrier Requirements' | 'Authorization Format' | 'Limitations' | 'Information';
  description: string;
}

const GROUP_TYPES: CarrierInfo['groupType'][] = ['Carrier Requirements', 'Authorization Format', 'Limitations', 'Information'];

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

export default function CarrierManagementPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingCarrierId, setEditingCarrierId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [requiresStateAppointment, setRequiresStateAppointment] = useState(false);
  const [view, setView] = useState<"list" | "edit" | "view">("list");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [newProductName, setNewProductName] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingProductName, setEditingProductName] = useState("");

  // Carrier Info states
  const [carrierInfo, setCarrierInfo] = useState<CarrierInfo[]>([]);
  const [carrierInfoLoading, setCarrierInfoLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'additional'>('general');
  
  // Add new carrier info
  const [newInfoGroupType, setNewInfoGroupType] = useState<CarrierInfo['groupType']>('Carrier Requirements');
  const [newInfoDescription, setNewInfoDescription] = useState("");
  
  // Edit carrier info
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCarrierName, setNewCarrierName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingCarrier, setCreatingCarrier] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [editCarrierName, setEditCarrierName] = useState("");
  const [editRequiresState, setEditRequiresState] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCarrier, setDeletingCarrier] = useState<Carrier | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deletingInProgress, setDeletingInProgress] = useState(false);
  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);
  const [editingInfoId, setEditingInfoId] = useState<number | null>(null);
  const [editingInfoGroupType, setEditingInfoGroupType] = useState<CarrierInfo['groupType']>('Carrier Requirements');
  const [editingInfoDescription, setEditingInfoDescription] = useState("");

  const hasActiveFilters = search.trim() !== "";
  const activeFilterCount = search.trim() !== "" ? 1 : 0;

  const clearFilters = () => {
    setSearch("");
    setPage(1);
  };

  async function fetchCarriers() {
    const { data, error } = await supabase
      .from("carriers")
      .select("id, name, requires_state_appointment, created_at")
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
          requiresStateAppointment: carrier.requires_state_appointment ?? false,
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
    setRequiresStateAppointment(false);
    setProducts([]);
    setSelectedProductIds(new Set());
    setNewProductName("");
    setEditingProductId(null);
    setEditingProductName("");
    setView("edit");
  }

  function handleOpenEdit(carrier: Carrier) {
    setEditingCarrierId(carrier.id);
    setEditingName(carrier.name);
    setRequiresStateAppointment(carrier.requiresStateAppointment);
    setProducts([]);
    setSelectedProductIds(new Set());
    setNewProductName("");
    setEditingProductId(null);
    setEditingProductName("");
    setCarrierInfo([]);
    setActiveTab('general');
    setNewInfoGroupType('Carrier Requirements');
    setNewInfoDescription("");
    setEditingInfoId(null);
    setView("edit");
  }

  function handleOpenView(carrier: Carrier) {
    setEditingCarrierId(carrier.id);
    setEditingName(carrier.name);
    setRequiresStateAppointment(carrier.requiresStateAppointment);
    setProducts([]);
    setSelectedProductIds(new Set());
    setCarrierInfo([]);
    setView("view");
    void fetchProductsAndSelections(carrier.id);
    void fetchCarrierInfo(carrier.id);
  }

  function openEditModal(c: Carrier) {
    setEditingCarrier(c);
    setEditCarrierName(c.name);
    setEditRequiresState(c.requiresStateAppointment);
    setShowEditModal(true);
  }

  function openDeleteModal(c: Carrier) {
    setDeletingCarrier(c);
    setDeleteConfirmName("");
    setShowDeleteModal(true);
  }

  async function handleCreateCarrier() {
    if (!newCarrierName.trim()) return;

    setCreatingCarrier(true);
    setCreateError(null);

    const { data, error } = await supabase
      .from("carriers")
      .insert([{ name: newCarrierName.trim(), requires_state_appointment: false }])
      .select()
      .single();

    if (error) {
      console.error("Error creating carrier:", error);
      setCreateError(error.message || "Failed to create carrier");
    } else {
      setShowCreateModal(false);
      setNewCarrierName("");
      fetchCarriers();
    }
    setCreatingCarrier(false);
  }

  async function handleUpdateCarrier() {
    if (!editingCarrier || !editCarrierName.trim()) return;

    const { error } = await supabase
      .from("carriers")
      .update({ name: editCarrierName.trim(), requires_state_appointment: editRequiresState })
      .eq("id", editingCarrier.id);

    if (error) {
      console.error("Error updating carrier:", error);
    } else {
      setShowEditModal(false);
      setEditingCarrier(null);
      fetchCarriers();
    }
  }

  async function handleDeleteCarrier() {
    if (!deletingCarrier) return;
    if (deleteConfirmName !== deletingCarrier.name) return;

    setDeletingInProgress(true);

    const { error } = await supabase
      .from("carriers")
      .delete()
      .eq("id", deletingCarrier.id);

    if (error) {
      console.error("Error deleting carrier:", error);
      setDeletingInProgress(false);
    } else {
      setShowDeleteModal(false);
      setDeletingCarrier(null);
      setDeleteConfirmName("");
      fetchCarriers();
    }
  }

  async function fetchCarrierInfo(carrierId: string) {
    setCarrierInfoLoading(true);
    try {
      const { data, error } = await supabase
        .from('carrier_info')
        .select('id, carrier_id, group_type, description, created_at')
        .eq('carrier_id', carrierId)
        .order('group_type')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching carrier info:", error);
        setCarrierInfo([]);
      } else {
        setCarrierInfo(
          (data ?? []).map((item: any) => ({
            id: Number(item.id),
            carrierId: String(item.carrier_id),
            groupType: item.group_type as CarrierInfo['groupType'],
            description: item.description,
          }))
        );
      }
    } finally {
      setCarrierInfoLoading(false);
    }
  }

  useEffect(() => {
    if (view === "edit" && editingCarrierId) {
      void fetchCarrierInfo(editingCarrierId);
    }
  }, [view, editingCarrierId]);

  async function handleAddCarrierInfo() {
    const trimmedDescription = newInfoDescription.trim();
    if (!trimmedDescription || !editingCarrierId) return;

    const { data, error } = await supabase
      .from('carrier_info')
      .insert([{ 
        carrier_id: editingCarrierId, 
        group_type: newInfoGroupType, 
        description: trimmedDescription 
      }])
      .select('id, carrier_id, group_type, description, created_at')
      .single();

    if (error) {
      console.error("Error creating carrier info:", error);
      return;
    }

    if (data) {
      const created: CarrierInfo = {
        id: Number(data.id),
        carrierId: String(data.carrier_id),
        groupType: data.group_type as CarrierInfo['groupType'],
        description: data.description,
      };
      setCarrierInfo(prev => [...prev, created].sort((a, b) => a.groupType.localeCompare(b.groupType)));
      setNewInfoDescription("");
    }
  }

  function startEditCarrierInfo(info: CarrierInfo) {
    setEditingInfoId(info.id);
    setEditingInfoGroupType(info.groupType);
    setEditingInfoDescription(info.description);
  }

  function cancelEditCarrierInfo() {
    setEditingInfoId(null);
    setEditingInfoDescription("");
  }

  async function saveEditedCarrierInfo() {
    if (editingInfoId == null) return;
    const trimmed = editingInfoDescription.trim();
    if (!trimmed) return;

    const { error } = await supabase
      .from('carrier_info')
      .update({ 
        group_type: editingInfoGroupType, 
        description: trimmed 
      })
      .eq('id', editingInfoId);

    if (error) {
      console.error("Error updating carrier info:", error);
      return;
    }

    setCarrierInfo(prev =>
      prev
        .map(info => (info.id === editingInfoId ? { ...info, groupType: editingInfoGroupType, description: trimmed } : info))
        .sort((a, b) => a.groupType.localeCompare(b.groupType))
    );
    cancelEditCarrierInfo();
  }

  async function deleteCarrierInfo(infoId: number) {
    const info = carrierInfo.find(i => i.id === infoId);
    const ok = window.confirm(`Delete this ${info?.groupType} entry? This action cannot be undone.`);
    if (!ok) return;

    const { error } = await supabase.from('carrier_info').delete().eq('id', infoId);
    if (error) {
      console.error("Error deleting carrier info:", error);
      return;
    }

    setCarrierInfo(prev => prev.filter(info => info.id !== infoId));
    if (editingInfoId === infoId) {
      cancelEditCarrierInfo();
    }
  }

  async function fetchProductsAndSelections(carrierId: string | null) {
    setProductsLoading(true);
    try {
      const [{ data: productsData, error: productsError }, { data: mappingData, error: mappingError }] = await Promise.all([
        supabase.from("products").select("id, name").order("name"),
        carrierId
          ? supabase.from("carrier_products").select("product_id").eq("carrier_id", carrierId)
          : Promise.resolve({ data: [] as { product_id: number }[], error: null as any }),
      ]);

      if (productsError) {
        console.error("Error fetching products:", productsError);
        setProducts([]);
      } else {
        setProducts((productsData ?? []).map((row: any) => ({ id: Number(row.id), name: String(row.name) })));
      }

      if (mappingError) {
        console.error("Error fetching carrier products:", mappingError);
        setSelectedProductIds(new Set());
      } else {
        setSelectedProductIds(new Set((mappingData ?? []).map((row: any) => Number(row.product_id))));
      }
    } finally {
      setProductsLoading(false);
    }
  }

  useEffect(() => {
    if (view !== "edit") return;
    void fetchProductsAndSelections(editingCarrierId);
  }, [view, editingCarrierId]);

  function toggleProduct(id: number) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddProduct() {
    const trimmed = newProductName.trim();
    if (!trimmed) return;

    const { data, error } = await supabase
      .from("products")
      .insert([{ name: trimmed }])
      .select("id, name")
      .single();

    if (error) {
      console.error("Error creating product:", error);
      return;
    }

    const created: Product = { id: Number((data as any).id), name: String((data as any).name) };
    setProducts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedProductIds((prev) => new Set(prev).add(created.id));
    setNewProductName("");
  }

  function startEditProduct(p: Product) {
    setEditingProductId(p.id);
    setEditingProductName(p.name);
  }

  function cancelEditProduct() {
    setEditingProductId(null);
    setEditingProductName("");
  }

  async function saveEditedProduct() {
    if (editingProductId == null) return;
    const trimmed = editingProductName.trim();
    if (!trimmed) return;

    const { error } = await supabase
      .from("products")
      .update({ name: trimmed })
      .eq("id", editingProductId);

    if (error) {
      console.error("Error updating product:", error);
      return;
    }

    setProducts((prev) =>
      prev
        .map((p) => (p.id === editingProductId ? { ...p, name: trimmed } : p))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    cancelEditProduct();
  }

  async function deleteProduct(productId: number) {
    const product = products.find((p) => p.id === productId);
    const ok = window.confirm(`Delete product "${product?.name ?? "this product"}"? This removes it from all carriers.`);
    if (!ok) return;

    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) {
      console.error("Error deleting product:", error);
      return;
    }

    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
    if (editingProductId === productId) {
      cancelEditProduct();
    }
  }

  async function handleSave() {
    const trimmed = editingName.trim();
    if (!trimmed) return;

    let carrierId = editingCarrierId;
    if (editingCarrierId) {
      // Update
      const { error } = await supabase
        .from("carriers")
        .update({ name: trimmed, requires_state_appointment: requiresStateAppointment })
        .eq("id", editingCarrierId);

      if (error) {
        console.error("Error updating carrier:", error);
        return;
      }
      setCarriers(prev => prev.map(c => c.id === editingCarrierId ? { ...c, name: trimmed, requiresStateAppointment } : c));
    } else {
      // Create
      const { data, error } = await supabase
        .from("carriers")
        .insert([{ name: trimmed, requires_state_appointment: requiresStateAppointment }])
        .select()
        .single();

      if (error) {
        console.error("Error creating carrier:", error);
        return;
      }
      if (data) {
        const newC = { id: String(data.id), name: data.name, requiresStateAppointment: data.requires_state_appointment ?? false, createdAt: new Date(data.created_at).toLocaleString() };
        setCarriers(prev => [newC, ...prev]);
        carrierId = String(data.id);
      }
    }

    if (carrierId) {
      // Persist product mapping
      const { error: deleteError } = await supabase
        .from("carrier_products")
        .delete()
        .eq("carrier_id", carrierId);

      if (deleteError) {
        console.error("Error clearing carrier products:", deleteError);
        return;
      }

      const payload = Array.from(selectedProductIds).map((productId) => ({
        carrier_id: carrierId,
        product_id: productId,
      }));

      if (payload.length > 0) {
        const { error: insertError } = await supabase.from("carrier_products").insert(payload);
        if (insertError) {
          console.error("Error saving carrier products:", insertError);
          return;
        }
      }
    }

    setView("list");
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

  if (view === "view" && editingCarrierId) {
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{editingName}</h1>
              {(() => {
                const carrier = carriers.find(c => c.id === editingCarrierId);
                return carrier?.requiresStateAppointment ? (
                  <div style={{ 
                    display: "inline-flex", 
                    alignItems: "center", 
                    gap: 6, 
                    marginTop: 8,
                    padding: "4px 10px",
                    backgroundColor: T.blueFaint,
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: T.blue
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="M2 17l10 5 10-5"/>
                      <path d="M2 12l10 5 10-5"/>
                    </svg>
                    Requires State-Specific Appointment
                  </div>
                ) : null;
              })()}
            </div>
            <button 
              onClick={() => {
                const carrier = carriers.find(c => c.id === editingCarrierId);
                if (carrier) handleOpenEdit(carrier);
              }}
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
              Edit Carrier
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
          {/* Products Section */}
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
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: T.textDark }}>Products</h2>
                  <p style={{ fontSize: 12, color: T.textMuted, margin: "4px 0 0" }}>Available products for this carrier</p>
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
                {selectedProductIds.size}
              </div>
            </div>

            {productsLoading ? (
              <div style={{ padding: "20px", textAlign: "center", color: T.textMuted }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Loading products...</div>
              </div>
            ) : products.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: T.textMuted }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>No products configured</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {products.filter(p => selectedProductIds.has(p.id)).map((p) => (
                  <div
                    key={p.id}
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.textDark }}>{p.name}</div>
                  </div>
                ))}
                {selectedProductIds.size === 0 && (
                  <div style={{ padding: "16px", textAlign: "center", color: T.textMuted, fontSize: 14, fontWeight: 600 }}>
                    No products selected for this carrier
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Carrier Info Summary */}
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
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: T.textDark }}>Additional Information</h2>
                  <p style={{ fontSize: 12, color: T.textMuted, margin: "4px 0 0" }}>Requirements, formats & limitations</p>
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
                {carrierInfo.length}
              </div>
            </div>

            {carrierInfoLoading ? (
              <div style={{ padding: "20px", textAlign: "center", color: T.textMuted }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Loading information...</div>
              </div>
            ) : carrierInfo.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: T.textMuted }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>No additional information</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {GROUP_TYPES.map(groupType => {
                  const items = carrierInfo.filter(info => info.groupType === groupType);
                  if (items.length === 0) return null;
                  return (
                    <div key={groupType}>
                      <div style={{ 
                        fontSize: 12, 
                        fontWeight: 800, 
                        color: T.blue, 
                        marginBottom: 8,
                        padding: "4px 10px",
                        backgroundColor: T.blueFaint,
                        borderRadius: 6,
                        display: "inline-block"
                      }}>
                        {groupType}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {items.map((info) => (
                          <div
                            key={info.id}
                            style={{
                              padding: "12px 16px",
                              borderRadius: 10,
                              border: `1.5px solid ${T.borderLight}`,
                              backgroundColor: "#fafbfc",
                            }}
                          >
                            <div style={{ fontSize: 14, fontWeight: 600, color: T.textDark, lineHeight: 1.5 }}>
                              {info.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

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
            General Settings
          </button>
          <button 
            onClick={() => setActiveTab('additional')}
            style={{ 
              padding: "12px 4px", 
              border: "none", 
              borderBottom: `3px solid ${activeTab === 'additional' ? T.blue : 'transparent'}`, 
              background: "none", 
              color: activeTab === 'additional' ? T.blue : T.textMuted, 
              fontSize: 14, 
              fontWeight: 800, 
              cursor: "pointer" 
            }}
          >
            Additional Info
          </button>
        </div>

        <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 32, maxWidth: 820 }}>
          {activeTab === 'general' && (
          <>
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

           <div style={{ marginBottom: 24 }}>
             <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>State Appointment Requirement</label>
             <div 
               onClick={() => setRequiresStateAppointment(!requiresStateAppointment)}
               style={{
                 display: "flex",
                 alignItems: "center",
                 gap: 12,
                 padding: "12px 16px",
                 border: `1.5px solid ${requiresStateAppointment ? T.blue : T.border}`,
                 borderRadius: 8,
                 backgroundColor: requiresStateAppointment ? T.blueFaint : "#fff",
                 cursor: "pointer",
               }}
             >
               <div style={{
                 width: 20,
                 height: 20,
                 borderRadius: 4,
                 border: `2px solid ${requiresStateAppointment ? T.blue : T.border}`,
                 backgroundColor: requiresStateAppointment ? T.blue : "#fff",
                 display: "flex",
                 alignItems: "center",
                 justifyContent: "center",
               }}>
                 {requiresStateAppointment && (
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                     <path d="M20 6L9 17l-5-5" />
                   </svg>
                 )}
               </div>
               <div>
                 <div style={{ fontSize: 14, fontWeight: 700, color: T.textDark }}>
                   Requires State-Specific Appointment
                 </div>
                 <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                   Agents need specific state appointments for this carrier (e.g., Aetna). Uncheck for carriers that accept global state licenses (e.g., AMAM).
                 </div>
               </div>
             </div>
           </div>

           <div style={{ borderTop: `1.5px solid ${T.borderLight}`, paddingTop: 22, marginTop: 14 }}>
             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 14 }}>
               <div>
                 <div style={{ fontSize: 13, fontWeight: 900, color: T.textDark }}>Products</div>
                 <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, marginTop: 4 }}>
                   Select which product types are available for this carrier.
                 </div>
               </div>
               <div style={{ fontSize: 12, fontWeight: 800, color: T.blue, backgroundColor: T.blueFaint, padding: "4px 12px", borderRadius: 999 }}>
                 {selectedProductIds.size} selected
               </div>
             </div>

             <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
               <input
                 value={newProductName}
                 onChange={(e) => setNewProductName(e.target.value)}
                 placeholder="Add a new product (e.g. Preferred)"
                 style={{ flex: 1, padding: "12px 14px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 14, outline: "none", color: T.textDark, fontWeight: 600 }}
                 onKeyDown={(e) => {
                   if (e.key === "Enter") void handleAddProduct();
                 }}
               />
               <button
                 type="button"
                 onClick={() => void handleAddProduct()}
                 style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", color: T.textDark }}
               >
                 + Add
               </button>
             </div>

             <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
               {productsLoading ? (
                 <div style={{ gridColumn: "span 2", padding: "14px 12px", color: T.textMuted, fontWeight: 700, fontSize: 13 }}>
                   Loading products…
                 </div>
               ) : products.length === 0 ? (
                 <div style={{ gridColumn: "span 2", padding: "14px 12px", color: T.textMuted, fontWeight: 700, fontSize: 13 }}>
                   No products found. Add one above.
                 </div>
               ) : (
                 products.map((p) => {
                   const checked = selectedProductIds.has(p.id);
                   const isEditing = editingProductId === p.id;
                   return (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: `1.5px solid ${checked ? T.blue : T.border}`,
                          backgroundColor: checked ? T.blueFaint : "#fff",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleProduct(p.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            padding: 0,
                            flex: 1,
                            textAlign: "left",
                          }}
                          title="Toggle product"
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
                          {isEditing ? (
                            <input
                              value={editingProductName}
                              onChange={(e) => setEditingProductName(e.target.value)}
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                border: `1.5px solid ${T.border}`,
                                borderRadius: 10,
                                fontSize: 13,
                                fontWeight: 800,
                                outline: "none",
                                backgroundColor: "#fff",
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void saveEditedProduct();
                                if (e.key === "Escape") cancelEditProduct();
                              }}
                              autoFocus
                            />
                          ) : (
                            <div style={{ fontSize: 13, fontWeight: 800, color: T.textDark }}>{p.name}</div>
                          )}
                        </button>

                        {isEditing ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => void saveEditedProduct()}
                              style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditProduct}
                              style={{ background: "transparent", border: "none", color: T.textMuted, padding: "8px 6px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => startEditProduct(p)}
                              style={{ background: "transparent", border: "none", color: T.blue, padding: "6px 6px", cursor: "pointer", borderRadius: 8 }}
                              title="Rename product"
                              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = T.rowBg)}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent")}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteProduct(p.id)}
                              style={{ background: "transparent", border: "none", color: "#3b5229", padding: "6px 6px", cursor: "pointer", borderRadius: 8 }}
                              title="Delete product"
                              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#fef2f2")}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent")}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                   );
                 })
               )}
             </div>
           </div>

            <div style={{ display: "flex", gap: 12, paddingTop: 12, borderTop: `1.5px solid ${T.borderLight}` }}>
              <button onClick={handleSave} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Save Carrier</button>
              <button onClick={() => setView("list")} style={{ backgroundColor: "transparent", color: T.textMid, border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Cancel</button>
            </div>
          </>
          )}

          {activeTab === 'additional' && editingCarrierId && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: T.textDark }}>Carrier Additional Information</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, marginTop: 4 }}>
                    Manage carrier requirements, authorization formats, limitations, and other information.
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.blue, backgroundColor: T.blueFaint, padding: "4px 12px", borderRadius: 999 }}>
                  {carrierInfo.length} entries
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "flex-start" }}>
                <AppSelect
                  value={newInfoGroupType}
                  onChange={(e) => setNewInfoGroupType(e.target.value as CarrierInfo['groupType'])}
                  style={{ 
                    minWidth: 200, 
                    padding: "12px 14px", 
                    border: `1.5px solid ${T.border}`, 
                    borderRadius: 10, 
                    fontSize: 14, 
                    outline: "none", 
                    color: T.textDark, 
                    fontWeight: 600,
                    backgroundColor: "#fff",
                    cursor: "pointer"
                  }}
                >
                  {GROUP_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </AppSelect>
                <textarea
                  value={newInfoDescription}
                  onChange={(e) => setNewInfoDescription(e.target.value)}
                  placeholder="Enter description..."
                  rows={3}
                  style={{ 
                    flex: 1, 
                    padding: "12px 14px", 
                    border: `1.5px solid ${T.border}`, 
                    borderRadius: 10, 
                    fontSize: 14, 
                    outline: "none", 
                    color: T.textDark, 
                    fontWeight: 600,
                    resize: "vertical",
                    fontFamily: "inherit"
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.metaKey) void handleAddCarrierInfo();
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleAddCarrierInfo()}
                  style={{ 
                    backgroundColor: T.blue, 
                    color: "#fff",
                    border: "none", 
                    borderRadius: 10, 
                    padding: "12px 16px", 
                    fontSize: 13, 
                    fontWeight: 800, 
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  + Add Entry
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {carrierInfoLoading ? (
                  <div style={{ padding: "14px 12px", color: T.textMuted, fontWeight: 700, fontSize: 13 }}>
                    Loading carrier information…
                  </div>
                ) : carrierInfo.length === 0 ? (
                  <div style={{ padding: "14px 12px", color: T.textMuted, fontWeight: 700, fontSize: 13 }}>
                    No additional information found. Add an entry above.
                  </div>
                ) : (
                  carrierInfo.map((info) => {
                    const isEditing = editingInfoId === info.id;
                    return (
                      <div
                        key={info.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          padding: "14px 16px",
                          borderRadius: 12,
                          border: `1.5px solid ${T.border}`,
                          backgroundColor: "#fff",
                        }}
                      >
                        <div style={{ 
                          minWidth: 180, 
                          padding: "6px 12px", 
                          backgroundColor: T.blueFaint, 
                          borderRadius: 8, 
                          fontSize: 12, 
                          fontWeight: 700, 
                          color: T.blue,
                          textAlign: "center"
                        }}>
                          {info.groupType}
                        </div>
                        
                        <div style={{ flex: 1 }}>
                          {isEditing ? (
                            <>
                              <AppSelect
                                value={editingInfoGroupType}
                                onChange={(e) => setEditingInfoGroupType(e.target.value as CarrierInfo['groupType'])}
                                style={{ 
                                  width: "100%",
                                  marginBottom: 8,
                                  padding: "8px 10px", 
                                  border: `1.5px solid ${T.border}`, 
                                  borderRadius: 8, 
                                  fontSize: 13, 
                                  fontWeight: 600, 
                                  outline: "none",
                                  backgroundColor: "#fff"
                                }}
                              >
                                {GROUP_TYPES.map(type => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </AppSelect>
                              <textarea
                                value={editingInfoDescription}
                                onChange={(e) => setEditingInfoDescription(e.target.value)}
                                rows={3}
                                style={{
                                  width: "100%",
                                  padding: "8px 10px",
                                  border: `1.5px solid ${T.border}`,
                                  borderRadius: 10,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  outline: "none",
                                  resize: "vertical",
                                  fontFamily: "inherit"
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && e.metaKey) void saveEditedCarrierInfo();
                                  if (e.key === "Escape") cancelEditCarrierInfo();
                                }}
                                autoFocus
                              />
                            </>
                          ) : (
                            <div style={{ fontSize: 14, fontWeight: 600, color: T.textDark, lineHeight: 1.5 }}>
                              {info.description}
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void saveEditedCarrierInfo()}
                                style={{ 
                                  background: T.blue, 
                                  color: "#fff",
                                  border: "none", 
                                  borderRadius: 8, 
                                  padding: "8px 12px", 
                                  fontSize: 12, 
                                  fontWeight: 800, 
                                  cursor: "pointer" 
                                }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditCarrierInfo}
                                style={{ 
                                  background: "transparent", 
                                  border: "none", 
                                  color: T.textMuted, 
                                  padding: "8px 10px", 
                                  fontSize: 12, 
                                  fontWeight: 800, 
                                  cursor: "pointer" 
                                }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditCarrierInfo(info)}
                                style={{ 
                                  background: "transparent", 
                                  border: "none", 
                                  color: T.blue, 
                                  padding: "8px", 
                                  cursor: "pointer", 
                                  borderRadius: 6 
                                }}
                                title="Edit entry"
                                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = T.rowBg)}
                                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent")}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteCarrierInfo(info.id)}
                                style={{ 
                                  background: "transparent", 
                                  border: "none", 
                                  color: "#3b5229", 
                                  padding: "8px", 
                                  cursor: "pointer", 
                                  borderRadius: 6 
                                }}
                                title="Delete entry"
                                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#fef2f2")}
                                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent")}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <path d="M10 11v6" />
                                  <path d="M14 11v6" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, paddingTop: 12, borderTop: `1.5px solid ${T.borderLight}` }}>
              <button onClick={() => setView("list")} style={{ backgroundColor: "transparent", color: T.textMid, border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Back to Carriers</button>
            </div>
          </>
          )}

          {activeTab === 'additional' && !editingCarrierId && (
            <div style={{ padding: "20px", textAlign: "center", color: T.textMuted }}>
              <p style={{ fontSize: 14, fontWeight: 600 }}>Please save the carrier first before adding additional information.</p>
              <button onClick={() => setActiveTab('general')} style={{ marginTop: 12, backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                Go to General Settings
              </button>
            </div>
          )}
         </div>
       </div>
     );
  }

  return (
    <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          [
            { label: "Total Carriers", value: carriers.length.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              ) },
            { label: "Requires Appointment", value: carriers.filter(c => c.requiresStateAppointment).length.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              ) },
            { label: "Standard Carriers", value: carriers.filter(c => !c.requiresStateAppointment).length.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              ) },
            { label: "This Month", value: carriers.length.toString(), color: "#233217", icon: (
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
                placeholder="Search carriers..."
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
              type="button"
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
              onClick={() => { setShowCreateModal(true); setNewCarrierName(""); setCreateError(null); }}
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
              Add Carrier
            </button>
          </div>
        </div>

        {(filterPanelExpanded || hasActiveFilters) && (
          <div
            style={{
              width: "100%",
              background: T.cardBg,
              border: `1px solid ${T.border}`,
              borderRadius: "0 0 16px 16px",
              padding: "20px 24px",
              boxShadow: T.shadowSm,
              display: "flex",
              flexDirection: "column",
              gap: 20,
              overflow: "visible",
              position: "relative",
              zIndex: 50,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Search</div>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <Search
                      size={16}
                      style={{ position: "absolute", left: 12, pointerEvents: "none", zIndex: 1, color: T.textMuted }}
                    />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search carriers..."
                      style={{
                        width: "100%",
                        height: 38,
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
              </div>

              {hasActiveFilters && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {search.trim() !== "" && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                        Search: {search}
                        <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={clearFilters}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#233217",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "4px 0",
                      transition: "all 0.15s ease-in-out",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = "underline";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = "none";
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            backgroundColor: T.cardBg,
            padding: "80px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <LoadingSpinner size={48} label="Loading carriers..." />
        </div>
      ) : (
        <DataGrid
          search={search}
          onSearchChange={(s) => { setSearch(s); setPage(1); }}
          searchPlaceholder="Search carriers..."
          noHeader
          style={{ borderRadius: 16, border: `1px solid ${T.border}`, overflow: "hidden" }}
          pagination={
            <div style={{
              backgroundColor: T.cardBg,
              borderTop: `1px solid ${T.border}`,
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ fontSize: 13, color: "#233217", fontWeight: 500 }}>
                Showing {filteredCarriers.length} of {carriers.length} carriers
              </span>
            </div>
          }
        >
          <div
            style={{
              borderRadius: "16px 16px 0 0",
              border: `1px solid ${T.border}`,
              borderBottom: "none",
              overflow: "hidden",
              backgroundColor: T.cardBg,
            }}
          >
            <ShadcnTable>
              <TableHeader style={{ backgroundColor: "#233217" }}>
                <TableRow style={{ borderBottom: "none" }} className="hover:bg-transparent">
                  {[
                    { label: "Carrier Name", align: "left" as const },
                    { label: "Added on", align: "left" as const },
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
                {paginatedCarriers.map((carrier) => (
                  <TableRow 
                    key={carrier.id}
                    onClick={() => handleOpenView(carrier)}
                    style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                    className="hover:bg-muted/30 transition-all duration-150"
                  >
                    <TableCell style={{ padding: "14px 20px" }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 500, color: T.textDark }}>
                          {carrier.name}
                        </span>
                        {carrier.requiresStateAppointment && (
                          <div style={{ fontSize: 11, color: "#233217", marginTop: 4, fontWeight: 600 }}>
                            Requires State Appointment
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell style={{ padding: "14px 20px" }}>
                      <span style={{ fontSize: 13, color: T.textMid, fontWeight: 400 }}>{carrier.createdAt}</span>
                    </TableCell>
                    <TableCell style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap" }}
                      >
                        <button 
                          onClick={() => handleOpenView(carrier)}
                          style={{ background: "none", border: "none", color: "#233217", cursor: "pointer", padding: 6, borderRadius: 6 }}
                          title="View Carrier"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button 
                          onClick={() => openEditModal(carrier)}
                          style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", padding: 6, borderRadius: 6 }}
                          title="Edit Carrier"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button 
                          onClick={() => openDeleteModal(carrier)}
                          style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 6, borderRadius: 6 }}
                          title="Delete Carrier"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </ShadcnTable>
          </div>
        </DataGrid>
      )}

      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Add Carrier</h2>
              <button
                onClick={() => setShowCreateModal(false)}
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
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Carrier name</label>
              <input
                type="text"
                value={newCarrierName}
                onChange={(e) => setNewCarrierName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCarrier();
                  if (e.key === 'Escape') setShowCreateModal(false);
                }}
                placeholder="Enter carrier name"
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
                onClick={() => setShowCreateModal(false)}
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
                onClick={handleCreateCarrier}
                disabled={!newCarrierName.trim() || creatingCarrier}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: newCarrierName.trim() && !creatingCarrier ? "#233217" : T.border,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: newCarrierName.trim() && !creatingCarrier ? "pointer" : "not-allowed",
                  boxShadow: newCarrierName.trim() && !creatingCarrier ? "0 4px 12px rgba(35, 50, 23, 0.2)" : "none",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                {creatingCarrier ? "Creating..." : "Add Carrier"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingCarrier && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Edit Carrier</h2>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Carrier name</label>
              <input
                type="text"
                value={editCarrierName}
                onChange={(e) => setEditCarrierName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUpdateCarrier();
                  if (e.key === 'Escape') setShowEditModal(false);
                }}
                placeholder="Enter carrier name"
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

            <div style={{ marginBottom: 20 }}>
              <div 
                onClick={() => setEditRequiresState(!editRequiresState)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  border: `1.5px solid ${editRequiresState ? "#233217" : T.border}`,
                  borderRadius: 10,
                  backgroundColor: editRequiresState ? "#DCEBDC" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  border: `2px solid ${editRequiresState ? "#233217" : T.border}`,
                  backgroundColor: editRequiresState ? "#233217" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {editRequiresState && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.textDark }}>
                    Requires State-Specific Appointment
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                    Agents need specific state appointments for this carrier
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowEditModal(false)}
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
                onClick={handleUpdateCarrier}
                disabled={!editCarrierName.trim()}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: editCarrierName.trim() ? "#233217" : T.border,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: editCarrierName.trim() ? "pointer" : "not-allowed",
                  boxShadow: editCarrierName.trim() ? "0 4px 12px rgba(35, 50, 23, 0.2)" : "none",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && deletingCarrier && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#dc2626" }}>Delete Carrier</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#991b1b", lineHeight: 1.6 }}>
                <strong>Warning:</strong> This will permanently delete <strong>"{deletingCarrier.name}"</strong>. This action cannot be undone.
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                Type <strong>{deletingCarrier.name}</strong> to confirm deletion
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteConfirmName === deletingCarrier.name) handleDeleteCarrier();
                  if (e.key === 'Escape') setShowDeleteModal(false);
                }}
                placeholder={deletingCarrier.name}
                autoFocus
                style={{
                  width: "100%",
                  height: 44,
                  border: `1.5px solid ${deleteConfirmName === deletingCarrier.name ? "#dc2626" : T.border}`,
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
                  e.currentTarget.style.borderColor = deleteConfirmName === deletingCarrier.name ? "#dc2626" : "#233217";
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${deleteConfirmName === deletingCarrier.name ? "rgba(220, 38, 38, 0.1)" : "rgba(35, 50, 23, 0.1)"}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = deleteConfirmName === deletingCarrier.name ? "#dc2626" : T.border;
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
                onClick={handleDeleteCarrier}
                disabled={deleteConfirmName !== deletingCarrier.name || deletingInProgress}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: deleteConfirmName === deletingCarrier.name && !deletingInProgress ? "#dc2626" : T.border,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: deleteConfirmName === deletingCarrier.name && !deletingInProgress ? "pointer" : "not-allowed",
                  boxShadow: deleteConfirmName === deletingCarrier.name && !deletingInProgress ? "0 4px 12px rgba(220, 38, 38, 0.2)" : "none",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                {deletingInProgress ? "Deleting..." : "Delete Carrier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
