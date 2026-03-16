"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { Button, Dropdown, Input, Pagination, Table } from "@/components/ui";
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
  admin: UserLink | null;
  agentCount: number;
}

interface CenterDetail extends CenterRow {
  agents: UserLink[];
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
  const itemsPerPage = 10;

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
      supabase.from("call_centers").select("id, name, created_at").order("name"),
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
    }

    setLoading(false);
  }

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
      admin: null,
      agentCount: 0,
      agents: []
    } as any);
    setEditingCenterName("");
    setView("edit");
  }

  async function handleCreateCenter() {
    const trimmed = editingCenterName.trim();
    if (!trimmed) return;

    const { error } = await supabase.from("call_centers").insert([{ name: trimmed }]);
    if (error) {
      console.error("Error creating center:", error);
      return;
    }

    setEditingCenterName("");
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
      .update({ name: editingCenterName.trim() })
      .eq("id", selectedCenter.id);

    if (error) {
      console.error("Error updating center:", error);
      return;
    }

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

  const filteredCenters = centers.filter((center) =>
    center.name.toLowerCase().includes(search.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filteredCenters.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedCenters = filteredCenters.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  if (view === "edit" && selectedCenter) {
    return (
      <div style={{ animation: "fadeIn 0.3s ease-out" }}>
        <div style={{ marginBottom: 24 }}>
          <button 
            onClick={() => setView("list")} 
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: T.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to BPO Centres
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
              {selectedCenter.id === 'new' ? "Add New BPO Centre" : selectedCenter.name}
            </h1>
          </div>
        </div>

        <div style={{ display: "flex", gap: 32, borderBottom: `1.5px solid ${T.border}`, marginBottom: 24 }}>
          <button style={{ padding: "12px 4px", border: "none", borderBottom: `3px solid ${T.blue}`, background: "none", color: T.blue, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>General Settings</button>
          {selectedCenter.id !== 'new' && <button style={{ padding: "12px 4px", border: "none", background: "none", color: T.textMuted, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Stats & Reports</button>}
        </div>

        <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 32, maxWidth: 640, marginBottom: 24 }}>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Centre Name</label>
            <input 
              autoFocus
              value={editingCenterName}
              onChange={(e) => setEditingCenterName(e.target.value)}
              placeholder="e.g. Karachi BPO North"
              style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 15, outline: "none", color: T.textDark, fontWeight: 600 }}
              onKeyDown={e => e.key === 'Enter' && (selectedCenter.id === 'new' ? handleCreateCenter() : handleRenameCenter())}
            />
          </div>
          <div style={{ display: "flex", gap: 12, paddingTop: 12, borderTop: `1.5px solid ${T.borderLight}` }}>
            <button 
              onClick={selectedCenter.id === 'new' ? handleCreateCenter : handleRenameCenter}
              style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
            >
              {selectedCenter.id === 'new' ? "Create Centre" : "Save Changes"}
            </button>
            <button onClick={() => setView("list")} style={{ backgroundColor: "transparent", color: T.textMid, border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Cancel</button>
            {selectedCenter.id !== 'new' && (
              <button 
                onClick={() => void handleDeleteCenter(selectedCenter.id)}
                style={{ marginLeft: "auto", background: "none", border: "none", color: "#ef4444", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
              >
                Delete Centre
              </button>
            )}
          </div>
        </div>

        {selectedCenter.id !== 'new' && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
              {/* ... admin/agent linkers ... */}
              <div style={{ backgroundColor: "#fff", borderRadius: 16, border: `1.5px solid ${T.border}`, padding: 20 }}>
                <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800, color: T.textDark }}>
                  Centre Admin
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ padding: 14, borderRadius: 12, backgroundColor: T.rowBg }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: T.textMuted, marginBottom: 6 }}>CURRENT ADMIN</div>
                    {selectedCenter.admin ? (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.textDark }}>{selectedCenter.admin.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted }}>{selectedCenter.admin.id}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.textMuted }}>No admin linked yet.</div>
                    )}
                  </div>
                  <Dropdown
                    options={adminOptions}
                    value={selectedAdminUserId}
                    onChange={setSelectedAdminUserId}
                    placeholder="Select admin user"
                    style={{ width: "100%" }}
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    <Button onClick={handleAssignAdmin} disabled={!selectedAdminUserId}>
                      Link Admin
                    </Button>
                    <Button variant="ghost" onClick={handleRemoveAdmin} disabled={!selectedCenter.admin}>
                      Remove Admin
                    </Button>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: "#fff", borderRadius: 16, border: `1.5px solid ${T.border}`, padding: 20 }}>
                <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800, color: T.textDark }}>
                  Add Agent
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <Dropdown
                    options={agentOptions}
                    value={selectedAgentUserId}
                    onChange={setSelectedAgentUserId}
                    placeholder="Select call centre agent"
                    style={{ width: "100%" }}
                  />
                  <Button onClick={handleAddAgent} disabled={!selectedAgentUserId}>
                    Link Agent
                  </Button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, backgroundColor: "#fff", borderRadius: 16, border: `1.5px solid ${T.border}`, overflow: "hidden" }}>
              <div style={{ padding: "18px 20px", borderBottom: `1.5px solid ${T.border}` }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.textDark }}>
                  Linked Agents
                </h2>
              </div>
              <Table
                data={selectedCenter.agents}
                columns={[
                  {
                    header: "Agent Name",
                    key: "name",
                    render: (agent) => (
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.textDark }}>{agent.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted }}>{agent.id}</div>
                      </div>
                    ),
                  },
                  {
                    header: "Role",
                    key: "roleKey",
                    render: (agent) => (
                      <span style={{ fontSize: 12, fontWeight: 800, color: T.blue }}>
                        {agent.roleKey ?? "unassigned"}
                      </span>
                    ),
                  },
                  {
                    header: "Actions",
                    key: "actions",
                    align: "center",
                    width: 140,
                    render: (agent) => (
                      <Button variant="ghost" size="sm" onClick={() => void handleRemoveAgent(agent.id)}>
                        Remove
                      </Button>
                    ),
                  },
                ]}
              />
              {selectedCenter.agents.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: T.textMuted, fontWeight: 700 }}>
                  No agents linked to this centre.
                </div>
              )}
            </div>
          </>
        )}
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
      </div>

      <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "20px", borderBottom: `1.5px solid ${T.border}` }}>
          <div style={{ position: "relative", width: 220 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="3" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input 
              placeholder="Search Centres" 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ width: "100%", padding: "8px 12px 8px 36px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none" }} 
            />
          </div>
        </div>

          <Table
            data={paginatedCenters}
            onRowClick={(center) => {
              const detail = buildCenterDetail(center.id);
              if (detail) {
                setSelectedCenter(detail);
                setEditingCenterName(detail.name);
                setView("edit");
              }
            }}
            columns={[
              {
                header: (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 18, height: 18, backgroundColor: T.border, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: T.textMid }}>B</div>
                    Centre Name
                  </div>
                ),
                key: "name",
                render: (center) => <span style={{ fontWeight: 800, color: T.textDark }}>{center.name}</span>,
              },
              {
                header: (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Admin User
                  </div>
                ),
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
                header: (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, color: T.border }}>#</span>
                    Agents
                  </div>
                ),
                key: "agentCount",
                align: "center",
                render: (center) => <span style={{ fontWeight: 800, color: T.textMid }}>{center.agentCount}</span>,
              },
              {
                header: (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><path d="M3 10h18"/></svg>
                    Created
                  </div>
                ),
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
            <div style={{ padding: 24, textAlign: "center", color: T.textMuted, fontWeight: 700 }}>
              No centres found.
            </div>
          )}

          <div style={{ padding: "16px 20px", borderTop: `1.5px solid ${T.border}` }}>
            <Pagination
              page={currentPage}
              totalItems={filteredCenters.length}
              itemsPerPage={itemsPerPage}
              itemLabel="centres"
              onPageChange={setPage}
            />
          </div>
        </div>
    </div>
  );
}
