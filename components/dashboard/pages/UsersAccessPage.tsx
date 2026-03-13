"use client";
import { useState } from "react";
import { T } from "@/lib/theme";

interface User { id:string; name:string; email:string; role:"Admin"|"Manager"|"Agent"|"Read-Only"; status:"Active"|"Inactive"|"Suspended"; color:string; lastActive:string; policies:number; }
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
  const [editRole, setEditRole] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<UserRole>("Agent");

  const filtered=users.filter(u=>(rf==="All"||u.role===rf)&&(!search||u.name.toLowerCase().includes(search.toLowerCase())||u.email.toLowerCase().includes(search.toLowerCase())));
  const toggle=(id:string)=>setUsers(p=>p.map(u=>u.id===id?{...u,status:u.status==="Active"?"Inactive":"Active"}:u));
  const changeRole=(uid:string,role:UserRole)=>{setUsers(p=>p.map(u=>u.id===uid?{...u,role}:u));setEditRole(null);};

  return(
    <div>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24}}>
        <div>
          <p style={{fontSize:13,color:T.textMuted,fontWeight:600,margin:"0 0 4px"}}>Team Management</p>
          <h1 style={{fontSize:26,fontWeight:800,color:T.textDark,margin:0}}>Users & Access</h1>
        </div>
        <button onClick={()=>setShowInvite(true)} style={{backgroundColor:T.blue,color:"#fff",border:"none",borderRadius:T.radiusMd,padding:"11px 22px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:T.font,display:"flex",alignItems:"center",gap:8}}>
          + Invite User
        </button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
        {[{l:"Total Users",v:users.length,c:T.blue},{l:"Active",v:users.filter(u=>u.status==="Active").length,c:"#16a34a"},{l:"Agents",v:users.filter(u=>u.role==="Agent").length,c:T.priorityHigh},{l:"Managers",v:users.filter(u=>u.role==="Manager").length,c:"#9333ea"}].map(({l,v,c})=>(
          <div key={l} style={{backgroundColor:T.cardBg,borderRadius:T.radiusLg,padding:"16px 20px",boxShadow:T.shadowSm}}>
            <p style={{margin:"0 0 4px",fontSize:12,color:T.textMuted,fontWeight:600}}>{l}</p>
            <p style={{margin:0,fontSize:26,fontWeight:800,color:c}}>{v}</p>
          </div>
        ))}
      </div>

      <div style={{backgroundColor:T.cardBg,borderRadius:T.radiusXl,boxShadow:T.shadowSm,overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:10,alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",gap:6}}>
            {(["All","Admin","Manager","Agent","Read-Only"] as const).map(r=>(
              <button key={r} onClick={()=>setRf(r)} style={{padding:"5px 14px",borderRadius:20,border:"none",cursor:"pointer",backgroundColor:rf===r?T.blue:T.rowBg,color:rf===r?"#fff":T.textMuted,fontSize:12,fontWeight:700,fontFamily:T.font,transition:"all 0.15s"}}>{r}</button>
            ))}
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users…" style={{padding:"7px 14px",border:`1.5px solid ${T.border}`,borderRadius:T.radiusSm,fontSize:13,fontFamily:T.font,color:T.textMid,width:200}}
            onFocus={e=>{e.currentTarget.style.borderColor=T.blue;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}
          />
        </div>

        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{backgroundColor:T.rowBg}}>
              {["User","Email","Role","Policies","Status","Last Active","Actions"].map(h=>(
                <th key={h} style={{padding:"10px 16px",fontSize:11,fontWeight:700,color:T.textMuted,textAlign:"left"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u,i)=>{
              const rc=ROLE_CFG[u.role];
              const isEditing=editRole===u.id;
              const dotColor=u.status==="Active"?"#16a34a":u.status==="Inactive"?"#ca8a04":"#dc2626";
              return(
                <tr key={u.id} style={{borderTop:`1px solid ${T.border}`,backgroundColor:i%2===0?T.cardBg:"#fafbfd"}}>
                  <td style={{padding:"12px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:34,height:34,borderRadius:"50%",backgroundColor:u.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:800,flexShrink:0}}>{u.name.split(" ").map(n=>n[0]).join("")}</div>
                      <span style={{fontSize:13,fontWeight:700,color:T.textDark}}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{padding:"12px 16px",fontSize:12,color:T.textMuted,fontWeight:600}}>{u.email}</td>
                  <td style={{padding:"12px 16px",position:"relative"}}>
                    <button onClick={()=>setEditRole(isEditing?null:u.id)} style={{backgroundColor:rc.bg,color:rc.color,border:"none",borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:T.font}}>
                      {u.role} ▾
                    </button>
                    {isEditing&&(
                      <div style={{position:"absolute",top:"100%",left:16,zIndex:100,backgroundColor:T.cardBg,border:`1px solid ${T.border}`,borderRadius:T.radiusMd,boxShadow:T.shadowLg,overflow:"hidden",minWidth:140,animation:"fadeInDown 0.14s ease"}}>
                        {(["Admin","Manager","Agent","Read-Only"] as UserRole[]).map(r=>(
                          <button key={r} onClick={()=>changeRole(u.id,r)} style={{display:"block",width:"100%",padding:"9px 14px",border:"none",background:r===u.role?T.blueFaint:"none",cursor:"pointer",fontFamily:T.font,fontSize:12,fontWeight:r===u.role?700:600,color:r===u.role?T.blue:T.textMid,textAlign:"left"}}>{r}</button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{padding:"12px 16px",fontSize:13,fontWeight:700,color:T.textDark}}>{u.policies}</td>
                  <td style={{padding:"12px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:7,height:7,borderRadius:"50%",backgroundColor:dotColor}}/>
                      <span style={{fontSize:12,fontWeight:600,color:T.textMid}}>{u.status}</span>
                    </div>
                  </td>
                  <td style={{padding:"12px 16px",fontSize:12,color:T.textMuted,fontWeight:600}}>{u.lastActive}</td>
                  <td style={{padding:"12px 16px"}}>
                    <button onClick={()=>toggle(u.id)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${T.border}`,background:"none",cursor:"pointer",fontFamily:T.font,fontSize:11,fontWeight:700,color:u.status==="Active"?T.danger:"#16a34a"}}>
                      {u.status==="Active"?"Deactivate":"Activate"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showInvite&&(
        <div onClick={()=>setShowInvite(false)} style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.35)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.15s ease"}}>
          <div onClick={e=>e.stopPropagation()} style={{backgroundColor:T.cardBg,borderRadius:T.radiusXl,padding:"36px",width:440,position:"relative",boxShadow:T.shadowXl,animation:"fadeInDown 0.18s ease"}}>
            <button onClick={()=>setShowInvite(false)} style={{position:"absolute",top:18,right:18,background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:18}}>✕</button>
            <h2 style={{margin:"0 0 24px",fontSize:20,fontWeight:800,color:T.textDark}}>Invite Team Member</h2>
            {[["Username","text","johnsmith"],["Email Address","email","john@example.com"]].map(([l,t,p])=>(
              <div key={l} style={{marginBottom:16}}>
                <label style={{display:"block",fontSize:13,fontWeight:700,color:T.textMuted,marginBottom:6}}>{l}</label>
                <input type={t} placeholder={p} style={{width:"100%",padding:"11px 14px",border:`1.5px solid ${T.border}`,borderRadius:T.radiusMd,fontSize:13,fontFamily:T.font,color:T.textMid,boxSizing:"border-box" as const,backgroundColor:T.rowBg}}
                  onFocus={e=>{e.currentTarget.style.borderColor=T.blue;e.currentTarget.style.backgroundColor="#fff";}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.backgroundColor=T.rowBg;}}
                />
              </div>
            ))}
            <div style={{marginBottom:24,marginTop:20}}>
              <label style={{display:"block",fontSize:13,fontWeight:700,color:T.textMuted,marginBottom:12}}>Select access role</label>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {([
                  { r:"Admin", d:"Full access to all CRM settings, billing, users, and pipelines." },
                  { r:"Manager", d:"Can oversee team members, configure deal pipelines, and manage groups." },
                  { r:"Agent", d:"Standard agent access. Can view assigned leads, deals, and daily tasks." },
                  { r:"Read-Only", d:"Can only view dashboards and reports. No edit permissions." }
                ] as const).map(({ r, d }) => {
                  const isSel = inviteRole === r;
                  return (
                    <div key={r} onClick={() => setInviteRole(r)} style={{
                      display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 16px",
                      border: `1.5px solid ${isSel ? T.blue : T.border}`, borderRadius: T.radiusLg,
                      backgroundColor: isSel ? "#f0f7ff" : "transparent", cursor: "pointer",
                      transition: "all 0.15s"
                    }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${isSel ? T.blue : T.border}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink: 0, marginTop: 2, backgroundColor: "#fff" }}>
                        {isSel && <div style={{width:10,height:10,borderRadius:"50%",backgroundColor:T.blue}}/>}
                      </div>
                      <div>
                        <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 800, color: isSel ? T.blue : T.textDark }}>{r}</p>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: isSel ? "#3b82f6" : T.textMuted, lineHeight: 1.4 }}>{d}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowInvite(false)} style={{flex:1,padding:"12px",borderRadius:T.radiusMd,border:`1.5px solid ${T.border}`,background:"none",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:T.font,color:T.textMuted,transition:"background-color 0.15s"}}
                onMouseEnter={(e)=>(e.currentTarget as HTMLElement).style.backgroundColor=T.rowBg}
                onMouseLeave={(e)=>(e.currentTarget as HTMLElement).style.backgroundColor="transparent"}
              >Cancel</button>
              <button onClick={()=>setShowInvite(false)} style={{flex:2,padding:"12px",borderRadius:T.radiusMd,border:"none",backgroundColor:T.blue,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:T.font,transition:"opacity 0.15s"}}
                onMouseEnter={(e)=>(e.currentTarget as HTMLElement).style.opacity="0.85"}
                onMouseLeave={(e)=>(e.currentTarget as HTMLElement).style.opacity="1"}
              >Send Invite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
