"use client";
import React, { useState, useEffect, useMemo } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Pagination } from "@/components/ui";
import {
  isUnlicensedSalesSubtype,
  UNLICENSED_SALES_SUBTYPE_LABELS,
  type UnlicensedSalesSubtype,
} from "@/lib/auth/unlicensedSalesSubtype";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    unlicensedSalesSubtype?: string | null;
  };
  onClose: () => void;
  onSubmit: (data: any) => void;
}

type TabType = "User Info" | "Roles & Permissions";

function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled = false,
  error = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(val) => onValueChange(val || "")} disabled={disabled}>
      <SelectTrigger
        style={{
          width: "100%",
          height: 42,
          borderRadius: 10,
          border: `1.5px solid ${error ? "#dc2626" : T.border}`,
          backgroundColor: disabled ? T.pageBg : "#fff",
          color: value ? T.textDark : T.textMuted,
          fontSize: 14,
          fontWeight: 600,
          paddingLeft: 14,
          paddingRight: 12,
          transition: "all 0.15s ease-in-out",
          boxShadow: error ? "0 0 0 3px rgba(220, 38, 38, 0.1)" : "none",
        }}
        className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
      >
        <SelectValue placeholder={placeholder}>
          {value
            ? options.find((o) => o.value === value)?.label || value
            : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        style={{
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          backgroundColor: "#fff",
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
              fontSize: 14,
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

export default function UserEditorComponent({ user, onClose, onSubmit }: UserEditorProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [activeTab, setActiveTab] = useState<TabType>("User Info");
  
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
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [centers, setCenters] = useState<BpoCenter[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(user?.roleId ?? "");
  const [selectedCenterId, setSelectedCenterId] = useState<string>("");
  const [unlicensedSalesSubtype, setUnlicensedSalesSubtype] = useState<"" | UnlicensedSalesSubtype>(() => {
    const s = user?.unlicensedSalesSubtype;
    return s && isUnlicensedSalesSubtype(s) ? s : "";
  });
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [rolePermissionIds, setRolePermissionIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [permissionsPage, setPermissionsPage] = useState(1);
  const permissionsPerPage = 12;

  const tabs: TabType[] = ["User Info", "Roles & Permissions"];

  const currentRole = roles.find(r => r.id === selectedRoleId);
  const isCallCenterRole = currentRole?.key === "call_center_admin" || currentRole?.key === "call_center_agent";
  const isUnlicensedSalesRole = currentRole?.key === "sales_agent_unlicensed";

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

      if (user?.roleId && !selectedRoleId) {
        setSelectedRoleId(user.roleId);
      }

      if (user?.id) {
        const { data: userRow } = await supabase
          .from("users")
          .select("call_center_id, unlicensed_sales_subtype")
          .eq("id", user.id)
          .maybeSingle();
        if (userRow?.call_center_id) {
          setSelectedCenterId(String(userRow.call_center_id));
        }
        const st = userRow?.unlicensed_sales_subtype;
        if (st && isUnlicensedSalesSubtype(st)) {
          setUnlicensedSalesSubtype(st);
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
    if (rolePermissionIds.has(id)) return;
    const next = new Set(selectedPermissions);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedPermissions(next);
  };

  const isUserInfoValid = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return false;
    if (!selectedRoleId) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    if (isCallCenterRole && !selectedCenterId) return false;
    if (isUnlicensedSalesRole && !unlicensedSalesSubtype) return false;
    return true;
  };

  const handleNext = () => {
    if (!isUserInfoValid()) return;
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
        const payload = {
          action: "update_user",
          user_id: user.id,
          full_name: fullName,
          phone,
          role_id: selectedRoleId,
          call_center_id: isCallCenterRole ? selectedCenterId : null,
          unlicensed_sales_subtype:
            isUnlicensedSalesRole && unlicensedSalesSubtype ? unlicensedSalesSubtype : null,
          permissions: Array.from(selectedPermissions),
        };
        const { data: result, error: invokeError } = await supabase.functions.invoke("manage_user_admin_v3", {
          body: payload,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (invokeError) {
          console.error("Edge function error:", invokeError);
          throw new Error(invokeError.message || "Failed to update user");
        }

        if (!result?.success) {
          console.error("Edge function result:", result);
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
        const payload = {
          email,
          full_name: fullName,
          phone,
          role_id: selectedRoleId,
          call_center_id: isCallCenterRole ? selectedCenterId : null,
          unlicensed_sales_subtype:
            isUnlicensedSalesRole && unlicensedSalesSubtype ? unlicensedSalesSubtype : null,
          permissions: Array.from(selectedPermissions),
        };

        const { data: result, error: invokeError } = await supabase.functions.invoke("create_user_auth_admin_v6", {
          body: payload,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        console.log("create_user_auth_admin_v6 response:", { invokeError, result });

        if (invokeError) {
          let errorDetail = "Failed to create user";
          const ctx = (invokeError as any).context;
          if (ctx && typeof ctx.json === 'function') {
            try {
              const json = await ctx.json();
              console.log("Error response JSON:", json);
              errorDetail = json.error || json.message || JSON.stringify(json);
            } catch {
              try {
                const text = await ctx.text();
                console.log("Error response text:", text);
                errorDetail = text;
              } catch {
                console.log("Could not read error response body");
              }
            }
          }
          console.error("Edge function invoke error:", invokeError);
          throw new Error(errorDetail);
        }

        if (!result?.success || !result?.user?.id) {
          console.error("Edge function result:", result);
          throw new Error(result?.error || result?.message || "Failed to create user");
        }

        onSubmit({
          id: result.user.id as string,
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

  const inputStyle = {
    width: "100%",
    height: 42,
    padding: "0 14px",
    border: `1.5px solid ${T.border}`,
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    color: T.textDark,
    fontFamily: T.font,
    backgroundColor: "#fff",
    outline: "none",
    transition: "all 0.15s ease-in-out",
  } as const;

  const labelStyle = {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "#233217",
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: "0.3px",
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out", color: T.textDark, backgroundColor: T.pageBg, minHeight: "100%", padding: "32px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={onClose}
            style={{
              background: "#fff",
              border: `1.5px solid ${T.border}`,
              borderRadius: "12px",
              width: 42,
              height: 42,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: T.textMid,
              transition: "all 0.15s ease-in-out",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#233217";
              e.currentTarget.style.color = "#233217";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.color = T.textMid;
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>Staff Management</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              <span style={{ fontSize: 13, color: "#233217", fontWeight: 700 }}>{user ? "Edit Profile" : "New Team Member"}</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{user ? `Managing ${user.name}` : "Team Member Onboarding"}</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.02)", border: `1.5px solid ${T.border}`, flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "8px 16px", borderBottom: `1px solid ${T.borderLight}` }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 20px",
                border: "none",
                borderRadius: 10,
                backgroundColor: activeTab === tab ? "#233217" : "transparent",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: activeTab === tab ? 700 : 600,
                color: activeTab === tab ? "#fff" : T.textMuted,
                transition: "all 0.15s ease-in-out",
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab) {
                  e.currentTarget.style.backgroundColor = "#EEF5EE";
                  e.currentTarget.style.color = "#233217";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = T.textMuted;
                }
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ padding: 40, flex: 1 }}>
          {activeTab === "User Info" && (
                <div style={{ animation: "fadeInUp 0.3s ease-out" }}>
                  <h3 style={{ margin: "0 0 32px", fontSize: 18, fontWeight: 800, color: T.textDark }}>Primary Identity</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
                    <div>
                      <label style={labelStyle}>Given Name <span style={{ color: "#dc2626" }}>*</span></label>
                      <input
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        placeholder="e.g. John"
                        style={inputStyle}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#233217";
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(35, 50, 23, 0.1)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = T.border;
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Family Name <span style={{ color: "#dc2626" }}>*</span></label>
                      <input
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        placeholder="e.g. Doe"
                        style={inputStyle}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#233217";
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(35, 50, 23, 0.1)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = T.border;
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <label style={labelStyle}>Email Address <span style={{ color: "#dc2626" }}>*</span></label>
                      <input
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="john@example.com"
                        style={inputStyle}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#233217";
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(35, 50, 23, 0.1)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = T.border;
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <label style={labelStyle}>Phone Number</label>
                      <input
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="e.g. (555) 123-4567"
                        style={inputStyle}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#233217";
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(35, 50, 23, 0.1)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = T.border;
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                    </div>
                  </div>

                  <h3 style={{ margin: "40px 0 32px", fontSize: 18, fontWeight: 800, color: T.textDark }}>Role & Organization</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                    <div>
                      <label style={labelStyle}>Access Role <span style={{ color: "#dc2626" }}>*</span></label>
                      <StyledSelect
                        value={selectedRoleId}
                        onValueChange={(v) => {
                          setSelectedRoleId(v);
                          const rk = roles.find((r) => r.id === v)?.key;
                          if (rk !== "sales_agent_unlicensed") setUnlicensedSalesSubtype("");
                          if (rk !== "call_center_admin" && rk !== "call_center_agent") setSelectedCenterId("");
                        }}
                        options={roles.map(r => ({ value: r.id, label: r.name }))}
                        placeholder="Select a role..."
                      />
                    </div>
                    {isCallCenterRole && (
                      <div>
                        <label style={labelStyle}>BPO Centre <span style={{ color: "#dc2626" }}>*</span></label>
                        <StyledSelect
                          value={selectedCenterId}
                          onValueChange={setSelectedCenterId}
                          options={centers.map(c => ({ value: c.id, label: c.name }))}
                          placeholder="Select a centre..."
                        />
                      </div>
                    )}
                    {isUnlicensedSalesRole && (
                      <div>
                        <label style={labelStyle}>Type <span style={{ color: "#dc2626" }}>*</span></label>
                        <StyledSelect
                          value={unlicensedSalesSubtype}
                          onValueChange={(v) => setUnlicensedSalesSubtype(v === "" ? "" : (v as UnlicensedSalesSubtype))}
                          options={(Object.keys(UNLICENSED_SALES_SUBTYPE_LABELS) as UnlicensedSalesSubtype[]).map((k) => ({
                            value: k,
                            label: UNLICENSED_SALES_SUBTYPE_LABELS[k],
                          }))}
                          placeholder="Select buffer or retention..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "Roles & Permissions" && (
                <div style={{ animation: "fadeInUp 0.3s ease-out" }}>
                  <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.textDark }}>Dynamic Permissions</h3>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#233217",
                      backgroundColor: "#DCEBDC",
                      padding: "4px 12px",
                      borderRadius: 20,
                    }}>
                      {selectedPermissionCount} selected
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                    {permissions
                      .slice((permissionsPage - 1) * permissionsPerPage, permissionsPage * permissionsPerPage)
                      .map(p => {
                      const isInherited = rolePermissionIds.has(p.id);
                      return (
                      <div
                        key={p.id}
                        onClick={() => togglePermission(p.id)}
                        style={{
                          padding: "16px 20px",
                          borderRadius: 12,
                          border: `1.5px solid ${selectedPermissions.has(p.id) ? "#233217" : T.border}`,
                          backgroundColor: selectedPermissions.has(p.id) ? "#EEF5EE" : "transparent",
                          cursor: isInherited ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          opacity: isInherited ? 0.85 : 1,
                          transition: "all 0.15s ease-in-out",
                        }}
                        onMouseEnter={(e) => {
                          if (!isInherited) {
                            e.currentTarget.style.borderColor = "#233217";
                            e.currentTarget.style.backgroundColor = selectedPermissions.has(p.id) ? "#EEF5EE" : "#f8f8f8";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isInherited) {
                            e.currentTarget.style.borderColor = selectedPermissions.has(p.id) ? "#233217" : T.border;
                            e.currentTarget.style.backgroundColor = selectedPermissions.has(p.id) ? "#EEF5EE" : "transparent";
                          }
                        }}
                      >
                        <div style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: `2px solid ${selectedPermissions.has(p.id) ? "#233217" : T.border}`,
                          backgroundColor: selectedPermissions.has(p.id) ? "#233217" : "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          {selectedPermissions.has(p.id) && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
                              <path d="M20 6L9 17l-5-5"/>
                            </svg>
                          )}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.textDark }}>{p.name}</p>
                          {isInherited && (
                            <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 600, color: T.textMuted }}>Inherited from role</p>
                          )}
                        </div>
                      </div>
                    )})}
                  </div>

                  {permissions.length > permissionsPerPage && (
                    <div style={{ marginTop: 20, width: "100%" }}>
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

            {/* Footer Actions */}
            <div style={{
              padding: "24px 40px",
              borderTop: `1.5px solid ${T.border}`,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}>
              {error && (
                <div style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 13,
                  color: "#991b1b",
                  fontWeight: 600,
                }}>
                  {error}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  style={{
                    height: 42,
                    padding: "0 20px",
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    backgroundColor: "#fff",
                    color: T.textDark,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading ? 0.6 : 1,
                    transition: "all 0.15s ease-in-out",
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.borderColor = "#233217";
                      e.currentTarget.style.color = "#233217";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.color = T.textDark;
                  }}
                >
                  Cancel
                </button>
                {activeTab !== "User Info" && (
                  <button
                    onClick={handleBack}
                    disabled={isLoading}
                    style={{
                      height: 42,
                      padding: "0 20px",
                      borderRadius: 10,
                      border: `1px solid ${T.border}`,
                      backgroundColor: "#fff",
                      color: T.textDark,
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: T.font,
                      cursor: isLoading ? "not-allowed" : "pointer",
                      opacity: isLoading ? 0.6 : 1,
                      transition: "all 0.15s ease-in-out",
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.borderColor = "#233217";
                        e.currentTarget.style.color = "#233217";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.color = T.textDark;
                    }}
                  >
                    Back
                  </button>
                )}
                {activeTab === tabs[tabs.length - 1] ? (
                  <button 
                    onClick={handleFinalSubmit}
                    disabled={!isUserInfoValid() || isLoading}
                    title={!isUserInfoValid() ? "Please fill in all required fields" : undefined}
                    style={{ 
                      height: 42,
                      padding: "0 24px",
                      borderRadius: 10,
                      border: "none",
                      backgroundColor: (isUserInfoValid() && !isLoading) ? "#233217" : T.border, 
                      color: "#fff", 
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: T.font,
                      cursor: (isUserInfoValid() && !isLoading) ? "pointer" : "not-allowed",
                      boxShadow: (isUserInfoValid() && !isLoading) ? "0 4px 12px rgba(35, 50, 23, 0.2)" : "none",
                      opacity: (isUserInfoValid() && !isLoading) ? 1 : 0.6,
                      transition: "all 0.15s ease-in-out",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    onMouseEnter={(e) => {
                      if (isUserInfoValid() && !isLoading) {
                        e.currentTarget.style.backgroundColor = "#1a260f";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isUserInfoValid() && !isLoading) {
                        e.currentTarget.style.backgroundColor = "#233217";
                      }
                    }}
                  >
                    {isLoading ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                          <circle cx="12" cy="12" r="10" style={{ opacity: 0.25 }} />
                          <path d="M12 2a10 10 0 0 1 0 20" />
                        </svg>
                        Saving...
                      </>
                    ) : "Finish Setup"}
                  </button>
                ) : (
                  <button 
                    onClick={handleNext}
                    disabled={!isUserInfoValid() || isLoading}
                    title={!isUserInfoValid() ? "Please fill in all required fields" : undefined}
                    style={{ 
                      height: 42,
                      padding: "0 24px",
                      borderRadius: 10,
                      border: "none",
                      backgroundColor: (isUserInfoValid() && !isLoading) ? "#233217" : T.border, 
                      color: "#fff", 
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: T.font,
                      cursor: (isUserInfoValid() && !isLoading) ? "pointer" : "not-allowed",
                      boxShadow: (isUserInfoValid() && !isLoading) ? "0 4px 12px rgba(35, 50, 23, 0.2)" : "none",
                      opacity: (isUserInfoValid() && !isLoading) ? 1 : 0.6,
                      transition: "all 0.15s ease-in-out",
                    }}
                    onMouseEnter={(e) => {
                      if (isUserInfoValid() && !isLoading) {
                        e.currentTarget.style.backgroundColor = "#1a260f";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isUserInfoValid() && !isLoading) {
                        e.currentTarget.style.backgroundColor = "#233217";
                      }
                    }}
                  >
                    Next Step
                  </button>
)}
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
