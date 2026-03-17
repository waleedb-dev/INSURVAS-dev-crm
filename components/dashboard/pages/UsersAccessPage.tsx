"use client";
import { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { Pagination, Table, DataGrid, FilterChip } from "@/components/ui";
import UserEditorComponent from "./UserEditorComponent";

interface User { id:string; name:string; email:string; role:string; status:"Active"|"Inactive"|"Suspended"; color:string; lastActive:string; policies:number; phone?:string; extension?:string; }
type UserRole = User["role"];
const ROLE_CFG:Record<UserRole,{bg:string;color:string}>={"Admin":{bg:"#fdf4ff",color:"#9333ea"},"Manager":{bg:T.blueLight,color:T.blue},"Agent":{bg:"#f0fdf4",color:"#16a34a"},"Read-Only":{bg:T.rowBg,color:T.textMuted}};
const INIT:User[]=[
  {id:"U-001",name:"Evan Yates",    email:"evan@unlimited-ins.com",   role:"Admin",    status:"Active",    color:"#4285f4",lastActive:"Just now",    policies:0},
  {id:"U-002",name:"Shawn Stone",   email:"shawn@unlimited-ins.com",  role:"Agent",    status:"Active",    color:"#4285f4",lastActive:"2 min ago",   policies:48},
  {id:"U-003",name:"Emily Tyler",   email:"emily@unlimited-ins.com",  role:"Agent",    status:"Active",    color:"#ec4899",lastActive:"5 min ago",   policies:62},
  {id:"U-004",name:"Louis Castro",  email:"louis@unlimited-ins.com",  role:"Manager",  status:"Active",    color:"#8b5cf6",lastActive:"12 min ago",  policies:91},
  {id:"U-005",name:"Blake Silva",   email:"blake@unlimited-ins.com",  role:"Agent",    status:"Active",    color:"#0ea5e9",lastActive:"30 min ago",  policies:74},
  {id:"U-006",name:"Randy Delgado", email:"randy@unlimited-ins.com",  role:"Agent",    status:"Active",    color:"#f59e0b",lastActive:"1 hr ago",    policies:28},
  {id:"U-007",name:"Joel Phillips", email:"joel@unlimited-ins.com",   role:"Agent",    status:"Inactive",  color:"#14b8a6",lastActive:"Yesterday",   policies:55},
  {id:"U-008",name:"Wayne Marsh",   email:"wayne@unlimited-ins.com",  role:"Agent",    status:"Active",    color:"#64748b",lastActive:"3 hrs ago",   policies:19},
  {id:"U-009",name:"Oscar Holloway",email:"oscar@unlimited-ins.com",  role:"Agent",    status:"Active",    color:"#f97316",lastActive:"20 min ago",  policies:67},
  {id:"U-010",name:"Diana Palmer",  email:"diana@unlimited-ins.com",  role:"Manager",  status:"Active",    color:"#ec4899",lastActive:"45 min ago",  policies:103},
  {id:"U-011",name:"Chris Morton",  email:"chris@unlimited-ins.com",  role:"Read-Only",status:"Suspended", color:"#64748b",lastActive:"2 weeks ago", policies:0},
  {id:"U-012",name:"User One",      email:"user1@unlimited-ins.com",  role:"Agent",    status:"Active",    color:T.blue,   lastActive:"Just now",    policies:0},
];

export default function UsersAccessPage(){
  const [users,setUsers]=useState(INIT);
  const [search,setSearch]=useState("");
  const [rf,setRf]=useState<UserRole|"All">("All");
  const [sf,setSf]=useState<User["status"]|"All">("All");
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [inviteRole, setInviteRole] = useState<UserRole>("Agent");
  const [page, setPage] = useState(1);
  const itemsPerPage = 12;

  const filtered=users.filter(u=>(rf==="All"||u.role===rf)&&(sf==="All"||u.status===sf)&&(!search||u.name.toLowerCase().includes(search.toLowerCase())||u.email.toLowerCase().includes(search.toLowerCase())));
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const toggle=(id:string)=>setUsers(p=>p.map(u=>u.id===id?{...u,status:u.status==="Active"?"Inactive":"Active"}:u));


  useEffect(() => {
    setPage(1);
  }, [rf, sf, search]);

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
        onSubmit={(data) => {
          if (editingUser) {
            setUsers(p => p.map(u => u.id === editingUser.id ? { ...u, name: `${data.firstName} ${data.lastName}`, email: data.email, phone: data.phone, extension: data.extension } : u));
          } else {
            const newUser: User = {
              id: `U-${String(users.length + 1).padStart(3, '0')}`,
              name: `${data.firstName} ${data.lastName}`,
              email: data.email,
              role: "Agent",
              status: "Active",
              color: T.blue,
              lastActive: "Just now",
              policies: 0,
              phone: data.phone,
              extension: data.extension
            };
            setUsers(p => [newUser, ...p]);
          }
          setShowInvite(false);
          setEditingUser(null);
        }}
      />
    );
  }

  return(
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>System Administration — {new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}</p>
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
        searchPlaceholder="Search by name, email, or ID…"
        filters={
          <>
            <select value={rf} onChange={(e) => setRf(e.target.value as any)} style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}>
              <option value="All">All Roles</option>
              {["Admin", "Manager", "Agent", "Read-Only"].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={sf} onChange={(e) => setSf(e.target.value as any)} style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}>
              <option value="All">All Statuses</option>
              {["Active", "Inactive", "Suspended"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </>
        }
        activeFilters={
          (rf !== "All" || sf !== "All") && (
            <>
              {rf !== "All" && <FilterChip label={`Role: ${rf}`} onClear={() => setRf("All")} />}
              {sf !== "All" && <FilterChip label={`Status: ${sf}`} onClear={() => setSf("All")} />}
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
              render: (u) => <span style={{ backgroundColor: ROLE_CFG[u.role].bg, color: ROLE_CFG[u.role].color, padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 800 }}>ACCOUNT-{u.role.toUpperCase()}</span>
            },
            {
              header: "Status",
              key: "status",
              render: (u) => (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: u.status === "Active" ? "#16a34a" : "#dc2626" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.textDark }}>{u.status}</span>
                </div>
              )
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
                  <button onClick={() => toggle(u.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = u.status === "Active" ? T.warning : T.success} onMouseLeave={e => e.currentTarget.style.color = T.textMuted}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  </button>
                  <button style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = T.danger} onMouseLeave={e => e.currentTarget.style.color = T.textMuted}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  </button>
                </div>
              )
            }
          ]}
        />
      </DataGrid>


    </div>
  );
}
