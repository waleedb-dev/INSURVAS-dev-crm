"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { T } from "@/lib/theme";
import { ActionMenu, DataGrid, FilterChip, Input, Pagination, Table, Toast, EmptyState } from "@/components/ui";
import { FieldLabel, SelectInput } from "./daily-deal-flow/ui-primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/shadcn/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TransferLeadApplicationForm, { type TransferLeadFormData } from "./TransferLeadApplicationForm";
import { buildFeCreateLeadBodyFromIntakePayload, postFeCreateLeadAtFixedUrl } from "./feCreateLead";
import LeadViewComponent from "./LeadViewComponent";
import TransferLeadClaimModal from "./TransferLeadClaimModal";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import { Search, Filter, Plus, ChevronDown } from "lucide-react";

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
import {
  applyClaimSelectionToSession,
  fetchClaimAgents,
  findOrCreateVerificationSession,
  saveFullRetentionWorkflow,
  type ClaimLeadContext,
  type ClaimSelections,
} from "./transferLeadParity";

type IntakeLead = {
  rowId: string;
  id: string;
  submissionId: string | null;
  name: string;
  phone: string;
  premium: number;
  type: string;
  source: string;
  centerName: string;
  pipelineName: string;
  stage: string;
  createdBy: string;
  createdAt: string;
  /** ISO `created_at` for date-range filtering */
  createdAtIso: string;
  isDraft?: boolean;
  carrier: string;
  state: string;
};

type TransferKanbanColumnId =
  | "new-lead-in"
  | "new-transfer-enqueue"
  | "pending-disposition"
  | "submitted"
  | "not-submitted";

const TRANSFER_KANBAN_COLUMNS: Array<{
  id: TransferKanbanColumnId;
  label: string;
  accent: string;
  bg: string;
}> = [
  { id: "new-lead-in", label: "Form Drafts", accent: "#4f46e5", bg: "#eef2ff" },
  { id: "new-transfer-enqueue", label: "Unclaimed Calls", accent: "#0f766e", bg: "#ecfeff" },
  { id: "pending-disposition", label: "Claimed Calls", accent: "#b45309", bg: "#fffbeb" },
  { id: "submitted", label: "Submitted", accent: "#166534", bg: "#f0fdf4" },
  { id: "not-submitted", label: "Not Submitted", accent: "#b91c1c", bg: "#fef2f2" },
];

function getTransferColumnForLead(lead: IntakeLead): TransferKanbanColumnId {
  if (lead.isDraft) return "new-lead-in";
  if (lead.stage === "Transfer API") return "new-transfer-enqueue";
  return "pending-disposition";
}

function formatPhoneDisplay(phone: string | null | undefined) {
  const raw = String(phone ?? "").replace(/\D/g, "");
  if (raw.length === 10) {
    return `+1 (${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
  }
  return phone || "";
}

const KANBAN_ITEMS_PER_PAGE = 20;

function renderTransferKanbanBoard({ leads, collapsedColumns, toggleColumnCollapse, openLeadFromGrid, openLeadInForm, kanbanPage, setKanbanPage }: {
  leads: IntakeLead[];
  collapsedColumns: Record<string, boolean>;
  toggleColumnCollapse: (id: string) => void;
  openLeadFromGrid: (lead: IntakeLead) => void;
  openLeadInForm: (rowId: string) => void;
  kanbanPage: Record<string, number>;
  setKanbanPage: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  const leadsByColumn: Record<TransferKanbanColumnId, IntakeLead[]> = {
    "new-lead-in": [],
    "new-transfer-enqueue": [],
    "pending-disposition": [],
    "submitted": [],
    "not-submitted": [],
  };

  leads.forEach((lead) => {
    const columnId = getTransferColumnForLead(lead);
    leadsByColumn[columnId].push(lead);
  });

  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <style>{`
        .transfer-kanban-container {
          background-color: transparent;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }
        .transfer-kanban-board {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 8px 4px;
          align-items: stretch;
          flex: 1;
          min-height: 0;
          scrollbar-width: thin;
          scrollbar-color: ${T.border} transparent;
        }
        .transfer-kanban-board::-webkit-scrollbar { height: 6px; }
        .transfer-kanban-board::-webkit-scrollbar-track { background: transparent; }
        .transfer-kanban-board::-webkit-scrollbar-thumb { background-color: #c8d4bb; border-radius: 10px; }
        
        .transfer-kanban-column-wrapper {
          min-width: 320px;
          width: 320px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background-color: #fff;
          border: 1px solid ${T.border};
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          transition: min-width 0.2s ease, width 0.2s ease;
          height: 100%;
        }
        
        .transfer-kanban-column-body {
          overflow-y: auto;
          flex: 1;
          min-height: 0;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .transfer-kanban-column-body::-webkit-scrollbar { width: 6px; }
        .transfer-kanban-column-body::-webkit-scrollbar-track { background: transparent; }
        .transfer-kanban-column-body::-webkit-scrollbar-thumb { background-color: #b8c9a8; border-radius: 6px; }
        .transfer-kanban-column-body::-webkit-scrollbar-thumb:hover { background-color: #233217; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      
      <div className="transfer-kanban-container">
        <div className="transfer-kanban-board">
          {TRANSFER_KANBAN_COLUMNS.map((column) => {
            const columnLeads = leadsByColumn[column.id] || [];
            const isCollapsed = collapsedColumns[column.id];
            const columnValue = columnLeads.reduce((s, l) => s + l.premium, 0);
            const currentPage = kanbanPage[column.id] || 1;
            const totalPages = Math.ceil(columnLeads.length / KANBAN_ITEMS_PER_PAGE);
            const paginatedLeads = columnLeads.slice((currentPage - 1) * KANBAN_ITEMS_PER_PAGE, currentPage * KANBAN_ITEMS_PER_PAGE);
            
            return (
              <div
                key={column.id}
                className="transfer-kanban-column-wrapper"
                style={{ 
                  minWidth: isCollapsed ? 50 : 320,
                  width: isCollapsed ? 50 : 320,
                }}
              >
                {isCollapsed ? (
                  <div style={{ backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "16px 0", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }} onClick={() => toggleColumnCollapse(column.id)}>
                    <div style={{ backgroundColor: column.accent, color: "#fff", borderRadius: 10, padding: "2px 7px", fontSize: 11, fontWeight: 800, marginBottom: 16 }}>
                      {columnLeads.length}
                    </div>
                    <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 13, fontWeight: 800, color: column.accent, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>
                      {column.label}
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        background: `linear-gradient(180deg, ${column.bg} 0%, #ffffff 88%)`,
                        padding: "10px 14px",
                        borderTop: `4px solid ${column.accent}`,
                        borderBottom: `1px solid ${T.borderLight}`,
                        borderRadius: "12px 12px 0 0",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: T.textDark }}>{column.label}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button onClick={() => toggleColumnCollapse(column.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: T.textMuted }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: 4, display: "flex", gap: 12, fontSize: 11 }}>
                        <span style={{ color: T.textMuted, fontWeight: 600 }}>{columnLeads.length} Leads</span>
                        <span style={{ color: T.textDark, fontWeight: 800 }}>${columnValue.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="transfer-kanban-column-body" style={{ backgroundColor: "#fafcf8" }}>
                      {columnLeads.length === 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: 20 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: column.bg, color: column.accent, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="16" rx="2" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                          </div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, textAlign: "center", margin: 0 }}>No leads in this stage</p>
                        </div>
                      ) : (
                        <>
                          {paginatedLeads.map((lead) => (
                            <div
                              key={lead.rowId}
                              onClick={() => openLeadFromGrid(lead)}
                              style={{
                                backgroundColor: "#fff",
                                borderRadius: 8,
                                padding: "10px 12px",
                                boxShadow: "0 1px 4px rgba(35, 50, 23, 0.06)",
                                border: `1px solid ${T.border}`,
                                borderLeft: `3px solid ${column.accent}`,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                position: "relative",
                                animation: "fadeInUp 0.15s ease-out",
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = "#233217"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(35, 50, 23, 0.12)"; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "0 1px 4px rgba(35, 50, 23, 0.06)"; e.currentTarget.style.borderLeftColor = column.accent; }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                                <div style={{ flex: 1, marginRight: 8 }}>
                                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.textDark, lineHeight: 1.3 }}>
                                    {lead.name}
                                  </p>
                                  <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted, fontWeight: 500 }}>
                                    {formatPhoneDisplay(lead.phone)}
                                  </p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openLeadInForm(lead.rowId);
                                  }}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex", alignItems: "center", justifyContent: "center", padding: 2 }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                              </div>

                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginBottom: 6 }}>
                                <span style={{ fontSize: 11, color: T.textMuted }}><span style={{ fontWeight: 600 }}>Carrier:</span> {lead.carrier}</span>
                                <span style={{ fontSize: 11, color: T.textMuted }}><span style={{ fontWeight: 600 }}>State:</span> {lead.state}</span>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6, borderTop: `1px solid ${T.borderLight}` }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>{lead.centerName}</span>
                                  {lead.isDraft && (
                                    <span style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#fef3c7", color: "#92400e", padding: "1px 5px", borderRadius: 3 }}>
                                      DRAFT
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: T.textDark }}>${lead.premium.toLocaleString()}</span>
                              </div>
                            </div>
                          ))}

                          {totalPages > 1 && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 2px", borderTop: `1px solid ${T.borderLight}`, marginTop: 4 }}>
                              <button
                                onClick={() => setKanbanPage((prev) => ({ ...prev, [column.id]: Math.max(1, (prev[column.id] || 1) - 1) }) as Record<string, number>)}
                                disabled={currentPage === 1}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 6,
                                  border: `1px solid ${T.border}`,
                                  background: "#fff",
                                  color: currentPage === 1 ? T.textMuted : "#233217",
                                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  opacity: currentPage === 1 ? 0.5 : 1,
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                              </button>
                              <span style={{ fontSize: 11, fontWeight: 600, color: T.textDark }}>
                                {currentPage} / {totalPages}
                              </span>
                              <button
                                onClick={() => setKanbanPage((prev) => ({ ...prev, [column.id]: Math.min(totalPages, (prev[column.id] || 1) + 1) }) as Record<string, number>)}
                                disabled={currentPage === totalPages}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 6,
                                  border: `1px solid ${T.border}`,
                                  background: "#fff",
                                  color: currentPage === totalPages ? T.textMuted : "#233217",
                                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  opacity: currentPage === totalPages ? 0.5 : 1,
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type DuplicateLeadMatch = {
  id: string;
  lead_unique_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  social: string | null;
  stage: string | null;
  match_type: "phone" | "ssn";
  created_at?: string | null;
};

const FIXED_BPO_LEAD_SOURCE = "BPO Transfer Lead Source";

const TL_DATE_INPUT_STYLE: CSSProperties = {
  width: "100%",
  height: 36,
  border: `1.5px solid ${T.border}`,
  borderRadius: 8,
  fontSize: 13,
  color: T.textDark,
  padding: "0 8px",
  boxSizing: "border-box",
  background: T.cardBg,
};

function transferLeadDayKey(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mapSelectOptions(values: string[], allLabel: string) {
  const sorted = [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
  return [{ value: "All", label: allLabel }, ...sorted.map((v) => ({ value: v, label: v }))];
}

/*
 * Unused while post-create Slack / GHL / notify-eligible-agents are disabled (fe-create-lead only).
 * See commented body of `notifySlackTransferPortalLead`.
 */
// const TRANSFER_PORTAL_LEAD_VENDOR = "Ascendra BPO";
// const FE_SLACK_NOTIFICATION_EDGE_FUNCTION = "fe-slack-notification" as const;
// const FE_GHL_CREATE_CONTACT_EDGE_FUNCTION = "fe-ghl-create-contact" as const;
// const TEST_BPO_CHANNEL = "#test-bpo" as const;

type SsnDuplicateRule = {
  stage_name: string;
  ghl_stage: string | null;
  message: string;
  is_addable: boolean;
  is_active: boolean;
};
type DuplicateQueryLead = {
  id: string;
  lead_unique_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  social: string | null;
  stage: string | null;
  created_at: string | null;
};

const DEFAULT_CLAIM_SELECTION: ClaimSelections = {
  workflowType: "buffer",
  bufferAgentId: null,
  licensedAgentId: null,
  retentionAgentId: null,
  isRetentionCall: false,
  retentionType: "",
  retentionNotes: "",
  quoteCarrier: "",
  quoteProduct: "",
  quoteCoverage: "",
  quoteMonthlyPremium: "",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function buildLeadUniqueId(payload: TransferLeadFormData): string {
  const phoneDigits = String(payload.phone || "").replace(/\D/g, "");
  const ph2 = phoneDigits.slice(0, 2).padEnd(2, "0");

  const carrierLetters = String(payload.carrier || "").replace(/[^A-Za-z]/g, "");
  const car2 = carrierLetters.slice(0, 2).padEnd(2, "X");

  const fn1 = String(payload.firstName || "").trim().charAt(0) || "X";
  const ln1 = String(payload.lastName || "").trim().charAt(0) || "X";

  const ssnDigits = String(payload.social || "").replace(/\D/g, "");
  const ss2 = ssnDigits.slice(0, 2).padEnd(2, "0");

  return `${ph2}${car2}${fn1}${ln1}${ss2}`.toUpperCase();
}

function normalizeLeadUniqueId(value: string): string {
  return String(value || "").trim().toUpperCase();
}

function buildSubmissionId(centerName: string): string {
  const words = String(centerName || "")
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);
  const centerCode = words.length >= 2
    ? `${words[0][0] ?? ""}${words[1][0] ?? ""}`
    : (words[0]?.slice(0, 2) ?? "NA");
  const ts = Date.now();
  const rand = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 8);
  return `${ts}-${rand}-${centerCode.toUpperCase()}`;
}

function normalizePhoneDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeSsnDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function formatSsn(digits: string) {
  if (digits.length !== 9) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function formatUsPhone(digits: string) {
  if (digits.length !== 10) return digits;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Calendar date `YYYY-MM-DD` in US Eastern — aligns with FE quote `date` and portal submission dates. */
function getTodayInEasternYyyyMmDd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function insertDailyDealFlowEntry(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  row: {
    submissionId: string;
    leadVendor: string;
    leadName: string;
    payload: TransferLeadFormData;
    callCenterId?: string | null;
  }
) {
  const monthly = Number(row.payload.monthlyPremium);
  const face = Number(row.payload.coverageAmount);
  const insuredName = (row.leadName || "").trim() || "Unnamed Lead";
  const flowDate = getTodayInEasternYyyyMmDd();
  const resolvedLeadVendor = row.callCenterId
    ? (
        await supabase
          .from("call_centers")
          .select("name")
          .eq("id", row.callCenterId)
          .maybeSingle()
      ).data?.name || null
    : null;
  const { error } = await supabase.from("daily_deal_flow").insert({
    submission_id: row.submissionId,
    client_phone_number: row.payload.phone || null,
    lead_vendor: resolvedLeadVendor || row.leadVendor || null,
    call_center_id: row.callCenterId || null,
    date: flowDate,
    insured_name: insuredName,
    carrier: row.payload.carrier || null,
    product_type: row.payload.productType || null,
    draft_date: row.payload.draftDate || null,
    monthly_premium: Number.isFinite(monthly) ? monthly : null,
    face_amount: Number.isFinite(face) ? face : null,
  });
  if (error) console.warn("daily_deal_flow insert:", error.message);
}

async function notifySlackTransferPortalLead(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  params: {
    leadId: string;
    submissionId: string;
    leadUniqueId: string;
    payload: TransferLeadFormData;
    callCenterName: string;
    callCenterId?: string | null;
  }
) {
  // Outbound edge calls disabled: use `fe-create-lead` only (`postFeCreateLeadAtFixedUrl` after insert/update).
  void supabase;
  void params;

  /*
  const { leadId, submissionId, leadUniqueId, payload, callCenterName, callCenterId } = params;
  try {
    const customerName = `${payload.firstName} ${payload.lastName}`.trim() || "Unnamed Lead";
    const transferPortalMessage = `A new Application Submission:
Call Center Name: ${callCenterName || TRANSFER_PORTAL_LEAD_VENDOR}
Customer Name: ${customerName}
Customer Number: ${payload.phone || "N/A"}
Date & Time (EST): ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`;

    const { error: transferPortalError } = await supabase.functions.invoke(
      FE_SLACK_NOTIFICATION_EDGE_FUNCTION,
      {
        body: {
          channel: TEST_BPO_CHANNEL,
          message: transferPortalMessage,
        },
      },
    );
    if (transferPortalError) console.warn("fe-slack-notification (transfer-portal):", transferPortalError.message);

    const { data: centerRow } = callCenterId
      ? await supabase
          .from("call_centers")
          .select("name, slack_channel")
          .eq("id", callCenterId)
          .maybeSingle()
      : { data: null as { name?: string | null; slack_channel?: string | null } | null };
    const centerName = (centerRow?.name || callCenterName || TRANSFER_PORTAL_LEAD_VENDOR).trim();
    const centerSlackChannel = TEST_BPO_CHANNEL;

    if (centerSlackChannel) {
      const agentPortalUrl = `https://crm-agent-portal.vercel.app/dashboard/sales_agent_licensed/transfer-leads/${encodeURIComponent(leadId)}`;
      const centerMessage = `New Application Submission:

Call Center Name: ${centerName}
Customer Name: ${customerName}
Customer State: ${payload.state || "N/A"}
Quoted Carrier: ${payload.carrier || "N/A"}
Date & Time (EST): ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`;
      const centerBlocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*New Application Submission:*\n\n*Call Center Name:* ${centerName}\n*Customer Name:* ${customerName}\n*Customer State:* ${payload.state || "N/A"}\n*Quoted Carrier:* ${payload.carrier || "N/A"}\n*Date & Time (EST):* ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View Application" },
              url: agentPortalUrl,
              style: "primary",
            },
          ],
        },
      ];

      const { error: centerSlackError } = await supabase.functions.invoke(
        FE_SLACK_NOTIFICATION_EDGE_FUNCTION,
        {
          body: {
            channel: centerSlackChannel,
            message: centerMessage,
            blocks: centerBlocks,
          },
        },
      );
      if (centerSlackError) console.warn("fe-slack-notification (center):", centerSlackError.message);
    }

    if (payload.carrier && payload.state && centerName) {
      try {
        const { error: notifyError } = await supabase.functions.invoke("notify-eligible-agents", {
          body: {
            carrier: payload.carrier,
            state: payload.state,
            lead_vendor: centerName,
            language: "English",
          },
        });
        if (notifyError) {
          console.warn("notify-eligible-agents:", notifyError.message);
        }
      } catch (notifyError) {
        console.warn(
          "notify-eligible-agents:",
          notifyError instanceof Error ? notifyError.message : "Request failed",
        );
      }
    }

    if (centerName && payload.phone) {
      const { error: ghlError } = await supabase.functions.invoke(FE_GHL_CREATE_CONTACT_EDGE_FUNCTION, {
        body: {
          lead_vendor: centerName,
          first_name: payload.firstName || null,
          last_name: payload.lastName || null,
          phone_number: payload.phone,
          email: null,
          date_of_birth: payload.dateOfBirth || null,
          state: payload.state || null,
          city: payload.city || null,
          street_address: payload.street1 || null,
          zip_code: payload.zipCode || null,
          carrier: payload.carrier || null,
          product_type: payload.productType || null,
          monthly_premium: payload.monthlyPremium || null,
          coverage_amount: payload.coverageAmount || null,
          submission_id: submissionId || leadId,
        },
      });
      if (ghlError) console.warn("fe-ghl-create-contact:", ghlError.message);
    }
  } catch (e) {
    console.warn("post-create notifications failed", e);
  }
  */
}

export default function CallCenterLeadIntakePage({
  canCreateLeads = true,
  canViewTransferClaimReclaimVisit = false,
}: {
  canCreateLeads?: boolean;
  canViewTransferClaimReclaimVisit?: boolean;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const { permissionKeys, currentRole, setPageHeaderActions } = useDashboardContext();
  const canEditTransferLeads = permissionKeys.has("action.transfer_leads.edit");
  const canEditLeadPipeline = permissionKeys.has("action.lead_pipeline.update");
  /** Overwrite the matched row: editors always; intake creators only for SSN match (duplicate resolution). */
  const canOverwriteDuplicateMatch = (match: DuplicateLeadMatch | null) =>
    Boolean(
      match &&
        (canEditTransferLeads || (canCreateLeads && match.match_type === "ssn")),
    );
  const isCallCenterTransferRole =
    currentRole === "call_center_agent" || currentRole === "call_center_admin";
  // Only call center agents (not admins) can update their own drafts
  const isCallCenterAgentOnly = currentRole === "call_center_agent";
  const params = useParams<{ role?: string }>();
  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role || "agent";
  const [leads, setLeads] = useState<IntakeLead[]>([]);
  const [viewingLead, setViewingLead] = useState<{ id: string; name: string; rowUuid: string } | null>(null);
  const [editingLead, setEditingLead] = useState<{ rowId: string; formData: TransferLeadFormData } | null>(null);
  const [search, setSearch] = useState("");
  const [filterDateSingle, setFilterDateSingle] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterCenter, setFilterCenter] = useState("All");
  const [filterCreatedBy, setFilterCreatedBy] = useState("All");
  const [filterProductType, setFilterProductType] = useState("All");
  const [filterCarrier, setFilterCarrier] = useState("All");
  const [filterState, setFilterState] = useState("All");
  const [filterDraft, setFilterDraft] = useState<"All" | "draft" | "live">("All");
  const [filterMinPremium, setFilterMinPremium] = useState("");
  const [filterMaxPremium, setFilterMaxPremium] = useState("");
  /** Detailed filters (dates, dropdowns, premium) — search + chips stay usable when false */
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  const [kanbanPage, setKanbanPage] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [defaultTransferPipelineId, setDefaultTransferPipelineId] = useState<number | null>(null);
  const [defaultTransferStageId, setDefaultTransferStageId] = useState<number | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingCreatePayload, setPendingCreatePayload] = useState<TransferLeadFormData | null>(null);
  const [duplicateLeadMatch, setDuplicateLeadMatch] = useState<DuplicateLeadMatch | null>(null);
  const [duplicateRuleMessage, setDuplicateRuleMessage] = useState<string>("");
  const [duplicateIsAddable, setDuplicateIsAddable] = useState<boolean>(true);
  const [callCenterName, setCallCenterName] = useState("");
  const [pendingDeleteLead, setPendingDeleteLead] = useState<{ rowId: string; name: string } | null>(null);
  const [deletingLead, setDeletingLead] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimModalLoading, setClaimModalLoading] = useState(false);
  const [claimLeadContext, setClaimLeadContext] = useState<ClaimLeadContext | null>(null);
  const [claimAgents, setClaimAgents] = useState<{
    bufferAgents: { id: string; name: string; roleKey: string }[];
    licensedAgents: { id: string; name: string; roleKey: string }[];
    retentionAgents: { id: string; name: string; roleKey: string }[];
  }>({ bufferAgents: [], licensedAgents: [], retentionAgents: [] });
  const [claimSelection, setClaimSelection] = useState<ClaimSelections>(DEFAULT_CLAIM_SELECTION);
  const [isRetentionOnlyMode, setIsRetentionOnlyMode] = useState(false);
  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const itemsPerPage = 7;

  useEffect(() => {
    let cancelled = false;
    const loadCallCenterName = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        if (!cancelled) setCallCenterName("");
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("call_centers(name)")
        .eq("id", session.user.id)
        .maybeSingle();
      const row = data as { call_centers?: { name?: string } | null } | null;
      const name = row?.call_centers?.name;
      if (!cancelled) setCallCenterName(typeof name === "string" ? name.trim() : "");
    };
    void loadCallCenterName();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const refreshLeads = async () => {
    setIsLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setLeads([]);
      setIsLoading(false);
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("full_name, call_center_id")
      .eq("id", session.user.id)
      .maybeSingle();

    const baseQuery = supabase
      .from("leads")
      .select("id, submission_id, lead_unique_id, first_name, last_name, phone, lead_value, product_type, lead_source, carrier, state, pipeline_id, stage, stage_id, call_center_id, created_at, is_draft, pipelines(name), call_centers(name), users!submitted_by(full_name)")
      .eq("pipelines.name", "Transfer Portal")
      .eq("stage", "Transfer API")
      .order("created_at", { ascending: false });

    const canViewAll = permissionKeys.has("action.transfer_leads.view_all");
    const canViewCallCenter = permissionKeys.has("action.transfer_leads.view_call_center");
    const canViewOwn = permissionKeys.has("action.transfer_leads.view_own");
    const hideDraftsForSalesRole =
      currentRole === "sales_admin" ||
      currentRole === "sales_manager" ||
      currentRole === "sales_agent_licensed" ||
      currentRole === "sales_agent_unlicensed";

    const scopedQuery = canViewAll
      ? baseQuery
      : canViewCallCenter && userProfile?.call_center_id
        ? baseQuery.eq("call_center_id", userProfile.call_center_id)
        : canViewOwn
          ? baseQuery.eq("submitted_by", session.user.id)
          : baseQuery.eq("id", "__no_access__");
    const query = hideDraftsForSalesRole ? scopedQuery.eq("is_draft", false) : scopedQuery;

    const { data, error } = await query;

    if (error) {
      setToast({ message: error.message || "Failed to load leads", type: "error" });
      return;
    }

    const mapped: IntakeLead[] = (data || []).map((lead: Record<string, unknown>) => {
      const callCenterObj = lead.call_centers as { name?: unknown } | null | undefined;
      const pipelineObj = lead.pipelines as { name?: unknown } | null | undefined;
      const userObj = lead.users as { full_name?: unknown } | null | undefined;
      const submissionIdRaw = lead.submission_id;

      return {
        rowId: typeof lead.id === "string" ? lead.id : String(lead.id ?? ""),
        submissionId: typeof submissionIdRaw === "string" && submissionIdRaw.trim() !== "" ? submissionIdRaw : null,
        id: typeof lead.lead_unique_id === "string" && lead.lead_unique_id.trim() !== "" ? lead.lead_unique_id : "N/A",
        name: `${typeof lead.first_name === "string" ? lead.first_name : ""} ${typeof lead.last_name === "string" ? lead.last_name : ""}`.trim() || "Unnamed Lead",
        phone: typeof lead.phone === "string" ? lead.phone : "",
        premium: Number(lead.lead_value) || 0,
        type: typeof lead.product_type === "string" && lead.product_type.trim() !== "" ? lead.product_type : "Transfer",
        source: typeof lead.lead_source === "string" && lead.lead_source.trim() !== "" ? lead.lead_source : "Unknown",
        centerName: typeof callCenterObj?.name === "string" && callCenterObj.name.trim() !== "" ? callCenterObj.name : "Unassigned",
        pipelineName: typeof pipelineObj?.name === "string" && pipelineObj.name.trim() !== "" ? pipelineObj.name : "Transfer Portal",
        stage: typeof lead.stage === "string" && lead.stage.trim() !== "" ? lead.stage : "Transfer API",
        createdBy: typeof userObj?.full_name === "string" && userObj.full_name.trim() !== "" ? userObj.full_name.trim() : "Unknown",
        createdAt: lead.created_at ? new Date(String(lead.created_at)).toLocaleString() : "Just now",
        createdAtIso: lead.created_at ? String(lead.created_at) : "",
        isDraft: typeof lead.is_draft === "boolean" ? lead.is_draft : false,
        carrier: typeof lead.carrier === "string" && lead.carrier.trim() !== "" ? lead.carrier : "N/A",
        state: typeof lead.state === "string" && lead.state.trim() !== "" ? lead.state : "N/A",
      };
    });

    setLeads(mapped);
    setIsLoading(false);
  };

  const toggleColumnCollapse = (columnId: string) => {
    setCollapsedColumns((prev) => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  const openClaimModalForLead = async (lead: IntakeLead) => {
    if (!canViewTransferClaimReclaimVisit) {
      setToast({ message: "Missing permission to start verification.", type: "error" });
      return;
    }
    const context: ClaimLeadContext = {
      rowId: lead.rowId,
      leadUniqueId: lead.id,
      leadName: lead.name,
      phone: lead.phone,
      source: lead.source,
      submissionId: lead.submissionId,
    };
    const initialSelection: ClaimSelections = { ...DEFAULT_CLAIM_SELECTION };

    setClaimLeadContext(context);
    setClaimSelection(initialSelection);
    setIsRetentionOnlyMode(false);
    setClaimModalOpen(true);
    setClaimModalLoading(true);
    try {
      const loaded = await fetchClaimAgents(supabase);
      setClaimAgents(loaded);

      // Clicking "Start verification" should initialize verification immediately,
      // even before the user confirms assignments in the modal.
      await findOrCreateVerificationSession(supabase, context, initialSelection);
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Failed to load claim agents.",
        type: "error",
      });
    } finally {
      setClaimModalLoading(false);
    }
  };

  const openRetentionModalForLead = async (lead: IntakeLead) => {
    if (!canViewTransferClaimReclaimVisit) {
      setToast({ message: "Missing permission to process retention.", type: "error" });
      return;
    }
    const context: ClaimLeadContext = {
      rowId: lead.rowId,
      leadUniqueId: lead.id,
      leadName: lead.name,
      phone: lead.phone,
      source: lead.source,
      submissionId: lead.submissionId,
    };
    // Pre-select retention workflow
    const initialSelection: ClaimSelections = {
      ...DEFAULT_CLAIM_SELECTION,
      workflowType: "retention",
      isRetentionCall: true,
    };

    setClaimLeadContext(context);
    setClaimSelection(initialSelection);
    setIsRetentionOnlyMode(true);
    setClaimModalOpen(true);
    setClaimModalLoading(true);
    try {
      const loaded = await fetchClaimAgents(supabase);
      setClaimAgents(loaded);
      // Initialize verification session for retention
      await findOrCreateVerificationSession(supabase, context, initialSelection);
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Failed to load retention agents.",
        type: "error",
      });
    } finally {
      setClaimModalLoading(false);
    }
  };

  const handleClaimAndOpenLead = async () => {
    if (!claimLeadContext) return;
    setClaimModalLoading(true);
    try {
      // For retention-only mode, use the full retention workflow
      if (isRetentionOnlyMode) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id || null;
        await saveFullRetentionWorkflow(supabase, claimLeadContext, claimSelection, userId);
        setClaimModalOpen(false);
        await refreshLeads();
        setToast({ message: "Retention workflow processed successfully.", type: "success" });
        return;
      }

      // Standard claim workflow
      const found = await findOrCreateVerificationSession(supabase, claimLeadContext, claimSelection);
      await applyClaimSelectionToSession(supabase, found.sessionId, found.submissionId, claimSelection);
      setClaimModalOpen(false);
      await refreshLeads();
      router.push(`/dashboard/${routeRole}/transfer-leads/${claimLeadContext.rowId}`);
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Failed to claim lead.",
        type: "error",
      });
    } finally {
      setClaimModalLoading(false);
    }
  };

  useEffect(() => {
    refreshLeads();
  }, [supabase]);

  useEffect(() => {
    const fetchDefaultTransferStage = async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id")
        .eq("name", "Transfer Portal")
        .maybeSingle();

      if (error || !data?.id) return;
      setDefaultTransferPipelineId(data.id);

      const { data: stageData, error: stageError } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("pipeline_id", data.id)
        .eq("name", "Transfer API")
        .maybeSingle();

      if (!stageError && stageData?.id) {
        setDefaultTransferStageId(stageData.id);
      }
    };

    void fetchDefaultTransferStage();
  }, [supabase]);

  const centerOptions = useMemo(() => Array.from(new Set(leads.map((l) => l.centerName))), [leads]);
  const createdByOptions = useMemo(() => Array.from(new Set(leads.map((l) => l.createdBy))), [leads]);
  const productTypeOptions = useMemo(() => Array.from(new Set(leads.map((l) => l.type))), [leads]);
  const carrierOptions = useMemo(() => Array.from(new Set(leads.map((l) => l.carrier))).filter(v => v && v !== "N/A"), [leads]);
  const stateOptions = useMemo(() => Array.from(new Set(leads.map((l) => l.state))).filter(v => v && v !== "N/A"), [leads]);

  const transferLeadsHasActiveFilters = useMemo(() => {
    const minP = filterMinPremium.trim();
    const maxP = filterMaxPremium.trim();
    return (
      filterDateSingle !== "" ||
      filterDateFrom !== "" ||
      filterDateTo !== "" ||
      filterCenter !== "All" ||
      filterCarrier !== "All" ||
      filterState !== "All" ||
      filterCreatedBy !== "All" ||
      filterProductType !== "All" ||
      filterDraft !== "All" ||
      (minP !== "" && !Number.isNaN(Number(minP))) ||
      (maxP !== "" && !Number.isNaN(Number(maxP)))
    );
  }, [
    search,
    filterDateSingle,
    filterDateFrom,
    filterDateTo,
    filterCenter,
    filterCarrier,
    filterState,
    filterCreatedBy,
    filterProductType,
    filterDraft,
    filterMinPremium,
    filterMaxPremium,
  ]);

  const transferLeadDetailedFilterCount = useMemo(() => {
    const minP = filterMinPremium.trim();
    const maxP = filterMaxPremium.trim();
    let n = 0;
    if (filterDateSingle !== "") n++;
    if (filterDateFrom !== "") n++;
    if (filterDateTo !== "") n++;
    if (filterCenter !== "All") n++;
    if (filterCarrier !== "All") n++;
    if (filterState !== "All") n++;
    if (filterCreatedBy !== "All") n++;
    if (filterProductType !== "All") n++;
    if (filterDraft !== "All") n++;
    if (minP !== "" && !Number.isNaN(Number(minP))) n++;
    if (maxP !== "" && !Number.isNaN(Number(maxP))) n++;
    return n;
  }, [
    filterDateSingle,
    filterDateFrom,
    filterDateTo,
    filterCenter,
    filterCarrier,
    filterState,
    filterCreatedBy,
    filterProductType,
    filterDraft,
    filterMinPremium,
    filterMaxPremium,
  ]);

  const clearTransferLeadFilters = () => {
    setSearch("");
    setFilterDateSingle("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterCenter("All");
    setFilterCarrier("All");
    setFilterState("All");
    setFilterCreatedBy("All");
    setFilterProductType("All");
    setFilterDraft("All");
    setFilterMinPremium("");
    setFilterMaxPremium("");
    setPage(1);
  };

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    const numericQuery = query.replace(/\D/g, "");
    const minPrem = filterMinPremium.trim() ? Number(filterMinPremium) : null;
    const maxPrem = filterMaxPremium.trim() ? Number(filterMaxPremium) : null;
    const minOk = minPrem == null || !Number.isNaN(minPrem);
    const maxOk = maxPrem == null || !Number.isNaN(maxPrem);

    return leads.filter((lead) => {
      const matchSearch =
        !query ||
        lead.name.toLowerCase().includes(query) ||
        (numericQuery !== "" && lead.phone.replace(/\D/g, "").includes(numericQuery)) ||
        lead.id.toLowerCase().includes(query) ||
        (lead.submissionId && String(lead.submissionId).toLowerCase().includes(query));
      const day = transferLeadDayKey(lead.createdAtIso);
      let matchDate = true;
      if (filterDateSingle) {
        matchDate = day === filterDateSingle;
      } else {
        if (filterDateFrom && day && day < filterDateFrom) matchDate = false;
        if (filterDateTo && day && day > filterDateTo) matchDate = false;
      }
      const matchCenter = filterCenter === "All" || lead.centerName === filterCenter;
      const matchCarrier = filterCarrier === "All" || lead.carrier === filterCarrier;
      const matchState = filterState === "All" || lead.state === filterState;
      const matchCreatedBy = filterCreatedBy === "All" || lead.createdBy === filterCreatedBy;
      const matchType = filterProductType === "All" || lead.type === filterProductType;
      const matchDraft =
        filterDraft === "All" ||
        (filterDraft === "draft" ? Boolean(lead.isDraft) : !lead.isDraft);
      let matchPrem = true;
      if (minOk && minPrem != null) matchPrem = matchPrem && lead.premium >= minPrem;
      if (maxOk && maxPrem != null) matchPrem = matchPrem && lead.premium <= maxPrem;

      return (
        matchSearch &&
        matchDate &&
        matchCenter &&
        matchCarrier &&
        matchState &&
        matchCreatedBy &&
        matchType &&
        matchDraft &&
        matchPrem
      );
    });
  }, [
    leads,
    search,
    filterDateSingle,
    filterDateFrom,
    filterDateTo,
    filterCenter,
    filterCarrier,
    filterState,
    filterCreatedBy,
    filterProductType,
    filterDraft,
    filterMinPremium,
    filterMaxPremium,
  ]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    filterDateSingle,
    filterDateFrom,
    filterDateTo,
    filterCenter,
    filterCarrier,
    filterState,
    filterCreatedBy,
    filterProductType,
    filterDraft,
    filterMinPremium,
    filterMaxPremium,
  ]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
    if (filtered.length === 0 && page !== 1) setPage(1);
  }, [filtered.length, page, totalPages]);

  useEffect(() => {
    setPageHeaderActions(null);
    return () => setPageHeaderActions(null);
  }, [setPageHeaderActions]);

  // Stats (match filtered table)
  const totalPremium = filtered.reduce((s, l) => s + l.premium, 0);
  const avgPremium = filtered.length ? totalPremium / filtered.length : 0;
  const uniquePipelines = new Set(filtered.map((l) => l.pipelineName)).size;
  const draftCount = filtered.reduce((n, l) => n + (l.isDraft ? 1 : 0), 0);

  const promptDuplicateIfAny = async (payload: TransferLeadFormData): Promise<boolean> => {
    const phoneDigits = normalizePhoneDigits(payload.phone || "");
    const ssnDigits = normalizeSsnDigits(payload.social || "");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id || null;
    if (!currentUserId) return false;

    const loadDuplicateRulesByGhlStage = async () => {
      const { data: rulesData, error: rulesError } = await supabase
        .from("ssn_duplicate_stage_rules")
        .select("stage_name, ghl_stage, message, is_addable, is_active")
        .eq("is_active", true);
      if (rulesError) throw new Error(rulesError.message || "Unable to load duplicate rules.");
      const rules = ((rulesData || []) as SsnDuplicateRule[]).map((rule) => ({
        ...rule,
        stage_name: String(rule.stage_name || "").trim(),
        ghl_stage: String(rule.ghl_stage || "").trim() || null,
      }));
      const ruleByGhlStage = new Map<string, SsnDuplicateRule>();
      rules.forEach((rule) => {
        if (rule.ghl_stage) ruleByGhlStage.set(rule.ghl_stage.toLowerCase(), rule);
      });
      return ruleByGhlStage;
    };

    const findDuplicateByPhone = async () => {
      if (phoneDigits.length !== 10) return null;
      const variants = Array.from(
        new Set([payload.phone?.trim(), phoneDigits, formatUsPhone(phoneDigits)].filter(Boolean)),
      );
      const { data: existing, error: existingError } = await supabase
        .from("leads")
        .select("id, lead_unique_id, first_name, last_name, phone, social, stage, created_at")
        .eq("submitted_by", currentUserId)
        .in("phone", variants)
        .order("created_at", { ascending: false });
      if (existingError) return null;
      return (
        (existing || []).find(
          (row: { phone: string | null }) => normalizePhoneDigits(String(row.phone || "")) === phoneDigits,
        ) || null
      );
    };

    const findDuplicateBySsn = async () => {
      if (ssnDigits.length !== 9) return null;
      const variants = Array.from(
        new Set([payload.social?.trim(), ssnDigits, formatSsn(ssnDigits)].filter(Boolean)),
      );
      const { data: existing, error: existingError } = await supabase
        .from("leads")
        .select("id, lead_unique_id, first_name, last_name, phone, social, stage, created_at")
        .eq("submitted_by", currentUserId)
        .in("social", variants)
        .order("created_at", { ascending: false });
      if (existingError) return null;
      return (
        (existing || []).find(
          (row: { social: string | null }) => normalizeSsnDigits(String(row.social || "")) === ssnDigits,
        ) || null
      );
    };

    const showDuplicateDialogForLead = async (existingLead: DuplicateQueryLead, matchType: "phone" | "ssn") => {
      try {
        const ruleByStage = await loadDuplicateRulesByGhlStage();
        const stage = String(existingLead.stage || "").trim();
        const rule = stage ? ruleByStage.get(stage.toLowerCase()) : undefined;
        const ghlStage = rule?.ghl_stage ? ` (GHL: ${rule.ghl_stage})` : "";
        const baseMessage = rule?.message || `A lead already exists with this ${matchType === "phone" ? "phone number" : "SSN"}.`;
        setDuplicateRuleMessage(`${baseMessage}${stage ? ` Stage: ${stage}.` : ""}${ghlStage}`);
        setDuplicateIsAddable(rule?.is_addable ?? true);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to load duplicate rule message.";
        setDuplicateRuleMessage(message);
        setDuplicateIsAddable(true);
      }

      setPendingCreatePayload(payload);
      setDuplicateLeadMatch({
        id: existingLead.id,
        lead_unique_id: existingLead.lead_unique_id ?? null,
        first_name: existingLead.first_name ?? null,
        last_name: existingLead.last_name ?? null,
        phone: existingLead.phone ?? null,
        social: existingLead.social ?? null,
        stage: existingLead.stage ?? null,
        match_type: matchType,
        created_at: existingLead.created_at ?? null,
      });
      setShowDuplicateDialog(true);
    };

    const phoneMatch = await findDuplicateByPhone();
    if (phoneMatch) {
      await showDuplicateDialogForLead(phoneMatch, "phone");
      return true;
    }

    const ssnMatch = await findDuplicateBySsn();
    if (ssnMatch) {
      await showDuplicateDialogForLead(ssnMatch, "ssn");
      return true;
    }

    return false;
  };

  const handleCreateLead = async (payload: TransferLeadFormData) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setToast({ message: "You are not logged in", type: "error" });
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("call_center_id")
      .eq("id", session.user.id)
      .maybeSingle();

    const leadUniqueId = normalizeLeadUniqueId(payload.leadUniqueId) || buildLeadUniqueId(payload);
    const generatedSubmissionId = buildSubmissionId(callCenterName);

    const hasDuplicate = await promptDuplicateIfAny(payload);
    if (hasDuplicate) return;

    const insertLead = async (finalPayload: TransferLeadFormData, asDuplicate: boolean) => {
      const existingAdditional = (finalPayload.additionalInformation || "").trim();
      return supabase
        .from("leads")
        .insert({
          submission_id: generatedSubmissionId,
          lead_unique_id: leadUniqueId,
          lead_value: Number(finalPayload.leadValue || 0),
          lead_source: FIXED_BPO_LEAD_SOURCE,
          submission_date: finalPayload.submissionDate,
          first_name: finalPayload.firstName,
          last_name: finalPayload.lastName,
          street1: finalPayload.street1,
          street2: finalPayload.street2 || null,
          city: finalPayload.city,
          state: finalPayload.state,
          zip_code: finalPayload.zipCode,
          phone: finalPayload.phone,
          sms_access: finalPayload.smsAccess,
          email_access: finalPayload.emailAccess,
          language: finalPayload.language,
          birth_state: finalPayload.birthState,
          date_of_birth: finalPayload.dateOfBirth,
          age: finalPayload.age,
          social: finalPayload.social,
          driver_license_number: finalPayload.driverLicenseNumber,
          existing_coverage_last_2_years: finalPayload.existingCoverageLast2Years,
          existing_coverage_details: finalPayload.existingCoverageDetails || null,
          previous_applications_2_years: finalPayload.previousApplications2Years,
          height: finalPayload.height,
          weight: finalPayload.weight,
          doctor_name: finalPayload.doctorName,
          tobacco_use: finalPayload.tobaccoUse,
          health_conditions: finalPayload.healthConditions,
          medications: finalPayload.medications,
          monthly_premium: finalPayload.monthlyPremium,
          coverage_amount: finalPayload.coverageAmount,
          carrier: finalPayload.carrier,
          product_type: finalPayload.productType,
          draft_date: finalPayload.draftDate,
          beneficiary_information: finalPayload.beneficiaryInformation,
          bank_account_type: finalPayload.bankAccountType || null,
          institution_name: finalPayload.institutionName,
          routing_number: finalPayload.routingNumber,
          account_number: finalPayload.accountNumber,
          future_draft_date: finalPayload.futureDraftDate,
          additional_information: existingAdditional || null,
          tags: asDuplicate ? ["duplicate"] : [],
          stage: finalPayload.stage || "Transfer API",
          pipeline_id: defaultTransferPipelineId,
          stage_id: defaultTransferStageId,
          is_draft: false,
          call_center_id: userProfile?.call_center_id || null,
          submitted_by: session.user.id,
        })
        .select("id")
        .single();
    };

    const { data: insertedLead, error } = await insertLead(payload, false);

    if (error) {
      setToast({ message: error.message || "Failed to save lead", type: "error" });
      return;
    }

    let feCreateLeadSyncError: string | null = null;
    if (insertedLead?.id) {
      const leadName = `${payload.firstName} ${payload.lastName}`.trim() || "Unnamed Lead";
      await insertDailyDealFlowEntry(supabase, {
        submissionId: generatedSubmissionId,
        leadVendor: callCenterName,
        leadName,
        payload,
        callCenterId: userProfile?.call_center_id || null,
      });
      void notifySlackTransferPortalLead(supabase, {
        leadId: insertedLead.id,
        submissionId: generatedSubmissionId,
        leadUniqueId,
        payload,
        callCenterName,
        callCenterId: userProfile?.call_center_id || null,
      });
      try {
        await postFeCreateLeadAtFixedUrl(
          supabase,
          buildFeCreateLeadBodyFromIntakePayload(payload, {
            submissionId: generatedSubmissionId,
            leadVendor: callCenterName,
          }),
          "[CallCenterLeadIntake]",
        );
      } catch (feErr) {
        feCreateLeadSyncError = feErr instanceof Error ? feErr.message : String(feErr);
        console.warn("[CallCenterLeadIntake] fe-create-lead failed after insert", feErr);
      }
    }

    setToast({
      message: feCreateLeadSyncError
        ? `Lead saved. fe-create-lead sync failed: ${feCreateLeadSyncError}`
        : "Lead saved successfully",
      type: feCreateLeadSyncError ? "error" : "success",
    });
    setShowCreateLead(false);
    setPage(1);
    await refreshLeads();
  };

  const handleCreateDuplicateLead = async () => {
    if (!pendingCreatePayload) return;
    if (!duplicateIsAddable) {
      setToast({ message: "Duplicate creation is not allowed for the existing lead’s current stage.", type: "error" });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setToast({ message: "You are not logged in", type: "error" });
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("call_center_id")
      .eq("id", session.user.id)
      .maybeSingle();

    const leadUniqueId = normalizeLeadUniqueId(pendingCreatePayload.leadUniqueId) || buildLeadUniqueId(pendingCreatePayload);
    const generatedSubmissionId = buildSubmissionId(callCenterName);
    const existingAdditional = (pendingCreatePayload.additionalInformation || "").trim();

    const { data: dupInserted, error } = await supabase
      .from("leads")
      .insert({
        submission_id: generatedSubmissionId,
        lead_unique_id: leadUniqueId,
        lead_value: Number(pendingCreatePayload.leadValue || 0),
        lead_source: FIXED_BPO_LEAD_SOURCE,
        submission_date: pendingCreatePayload.submissionDate,
        first_name: pendingCreatePayload.firstName,
        last_name: pendingCreatePayload.lastName,
        street1: pendingCreatePayload.street1,
        street2: pendingCreatePayload.street2 || null,
        city: pendingCreatePayload.city,
        state: pendingCreatePayload.state,
        zip_code: pendingCreatePayload.zipCode,
        phone: pendingCreatePayload.phone,
        sms_access: pendingCreatePayload.smsAccess,
        email_access: pendingCreatePayload.emailAccess,
        language: pendingCreatePayload.language,
        birth_state: pendingCreatePayload.birthState,
        date_of_birth: pendingCreatePayload.dateOfBirth,
        age: pendingCreatePayload.age,
        social: pendingCreatePayload.social,
        driver_license_number: pendingCreatePayload.driverLicenseNumber,
        existing_coverage_last_2_years: pendingCreatePayload.existingCoverageLast2Years,
        existing_coverage_details: pendingCreatePayload.existingCoverageDetails || null,
        previous_applications_2_years: pendingCreatePayload.previousApplications2Years,
        height: pendingCreatePayload.height,
        weight: pendingCreatePayload.weight,
        doctor_name: pendingCreatePayload.doctorName,
        tobacco_use: pendingCreatePayload.tobaccoUse,
        health_conditions: pendingCreatePayload.healthConditions,
        medications: pendingCreatePayload.medications,
        monthly_premium: pendingCreatePayload.monthlyPremium,
        coverage_amount: pendingCreatePayload.coverageAmount,
        carrier: pendingCreatePayload.carrier,
        product_type: pendingCreatePayload.productType,
        draft_date: pendingCreatePayload.draftDate,
        beneficiary_information: pendingCreatePayload.beneficiaryInformation,
        bank_account_type: pendingCreatePayload.bankAccountType || null,
        institution_name: pendingCreatePayload.institutionName,
        routing_number: pendingCreatePayload.routingNumber,
        account_number: pendingCreatePayload.accountNumber,
        future_draft_date: pendingCreatePayload.futureDraftDate,
        additional_information: existingAdditional || null,
        tags: ["duplicate"],
        stage: pendingCreatePayload.stage || "Transfer API",
        pipeline_id: defaultTransferPipelineId,
        stage_id: defaultTransferStageId,
        is_draft: false,
        call_center_id: userProfile?.call_center_id || null,
        submitted_by: session.user.id,
      })
      .select("id")
      .single();

    if (error) {
      setToast({ message: error.message || "Failed to save duplicate lead", type: "error" });
      return;
    }

    let feCreateLeadDupSyncError: string | null = null;
    if (dupInserted?.id) {
      const leadName = `${pendingCreatePayload.firstName} ${pendingCreatePayload.lastName}`.trim() || "Unnamed Lead";
      await insertDailyDealFlowEntry(supabase, {
        submissionId: generatedSubmissionId,
        leadVendor: callCenterName,
        leadName,
        payload: pendingCreatePayload,
        callCenterId: userProfile?.call_center_id || null,
      });
      void notifySlackTransferPortalLead(supabase, {
        leadId: dupInserted.id,
        submissionId: generatedSubmissionId,
        leadUniqueId,
        payload: pendingCreatePayload,
        callCenterName,
        callCenterId: userProfile?.call_center_id || null,
      });
      try {
        await postFeCreateLeadAtFixedUrl(
          supabase,
          buildFeCreateLeadBodyFromIntakePayload(pendingCreatePayload, {
            submissionId: generatedSubmissionId,
            leadVendor: callCenterName,
          }),
          "[CallCenterLeadIntake:duplicate]",
        );
      } catch (feErr) {
        feCreateLeadDupSyncError = feErr instanceof Error ? feErr.message : String(feErr);
        console.warn("[CallCenterLeadIntake] fe-create-lead failed after duplicate insert", feErr);
      }
    }

    setShowDuplicateDialog(false);
    setPendingCreatePayload(null);
    setDuplicateLeadMatch(null);
    setToast({
      message: feCreateLeadDupSyncError
        ? `Duplicate lead saved. fe-create-lead sync failed: ${feCreateLeadDupSyncError}`
        : "Duplicate lead saved with duplicate tag",
      type: feCreateLeadDupSyncError ? "error" : "success",
    });
    setShowCreateLead(false);
    setPage(1);
    await refreshLeads();
  };

  const handleEditExistingDuplicateLead = async () => {
    if (!pendingCreatePayload) return;
    if (!duplicateLeadMatch?.id) return;
    if (!canOverwriteDuplicateMatch(duplicateLeadMatch)) {
      setToast({ message: "You do not have permission to overwrite this lead.", type: "error" });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setToast({ message: "You are not logged in", type: "error" });
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("call_center_id")
      .eq("id", session.user.id)
      .maybeSingle();

    const { error } = await supabase
      .from("leads")
      .update({
        lead_unique_id: normalizeLeadUniqueId(pendingCreatePayload.leadUniqueId) || buildLeadUniqueId(pendingCreatePayload),
        lead_value: Number(pendingCreatePayload.leadValue || 0),
        lead_source: FIXED_BPO_LEAD_SOURCE,
        submission_date: pendingCreatePayload.submissionDate,
        first_name: pendingCreatePayload.firstName,
        last_name: pendingCreatePayload.lastName,
        street1: pendingCreatePayload.street1,
        street2: pendingCreatePayload.street2 || null,
        city: pendingCreatePayload.city,
        state: pendingCreatePayload.state,
        zip_code: pendingCreatePayload.zipCode,
        phone: pendingCreatePayload.phone,
        sms_access: pendingCreatePayload.smsAccess,
        email_access: pendingCreatePayload.emailAccess,
        language: pendingCreatePayload.language,
        birth_state: pendingCreatePayload.birthState,
        date_of_birth: pendingCreatePayload.dateOfBirth,
        age: pendingCreatePayload.age,
        social: pendingCreatePayload.social,
        driver_license_number: pendingCreatePayload.driverLicenseNumber,
        existing_coverage_last_2_years: pendingCreatePayload.existingCoverageLast2Years,
        existing_coverage_details: pendingCreatePayload.existingCoverageDetails || null,
        previous_applications_2_years: pendingCreatePayload.previousApplications2Years,
        height: pendingCreatePayload.height,
        weight: pendingCreatePayload.weight,
        doctor_name: pendingCreatePayload.doctorName,
        tobacco_use: pendingCreatePayload.tobaccoUse,
        health_conditions: pendingCreatePayload.healthConditions,
        medications: pendingCreatePayload.medications,
        monthly_premium: pendingCreatePayload.monthlyPremium,
        coverage_amount: pendingCreatePayload.coverageAmount,
        carrier: pendingCreatePayload.carrier,
        product_type: pendingCreatePayload.productType,
        draft_date: pendingCreatePayload.draftDate,
        beneficiary_information: pendingCreatePayload.beneficiaryInformation,
        bank_account_type: pendingCreatePayload.bankAccountType || null,
        institution_name: pendingCreatePayload.institutionName,
        routing_number: pendingCreatePayload.routingNumber,
        account_number: pendingCreatePayload.accountNumber,
        future_draft_date: pendingCreatePayload.futureDraftDate,
        additional_information: pendingCreatePayload.additionalInformation || null,
        stage: pendingCreatePayload.stage || "Transfer API",
        pipeline_id: defaultTransferPipelineId,
        stage_id: defaultTransferStageId,
        is_draft: false,
        call_center_id: userProfile?.call_center_id || null,
      })
      .eq("id", duplicateLeadMatch.id);

    if (error) {
      setToast({ message: error.message || "Failed to update existing duplicate lead", type: "error" });
      return;
    }

    setShowDuplicateDialog(false);
    setPendingCreatePayload(null);
    setDuplicateLeadMatch(null);
    setDuplicateRuleMessage("");
    setShowCreateLead(false);
    setToast({ message: "Existing lead updated successfully", type: "success" });
    setPage(1);
    await refreshLeads();
  };

  const handleCreateDraftLead = async (payload: TransferLeadFormData) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setToast({ message: "You are not logged in", type: "error" });
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("call_center_id")
      .eq("id", session.user.id)
      .maybeSingle();

    const leadUniqueId = normalizeLeadUniqueId(payload.leadUniqueId) || buildLeadUniqueId(payload);
    const generatedSubmissionId = buildSubmissionId(callCenterName);

    const { error } = await supabase.from("leads").insert({
      submission_id: generatedSubmissionId,
      lead_unique_id: leadUniqueId,
      lead_value: Number(payload.leadValue || 0),
      lead_source: FIXED_BPO_LEAD_SOURCE,
      submission_date: payload.submissionDate || null,
      first_name: payload.firstName || null,
      last_name: payload.lastName || null,
      street1: payload.street1 || null,
      street2: payload.street2 || null,
      city: payload.city || null,
      state: payload.state || null,
      zip_code: payload.zipCode || null,
      phone: payload.phone || null,
      sms_access: payload.smsAccess,
      email_access: payload.emailAccess,
      language: payload.language || null,
      birth_state: payload.birthState || null,
      date_of_birth: payload.dateOfBirth || null,
      age: payload.age || null,
      social: payload.social || null,
      driver_license_number: payload.driverLicenseNumber || null,
      existing_coverage_last_2_years: payload.existingCoverageLast2Years || null,
      existing_coverage_details: payload.existingCoverageDetails || null,
      previous_applications_2_years: payload.previousApplications2Years || null,
      height: payload.height || null,
      weight: payload.weight || null,
      doctor_name: payload.doctorName || null,
      tobacco_use: payload.tobaccoUse || null,
      health_conditions: payload.healthConditions || null,
      medications: payload.medications || null,
      monthly_premium: payload.monthlyPremium || null,
      coverage_amount: payload.coverageAmount || null,
      carrier: payload.carrier || null,
      product_type: payload.productType || null,
      draft_date: payload.draftDate || null,
      beneficiary_information: payload.beneficiaryInformation || null,
      bank_account_type: payload.bankAccountType || null,
      institution_name: payload.institutionName || null,
      routing_number: payload.routingNumber || null,
      account_number: payload.accountNumber || null,
      future_draft_date: payload.futureDraftDate || null,
      additional_information: payload.additionalInformation || null,
      stage: payload.stage || "Transfer API",
      pipeline_id: defaultTransferPipelineId,
      stage_id: defaultTransferStageId,
      is_draft: true,
      call_center_id: userProfile?.call_center_id || null,
      submitted_by: session.user.id,
    });

    if (error) {
      setToast({ message: error.message || "Failed to save draft", type: "error" });
      return;
    }

    setToast({ message: "Draft saved", type: "success" });
    setShowCreateLead(false);
    setPage(1);
    await refreshLeads();
  };

  const openLeadInForm = async (rowId: string) => {
    const { data, error } = await supabase
      .from("leads")
      .select("id, lead_unique_id, lead_value, lead_source, submission_date, first_name, last_name, street1, street2, city, state, zip_code, phone, sms_access, email_access, language, birth_state, date_of_birth, age, social, driver_license_number, existing_coverage_last_2_years, previous_applications_2_years, height, weight, doctor_name, tobacco_use, health_conditions, medications, monthly_premium, coverage_amount, carrier, product_type, draft_date, beneficiary_information, bank_account_type, institution_name, routing_number, account_number, future_draft_date, additional_information, pipeline_id, stage, is_draft, pipelines(name)")
      .eq("id", rowId)
      .maybeSingle();

    if (error || !data) {
      setToast({ message: error?.message || "Failed to load lead for editing", type: "error" });
      return;
    }

    const mapped: TransferLeadFormData = {
      leadUniqueId: data.lead_unique_id || "",
      leadValue: data.lead_value != null ? String(data.lead_value) : "",
      leadSource: FIXED_BPO_LEAD_SOURCE,
      submissionDate: data.submission_date || "",
      firstName: data.first_name || "",
      lastName: data.last_name || "",
      street1: data.street1 || "",
      street2: data.street2 || "",
      city: data.city || "",
      state: data.state || "",
      zipCode: data.zip_code || "",
      phone: data.phone || "",
      smsAccess: Boolean((data as any).sms_access),
      emailAccess: Boolean((data as any).email_access),
      language: data.language || "English",
      birthState: data.birth_state || "",
      dateOfBirth: data.date_of_birth || "",
      age: data.age || "",
      social: data.social || "",
      driverLicenseNumber: data.driver_license_number || "",
      existingCoverageLast2Years: data.existing_coverage_last_2_years || "",
      existingCoverageDetails: (data as any).existing_coverage_details || "",
      previousApplications2Years: data.previous_applications_2_years || "",
      height: data.height || "",
      weight: data.weight || "",
      doctorName: data.doctor_name || "",
      tobaccoUse: data.tobacco_use || "",
      healthConditions: data.health_conditions || "",
      medications: data.medications || "",
      monthlyPremium: data.monthly_premium || "",
      coverageAmount: data.coverage_amount || "",
      carrier: data.carrier || "",
      productType: data.product_type || "",
      draftDate: data.draft_date || "",
      beneficiaryInformation: data.beneficiary_information || "",
      bankAccountType: data.bank_account_type || "",
      institutionName: data.institution_name || "",
      routingNumber: data.routing_number || "",
      accountNumber: data.account_number || "",
      futureDraftDate: data.future_draft_date || "",
      additionalInformation: data.additional_information || "",
      pipeline: (data.pipelines as { name?: string | null } | null)?.name || "Transfer Portal",
      stage: data.stage || "Transfer API",
      isDraft: data.is_draft ?? false,
    };

    setEditingLead({ rowId, formData: mapped });
  };

  const handleEditLead = async (rowId: string) => {
    if (!canEditTransferLeads) {
      setToast({ message: "You do not have permission to edit transfer leads.", type: "error" });
      return;
    }
    await openLeadInForm(rowId);
  };

  const openLeadFromGrid = async (lead: IntakeLead) => {
    // Only call center agents (not admins) can open their own drafts for editing
    if (lead.isDraft && isCallCenterAgentOnly) {
      await openLeadInForm(lead.rowId);
      return;
    }
    setViewingLead({ id: lead.id, name: lead.name, rowUuid: lead.rowId });
  };

  const handleUpdateLead = async (payload: TransferLeadFormData) => {
    if (!editingLead?.rowId) return;
    // Only call center agents (not admins) can resume/update their own drafts
    const canResumeDraftAsCallCenter = Boolean(isCallCenterAgentOnly && editingLead.formData.isDraft);
    const wasDraftBeforeUpdate = Boolean(editingLead.formData.isDraft);
    if (!canEditTransferLeads && !canResumeDraftAsCallCenter) {
      setToast({ message: "You do not have permission to edit transfer leads.", type: "error" });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data: userProfile } = session?.user?.id
      ? await supabase
          .from("users")
          .select("call_center_id")
          .eq("id", session.user.id)
          .maybeSingle()
      : { data: null as { call_center_id?: string | null } | null };

    const leadUniqueId = normalizeLeadUniqueId(payload.leadUniqueId) || buildLeadUniqueId(payload);

    // Build the query with ownership check for call center agents
    let updateQuery = supabase
      .from("leads")
      .update({
        lead_unique_id: leadUniqueId,
        lead_value: Number(payload.leadValue || 0),
        lead_source: FIXED_BPO_LEAD_SOURCE,
        submission_date: payload.submissionDate,
        first_name: payload.firstName,
        last_name: payload.lastName,
        street1: payload.street1,
        street2: payload.street2 || null,
        city: payload.city,
        state: payload.state,
        zip_code: payload.zipCode,
        phone: payload.phone,
        sms_access: payload.smsAccess,
        email_access: payload.emailAccess,
        language: payload.language,
        birth_state: payload.birthState,
        date_of_birth: payload.dateOfBirth,
        age: payload.age,
        social: payload.social,
        driver_license_number: payload.driverLicenseNumber,
        existing_coverage_last_2_years: payload.existingCoverageLast2Years,
        existing_coverage_details: payload.existingCoverageDetails || null,
        previous_applications_2_years: payload.previousApplications2Years,
        height: payload.height,
        weight: payload.weight,
        doctor_name: payload.doctorName,
        tobacco_use: payload.tobaccoUse,
        health_conditions: payload.healthConditions,
        medications: payload.medications,
        monthly_premium: payload.monthlyPremium,
        coverage_amount: payload.coverageAmount,
        carrier: payload.carrier,
        product_type: payload.productType,
        draft_date: payload.draftDate,
        beneficiary_information: payload.beneficiaryInformation,
        bank_account_type: payload.bankAccountType || null,
        institution_name: payload.institutionName,
        routing_number: payload.routingNumber,
        account_number: payload.accountNumber,
        future_draft_date: payload.futureDraftDate,
        additional_information: payload.additionalInformation || null,
        stage: payload.stage || "Transfer API",
        pipeline_id: defaultTransferPipelineId,
        stage_id: defaultTransferStageId,
        is_draft: false,
        call_center_id: userProfile?.call_center_id || null,
      })
      .eq("id", editingLead.rowId);

    // Add ownership filter for call center agents (not admins) to ensure they can only update their own drafts
    if (isCallCenterAgentOnly && !canEditTransferLeads && session?.user?.id) {
      updateQuery = updateQuery.eq("submitted_by", session.user.id);
    }

    const { data: updatedLead, error } = await updateQuery
      .select("id, submission_id")
      .single();

    if (error) {
      setToast({ message: error.message || "Failed to update lead", type: "error" });
      return;
    }

    let feCreateLeadDraftSubmitSyncError: string | null = null;
    if (wasDraftBeforeUpdate && updatedLead?.id) {
      const submissionId = String(updatedLead.submission_id || "").trim() || buildSubmissionId(callCenterName);
      const leadName = `${payload.firstName} ${payload.lastName}`.trim() || "Unnamed Lead";
      await insertDailyDealFlowEntry(supabase, {
        submissionId,
        leadVendor: callCenterName,
        leadName,
        payload,
        callCenterId: userProfile?.call_center_id || null,
      });
      void notifySlackTransferPortalLead(supabase, {
        leadId: updatedLead.id,
        submissionId,
        leadUniqueId,
        payload,
        callCenterName,
        callCenterId: userProfile?.call_center_id || null,
      });
      try {
        await postFeCreateLeadAtFixedUrl(
          supabase,
          buildFeCreateLeadBodyFromIntakePayload(payload, {
            submissionId,
            leadVendor: callCenterName,
          }),
          "[CallCenterLeadIntake:draft-submit]",
        );
      } catch (feErr) {
        feCreateLeadDraftSubmitSyncError = feErr instanceof Error ? feErr.message : String(feErr);
        console.warn("[CallCenterLeadIntake] fe-create-lead failed after draft submit", feErr);
      }
    }

    setToast({
      message: feCreateLeadDraftSubmitSyncError
        ? `Lead updated. fe-create-lead sync failed: ${feCreateLeadDraftSubmitSyncError}`
        : "Lead updated successfully",
      type: feCreateLeadDraftSubmitSyncError ? "error" : "success",
    });
    setEditingLead(null);
    await refreshLeads();
  };

  const handleUpdateDraftLead = async (payload: TransferLeadFormData) => {
    if (!editingLead?.rowId) return;
    // Only call center agents (not admins) can update their own drafts
    const canResumeDraftAsCallCenter = Boolean(isCallCenterAgentOnly && editingLead.formData.isDraft);
    if (!canEditTransferLeads && !canResumeDraftAsCallCenter) {
      setToast({ message: "You do not have permission to edit transfer leads.", type: "error" });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setToast({ message: "Authentication required", type: "error" });
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("call_center_id")
      .eq("id", session.user.id)
      .maybeSingle();

    // Build the query with ownership check for call center agents
    let query = supabase
      .from("leads")
      .update({
        lead_unique_id: normalizeLeadUniqueId(payload.leadUniqueId) || buildLeadUniqueId(payload),
        lead_value: Number(payload.leadValue || 0),
        lead_source: FIXED_BPO_LEAD_SOURCE,
        submission_date: payload.submissionDate || null,
        first_name: payload.firstName || null,
        last_name: payload.lastName || null,
        street1: payload.street1 || null,
        street2: payload.street2 || null,
        city: payload.city || null,
        state: payload.state || null,
        zip_code: payload.zipCode || null,
        phone: payload.phone || null,
        sms_access: payload.smsAccess,
        email_access: payload.emailAccess,
        language: payload.language || null,
        birth_state: payload.birthState || null,
        date_of_birth: payload.dateOfBirth || null,
        age: payload.age || null,
        social: payload.social || null,
        driver_license_number: payload.driverLicenseNumber || null,
        existing_coverage_last_2_years: payload.existingCoverageLast2Years || null,
        existing_coverage_details: payload.existingCoverageDetails || null,
        previous_applications_2_years: payload.previousApplications2Years || null,
        height: payload.height || null,
        weight: payload.weight || null,
        doctor_name: payload.doctorName || null,
        tobacco_use: payload.tobaccoUse || null,
        health_conditions: payload.healthConditions || null,
        medications: payload.medications || null,
        monthly_premium: payload.monthlyPremium || null,
        coverage_amount: payload.coverageAmount || null,
        carrier: payload.carrier || null,
        product_type: payload.productType || null,
        draft_date: payload.draftDate || null,
        beneficiary_information: payload.beneficiaryInformation || null,
        bank_account_type: payload.bankAccountType || null,
        institution_name: payload.institutionName || null,
        routing_number: payload.routingNumber || null,
        account_number: payload.accountNumber || null,
        future_draft_date: payload.futureDraftDate || null,
        additional_information: payload.additionalInformation || null,
        stage: payload.stage || "Transfer API",
        pipeline_id: defaultTransferPipelineId,
        stage_id: defaultTransferStageId,
        is_draft: true,
        call_center_id: userProfile?.call_center_id || null,
      })
      .eq("id", editingLead.rowId);

    // Add ownership filter for call center agents (not admins) to ensure they can only update their own drafts
    if (isCallCenterAgentOnly && !canEditTransferLeads && session?.user?.id) {
      query = query.eq("submitted_by", session.user.id);
    }

    const { error } = await query;

    if (error) {
      setToast({ message: error.message || "Failed to save draft", type: "error" });
      return;
    }

    setToast({ message: "Draft updated", type: "success" });
    setEditingLead(null);
    await refreshLeads();
  };

  const handleDeleteLead = async (leadRowId: string, leadName?: string) => {
    setPendingDeleteLead({ rowId: leadRowId, name: (leadName || "this lead").trim() });
  };

  const confirmDeleteLead = async () => {
    if (!canEditTransferLeads) {
      setToast({ message: "You do not have permission to delete transfer leads.", type: "error" });
      setPendingDeleteLead(null);
      return;
    }
    if (!pendingDeleteLead || deletingLead) return;
    setDeletingLead(true);
    const { error, count } = await supabase
      .from("leads")
      .delete({ count: "exact" })
      .eq("id", pendingDeleteLead.rowId);
    if (error) {
      setToast({ message: error.message || "Failed to delete lead", type: "error" });
      setDeletingLead(false);
      return;
    }
    if (!count || count < 1) {
      setToast({ message: "Lead could not be deleted (permission denied or already removed).", type: "error" });
      setDeletingLead(false);
      return;
    }

    setPendingDeleteLead(null);
    setDeletingLead(false);
    setToast({ message: "Lead deleted successfully", type: "success" });
    setPage(1);
    await refreshLeads();
  };

  if (showCreateLead) {
    return (
      <>
        <TransferLeadApplicationForm
          onBack={() => setShowCreateLead(false)}
          onSubmit={handleCreateLead}
          onSaveDraft={handleCreateDraftLead}
          onInstantDuplicateCheck={(payload) => void promptDuplicateIfAny(payload)}
          centerName={callCenterName}
        />
        {showDuplicateDialog && duplicateLeadMatch && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ width: "100%", maxWidth: 560, backgroundColor: "#fff", borderRadius: 12, border: `1px solid ${T.border}`, padding: 22, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Duplicate lead found</h3>
              <p style={{ marginTop: 10, marginBottom: 8, fontSize: 14, color: T.textMid, lineHeight: 1.5 }}>
                {duplicateRuleMessage || `We found an existing lead with the same ${duplicateLeadMatch.match_type === "ssn" ? "SSN" : "phone number"}.`}
              </p>
              {duplicateLeadMatch.match_type === "ssn" && (
                <p style={{ marginTop: 0, marginBottom: 14, fontSize: 12, color: T.textMuted, lineHeight: 1.45 }}>
                  Stage rules (SSN duplicate rules) control whether a <strong>second</strong> lead can be created. You can still overwrite the existing lead with the form you entered.
                </p>
              )}
              <div style={{ backgroundColor: T.rowBg, border: `1px solid ${T.borderLight}`, borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>
                  {(duplicateLeadMatch.first_name || "")} {(duplicateLeadMatch.last_name || "")}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
                  Lead ID: {duplicateLeadMatch.lead_unique_id || duplicateLeadMatch.id}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>
                  Phone: {duplicateLeadMatch.phone || "Unknown"}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>
                  SSN: {duplicateLeadMatch.social || "Unknown"}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>
                  Stage: {duplicateLeadMatch.stage || "Unknown"}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>
                  Match Type: {duplicateLeadMatch.match_type === "ssn" ? "SSN" : "Phone"}
                </div>
                {duplicateLeadMatch.created_at && (
                  <div style={{ fontSize: 12, color: T.textMuted }}>
                    Created: {new Date(duplicateLeadMatch.created_at).toLocaleString()}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    setShowDuplicateDialog(false);
                    setPendingCreatePayload(null);
                    setDuplicateLeadMatch(null);
                    setDuplicateRuleMessage("");
                    setDuplicateIsAddable(true);
                  }}
                  style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}
                >
                  Cancel
                </button>
                {canOverwriteDuplicateMatch(duplicateLeadMatch) && (
                  <button
                    type="button"
                    onClick={() => void handleEditExistingDuplicateLead()}
                    style={{
                      background: duplicateIsAddable ? "#fff" : T.blue,
                      border: duplicateIsAddable ? `1px solid ${T.blue}` : "none",
                      color: duplicateIsAddable ? T.blue : "#fff",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Overwrite existing lead
                  </button>
                )}
                {duplicateIsAddable ? (
                  <button
                    type="button"
                    onClick={() => void handleCreateDuplicateLead()}
                    style={{ background: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}
                  >
                    Create Duplicate
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    style={{ background: "#c8d4bb", color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "not-allowed" }}
                    title="A second lead is not allowed for this stage (see SSN duplicate stage rules)."
                  >
                    Duplicate Not Allowed
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  if (editingLead) {
    return (
      <>
        <TransferLeadApplicationForm
          onBack={() => setEditingLead(null)}
          onSubmit={handleUpdateLead}
          onSaveDraft={handleUpdateDraftLead}
          initialData={editingLead.formData}
          submitButtonLabel="Update Lead"
          centerName={callCenterName}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  if (viewingLead) {
    // Only users with edit permission OR call center agents (not admins) can edit
    // Call center admins are explicitly blocked from editing
    const isCallCenterAdmin = currentRole === "call_center_admin";
    const canEditAsCallCenterAgent = isCallCenterAgentOnly; // Only agents, not admins
    const effectiveCanEdit = (canEditTransferLeads || canEditLeadPipeline) && !isCallCenterAdmin || canEditAsCallCenterAgent;
    return (
      <>
        <LeadViewComponent
          leadId={viewingLead.id}
          leadRowUuid={viewingLead.rowUuid}
          leadName={viewingLead.name}
          canEditLead={effectiveCanEdit}
          onBack={() => setViewingLead(null)}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  return (
    <div onClick={() => setActiveMenu(null)}>
      {/* Stats Row — 5 compact KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          [
            { label: "TOTAL LEADS", value: filtered.length.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              ) },
            { label: "TOTAL PREMIUM", value: `$${totalPremium.toLocaleString()}`, color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              ) },
            { label: "AVG PREMIUM", value: `$${avgPremium.toFixed(0)}`, color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h0M2 9.5h20"/></svg>
              ) },
            { label: "ACTIVE PIPELINES", value: uniquePipelines.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              ) },
            { label: "DRAFT LEADS", value: draftCount.toString(), color: "#233217", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
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

      {/* Filter toolbar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 14 }}>
        {/* Top Bar */}
        <div
          style={{
            width: "100%",
            background: T.cardBg,
            border: `1px solid ${T.border}`,
            borderBottom:
              filterPanelExpanded || transferLeadsHasActiveFilters ? "none" : `1px solid ${T.border}`,
            borderRadius:
              filterPanelExpanded || transferLeadsHasActiveFilters ? "16px 16px 0 0" : 16,
            padding: "14px 20px",
            boxShadow:
              filterPanelExpanded || transferLeadsHasActiveFilters ? "none" : T.shadowSm,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          {/* Left: Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}>
              <Search
                size={16}
                style={{ position: "absolute", left: 12, pointerEvents: "none", zIndex: 1, color: T.textMuted }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search leads..."
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

          {/* Right: View switch + filters + add button */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: 4,
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                background: T.pageBg,
                gap: 4,
              }}
            >
              {([
                { id: "table", label: "Table" },
                { id: "kanban", label: "Kanban" },
              ] as const).map((option) => {
                const active = viewMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setViewMode(option.id)}
                    style={{
                      height: 34,
                      padding: "0 14px",
                      borderRadius: 10,
                      border: "none",
                      background: active ? "#233217" : "transparent",
                      color: active ? "#fff" : T.textMuted,
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: T.font,
                      cursor: "pointer",
                      boxShadow: active ? "0 2px 8px rgba(35, 50, 23, 0.2)" : "none",
                      transition: "all 0.15s ease-in-out",
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

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
                border: filterPanelExpanded
                  ? `1.5px solid #233217`
                  : `1px solid ${T.border}`,
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
              {transferLeadDetailedFilterCount > 0 && (
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
                  {transferLeadDetailedFilterCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowCreateLead(true)}
              disabled={!canCreateLeads}
              title={!canCreateLeads ? "Missing permission: action.transfer_leads.create" : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 38,
                padding: "0 18px",
                borderRadius: 10,
                border: "none",
                background: canCreateLeads ? "#233217" : T.border,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: T.font,
                cursor: canCreateLeads ? "pointer" : "not-allowed",
                boxShadow: canCreateLeads ? "0 4px 12px rgba(35, 50, 23, 0.2)" : "none",
                transition: "all 0.15s ease-in-out",
              }}
            >
              <Plus size={16} />
              Add New Lead
            </button>
          </div>
        </div>

        {(filterPanelExpanded || transferLeadsHasActiveFilters) && (
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
            {filterPanelExpanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
                  <div>
                    <FieldLabel label="Single date" />
                    <div style={{ position: "relative" }}>
                      <input
                        type="date"
                        value={filterDateSingle}
                        onChange={(e) => {
                          setFilterDateSingle(e.target.value);
                          setFilterDateFrom("");
                          setFilterDateTo("");
                        }}
                        style={{
                          width: "100%",
                          height: 38,
                          borderRadius: 10,
                          border: `1px solid ${T.border}`,
                          backgroundColor: T.cardBg,
                          color: filterDateSingle ? T.textDark : T.textMuted,
                          fontSize: 13,
                          fontWeight: 500,
                          padding: "0 12px",
                          boxSizing: "border-box",
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
                  <div>
                    <FieldLabel label="Date from" />
                    <div style={{ position: "relative" }}>
                      <input
                        type="date"
                        value={filterDateFrom}
                        onChange={(e) => {
                          setFilterDateFrom(e.target.value);
                          setFilterDateSingle("");
                        }}
                        style={{
                          width: "100%",
                          height: 38,
                          borderRadius: 10,
                          border: `1px solid ${T.border}`,
                          backgroundColor: T.cardBg,
                          color: filterDateFrom ? T.textDark : T.textMuted,
                          fontSize: 13,
                          fontWeight: 500,
                          padding: "0 12px",
                          boxSizing: "border-box",
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
                  <div>
                    <FieldLabel label="Date to" />
                    <div style={{ position: "relative" }}>
                      <input
                        type="date"
                        value={filterDateTo}
                        onChange={(e) => {
                          setFilterDateTo(e.target.value);
                          setFilterDateSingle("");
                        }}
                        style={{
                          width: "100%",
                          height: 38,
                          borderRadius: 10,
                          border: `1px solid ${T.border}`,
                          backgroundColor: T.cardBg,
                          color: filterDateTo ? T.textDark : T.textMuted,
                          fontSize: 13,
                          fontWeight: 500,
                          padding: "0 12px",
                          boxSizing: "border-box",
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
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
                  <div>
                    <FieldLabel label="Centre" />
                    <StyledSelect
                      value={filterCenter}
                      onValueChange={setFilterCenter}
                      options={mapSelectOptions(centerOptions, "All centres")}
                      placeholder="All centres"
                    />
                  </div>
                  <div>
                    <FieldLabel label="Carrier" />
                    <StyledSelect
                      value={filterCarrier}
                      onValueChange={setFilterCarrier}
                      options={mapSelectOptions(carrierOptions, "All carriers")}
                      placeholder="All carriers"
                    />
                  </div>
                  <div>
                    <FieldLabel label="State" />
                    <StyledSelect
                      value={filterState}
                      onValueChange={setFilterState}
                      options={mapSelectOptions(stateOptions, "All states")}
                      placeholder="All states"
                    />
                  </div>
                  <div>
                    <FieldLabel label="Product type" />
                    <StyledSelect
                      value={filterProductType}
                      onValueChange={setFilterProductType}
                      options={mapSelectOptions(productTypeOptions, "All types")}
                      placeholder="All types"
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
                  <div>
                    <FieldLabel label="Created by" />
                    <StyledSelect
                      value={filterCreatedBy}
                      onValueChange={setFilterCreatedBy}
                      options={mapSelectOptions(createdByOptions, "All users")}
                      placeholder="All users"
                    />
                  </div>
                  <div>
                    <FieldLabel label="Draft status" />
                    <StyledSelect
                      value={filterDraft}
                      onValueChange={(v) => setFilterDraft(v as "All" | "draft" | "live")}
                      options={[
                        { value: "All", label: "All records" },
                        { value: "live", label: "Submitted only" },
                        { value: "draft", label: "Drafts only" },
                      ]}
                      placeholder="All records"
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <FieldLabel label="Min premium ($)" />
                      <Input
                        value={filterMinPremium}
                        onChange={(e) => setFilterMinPremium(e.target.value)}
                        placeholder="Any"
                        inputMode="decimal"
                        style={{ height: 38, borderRadius: 10 }}
                      />
                    </div>
                    <div>
                      <FieldLabel label="Max premium ($)" />
                      <Input
                        value={filterMaxPremium}
                        onChange={(e) => setFilterMaxPremium(e.target.value)}
                        placeholder="Any"
                        inputMode="decimal"
                        style={{ height: 38, borderRadius: 10 }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {transferLeadsHasActiveFilters && (
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between", 
                gap: 12, 
                flexWrap: "wrap",
                paddingTop: filterPanelExpanded ? 16 : 0,
                borderTop: filterPanelExpanded ? `1px solid ${T.border}` : "none",
              }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Active:
            </span>
            {filterDateSingle !== "" && <FilterChip label={`Date: ${filterDateSingle}`} onClear={() => setFilterDateSingle("")} />}
            {filterDateFrom !== "" && <FilterChip label={`From: ${filterDateFrom}`} onClear={() => setFilterDateFrom("")} />}
            {filterDateTo !== "" && <FilterChip label={`To: ${filterDateTo}`} onClear={() => setFilterDateTo("")} />}
            {filterCenter !== "All" && <FilterChip label={`Centre: ${filterCenter}`} onClear={() => setFilterCenter("All")} />}
            {filterCarrier !== "All" && <FilterChip label={`Carrier: ${filterCarrier}`} onClear={() => setFilterCarrier("All")} />}
            {filterState !== "All" && <FilterChip label={`State: ${filterState}`} onClear={() => setFilterState("All")} />}
            {filterCreatedBy !== "All" && <FilterChip label={`Created by: ${filterCreatedBy}`} onClear={() => setFilterCreatedBy("All")} />}
            {filterProductType !== "All" && <FilterChip label={`Type: ${filterProductType}`} onClear={() => setFilterProductType("All")} />}
            {filterDraft !== "All" && (
              <FilterChip
                label={filterDraft === "draft" ? "Drafts only" : "Submitted only"}
                onClear={() => setFilterDraft("All")}
              />
            )}
            {filterMinPremium.trim() !== "" && !Number.isNaN(Number(filterMinPremium)) && (
              <FilterChip label={`Min $: ${filterMinPremium}`} onClear={() => setFilterMinPremium("")} />
            )}
            {filterMaxPremium.trim() !== "" && !Number.isNaN(Number(filterMaxPremium)) && (
              <FilterChip label={`Max $: ${filterMaxPremium}`} onClear={() => setFilterMaxPremium("")} />
            )}
                </div>
                
                <button
                  type="button"
                  onClick={clearTransferLeadFilters}
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
        )}
      </div>

{viewMode === "table" ? (
        isLoading ? (
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
            <LoadingSpinner size={48} label="Loading leads..." />
          </div>
        ) : (
        <DataGrid
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search leads by name, phone, source, or ID..."
          noHeader
          style={{ borderRadius: 16, border: `1px solid ${T.border}`, overflow: "hidden"}}
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
                Showing {((page - 1) * itemsPerPage) + 1} - {Math.min(page * itemsPerPage, filtered.length)} of {filtered.length} leads
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={() => setPage(page -1)}
                  disabled={page === 1}
                  style={{
                    backgroundColor: "transparent",
                    color: page === 1 ? T.textMuted : "#233217",
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: page === 1 ? "not-allowed" : "pointer",
                    fontFamily: T.font,
                    opacity: page === 1 ? 0.5 : 1,
                    transition: "all 0.15s ease-in-out",
                  }}
                  onMouseEnter={(e) => {
                    if (page !==1) {
                      e.currentTarget.style.backgroundColor = "#233217";
                      e.currentTarget.style.color = "#fff";
                      e.currentTarget.style.borderColor = "#233217";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = page === 1 ? T.textMuted : "#233217";
                    e.currentTarget.style.borderColor = T.border;
                  }}
                >
                  Previous
                </button>
                <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500, padding: "0 8px" }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages || totalPages === 0}
                  style={{
                    backgroundColor: "transparent",
                    color: (page === totalPages || totalPages === 0) ? T.textMuted : "#233217",
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: (page === totalPages || totalPages === 0) ? "not-allowed" : "pointer",
                    fontFamily: T.font,
                    opacity: (page === totalPages || totalPages === 0) ? 0.5 : 1,
                    transition: "all 0.15s ease-in-out",
                  }}
                  onMouseEnter={(e) => {
                    if (page !== totalPages && totalPages !== 0) {
                      e.currentTarget.style.backgroundColor = "#233217";
                      e.currentTarget.style.color = "#fff";
                      e.currentTarget.style.borderColor = "#233217";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = (page === totalPages || totalPages === 0) ? T.textMuted : "#233217";
                    e.currentTarget.style.borderColor = T.border;
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          }
        >
          <>
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
                      { label: "Lead ID", align: "left" as const },
                      { label: "Customer Name", align: "left" as const },
                      { label: "Customer Phone", align: "left" as const },
                      { label: "Carrier", align: "left" as const },
                      { label: "State", align: "left" as const },
                      { label: "Premium", align: "left" as const },
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
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "60px 20px", textAlign: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                          <div style={{
                            width: 40,
                            height: 40,
                            border: `4px solid ${T.border}`,
                            borderTopColor: "#233217",
                            borderRadius: "50%",
                            animation: "spin 0.8s linear infinite",
                          }} />
                          <style>{`
                            @keyframes spin {
                              to { transform: rotate(360deg); }
                            }
                          `}</style>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#233217" }}>Loading leads...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "60px 20px", textAlign: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                          <Search size={40} color={T.textMuted} style={{ opacity: 0.5 }} />
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: T.textDark }}>No leads found</h3>
                          <p style={{ margin: 0, fontSize: 14, color: T.textMuted }}>Try changing your search or filter selections.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginated.map((lead) => {
                      return (
                        <TableRow 
                          key={lead.id}
                          style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                          className="hover:bg-muted/30 transition-all duration-150"
                        >
                          <TableCell style={{ padding: "14px 20px" }}>
                            {canViewTransferClaimReclaimVisit ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/dashboard/${routeRole}/transfer-leads/${lead.rowId}`);
                                }}
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: "#233217",
                                  textDecoration: "underline",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                  fontFamily: T.font,
                                }}
                              >
                                {lead.id}
                              </button>
                            ) : (
                              <span style={{ fontSize: 13, fontWeight: 700, color: T.textMuted }}>
                                {lead.id}
                              </span>
                            )}
                          </TableCell>
                          <TableCell style={{ padding: "14px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 500, color: T.textDark }}>{lead.name}</span>
                              {lead.isDraft ? (
                                <span
                                  style={{
                                    backgroundColor: "#FEF3C7",
                                    color: "#92400E",
                                    border: "1px solid #FCD34D",
                                    borderRadius: 999,
                                    padding: "2px 8px",
                                    fontSize: 10,
                                    fontWeight: 600,
                                    letterSpacing: "0.2px",
                                  }}
                                >
                                  Draft
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell style={{ padding: "14px 20px" }}>
                            <span style={{ fontSize: 14, color: T.textDark, fontWeight: 400 }}>{lead.phone}</span>
                          </TableCell>
                          <TableCell style={{ padding: "14px 20px" }}>
                            <span style={{ fontSize: 14, color: T.textDark, fontWeight: 400 }}>{lead.carrier}</span>
                          </TableCell>
                          <TableCell style={{ padding: "14px 20px" }}>
                            <span style={{ fontSize: 14, color: T.textDark, fontWeight: 400 }}>{lead.state}</span>
                          </TableCell>
                          <TableCell style={{ padding: "14px 20px" }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#233217" }}>
                              ${lead.premium.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell style={{ padding: "12px 16px", textAlign: "center" }}>
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap" }}
                          >
                            {!isCallCenterTransferRole && (
                              <button
                                className="lead-action-btn"
                                type="button"
                                onClick={() => {
                                  if (lead.isDraft) {
                                    void openLeadFromGrid(lead);
                                    return;
                                  }
                                  router.push(`/dashboard/${routeRole}/transfer-leads/${lead.rowId}`);
                                }}
                                style={{
                                  border: `1px solid ${T.border}`,
                                  borderRadius: 10,
                                  background: T.cardBg,
                                  color: "#233217",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  padding: "6px 14px",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease-in-out",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = "#233217";
                                  e.currentTarget.style.color = "#fff";
                                  e.currentTarget.style.borderColor = "#233217";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = T.cardBg;
                                  e.currentTarget.style.color = "#233217";
                                  e.currentTarget.style.borderColor = T.border;
                                }}
                              >
                                View Lead
                              </button>
                            )}
                            {canViewTransferClaimReclaimVisit && (
                              <>
                                <button
                                  className="lead-action-btn"
                                  type="button"
                                  onClick={() => void openClaimModalForLead(lead)}
                                  style={{
                                    border: `1px solid ${T.border}`,
                                    borderRadius: 10,
                                    background: T.cardBg,
                                    color: "#233217",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    padding: "6px 14px",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease-in-out",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "#233217";
                                    e.currentTarget.style.color = "#fff";
                                    e.currentTarget.style.borderColor = "#233217";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = T.cardBg;
                                    e.currentTarget.style.color = "#233217";
                                    e.currentTarget.style.borderColor = T.border;
                                  }}
                                >
                                  Claim Call
                                </button>
                                <button
                                  className="lead-action-btn"
                                  type="button"
                                  onClick={() => void openRetentionModalForLead(lead)}
                                  style={{
                                    border: `1px solid ${T.border}`,
                                    borderRadius: 10,
                                    background: T.cardBg,
                                    color: "#233217",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    padding: "6px 14px",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease-in-out",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "#233217";
                                    e.currentTarget.style.color = "#fff";
                                    e.currentTarget.style.borderColor = "#233217";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = T.cardBg;
                                    e.currentTarget.style.color = "#233217";
                                    e.currentTarget.style.borderColor = T.border;
                                  }}
                                >
                                  Claim Retention
                                </button>
                              </>
                            )}
                            <ActionMenu
                              id={lead.id}
                              activeId={activeMenu}
                              onToggle={setActiveMenu}
                              items={
                                canEditTransferLeads
                                  ? [
                                      { label: "View Details", onClick: () => void openLeadFromGrid(lead) },
                                      { label: "Edit Lead", onClick: () => void handleEditLead(lead.rowId) },
                                      { label: "Delete", danger: true, onClick: () => void handleDeleteLead(lead.rowId, lead.name) },
                                    ]
                                  : isCallCenterAgentOnly && lead.isDraft
                                    ? [
                                        { label: "View Details", onClick: () => void openLeadFromGrid(lead) },
                                        { label: "Update Lead", onClick: () => void openLeadInForm(lead.rowId) },
                                      ]
                                    : [{ label: "View Details", onClick: () => void openLeadFromGrid(lead) }]
                              }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }))}
                </TableBody>
              </ShadcnTable>
            </div>
          </>
        </DataGrid>
      )
      ) : (
        renderTransferKanbanBoard({
          leads: filtered,
          collapsedColumns,
          toggleColumnCollapse,
          openLeadFromGrid,
          openLeadInForm,
          kanbanPage,
          setKanbanPage,
        })
      )}

      <div style={{ height: 8 }} />

      {pendingDeleteLead && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.42)",
            zIndex: 3600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              backgroundColor: T.cardBg,
              borderRadius: 12,
              border: `1.5px solid ${T.border}`,
              boxShadow: "0 18px 45px rgba(0,0,0,0.24)",
              padding: 20,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.textDark }}>Delete Lead</h3>
            <p style={{ margin: "10px 0 0", color: T.textMid, fontSize: 14, lineHeight: 1.5 }}>
              Delete <strong>{pendingDeleteLead.name}</strong>? This action cannot be undone.
            </p>
            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                disabled={deletingLead}
                onClick={() => setPendingDeleteLead(null)}
                style={{
                  border: `1px solid ${T.border}`,
                  background: T.cardBg,
                  color: T.textMid,
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontWeight: 700,
                  cursor: deletingLead ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingLead}
                onClick={() => void confirmDeleteLead()}
                style={{
                  border: "none",
                  background: T.danger,
                  color: "#fff",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontWeight: 700,
                  cursor: deletingLead ? "not-allowed" : "pointer",
                  opacity: deletingLead ? 0.7 : 1,
                }}
              >
                {deletingLead ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <TransferLeadClaimModal
        open={claimModalOpen}
        loading={claimModalLoading}
        leadName={claimLeadContext?.leadName || ""}
        agents={claimAgents}
        selection={claimSelection}
        onChange={setClaimSelection}
        onClose={() => setClaimModalOpen(false)}
        onSubmit={() => {
          void handleClaimAndOpenLead();
        }}
        retentionOnly={isRetentionOnlyMode}
      />
      <style jsx>{`
        .lead-action-btn {
          transition: all 0.15s ease-in-out;
        }
        .lead-action-btn:hover {
          background: #233217;
          border-color: #233217;
          color: #fff;
        }
        .lead-action-btn:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}
