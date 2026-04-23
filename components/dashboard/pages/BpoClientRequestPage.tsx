"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FileText, Phone, ArrowLeft, ClipboardList } from "lucide-react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import TransferLeadApplicationForm, { type TransferLeadFormData } from "./TransferLeadApplicationForm";
import { TransferStyledSelect, transferFieldStyle, transferSelectLabelStyle } from "./TransferStyledSelect";
import { Toast, type ToastType } from "@/components/ui/Toast";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";

type CallHistoryRow = {
  id: string;
  status: string | null;
  callResult: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  agent: string | null;
  licensedAgent: string | null;
  retentionAgent: string | null;
  placementStatus: string | null;
};

type LeadHeaderData = {
  rowId: string;
  name: string;
  phone: string;
  state: string;
  submissionId: string | null;
};

const REQUEST_TYPE_OPTIONS = [
  { value: "New Application", label: "New Application" },
  { value: "Updating Billing/Draft Date", label: "Updating Billing/Draft Date" },
  { value: "Fulfilling Pending Carrier Requirement", label: "Fulfilling Pending Carrier Requirement" },
];

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPhoneDisplay(phone: string | null | undefined) {
  const raw = String(phone ?? "").replace(/\D/g, "");
  if (raw.length === 10) {
    return `+1 (${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
  }
  return phone || "—";
}

function buildLeadFormData(data: Record<string, unknown>): TransferLeadFormData {
  return {
    leadUniqueId: String(data.lead_unique_id ?? ""),
    leadValue: data.lead_value != null ? String(data.lead_value) : "",
    leadSource: "BPO Transfer Lead Source",
    submissionDate: String(data.submission_date ?? ""),
    firstName: String(data.first_name ?? ""),
    lastName: String(data.last_name ?? ""),
    street1: String(data.street1 ?? ""),
    street2: String(data.street2 ?? ""),
    city: String(data.city ?? ""),
    state: String(data.state ?? ""),
    zipCode: String(data.zip_code ?? ""),
    phone: String(data.phone ?? ""),
    smsAccess: Boolean(data.sms_access),
    emailAccess: Boolean(data.email_access),
    language: String(data.language ?? "English"),
    birthState: String(data.birth_state ?? ""),
    dateOfBirth: String(data.date_of_birth ?? ""),
    age: String(data.age ?? ""),
    social: String(data.social ?? ""),
    driverLicenseNumber: String(data.driver_license_number ?? ""),
    existingCoverageLast2Years: String(data.existing_coverage_last_2_years ?? ""),
    existingCoverageDetails: String(data.existing_coverage_details ?? ""),
    previousApplications2Years: String(data.previous_applications_2_years ?? ""),
    height: String(data.height ?? ""),
    weight: String(data.weight ?? ""),
    doctorName: String(data.doctor_name ?? ""),
    tobaccoUse: String(data.tobacco_use ?? ""),
    healthConditions: String(data.health_conditions ?? ""),
    medications: String(data.medications ?? ""),
    monthlyPremium: String(data.monthly_premium ?? ""),
    coverageAmount: String(data.coverage_amount ?? ""),
    carrier: String(data.carrier ?? ""),
    productType: String(data.product_type ?? ""),
    includeBackupQuote: Boolean(data.has_backup_quote) || Boolean(String(data.backup_carrier ?? "").trim()),
    backupCarrier: String(data.backup_carrier ?? ""),
    backupProductType: String(data.backup_product_type ?? ""),
    backupMonthlyPremium: String(data.backup_monthly_premium ?? ""),
    backupCoverageAmount: String(data.backup_coverage_amount ?? ""),
    draftDate: String(data.draft_date ?? ""),
    beneficiaryInformation: String(data.beneficiary_information ?? ""),
    bankAccountType: String(data.bank_account_type ?? ""),
    institutionName: String(data.institution_name ?? ""),
    routingNumber: String(data.routing_number ?? ""),
    accountNumber: String(data.account_number ?? ""),
    futureDraftDate: String(data.future_draft_date ?? ""),
    additionalInformation: String(data.additional_information ?? ""),
    pipeline: String((data.pipelines as { name?: string | null } | null)?.name ?? "Transfer Portal"),
    stage: String(data.stage ?? "Transfer API"),
    isDraft: Boolean(data.is_draft),
  };
}

export default function BpoClientRequestPage({ leadRowId }: { leadRowId: string }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const params = useParams<{ role?: string }>();
  const searchParams = useSearchParams();
  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role || "agent";
  const sourcePage = searchParams.get("page") || "bpo-kill-list-new-sale";
  const { currentRole } = useDashboardContext();

  const [loading, setLoading] = useState(true);
  const [leadHeader, setLeadHeader] = useState<LeadHeaderData | null>(null);
  const [formData, setFormData] = useState<TransferLeadFormData | null>(null);
  const [centerName, setCenterName] = useState("");
  const [centerDid, setCenterDid] = useState("");
  const [callHistory, setCallHistory] = useState<CallHistoryRow[]>([]);
  const [requestType, setRequestType] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      const { data, error: leadError } = await supabase
        .from("leads")
        .select("id, submission_id, lead_unique_id, lead_value, lead_source, submission_date, first_name, last_name, street1, street2, city, state, zip_code, phone, sms_access, email_access, language, birth_state, date_of_birth, age, social, driver_license_number, existing_coverage_last_2_years, existing_coverage_details, previous_applications_2_years, height, weight, doctor_name, tobacco_use, health_conditions, medications, monthly_premium, coverage_amount, carrier, product_type, has_backup_quote, backup_carrier, backup_product_type, backup_monthly_premium, backup_coverage_amount, draft_date, beneficiary_information, bank_account_type, institution_name, routing_number, account_number, future_draft_date, additional_information, pipeline_id, stage, is_draft, call_center_id, pipelines(name), call_centers(name, did)")
        .eq("id", leadRowId)
        .maybeSingle();

      if (cancelled) return;

      if (leadError || !data) {
        setError(leadError?.message || "Lead not found.");
        setLoading(false);
        return;
      }

      const header: LeadHeaderData = {
        rowId: String(data.id),
        name: `${String(data.first_name ?? "").trim()} ${String(data.last_name ?? "").trim()}`.trim() || "Unnamed Lead",
        phone: String(data.phone ?? ""),
        state: String(data.state ?? "—"),
        submissionId: data.submission_id ? String(data.submission_id) : null,
      };

      const callCenter = data.call_centers as { name?: string | null; did?: string | null } | null;

      setLeadHeader(header);
      setFormData(buildLeadFormData(data as Record<string, unknown>));
      setCenterName(String(callCenter?.name ?? ""));
      setCenterDid(String(callCenter?.did ?? ""));

      if (header.submissionId) {
        const { data: historyRows, error: historyError } = await supabase
          .from("daily_deal_flow")
          .select("id, status, call_result, notes, created_at, updated_at, agent, licensed_agent_account, retention_agent, placement_status")
          .eq("submission_id", header.submissionId)
          .order("updated_at", { ascending: false })
          .order("created_at", { ascending: false });

        if (!cancelled) {
          if (historyError) {
            setToast({ message: historyError.message || "Failed to load call history.", type: "error" });
          } else {
            const mapped = ((historyRows || []) as Record<string, unknown>[]).map((row) => ({
              id: String(row.id),
              status: row.status ? String(row.status) : null,
              callResult: row.call_result ? String(row.call_result) : null,
              notes: row.notes ? String(row.notes) : null,
              createdAt: row.created_at ? String(row.created_at) : null,
              updatedAt: row.updated_at ? String(row.updated_at) : null,
              agent: row.agent ? String(row.agent) : null,
              licensedAgent: row.licensed_agent_account ? String(row.licensed_agent_account) : null,
              retentionAgent: row.retention_agent ? String(row.retention_agent) : null,
              placementStatus: row.placement_status ? String(row.placement_status) : null,
            }));
            setCallHistory(mapped);
            setExpandedHistoryId(mapped[0]?.id ?? null);
          }
        }
      } else {
        setCallHistory([]);
      }

      if (!cancelled) setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [leadRowId, supabase]);

  const handleSubmitRequest = async () => {
    if (!requestType.trim()) {
      setToast({ message: "Please select a request type.", type: "error" });
      return;
    }
    if (!notes.trim()) {
      setToast({ message: "Please add notes for this request.", type: "error" });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id || !leadHeader) {
      setToast({ message: "You must be signed in to submit a request.", type: "error" });
      return;
    }

    setSubmitting(true);
    const body = [
      "[BPO Client Request]",
      `Request Type: ${requestType}`,
      leadHeader.submissionId ? `Submission ID: ${leadHeader.submissionId}` : null,
      `Lead: ${leadHeader.name}`,
      `Phone: ${leadHeader.phone || "—"}`,
      "",
      notes.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    const { error: insertError } = await supabase.from("lead_notes").insert({
      lead_id: leadHeader.rowId,
      body,
      created_by: session.user.id,
    });

    setSubmitting(false);

    if (insertError) {
      setToast({ message: insertError.message || "Failed to submit request.", type: "error" });
      return;
    }

    setNotes("");
    setRequestType("");
    setToast({ message: "Request submitted successfully.", type: "success" });
  };

  if (currentRole !== "call_center_admin" && currentRole !== "system_admin") {
    return (
      <div style={{ padding: 24, borderRadius: 14, border: "1.5px solid #fecaca", backgroundColor: "#fef2f2", maxWidth: 600, margin: "40px auto" }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 20, color: "#991b1b", fontWeight: 700 }}>Access Denied</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#7f1d1d", lineHeight: 1.6 }}>
          This page is only available to center admins and system admins.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/${routeRole}?page=${sourcePage}`)}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", color: "#233217", fontSize: 14, fontWeight: 700, width: "fit-content" }}
        >
          <ArrowLeft size={16} />
          Back to Kill List
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: T.textDark }}>BPO Client Request</h1>
          <p style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 600, color: T.textMuted }}>
            Review the application, inspect call history, and submit a request for agent follow-up.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ borderRadius: 16, border: `1px solid ${T.border}`, backgroundColor: T.cardBg, padding: "80px 40px", textAlign: "center", fontSize: 14, fontWeight: 600, color: T.textMuted }}>
          Loading request workspace...
        </div>
      ) : error || !leadHeader || !formData ? (
        <div style={{ borderRadius: 16, border: "1px solid #fecaca", backgroundColor: "#fef2f2", padding: 24, fontSize: 14, fontWeight: 600, color: "#991b1b" }}>
          {error || "Lead not found."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(340px, 0.9fr)", gap: 24, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            <div style={{ borderRadius: 18, border: `1px solid ${T.border}`, backgroundColor: "#fff", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
              <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.borderLight}`, background: "#f8fbf6", display: "flex", alignItems: "center", gap: 12 }}>
                <FileText size={22} color="#233217" />
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.textDark }}>Application Form</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: T.textMuted }}>
                    Prefilled from the existing transfer application.
                  </p>
                </div>
              </div>
              <div style={{ padding: 24, maxHeight: "68vh", overflow: "auto", background: T.pageBg }}>
                <TransferLeadApplicationForm
                  onBack={() => {}}
                  onSubmit={() => {}}
                  initialData={formData}
                  centerName={centerName}
                  centerDid={centerDid}
                  embedded
                  readOnly
                  hideHeader
                  hideActions
                />
              </div>
            </div>

            <div style={{ borderRadius: 18, border: `1px solid ${T.border}`, backgroundColor: "#fff", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
              <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Phone size={22} color="#233217" />
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.textDark }}>Call History</h2>
                    <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: T.textMuted }}>
                      {callHistory.length} {callHistory.length === 1 ? "entry" : "entries"} found
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                {callHistory.length === 0 ? (
                  <div style={{ borderRadius: 12, border: `1px dashed ${T.border}`, padding: 18, textAlign: "center", fontSize: 14, fontWeight: 600, color: T.textMuted }}>
                    No call history found for this submission.
                  </div>
                ) : (
                  callHistory.map((entry, index) => {
                    const expanded = expandedHistoryId === entry.id;
                    return (
                      <div key={entry.id} style={{ borderRadius: 14, border: `1px solid ${T.border}`, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                        <button
                          type="button"
                          onClick={() => setExpandedHistoryId((current) => (current === entry.id ? null : entry.id))}
                          style={{ width: "100%", border: "none", background: "#fff", padding: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, cursor: "pointer", textAlign: "left" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ fontSize: 26, fontWeight: 800, color: "#233217" }}>#{index + 1}</div>
                            <div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: T.textDark }}>{entry.status || entry.callResult || "Unknown Status"}</div>
                              <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: T.textMuted }}>{formatDateTime(entry.updatedAt || entry.createdAt)}</div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                                {entry.callResult ? (
                                  <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 12, fontWeight: 700 }}>
                                    {entry.callResult}
                                  </span>
                                ) : null}
                                <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: 12, fontWeight: 700 }}>
                                  Agent: {entry.agent || entry.licensedAgent || entry.retentionAgent || "N/A"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div style={{ color: T.textMuted, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
                          </div>
                        </button>
                        {expanded ? (
                          <div style={{ padding: "0 18px 18px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, borderTop: `1px solid ${T.borderLight}` }}>
                            <div style={{ paddingTop: 16 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", marginBottom: 6 }}>Status</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: T.textDark }}>{entry.status || "—"}</div>
                            </div>
                            <div style={{ paddingTop: 16 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", marginBottom: 6 }}>Placement</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: T.textDark }}>{entry.placementStatus || "—"}</div>
                            </div>
                            <div style={{ gridColumn: "1 / -1" }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", marginBottom: 6 }}>Notes</div>
                              <div style={{ fontSize: 14, lineHeight: 1.6, color: T.textDark, whiteSpace: "pre-wrap" }}>{entry.notes || "No notes recorded."}</div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div style={{ position: "sticky", top: 88 }}>
            <div style={{ borderRadius: 18, border: `1px solid ${T.border}`, backgroundColor: "#fff", padding: 24, boxShadow: "0 4px 12px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ClipboardList size={22} color="#233217" />
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.textDark }}>Request Details</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: T.textMuted }}>
                    {leadHeader.name} • {formatPhoneDisplay(leadHeader.phone)} • {leadHeader.submissionId || "No submission ID"}
                  </p>
                </div>
              </div>

              <div>
                <label style={transferSelectLabelStyle}>Request Type</label>
                <TransferStyledSelect
                  value={requestType}
                  onValueChange={setRequestType}
                  options={REQUEST_TYPE_OPTIONS}
                  placeholder="Select request type..."
                />
                <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: T.textMuted }}>
                  Choose what kind of follow-up is needed for this lead.
                </p>
              </div>

              <div>
                <label style={transferSelectLabelStyle}>Notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Provide detailed notes about this request..."
                  rows={14}
                  style={{ ...transferFieldStyle, resize: "vertical", minHeight: 280 }}
                />
                <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: T.textMuted }}>
                  Include anything the agent should know before following up.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <button
                  type="button"
                  onClick={handleSubmitRequest}
                  disabled={submitting}
                  style={{
                    gridColumn: "1 / -1",
                    height: 48,
                    borderRadius: 10,
                    border: "none",
                    background: submitting ? T.border : "#111827",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/${routeRole}?page=${sourcePage}`)}
                  style={{
                    gridColumn: "1 / -1",
                    height: 44,
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    background: "#fff",
                    color: T.textDark,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
