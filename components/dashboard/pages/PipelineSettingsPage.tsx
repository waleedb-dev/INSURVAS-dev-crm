"use client";

import { useState, useEffect, useMemo } from "react";
import { T } from "@/lib/theme";
import { Avatar, Badge, Pagination, Table, DataGrid, FilterChip } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Stage {
  id: string;
  name: string;
  position: number;
  showInReports: boolean;
}

interface Pipeline {
  id: string;
  name: string;
  stagesCount: number;
  updatedAt: string;
  stages: Stage[];
}

export default function PipelineManagementPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [view, setView] = useState<"list" | "edit">("list");
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePipelineMenu, setActivePipelineMenu] = useState<string | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [tempStageName, setTempStageName] = useState("");
  const [isEditingPipelineName, setIsEditingPipelineName] = useState(false);
  const [tempPipelineName, setTempPipelineName] = useState("");
  const [search, setSearch] = useState("");
  const [filterStages, setFilterStages] = useState<"All" | "Empty" | "With Stages">("All");

  useEffect(() => {
    fetchPipelines();
  }, []);

  async function fetchPipelines() {
    setLoading(true);
    const { data: pipelinesData, error } = await supabase
      .from("pipelines")
      .select(`
        id,
        name,
        updated_at,
        pipeline_stages(count)
      `)
      .order("name");

    if (error) {
      console.error("Error fetching pipelines:", error.message, error.details, error.hint);
    } else if (pipelinesData) {
      const mapped = pipelinesData.map((p: any) => ({
        id: String(p.id),
        name: p.name,
        stagesCount: p.pipeline_stages?.[0]?.count || 0,
        updatedAt: new Date(p.updated_at).toLocaleString(),
        stages: []
      }));
      setPipelines(mapped);
    }
    setLoading(false);
  }

  async function handleCreatePipeline() {
    const name = prompt("Enter Pipeline Name:");
    if (!name) return;

    const { data, error } = await supabase
      .from("pipelines")
      .insert([{ name }])
      .select()
      .single();

    if (error) {
       console.error("Error creating pipeline:", error);
    } else {
       fetchPipelines();
    }
  }

  async function handleOpenPipeline(p: Pipeline) {
    setLoading(true);
    const { data: stagesData, error } = await supabase
      .from("pipeline_stages")
      .select("*")
      .eq("pipeline_id", p.id)
      .order("position");

    if (error) {
       console.error("Error fetching stages:", error);
    } else {
       setSelectedPipeline({
         ...p,
         stages: stagesData.map((s: any) => ({
           id: String(s.id),
           name: s.name,
           position: s.position,
           showInReports: s.show_in_reports
         }))
       });
       setView("edit");
    }
    setLoading(false);
  }

  async function handleAddStage() {
     if (!selectedPipeline) return;
     const newPosition = selectedPipeline.stages.length + 1;
     const newStage = {
       pipeline_id: selectedPipeline.id,
       name: "New Stage",
       position: newPosition,
       show_in_reports: true
     };

     const { data, error } = await supabase
       .from("pipeline_stages")
       .insert([newStage])
       .select()
       .single();

     if (error) {
       console.error("Error adding stage:", {
         code: error.code,
         message: error.message,
         details: error.details,
         hint: error.hint,
       });
     } else if (data) {
       const mappedStage: Stage = {
         id: String(data.id),
         name: data.name,
         position: data.position,
         showInReports: data.show_in_reports
       };
       setSelectedPipeline({
         ...selectedPipeline,
         stages: [...selectedPipeline.stages, mappedStage]
       });
       setEditingStageId(mappedStage.id);
       setTempStageName(mappedStage.name);
     }
  }

  async function handleDeleteStage(id: string) {
    if (!selectedPipeline) return;
    const { error } = await supabase
      .from("pipeline_stages")
      .delete()
      .eq("id", id);
    
    if (error) {
      console.error("Error deleting stage:", error);
    } else {
      setSelectedPipeline({
        ...selectedPipeline,
        stages: selectedPipeline.stages.filter(s => s.id !== id)
      });
    }
  }

  async function handleUpdateStage(id: string, updates: Partial<Stage>) {
    if (!selectedPipeline) return;
    
    setSelectedPipeline({
      ...selectedPipeline,
      stages: selectedPipeline.stages.map(s => s.id === id ? { ...s, ...updates } : s)
    });

    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.showInReports !== undefined) dbUpdates.show_in_reports = updates.showInReports;

    const { error } = await supabase
      .from("pipeline_stages")
      .update(dbUpdates)
      .eq("id", id);

    if (error) {
      console.error("Error updating stage:", error);
    }
    setEditingStageId(null);
  }

  async function handleUpdatePipelineName() {
    if (!selectedPipeline || !tempPipelineName) return;
    
    // Optimistic update
    setSelectedPipeline({ ...selectedPipeline, name: tempPipelineName });
    setIsEditingPipelineName(false);

    const { error } = await supabase
      .from("pipelines")
      .update({ name: tempPipelineName })
      .eq("id", selectedPipeline.id);

    if (error) {
      console.error("Error updating pipeline name:", error);
    }
  }

  if (view === "edit" && selectedPipeline) {
    return (
      <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
        {/* Detail Header */}
        <div style={{ marginBottom: 24 }}>
          <button 
            onClick={() => setView("list")} 
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: T.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to Pipelines
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isEditingPipelineName ? (
              <input 
                autoFocus
                value={tempPipelineName}
                onChange={(e) => setTempPipelineName(e.target.value)}
                onBlur={handleUpdatePipelineName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUpdatePipelineName();
                  if (e.key === 'Escape') setIsEditingPipelineName(false);
                }}
                style={{ fontSize: 28, fontWeight: 800, border: `2px solid ${T.blue}`, borderRadius: 8, padding: "4px 12px", outline: "none", backgroundColor: "#fff" }}
              />
            ) : (
              <>
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{selectedPipeline.name}</h1>
                <button 
                  onClick={() => { setIsEditingPipelineName(true); setTempPipelineName(selectedPipeline.name); }}
                  style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 6 }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = T.rowBg}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Detail Tabs */}
        <div style={{ display: "flex", gap: 32, borderBottom: `1.5px solid ${T.border}`, marginBottom: 24 }}>
          <button style={{ padding: "12px 4px", border: "none", borderBottom: `3px solid ${T.blue}`, background: "none", color: T.blue, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Stages</button>
        </div>

      <DataGrid
        search=""
        onSearchChange={() => {}}
        searchPlaceholder="Search Stages"
        filters={
          <button onClick={handleAddStage} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${T.blue}44` }}>+ Add Stage</button>
        }
      >
        <Table
          data={selectedPipeline.stages}
          columns={[
            {
              header: "",
              key: "drag",
              width: 40,
              render: () => (
                <div style={{ cursor: "move" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="3"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                </div>
              )
            },
            {
              header: "Stage Name",
              key: "name",
              render: (stage) => (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {editingStageId === stage.id ? (
                    <input 
                      autoFocus
                      value={tempStageName}
                      onChange={(e) => setTempStageName(e.target.value)}
                      onBlur={() => handleUpdateStage(stage.id, { name: tempStageName })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateStage(stage.id, { name: tempStageName });
                        if (e.key === 'Escape') setEditingStageId(null);
                      }}
                      style={{ border: `1.5px solid ${T.blue}`, borderRadius: 4, padding: "2px 6px", fontSize: 13, fontWeight: 700, color: T.textDark, outline: "none", width: "100%" }}
                    />
                  ) : (
                    <span 
                      onClick={() => { setEditingStageId(stage.id); setTempStageName(stage.name); }}
                      style={{ fontWeight: 700, color: T.textDark, cursor: "text", padding: "2px 6px", borderRadius: 4, transition: "background-color 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = T.rowBg}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      {stage.name}
                    </span>
                  )}
                </div>
              )
            },
            {
              header: "Show in Reports",
              key: "showInReports",
              render: (stage) => (
                <div style={{ display: "flex", gap: 12 }}>
                  <button 
                    onClick={() => handleUpdateStage(stage.id, { showInReports: !stage.showInReports })}
                    style={{ background: "none", border: "none", color: stage.showInReports ? T.blue : T.textMuted, cursor: "pointer" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                  </button>
                  <button style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></button>
                </div>
              )
            },
            {
              header: "Actions",
              key: "actions",
              align: "center",
              width: 80,
              render: (stage) => (
                <button 
                  onClick={() => handleDeleteStage(stage.id)}
                  style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 6, borderRadius: 6 }} 
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#fef2f2"} 
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
              )
            }
          ]}
        />
      </DataGrid>
      </div>
    );
  }

  const filteredPipelines = pipelines.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesStages = filterStages === "All" ? true : filterStages === "Empty" ? p.stagesCount === 0 : p.stagesCount > 0;
    return matchesSearch && matchesStages;
  });

  return (
    <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }} onClick={() => setActivePipelineMenu(null)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px" }}>Pipelines</h1>
          <p style={{ fontSize: 14, color: T.textMuted, fontWeight: 600 }}>Pipelines help you manage Opportunities step by step, giving you a clear view of progress and sales outcomes.</p>
        </div>
        <button onClick={handleCreatePipeline} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: `0 4px 12px ${T.blue}44` }}>+ Create Pipeline</button>
      </div>

      <DataGrid
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search Pipelines"
        filters={
          <select value={filterStages} onChange={(e) => setFilterStages(e.target.value as any)} style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}>
            <option value="All">All Pipelines</option>
            <option value="With Stages">With Stages</option>
            <option value="Empty">Empty</option>
          </select>
        }
        activeFilters={
          (search.trim() !== "" || filterStages !== "All") && (
            <>
              {filterStages !== "All" && <FilterChip label={`Stages: ${filterStages}`} onClear={() => setFilterStages("All")} />}
              <button
                type="button"
                onClick={() => { setSearch(""); setFilterStages("All"); }}
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
          <Pagination page={1} totalItems={filteredPipelines.length} itemsPerPage={20} itemLabel="pipelines" onPageChange={() => {}} />
        }
      >
        <Table
          data={filteredPipelines}
          onRowClick={(p) => handleOpenPipeline(p)}
          columns={[
            {
              header: "Pipeline name",
              key: "name",
              render: (p) => <span style={{ fontWeight: 700, color: T.textDark }}>{p.name}</span>
            },
            {
              header: "No. of Stages",
              key: "stagesCount",
              align: "center",
              render: (p) => <span style={{ fontWeight: 700, color: T.textMid }}>{p.stagesCount}</span>
            },
            {
              header: "Updated on",
              key: "updatedAt",
              render: (p) => <span style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>{p.updatedAt}</span>
            },
            {
              header: "Actions",
              key: "actions",
              align: "center",
              render: (p) => (
                <div style={{ position: "relative" }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActivePipelineMenu(activePipelineMenu === p.id ? null : p.id); }} 
                    style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", padding: 6, borderRadius: 6 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                  </button>
                  {activePipelineMenu === p.id && (
                    <div style={{ position: "absolute", top: "calc(100% - 4px)", right: 16, width: 140, backgroundColor: "#fff", borderRadius: T.radiusMd, boxShadow: T.shadowLg, border: `1.5px solid ${T.border}`, zIndex: 100, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { handleOpenPipeline(p); setActivePipelineMenu(null); }} style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.textDark, textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = T.rowBg} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>Edit Pipeline</button>
                      <button style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.danger, textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#fef2f2"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>Delete</button>
                    </div>
                  )}
                </div>
              )
            }
          ]}
        />
      </DataGrid>
    </div>
  );
}
