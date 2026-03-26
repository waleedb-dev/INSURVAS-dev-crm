"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { Button, Input, Pagination, Table, DataGrid, EmptyState } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Carrier {
  id: string;
  name: string;
  createdAt: string;
}

interface Product {
  id: number;
  name: string;
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

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [newProductName, setNewProductName] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingProductName, setEditingProductName] = useState("");

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
    setProducts([]);
    setSelectedProductIds(new Set());
    setNewProductName("");
    setEditingProductId(null);
    setEditingProductName("");
    setView("edit");
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

        <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 32, maxWidth: 820 }}>
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
                              style={{ background: "transparent", border: "none", color: "#ef4444", padding: "6px 6px", cursor: "pointer", borderRadius: 8 }}
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

      <DataGrid
        search={search}
        onSearchChange={(s) => { setSearch(s); setPage(1); }}
        searchPlaceholder="Search Carriers"
        pagination={
          <Pagination
            page={currentPage}
            totalItems={filteredCarriers.length}
            itemsPerPage={itemsPerPage}
            itemLabel="carriers"
            onPageChange={setPage}
          />
        }
      >
        <Table
          data={paginatedCarriers}
          hoverEffect={false}
          onRowClick={(c) => handleOpenEdit(c)}
          columns={[
            {
              header: "Carrier Name",
              key: "name",
              render: (carrier) => (
                  <span style={{ fontWeight: 700, color: T.textDark }}>
                    {carrier.name}
                  </span>
              )
            },
            {
              header: "Added on",
              key: "createdAt",
              render: (carrier) => <span style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>{carrier.createdAt}</span>
            },
            {
              header: "Actions",
              key: "actions",
              align: "center",
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
          <EmptyState title="No carriers found" description="Add a carrier or adjust your search filters." compact />
        )}
      </DataGrid>
    </div>
  );
}
