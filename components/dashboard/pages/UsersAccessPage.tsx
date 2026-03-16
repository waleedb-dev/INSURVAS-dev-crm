"use client";
import { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { Pagination } from "@/components/ui";
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
];

export default function UsersAccessPage(){
  const [users,setUsers]=useState(INIT);
  const [search,setSearch]=useState("");
  const [rf,setRf]=useState<UserRole|"All">("All");
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [inviteRole, setInviteRole] = useState<UserRole>("Agent");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;

  const filtered=users.filter(u=>(rf==="All"||u.role===rf)&&(!search||u.name.toLowerCase().includes(search.toLowerCase())||u.email.toLowerCase().includes(search.toLowerCase())));
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const toggle=(id:string)=>setUsers(p=>p.map(u=>u.id===id?{...u,status:u.status==="Active"?"Inactive":"Active"}:u));


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
    <div style={{ padding: "0 20px" }}>
      <div style={{ borderBottom: `1px solid ${T.borderLight}`, padding: "16px 0", marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: T.blue, margin: 0 }}>My Staff</h1>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginBottom: 24, alignItems: "center" }}>
        <select 
          value={rf} 
          onChange={e => setRf(e.target.value as any)}
          style={{ padding: "10px 16px", border: `1px solid ${T.border}`, borderRadius: "8px", fontSize: 14, color: T.textMuted, backgroundColor: "#fff", cursor: "pointer", outline: "none", width: 180 }}
        >
          <option value="All">User Role</option>
          {["Admin", "Manager", "Agent", "Read-Only"].map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <div style={{ position: "relative" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="name, email, phone, ids" 
            style={{ padding: "10px 12px 10px 36px", border: `1px solid ${T.border}`, borderRadius: "8px", fontSize: 14, color: T.textMuted, width: 240, outline: "none" }}
          />
        </div>

        <button 
          onClick={() => setShowInvite(true)} 
          style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Add User
        </button>
      </div>

      <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: `1px solid ${T.border}`, overflow: "hidden" }}>


        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{ backgroundColor: "#fafbfc", borderBottom: `1px solid ${T.border}` }}>
              {["Name", "Email", "Phone", "User Type", "Action"].map(h => (
                <th key={h} style={{ padding: "16px 20px", fontSize: 13, fontWeight: 700, color: T.textMuted, textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${T.borderLight}`, backgroundColor: "#fff" }}>
                <td style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: u.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                      {u.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.textDark }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ padding: "16px 20px" }}>
                  <div>
                    <div style={{ fontSize: 14, color: T.textDark, fontWeight: 500, marginBottom: 2 }}>{u.email}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.textMuted, fontSize: 12 }}>
                      {u.id}
                      <button title="Copy ID" style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "16px 20px", fontSize: 14, color: T.textMuted }}>{u.phone || "-"}</td>
                <td style={{ padding: "16px 20px" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>ACCOUNT-{u.role.toUpperCase()}</span>
                </td>
                <td style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", gap: 16 }}>
                    <button onClick={() => setEditingUser(u)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted }} title="Edit">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted }} title="Delete">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                    <button onClick={() => toggle(u.id)} style={{ background: "none", border: "none", cursor: "pointer", color: u.status === "Active" ? T.textMuted : T.danger }} title={u.status === "Active" ? "Disable" : "Enable"}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={page}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          itemLabel="users"
          onPageChange={setPage}
        />
      </div>


    </div>
  );
}
