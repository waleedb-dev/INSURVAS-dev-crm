"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { T } from "@/lib/theme";
import { formatDateTimeET } from "@/lib/time";
import { dateObjectToESTString, getTodayDateEST } from "./helpers";

type CallResultRow = {
  id: string;
  submission_id: string | null;
  lead_id: string | null;
  status: string | null;
  dq_reason: string | null;
  notes: string | null;
  generated_note: string | null;
  manual_note: string | null;
  quick_disposition_tag: string | null;
  updated_at: string | null;
};

type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  stage: string | null;
  created_at: string | null;
};

type SyncRowState = {
  key: string;
  callResultId: string;
  leadId: string;
  leadName: string;
  currentStage: string;
  /** From call_results.status (Transfer Portal stage name when not submitted). */
  sourceStatus: string;
  /** Editable target stage (pipeline_stages.name under Transfer Portal). */
  selectedStage: string;
  /** Human-readable reason / notes from call result (dq_reason or disposition fields). */
  reasonSummary: string | null;
  include: boolean;
  rowStatus: "idle" | "syncing" | "done" | "error";
  errorMessage?: string;
  /** `leads.created_at` (ISO) for Eastern date filtering */
  leadCreatedAtIso: string;
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

function summarizeCallResultReason(r: CallResultRow): string | null {
  const ordered = [
    r.dq_reason,
    r.quick_disposition_tag,
    r.generated_note,
    r.manual_note,
    r.notes,
  ]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
  const text = ordered[0];
  if (!text) return null;
  if (text.length <= REASON_SUMMARY_MAX) return text;
  return `${text.slice(0, REASON_SUMMARY_MAX - 1)}…`;
}

/** Normalises the UI placeholder for an empty lead stage. */
function normaliseStageLabel(label: string): string {
  const t = String(label ?? "").trim();
  if (t === "—" || t === "-") return "";
  return t;
}

function leadDayKeyEastern(createdAtIso: string): string {
  if (!String(createdAtIso || "").trim()) return "";
  const d = new Date(createdAtIso);
  if (Number.isNaN(d.getTime())) return "";
  return dateObjectToESTString(d);
}

function buildDdfSyncNoteBody(p: { currentStage: string; nextStage: string; reasonSummary: string | null }): string {
  const prev = normaliseStageLabel(p.currentStage);
  const next = String(p.nextStage ?? "").trim();
  let body = `Daily Deal Flow (sync not-submitted): lead stage updated from ${
    prev ? `"${prev}"` : "(none)"
  } to "${next}".`;
  const reason = String(p.reasonSummary ?? "").trim();
  if (reason) body += ` Disposition context: ${reason}`;
  return body;
}

export function DdfSyncNotSubmittedToLeadsModal({ open, onClose, supabase, dashboardRole, onSynced }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<SyncRowState[]>([]);
  const [transferPipelineId, setTransferPipelineId] = useState<number | null>(null);
  const [stageOptions, setStageOptions] = useState<{ id: number; name: string }[]>([]);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  /** YYYY-MM-DD in Eastern US, or "" to show all leads (`created_at`) */
  const [filterCreatedAtDateYmd, setFilterCreatedAtDateYmd] = useState(() => getTodayDateEST());

  const stageNames = useMemo(() => stageOptions.map((s) => s.name), [stageOptions]);

  const displayRows = useMemo(() => {
    if (!String(filterCreatedAtDateYmd || "").trim()) return rows;
    return rows.filter((r) => leadDayKeyEastern(r.leadCreatedAtIso) === filterCreatedAtDateYmd);
  }, [rows, filterCreatedAtDateYmd]);

  const selectOptions = useMemo(() => {
    const s = new Set(stageNames);
    rows.forEach((r) => {
      const v = r.selectedStage.trim();
      if (v) s.add(v);
    });
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [stageNames, rows]);

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

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setRows([]);
    try {
      await loadStages();
      const { data: crRows, error: crErr } = await supabase
        .from("call_results")
        .select(
          "id, submission_id, lead_id, status, dq_reason, notes, generated_note, manual_note, quick_disposition_tag, updated_at",
        )
        .eq("application_submitted", false)
        .order("updated_at", { ascending: false })
        .limit(400);
      if (crErr) throw new Error(crErr.message);

      const list = (crRows || []) as CallResultRow[];
      const bySubmission = new Map<string, CallResultRow>();
      for (const r of list) {
        const sid = String(r.submission_id || "").trim();
        if (!sid) continue;
        if (!bySubmission.has(sid)) bySubmission.set(sid, r);
      }

      const unique = [...bySubmission.values()].filter((r) => {
        const st = String(r.status || "").trim();
        return st.length > 0;
      });

      const leadIds = [...new Set(unique.map((r) => String(r.lead_id || "").trim()).filter(Boolean))];
      let leadById = new Map<string, LeadRow>();
      if (leadIds.length) {
        const { data: leads, error: lErr } = await supabase
          .from("leads")
          .select("id, first_name, last_name, stage, created_at")
          .in("id", leadIds);
        if (lErr) throw new Error(lErr.message);
        for (const L of leads || []) {
          leadById.set(String((L as LeadRow).id), L as LeadRow);
        }
      }

      const next: SyncRowState[] = [];
      for (const r of unique) {
        const leadId = String(r.lead_id || "").trim();
        if (!leadId) continue;
        const lead = leadById.get(leadId);
        if (!lead) continue;
        const sourceStatus = String(r.status || "").trim();
        const current = String(lead.stage || "").trim();
        const drift = current !== sourceStatus;
        const createdAtIso = lead.created_at != null ? String(lead.created_at) : "";
        next.push({
          key: `${r.id}-${leadId}`,
          callResultId: r.id,
          leadId,
          leadName: leadDisplayName(lead),
          currentStage: current || "—",
          sourceStatus,
          selectedStage: sourceStatus,
          reasonSummary: summarizeCallResultReason(r),
          include: drift,
          rowStatus: "idle",
          leadCreatedAtIso: createdAtIso,
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
    void loadCandidates();
  }, [open, loadCandidates]);

  const patchRow = (key: string, patch: Partial<SyncRowState>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const setSelectedStage = (key: string, name: string) => {
    patchRow(key, { selectedStage: name });
  };

  const syncOne = async (row: SyncRowState): Promise<boolean> => {
    if (!transferPipelineId) {
      patchRow(row.key, { rowStatus: "error", errorMessage: "Transfer Portal pipeline not found." });
      return false;
    }
    const stageName = row.selectedStage.trim();
    if (!stageName) {
      patchRow(row.key, { rowStatus: "error", errorMessage: "Select a target stage." });
      return false;
    }
    const stageRow = stageOptions.find((s) => s.name === stageName);
    const leadUpdate: Record<string, unknown> = {
      stage: stageName,
      updated_at: new Date().toISOString(),
      pipeline_id: transferPipelineId,
    };
    if (stageRow) leadUpdate.stage_id = stageRow.id;

    const { error } = await supabase.from("leads").update(leadUpdate).eq("id", row.leadId);
    if (error) {
      patchRow(row.key, { rowStatus: "error", errorMessage: error.message });
      return false;
    }

    const prevNorm = normaliseStageLabel(row.currentStage);
    const noteWorthy = prevNorm !== stageName;
    if (noteWorthy) {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const user = authData?.user;
      if (authErr || !user) {
        patchRow(row.key, {
          rowStatus: "error",
          errorMessage: "Stage was updated, but a lead note could not be added: not signed in.",
        });
        return false;
      }
      const body = buildDdfSyncNoteBody({ currentStage: row.currentStage, nextStage: stageName, reasonSummary: row.reasonSummary });
      const { error: noteError } = await supabase.from("lead_notes").insert({
        lead_id: row.leadId,
        body,
        created_by: user.id,
      });
      if (noteError) {
        patchRow(row.key, {
          rowStatus: "error",
          errorMessage: `Stage was updated, but the lead note was not saved: ${noteError.message}`,
        });
        return false;
      }
    }

    patchRow(row.key, { rowStatus: "done", errorMessage: undefined, currentStage: stageName });
    return true;
  };

  const handleSyncSelected = async () => {
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

  const selectedCount = displayRows.filter((r) => r.include && r.rowStatus !== "done").length;
  const driftCount = displayRows.filter((r) => r.currentStage !== r.selectedStage && r.rowStatus !== "done").length;

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
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
          maxWidth: 1400,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#fff",
          borderRadius: 16,
          border: `1.5px solid ${T.border}`,
          boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${T.borderLight}`, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.textDark }}>Sync not-submitted → Lead stage</h2>
          {loadError && <p style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 700, color: "#b91c1c" }}>{loadError}</p>}
        </div>

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
          <span style={{ fontSize: 13, fontWeight: 600, color: T.textDark }}>Filter: lead created at (Eastern US)</span>
          <input
            type="date"
            value={filterCreatedAtDateYmd}
            onChange={(e) => setFilterCreatedAtDateYmd(e.target.value)}
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
            onClick={() => setFilterCreatedAtDateYmd("")}
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
            onClick={() => setFilterCreatedAtDateYmd(getTodayDateEST())}
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
            <p style={{ margin: 0, color: T.textMuted, fontWeight: 600 }}>Loading…</p>
          ) : rows.length === 0 ? (
            <p style={{ margin: 0, color: T.textMuted, fontWeight: 600 }}>
              No matching call results (not submitted with a saved disposition status), or leads could not be resolved.
            </p>
          ) : displayRows.length === 0 ? (
            <p style={{ margin: 0, color: T.textMuted, fontWeight: 600 }}>
              No leads for the selected &quot;created at&quot; day (Eastern US). Try another day, or &quot;All dates&quot; to list everyone.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", color: T.textMuted, fontWeight: 800 }}>
                  <th style={{ padding: "8px 6px", width: 36 }}> </th>
                  <th style={{ padding: "8px 6px" }}>Lead</th>
                  <th style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>created_at (Eastern US)</th>
                  <th style={{ padding: "8px 6px" }}>Current lead stage</th>
                  <th style={{ padding: "8px 6px" }}>Target stage</th>
                  <th style={{ padding: "8px 6px" }}>Reason (call result)</th>
                  <th style={{ padding: "8px 6px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r) => {
                  const href = `/dashboard/${dashboardRole}/transfer-leads/${r.leadId}`;
                  return (
                    <tr key={r.key} style={{ borderTop: `1px solid ${T.borderLight}` }}>
                      <td style={{ padding: "10px 6px", verticalAlign: "middle" }}>
                        <input
                          type="checkbox"
                          checked={r.include}
                          disabled={r.rowStatus === "done" || r.rowStatus === "syncing"}
                          onChange={(e) => patchRow(r.key, { include: e.target.checked })}
                        />
                      </td>
                      <td style={{ padding: "10px 6px", verticalAlign: "middle", fontWeight: 700 }}>
                        <Link href={href} style={{ color: T.blue, textDecoration: "underline" }} target="_blank" rel="noreferrer">
                          {r.leadName}
                        </Link>
                      </td>
                      <td style={{ padding: "10px 6px", verticalAlign: "middle", color: T.textMid, fontSize: 11, whiteSpace: "nowrap" }} title="leads.created_at, Eastern US">
                        {r.leadCreatedAtIso ? formatDateTimeET(r.leadCreatedAtIso) : "—"}
                      </td>
                      <td style={{ padding: "10px 6px", verticalAlign: "middle" }}>{r.currentStage}</td>
                      <td style={{ padding: "10px 6px", verticalAlign: "middle", minWidth: 200 }}>
                        {selectOptions.length ? (
                          <select
                            value={r.selectedStage}
                            onChange={(e) => setSelectedStage(r.key, e.target.value)}
                            disabled={r.rowStatus === "done" || r.rowStatus === "syncing"}
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: `1.5px solid ${T.border}`,
                              fontSize: 12,
                              fontWeight: 600,
                              backgroundColor: "#fff",
                            }}
                          >
                            {selectOptions.map((name) => (
                              <option key={name} value={name}>
                                {name}
                                {!stageNames.includes(name) ? " (not in Transfer Portal list)" : ""}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={r.selectedStage}
                            onChange={(e) => setSelectedStage(r.key, e.target.value)}
                            disabled={r.rowStatus === "done" || r.rowStatus === "syncing"}
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
                      <td style={{ padding: "10px 6px", verticalAlign: "middle", color: T.textMid, maxWidth: 160 }}>
                        {r.reasonSummary || "—"}
                      </td>
                      <td style={{ padding: "10px 6px", verticalAlign: "middle" }}>
                        {r.rowStatus === "idle" && (
                          <span style={{ fontWeight: 700, color: r.currentStage !== r.selectedStage ? "#c2410c" : T.textMuted }}>
                            {r.currentStage !== r.selectedStage ? "Needs sync" : "Matches"}
                          </span>
                        )}
                        {r.rowStatus === "syncing" && (
                          <span style={{ fontWeight: 800, color: T.blue }}>Syncing…</span>
                        )}
                        {r.rowStatus === "done" && (
                          <span style={{ fontWeight: 800, color: "#16a34a" }}>Synced</span>
                        )}
                        {r.rowStatus === "error" && (
                          <span style={{ fontWeight: 700, color: "#b91c1c" }} title={r.errorMessage}>
                            Error
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
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>
            {driftCount} different from lead stage · {selectedCount} selected to sync
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 40,
                padding: "0 18px",
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: "#fff",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: T.font,
              }}
            >
              Close
            </button>
            <button
              type="button"
              disabled={bulkSyncing || selectedCount === 0 || !transferPipelineId}
              onClick={() => void handleSyncSelected()}
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
              }}
            >
              {bulkSyncing ? "Syncing…" : "Sync selected to leads"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
