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
  leadVendor: string;
};

const REQUEST_TYPE_OPTIONS = [
  { value: "new_application", label: "New Application" },
  { value: "updating_billing", label: "Updating Billing/Draft Date" },
  { value: "carrier_requirements", label: "Fulfilling Pending Carrier Requirement" },
];

type LeadUpdateMapper = {
  column: string;
  toDbValue: (value: TransferLeadFormData[keyof TransferLeadFormData]) => unknown;
};

type CallbackNotificationResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

function getRequestTypeLabel(value: string) {
  return REQUEST_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

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

function nullableText(value: unknown) {
  const clean = String(value ?? "").trim();
  return clean || null;
}

function optionalNumber(value: unknown) {
  const clean = String(value ?? "").replace(/\$/g, "").replace(/,/g, "").trim();
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateAgeFromDob(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) age -= 1;
  return age >= 0 && age < 130 ? String(age) : "";
}

function getTodayInEasternYyyyMmDd() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const LEAD_UPDATE_FIELDS: Partial<Record<keyof TransferLeadFormData, LeadUpdateMapper>> = {
  leadValue: { column: "lead_value", toDbValue: optionalNumber },
  submissionDate: { column: "submission_date", toDbValue: nullableText },
  firstName: { column: "first_name", toDbValue: nullableText },
  lastName: { column: "last_name", toDbValue: nullableText },
  street1: { column: "street1", toDbValue: nullableText },
  street2: { column: "street2", toDbValue: nullableText },
  city: { column: "city", toDbValue: nullableText },
  state: { column: "state", toDbValue: nullableText },
  zipCode: { column: "zip_code", toDbValue: nullableText },
  phone: { column: "phone", toDbValue: nullableText },
  smsAccess: { column: "sms_access", toDbValue: Boolean },
  emailAccess: { column: "email_access", toDbValue: Boolean },
  language: { column: "language", toDbValue: nullableText },
  birthState: { column: "birth_state", toDbValue: nullableText },
  dateOfBirth: { column: "date_of_birth", toDbValue: nullableText },
  age: { column: "age", toDbValue: nullableText },
  social: { column: "social", toDbValue: nullableText },
  driverLicenseNumber: { column: "driver_license_number", toDbValue: nullableText },
  existingCoverageLast2Years: { column: "existing_coverage_last_2_years", toDbValue: nullableText },
  existingCoverageDetails: { column: "existing_coverage_details", toDbValue: nullableText },
  previousApplications2Years: { column: "previous_applications_2_years", toDbValue: nullableText },
  height: { column: "height", toDbValue: nullableText },
  weight: { column: "weight", toDbValue: nullableText },
  doctorName: { column: "doctor_name", toDbValue: nullableText },
  tobaccoUse: { column: "tobacco_use", toDbValue: nullableText },
  healthConditions: { column: "health_conditions", toDbValue: nullableText },
  medications: { column: "medications", toDbValue: nullableText },
  monthlyPremium: { column: "monthly_premium", toDbValue: optionalNumber },
  coverageAmount: { column: "coverage_amount", toDbValue: optionalNumber },
  carrier: { column: "carrier", toDbValue: nullableText },
  productType: { column: "product_type", toDbValue: nullableText },
  includeBackupQuote: { column: "has_backup_quote", toDbValue: Boolean },
  backupCarrier: { column: "backup_carrier", toDbValue: nullableText },
  backupProductType: { column: "backup_product_type", toDbValue: nullableText },
  backupMonthlyPremium: { column: "backup_monthly_premium", toDbValue: nullableText },
  backupCoverageAmount: { column: "backup_coverage_amount", toDbValue: nullableText },
  draftDate: { column: "draft_date", toDbValue: nullableText },
  beneficiaryInformation: { column: "beneficiary_information", toDbValue: nullableText },
  bankAccountType: { column: "bank_account_type", toDbValue: nullableText },
  institutionName: { column: "institution_name", toDbValue: nullableText },
  routingNumber: { column: "routing_number", toDbValue: nullableText },
  accountNumber: { column: "account_number", toDbValue: nullableText },
  futureDraftDate: { column: "future_draft_date", toDbValue: nullableText },
  additionalInformation: { column: "additional_information", toDbValue: nullableText },
};

function normalizeForCompare(value: unknown) {
  return value === undefined ? null : value;
}

function buildLeadUpdateDiff(original: TransferLeadFormData, current: TransferLeadFormData) {
  const update: Record<string, unknown> = {};
  for (const [fieldKey, mapper] of Object.entries(LEAD_UPDATE_FIELDS) as Array<[keyof TransferLeadFormData, LeadUpdateMapper]>) {
    const previous = normalizeForCompare(mapper.toDbValue(original[fieldKey]));
    const next = normalizeForCompare(mapper.toDbValue(current[fieldKey]));
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      update[mapper.column] = next;
    }
  }
  return update;
}

function buildLeadFormData(data: Record<string, unknown>): TransferLeadFormData {
  const dateOfBirth = String(data.date_of_birth ?? "");
  const age = String(data.age ?? "") || calculateAgeFromDob(dateOfBirth);

  return {
    leadUniqueId: String(data.lead_unique_id ?? ""),
    leadValue: data.lead_value != null ? String(data.lead_value) : "",
    leadSource: String(data.lead_source ?? "BPO Transfer Lead Source"),
    submissionDate: String(data.submission_date ?? "") || getTodayInEasternYyyyMmDd(),
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
    dateOfBirth,
    age,
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
  const [initialFormData, setInitialFormData] = useState<TransferLeadFormData | null>(null);
  const [editedFormData, setEditedFormData] = useState<TransferLeadFormData | null>(null);
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

      const callCenter = data.call_centers as { name?: string | null; did?: string | null } | null;
      const leadVendor = String(callCenter?.name ?? data.lead_source ?? "").trim();
      const header: LeadHeaderData = {
        rowId: String(data.id),
        name: `${String(data.first_name ?? "").trim()} ${String(data.last_name ?? "").trim()}`.trim() || "Unnamed Lead",
        phone: String(data.phone ?? ""),
        state: String(data.state ?? "—"),
        submissionId: data.submission_id ? String(data.submission_id) : null,
        leadVendor,
      };

      const nextFormData = buildLeadFormData(data as Record<string, unknown>);

      setLeadHeader(header);
      setInitialFormData(nextFormData);
      setEditedFormData(nextFormData);
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
    if (!leadHeader || !initialFormData || !editedFormData) {
      setToast({ message: "Lead data is still loading.", type: "error" });
      return;
    }
    if (!requestType.trim()) {
      setToast({ message: "Please select a request type.", type: "error" });
      return;
    }
    if (!notes.trim()) {
      setToast({ message: "Please add notes for this request.", type: "error" });
      return;
    }
    if (!leadHeader.submissionId?.trim()) {
      setToast({ message: "This lead is missing a submission ID.", type: "error" });
      return;
    }
    if (!leadHeader.leadVendor.trim()) {
      setToast({ message: "This lead is missing a lead vendor.", type: "error" });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setToast({ message: "You must be signed in to submit a request.", type: "error" });
      return;
    }

    const updatePayload = buildLeadUpdateDiff(initialFormData, editedFormData);

    setSubmitting(true);
    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase.from("leads").update(updatePayload).eq("id", leadHeader.rowId);
      if (updateError) {
        setSubmitting(false);
        setToast({ message: updateError.message || "Failed to update lead.", type: "error" });
        return;
      }

      setInitialFormData(editedFormData);
      setLeadHeader({
        ...leadHeader,
        name: `${editedFormData.firstName.trim()} ${editedFormData.lastName.trim()}`.trim() || leadHeader.name,
        phone: editedFormData.phone,
        state: editedFormData.state || "—",
      });
    }

    const customerName = `${editedFormData.firstName.trim()} ${editedFormData.lastName.trim()}`.trim() || leadHeader.name;
    const phoneNumber = editedFormData.phone.trim() || leadHeader.phone || null;
    const { error: callbackInsertError } = await supabase.from("callback_requests").insert({
      submission_id: leadHeader.submissionId,
      lead_vendor: leadHeader.leadVendor,
      request_type: requestType,
      notes: notes.trim(),
      customer_name: customerName || null,
      phone_number: phoneNumber,
      status: "pending",
      requested_by: session.user.id,
      requested_at: new Date().toISOString(),
    });

    if (callbackInsertError) {
      setSubmitting(false);
      setToast({ message: callbackInsertError.message || "Lead saved, but callback request creation failed.", type: "error" });
      return;
    }

    try {
      const { data: notificationData, error: notificationError } =
        await supabase.functions.invoke<CallbackNotificationResponse>("callback-notification", {
          body: {
            submission_id: leadHeader.submissionId,
            lead_id: leadHeader.rowId,
            customer_name: customerName || "N/A",
            phone_number: phoneNumber || "N/A",
            lead_vendor: leadHeader.leadVendor,
            request_type: getRequestTypeLabel(requestType),
            notes: notes.trim(),
            carrier: editedFormData.carrier.trim() || "N/A",
            state: editedFormData.state.trim() || "N/A",
          },
        });

      if (notificationError || notificationData?.success === false) {
        console.warn("[BpoClientRequestPage] callback-notification failed", notificationError ?? notificationData);
      }
    } catch (notificationError) {
      console.warn("[BpoClientRequestPage] callback-notification failed", notificationError);
    }

    setSubmitting(false);
    setNotes("");
    setRequestType("");
    setToast({ message: "Callback request submitted successfully.", type: "success" });
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
      ) : error || !leadHeader || !initialFormData ? (
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
                  onChange={setEditedFormData}
                  initialData={initialFormData}
                  submitButtonLabel="Update Lead"
                  centerName={centerName}
                  centerDid={centerDid}
                  embedded
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
