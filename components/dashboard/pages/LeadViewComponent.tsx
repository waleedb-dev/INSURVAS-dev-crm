import { useState, useEffect, useMemo, useCallback } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Lead {
  name: string;
  email: string;
  phone: string;
  premium: number;
  type: string;
  source: string;
  pipeline: string;
  stage: string;
}

type LeadRow = Record<string, unknown>;

type LeadNoteRow = {
  id: string;
  body: string;
  created_at: string;
  created_by: string | null;
  authorName?: string;
};

interface LeadViewProps {
  leadId?: string;
  /** When known, use this UUID for DB fetch/update (avoids lookup by lead_unique_id). */
  leadRowUuid?: string;
  leadName?: string;
  isCreation?: boolean;
  onSubmit?: (lead: Lead) => void;
  onBack: () => void;
  defaultPipeline?: string;
  defaultStage?: string;
  /** When false, hides Edit Lead and disables note add (e.g. read-only). */
  canEditLead?: boolean;
  /** Demo / mock entry — no DB fetch; shows name only (e.g. Assigning sandbox). */
  previewMode?: boolean;
}

type TabType = "Overview" | "Notes" | "Policy & coverage";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatTs(value: unknown) {
  if (value == null || value === "") return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatPhoneDisplay(phone: string | null | undefined) {
  const raw = String(phone ?? "").replace(/\D/g, "");
  if (raw.length === 10) {
    return `+1 (${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
  }
  return phone || "—";
}

function fmt(value: unknown) {
  if (value == null || value === "") return "—";
  return String(value);
}

export default function LeadViewComponent({
  leadId,
  leadRowUuid,
  leadName,
  isCreation,
  onSubmit,
  onBack,
  defaultPipeline,
  defaultStage,
  canEditLead = true,
  previewMode = false,
}: LeadViewProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [activeTab, setActiveTab] = useState<TabType>("Overview");
  const [pipelines, setPipelines] = useState<{ name: string; stages: string[] }[]>([]);

  const [formData, setFormData] = useState<Lead>({
    name: leadName || "",
    email: leadName ? `${leadName.split(" ")[0].toLowerCase()}@example.com` : "",
    phone: "+1 (555) 000-0000",
    premium: 0,
    type: "Auto Insurance",
    source: "Manual Entry",
    pipeline: defaultPipeline || "Sales Pipeline",
    stage: defaultStage || "New Lead",
  });

  const [rowUuid, setRowUuid] = useState<string | null>(leadRowUuid ?? null);
  const [leadRow, setLeadRow] = useState<LeadRow | null>(null);
  const [loadingLead, setLoadingLead] = useState(!isCreation && !previewMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<LeadRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [leadNotes, setLeadNotes] = useState<LeadNoteRow[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  const resolveLeadUuid = useCallback(
    async (id: string | undefined): Promise<string | null> => {
      if (!id) return null;
      if (UUID_RE.test(id)) return id;
      const { data } = await supabase.from("leads").select("id").eq("lead_unique_id", id).maybeSingle();
      return data?.id ? String(data.id) : null;
    },
    [supabase]
  );

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSessionUserId(data.session?.user?.id ?? null));
  }, [supabase]);

  useEffect(() => {
    fetchPipelines();
  }, []);

  async function fetchPipelines() {
    const { data: pipelinesData, error: pError } = await supabase.from("pipelines").select("id, name");
    if (pError || !pipelinesData) return;

    const { data: stagesData, error: sError } = await supabase.from("pipeline_stages").select("pipeline_id, name").order("position");
    if (sError || !stagesData) return;

    const built = pipelinesData.map((p) => ({
      name: p.name,
      stages: stagesData.filter((s) => s.pipeline_id === p.id).map((s) => s.name),
    }));
    setPipelines(built);

    if (isCreation && built.length > 0) {
      const requestedPipeline = defaultPipeline || formData.pipeline;
      const selectedPipeline = built.find((pipeline) => pipeline.name === requestedPipeline) || built[0];
      const hasRequestedStage = selectedPipeline.stages.includes(defaultStage || formData.stage);
      setFormData((prev) => ({
        ...prev,
        pipeline: selectedPipeline.name,
        stage: hasRequestedStage ? defaultStage || prev.stage : selectedPipeline.stages[0] || "",
      }));
    }
  }

  useEffect(() => {
    if (isCreation || previewMode) {
      setLoadingLead(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingLead(true);
      setLoadError(null);
      const uuid = leadRowUuid || (await resolveLeadUuid(leadId));
      if (cancelled) return;
      if (!uuid) {
        setLoadError("Lead not found.");
        setLeadRow(null);
        setRowUuid(null);
        setLoadingLead(false);
        return;
      }
      setRowUuid(uuid);
      const { data, error } = await supabase.from("leads").select("*").eq("id", uuid).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setLoadError(error?.message || "Could not load lead.");
        setLeadRow(null);
      } else {
        setLeadRow(data as LeadRow);
      }
      setLoadingLead(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isCreation, previewMode, leadId, leadRowUuid, resolveLeadUuid, supabase]);

  const pipelineNameForStages =
    isEditing && editDraft
      ? String(editDraft.pipeline ?? "")
      : String(leadRow?.pipeline ?? formData.pipeline);
  const currentPipeline =
    pipelines.find((p) => p.name === pipelineNameForStages) ||
    pipelines.find((p) => p.name === String(leadRow?.pipeline ?? formData.pipeline)) ||
    pipelines[0];

  const fullName = useMemo(() => {
    const d = isEditing && editDraft ? editDraft : leadRow;
    if (previewMode && leadName) return leadName;
    if (!d) return leadName || "Lead";
    const combined = `${String(d.first_name ?? "").trim()} ${String(d.last_name ?? "").trim()}`.trim();
    return combined || leadName || "Lead";
  }, [isEditing, editDraft, leadRow, leadName, previewMode]);

  const startEdit = () => {
    if (!leadRow || !canEditLead) return;
    setEditDraft({ ...leadRow });
    setIsEditing(true);
    setSaveError(null);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditDraft(null);
    setSaveError(null);
  };

  const resolveStageId = async (pipelineName: string, stageName: string) => {
    const { data: pipelineRow } = await supabase.from("pipelines").select("id").eq("name", pipelineName).maybeSingle();
    if (!pipelineRow?.id) return null;
    const { data: st } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_id", pipelineRow.id)
      .eq("name", stageName)
      .maybeSingle();
    return st?.id ?? null;
  };

  const saveLeadEdits = async () => {
    if (!rowUuid || !editDraft) return;
    setSaving(true);
    setSaveError(null);

    const str = (k: string) => {
      const v = editDraft[k];
      if (v == null) return null;
      if (typeof v === "string") return v.trim() === "" ? null : v.trim();
      return String(v);
    };
    const num = (k: string) => {
      const raw = editDraft[k];
      if (raw === "" || raw == null) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    const pipelineName = str("pipeline") || "Transfer Portal";
    const stageName = str("stage") || "Transfer API";
    const stageId = await resolveStageId(pipelineName, stageName);

    let tagsVal: string[] | null = null;
    const tr = editDraft.tags;
    if (Array.isArray(tr)) tagsVal = tr.map((t) => String(t)).filter(Boolean);
    else if (typeof tr === "string" && tr.trim()) {
      tagsVal = tr.split(",").map((s) => s.trim()).filter(Boolean);
    }

    const payload: Record<string, unknown> = {
      first_name: str("first_name"),
      last_name: str("last_name"),
      phone: str("phone"),
      street1: str("street1"),
      street2: str("street2"),
      city: str("city"),
      state: str("state"),
      zip_code: str("zip_code"),
      product_type: str("product_type"),
      lead_value: num("lead_value"),
      monthly_premium: str("monthly_premium"),
      coverage_amount: str("coverage_amount"),
      carrier: str("carrier"),
      lead_source: str("lead_source"),
      submission_date: str("submission_date"),
      pipeline: pipelineName,
      stage: stageName,
    };
    if (stageId != null) payload.stage_id = stageId;
    if (tagsVal) payload.tags = tagsVal;

    const { data: updated, error } = await supabase.from("leads").update(payload).eq("id", rowUuid).select("*").maybeSingle();
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    if (updated) {
      setLeadRow(updated as LeadRow);
      setIsEditing(false);
      setEditDraft(null);
    }
  };

  const display = isEditing && editDraft ? editDraft : leadRow;

  const tags: string[] = Array.isArray(display?.tags)
    ? (display!.tags as unknown[]).map(String)
    : typeof display?.tags === "string"
      ? display.tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const loadNotes = useCallback(async () => {
    if (!rowUuid) return;
    setNotesLoading(true);
    const { data: notes, error } = await supabase
      .from("lead_notes")
      .select("id, body, created_at, created_by")
      .eq("lead_id", rowUuid)
      .order("created_at", { ascending: false });
    if (error) {
      setLeadNotes([]);
      setNotesLoading(false);
      return;
    }
    const rows = (notes || []) as Pick<LeadNoteRow, "id" | "body" | "created_at" | "created_by">[];
    const creatorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
    let nameById: Record<string, string> = {};
    if (creatorIds.length) {
      const { data: users } = await supabase.from("users").select("id, full_name").in("id", creatorIds);
      if (users) {
        nameById = Object.fromEntries(users.map((u: { id: string; full_name: string | null }) => [u.id, u.full_name?.trim() || "User"]));
      }
    }
    setLeadNotes(
      rows.map((r) => ({
        ...r,
        authorName: r.created_by ? nameById[r.created_by] ?? "User" : "System",
      }))
    );
    setNotesLoading(false);
  }, [rowUuid, supabase]);

  useEffect(() => {
    if (activeTab !== "Notes" || !rowUuid || isCreation || previewMode) return;
    void loadNotes();
  }, [activeTab, rowUuid, isCreation, previewMode, loadNotes]);

  const addNote = async () => {
    if (!rowUuid || !newNoteText.trim()) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    setAddingNote(true);
    const { error } = await supabase.from("lead_notes").insert({
      lead_id: rowUuid,
      body: newNoteText.trim(),
      created_by: session.user.id,
    });
    setAddingNote(false);
    if (!error) {
      setNewNoteText("");
      await loadNotes();
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!window.confirm("Delete this note?")) return;
    const { error } = await supabase.from("lead_notes").delete().eq("id", noteId);
    if (!error) await loadNotes();
  };

  const patchDraft = (key: string, value: unknown) => {
    setEditDraft((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const handleSave = () => {
    if (onSubmit) onSubmit(formData);
  };

  if (!isCreation && loadingLead) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: T.textMuted, fontWeight: 600 }}>
        Loading lead…
      </div>
    );
  }

  if (!isCreation && loadError) {
    return (
      <div style={{ padding: 48 }}>
        <p style={{ color: "#b91c1c", fontWeight: 700, marginBottom: 16 }}>{loadError}</p>
        <button type="button" onClick={onBack} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${T.border}`, cursor: "pointer" }}>
          Back
        </button>
      </div>
    );
  }

  if (!isCreation && previewMode) {
    return (
      <div style={{ animation: "fadeIn 0.3s ease-out", color: T.textDark }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              type="button"
              onClick={onBack}
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
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>Leads · Lead Profile</p>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{leadName || "Demo lead"}</h1>
            </div>
          </div>
        </div>
        <div
          style={{
            padding: 20,
            borderRadius: 16,
            background: T.blueFaint,
            border: `1px solid ${T.border}`,
            marginBottom: 20,
            fontSize: 14,
            fontWeight: 600,
            color: T.textMid,
          }}
        >
          This is a demo lead from the Assigning sandbox. Open a lead from <strong>Lead Pipeline</strong> or <strong>Transfer Leads</strong> to view and edit live records.
        </div>
        <button type="button" onClick={onBack} style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${T.border}`, cursor: "pointer", fontWeight: 700 }}>
          Back to list
        </button>
      </div>
    );
  }

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    border: `1px solid ${T.border}`,
    borderRadius: "8px",
    fontSize: 14,
    color: T.textDark,
    fontFamily: T.font,
    backgroundColor: "#fff",
    outline: "none",
    transition: "all 0.2s",
  } as const;

  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: T.textDark,
    marginBottom: 8,
  } as const;

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out", color: T.textDark }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            type="button"
            onClick={onBack}
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
              transition: "all 0.2s",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>Leads</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
              <span style={{ fontSize: 13, color: T.blue, fontWeight: 700 }}>{isCreation ? "Create New Lead" : "Lead Profile"}</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
              {isCreation ? "New Lead Entry" : fullName}
            </h1>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {saveError && (
            <span style={{ fontSize: 12, color: "#b91c1c", fontWeight: 600, maxWidth: 280 }}>{saveError}</span>
          )}
          {isCreation ? (
            <>
              <button type="button" onClick={onBack} style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: T.textDark }}>
                Cancel
              </button>
              <button type="button" onClick={handleSave} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: T.radiusMd, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${T.blue}44` }}>
                Create Lead
              </button>
            </>
          ) : isEditing ? (
            <>
              <button type="button" onClick={cancelEdit} disabled={saving} style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                Cancel
              </button>
              <button type="button" onClick={() => void saveLeadEdits()} disabled={saving || !canEditLead} style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: T.radiusMd, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: saving || !canEditLead ? "not-allowed" : "pointer", opacity: canEditLead ? 1 : 0.6 }}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={startEdit}
                disabled={!canEditLead || !leadRow}
                title={!canEditLead ? "You do not have permission to edit this lead." : undefined}
                style={{
                  backgroundColor: "#fff",
                  border: `1.5px solid ${T.border}`,
                  borderRadius: T.radiusMd,
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: canEditLead && leadRow ? "pointer" : "not-allowed",
                  color: T.textDark,
                  opacity: canEditLead && leadRow ? 1 : 0.55,
                }}
              >
                Edit Lead
              </button>
              <button type="button" style={{ backgroundColor: T.blue, color: "#fff", border: "none", borderRadius: T.radiusMd, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${T.blue}44` }}>
                Convert to Client
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "8px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: `1.5px solid ${T.border}`, display: "flex", gap: 4 }}>
            {(["Overview", "Notes", "Policy & coverage"] as TabType[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  border: "none",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: activeTab === tab ? 800 : 600,
                  backgroundColor: activeTab === tab ? T.blueFaint : "transparent",
                  color: activeTab === tab ? T.blue : T.textMuted,
                  transition: "all 0.2s",
                  fontFamily: T.font,
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ backgroundColor: "#fff", borderRadius: "24px", padding: "32px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)", border: `1.5px solid ${T.border}`, minHeight: 600 }}>
            {activeTab === "Overview" && (
              <div style={{ animation: "fadeInUp 0.3s ease-out" }}>
                <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800 }}>Lead record</h3>
                {!isCreation && leadRow && (
                  <p style={{ margin: "0 0 20px", fontSize: 12, color: T.textMuted, fontWeight: 600, lineHeight: 1.5 }}>
                    Columns from <code style={{ fontSize: 11 }}>public.leads</code> for this row (<code style={{ fontSize: 11 }}>id</code>
                    {rowUuid ? (
                      <>
                        {" "}
                        = <code style={{ fontSize: 11, wordBreak: "break-all" }}>{rowUuid}</code>
                      </>
                    ) : null}
                    ).
                  </p>
                )}

                {!isCreation && leadRow && display && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
                    {(() => {
                      const d = isEditing && editDraft ? editDraft : display;
                      const ro = !isEditing;
                      const roStyle = {
                        ...inputStyle,
                        backgroundColor: T.pageBg,
                        color: T.textMid,
                      } as const;
                      const fieldStyle = ro ? roStyle : inputStyle;

                      const pipelineName = String(d?.pipeline ?? "");
                      const stagesForPipeline =
                        pipelines.find((p) => p.name === pipelineName)?.stages ||
                        currentPipeline?.stages ||
                        [];

                      return (
                        <>
                          <div>
                            <h3 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800 }}>Primary Identity</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                              <div>
                                <label style={labelStyle}>
                                  Given Name <span style={{ color: T.danger }}>*</span>
                                </label>
                                <input
                                  value={String(d?.first_name ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("first_name", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>
                                  Family Name <span style={{ color: T.danger }}>*</span>
                                </label>
                                <input
                                  value={String(d?.last_name ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("last_name", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <label style={labelStyle}>Phone Number</label>
                                <input
                                  value={String(d?.phone ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("phone", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <label style={labelStyle}>Lead source</label>
                                <input
                                  value={String(d?.lead_source ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("lead_source", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800 }}>Policy & coverage</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                              <div>
                                <label style={labelStyle}>Product type</label>
                                <input
                                  value={String(d?.product_type ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("product_type", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>Carrier</label>
                                <input
                                  value={String(d?.carrier ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("carrier", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>Monthly premium</label>
                                <input
                                  value={String(d?.monthly_premium ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("monthly_premium", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>Coverage amount</label>
                                <input
                                  value={String(d?.coverage_amount ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("coverage_amount", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <label style={labelStyle}>Tags</label>
                                <input
                                  value={
                                    Array.isArray(d?.tags)
                                      ? (d.tags as unknown[]).map(String).filter(Boolean).join(", ")
                                      : typeof d?.tags === "string"
                                        ? String(d.tags)
                                        : ""
                                  }
                                  readOnly={ro}
                                  onChange={(e) =>
                                    patchDraft(
                                      "tags",
                                      e.target.value
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean)
                                    )
                                  }
                                  style={fieldStyle}
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800 }}>Pipeline</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                              <div>
                                <label style={labelStyle}>Pipeline</label>
                                <select
                                  value={String(d?.pipeline ?? "")}
                                  disabled={ro}
                                  onChange={(e) => {
                                    const pName = e.target.value;
                                    const p = pipelines.find((pl) => pl.name === pName);
                                    patchDraft("pipeline", pName);
                                    if (p?.stages?.length) patchDraft("stage", p.stages[0]);
                                  }}
                                  style={(ro ? roStyle : inputStyle) as any}
                                >
                                  {pipelines.map((p) => (
                                    <option key={p.name} value={p.name}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label style={labelStyle}>Stage</label>
                                <select
                                  value={String(d?.stage ?? "")}
                                  disabled={ro}
                                  onChange={(e) => patchDraft("stage", e.target.value)}
                                  style={(ro ? roStyle : inputStyle) as any}
                                >
                                  {stagesForPipeline.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label style={labelStyle}>Lead value</label>
                                <input
                                  value={d?.lead_value != null && d?.lead_value !== "" ? String(d.lead_value) : ""}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("lead_value", e.target.value === "" ? null : Number(e.target.value))}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>Submission date</label>
                                <input
                                  value={String(d?.submission_date ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("submission_date", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800 }}>Identifiers</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                              <div>
                                <label style={labelStyle}>lead_unique_id</label>
                                <input value={String(d?.lead_unique_id ?? "")} readOnly style={roStyle} />
                              </div>
                              <div>
                                <label style={labelStyle}>id (PK)</label>
                                <input value={String(rowUuid ?? "")} readOnly style={roStyle} />
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800 }}>Location</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <label style={labelStyle}>Street 1</label>
                                <input
                                  value={String(d?.street1 ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("street1", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <label style={labelStyle}>Street 2</label>
                                <input
                                  value={String(d?.street2 ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("street2", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>City</label>
                                <input
                                  value={String(d?.city ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("city", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>State</label>
                                <input
                                  value={String(d?.state ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("state", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>ZIP</label>
                                <input
                                  value={String(d?.zip_code ?? "")}
                                  readOnly={ro}
                                  onChange={(e) => patchDraft("zip_code", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {!isCreation && leadRow && (
                  <>
                    <h4 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800 }}>
                      Row metadata <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>(created_at, updated_at)</span>
                    </h4>
                    <p style={{ margin: "0 0 6px", fontSize: 13, color: T.textMuted }}>
                      created_at: {formatTs(leadRow.created_at)} · updated_at: {formatTs(leadRow.updated_at)}
                    </p>
                  </>
                )}

                {isCreation && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                      <div style={{ backgroundColor: T.pageBg, border: `1.5px solid ${T.borderLight}`, borderRadius: "16px", padding: "20px" }}>
                        <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: T.textDark }}>Policy / product</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Product type</label>
                          <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            style={{ padding: "10px", borderRadius: "10px", border: `1.5px solid ${T.border}`, fontWeight: 700 }}
                          >
                            <option value="Auto">Auto Insurance</option>
                            <option value="Home">Home Insurance</option>
                            <option value="Life">Life Insurance</option>
                            <option value="Health">Health Insurance</option>
                            <option value="Commercial">Commercial Insurance</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ backgroundColor: T.pageBg, border: `1.5px solid ${T.borderLight}`, borderRadius: "16px", padding: "20px" }}>
                        <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: T.textDark }}>Pipeline & stage</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Pipeline</label>
                            <select
                              value={formData.pipeline}
                              onChange={(e) => {
                                const pName = e.target.value;
                                const p = pipelines.find((pl) => pl.name === pName);
                                setFormData({ ...formData, pipeline: pName, stage: p ? p.stages[0] : "" });
                              }}
                              style={{ padding: "10px", borderRadius: "10px", border: `1.5px solid ${T.border}`, fontWeight: 700, outline: "none" }}
                            >
                              {pipelines.map((p) => (
                                <option key={p.name} value={p.name}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Stage</label>
                            <select
                              value={formData.stage}
                              onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                              style={{ padding: "10px", borderRadius: "10px", border: `1.5px solid ${T.border}`, fontWeight: 700, outline: "none" }}
                            >
                              {currentPipeline?.stages.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ border: `2px dashed ${T.border}`, borderRadius: "24px", padding: 40, textAlign: "center", color: T.textMuted }}>
                      <p style={{ fontWeight: 600 }}>Additional fields will be available after lead creation.</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "Notes" && !isCreation && (
              <div>
                <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>Notes</h3>
                <p style={{ margin: "0 0 16px", fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
                  Table <code style={{ fontSize: 11 }}>public.lead_notes</code>, linked by <code style={{ fontSize: 11 }}>lead_id</code> →{" "}
                  <code style={{ fontSize: 11 }}>leads.id</code> (same as Lead Pipeline quick edit).
                </p>
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Add a note…"
                  disabled={!canEditLead || addingNote}
                  rows={4}
                  style={{
                    width: "100%",
                    padding: 14,
                    borderRadius: 12,
                    border: `1.5px solid ${T.border}`,
                    fontFamily: T.font,
                    fontSize: 14,
                    marginBottom: 10,
                    resize: "vertical",
                  }}
                />
                <button
                  type="button"
                  disabled={!canEditLead || addingNote || !newNoteText.trim()}
                  onClick={() => void addNote()}
                  style={{
                    background: T.blue,
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "10px 20px",
                    fontWeight: 800,
                    cursor: canEditLead && newNoteText.trim() ? "pointer" : "not-allowed",
                    opacity: canEditLead ? 1 : 0.6,
                    marginBottom: 28,
                  }}
                >
                  {addingNote ? "Adding…" : "Add note"}
                </button>

                {notesLoading ? (
                  <p style={{ color: T.textMuted }}>Loading notes…</p>
                ) : leadNotes.length === 0 ? (
                  <p style={{ color: T.textMuted, padding: 16, background: T.pageBg, borderRadius: 10 }}>No notes yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {leadNotes.map((note) => (
                      <div key={note.id} style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, background: T.rowBg }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 700 }}>
                            {formatTs(note.created_at)} · {note.authorName}
                          </span>
                          {canEditLead && note.created_by && sessionUserId === note.created_by && (
                            <button type="button" onClick={() => void deleteNote(note.id)} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: 12 }}>
                              Delete
                            </button>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{note.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "Policy & coverage" && !isCreation && (
              <div>
                <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>Policy & coverage</h3>
                <p style={{ margin: "0 0 16px", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
                  Columns: <code style={{ fontSize: 11 }}>product_type</code>, <code style={{ fontSize: 11 }}>carrier</code>,{" "}
                  <code style={{ fontSize: 11 }}>monthly_premium</code>, <code style={{ fontSize: 11 }}>coverage_amount</code>,{" "}
                  <code style={{ fontSize: 11 }}>tags</code>.
                </p>
                {isEditing && editDraft ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, fontFamily: "ui-monospace, monospace" }}>monthly_premium</label>
                    <input
                      value={String(editDraft.monthly_premium ?? "")}
                      onChange={(e) => patchDraft("monthly_premium", e.target.value)}
                      style={{ padding: 10, borderRadius: 8, border: `1px solid ${T.border}` }}
                    />
                    <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, fontFamily: "ui-monospace, monospace" }}>coverage_amount</label>
                    <input
                      value={String(editDraft.coverage_amount ?? "")}
                      onChange={(e) => patchDraft("coverage_amount", e.target.value)}
                      style={{ padding: 10, borderRadius: 8, border: `1px solid ${T.border}` }}
                    />
                    <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, fontFamily: "ui-monospace, monospace" }}>carrier</label>
                    <input
                      value={String(editDraft.carrier ?? "")}
                      onChange={(e) => patchDraft("carrier", e.target.value)}
                      style={{ padding: 10, borderRadius: 8, border: `1px solid ${T.border}` }}
                    />
                    <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, fontFamily: "ui-monospace, monospace" }}>tags</label>
                    <input
                      value={Array.isArray(editDraft.tags) ? (editDraft.tags as string[]).join(", ") : String(editDraft.tags ?? "")}
                      onChange={(e) =>
                        patchDraft(
                          "tags",
                          e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        )
                      }
                      style={{ padding: 10, borderRadius: 8, border: `1px solid ${T.border}` }}
                    />
                  </div>
                ) : (
                  <dl style={{ margin: 0, fontSize: 14 }}>
                    <dt style={{ color: T.textMuted, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>product_type</dt>
                    <dd style={{ margin: "4px 0 16px" }}>{fmt(display?.product_type)}</dd>
                    <dt style={{ color: T.textMuted, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>monthly_premium</dt>
                    <dd style={{ margin: "4px 0 16px" }}>{fmt(display?.monthly_premium)}</dd>
                    <dt style={{ color: T.textMuted, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>coverage_amount</dt>
                    <dd style={{ margin: "4px 0 16px" }}>{fmt(display?.coverage_amount)}</dd>
                    <dt style={{ color: T.textMuted, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>carrier</dt>
                    <dd style={{ margin: "4px 0 16px" }}>{fmt(display?.carrier)}</dd>
                    <dt style={{ color: T.textMuted, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>tags</dt>
                    <dd style={{ margin: "4px 0 16px" }}>
                      {tags.length ? tags.join(", ") : "—"}
                    </dd>
                  </dl>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
