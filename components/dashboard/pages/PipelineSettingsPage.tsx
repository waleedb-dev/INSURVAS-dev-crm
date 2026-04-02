"use client";

import { useState, useEffect, useMemo } from "react";
import { T } from "@/lib/theme";
import { Badge, Pagination, Table, DataGrid, FilterChip } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/shadcn/table";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Search, Filter, Plus, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
          zIndex: 50,
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

function mapSelectOptions(values: string[], allLabel: string) {
  const sorted = [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
  return [{ value: "All", label: allLabel }, ...sorted.map((v) => ({ value: v, label: v }))];
}

export default function PipelineManagementPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [view, setView] = useState<"list" | "edit">("list");
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [tempStageName, setTempStageName] = useState("");
  const [isEditingPipelineName, setIsEditingPipelineName] = useState(false);
  const [tempPipelineName, setTempPipelineName] = useState("");
  const [search, setSearch] = useState("");
  const [filterStages, setFilterStages] = useState("All");
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [stageSearch, setStageSearch] = useState("");
  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingPipeline, setCreatingPipeline] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [editPipelineName, setEditPipelineName] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPipeline, setDeletingPipeline] = useState<Pipeline | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const filteredStagesForEdit = useMemo(() => {
    if (!selectedPipeline) return [];
    const q = stageSearch.trim().toLowerCase();
    if (!q) return selectedPipeline.stages;
    return selectedPipeline.stages.filter((s) => s.name.toLowerCase().includes(q));
  }, [selectedPipeline, stageSearch]);

  const stageFilterOptions = [
    { value: "All", label: "All pipelines" },
    { value: "With Stages", label: "With stages" },
    { value: "Empty", label: "Empty" },
  ];

  const hasActiveFilters = filterStages !== "All";
  const activeFilterCount = filterStages !== "All" ? 1 : 0;

  const clearFilters = () => {
    setFilterStages("All");
  };

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
    if (!newPipelineName.trim()) return;

    setCreatingPipeline(true);
    setCreateError(null);

    const { data, error } = await supabase
      .from("pipelines")
      .insert([{ name: newPipelineName.trim() }])
      .select()
      .single();

    if (error) {
       console.error("Error creating pipeline:", error);
       setCreateError(error.message || "Failed to create pipeline");
    } else {
       setShowCreateModal(false);
       setNewPipelineName("");
       fetchPipelines();
    }
    setCreatingPipeline(false);
  }

  function openEditModal(p: Pipeline) {
    setEditingPipeline(p);
    setEditPipelineName(p.name);
    setShowEditModal(true);
  }

  async function handleUpdatePipeline() {
    if (!editingPipeline || !editPipelineName.trim()) return;

    const { error } = await supabase
      .from("pipelines")
      .update({ name: editPipelineName.trim() })
      .eq("id", editingPipeline.id);

    if (error) {
      console.error("Error updating pipeline:", error);
    } else {
      setShowEditModal(false);
      setEditingPipeline(null);
      setEditPipelineName("");
      fetchPipelines();
    }
  }

  function openDeleteModal(p: Pipeline) {
    setDeletingPipeline(p);
    setDeleteConfirmName("");
    setShowDeleteModal(true);
  }

  async function handleDeletePipeline() {
    if (!deletingPipeline) return;
    if (deleteConfirmName !== deletingPipeline.name) return;

    setDeletingInProgress(true);

    const { error } = await supabase
      .from("pipelines")
      .delete()
      .eq("id", deletingPipeline.id);

    if (error) {
      console.error("Error deleting pipeline:", error);
      setDeletingInProgress(false);
    } else {
      setShowDeleteModal(false);
      setDeletingPipeline(null);
      setDeleteConfirmName("");
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
       setDeleteError(null);
       setStageSearch("");
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

    const stageName = selectedPipeline.stages.find(s => s.id === id)?.name || "This stage";

    try {
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("id, first_name, last_name")
        .eq("stage_id", id)
        .limit(1);

      if (leadsError) {
        console.error("Error checking leads:", {
          message: leadsError.message,
          code: leadsError.code,
          details: leadsError.details,
          hint: leadsError.hint
        });
        setDeleteError(`Cannot delete "${stageName}". Unable to verify if leads are assigned to this stage. Please try again or contact support.`);
        return;
      } else if (leadsData && leadsData.length > 0) {
        setDeleteError(`Cannot delete "${stageName}". This stage has leads assigned to it. Please move all leads to another stage first.`);
        return;
      }

      const { error } = await supabase
        .from("pipeline_stages")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting stage:", error);
        setDeleteError(`Failed to delete stage. Please try again.`);
      } else {
        setSelectedPipeline({
          ...selectedPipeline,
          stages: selectedPipeline.stages.filter(s => s.id !== id)
        });
      }
    } catch (err) {
      console.error("Unexpected error in handleDeleteStage:", err);
      setDeleteError(`Cannot delete "${stageName}". An unexpected error occurred. Please try again.`);
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

  const filteredPipelines = pipelines.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesStages = filterStages === "All" ? true : filterStages === "With Stages" ? p.stagesCount > 0 : p.stagesCount === 0;
    return matchesSearch && matchesStages;
  });

  const totalStages = pipelines.reduce((sum, p) => sum + p.stagesCount, 0);
  const pipelinesWithStages = pipelines.filter(p => p.stagesCount > 0).length;

  if (view === "edit" && selectedPipeline) {
    return (
      <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
        {deleteError && (
          <div style={{
            position: "fixed",
            top: 20,
            right: 20,
            backgroundColor: "#fef2f2",
            border: "1.5px solid #3b5229",
            borderRadius: 12,
            padding: "16px 20px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
            zIndex: 1000,
            maxWidth: 400,
            animation: "slideIn 0.3s ease-out"
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: "#3b5229",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: "#991b1b", marginBottom: 4, fontSize: 15 }}>
                  Cannot Delete Stage
                </div>
                <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.5 }}>
                  {deleteError}
                </div>
              </div>
              <button
                onClick={() => setDeleteError(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#991b1b",
                  cursor: "pointer",
                  padding: 4,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <button 
            onClick={() => { setView("list"); setDeleteError(null); setStageSearch(""); }} 
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

        <div style={{ display: "flex", gap: 32, borderBottom: `1.5px solid ${T.border}`, marginBottom: 24 }}>
          <button style={{ padding: "12px 4px", border: "none", borderBottom: `3px solid #233217`, background: "none", color: "#233217", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Stages</button>
        </div>

        <DataGrid
          search={stageSearch}
          onSearchChange={setStageSearch}
          searchPlaceholder="Search Stages"
          noHeader
          style={{ borderRadius: 16, border: `1px solid ${T.border}`, overflow: "hidden" }}
          headerActions={
            <button
              type="button"
              onClick={() => void handleAddStage()}
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
              Add Stage
            </button>
          }
          pagination={
            <div style={{
              backgroundColor: T.cardBg,
              borderTop: `1px solid ${T.border}`,
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ fontSize: 13, color: "#233217", fontWeight: 500 }}>
                Showing {filteredStagesForEdit.length} stages
              </span>
            </div>
          }
        >
          <div
            style={{
              borderRadius: "16px 16px 0 0",
              border: `1px solid ${T.border}`,
              borderBottom: "none",
              overflow: "hidden",
              backgroundColor: T.cardBg,
            }}
          >
            <ShadcnTable>
              <TableHeader style={{ backgroundColor: "#233217" }}>
                <TableRow style={{ borderBottom: "none" }} className="hover:bg-transparent">
                  {[
                    { label: "Stage Name", align: "left" as const },
                    { label: "Show in Reports", align: "left" as const },
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
                {filteredStagesForEdit.map((stage) => (
                  <TableRow 
                    key={stage.id}
                    style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                    className="hover:bg-muted/30 transition-all duration-150"
                  >
                    <TableCell style={{ padding: "14px 20px" }}>
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
                          style={{ border: `1.5px solid #233217`, borderRadius: 6, padding: "6px 10px", fontSize: 13, fontWeight: 500, color: T.textDark, outline: "none", width: "100%", maxWidth: 300 }}
                        />
                      ) : (
                        <span 
                          onClick={() => { setEditingStageId(stage.id); setTempStageName(stage.name); }}
                          style={{ fontWeight: 500, color: T.textDark, cursor: "text", padding: "4px 8px", borderRadius: 6, transition: "background-color 0.2s" }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = T.rowBg}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                        >
                          {stage.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell style={{ padding: "14px 20px" }}>
                      <button 
                        onClick={() => handleUpdateStage(stage.id, { showInReports: !stage.showInReports })}
                        style={{ background: "none", border: "none", color: stage.showInReports ? "#233217" : T.textMuted, cursor: "pointer", padding: 4 }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                      </button>
                    </TableCell>
                    <TableCell style={{ padding: "12px 16px", textAlign: "center" }}>
                      <button 
                        onClick={() => handleDeleteStage(stage.id)}
                        style={{ background: "none", border: "none", color: "#3b5229", cursor: "pointer", padding: 6, borderRadius: 6 }} 
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "#fef2f2"} 
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </ShadcnTable>
          </div>
        </DataGrid>
      </div>
    );
  }

  return (
    <div style={{ padding: "0", animation: "fadeIn 0.3s ease-out" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          [
            { label: "Total Pipelines", value: pipelines.length.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              ) },
            { label: "Total Stages", value: totalStages.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              ) },
            { label: "With Stages", value: pipelinesWithStages.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              ) },
            { label: "Empty Pipelines", value: (pipelines.length - pipelinesWithStages).toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pipelines..."
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
              <Filter size={16} />
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
              onClick={() => { setShowCreateModal(true); setNewPipelineName(""); setCreateError(null); }}
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
              Create Pipeline
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Filter by stages</div>
                  <StyledSelect
                    value={filterStages}
                    onValueChange={setFilterStages}
                    options={stageFilterOptions}
                    placeholder="All pipelines"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {filterStages !== "All" && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#DCEBDC", border: "1px solid #233217", fontSize: 12, fontWeight: 600, color: "#233217" }}>
                        {stageFilterOptions.find(o => o.value === filterStages)?.label || filterStages}
                        <button onClick={() => setFilterStages("All")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#233217" }}>
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

      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Create Pipeline</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {createError && (
              <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 500 }}>{createError}</div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Pipeline name</label>
              <input
                type="text"
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreatePipeline();
                  if (e.key === 'Escape') setShowCreateModal(false);
                }}
                placeholder="Enter pipeline name"
                autoFocus
                style={{
                  width: "100%",
                  height: 44,
                  border: `1.5px solid ${T.border}`,
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
                  e.currentTarget.style.borderColor = "#233217";
                  e.currentTarget.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreateModal(false)}
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
                onClick={handleCreatePipeline}
                disabled={!newPipelineName.trim() || creatingPipeline}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: newPipelineName.trim() && !creatingPipeline ? "#233217" : T.border,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: newPipelineName.trim() && !creatingPipeline ? "pointer" : "not-allowed",
                  boxShadow: newPipelineName.trim() && !creatingPipeline ? "0 4px 12px rgba(35, 50, 23, 0.2)" : "none",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                {creatingPipeline ? "Creating..." : "Create Pipeline"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            backgroundColor: T.cardBg,
            padding: "80px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <LoadingSpinner size={48} label="Loading pipelines..." />
        </div>
      ) : (
        <DataGrid
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search pipelines..."
          noHeader
          style={{ borderRadius: 16, border: `1px solid ${T.border}`, overflow: "hidden" }}
          pagination={
            <div style={{
              backgroundColor: T.cardBg,
              borderTop: `1px solid ${T.border}`,
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ fontSize: 13, color: "#233217", fontWeight: 500 }}>
                Showing {filteredPipelines.length} of {pipelines.length} pipelines
              </span>
            </div>
          }
        >
          <div
            style={{
              borderRadius: "16px 16px 0 0",
              border: `1px solid ${T.border}`,
              borderBottom: "none",
              overflow: "hidden",
              backgroundColor: T.cardBg,
            }}
          >
            <ShadcnTable>
              <TableHeader style={{ backgroundColor: "#233217" }}>
                <TableRow style={{ borderBottom: "none" }} className="hover:bg-transparent">
                  {[
                    { label: "Pipeline name", align: "left" as const },
                    { label: "No. of Stages", align: "center" as const },
                    { label: "Updated on", align: "left" as const },
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
                {filteredPipelines.map((pipeline) => (
                  <TableRow 
                    key={pipeline.id}
                    onClick={() => handleOpenPipeline(pipeline)}
                    style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                    className="hover:bg-muted/30 transition-all duration-150"
                  >
                    <TableCell style={{ padding: "14px 20px" }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: T.textDark }}>{pipeline.name}</span>
                    </TableCell>
                    <TableCell style={{ padding: "14px 20px", textAlign: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: T.textMid }}>{pipeline.stagesCount}</span>
                    </TableCell>
                    <TableCell style={{ padding: "14px 20px" }}>
                      <span style={{ fontSize: 13, color: T.textMid, fontWeight: 400 }}>{pipeline.updatedAt}</span>
                    </TableCell>
                    <TableCell style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap" }}
                      >
                        <button 
                          onClick={() => handleOpenPipeline(pipeline)}
                          style={{ background: "none", border: "none", color: "#233217", cursor: "pointer", padding: 6, borderRadius: 6 }}
                          title="View Pipeline"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button 
                          onClick={() => openEditModal(pipeline)}
                          style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", padding: 6, borderRadius: 6 }}
                          title="Edit Pipeline"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button 
                          onClick={() => openDeleteModal(pipeline)}
                          style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 6, borderRadius: 6 }}
                          title="Delete Pipeline"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </ShadcnTable>
          </div>
        </DataGrid>
      )}

      {showEditModal && editingPipeline && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Edit Pipeline</h2>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>Pipeline name</label>
              <input
                type="text"
                value={editPipelineName}
                onChange={(e) => setEditPipelineName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUpdatePipeline();
                  if (e.key === 'Escape') setShowEditModal(false);
                }}
                placeholder="Enter pipeline name"
                autoFocus
                style={{
                  width: "100%",
                  height: 44,
                  border: `1.5px solid ${T.border}`,
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
                  e.currentTarget.style.borderColor = "#233217";
                  e.currentTarget.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowEditModal(false)}
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
                onClick={handleUpdatePipeline}
                disabled={!editPipelineName.trim()}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: editPipelineName.trim() ? "#233217" : T.border,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: editPipelineName.trim() ? "pointer" : "not-allowed",
                  boxShadow: editPipelineName.trim() ? "0 4px 12px rgba(35, 50, 23, 0.2)" : "none",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && deletingPipeline && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#dc2626" }}>Delete Pipeline</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#991b1b", lineHeight: 1.6 }}>
                <strong>Warning:</strong> This will permanently delete <strong>"{deletingPipeline.name}"</strong> and all its stages. This action cannot be undone.
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                Type <strong>{deletingPipeline.name}</strong> to confirm deletion
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteConfirmName === deletingPipeline.name) handleDeletePipeline();
                  if (e.key === 'Escape') setShowDeleteModal(false);
                }}
                placeholder={deletingPipeline.name}
                autoFocus
                style={{
                  width: "100%",
                  height: 44,
                  border: `1.5px solid ${deleteConfirmName === deletingPipeline.name ? "#dc2626" : T.border}`,
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
                  e.currentTarget.style.borderColor = deleteConfirmName === deletingPipeline.name ? "#dc2626" : "#233217";
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${deleteConfirmName === deletingPipeline.name ? "rgba(220, 38, 38, 0.1)" : "rgba(35, 50, 23, 0.1)"}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = deleteConfirmName === deletingPipeline.name ? "#dc2626" : T.border;
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
                onClick={handleDeletePipeline}
                disabled={deleteConfirmName !== deletingPipeline.name || deletingInProgress}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: deleteConfirmName === deletingPipeline.name && !deletingInProgress ? "#dc2626" : T.border,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: deleteConfirmName === deletingPipeline.name && !deletingInProgress ? "pointer" : "not-allowed",
                  boxShadow: deleteConfirmName === deletingPipeline.name && !deletingInProgress ? "0 4px 12px rgba(220, 38, 38, 0.2)" : "none",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                {deletingInProgress ? "Deleting..." : "Delete Pipeline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = `
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}
