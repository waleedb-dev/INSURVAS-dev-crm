"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/shadcn/table";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Search, Plus, Trash2 } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
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

export default function AnnouncementsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState<Announcement | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  async function fetchAnnouncements() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching announcements:", error.message);
        throw error;
      }

      setAnnouncements((data ?? []) as Announcement[]);
    } catch (error: any) {
      console.error("Error in fetchAnnouncements:", error?.message || error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  function openAddModal() {
    setNewTitle("");
    setNewDescription("");
    setAddError(null);
    setShowAddModal(true);
  }

  function openDeleteModal(item: Announcement) {
    setDeletingItem(item);
    setShowDeleteModal(true);
  }

  async function saveAnnouncement() {
    if (!newTitle.trim()) {
      setAddError("Title is required");
      return;
    }

    setSaving(true);
    setAddError(null);
    try {
      const { error } = await supabase
        .from("announcements")
        .insert([{
          title: newTitle.trim(),
          description: newDescription.trim() || null,
        }]);

      if (error) {
        throw error;
      } else {
        await fetchAnnouncements();
        setShowAddModal(false);
        setNewTitle("");
        setNewDescription("");
      }
    } catch (error: any) {
      console.error("Error saving announcement:", error);
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
        .from("announcements")
        .delete()
        .eq("id", deletingItem.id);

      await fetchAnnouncements();
      setShowDeleteModal(false);
      setDeletingItem(null);
    } catch (error) {
      console.error("Error deleting announcement:", error);
    } finally {
      setDeletingInProgress(false);
    }
  }

  const filtered = announcements.filter(item =>
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    item.description?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const thisMonthCount = announcements.filter(item => {
    const itemDate = new Date(item.created_at);
    const now = new Date();
    return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          [
            { label: "Total Announcements", value: announcements.length.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              ) },
            { label: "This Month", value: thisMonthCount.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ) },
            { label: "With Description", value: announcements.filter(a => a.description).length.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
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
                placeholder="Search announcements..."
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
              Add Announcement
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
            <LoadingSpinner size={48} label="Loading announcements..." />
          </div>
        ) : paginated.length === 0 ? (
          <div
            style={{
              padding: "60px 40px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>No announcements found</div>
            <div style={{ fontSize: 14, color: T.textMid }}>Add an announcement to get started.</div>
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
                      { label: "Title", align: "left" as const },
                      { label: "Description", align: "left" as const },
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
                        <span style={{ fontWeight: 600, color: T.textDark }}>{item.title}</span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 13, color: T.textMid, maxWidth: 300, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.description || "—"}
                        </span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 13, color: T.textMid, fontWeight: 400 }}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell style={{ padding: "12px 16px", textAlign: "center" }}>
                        <div
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, whiteSpace: "nowrap" }}
                        >
                          <button
                            onClick={() => openDeleteModal(item)}
                            style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 6, borderRadius: 6 }}
                            title="Delete Announcement"
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
                Showing {paginated.length} of {filtered.length} announcements
              </span>
            </div>
          </>
        )}
      </div>

      {/* Add Announcement Modal */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Add Announcement</h2>
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
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter announcement title..."
                style={{
                  width: "100%",
                  height: 44,
                  padding: "0 14px",
                  border: `1.5px solid ${T.border}`,
                  borderRadius: 10,
                  fontSize: 14,
                  color: T.textDark,
                  fontWeight: 500,
                  outline: "none",
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

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Description (Optional)</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Enter announcement description..."
                rows={4}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: `1.5px solid ${T.border}`,
                  borderRadius: 10,
                  fontSize: 14,
                  color: T.textDark,
                  fontWeight: 500,
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
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
                onClick={saveAnnouncement}
                disabled={saving || !newTitle.trim()}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: saving || !newTitle.trim() ? T.border : "#233217",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: saving || !newTitle.trim() ? "not-allowed" : "pointer",
                  boxShadow: saving || !newTitle.trim() ? "none" : "0 4px 12px rgba(35, 50, 23, 0.2)",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                {saving ? "Adding..." : "Add Announcement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Announcement Modal */}
      {showDeleteModal && deletingItem && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#dc2626" }}>Delete Announcement</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#991b1b", lineHeight: 1.6 }}>
                Are you sure you want to permanently delete the announcement <strong>&quot;{deletingItem.title}&quot;</strong>? This action cannot be undone.
              </p>
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
                {deletingInProgress ? "Deleting..." : "Delete Announcement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
