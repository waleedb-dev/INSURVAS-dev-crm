"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { T } from "@/lib/theme";
import { Button, Dropdown, Input, Pagination, Table, DataGrid, FilterChip, EmptyState, Toast } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface UserLink {
  id: string;
  name: string;
  roleKey: string | null;
  callCenterId: string | null;
}

interface CenterRow {
  id: string;
  name: string;
  createdAt: string;
  did: string | null;
  slack_channel: string | null;
  email: string | null;
  logo_url: string | null;
  admin: UserLink | null;
  agentCount: number;
}

interface CenterDetail extends CenterRow {
  agents: UserLink[];
}

/** Up to 3 letters from the first word of the centre name (e.g. "Sellers-BPO" → "SEL"). */
function centreNameInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const firstWord = (trimmed.split(/[\s\-–—]+/)[0] ?? trimmed).replace(/[^a-zA-Z0-9]/g, "");
  if (firstWord.length > 0) {
    return firstWord.slice(0, 3).toUpperCase();
  }
  return trimmed.charAt(0).toUpperCase();
}

export default function BpoCentersPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [centers, setCenters] = useState<CenterRow[]>([]);
  const [users, setUsers] = useState<UserLink[]>([]);
  const [roleIds, setRoleIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newCenterName, setNewCenterName] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCenter, setSelectedCenter] = useState<CenterDetail | null>(null);
  const [editingCenterName, setEditingCenterName] = useState("");
  const [view, setView] = useState<"list" | "edit">("list");
  const [selectedAdminUserId, setSelectedAdminUserId] = useState("");
  const [selectedAgentUserId, setSelectedAgentUserId] = useState("");
  const [filterAdmin, setFilterAdmin] = useState<"All" | "Assigned" | "Unassigned">("All");
  const itemsPerPage = 10;
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function buildCenterDetail(centerId: string, sourceCenters = centers, sourceUsers = users): CenterDetail | null {
    const center = sourceCenters.find((item) => item.id === centerId);
    if (!center) return null;

    return {
      ...center,
      agents: sourceUsers.filter(
        (user) => user.callCenterId === centerId && user.roleKey === "call_center_agent",
      ),
    };
  }

  async function fetchDirectory() {
    const [{ data: rolesData, error: rolesError }, { data: centersData, error: centersError }, { data: usersData, error: usersError }] = await Promise.all([
      supabase.from("roles").select("id, key"),
      supabase.from("call_centers").select("id, name, created_at, did, slack_channel, email, logo_url").order("name"),
      supabase.from("users").select("id, full_name, call_center_id, role_id"),
    ]);

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
    }
    if (centersError) {
      console.error("Error fetching centers:", centersError);
    }
    if (usersError) {
      console.error("Error fetching call center users:", usersError);
    }

    const roleIdMap = Object.fromEntries((rolesData ?? []).map((role) => [role.key, role.id]));
    const roleKeyById = Object.fromEntries((rolesData ?? []).map((role) => [role.id, role.key]));
    const normalizedUsers: UserLink[] = (usersData ?? []).map((user) => ({
      id: user.id,
      name: user.full_name?.trim() || `User ${user.id.slice(0, 8)}`,
      roleKey: user.role_id ? roleKeyById[user.role_id] ?? null : null,
      callCenterId: user.call_center_id,
    }));

    const centerRows: CenterRow[] = (centersData ?? []).map((center) => {
      const admin = normalizedUsers.find(
        (user) => user.callCenterId === center.id && user.roleKey === "call_center_admin",
      ) ?? null;
      const agents = normalizedUsers.filter(
        (user) => user.callCenterId === center.id && user.roleKey === "call_center_agent",
      );

      return {
        id: center.id,
        name: center.name,
        createdAt: new Date(center.created_at).toLocaleString(),
        did: center.did ?? null,
        slack_channel: center.slack_channel ?? null,
        email: center.email ?? null,
        logo_url: center.logo_url ?? null,
        admin,
        agentCount: agents.length,
      };
    });

    setRoleIds(roleIdMap);
    setUsers(normalizedUsers);
    setCenters(centerRows);

    if (selectedCenter && view === "edit" && selectedCenter.id !== 'new') {
      const refreshed = buildCenterDetail(selectedCenter.id, centerRows, normalizedUsers);
      setSelectedCenter(refreshed);
      setEditingCenterName(refreshed?.name ?? "");
      setLogoUrl(refreshed?.logo_url ?? null);
    }

    setLoading(false);
  }

  useEffect(() => {
    setPage(1);
  }, [search, filterAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDirectory();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function handleOpenCreate() {
    setSelectedCenter({
      id: "new",
      name: "",
      createdAt: "",
      did: "",
      slack_channel: "",
      email: "",
      logo_url: null,
      admin: null,
      agentCount: 0,
      agents: []
    } as any);
    setEditingCenterName("");
    setLogoUrl(null);
    setView("edit");
  }

  async function handleCreateCenter() {
    const trimmed = editingCenterName.trim();
    if (!trimmed) return;

    const { error } = await supabase.from("call_centers").insert([{
      name: trimmed,
      did: selectedCenter?.did?.trim() || null,
      slack_channel: selectedCenter?.slack_channel?.trim() || null,
      email: selectedCenter?.email?.trim() || null,
      logo_url: logoUrl || selectedCenter?.logo_url || null,
    }]);
    if (error) {
      console.error("Error creating center:", error);
      return;
    }

    setEditingCenterName("");
    setLogoUrl(null);
    setSelectedCenter(null);
    setView("list");
    await fetchDirectory();
  }

  async function handleDeleteCenter(centerId: string) {
    const linkedUsers = users.filter((user) => user.callCenterId === centerId);
    if (linkedUsers.length > 0) {
      const { error: unlinkError } = await supabase
        .from("users")
        .update({ call_center_id: null })
        .eq("call_center_id", centerId);

      if (unlinkError) {
        console.error("Error unlinking center users:", unlinkError);
        return;
      }
    }

    const { error } = await supabase.from("call_centers").delete().eq("id", centerId);
    if (error) {
      console.error("Error deleting center:", error);
      return;
    }

    if (selectedCenter?.id === centerId) {
      setSelectedCenter(null);
      setView("list");
    }
    await fetchDirectory();
  }

  async function handleRenameCenter() {
    if (!selectedCenter || !editingCenterName.trim()) return;

    const { error } = await supabase
      .from("call_centers")
      .update({
        name: editingCenterName.trim(),
        did: selectedCenter.did?.trim() || null,
        slack_channel: selectedCenter.slack_channel?.trim() || null,
        email: selectedCenter.email?.trim() || null,
        logo_url: logoUrl || selectedCenter.logo_url || null,
      })
      .eq("id", selectedCenter.id);

    if (error) {
      console.error("Error updating center:", error);
      setToast({ message: `Failed to save centre changes: ${error.message}`, type: "error" });
      return;
    }

    setToast({ message: "Centre updated successfully.", type: "success" });
    await fetchDirectory();
  }

  async function handleAssignAdmin() {
    if (!selectedCenter || !selectedAdminUserId || !roleIds.call_center_admin) return;

    const operations = [];
    if (selectedCenter.admin && selectedCenter.admin.id !== selectedAdminUserId) {
      operations.push(
        supabase
          .from("users")
          .update({ call_center_id: null })
          .eq("id", selectedCenter.admin.id),
      );
    }

    operations.push(
      supabase
        .from("users")
        .update({
          role_id: roleIds.call_center_admin,
          call_center_id: selectedCenter.id,
        })
        .eq("id", selectedAdminUserId),
    );

    const results = await Promise.all(operations);
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      console.error("Error assigning center admin:", failed.error);
      return;
    }

    setSelectedAdminUserId("");
    await fetchDirectory();
  }

  async function handleRemoveAdmin() {
    if (!selectedCenter?.admin) return;

    const { error } = await supabase
      .from("users")
      .update({ call_center_id: null })
      .eq("id", selectedCenter.admin.id);

    if (error) {
      console.error("Error removing center admin:", error);
      return;
    }

    await fetchDirectory();
  }

  async function handleAddAgent() {
    if (!selectedCenter || !selectedAgentUserId || !roleIds.call_center_agent) return;

    const { error } = await supabase
      .from("users")
      .update({
        role_id: roleIds.call_center_agent,
        call_center_id: selectedCenter.id,
      })
      .eq("id", selectedAgentUserId);

    if (error) {
      console.error("Error adding center agent:", error);
      return;
    }

    setSelectedAgentUserId("");
    await fetchDirectory();
  }

  async function handleRemoveAgent(userId: string) {
    const { error } = await supabase
      .from("users")
      .update({ call_center_id: null })
      .eq("id", userId);

    if (error) {
      console.error("Error removing center agent:", error);
      return;
    }

    await fetchDirectory();
  }

  const adminOptions = users
    .filter((user) => user.id !== selectedCenter?.admin?.id)
    .map((user) => ({
      value: user.id,
      label: `${user.name} (${user.id.slice(0, 8)})`,
    }));

  const agentOptions = users
    .filter((user) => user.callCenterId !== selectedCenter?.id || user.roleKey !== "call_center_agent")
    .filter((user) => user.id !== selectedCenter?.admin?.id)
    .map((user) => ({
      value: user.id,
      label: `${user.name} (${user.id.slice(0, 8)})`,
    }));

  const filteredCenters = centers.filter((center) => {
    const matchesSearch = center.name.toLowerCase().includes(search.toLowerCase());
    const matchesAdmin = filterAdmin === "All" ? true : filterAdmin === "Assigned" ? !!center.admin : !center.admin;
    return matchesSearch && matchesAdmin;
  });
  const totalPages = Math.max(1, Math.ceil(filteredCenters.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedCenters = filteredCenters.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  if (view === "edit" && selectedCenter) {
    const isNew = selectedCenter.id === 'new';

    return (
      <div style={{ padding: "0", animation: "fadeIn 0.4s ease-out" }}>
        {/* Header Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <button 
              onClick={() => setView("list")} 
              style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 12, color: T.textDark, cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                BPO Management <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6"/></svg> <span style={{ color: T.blue }}>{isNew ? "New Centre" : "Edit Centre"}</span>
              </div>
              <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                {isNew ? "BPO Centre Onboarding" : "Centre Configuration"}
              </h1>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {/* Removed Cancel and Save/Create buttons */}
          </div>
        </div>

        {/* Workspace Layout */}
        <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
          
          {/* Sidebar Profiler */}
          <div style={{ width: 320, backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 24, padding: 32, textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.03)" }}>
            <div style={{ position: "relative", width: 100, height: 100, margin: "0 auto 20px" }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", backgroundColor: T.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, overflow: "hidden", letterSpacing: "0.02em" }}>
                {logoUrl || selectedCenter?.logo_url ? (
                  <img src={logoUrl || selectedCenter?.logo_url || ""} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  centreNameInitials(editingCenterName)
                )}
                {logoUploading && (
                  <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>Uploading...</div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={async e => {
                  const file = e.target.files?.[0] || null;
                  if (!file) return;
                  setLogoUploading(true);
                  // Upload to Supabase Storage
                  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                  const uniqueName = `${Date.now()}_${crypto.randomUUID()}_${safeName}`;
                  const { data, error } = await supabase.storage
                    .from('bpo-logos')
                    .upload(`logos/${uniqueName}`, file, { upsert: false });
                  if (data) {
                    const { data: publicUrlData } = supabase.storage
                      .from('bpo-logos')
                      .getPublicUrl(data.path);
                    const publicUrl = publicUrlData.publicUrl;
                    setLogoUrl(publicUrl);
                    // Optionally update selectedCenter.logo_url for preview
                    setSelectedCenter(prev => prev ? { ...prev, logo_url: publicUrl } : prev);
                    if (selectedCenter?.id && selectedCenter.id !== "new") {
                      const { error: logoPersistError } = await supabase
                        .from("call_centers")
                        .update({ logo_url: publicUrl })
                        .eq("id", selectedCenter.id);
                      if (logoPersistError) {
                        setToast({ message: "Logo uploaded but failed to save to centre: " + logoPersistError.message, type: "error" });
                      }
                    }
                  } else if (error) {
                    setToast({ message: "Logo upload failed: " + error.message, type: "error" });
                  }
                  setLogoUploading(false);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ position: "absolute", bottom: 0, right: 0, width: 32, height: 32, backgroundColor: "#fff", borderRadius: "50%", border: `1.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", cursor: "pointer", padding: 0 }}
                title="Upload Logo"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </button>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px", color: T.textDark }}>{editingCenterName || "Unnamed Centre"}</h3>
            {/* Removed LOCATED AT and TOTAL AGENTS sections */}
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1, backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 24, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.03)" }}>
            
            {/* Tabs Header */}
            <div style={{ display: "flex", borderBottom: `1.5px solid ${T.border}`, padding: "0 20px" }}>
              {["Centre Info"].map((tab, i) => (
                <div key={tab} style={{ padding: "20px 24px", fontSize: 14, fontWeight: 800, color: T.blue, position: "relative", cursor: "pointer" }}>
                  {tab}
                  <div style={{ position: "absolute", bottom: -1.5, left: 0, right: 0, height: 3, backgroundColor: T.blue, borderRadius: "3px 3px 0 0" }} />
                </div>
              ))}
            </div>

            {/* Content Body */}
            <div style={{ padding: 40 }}>

              <div style={{ marginBottom: 40 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>CENTRE NAME *</label>
                    <input 
                      autoFocus
                      value={editingCenterName}
                      onChange={(e) => setEditingCenterName(e.target.value)}
                      placeholder="e.g. Islamabad North Hub"
                      style={{ width: "100%", padding: "14px 18px", border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 15, fontWeight: 600, outline: "none", backgroundColor: T.rowBg + "44", transition: "all 0.2s" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>DIRECT LINE (DID) *</label>
                    <input 
                      type="tel"
                      value={selectedCenter.did || ""}
                      onChange={e => setSelectedCenter({ ...selectedCenter, did: e.target.value.replace(/[^0-9+]/g, "") })}
                      placeholder="e.g. +15550000000"
                      style={{ width: "100%", padding: "14px 18px", border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 15, fontWeight: 600, outline: "none", backgroundColor: T.rowBg + "44", transition: "all 0.2s" }}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>SLACK CHANNEL *</label>
                    <input 
                      value={selectedCenter.slack_channel || ""}
                      onChange={e => setSelectedCenter({ ...selectedCenter, slack_channel: e.target.value })}
                      placeholder="#bpo-centre-slack"
                      style={{ width: "100%", padding: "14px 18px", border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 15, fontWeight: 600, outline: "none", backgroundColor: T.rowBg + "44", transition: "all 0.2s" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>EMAIL *</label>
                    <input 
                      type="email"
                      value={selectedCenter.email || ""}
                      onChange={e => setSelectedCenter({ ...selectedCenter, email: e.target.value })}
                      placeholder="centre@email.com"
                      style={{ width: "100%", padding: "14px 18px", border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 15, fontWeight: 600, outline: "none", backgroundColor: T.rowBg + "44", transition: "all 0.2s" }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
                  <button 
                    onClick={() => setView("list")}
                    style={{ marginRight: 16, padding: "12px 32px", borderRadius: 10, border: `1.5px solid ${T.border}`, backgroundColor: "#fff", color: T.textDark, fontSize: 14, fontWeight: 800, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={isNew ? handleCreateCenter : handleRenameCenter}
                    style={{ padding: "12px 32px", borderRadius: 10, border: "none", backgroundColor: T.blue, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 12px rgba(0,102,255,0.25)" }}
                  >
                    {isNew ? "Create Centre" : "Save Changes"}
                  </button>
                </div>
              </div>

              {/* Advanced Controls (Only for Existing) */}
              {/* Removed Manage Access section */}
            </div>
          </div>

        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px" }}>BPO Centres</h1>
          <p style={{ fontSize: 14, color: T.textMuted, fontWeight: 600 }}>Manage your call centers and BPO locations. Assign admins and link agents to specific centers.</p>
        </div>
        <button 
          onClick={handleOpenCreate} 
          style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: `0 4px 12px ${T.blue}44` }}
        >
          + Add Centre
        </button>
      </div>      <DataGrid
        search={search}
        onSearchChange={(s) => setSearch(s)}
        searchPlaceholder="Search Centres"
        filters={
          <select value={filterAdmin} onChange={(e) => setFilterAdmin(e.target.value as any)} style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}>
            <option value="All">All Admins</option>
            <option value="Assigned">Assigned</option>
            <option value="Unassigned">Unassigned</option>
          </select>
        }
        activeFilters={
          filterAdmin !== "All" && (
            <FilterChip label={`Admin: ${filterAdmin}`} onClear={() => setFilterAdmin("All")} />
          )
        }
        pagination={
          <Pagination
            page={currentPage}
            totalItems={filteredCenters.length}
            itemsPerPage={itemsPerPage}
            itemLabel="centres"
            onPageChange={setPage}
          />
        }
      >
        <Table
          data={paginatedCenters}
          onRowClick={(center) => {
            const detail = buildCenterDetail(center.id);
            if (detail) {
              setSelectedCenter(detail);
              setEditingCenterName(detail.name);
              setLogoUrl(detail.logo_url ?? null);
              setView("edit");
            }
          }}
          columns={[
            {
              header: "Centre Name",
              key: "name",
              render: (center) => <span style={{ fontWeight: 800, color: T.textDark }}>{center.name}</span>,
            },
            {
              header: "Admin User",
              key: "admin",
              render: (center) =>
                center.admin ? (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.textDark }}>{center.admin.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>{center.admin.id.slice(0, 8)}</div>
                  </div>
                ) : (
                  <span style={{ color: T.textMuted, fontWeight: 700 }}>Unassigned</span>
                ),
            },
            {
              header: "Agents",
              key: "agentCount",
              align: "center",
              render: (center) => <span style={{ fontWeight: 800, color: T.textMid }}>{center.agentCount}</span>,
            },
            {
              header: "Created",
              key: "createdAt",
              render: (center) => <span style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>{center.createdAt}</span>
            },
            {
              header: "Actions",
              key: "actions",
              align: "center",
              width: 100,
              render: (center) => (
                <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const detail = buildCenterDetail(center.id);
                      if (detail) {
                        setSelectedCenter(detail);
                        setEditingCenterName(detail.name);
                        setLogoUrl(detail.logo_url ?? null);
                        setView("edit");
                      }
                    }}
                    style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", padding: 6, borderRadius: 6 }} 
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = T.rowBg} 
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteCenter(center.id);
                    }}
                    style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 6, borderRadius: 6 }} 
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#fef2f2"} 
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              ),
            },
          ]}
        />

        {!loading && filteredCenters.length === 0 && (
          <EmptyState title="No centres found" description="Add a centre or adjust your search filters." compact />
        )}
      </DataGrid>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
