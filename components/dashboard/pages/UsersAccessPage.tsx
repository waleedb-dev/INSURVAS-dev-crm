"use client";
import { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/shadcn/table";
import { AppSelect } from "@/components/ui/app-select";
import UserEditorComponent from "./UserEditorComponent";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMemo } from "react";
import { Search, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  roleId?: string;
  roleKey?: string;
  status: "Active" | "Inactive" | "Suspended";
  color: string;
  lastActive: string;
  policies: number;
  phone?: string;
  extension?: string;
  unlicensedSalesSubtype?: string | null;
}
const ROLE_CFG:Record<string,{bg:string;color:string}>={
  "system_admin":{bg:"#fdf4ff",color:"#9333ea"},
  "sales_manager":{bg:T.blueLight,color:T.blue},
  "sales_agent_licensed":{bg:"#f0fdf4",color:"#16a34a"},
  "Admin":{bg:"#fdf4ff",color:"#9333ea"},
  "Manager":{bg:T.blueLight,color:T.blue},
  "Agent":{bg:"#f0fdf4",color:"#16a34a"},
  "Read-Only":{bg:T.rowBg,color:T.textMuted}
};

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
          zIndex: 99999,
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

const fetchUsers = async (supabaseClient: any) => {
  const { data, error } = await supabaseClient
    .from("users")
    .select(`
      id, 
      full_name, 
      email,
      phone,
      unlicensed_sales_subtype,
      role:roles(name, key),
      role_id,
      status,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (data) {
    return data
    .map((u: any) => ({
      id: u.id,
      name: u.full_name || "Unnamed User",
      email: u.email || "",
      role: u.role?.name || "Agent",
      roleId: u.role_id,
      roleKey: u.role?.key,
      unlicensedSalesSubtype: u.unlicensed_sales_subtype ?? null,
      status: u.status === "active" ? "Active" : u.status === "inactive" ? "Inactive" : "Suspended",
      color: T.blue,
      lastActive: u.created_at ? new Date(u.created_at).toLocaleDateString() : "Just now",
      policies: 0,
      phone: u.phone || ""
    }))
    .filter((u: any) => u.roleKey !== "system_admin");
  }
  return [];
};

export default function UsersAccessPage(){
  const rolesFromDb = useRoles();
  const [dbRoles, setDbRoles] = useState<{id:string, name:string, key:string}[]>([]);
  const [users,setUsers]=useState<User[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [search,setSearch]=useState("");
  const [rf,setRf]=useState<string>("All");
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 12;
  
  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deletingInProgress, setDeletingInProgress] = useState(false);
  
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);
  
  const hasActiveFilters = rf !== "All";
  const activeFilterCount = rf !== "All" ? 1 : 0;
  
  const clearFilters = () => {
    setRf("All");
  };

  const refreshUsers = async () => {
    const userData = await fetchUsers(supabase);
    setUsers(userData);
  };

  const callAdminUserAction = async (body: Record<string, unknown>) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in. Please sign out and retry.");
    }

    const { data, error } = await supabase.functions.invoke("manage_user_admin_v3", {
      body,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) throw new Error(error.message || "User action failed");
    if (!data?.success) throw new Error(data?.error || data?.message || "User action failed");
    return data;
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      if (rolesFromDb.length > 0) setDbRoles(rolesFromDb);
      await refreshUsers();
      setLoading(false);
    }
    load();
  }, [rolesFromDb, supabase]);

  const filtered=users.filter(u=>(rf==="All"||u.role===rf)&&(!search||u.name.toLowerCase().includes(search.toLowerCase())||u.id.toLowerCase().includes(search.toLowerCase())||(u.phone || "").toLowerCase().includes(search.toLowerCase())));
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    
    setDeletingInProgress(true);
    try {
      await callAdminUserAction({ action: "delete_user", user_id: deletingUser.id });
      await refreshUsers();
      setShowDeleteModal(false);
      setDeletingUser(null);
      setToast({ message: "User deleted successfully", type: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to delete user",
        type: "error",
      });
    } finally {
      setDeletingInProgress(false);
    }
  };

  function openDeleteModal(u: User) {
    setDeletingUser(u);
    setDeleteConfirmName("");
    setShowDeleteModal(true);
  }

  useEffect(() => {
    setPage(1);
  }, [rf, search]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
    if (filtered.length === 0 && page !== 1) {
      setPage(1);
    }
  }, [filtered.length, page, totalPages]);

  if (showInvite || editingUser) {
    return (
      <UserEditorComponent
        user={editingUser || undefined}
        onClose={() => { setShowInvite(false); setEditingUser(null); }}
        onSubmit={async (data) => {
          await refreshUsers();
          setShowInvite(false);
          setEditingUser(null);
          setToast({
            message: data.isUpdate ? "Profile updated successfully" : "New user added successfully",
            type: "success"
          });
        }}
      />
    );
  }

  const roleOptions = dbRoles.length > 0 
    ? dbRoles.map(r => ({ value: r.name, label: r.name }))
    : ["Admin", "Manager", "Agent", "Read-Only"].map(r => ({ value: r, label: r }));

  const activeUsers = users.filter(u => u.status === "Active").length;
  const inactiveUsers = users.filter(u => u.status === "Inactive").length;
  const suspendedUsers = users.filter(u => u.status === "Suspended").length;

  return(
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          [
            { label: "Total Users", value: users.length.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              ) },
            { label: "Active Users", value: activeUsers.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              ) },
            { label: "Inactive Users", value: inactiveUsers.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              ) },
            { label: "This Month", value: users.filter(u => {
              const userDate = new Date(u.lastActive);
              const now = new Date();
              return userDate.getMonth() === now.getMonth() && userDate.getFullYear() === now.getFullYear();
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
            borderBottom: filterPanelExpanded || hasActiveFilters ? "none" : `1px solid ${T.border}`,
            borderRadius: filterPanelExpanded || hasActiveFilters ? "16px 16px 0 0" : 16,
            padding: "14px 20px",
            boxShadow: filterPanelExpanded || hasActiveFilters ? "none" : T.shadowSm,
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
                placeholder="Search by name, phone, or ID..."
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 20,
                  height: 20,
                  padding: "0 6px",
                  borderRadius: 999,
                  background: "#233217",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); setShowInvite(true); }}
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
              Add User
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Filter by role</div>
                  <StyledSelect
                    value={rf}
                    onValueChange={(val) => { setRf(val); setPage(1); }}
                    options={[{ value: "All", label: "All Roles" }, ...roleOptions]}
                    placeholder="All Roles"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {rf !== "All" && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                        Role: {rf}
                        <button onClick={() => setRf("All")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
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
            <LoadingSpinner size={48} label="Loading users..." />
          </div>
        ) : paginated.length === 0 ? (
          <div
            style={{
              padding: "60px 40px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>No users found</div>
            <div style={{ fontSize: 14, color: T.textMid }}>Try a different search term or role filter.</div>
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
                      { label: "Name", align: "left" as const },
                      { label: "Email", align: "left" as const },
                      { label: "Phone", align: "left" as const },
                      { label: "User Type", align: "left" as const },
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
                  {paginated.map((u) => (
                    <TableRow 
                      key={u.id}
                      style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                      className="hover:bg-muted/30 transition-all duration-150"
                    >
                      <TableCell style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: u.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                            {u.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 500, color: T.textDark }}>{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <div>
                          <div style={{ fontSize: 13, color: T.textDark, fontWeight: 500 }}>{u.email}</div>
                          <div style={{ color: T.textMuted, fontSize: 11 }}>{u.id}</div>
                        </div>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 13, color: T.textMid, fontWeight: 400 }}>{u.phone || "—"}</span>
                      </TableCell>
                      <TableCell style={{ padding: "14px 20px" }}>
                        {(() => {
                          const roleLabel =
                            u.roleKey === "sales_agent_unlicensed"
                              ? (() => {
                                  const sub = u.unlicensedSalesSubtype;
                                  const inner =
                                    sub === "buffer_agent"
                                      ? "Buffer agent"
                                      : sub === "retention_agent"
                                        ? "Retention agent"
                                        : "Unlicensed";
                                  return `SALES AGENT (${inner})`;
                                })()
                              : u.role.toUpperCase();
                          return (
                            <span
                              style={{
                                backgroundColor: ROLE_CFG[u.role]?.bg || T.rowBg,
                                color: ROLE_CFG[u.role]?.color || T.textMuted,
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 800,
                              }}
                            >
                              {roleLabel}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell style={{ padding: "12px 16px", textAlign: "center" }}>
                        <div
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, whiteSpace: "nowrap" }}
                        >
                          <button 
                            onClick={() => setEditingUser(u)}
                            style={{ background: "none", border: "none", color: "#233217", cursor: "pointer", padding: 6, borderRadius: 6 }}
                            title="Edit User"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button 
                            onClick={() => openDeleteModal(u)}
                            style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 6, borderRadius: 6 }}
                            title="Delete User"
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
                Showing {paginated.length} of {filtered.length} users
              </span>
            </div>
          </>
        )}
      </div>

      {/* Delete User Modal */}
      {showDeleteModal && deletingUser && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#dc2626" }}>Delete User</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#991b1b", lineHeight: 1.6 }}>
                <strong>Warning:</strong> This will permanently delete <strong>"{deletingUser.name}"</strong> and remove their access. This action cannot be undone.
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                Type <strong>{deletingUser.name}</strong> to confirm deletion
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteConfirmName === deletingUser.name) void handleDeleteUser();
                  if (e.key === 'Escape') setShowDeleteModal(false);
                }}
                placeholder={deletingUser.name}
                autoFocus
                style={{
                  width: "100%",
                  height: 44,
                  border: `1.5px solid ${deleteConfirmName === deletingUser.name ? "#dc2626" : T.border}`,
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
                  e.currentTarget.style.borderColor = deleteConfirmName === deletingUser.name ? "#dc2626" : "#233217";
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${deleteConfirmName === deletingUser.name ? "rgba(220, 38, 38, 0.1)" : "rgba(35, 50, 23, 0.1)"}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = deleteConfirmName === deletingUser.name ? "#dc2626" : T.border;
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
                onClick={handleDeleteUser}
                disabled={deleteConfirmName !== deletingUser.name || deletingInProgress}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: deleteConfirmName === deletingUser.name && !deletingInProgress ? "#dc2626" : T.border,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: deleteConfirmName === deletingUser.name && !deletingInProgress ? "pointer" : "not-allowed",
                  boxShadow: deleteConfirmName === deletingUser.name && !deletingInProgress ? "0 4px 12px rgba(220, 38, 38, 0.2)" : "none",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                {deletingInProgress ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          padding: "14px 20px",
          borderRadius: 12,
          backgroundColor: toast.type === "success" ? "#dcfce7" : "#fee2e2",
          border: `1px solid ${toast.type === "success" ? "#86efac" : "#fecaca"}`,
          color: toast.type === "success" ? "#166534" : "#991b1b",
          fontSize: 14,
          fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          zIndex: 3000,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: toast.type === "success" ? "#22c55e" : "#ef4444",
          }} />
          {toast.message}
          <button 
            onClick={() => setToast(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              marginLeft: 8,
              color: toast.type === "success" ? "#166534" : "#991b1b",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

function useRoles() {
  const [roles, setRoles] = useState<{id:string, name:string, key:string}[]>([]);
  const supabase = useMemo(() => {
    try {
      return getSupabaseBrowserClient();
    } catch(e) {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("roles").select("id, name, key").then(({ data }) => {
      if (data) setRoles(data.filter((r: any) => r.key !== "system_admin"));
    });
  }, [supabase]);

  return roles;
}