"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { T } from "@/lib/theme";
import { getTodayDateEST } from "./helpers";

type DailyDealFlowRow = {
  id: string;
  lead_id: string | null;
  submission_id: string | null;
  date: string | null;
  call_result: string | null;
  status: string | null;
  notes: string | null;
};

type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  stage: string | null;
  stage_id: number | null;
  created_at: string | null;
};

type SyncRowState = {
  key: string;
  callResultId: string;
  leadId: string;
  leadName: string;
  currentStage: string;
  currentStageId: number | null;
  sourceStatus: string;
  selectedStage: string;
  selectedStageId: number | null;
  notes: string | null;
  include: boolean;
  rowStatus: "idle" | "syncing" | "done" | "error";
  errorMessage?: string;
  callResultDate: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient;
  dashboardRole: string;
  onSynced?: () => void;
};

function leadDisplayName(lead: LeadRow) {
  const n = `${String(lead.first_name || "").trim()} ${String(lead.last_name || "").trim()}`.trim();
  return n || "Unnamed lead";
}

const REASON_SUMMARY_MAX = 200;

function getDdfNotes(r: DailyDealFlowRow): string {
  const ordered = [
    r.notes,
    r.call_result,
  ]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
  return ordered.join("\n---\n") || "";
}

function normaliseStageLabel(label: string): string {
  const t = String(label ?? "").trim();
  if (t === "—" || t === "-") return "";
  return t;
}

function buildDdfSyncNoteBody(p: { currentStage: string; nextStage: string; notes: string | null }): string {
  const prev = normaliseStageLabel(p.currentStage);
  const next = String(p.nextStage ?? "").trim();
  let body = `Daily Deal Flow (sync not-submitted): lead stage updated from ${
    prev ? `"${prev}"` : "(none)"
  } to "${next}".`;
  const notes = String(p.notes ?? "").trim();
  if (notes) body += `\n\nCall Notes:\n${notes}`;
  return body;
}

type StageOption = { id: number; name: string };

export function DdfSyncNotSubmittedToLeadsModal({ open, onClose, supabase, dashboardRole, onSynced }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<SyncRowState[]>([]);
  const [transferPipelineId, setTransferPipelineId] = useState<number | null>(null);
  const [stageOptions, setStageOptions] = useState<StageOption[]>([]);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [filterFromDate, setFilterFromDate] = useState(() => getTodayDateEST());
  const [filterToDate, setFilterToDate] = useState(() => getTodayDateEST());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const stageNames = useMemo(() => stageOptions.map((s) => s.name), [stageOptions]);

  const stageMapByName = useMemo(() => {
    const m = new Map<string, StageOption>();
    stageOptions.forEach(s => m.set(s.name, s));
    return m;
  }, [stageOptions]);

  const stageMapById = useMemo(() => {
    const m = new Map<number, StageOption>();
    stageOptions.forEach(s => m.set(s.id, s));
    return m;
  }, [stageOptions]);

  const displayRows = useMemo(() => {
    const from = filterFromDate;
    const to = filterToDate;
    if (!from && !to) return rows;
    return rows.filter((r) => {
      const d = r.callResultDate;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [rows, filterFromDate, filterToDate]);

  const selectOptions = useMemo(() => {
    const s = new Set(stageNames);
    rows.forEach((r) => {
      const v = r.selectedStage.trim();
      if (v) s.add(v);
    });
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [stageNames, rows]);

  const selectedCount = useMemo(() => {
    return displayRows.filter((r) => r.include && r.rowStatus !== "done").length;
  }, [displayRows]);

  const driftCount = useMemo(() => {
    return displayRows.filter((r) => r.currentStage !== r.selectedStage && r.rowStatus !== "done").length;
  }, [displayRows]);

  const allSelected = useMemo(() => {
    const selectable = displayRows.filter(r => r.rowStatus !== "done" && r.rowStatus !== "syncing");
    return selectable.length > 0 && selectable.every(r => r.include);
  }, [displayRows]);

  const noneSelected = useMemo(() => {
    return displayRows.every(r => !r.include || r.rowStatus === "done" || r.rowStatus === "syncing");
  }, [displayRows]);

  const loadStages = useCallback(async () => {
    const { data: tpPipeline, error: pErr } = await supabase.from("pipelines").select("id").eq("name", "Transfer Portal").maybeSingle();
    if (pErr || !tpPipeline?.id) {
      setTransferPipelineId(null);
      setStageOptions([]);
      return;
    }
    const pid = Number(tpPipeline.id);
    setTransferPipelineId(pid);
    const { data: stages, error: sErr } = await supabase
      .from("pipeline_stages")
      .select("id, name")
      .eq("pipeline_id", tpPipeline.id)
      .order("position", { ascending: true });
    if (sErr || !stages?.length) {
      setStageOptions([]);
      return;
    }
    setStageOptions(stages.map((r) => ({ id: Number(r.id), name: String(r.name || "").trim() })).filter((r) => r.name));
  }, [supabase]);

  const resolveStageId = useCallback(async (stageName: string): Promise<number | null> => {
    const matched = stageOptions.find(s => s.name === stageName);
    if (matched) return matched.id;
    const { data, error } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_id", transferPipelineId)
      .eq("name", stageName)
      .maybeSingle();
    if (error || !data) return null;
    return Number(data.id);
  }, [supabase, transferPipelineId, stageOptions]);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setRows([]);
    try {
      await loadStages();
      const { data: ddfRows, error: ddfErr } = await supabase
        .from("daily_deal_flow")
        .select("id, lead_id, submission_id, date, call_result, status, notes")
        .not("lead_id", "is", null)
        .order("date", { ascending: false })
        .limit(400);
      if (ddfErr) throw new Error(ddfErr.message);

      const list = (ddfRows || []) as DailyDealFlowRow[];
      if (list.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const bySubmission = new Map<string, DailyDealFlowRow>();
      for (const r of list) {
        const sid = String(r.submission_id || "").trim();
        if (!sid) continue;
        if (!bySubmission.has(sid)) bySubmission.set(sid, r);
      }

      const unique = [...bySubmission.values()];

      const leadIds = [...new Set(unique.map((r) => String(r.lead_id || "").trim()).filter(Boolean))];
      const leadById = new Map<string, LeadRow>();
      if (leadIds.length) {
        const { data: leads, error: lErr } = await supabase
          .from("leads")
          .select("id, first_name, last_name, stage, stage_id, created_at")
          .in("id", leadIds);
        if (lErr) throw new Error(lErr.message);
        for (const L of leads || []) {
          leadById.set(String((L as LeadRow).id), L as LeadRow);
        }
      }

      const currentStageOptions = stageOptions;

      const next: SyncRowState[] = [];
      for (const r of unique) {
        const leadId = String(r.lead_id || "").trim();
        if (!leadId) continue;

        const lead = leadById.get(leadId);
        if (!lead) continue;
        const sourceStatus = String(r.call_result || "").trim();
        const current = String(lead.stage || "").trim();
        const currentStageId = lead.stage_id != null ? Number(lead.stage_id) : null;

        const selectedStageName = sourceStatus;
        let selectedStageId: number | null = null;
        const stageFromMap = currentStageOptions.find(s => s.name === sourceStatus);
        if (stageFromMap) {
          selectedStageId = stageFromMap.id;
        }

        const drift = current !== sourceStatus;
        const callResultDate = r.date || "";
        next.push({
          key: `${r.id}-${leadId}`,
          callResultId: r.id,
          leadId,
          leadName: leadDisplayName(lead),
          currentStage: current || "—",
          currentStageId,
          sourceStatus,
          selectedStage: selectedStageName,
          selectedStageId,
          notes: getDdfNotes(r),
          include: drift,
          rowStatus: "idle",
          callResultDate,
        });
      }
      setRows(next);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load sync candidates.");
    } finally {
      setLoading(false);
    }
  }, [supabase, loadStages]);

  useEffect(() => {
    if (!open) return;
    void loadStages();
  }, [open, loadStages]);

  useEffect(() => {
    if (!open || transferPipelineId === null) return;
    void loadCandidates();
  }, [open, transferPipelineId]);

  const patchRow = (key: string, patch: Partial<SyncRowState>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const setSelectedStage = (key: string, name: string) => {
    const stage = stageMapByName.get(name);
    patchRow(key, { selectedStage: name, selectedStageId: stage?.id ?? null });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setRows(prev => prev.map(r => {
        if (r.rowStatus === "done" || r.rowStatus === "syncing") return r;
        return { ...r, include: false };
      }));
    } else {
      setRows(prev => prev.map(r => {
        if (r.rowStatus === "done" || r.rowStatus === "syncing") return r;
        return { ...r, include: true };
      }));
    }
  };

  const syncOne = async (row: SyncRowState): Promise<boolean> => {
    const stageName = row.selectedStage.trim();
    if (!stageName) {
      patchRow(row.key, { rowStatus: "error", errorMessage: "No target stage selected." });
      return false;
    }

    let stageId = row.selectedStageId;
    if (!stageId) {
      stageId = await resolveStageId(stageName);
    }

    if (!transferPipelineId) {
      patchRow(row.key, { rowStatus: "error", errorMessage: "Transfer Portal pipeline not found. Contact admin." });
      return false;
    }

    const stageRow = stageMapByName.get(stageName);
    const leadUpdate: Record<string, unknown> = {
      stage: stageName,
      updated_at: new Date().toISOString(),
      pipeline_id: transferPipelineId,
    };
    if (stageId) leadUpdate.stage_id = stageId;

    const { error: leadErr } = await supabase.from("leads").update(leadUpdate).eq("id", row.leadId);
    if (leadErr) {
      patchRow(row.key, { rowStatus: "error", errorMessage: `Lead update failed: ${leadErr.message}` });
      return false;
    }

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authErr || !user) {
      patchRow(row.key, { rowStatus: "error", errorMessage: "Lead was updated, but note could not be added: session error. Please refresh." });
      return false;
    }

    const body = buildDdfSyncNoteBody({ currentStage: row.currentStage, nextStage: stageName, notes: row.notes });
    const { error: noteError } = await supabase.from("lead_notes").insert({
      lead_id: row.leadId,
      body,
      created_by: user.id,
    });

    if (noteError) {
      patchRow(row.key, {
        rowStatus: "error",
        errorMessage: `Lead updated, but note failed: ${noteError.message}. Stage is correct.`,
      });
      return false;
    }

    const newStage = stageMapByName.get(stageName);
    patchRow(row.key, {
      rowStatus: "done",
      errorMessage: undefined,
      currentStage: stageName,
      currentStageId: newStage?.id ?? null,
    });
    return true;
  };

  const handleSyncSelected = async () => {
    setConfirmDialogOpen(false);
    const targets = displayRows.filter((r) => r.include && r.rowStatus !== "done");
    if (!targets.length) return;
    setBulkSyncing(true);
    let allSucceeded = true;
    for (const r of targets) {
      patchRow(r.key, { rowStatus: "syncing", errorMessage: undefined });
      const ok = await syncOne({ ...r, rowStatus: "syncing" });
      if (!ok) allSucceeded = false;
    }
    setBulkSyncing(false);
    onSynced?.();
    if (allSucceeded) onClose();
  };

  const retryRow = (key: string) => {
    patchRow(key, { rowStatus: "idle", errorMessage: undefined, include: true });
  };

  if (!open) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 3900,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "min(1400px, 98vw)",
            maxHeight: "90vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#fff",
            borderRadius: 16,
            border: `1.5px solid ${T.border}`,
            boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ padding: "18px 20px", borderBottom: `1px solid ${T.borderLight}`, flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.textDark }}>Sync not-submitted → Lead stage</h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: T.textMuted }}>Update lead stages and add sync notes from Daily Deal Flow dispositions</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => void loadCandidates()}
                disabled={loading || bulkSyncing}
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  color: T.textDark,
                  cursor: loading || bulkSyncing ? "not-allowed" : "pointer",
                  opacity: loading || bulkSyncing ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Refresh
              </button>
            </div>
          </div>
          {loadError && (
            <div style={{ padding: "10px 20px", backgroundColor: "#fef2f2", borderBottom: `1px solid #fecaca` }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#b91c1c" }}>Error: {loadError}</p>
            </div>
          )}

          <div
            style={{
              padding: "10px 20px",
              borderBottom: `1px solid ${T.borderLight}`,
              flexShrink: 0,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              backgroundColor: "#fafcff",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textDark }}>Date (ET):</span>
            <span style={{ fontSize: 12, color: T.textMid }}>From</span>
            <input
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                fontSize: 13,
                fontWeight: 600,
                color: T.textDark,
                fontFamily: T.font,
              }}
            />
            <span style={{ fontSize: 12, color: T.textMid }}>to</span>
            <input
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                fontSize: 13,
                fontWeight: 600,
                color: T.textDark,
                fontFamily: T.font,
              }}
            />
            <button
              type="button"
              onClick={() => { setFilterFromDate(""); setFilterToDate(""); }}
              style={{
                height: 36,
                padding: "0 12px",
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: "#fff",
                fontSize: 12,
                fontWeight: 700,
                color: T.textMid,
                cursor: "pointer",
                fontFamily: T.font,
              }}
            >
              All dates
            </button>
            <button
              type="button"
              onClick={() => { setFilterFromDate(getTodayDateEST()); setFilterToDate(getTodayDateEST()); }}
              style={{
                height: 36,
                padding: "0 12px",
                borderRadius: 8,
                border: "none",
                background: "#e8f0e4",
                fontSize: 12,
                fontWeight: 700,
                color: "#233217",
                cursor: "pointer",
                fontFamily: T.font,
              }}
            >
              Today (ET)
            </button>
          </div>

          <div style={{ padding: "12px 20px", flex: 1, overflow: "auto", minHeight: 0 }}>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${T.border}`, borderTopColor: "#233217", animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: T.textMuted }}>Loading sync candidates...</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : rows.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <p style={{ margin: 0, color: T.textMuted, fontWeight: 600, fontSize: 14 }}>
                  No leads to sync.<br />
                  <span style={{ fontWeight: 400, fontSize: 13 }}>All Daily Deal Flow entries have been synced or there are none to sync.</span>
                </p>
              </div>
            ) : displayRows.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <p style={{ margin: 0, color: T.textMuted, fontWeight: 600 }}>
                  No leads for selected date range. Try different dates or "All dates".
                </p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8faf5", textAlign: "left", color: T.textMuted, fontWeight: 800 }}>
                    <th style={{ padding: "8px 6px", width: 40 }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = !allSelected && !noneSelected; }}
                        onChange={toggleSelectAll}
                        style={{ width: 16, height: 16, accentColor: "#233217", cursor: "pointer" }}
                      />
                    </th>
                    <th style={{ padding: "8px 6px" }}>Lead</th>
                    <th style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>Date</th>
                    <th style={{ padding: "8px 6px" }}>Current Stage</th>
                    <th style={{ padding: "8px 6px" }}>Target Stage</th>
                    <th style={{ padding: "8px 6px" }}>Notes</th>
                    <th style={{ padding: "8px 6px", width: 100 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((r) => {
                    const href = `/dashboard/${dashboardRole}/transfer-leads/${r.leadId}`;
                    const isDone = r.rowStatus === "done";
                    const isError = r.rowStatus === "error";
                    const isSyncing = r.rowStatus === "syncing";
                    const bgColor = isDone ? "#f0fdf4" : isError ? "#fef2f2" : "transparent";

                    return (
                      <tr key={r.key} style={{ borderTop: `1px solid ${T.borderLight}`, backgroundColor: bgColor }}>
                        <td style={{ padding: "10px 6px", verticalAlign: "middle" }}>
                          <input
                            type="checkbox"
                            checked={r.include}
                            disabled={isDone || isSyncing}
                            onChange={(e) => patchRow(r.key, { include: e.target.checked })}
                            style={{ width: 16, height: 16, accentColor: "#233217", cursor: isDone || isSyncing ? "not-allowed" : "pointer" }}
                          />
                        </td>
                        <td style={{ padding: "10px 6px", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <Link href={href} style={{ color: T.blue, textDecoration: "underline", fontWeight: 700, fontSize: 13 }} target="_blank" rel="noreferrer">
                              {r.leadName}
                            </Link>
                            {isDone && <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>✓ Synced</span>}
                            {isError && <span style={{ fontSize: 10, color: "#b91c1c", fontWeight: 700 }}>✗ {r.errorMessage}</span>}
                          </div>
                        </td>
                        <td style={{ padding: "10px 6px", verticalAlign: "middle", color: T.textMid, fontSize: 11, whiteSpace: "nowrap" }}>
                          {r.callResultDate || "—"}
                        </td>
                        <td style={{ padding: "10px 6px", verticalAlign: "middle", fontWeight: 600 }}>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: 6,
                            backgroundColor: r.currentStage !== r.selectedStage ? "#fef3c7" : "#e8f0e4",
                            fontSize: 11,
                          }}>
                            {r.currentStage}
                          </span>
                        </td>
                        <td style={{ padding: "10px 6px", verticalAlign: "middle", minWidth: 180 }}>
                          {stageOptions.length ? (
                            <select
                              value={r.selectedStage}
                              onChange={(e) => setSelectedStage(r.key, e.target.value)}
                              disabled={isDone || isSyncing}
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: `1.5px solid ${isError ? "#b91c1c" : T.border}`,
                                fontSize: 12,
                                fontWeight: 600,
                                backgroundColor: "#fff",
                                color: T.textDark,
                              }}
                            >
                              {selectOptions.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                  {!stageNames.includes(name) ? " (custom)" : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={r.selectedStage}
                              onChange={(e) => setSelectedStage(r.key, e.target.value)}
                              disabled={isDone || isSyncing}
                              placeholder="Enter stage name"
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: `1.5px solid ${T.border}`,
                                fontSize: 12,
                              }}
                            />
                          )}
                        </td>
                        <td style={{ padding: "10px 6px", verticalAlign: "middle", color: T.textMid, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.notes || undefined}>
                          {r.notes || "—"}
                        </td>
                        <td style={{ padding: "10px 6px", verticalAlign: "middle" }}>
                          {isSyncing ? (
                            <span style={{ fontWeight: 800, color: T.blue, display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #93c5fd", borderTopColor: "#2563eb", animation: "spin 0.6s linear infinite" }} />
                              Syncing
                              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            </span>
                          ) : isDone ? (
                            <span style={{ fontWeight: 800, color: "#16a34a" }}>✓ Done</span>
                          ) : isError ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontWeight: 700, color: "#b91c1c", fontSize: 11 }}>Error</span>
                              <button
                                type="button"
                                onClick={() => retryRow(r.key)}
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  border: "1px solid #b91c1c",
                                  background: "#fef2f2",
                                  color: "#b91c1c",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Retry
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontWeight: 700, color: r.currentStage !== r.selectedStage ? "#c2410c" : T.textMuted, fontSize: 11 }}>
                              {r.currentStage !== r.selectedStage ? "⏳ Needs sync" : "✓ Matches"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div
            style={{
              padding: "14px 20px",
              borderTop: `1px solid ${T.borderLight}`,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexShrink: 0,
              backgroundColor: "#fafcff",
            }}
          >
            <div style={{ display: "flex", gap: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>
                <span style={{ color: "#c2410c" }}>{driftCount}</span> need sync · <span style={{ color: "#16a34a" }}>{displayRows.filter(r => r.rowStatus === "done").length}</span> synced
              </span>
              {selectedCount > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: T.blue }}>
                  {selectedCount} selected
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={bulkSyncing}
                style={{
                  height: 40,
                  padding: "0 18px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: "#fff",
                  fontWeight: 700,
                  cursor: bulkSyncing ? "not-allowed" : "pointer",
                  fontFamily: T.font,
                  opacity: bulkSyncing ? 0.6 : 1,
                }}
              >
                Close
              </button>
              <button
                type="button"
                disabled={bulkSyncing || selectedCount === 0 || !transferPipelineId}
                onClick={() => setConfirmDialogOpen(true)}
                style={{
                  height: 40,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: bulkSyncing || selectedCount === 0 || !transferPipelineId ? T.border : "#233217",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: bulkSyncing || selectedCount === 0 || !transferPipelineId ? "not-allowed" : "pointer",
                  fontFamily: T.font,
                  opacity: bulkSyncing || selectedCount === 0 ? 0.6 : 1,
                }}
                title={selectedCount === 0 ? "Select leads to sync" : ""}
              >
                {bulkSyncing ? "Syncing..." : `Sync ${selectedCount} leads`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirmDialogOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 4000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}>
          <div style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 24,
            maxWidth: 400,
            width: "100%",
            boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
          }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: T.textDark }}>Confirm Sync</h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: T.textMid }}>
              You are about to sync <strong>{selectedCount}</strong> lead(s) to new stages. Each lead will be updated and a note will be added to track the change.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setConfirmDialogOpen(false)}
                style={{
                  height: 38,
                  padding: "0 16px",
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: T.font,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSyncSelected()}
                style={{
                  height: 38,
                  padding: "0 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#233217",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: T.font,
                }}
              >
                Yes, sync leads
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}