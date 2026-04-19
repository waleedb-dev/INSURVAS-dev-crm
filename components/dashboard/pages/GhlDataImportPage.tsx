"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { T } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, RefreshCw, Database, Users } from "lucide-react";
import * as XLSX from "xlsx";

type CallCenterRow = {
  id: string;
  name: string;
  ghl_token: string | null;
  slack_channel: string | null;
};

type PipelineRow = {
  id: string;
  name: string;
};

type StageRow = {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
};

type XlsxRow = {
  "Contact Name"?: string;
  "phone"?: string;
  "Opportunity ID"?: string;
  "Contact ID"?: string;
  "pipeline"?: string;
  "stage"?: string;
  "Lead Value"?: string | number;
};

type ImportResult = {
  rowIndex: number;
  contactName: string;
  phone: string;
  opportunityId: string;
  status: "inserted" | "skipped" | "error";
  reason?: string;
  leadId?: string;
};

type ImportProgress = {
  total: number;
  processed: number;
  inserted: number;
  skipped: number;
  errors: number;
};

const MAX_PARALLEL_REQUESTS = 5;
const BATCH_SIZE = 10;

export default function GhlDataImportPage() {
  const { currentRole } = useDashboardContext();
  if (currentRole !== "system_admin") {
    return <AccessRestricted />;
  }
  return <GhlDataImportPageInner />;
}

function AccessRestricted() {
  return (
    <div
      style={{
        fontFamily: T.font,
        padding: "60px 20px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          padding: "32px 28px",
          borderRadius: 20,
          border: `1px solid ${T.border}`,
          background: T.cardBg,
          textAlign: "center",
          boxShadow: "0 12px 32px rgba(15, 23, 13, 0.06)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "#eef5ee",
            color: "#233217",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <AlertCircle size={24} />
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            color: "#233217",
            letterSpacing: "-0.01em",
          }}
        >
          Restricted to system admins
        </h2>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13,
            color: T.textMuted,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          GHL Data Import allows bulk importing leads from GoHighLevel opportunities.
          Only system administrators are permitted to use this feature.
        </p>
      </div>
    </div>
  );
}

function GhlDataImportPageInner() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [callCenters, setCallCenters] = useState<CallCenterRow[]>([]);
  const [selectedCallCenterId, setSelectedCallCenterId] = useState<string>("");
  const [selectedCallCenter, setSelectedCallCenter] = useState<CallCenterRow | null>(null);
  const [loadingCenters, setLoadingCenters] = useState(true);

  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);
  const [stages, setStages] = useState<StageRow[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<XlsxRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({ total: 0, processed: 0, inserted: 0, skipped: 0, errors: 0 });
  const [results, setResults] = useState<ImportResult[]>([]);
  const [importComplete, setImportComplete] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    async function loadCallCenters() {
      setLoadingCenters(true);
      const { data, error } = await supabase
        .from("call_centers")
        .select("id, name, ghl_token, slack_channel")
        .order("name");
      if (error) {
        console.error("Error loading call centers:", error);
      } else {
        setCallCenters(data || []);
      }
      setLoadingCenters(false);
    }
    void loadCallCenters();
  }, [supabase]);

  useEffect(() => {
    if (selectedCallCenterId) {
      const cc = callCenters.find(c => c.id === selectedCallCenterId);
      setSelectedCallCenter(cc || null);
    } else {
      setSelectedCallCenter(null);
    }
  }, [selectedCallCenterId, callCenters]);

  const loadLookups = useCallback(async () => {
    setLoadingLookups(true);
    const [pipelinesRes, stagesRes] = await Promise.all([
      supabase.from("pipelines").select("id, name").order("name"),
      supabase.from("pipeline_stages").select("id, pipeline_id, name, position").order("pipeline_id").order("position"),
    ]);
    setPipelines(pipelinesRes.data || []);
    setStages(stagesRes.data || []);
    setLoadingLookups(false);
  }, [supabase]);

  useEffect(() => {
    if (selectedCallCenterId) {
      void loadLookups();
    }
  }, [selectedCallCenterId, loadLookups]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      setParseError("Please select a valid Excel file (.xlsx or .xls)");
      setFile(null);
      setParsedRows([]);
      return;
    }

    setFile(selectedFile);
    setParseError(null);
    setParsedRows([]);
    setImportComplete(false);
    setResults([]);
    setProgress({ total: 0, processed: 0, inserted: 0, skipped: 0, errors: 0 });
  }, []);

  const parseFile = useCallback(async () => {
    if (!file) return;

    setParsing(true);
    setParseError(null);
    setParsedRows([]);
    setImportComplete(false);
    setResults([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<XlsxRow>(worksheet, { defval: "" });

      const requiredCols = ["Contact Name", "phone", "Opportunity ID", "Contact ID", "pipeline", "stage"];
      const headers = Object.keys(jsonData[0] || {});
      const missing = requiredCols.filter(col => !headers.includes(col));
      if (missing.length > 0) {
        setParseError(`Missing required columns: ${missing.join(", ")}`);
        setParsing(false);
        return;
      }

      setParsedRows(jsonData);
      setProgress(prev => ({ ...prev, total: jsonData.length }));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse Excel file");
    } finally {
      setParsing(false);
    }
  }, [file]);

  const splitName = (fullName: string): { firstName: string; lastName: string } => {
    const trimmed = (fullName || "").trim();
    const lastSpaceIndex = trimmed.lastIndexOf(" ");
    if (lastSpaceIndex > 0) {
      return { firstName: trimmed.slice(0, lastSpaceIndex), lastName: trimmed.slice(lastSpaceIndex + 1) };
    }
    return { firstName: trimmed, lastName: "" };
  };

  const stripHtml = (text: string): string => {
    if (!text) return "";
    return text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const fetchGhlNotes = async (contactId: string, ghlApiKey: string): Promise<Array<{ body: string; dateAdded: string | null }>> => {
    if (!ghlApiKey || !contactId) return [];

    try {
      const response = await fetch(
        `https://services.leadconnectorhq.com/contacts/${contactId}/notes`,
        {
          headers: {
            Authorization: `Bearer ${ghlApiKey}`,
            Version: "2021-07-28",
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      const rawNotes = Array.isArray(data) ? data : (data.notes || []);

      const seen = new Set<string>();
      const uniqueNotes: Array<{ body: string; dateAdded: string | null }> = [];

      for (const n of rawNotes) {
        const body = stripHtml(n.body || "");
        if (!body) continue;
        const key = body.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        uniqueNotes.push({ body, dateAdded: n.dateAdded || null });
      }

      return uniqueNotes;
    } catch {
      return [];
    }
  };

  const getStageId = (pipelineName: string, stageName: string): string | null => {
    const pipeline = pipelines.find(p => p.name.toLowerCase() === pipelineName.toLowerCase());
    if (!pipeline) return null;

    const stage = stages.find(
      s => s.pipeline_id === pipeline.id && s.name.toLowerCase() === stageName.toLowerCase()
    );
    return stage?.id || null;
  };

  const runImport = useCallback(async () => {
    if (!selectedCallCenter || !selectedCallCenter.ghl_token) {
      setImportError("Selected call center does not have a GHL token configured");
      return;
    }

    if (parsedRows.length === 0) {
      setImportError("No data to import. Please upload a file first.");
      return;
    }

    setImporting(true);
    setImportComplete(false);
    setImportError(null);
    setResults([]);
    abortRef.current = false;

    const { data: userData } = await supabase.auth.getSession();
    if (!userData.session?.user) {
      setImportError("User not authenticated");
      setImporting(false);
      return;
    }
    const submittedBy = userData.session.user.id;

    const pipelineByName = new Map(pipelines.map(p => [p.name.toLowerCase(), p.id]));
    const stageByKey = new Map<string, string>();
    for (const s of stages) {
      stageByKey.set(`${s.pipeline_id}::${s.name.toLowerCase()}`, s.id);
    }

    const newProgress: ImportProgress = { total: parsedRows.length, processed: 0, inserted: 0, skipped: 0, errors: 0 };
    const newResults: ImportResult[] = [];

    const rowsWithIndex = parsedRows.map((row, idx) => ({ row, index: idx + 2 }));
    const queue = [...rowsWithIndex];
    const inProgress: Set<number> = new Set();
    const leadIdMap = new Map<string, string>();

    const processNext = async (): Promise<void> => {
      while (queue.length > 0 && inProgress.size < MAX_PARALLEL_REQUESTS && !abortRef.current) {
        const item = queue.shift();
        if (!item) break;
        inProgress.add(item.index);

        const { row, index } = item;
        const contactName = String(row["Contact Name"] || "").trim();
        const phone = String(row["phone"] || "").trim();
        const opportunityId = String(row["Opportunity ID"] || "").trim();
        const contactId = String(row["Contact ID"] || "").trim();
        const pipelineName = String(row["pipeline"] || "").trim();
        const stageName = String(row["stage"] || "").trim();
        const rawValue = row["Lead Value"];

        if (!contactName || !opportunityId) {
          newResults.push({
            rowIndex: index,
            contactName,
            phone,
            opportunityId,
            status: "skipped",
            reason: "Missing contact name or opportunity ID",
          });
          newProgress.skipped++;
          newProgress.processed++;
          inProgress.delete(index);
          setProgress({ ...newProgress });
          setResults([...newResults]);
          continue;
        }

        try {
          const { firstName, lastName } = splitName(contactName);
          const leadValue = rawValue != null && rawValue !== "" ? parseFloat(String(rawValue)) : null;

          const pipelineId = pipelineByName.get(pipelineName.toLowerCase());
          if (!pipelineId) {
            newResults.push({
              rowIndex: index,
              contactName,
              phone,
              opportunityId,
              status: "skipped",
              reason: `Pipeline "${pipelineName}" not found`,
            });
            newProgress.skipped++;
            newProgress.processed++;
            inProgress.delete(index);
            setProgress({ ...newProgress });
            setResults([...newResults]);
            continue;
          }

          const stageId = stageByKey.get(`${pipelineId}::${stageName.toLowerCase()}`) || null;

          const leadRow: Record<string, unknown> = {
            first_name: firstName,
            last_name: lastName,
            phone,
            submission_id: opportunityId,
            contact_id: contactId,
            lead_unique_id: `${phone}_${contactName.replace(/ /g, "_")}`,
            pipeline_id: pipelineId,
            stage_id: stageId,
            stage: stageName,
            call_center_id: selectedCallCenter.id,
            submitted_by: submittedBy,
            lead_source: selectedCallCenter.name,
          };

          if (leadValue != null && !isNaN(leadValue)) {
            leadRow.lead_value = leadValue;
          }

          const { data: insertedLead, error: insertError } = await supabase
            .from("leads")
            .insert(leadRow)
            .select("id")
            .single();

          if (insertError || !insertedLead) {
            newResults.push({
              rowIndex: index,
              contactName,
              phone,
              opportunityId,
              status: "error",
              reason: insertError?.message || "Insert failed",
            });
            newProgress.errors++;
          } else {
            leadIdMap.set(String(index), insertedLead.id);
            newResults.push({
              rowIndex: index,
              contactName,
              phone,
              opportunityId,
              status: "inserted",
              leadId: insertedLead.id,
            });
            newProgress.inserted++;

            if (contactId) {
              const notes = await fetchGhlNotes(contactId, selectedCallCenter.ghl_token!);
              if (notes.length > 0) {
                const notesToInsert = notes.map(note => ({
                  lead_id: insertedLead.id,
                  body: note.body,
                  created_by: submittedBy,
                  ...(note.dateAdded ? { created_at: note.dateAdded } : {}),
                }));

                await supabase.from("lead_notes").insert(notesToInsert);
              }
            }
          }
        } catch (err) {
          newResults.push({
            rowIndex: index,
            contactName,
            phone,
            opportunityId,
            status: "error",
            reason: err instanceof Error ? err.message : "Unknown error",
          });
          newProgress.errors++;
        }

        newProgress.processed++;
        inProgress.delete(index);
        setProgress({ ...newProgress });
        setResults([...newResults]);
      }

      if (queue.length > 0 && inProgress.size > 0 && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
        await processNext();
      }
    };

    const workers = Array.from({ length: MAX_PARALLEL_REQUESTS }, () => processNext());
    await Promise.all(workers);

    setImportComplete(true);
    setImporting(false);
  }, [parsedRows, selectedCallCenter, pipelines, stages, supabase]);

  const cancelImport = () => {
    abortRef.current = true;
    setImporting(false);
  };

  const resetImport = () => {
    setFile(null);
    setParsedRows([]);
    setParseError(null);
    setImportComplete(false);
    setImportError(null);
    setResults([]);
    setProgress({ total: 0, processed: 0, inserted: 0, skipped: 0, errors: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <div style={{ fontFamily: T.font, padding: 0, animation: "fadeIn 0.3s ease-out" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#233217", letterSpacing: "-0.01em" }}>
          GHL Data Import
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: T.textMuted, fontWeight: 500, lineHeight: 1.55 }}>
          Import leads from GoHighLevel opportunities XLSX export. Upload your file, select a call center,
          and the system will process the data in parallel.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 24 }}>
        <Card style={{ borderRadius: 16, border: `1px solid ${T.border}`, borderBottom: "4px solid #233217", padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ color: "#233217", backgroundColor: "#eef5ee", width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Database size={18} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#233217", textTransform: "uppercase", letterSpacing: "0.45px" }}>
                Call Centers
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#233217" }}>
                {loadingCenters ? "..." : callCenters.length}
              </div>
            </div>
          </div>
        </Card>

        <Card style={{ borderRadius: 16, border: `1px solid ${T.border}`, borderBottom: "4px solid #638b4b", padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ color: "#638b4b", backgroundColor: "#eef5ee", width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#233217", textTransform: "uppercase", letterSpacing: "0.45px" }}>
                Rows Ready
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#638b4b" }}>
                {parsedRows.length}
              </div>
            </div>
          </div>
        </Card>

        <Card style={{ borderRadius: 16, border: `1px solid ${T.border}`, borderBottom: "4px solid #d97706", padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ color: "#d97706", backgroundColor: "#fffbeb", width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={18} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#233217", textTransform: "uppercase", letterSpacing: "0.45px" }}>
                Imported
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#d97706" }}>
                {progress.inserted}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card style={{ borderRadius: 16, border: `1px solid ${T.border}`, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 800, color: "#233217" }}>
            Configuration
          </h3>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Call Center <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <select
              value={selectedCallCenterId}
              onChange={(e) => setSelectedCallCenterId(e.target.value)}
              disabled={loadingCenters || importing}
              style={{
                width: "100%",
                height: 42,
                padding: "0 14px",
                borderRadius: 10,
                border: `1.5px solid ${T.border}`,
                fontSize: 14,
                color: selectedCallCenterId ? T.textDark : T.textMuted,
                backgroundColor: "#fff",
                fontFamily: T.font,
                cursor: loadingCenters || importing ? "not-allowed" : "pointer",
                outline: "none",
              }}
            >
              <option value="">{loadingCenters ? "Loading call centers..." : "Select a call center"}</option>
              {callCenters.map(cc => (
                <option key={cc.id} value={cc.id}>
                  {cc.name} {!cc.ghl_token ? "(No GHL Token)" : ""}
                </option>
              ))}
            </select>
            {selectedCallCenter && !selectedCallCenter.ghl_token && (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#d97706", fontWeight: 600 }}>
                This call center does not have a GHL token configured. Please add it in BPO Centres settings.
              </p>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.4px" }}>
              XLSX File <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              disabled={importing}
              style={{
                width: "100%",
                height: 42,
                padding: "8px 14px",
                borderRadius: 10,
                border: `1.5px solid ${T.border}`,
                fontSize: 14,
                color: T.textDark,
                backgroundColor: "#fff",
                fontFamily: T.font,
                cursor: importing ? "not-allowed" : "pointer",
                outline: "none",
              }}
            />
            {file && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <FileSpreadsheet size={16} style={{ color: "#638b4b" }} />
                <span style={{ fontSize: 13, color: T.textMid }}>{file.name}</span>
                <button
                  type="button"
                  onClick={() => { setFile(null); setParsedRows([]); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  disabled={importing}
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.textMuted }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {parseError && (
            <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <AlertCircle size={16} style={{ color: "#dc2626", marginTop: 2, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 13, color: "#b91c1c", fontWeight: 500 }}>{parseError}</p>
              </div>
            </div>
          )}

          {parsedRows.length > 0 && (
            <div style={{ marginBottom: 20, padding: 14, borderRadius: 10, backgroundColor: "#eef5ee", border: "1px solid #bbf7d0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <CheckCircle2 size={16} style={{ color: "#16a34a" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>
                  Ready to import {parsedRows.length} rows
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "#15803d" }}>
                {loadingLookups ? "Loading pipelines & stages..." : `Found ${pipelines.length} pipelines and ${stages.length} stages`}
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            {!parsedRows.length && (
              <button
                type="button"
                onClick={parseFile}
                disabled={!file || !selectedCallCenterId || parsing}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: !file || !selectedCallCenterId || parsing ? "#6b7b52" : "#233217",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: T.font,
                  cursor: !file || !selectedCallCenterId || parsing ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: !file || !selectedCallCenterId || parsing ? "none" : "0 4px 14px rgba(35, 50, 23, 0.25)",
                }}
              >
                {parsing ? <LoadingSpinner size={16} /> : <Upload size={16} />}
                {parsing ? "Parsing..." : "Parse File"}
              </button>
            )}

            {parsedRows.length > 0 && !importing && !importComplete && (
              <button
                type="button"
                onClick={runImport}
                disabled={!selectedCallCenter?.ghl_token}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: !selectedCallCenter?.ghl_token ? "#6b7b52" : "#16a34a",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: T.font,
                  cursor: !selectedCallCenter?.ghl_token ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: !selectedCallCenter?.ghl_token ? "none" : "0 4px 14px rgba(22, 163, 74, 0.3)",
                }}
              >
                <Database size={16} />
                Start Import
              </button>
            )}

            {importing && (
              <button
                type="button"
                onClick={cancelImport}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 10,
                  border: "1.5px solid #dc2626",
                  backgroundColor: "#fff",
                  color: "#dc2626",
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: T.font,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <X size={16} />
                Cancel
              </button>
            )}

            {(importComplete || importError) && (
              <button
                type="button"
                onClick={resetImport}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: "#233217",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: T.font,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <RefreshCw size={16} />
                Start Over
              </button>
            )}
          </div>
        </Card>

        <Card style={{ borderRadius: 16, border: `1px solid ${T.border}`, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 800, color: "#233217" }}>
            Progress
          </h3>

          {importing && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.textMid }}>Processing rows...</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#233217" }}>{progressPercent}%</span>
              </div>
              <div style={{ width: "100%", height: 8, borderRadius: 4, backgroundColor: T.borderLight, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    backgroundColor: "#233217",
                    borderRadius: 4,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontSize: 12, color: T.textMuted }}>{progress.processed} of {progress.total}</span>
                <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>{progress.inserted} inserted</span>
              </div>
            </div>
          )}

          {importComplete && (
            <div style={{ marginBottom: 20, padding: 16, borderRadius: 10, backgroundColor: "#eef5ee", border: "1px solid #bbf7d0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <CheckCircle2 size={20} style={{ color: "#16a34a" }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: "#166534" }}>Import Complete</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <div style={{ textAlign: "center", padding: 10, backgroundColor: "#fff", borderRadius: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a" }}>{progress.inserted}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase" }}>Inserted</div>
                </div>
                <div style={{ textAlign: "center", padding: 10, backgroundColor: "#fff", borderRadius: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#d97706" }}>{progress.skipped}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase" }}>Skipped</div>
                </div>
                <div style={{ textAlign: "center", padding: 10, backgroundColor: "#fff", borderRadius: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#dc2626" }}>{progress.errors}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase" }}>Errors</div>
                </div>
              </div>
            </div>
          )}

          {importError && (
            <div style={{ marginBottom: 20, padding: 14, borderRadius: 10, backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <AlertCircle size={16} style={{ color: "#dc2626", marginTop: 2, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 13, color: "#b91c1c", fontWeight: 500 }}>{importError}</p>
              </div>
            </div>
          )}

          <div style={{ maxHeight: 300, overflow: "auto" }}>
            {results.length === 0 && !importing && (
              <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>
                <FileSpreadsheet size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: 13 }}>No results yet. Upload a file and start import.</p>
              </div>
            )}

            {results.slice(0, 100).map((result, idx) => (
              <div
                key={idx}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  marginBottom: 6,
                  backgroundColor: result.status === "inserted" ? "#f0fdf4" : result.status === "skipped" ? "#fffbeb" : "#fef2f2",
                  border: `1px solid ${result.status === "inserted" ? "#bbf7d0" : result.status === "skipped" ? "#fde68a" : "#fecaca"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {result.status === "inserted" && <CheckCircle2 size={14} style={{ color: "#16a34a", flexShrink: 0 }} />}
                  {result.status === "skipped" && <AlertCircle size={14} style={{ color: "#d97706", flexShrink: 0 }} />}
                  {result.status === "error" && <AlertCircle size={14} style={{ color: "#dc2626", flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.textDark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {result.contactName || "Unnamed"} - {result.phone}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>
                      Row {result.rowIndex} | {result.opportunityId}
                    </div>
                  </div>
                </div>
                {result.reason && (
                  <div style={{ marginTop: 4, fontSize: 11, color: result.status === "error" ? "#dc2626" : "#d97706" }}>
                    {result.reason}
                  </div>
                )}
              </div>
            ))}

            {results.length > 100 && (
              <div style={{ padding: 12, textAlign: "center", fontSize: 12, color: T.textMuted }}>
                Showing first 100 of {results.length} results
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function LoadingSpinner({ size = 40, label }: { size?: number; label?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
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
      {label && <span style={{ fontSize: 12, fontWeight: 500, color: T.textMuted }}>{label}</span>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
