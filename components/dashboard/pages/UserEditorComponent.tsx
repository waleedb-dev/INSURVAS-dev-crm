"use client";
import React, { useState, useEffect, useMemo } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Pagination } from "@/components/ui";

interface Role { id: string; name: string; key: string; }
interface BpoCenter { id: string; name: string; }
interface Permission { id: string; name: string; key: string; }

interface UserEditorProps {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    roleId?: string;
    phone?: string;
  };
  onClose: () => void;
  onSubmit: (data: any) => void;
}

type TabType = "User Info" | "Roles & Permissions";

export default function UserEditorComponent({ user, onClose, onSubmit }: UserEditorProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [activeTab, setActiveTab] = useState<TabType>("User Info");
  
  // Identity State
  const [firstName, setFirstName] = useState(() => {
    if (!user?.name) return "";
    const parts = user.name.split(" ");
    return parts[0] || "";
  });
  const [lastName, setLastName] = useState(() => {
    if (!user?.name) return "";
    const parts = user.name.split(" ");
    return parts.slice(1).join(" ") || "";
  });
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  
  // Selection State
  const [roles, setRoles] = useState<Role[]>([]);
  const [centers, setCenters] = useState<BpoCenter[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(user?.roleId ?? "");
  const [selectedCenterId, setSelectedCenterId] = useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [rolePermissionIds, setRolePermissionIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Permissions pagination
  const [permissionsPage, setPermissionsPage] = useState(1);
  const permissionsPerPage = 10;

  const tabs: TabType[] = ["User Info", "Roles & Permissions"];

  const currentRole = roles.find(r => r.id === selectedRoleId);
  const isCallCenterRole = currentRole?.key === "call_center_admin" || currentRole?.key === "call_center_agent";

  const selectedPermissionCount = useMemo(() => {
    if (permissions.length === 0 || selectedPermissions.size === 0) return 0;
    const validIds = new Set(permissions.map((p) => p.id));
    let count = 0;
    selectedPermissions.forEach((id) => {
      if (validIds.has(id)) count += 1;
    });
    return count;
  }, [permissions, selectedPermissions]);

  useEffect(() => {
    setPermissionsPage(1);
  }, [activeTab, permissions.length, selectedRoleId]);

  useEffect(() => {
    async function fetchData() {
      const [{ data: rolesData }, { data: centersData }, { data: permissionsData }] = await Promise.all([
        supabase.from("roles").select("id, name, key").order("name"),
        supabase.from("call_centers").select("id, name").order("name"),
        supabase.from("permissions").select("id, key, description").order("key"),
      ]);
      if (rolesData) setRoles(rolesData);
      if (centersData) setCenters(centersData);
      if (permissionsData) setPermissions(permissionsData.map((p: any) => ({
        id: p.id,
        key: p.key,
        name: p.description || p.key
      })));

      // If editing an existing user, load their role and permissions initially
      if (user?.roleId && !selectedRoleId) {
        setSelectedRoleId(user.roleId);
      }

      // If editing an existing user, preselect their current BPO centre.
      // UsersAccessPage doesn't include call_center_id in its list query, so we fetch it here.
      if (user?.id) {
        const { data: userRow } = await supabase
          .from("users")
          .select("call_center_id")
          .eq("id", user.id)
          .maybeSingle();
        if (userRow?.call_center_id) {
          setSelectedCenterId(String(userRow.call_center_id));
        }
      }
    }
    fetchData();
  }, [supabase, user?.id, user?.roleId, selectedRoleId]);

  useEffect(() => {
    async function fetchEffectivePermissions() {
      if (!selectedRoleId) {
        setSelectedPermissions(new Set());
        return;
      }

      const [{ data: roleData }, { data: userData }] = await Promise.all([
        supabase.from("role_permissions").select("permission_id").eq("role_id", selectedRoleId),
        user?.id
          ? supabase.from("user_permissions").select("permission_id").eq("user_id", user.id)
          : Promise.resolve({ data: [] as { permission_id: string }[] }),
      ]);

      const roleSet = new Set<string>((roleData || []).map((rp: { permission_id: string }) => rp.permission_id));
      setRolePermissionIds(roleSet);

      const merged = new Set<string>([
        ...roleSet,
        ...(userData || []).map((up: { permission_id: string }) => up.permission_id),
      ]);

      setSelectedPermissions(merged);
    }

    fetchEffectivePermissions();
  }, [selectedRoleId, supabase, user?.id]);

  const togglePermission = (id: string) => {
    if (rolePermissionIds.has(id)) return; // inherited from role; not directly removable here
    const next = new Set(selectedPermissions);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedPermissions(next);
  };

  // Validation functions
  const isUserInfoValid = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return false;
    if (!selectedRoleId) return false;
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    // If call center role, center must be selected
    if (isCallCenterRole && !selectedCenterId) return false;
    return true;
  };

  const handleNext = () => {
    if (!isUserInfoValid()) return; // Prevent navigation if validation fails
    const idx = tabs.indexOf(activeTab);
    if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1]);
  };

  const handleBack = () => {
    const idx = tabs.indexOf(activeTab);
    if (idx > 0) setActiveTab(tabs[idx - 1]);
  };

  const handleFinalSubmit = async () => {
    if (!isUserInfoValid()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error("You are not logged in. Please sign in again and retry.");
      }
      
      if (user?.id) {
        // ── UPDATE EXISTING USER ──
        const { data: result, error: invokeError } = await supabase.functions.invoke("manage_user_admin_v3", {
          body: {
            action: "update_user",
            user_id: user.id,
            full_name: fullName,
            phone,
            role_id: selectedRoleId,
            call_center_id: isCallCenterRole ? selectedCenterId : null,
            permissions: Array.from(selectedPermissions),
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (invokeError) {
          throw new Error(invokeError.message || "Failed to update user");
        }

        if (!result?.success) {
          throw new Error(result?.error || result?.message || "Failed to update user");
        }

        onSubmit({
          id: user.id,
          firstName,
          lastName,
          email,
          phone,
          roleId: selectedRoleId,
          centerId: isCallCenterRole ? selectedCenterId : null,
            permissions: Array.from(selectedPermissions),
          isUpdate: true
        });
      } else {
        // ── CREATE NEW USER VIA EDGE FUNCTION ──
        // Call create_user_with_auth function which handles auth.users + public.users
        const payload = {
          email,
          full_name: fullName,
          phone,
          role_id: selectedRoleId,
          call_center_id: isCallCenterRole ? selectedCenterId : null,
          permissions: Array.from(selectedPermissions),
        };

        const { data: result, error: invokeError } = await supabase.functions.invoke("create_user_auth_admin_v6", {
          body: payload,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (invokeError) {
          throw new Error(invokeError.message || "Failed to create user");
        }

        if (!result?.success || !result?.user?.id) {
          throw new Error(result?.error || result?.message || "Failed to create user");
        }

        onSubmit({
          id: result.user.id,
          firstName,
          lastName,
          email,
          phone,
          roleId: selectedRoleId,
          centerId: isCallCenterRole ? selectedCenterId : null,
            permissions: Array.from(selectedPermissions).filter((id) => !rolePermissionIds.has(id)),
          isUpdate: false
        });
      }

      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save user";
      setError(message);
      console.error("User save error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = { width: "100%", padding: "12px 16px", border: `1px solid ${T.border}`, borderRadius: "8px", fontSize: 14, color: T.textDark, fontFamily: T.font, backgroundColor: "#fff", outline: "none", transition: "all 0.2s" };
  const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: T.textDark, marginBottom: 8 };

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out", color: T.textDark, backgroundColor: T.pageBg, minHeight: "100%", padding: "20px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={onClose} style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: "12px", width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.textMid }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>Staff Management</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              <span style={{ fontSize: 13, color: T.blue, fontWeight: 700 }}>{user ? "Edit Profile" : "New Team Member"}</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{user ? `Managing ${user.name}` : "Team Member Onboarding"}</h1>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        {/* Left Column Profile Card */}
        <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "24px", padding: "32px 24px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)", border: `1.5px solid ${T.border}`, textAlign: "center" }}>
            <div style={{ position: "relative", width: 100, height: 100, margin: "0 auto 20px" }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: `linear-gradient(135deg, ${T.blue} 0%, #444cf7 100%)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800, border: "4px solid #fff", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
                {(firstName[0] || "?")}{(lastName[0] || "")}
              </div>
            </div>
            <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>{firstName} {lastName}</h2>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: T.textMuted, fontWeight: 600 }}>{currentRole?.name || user?.role || "Position TBD"}</p>
            <div style={{ borderTop: `1.5px solid ${T.borderLight}`, paddingTop: 24, textAlign: "left" }}>
              <div style={{ marginBottom: 16 }}><p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Email Address</p><p style={{ margin: 0, fontSize: 13, fontWeight: 700, wordBreak: "break-all" }}>{email || "—"}</p></div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Phone</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{phone || "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column Tabbed Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "24px", padding: 0, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)", border: `1.5px solid ${T.border}`, minHeight: 650, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px", borderBottom: `1.5px solid ${T.borderLight}`, display: "flex", gap: 4 }}>
              {tabs.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "12px 20px", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: 13, fontWeight: activeTab === tab ? 800 : 600, backgroundColor: activeTab === tab ? T.blueFaint : "transparent", color: activeTab === tab ? T.blue : T.textMuted, transition: "all 0.2s" }}>{tab}</button>
              ))}
            </div>

            <div style={{ padding: 40, flex: 1 }}>
              {activeTab === "User Info" && (
                <div style={{ animation: "fadeInUp 0.3s ease-out" }}>
                  <h3 style={{ margin: "0 0 32px", fontSize: 18, fontWeight: 800 }}>Primary Identity</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
                    <div><label style={labelStyle}>Given Name <span style={{ color: T.danger }}>*</span></label><input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="e.g. John" style={inputStyle} /></div>
                    <div><label style={labelStyle}>Family Name <span style={{ color: T.danger }}>*</span></label><input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="e.g. Doe" style={inputStyle} /></div>
                    <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>Email Address <span style={{ color: T.danger }}>*</span></label><input value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" style={inputStyle} /></div>
                    <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>Phone Number</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. (555) 123-4567" style={inputStyle} /></div>
                  </div>
                  <h3 style={{ margin: "40px 0 32px", fontSize: 18, fontWeight: 800 }}>Role & Organization</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                    <div><label style={labelStyle}>Access Role <span style={{ color: T.danger }}>*</span></label>
                      <select value={selectedRoleId} onChange={e => setSelectedRoleId(e.target.value)} style={inputStyle as any}>
                        <option value="">Select a role...</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                    {isCallCenterRole && (
                      <div style={{ animation: "fadeInDown 0.2s" }}><label style={labelStyle}>BPO Centre <span style={{ color: T.danger }}>*</span></label>
                        <select value={selectedCenterId} onChange={e => setSelectedCenterId(e.target.value)} style={inputStyle as any}>
                          <option value="">Select a centre...</option>
                          {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "Roles & Permissions" && (
                <div style={{ animation: "fadeInUp 0.3s ease-out" }}>
                  <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Dynamic Permissions</h3>
                    <span style={{ fontSize: 12, fontWeight: 800, color: T.blue, backgroundColor: T.blueFaint, padding: "4px 12px", borderRadius: 20 }}>{selectedPermissionCount} selected</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                    {permissions
                      .slice((permissionsPage - 1) * permissionsPerPage, permissionsPage * permissionsPerPage)
                      .map(p => {
                      const isInherited = rolePermissionIds.has(p.id);
                      return (
                      <div key={p.id} onClick={() => togglePermission(p.id)} style={{ padding: "16px 20px", borderRadius: 12, border: `1.5px solid ${selectedPermissions.has(p.id) ? T.blue : T.border}`, backgroundColor: selectedPermissions.has(p.id) ? T.blueFaint : "transparent", cursor: isInherited ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 12, opacity: isInherited ? 0.85 : 1 }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selectedPermissions.has(p.id) ? T.blue : T.border}`, backgroundColor: selectedPermissions.has(p.id) ? T.blue : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {selectedPermissions.has(p.id) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4"><path d="M20 6L9 17l-5-5"/></svg>}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{p.name}</p>
                          {isInherited && <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 700, color: T.textMuted }}>Inherited from role</p>}
                        </div>
                      </div>
                    )})}
                  </div>

                  {permissions.length > permissionsPerPage && (
                    <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                      <Pagination
                        page={permissionsPage}
                        totalItems={permissions.length}
                        itemsPerPage={permissionsPerPage}
                        itemLabel="permissions"
                        onPageChange={setPermissionsPage}
                        hideSummary
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: "24px 40px", borderTop: `1.5px solid ${T.borderLight}`, display: "flex", flexDirection: "column", gap: 12 }}>
              {error && (
                <div style={{ backgroundColor: "#fee", border: `1px solid ${T.danger}`, borderRadius: T.radiusSm, padding: "12px 16px", fontSize: 13, color: T.danger }}>
                  {error}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button onClick={onClose} disabled={isLoading} style={{ backgroundColor: "transparent", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: isLoading ? "not-allowed" : "pointer", color: T.textMuted, opacity: isLoading ? 0.6 : 1 }}>Cancel</button>
                {activeTab !== "User Info" && <button onClick={handleBack} disabled={isLoading} style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.6 : 1 }}>Back</button>}
                {activeTab === tabs[tabs.length - 1] ? (
                  <button 
                    onClick={handleFinalSubmit}
                    disabled={!isUserInfoValid() || isLoading}
                    title={!isUserInfoValid() ? "Please fill in all required fields (Given Name, Family Name, Email, Access Role)" + (isCallCenterRole ? ", and BPO Center" : "") : undefined}
                    style={{ 
                      backgroundColor: (isUserInfoValid() && !isLoading) ? T.blue : T.border, 
                      color: "#fff", 
                      border: "none", 
                      borderRadius: T.radiusMd, 
                      padding: "10px 32px", 
                      fontSize: 13, 
                      fontWeight: 700, 
                      cursor: (isUserInfoValid() && !isLoading) ? "pointer" : "not-allowed",
                      boxShadow: (isUserInfoValid() && !isLoading) ? `0 4px 12px ${T.blue}44` : "none",
                      opacity: (isUserInfoValid() && !isLoading) ? 1 : 0.6,
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}
                  >
                    {isLoading && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" style={{ opacity: 0.25 }} /><path d="M12 2a10 10 0 0 1 0 20" style={{ animation: "spin 1s linear infinite" }} /></svg>}
                    {isLoading ? "Saving..." : "Finish Setup"}
                  </button>
                ) : (
                  <button 
                    onClick={handleNext}
                    disabled={!isUserInfoValid() || isLoading}
                    title={!isUserInfoValid() ? "Please fill in all required fields (Given Name, Family Name, Email, Access Role)" + (isCallCenterRole ? ", and BPO Center" : "") : undefined}
                    style={{ 
                      backgroundColor: (isUserInfoValid() && !isLoading) ? T.blue : T.border, 
                      color: "#fff", 
                      border: "none", 
                      borderRadius: T.radiusMd, 
                      padding: "10px 32px", 
                      fontSize: 13, 
                      fontWeight: 700, 
                      cursor: (isUserInfoValid() && !isLoading) ? "pointer" : "not-allowed",
                      boxShadow: (isUserInfoValid() && !isLoading) ? `0 4px 12px ${T.blue}44` : "none",
                      opacity: (isUserInfoValid() && !isLoading) ? 1 : 0.6,
                      transition: "all 0.2s"
                    }}
                  >
                    Next Step
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
