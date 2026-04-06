"use client";

import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Button, Input, Pagination } from "@/components/ui";
import { T } from "@/lib/theme";
import { useCarrierProductDropdowns } from "@/lib/useCarrierProductDropdowns";
import { fetchCallRecording, formatDuration, formatTimestamp, searchAircallCalls } from "@/lib/aircall";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyDealFlowRow } from "./types";
import { Modal, SelectInput } from "./ui-primitives";
import {
  CALL_RESULT_OPTIONS,
  LA_CALLBACK_OPTIONS,
  STATUS_OPTIONS,
} from "./constants";
import { IconBolt, IconCheck, IconEye, IconPencil, IconPhone, IconTrash, IconX } from "@tabler/icons-react";
import { duplicateKey, formatDateShort, generatePendingApprovalNotes, getBadgeStyle, getCurrentTimestampEST, getGroupValue } from "./helpers";
import { LeadCard, InfoField, InfoGrid, formatCurrency, formatBool, formatDate } from "../LeadCard";
import { Table as ShadcnTable, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/shadcn/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const actionIconBtn: CSSProperties = {
  padding: 6,
  minWidth: 32,
  minHeight: 32,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

function dialHref(phone: string | null | undefined): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length > 0 ? `tel:${digits}` : null;
}

function InlineSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
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
          height: 34,
          borderRadius: 8,
          border: `1px solid ${T.border}`,
          backgroundColor: T.cardBg,
          color: value ? T.textDark : T.textMuted,
          fontSize: 12,
          fontWeight: 500,
          paddingLeft: 10,
          paddingRight: 10,
          transition: "all 0.15s ease-in-out",
          position: "relative",
          zIndex: 1,
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
          backgroundColor: T.cardBg,
          padding: 6,
          maxHeight: 250,
          zIndex: 99999,
        }}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            style={{
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
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

function InlineInput({
  value,
  onChange,
  type = "text",
  placeholder,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date";
  placeholder?: string;
  style?: CSSProperties;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        height: 34,
        borderRadius: 8,
        border: `1px solid ${T.border}`,
        backgroundColor: T.cardBg,
        color: T.textDark,
        fontSize: 12,
        fontWeight: 500,
        paddingLeft: 10,
        paddingRight: 10,
        transition: "all 0.15s ease-in-out",
        outline: "none",
        ...style,
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
  );
}

function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
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
          color: value ? T.textDark : T.textMuted,
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
          backgroundColor: T.cardBg,
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

type Props = {
  rows: DailyDealFlowRow[];
  currentPage: number;
  totalRecords: number;
  recordsPerPage: number;
  hasWritePermissions: boolean;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  supabase: SupabaseClient;
  leadVendorOptions: string[];
  bufferAgentOptions: string[];
  agentOptions: string[];
  retentionOptions: string[];
  licensedOptions: string[];
  carrierOptions: string[];
  groupBy: string;
  groupBySecondary: string;
};

type SortConfig = { key: string; direction: "asc" | "desc" } | null;

const columns = [
  "S.No", "Date", "Lead Vendor", "Insured Name", "Phone Number", "B.A", "R.A", "Agent", "L.A", "Status",
  "Call Result", "Carrier", "Product Type", "Draft Date", "MP", "Face Amount", "Notes",
];

function sortRows(items: DailyDealFlowRow[], sortConfig: SortConfig): DailyDealFlowRow[] {
  if (!sortConfig) return [...items].sort((a, b) => new Date(b.date || b.created_at || "").getTime() - new Date(a.date || a.created_at || "").getTime());
  return [...items].sort((a, b) => {
    let av: string | number | undefined | null = a[sortConfig.key as keyof DailyDealFlowRow] as string | number | undefined | null;
    let bv: string | number | undefined | null = b[sortConfig.key as keyof DailyDealFlowRow] as string | number | undefined | null;
    if (["date", "created_at", "updated_at", "draft_date"].includes(sortConfig.key)) {
      av = new Date(av || "1970-01-01").getTime();
      bv = new Date(bv || "1970-01-01").getTime();
    } else if (["monthly_premium", "face_amount"].includes(sortConfig.key)) {
      av = Number(av) || 0;
      bv = Number(bv) || 0;
    } else {
      av = String(av || "").toLowerCase();
      bv = String(bv || "").toLowerCase();
    }
    if (av < bv) return sortConfig.direction === "asc" ? -1 : 1;
    if (av > bv) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });
}

export function DdfGroupedGrid({
  rows,
  currentPage,
  totalRecords,
  recordsPerPage,
  hasWritePermissions,
  onPageChange,
  onRefresh,
  onError,
  onSuccess,
  supabase,
  leadVendorOptions,
  bufferAgentOptions,
  agentOptions,
  retentionOptions,
  licensedOptions,
  carrierOptions,
  groupBy,
  groupBySecondary,
}: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DailyDealFlowRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailTab, setDetailTab] = useState<"details" | "recordings">("details");
  const [detailEditing, setDetailEditing] = useState(false);
  const [callsLoading, setCallsLoading] = useState(false);
  const [loadingRecordingId, setLoadingRecordingId] = useState<number | null>(null);
  const [playingRecording, setPlayingRecording] = useState<number | null>(null);
  const [callRecordings, setCallRecordings] = useState<Array<{
    id: number;
    direction: string;
    status: string;
    duration: number;
    started_at: number;
    recording: string | null;
    user: { name: string } | null;
  }>>([]);
  const [dynamicCarrierOptions, setDynamicCarrierOptions] = useState<string[]>([]);
  const [notesTooltip, setNotesTooltip] = useState<{ id: string; text: string; x: number; y: number } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRow, setDeletingRow] = useState<DailyDealFlowRow | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deletingInProgress, setDeletingInProgress] = useState(false);
  const { carriers, productsForCarrier } = useCarrierProductDropdowns(supabase, {
    carrierName: String(draft?.carrier || ""),
    onInvalidateProduct: (list) => {
      if (!draft) return;
      const selected = String(draft.product_type || "").trim();
      if (!selected) return;
      if (list.some((x) => x.name === selected)) return;
      setDraft((prev) => (prev ? { ...prev, product_type: "" } : prev));
    },
  });

  useEffect(() => {
    const fromTable = (carrierOptions || []).map((x) => String(x).trim()).filter(Boolean);
    const fromCatalog = carriers.map((x) => String(x.name).trim()).filter(Boolean);
    setDynamicCarrierOptions(Array.from(new Set([...fromCatalog, ...fromTable])));
  }, [carrierOptions, carriers]);

  const duplicateRows = useMemo(() => {
    const seen = new Map<string, number>();
    const dup = new Set<string>();
    rows.forEach((r) => {
      const key = duplicateKey(r);
      const count = (seen.get(key) || 0) + 1;
      seen.set(key, count);
      if (count > 1) dup.add(key);
    });
    return dup;
  }, [rows]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return { groups: [], ungroupedData: sortRows(rows, null) };
    if (groupBySecondary === "none") {
      const map: Record<string, DailyDealFlowRow[]> = {};
      rows.forEach((r) => {
        const key = getGroupValue(r, groupBy);
        map[key] = map[key] || [];
        map[key].push(r);
      });
      const groups = Object.keys(map).sort().map((k) => ({ key: k, label: k, items: sortRows(map[k], sortConfig), count: map[k].length, subgroups: [] as Array<{ key: string; label: string; items: DailyDealFlowRow[]; count: number }> }));
      return { groups, ungroupedData: [] as DailyDealFlowRow[] };
    }
    const map: Record<string, Record<string, DailyDealFlowRow[]>> = {};
    rows.forEach((r) => {
      const p = getGroupValue(r, groupBy);
      const s = getGroupValue(r, groupBySecondary);
      map[p] = map[p] || {};
      map[p][s] = map[p][s] || [];
      map[p][s].push(r);
    });
    const groups = Object.keys(map).sort().map((pk) => ({
      key: pk,
      label: pk,
      items: [] as DailyDealFlowRow[],
      count: Object.values(map[pk]).flat().length,
      subgroups: Object.keys(map[pk]).sort().map((sk) => ({
        key: `${pk}::${sk}`,
        label: sk,
        items: sortRows(map[pk][sk], sortConfig),
        count: map[pk][sk].length,
      })),
    }));
    return { groups, ungroupedData: [] as DailyDealFlowRow[] };
  }, [rows, groupBy, groupBySecondary, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / recordsPerPage));
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + rows.length;

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const copy = new Set(prev);
      if (copy.has(key)) copy.delete(key);
      else copy.add(key);
      return copy;
    });
  };

  const beginEdit = (row: DailyDealFlowRow, detail = false) => {
    setEditingId(row.id);
    setDraft({ ...row });
    if (detail) {
      setDetailId(row.id);
      setDetailTab("details");
      setDetailEditing(false);
      setCallRecordings([]);
      setCallsLoading(false);
      setPlayingRecording(null);
      setLoadingRecordingId(null);
    }
  };

  const loadCallRecordings = async (phoneNumber: string | null | undefined) => {
    const phone = String(phoneNumber || "");
    if (!phone.trim()) {
      onError("No phone number available for this lead.");
      return;
    }
    setDetailTab("recordings");
    setCallsLoading(true);
    setCallRecordings([]);
    try {
      const calls = await searchAircallCalls(phone);
      setCallRecordings(
        calls.map((call) => ({
          id: call.id,
          direction: call.direction,
          status: call.status,
          duration: call.duration,
          started_at: call.started_at,
          recording: call.recording,
          user: call.user,
        })),
      );
    } catch {
      onError("Failed to load call recordings.");
    } finally {
      setCallsLoading(false);
    }
  };

  const saveRow = async (original: DailyDealFlowRow) => {
    if (!draft) return;
    setSaving(true);
    const payload: DailyDealFlowRow = { ...draft, updated_at: getCurrentTimestampEST() };
    if (draft.status === "Pending Approval" && original.status !== "Pending Approval") {
      const structured = generatePendingApprovalNotes(
        draft.licensed_agent_account || "",
        draft.carrier || "",
        draft.product_type || "",
        draft.monthly_premium || null,
        draft.face_amount || null,
        draft.draft_date || null,
      );
      payload.notes = `${structured}${draft.notes ? `\n\n${draft.notes}` : ""}`;
    }
    const { error } = await supabase.from("daily_deal_flow").update(payload).eq("id", original.id);
    setSaving(false);
    if (error) return onError(error.message || "Failed to save row.");
    setEditingId(null);
    setDetailId(null);
    setDetailEditing(false);
    setDraft(null);
    onSuccess("Row updated.");
    onRefresh();
  };

  const openDeleteModal = (row: DailyDealFlowRow) => {
    setDeletingRow(row);
    setDeleteConfirmName("");
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingRow(null);
    setDeleteConfirmName("");
    setDeletingInProgress(false);
  };

  const handleDeleteRow = async () => {
    if (!deletingRow) return;
    setDeletingInProgress(true);
    const { error } = await supabase.from("daily_deal_flow").delete().eq("id", deletingRow.id);
    setDeletingInProgress(false);
    if (error) {
      onError(error.message || "Failed to delete row.");
      closeDeleteModal();
      return;
    }
    onSuccess("Row deleted.");
    closeDeleteModal();
    onRefresh();
  };

  const markIncomplete = async (row: DailyDealFlowRow) => {
    const { error } = await supabase
      .from("daily_deal_flow")
      .update({ status: "Incomplete Transfer", call_result: "Not Submitted", notes: "Call never sent", updated_at: getCurrentTimestampEST() })
      .eq("id", row.id);
    if (error) return onError(error.message || "Failed to mark incomplete.");
    onSuccess("Marked as Incomplete Transfer.");
    onRefresh();
  };

  const rowCellStyle: CSSProperties = { borderBottom: `1px solid ${T.border}`, padding: "12px 16px", fontSize: 12, verticalAlign: "top", color: T.textDark };
  const showColumns = hasWritePermissions ? [...columns, "Actions"] : columns;
  const patchDraft = (patch: Partial<DailyDealFlowRow>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  const renderRow = (row: DailyDealFlowRow, serialNumber: number) => {
    const isEditing = editingId === row.id;
    const isDuplicate = duplicateRows.has(duplicateKey(row));
    const data = isEditing && draft ? draft : row;
    const hasNotes = Boolean(row.notes && row.notes.trim().length > 0);
    return (
      <TableRow key={row.id} style={{ background: isDuplicate ? "#FEF9E7" : "transparent", borderBottom: `1px solid ${T.border}` }} className="hover:bg-muted/30 transition-colors">
        <TableCell style={rowCellStyle}>{serialNumber}</TableCell>
        <TableCell style={rowCellStyle}>{isEditing ? <InlineInput type="date" value={data.date || ""} onChange={(v) => patchDraft({ date: v })} /> : formatDateShort(row.date) || "N/A"}</TableCell>
        <TableCell style={rowCellStyle}>
          {row.lead_vendor || "N/A"}
        </TableCell>
        <TableCell style={rowCellStyle}>{isEditing ? <InlineInput value={data.insured_name || ""} onChange={(v) => patchDraft({ insured_name: v })} /> : row.insured_name || "N/A"}</TableCell>
        <TableCell style={rowCellStyle}>{isEditing ? <InlineInput value={data.client_phone_number || ""} onChange={(v) => patchDraft({ client_phone_number: v })} /> : row.client_phone_number || "N/A"}</TableCell>
        <TableCell style={rowCellStyle}>{isEditing ? <InlineSelect value={data.buffer_agent || ""} onValueChange={(v) => patchDraft({ buffer_agent: v })} options={bufferAgentOptions.map((v) => ({ value: v, label: v }))} /> : row.buffer_agent || "N/A"}</TableCell>
        <TableCell style={rowCellStyle}>{isEditing ? <InlineSelect value={data.retention_agent || ""} onValueChange={(v) => patchDraft({ retention_agent: v })} options={retentionOptions.map((v) => ({ value: v, label: v }))} /> : row.retention_agent || "N/A"}</TableCell>
        <TableCell style={rowCellStyle}>{isEditing ? <InlineSelect value={data.agent || ""} onValueChange={(v) => patchDraft({ agent: v })} options={agentOptions.map((v) => ({ value: v, label: v }))} /> : row.agent || "N/A"}</TableCell>
        <TableCell style={rowCellStyle}>{isEditing ? <InlineSelect value={data.licensed_agent_account || ""} onValueChange={(v) => patchDraft({ licensed_agent_account: v })} options={licensedOptions.map((v) => ({ value: v, label: v }))} /> : row.licensed_agent_account || "N/A"}</TableCell>
        <TableCell style={rowCellStyle}>{isEditing ? <InlineSelect value={data.status || ""} onValueChange={(v) => patchDraft({ status: v })} options={STATUS_OPTIONS.map((v) => ({ value: v, label: v }))} /> : <span style={getBadgeStyle("status", row.status)}>{row.status || "N/A"}</span>}</TableCell>
        <TableCell style={rowCellStyle}>{isEditing ? <InlineSelect value={data.call_result || ""} onValueChange={(v) => patchDraft({ call_result: v })} options={CALL_RESULT_OPTIONS.map((v) => ({ value: v, label: v }))} /> : <span style={getBadgeStyle("result", row.call_result)}>{row.call_result || "N/A"}</span>}</TableCell>
        <TableCell style={rowCellStyle}>{isEditing ? <InlineSelect value={data.carrier || ""} onValueChange={(v) => patchDraft({ carrier: v, product_type: "" })} options={dynamicCarrierOptions.map((v) => ({ value: v, label: v }))} /> : row.carrier || "N/A"}</TableCell>
        <TableCell style={rowCellStyle}>{isEditing ? <InlineSelect value={data.product_type || ""} onValueChange={(v) => patchDraft({ product_type: v })} options={productsForCarrier.map((v) => ({ value: v.name, label: v.name }))} /> : row.product_type || "N/A"}</TableCell>
        <TableCell style={rowCellStyle}>{isEditing ? <InlineInput type="date" value={data.draft_date || ""} onChange={(v) => patchDraft({ draft_date: v })} /> : formatDateShort(row.draft_date) || "N/A"}</TableCell>
        <TableCell style={rowCellStyle}>{isEditing ? <InlineInput type="number" value={String(data.monthly_premium ?? "")} onChange={(v) => patchDraft({ monthly_premium: v ? Number(v) : null })} /> : row.monthly_premium ? `$${row.monthly_premium.toFixed(2)}` : "N/A"}</TableCell>
        <TableCell style={rowCellStyle}>{isEditing ? <InlineInput type="number" value={String(data.face_amount ?? "")} onChange={(v) => patchDraft({ face_amount: v ? Number(v) : null })} /> : row.face_amount ? `$${row.face_amount.toLocaleString()}` : "N/A"}</TableCell>
        <TableCell style={{ ...rowCellStyle, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
          {isEditing ? (
            <textarea value={data.notes || ""} onChange={(e) => patchDraft({ notes: e.target.value })} style={{ minHeight: 54, width: 100, borderRadius: 8, border: `1px solid ${T.border}`, backgroundColor: T.cardBg, color: T.textDark, fontSize: 12, padding: "8px 10px", resize: "vertical", outline: "none", transition: "all 0.15s ease-in-out" }} onFocus={(e) => { e.currentTarget.style.borderColor = "#233217"; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`; }} onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }} />
          ) : hasNotes ? (
            <div style={{ position: "relative", display: "inline-block" }}>
              <button
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setNotesTooltip({ id: row.id, text: row.notes || "", x: rect.left, y: rect.bottom + 8 });
                }}
                onMouseLeave={() => setNotesTooltip(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#233217",
                  padding: "2px 4px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                View Notes
              </button>
            </div>
          ) : (
            <span style={{ color: T.textMuted, fontStyle: "italic" }}>No notes</span>
          )}
        </TableCell>
        {hasWritePermissions && (
          <TableCell style={{ ...rowCellStyle, whiteSpace: "nowrap", minWidth: 210 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                flexWrap: "nowrap",
                flexShrink: 0,
              }}
            >
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => saveRow(row)}
                    disabled={saving}
                    aria-label="Save row"
                    title="Save"
                    style={actionIconBtn}
                  >
                    <IconCheck size={16} stroke={2} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => { setEditingId(null); setDraft(null); }}
                    aria-label="Cancel editing"
                    title="Cancel"
                    style={actionIconBtn}
                  >
                    <IconX size={16} stroke={2} />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => beginEdit(row)}
                    aria-label="Edit row"
                    title="Edit"
                    style={actionIconBtn}
                  >
                    <IconPencil size={16} stroke={2} />
                  </Button>
                  {!row.status && (
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => markIncomplete(row)}
                      aria-label="Mark incomplete (Zap)"
                      title="Mark incomplete"
                      style={{ ...actionIconBtn, color: T.warning, borderColor: T.blueLight, background: T.blueFaint }}
                    >
                      <IconBolt size={16} stroke={2} />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => beginEdit(row, true)}
                    aria-label="View details"
                    title="View"
                    style={actionIconBtn}
                  >
                    <IconEye size={16} stroke={2} />
                  </Button>
                  {(() => {
                    const href = dialHref(row.client_phone_number);
                    return href ? (
                      <a
                        href={href}
                        aria-label="Call phone number"
                        title="Call"
                        style={{
                          ...actionIconBtn,
                          border: `1.5px solid ${T.border}`,
                          borderRadius: 10,
                          color: T.success,
                          background: T.blueFaint,
                          textDecoration: "none",
                        }}
                      >
                        <IconPhone size={16} stroke={2} />
                      </a>
                    ) : (
                      <span
                        aria-label="No phone number"
                        title="No phone"
                        style={{
                          ...actionIconBtn,
                          opacity: 0.35,
                          cursor: "not-allowed",
                          border: `1.5px solid ${T.border}`,
                          borderRadius: 10,
                          color: T.textMuted,
                        }}
                      >
                        <IconPhone size={16} stroke={2} />
                      </span>
                    );
                  })()}
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => openDeleteModal(row)}
                    aria-label="Delete row"
                    title="Delete"
                    style={{ ...actionIconBtn, color: T.priorityHigh, borderColor: T.border }}
                  >
                    <IconTrash size={16} stroke={2} />
                  </Button>
                </>
              )}
            </div>
          </TableCell>
        )}
      </TableRow>
    );
  };

  return (
    <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <ShadcnTable>
          <TableHeader style={{ backgroundColor: "#233217" }}>
            <TableRow style={{ borderBottom: "none" }} className="hover:bg-transparent">
              {showColumns.map((col) => (
                <TableHead
                  key={col}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#ffffff",
                    textAlign: "left",
                    padding: "14px 16px",
                    whiteSpace: "nowrap",
                    letterSpacing: "0.3px",
                    ...(col === "Actions" ? { minWidth: 210 } : {}),
                  }}
                >
                  <button
                    onClick={() => {
                      const keyMap: Record<string, string> = { Date: "date", "Lead Vendor": "lead_vendor", "Insured Name": "insured_name", "Phone Number": "client_phone_number", "B.A": "buffer_agent", Agent: "agent", "L.A": "licensed_agent_account", Status: "status", "Call Result": "call_result", Carrier: "carrier", "Product Type": "product_type", "Draft Date": "draft_date", MP: "monthly_premium", "Face Amount": "face_amount", "LA Callback": "la_callback", Notes: "notes", "R.A": "retention_agent" };
                      const key = keyMap[col];
                      if (!key || groupBy === "none") return;
                      setSortConfig((prev) => (prev?.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
                    }}
                    style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "inherit", padding: 0, letterSpacing: "inherit" }}
                  >
                    {col}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupBy === "none" &&
              grouped.ungroupedData.map((row, idx) => renderRow(row, startIndex + idx + 1))}
            {groupBy !== "none" &&
              grouped.groups.map((group) => (
                <Fragment key={group.key}>
                  <TableRow key={`${group.key}-header`} style={{ background: "#EFF6EE", borderBottom: `1px solid ${T.border}` }}>
                    <TableCell colSpan={showColumns.length} style={{ padding: "10px 16px" }}>
                      <button onClick={() => toggleGroup(group.key)} style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 800, color: "#233217", fontSize: 13 }}>
                        {expandedGroups.has(group.key) ? "v" : ">"} {group.label} ({group.count})
                      </button>
                    </TableCell>
                  </TableRow>
                  {expandedGroups.has(group.key) &&
                    (groupBySecondary === "none"
                      ? group.items.map((row, i) => renderRow(row, startIndex + i + 1))
                      : group.subgroups.map((subgroup) => (
                          <Fragment key={subgroup.key}>
                            <TableRow key={`${subgroup.key}-header`} style={{ background: T.pageBg, borderBottom: `1px solid ${T.borderLight}` }}>
                              <TableCell colSpan={showColumns.length} style={{ padding: "8px 32px", borderBottom: `1px solid ${T.borderLight}` }}>
                                <button onClick={() => toggleGroup(subgroup.key)} style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 700, fontSize: 12, color: T.textMid }}>
                                  {expandedGroups.has(subgroup.key) ? "v" : ">"} {subgroup.label} ({subgroup.count})
                                </button>
                              </TableCell>
                            </TableRow>
                            {expandedGroups.has(subgroup.key) && subgroup.items.map((row: DailyDealFlowRow, i: number) => renderRow(row, startIndex + i + 1))}
                          </Fragment>
                        )))}
                </Fragment>
              ))}
          </TableBody>
        </ShadcnTable>
      </div>

      <Pagination
        page={currentPage}
        totalItems={totalRecords}
        itemsPerPage={recordsPerPage}
        itemLabel="entries"
        onPageChange={onPageChange}
      />

      <Modal open={Boolean(detailId) && Boolean(draft)} title={`Daily Deal Flow - ${draft?.insured_name || ""}`} onClose={() => { setDetailId(null); setDetailEditing(false); setDetailTab("details"); }}>
        {draft && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", gap: 4, padding: 4, backgroundColor: T.sidebarBg, borderRadius: 10 }}>
                <button
                  type="button"
                  onClick={() => { setDetailTab("details"); setDetailEditing(false); }}
                  style={{
                    height: 34,
                    padding: "0 14px",
                    borderRadius: 10,
                    border: "none",
                    background: detailTab === "details" && !detailEditing ? "#233217" : "transparent",
                    color: detailTab === "details" && !detailEditing ? "#fff" : T.textMuted,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease-in-out",
                  }}
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => { setDetailTab("details"); setDetailEditing(true); }}
                  style={{
                    height: 34,
                    padding: "0 14px",
                    borderRadius: 10,
                    border: "none",
                    background: detailTab === "details" && detailEditing ? "#233217" : "transparent",
                    color: detailTab === "details" && detailEditing ? "#fff" : T.textMuted,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease-in-out",
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void loadCallRecordings(draft.client_phone_number)}
                  style={{
                    height: 34,
                    padding: "0 14px",
                    borderRadius: 10,
                    border: "none",
                    background: detailTab === "recordings" ? "#233217" : "transparent",
                    color: detailTab === "recordings" ? "#fff" : T.textMuted,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease-in-out",
                  }}
                >
                  Call Records
                </button>
              </div>
              {detailEditing && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setDetailEditing(false); }}
                    style={{
                      height: 38,
                      padding: "0 16px",
                      borderRadius: 10,
                      border: `1px solid ${T.border}`,
                      background: "#fff",
                      color: T.textDark,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const source = rows.find((r) => r.id === detailId);
                      if (source) void saveRow(source);
                    }}
                    disabled={saving}
                    style={{
                      height: 38,
                      padding: "0 16px",
                      borderRadius: 10,
                      border: "none",
                      background: "#233217",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </div>

            {detailTab === "details" && !detailEditing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <LeadCard icon="👤" title="Contact Information" subtitle="Lead contact and identification details">
                  <InfoGrid columns={3}>
                    <InfoField label="Insured Name" value={draft.insured_name} />
                    <InfoField label="Phone Number" value={draft.client_phone_number} />
                    <InfoField label="Lead Vendor" value={draft.lead_vendor} />
                  </InfoGrid>
                  <InfoGrid columns={3} bordered={false}>
                    <InfoField label="Submission ID" value={draft.submission_id} />
                    <InfoField label="Date" value={formatDate(draft.date || undefined)} />
                    <InfoField label="Status" value={<span style={{ ...getBadgeStyle("status", draft.status) }}>{draft.status || "—"}</span>} />
                  </InfoGrid>
                </LeadCard>

                <LeadCard icon="👥" title="Agent Information" subtitle="Agent assignments and account details">
                  <InfoGrid columns={2}>
                    <InfoField label="Buffer Agent" value={draft.buffer_agent} />
                    <InfoField label="Retention Agent" value={draft.retention_agent} />
                  </InfoGrid>
                  <InfoGrid columns={2}>
                    <InfoField label="Agent" value={draft.agent} />
                    <InfoField label="Licensed Agent Account" value={draft.licensed_agent_account} />
                  </InfoGrid>
                </LeadCard>

                <LeadCard icon="📋" title="Application Information" subtitle="Application status and details">
                  <InfoGrid columns={3}>
                    <InfoField label="Call Result" value={<span style={{ ...getBadgeStyle("result", draft.call_result) }}>{draft.call_result || "—"}</span>} />
                    <InfoField label="Carrier" value={draft.carrier} />
                    <InfoField label="Product Type" value={draft.product_type} />
                  </InfoGrid>
                  <InfoGrid columns={3} bordered={false}>
                    <InfoField label="LA Callback" value={draft.la_callback} />
                    <InfoField label="Policy Number" value={draft.policy_number} />
                    <InfoField label="Draft Date" value={formatDate(draft.draft_date || undefined)} />
                  </InfoGrid>
                </LeadCard>

                <LeadCard icon="💰" title="Financial Information" subtitle="Premium and coverage amounts">
                  <InfoGrid columns={3}>
                    <InfoField label="Monthly Premium" value={draft.monthly_premium ? formatCurrency(draft.monthly_premium) : "—"} />
                    <InfoField label="Face Amount" value={draft.face_amount ? formatCurrency(draft.face_amount) : "—"} />
                    <InfoField label="From Callback" value={formatBool(draft.from_callback ?? undefined)} />
                  </InfoGrid>
                </LeadCard>

                <LeadCard icon="📝" title="Additional Information" subtitle="Audit and system metadata">
                  <InfoGrid columns={2}>
                    <InfoField label="Carrier Audit" value={draft.carrier_audit} />
                    <InfoField label="Product Type Carrier" value={draft.product_type_carrier} />
                  </InfoGrid>
                  <InfoGrid columns={2}>
                    <InfoField label="Level or GI" value={draft.level_or_gi} />
                    <InfoField label="Created At" value={formatDate(draft.created_at || undefined)} />
                  </InfoGrid>
                  <InfoGrid columns={1} bordered={false}>
                    <InfoField label="Notes" value={draft.notes || "No notes"} />
                  </InfoGrid>
                </LeadCard>
              </div>
            ) : detailTab === "details" && detailEditing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <LeadCard icon="👤" title="Contact Information" subtitle="Lead contact and identification details" collapsible={false}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>Insured Name</label>
                      <input
                        type="text"
                        value={draft.insured_name || ""}
                        onChange={(e) => patchDraft({ insured_name: e.target.value })}
                        style={{ width: "100%", height: 38, borderRadius: 8, border: `1px solid ${T.border}`, backgroundColor: T.cardBg, color: T.textDark, fontSize: 13, padding: "0 12px", outline: "none" }}
                        onFocus={(e) => { e.target.style.borderColor = "#233217"; e.target.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`; }}
                        onBlur={(e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>Phone Number</label>
                      <input
                        type="text"
                        value={draft.client_phone_number || ""}
                        onChange={(e) => patchDraft({ client_phone_number: e.target.value })}
                        style={{ width: "100%", height: 38, borderRadius: 8, border: `1px solid ${T.border}`, backgroundColor: T.cardBg, color: T.textDark, fontSize: 13, padding: "0 12px", outline: "none" }}
                        onFocus={(e) => { e.target.style.borderColor = "#233217"; e.target.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`; }}
                        onBlur={(e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>Lead Vendor</label>
                      <StyledSelect
                        value={draft.lead_vendor || ""}
                        onValueChange={(v) => patchDraft({ lead_vendor: v })}
                        options={leadVendorOptions.map((v) => ({ value: v, label: v }))}
                        placeholder="Select vendor"
                      />
                    </div>
                  </div>
                </LeadCard>

                <LeadCard icon="👥" title="Agent Information" subtitle="Agent assignments and account details" collapsible={false}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>Buffer Agent</label>
                      <StyledSelect
                        value={draft.buffer_agent || ""}
                        onValueChange={(v) => patchDraft({ buffer_agent: v })}
                        options={bufferAgentOptions.map((v) => ({ value: v, label: v }))}
                        placeholder="Select buffer agent"
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>Retention Agent</label>
                      <StyledSelect
                        value={draft.retention_agent || ""}
                        onValueChange={(v) => patchDraft({ retention_agent: v })}
                        options={retentionOptions.map((v) => ({ value: v, label: v }))}
                        placeholder="Select retention agent"
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>Agent</label>
                      <StyledSelect
                        value={draft.agent || ""}
                        onValueChange={(v) => patchDraft({ agent: v })}
                        options={agentOptions.map((v) => ({ value: v, label: v }))}
                        placeholder="Select agent"
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>Licensed Agent Account</label>
                      <StyledSelect
                        value={draft.licensed_agent_account || ""}
                        onValueChange={(v) => patchDraft({ licensed_agent_account: v })}
                        options={licensedOptions.map((v) => ({ value: v, label: v }))}
                        placeholder="Select licensed agent"
                      />
                    </div>
                  </div>
                </LeadCard>

                <LeadCard icon="📋" title="Application Information" subtitle="Application status and details" collapsible={false}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>Status</label>
                      <StyledSelect
                        value={draft.status || ""}
                        onValueChange={(v) => patchDraft({ status: v })}
                        options={STATUS_OPTIONS.map((v) => ({ value: v, label: v }))}
                        placeholder="Select status"
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>Call Result</label>
                      <StyledSelect
                        value={draft.call_result || ""}
                        onValueChange={(v) => patchDraft({ call_result: v })}
                        options={CALL_RESULT_OPTIONS.map((v) => ({ value: v, label: v }))}
                        placeholder="Select call result"
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>Carrier</label>
                      <StyledSelect
                        value={draft.carrier || ""}
                        onValueChange={(v) => patchDraft({ carrier: v, product_type: "" })}
                        options={dynamicCarrierOptions.map((v) => ({ value: v, label: v }))}
                        placeholder="Select carrier"
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>Product Type</label>
                      <StyledSelect
                        value={draft.product_type || ""}
                        onValueChange={(v) => patchDraft({ product_type: v })}
                        options={productsForCarrier.map((v) => ({ value: v.name, label: v.name }))}
                        placeholder="Select product type"
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>LA Callback</label>
                      <StyledSelect
                        value={draft.la_callback || ""}
                        onValueChange={(v) => patchDraft({ la_callback: v })}
                        options={LA_CALLBACK_OPTIONS.map((v) => ({ value: v, label: v }))}
                        placeholder="Select callback"
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>Draft Date</label>
                      <input
                        type="date"
                        value={draft.draft_date || ""}
                        onChange={(e) => patchDraft({ draft_date: e.target.value })}
                        style={{ width: "100%", height: 38, borderRadius: 8, border: `1px solid ${T.border}`, backgroundColor: T.cardBg, color: T.textDark, fontSize: 13, padding: "0 12px", outline: "none" }}
                        onFocus={(e) => { e.target.style.borderColor = "#233217"; e.target.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`; }}
                        onBlur={(e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                  </div>
                </LeadCard>

                <LeadCard icon="💰" title="Financial Information" subtitle="Premium and coverage amounts" collapsible={false}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>Monthly Premium</label>
                      <input
                        type="number"
                        value={String(draft.monthly_premium ?? "")}
                        onChange={(e) => patchDraft({ monthly_premium: e.target.value ? Number(e.target.value) : null })}
                        style={{ width: "100%", height: 38, borderRadius: 8, border: `1px solid ${T.border}`, backgroundColor: T.cardBg, color: T.textDark, fontSize: 13, padding: "0 12px", outline: "none" }}
                        onFocus={(e) => { e.target.style.borderColor = "#233217"; e.target.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`; }}
                        onBlur={(e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>Face Amount</label>
                      <input
                        type="number"
                        value={String(draft.face_amount ?? "")}
                        onChange={(e) => patchDraft({ face_amount: e.target.value ? Number(e.target.value) : null })}
                        style={{ width: "100%", height: 38, borderRadius: 8, border: `1px solid ${T.border}`, backgroundColor: T.cardBg, color: T.textDark, fontSize: 13, padding: "0 12px", outline: "none" }}
                        onFocus={(e) => { e.target.style.borderColor = "#233217"; e.target.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`; }}
                        onBlur={(e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>From Callback</label>
                      <StyledSelect
                        value={draft.from_callback ? "Yes" : "No"}
                        onValueChange={(v) => patchDraft({ from_callback: v === "Yes" })}
                        options={[{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }]}
                        placeholder="Select"
                      />
                    </div>
                  </div>
                </LeadCard>

                <LeadCard icon="📝" title="Notes" subtitle="Additional notes" collapsible={false}>
                  <textarea
                    value={draft.notes || ""}
                    onChange={(e) => patchDraft({ notes: e.target.value })}
                    style={{ width: "100%", minHeight: 100, borderRadius: 8, border: `1px solid ${T.border}`, backgroundColor: T.cardBg, color: T.textDark, fontSize: 13, padding: "12px", resize: "vertical", outline: "none" }}
                    onFocus={(e) => { e.target.style.borderColor = "#233217"; e.target.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`; }}
                    onBlur={(e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
                  />
                </LeadCard>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ padding: "16px 20px", background: T.pageBg, borderRadius: 12, border: `1px solid ${T.borderLight}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.3px" }}>Notes</div>
                  <div style={{ fontSize: 14, color: T.textDark, whiteSpace: "pre-wrap" }}>{draft.notes || "No notes available for this lead."}</div>
                </div>
                {callsLoading ? (
                  <div style={{ padding: "20px", textAlign: "center", color: T.textMuted, fontWeight: 600 }}>Loading call recordings...</div>
                ) : callRecordings.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: T.textMuted, fontWeight: 600 }}>No call recordings found for this phone number.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" }}>
                    {callRecordings.map((call) => (
                      <div key={call.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.borderLight}`, borderRadius: 12, padding: 16, background: T.pageBg }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <span style={{ fontSize: 11, borderRadius: 999, padding: "3px 10px", background: call.direction === "inbound" ? "#dcfce7" : "#dbeafe", color: call.direction === "inbound" ? "#166534" : "#1d4ed8", fontWeight: 800 }}>
                              {call.direction === "inbound" ? "In" : "Out"}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: T.textDark }}>{formatDuration(call.duration)}</span>
                            <span style={{ fontSize: 11, borderRadius: 999, padding: "3px 10px", background: "#f3f4f6", color: T.textMid, fontWeight: 700 }}>{call.status}</span>
                          </div>
                          <div style={{ fontSize: 13, color: T.textMuted }}>{formatTimestamp(call.started_at)} - {call.user?.name || "Unknown Agent"}</div>
                        </div>
                        <button
                          type="button"
                          disabled={loadingRecordingId === call.id}
                          onClick={async () => {
                            if (playingRecording === call.id) {
                              setPlayingRecording(null);
                              return;
                            }
                            let recordingUrl = call.recording;
                            if (!recordingUrl) {
                              setLoadingRecordingId(call.id);
                              recordingUrl = await fetchCallRecording(call.id);
                              setLoadingRecordingId(null);
                              if (recordingUrl) {
                                setCallRecordings((prev) => prev.map((c) => (c.id === call.id ? { ...c, recording: recordingUrl } : c)));
                              }
                            }
                            if (!recordingUrl) return onError("This call does not have a recording available.");
                            setPlayingRecording(call.id);
                            const audio = new Audio(recordingUrl);
                            void audio.play();
                            audio.onended = () => setPlayingRecording(null);
                          }}
                          style={{
                            height: 36,
                            padding: "0 14px",
                            borderRadius: 8,
                            border: "none",
                            background: playingRecording === call.id ? "#233217" : "#DCEBDC",
                            color: playingRecording === call.id ? "#fff" : "#233217",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: loadingRecordingId === call.id ? "not-allowed" : "pointer",
                            opacity: loadingRecordingId === call.id ? 0.7 : 1,
                          }}
                        >
                          {loadingRecordingId === call.id ? "Loading..." : playingRecording === call.id ? "Pause" : "Play"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {showDeleteModal && deletingRow && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#dc2626" }}>Delete Row</h2>
              <button
                onClick={closeDeleteModal}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#991b1b", lineHeight: 1.6 }}>
                <strong>Warning:</strong> This will permanently delete the row for <strong>{`&quot;${deletingRow.insured_name || "this customer"}&quot;`}</strong>. This action cannot be undone.
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#233217", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                Type <strong>{deletingRow.insured_name || "this customer"}</strong> to confirm deletion
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && deleteConfirmName === deletingRow.insured_name) void handleDeleteRow();
                  if (e.key === "Escape") closeDeleteModal();
                }}
                placeholder={deletingRow.insured_name || "this customer"}
                autoFocus
                style={{
                  width: "100%",
                  height: 44,
                  border: `1.5px solid ${deleteConfirmName === deletingRow.insured_name ? "#dc2626" : T.border}`,
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
                  e.currentTarget.style.borderColor = deleteConfirmName === deletingRow.insured_name ? "#dc2626" : "#233217";
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${deleteConfirmName === deletingRow.insured_name ? "rgba(220, 38, 38, 0.1)" : "rgba(35, 50, 23, 0.1)"}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = deleteConfirmName === deletingRow.insured_name ? "#dc2626" : T.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={closeDeleteModal}
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
                onClick={handleDeleteRow}
                disabled={deleteConfirmName !== deletingRow.insured_name || deletingInProgress}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: deleteConfirmName === deletingRow.insured_name && !deletingInProgress ? "#dc2626" : T.border,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: deleteConfirmName === deletingRow.insured_name && !deletingInProgress ? "pointer" : "not-allowed",
                  boxShadow: deleteConfirmName === deletingRow.insured_name && !deletingInProgress ? "0 4px 12px rgba(220, 38, 38, 0.2)" : "none",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                {deletingInProgress ? "Deleting..." : "Delete Row"}
              </button>
            </div>
          </div>
        </div>
      )}

      {notesTooltip && (
        <div
          style={{
            position: "fixed",
            left: notesTooltip.x,
            top: notesTooltip.y,
            zIndex: 999999,
            maxWidth: 400,
            background: T.cardBg,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            padding: 16,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#233217", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.3px" }}>Notes</div>
          <div style={{ fontSize: 13, color: T.textDark, lineHeight: 1.5 }}>{notesTooltip.text}</div>
        </div>
      )}
    </div>
  );
}
