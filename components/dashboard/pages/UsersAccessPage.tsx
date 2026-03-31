"use client";
import { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { Pagination, Table, DataGrid, FilterChip, Toast, EmptyState } from "@/components/ui";
import { AppSelect } from "@/components/ui/app-select";
import UserEditorComponent from "./UserEditorComponent";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMemo } from "react";

interface User { id:string; name:string; email:string; role:string; roleId?:string; roleKey?:string; status:"Active"|"Inactive"|"Suspended"; color:string; lastActive:string; policies:number; phone?:string; extension?:string; }
const ROLE_CFG:Record<string,{bg:string;color:string}>={
  "system_admin":{bg:"#fdf4ff",color:"#9333ea"},
  "sales_manager":{bg:T.blueLight,color:T.blue},
  "sales_agent_licensed":{bg:"#f0fdf4",color:"#16a34a"},
  "Admin":{bg:"#fdf4ff",color:"#9333ea"},
  "Manager":{bg:T.blueLight,color:T.blue},
  "Agent":{bg:"#f0fdf4",color:"#16a34a"},
  "Read-Only":{bg:T.rowBg,color:T.textMuted}
};

const fetchUsers = async (supabaseClient: any) => {
  const { data, error } = await supabaseClient
    .from("users")
    .select(`
      id, 
      full_name, 
      email,
      phone,
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
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const refreshUsers = async () => {
    const userData = await fetchUsers(supabase);
    setUsers(userData);
  };

  const callAdminUserAction = async (body: Record<string, unknown>) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in. Please sign in again and retry.");
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
      if (rolesFromDb.length > 0) setDbRoles(rolesFromDb);
      await refreshUsers();
    }
    load();
  }, [rolesFromDb, supabase]);
  const [search,setSearch]=useState("");
  const [rf,setRf]=useState<string>("All");
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 12;

  const filtered=users.filter(u=>(rf==="All"||u.role===rf)&&(!search||u.name.toLowerCase().includes(search.toLowerCase())||u.id.toLowerCase().includes(search.toLowerCase())||(u.phone || "").toLowerCase().includes(search.toLowerCase())));
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleDeleteUser = async (u: User) => {
    const confirmed = window.confirm(`Delete user ${u.name}? This will remove auth access and cannot be undone.`);
    if (!confirmed) return;

    setIsActionLoading(true);
    try {
      await callAdminUserAction({ action: "delete_user", user_id: u.id });
      await refreshUsers();
      setToast({ message: "User deleted successfully", type: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to delete user",
        type: "error",
      });
    } finally {
      setIsActionLoading(false);
    }
  };


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
          // Refetch users from database to update list
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

  return(
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textDark, margin: 0 }}>My Staff & Access</h1>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowInvite(true); }}
            style={{
              backgroundColor: T.blue,
              color: "#fff",
              border: "none",
              borderRadius: T.radiusMd,
              padding: "10px 22px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: T.font,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s",
              boxShadow: `0 4px 12px ${T.blue}44`
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 6px 16px ${T.blue}66`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 4px 12px ${T.blue}44`; }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Add User
          </button>
        </div>
      </div>

      <DataGrid
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, phone, or ID..."
        filters={
          <>
            <AppSelect value={rf} onChange={(e: any) => setRf(e.target.value)} style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}>
              <option value="All">All Roles</option>
              {dbRoles.length > 0 ? dbRoles.map(r => <option key={r.id} value={r.name}>{r.name}</option>) : ["Admin", "Manager", "Agent", "Read-Only"].map(r => <option key={r} value={r}>{r}</option>)}
            </AppSelect>
          </>
        }
        activeFilters={
          (search.trim() !== "" || rf !== "All") && (
            <>
              {rf !== "All" && <FilterChip label={`Role: ${rf}`} onClear={() => setRf("All")} />}
              <button
                type="button"
                onClick={() => { setSearch(""); setRf("All"); setPage(1); }}
                style={{ background: "none", border: "none", color: T.blue, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "4px 8px", marginLeft: "auto" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.textDecoration = "underline")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.textDecoration = "none")}
              >
                Clear Filters
              </button>
            </>
          )
        }
        pagination={
          <Pagination
            page={page}
            totalItems={filtered.length}
            itemsPerPage={itemsPerPage}
            itemLabel="users"
            onPageChange={setPage}
          />
        }
      >
        <Table
          data={paginated}
          columns={[
            {
              header: "Name",
              key: "name",
              render: (u) => (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: u.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                    {u.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.textDark }}>{u.name}</span>
                </div>
              )
            },
            {
              header: "Email",
              key: "email",
              render: (u) => (
                <div>
                  <div style={{ fontSize: 13, color: T.textDark, fontWeight: 600, marginBottom: 2 }}>{u.email}</div>
                  <div style={{ color: T.textMuted, fontSize: 11, fontWeight: 600 }}>{u.id}</div>
                </div>
              )
            },
            {
              header: "Phone",
              key: "phone",
              render: (u) => <span style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>{u.phone || "—"}</span>
            },
             {
              header: "User Type",
              key: "role",
              render: (u) => <span style={{ backgroundColor: ROLE_CFG[u.role]?.bg || T.rowBg, color: ROLE_CFG[u.role]?.color || T.textMuted, padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 800 }}>{u.role.toUpperCase()}</span>
            },
            {
              header: "Actions",
              key: "actions",
              align: "center",
              render: (u) => (
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => setEditingUser(u)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = T.blue} onMouseLeave={e => e.currentTarget.style.color = T.textMuted}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button disabled={isActionLoading} onClick={() => handleDeleteUser(u)} style={{ background: "none", border: "none", cursor: isActionLoading ? "not-allowed" : "pointer", color: T.textMuted, transition: "color 0.2s", opacity: isActionLoading ? 0.5 : 1 }} onMouseEnter={e => e.currentTarget.style.color = T.danger} onMouseLeave={e => e.currentTarget.style.color = T.textMuted}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  </button>
                </div>
              )
            }
          ]}
        />
        {filtered.length === 0 && (
          <EmptyState title="No users found" description="Try a different search term or role filter." compact />
        )}
      </DataGrid>


      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
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
