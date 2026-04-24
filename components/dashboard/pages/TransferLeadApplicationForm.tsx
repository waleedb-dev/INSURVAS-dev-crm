"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCarrierProductDropdowns, type CarrierProductRow } from "@/lib/useCarrierProductDropdowns";
import { Toast, type ToastType } from "@/components/ui/Toast";
import { AppSelect } from "@/components/ui/app-select";
import { TransferStyledSelect as StyledSelect } from "./TransferStyledSelect";
import { resolveDuplicatePolicy, ruleForLeadStage, type DuplicateStageRule } from "@/lib/transferDuplicateResolution";
import { runDncLookup } from "@/lib/dncLookupApi";
import { runTransferCheck, TRANSFER_CHECK_CLEAR_USER_MESSAGE } from "@/lib/transferCheckApi";

export type TransferLeadFormData = {
  leadUniqueId: string;
  leadValue: string;
  leadSource: string;
  submissionDate: string;
  firstName: string;
  lastName: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  smsAccess: boolean;
  emailAccess: boolean;
  language: string;
  birthState: string;
  dateOfBirth: string;
  age: string;
  social: string;
  driverLicenseNumber: string;
  existingCoverageLast2Years: string;
  existingCoverageDetails: string;
  previousApplications2Years: string;
  height: string;
  weight: string;
  doctorName: string;
  tobaccoUse: string;
  healthConditions: string;
  medications: string;
  monthlyPremium: string;
  coverageAmount: string;
  carrier: string;
  productType: string;
  /** When true, user must complete backup carrier / product / premium / coverage. */
  includeBackupQuote: boolean;
  backupCarrier: string;
  backupProductType: string;
  backupMonthlyPremium: string;
  backupCoverageAmount: string;
  draftDate: string;
  beneficiaryInformation: string;
  bankAccountType: string;
  institutionName: string;
  routingNumber: string;
  accountNumber: string;
  futureDraftDate: string;
  additionalInformation: string;
  pipeline: string;
  stage: string;
  isDraft?: boolean;
};

type SsnCheckState = "idle" | "checking" | "blocked" | "warning" | "clear" | "error";
type DncStatus = "clear" | "dnc" | "tcpa" | "agency_dq" | "error" | "idle";
/** Result of phone Check: DNC/screening + CRM transfer-check (transfer-check skipped when TCPA). */
type PhoneScreeningGateResult = { status: DncStatus; duplicateBlocksPhone: boolean };
type SsnDuplicateRule = DuplicateStageRule;
type PhoneDuplicateMatch = {
  id: string;
  lead_unique_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  social: string | null;
  stage: string | null;
  created_at: string | null;
};
type PhoneDuplicateQueryRow = {
  id: string;
  lead_unique_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  social: string | null;
  stage: string | null;
  created_at: string | null;
};
type SsnDuplicateMatch = {
  id: string;
  lead_unique_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  social: string | null;
  stage: string | null;
  created_at: string | null;
};

type PhoneDupCheckResult = {
  match: PhoneDuplicateMatch | null;
  isAddable: boolean;
  /** Same copy as `phoneDupRuleMessage` — returned for immediate use (React state is async). */
  ruleMessage: string;
};

const usStates = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const FIXED_BPO_LEAD_SOURCE = "BPO Transfer Lead Source";

type TransferCheckApiResponse = {
  data?: Record<string, unknown>;
  warnings?: { policy?: boolean };
  warningMessage?: string;
  message?: string;
  phone?: string;
  status?: string;
  crm_phone_match?: {
    has_match?: boolean;
    is_addable?: boolean;
    rule_message?: string;
    matched_contact_name?: string;
    stages?: string[];
    lead_ids?: string[];
    scenario?: string;
  };
};

/**
 * Edge `transfer-check` returns `{ phone, message, crm_phone_match, ... }` at top level.
 * Tolerate legacy shapes that nest under `data`.
 */
function transferCheckResponsePayload(
  tc: TransferCheckApiResponse | null | undefined,
): Record<string, unknown> | undefined {
  if (!tc || typeof tc !== "object") return undefined;
  const r = tc as unknown as Record<string, unknown>;
  if (
    r.crm_phone_match !== undefined ||
    typeof r.phone === "string" ||
    typeof r.status === "string"
  ) {
    return r;
  }
  const inner = r.data;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return r;
}

type CrmMatchModalShape = {
  has_match?: boolean;
  is_addable?: boolean;
  rule_message?: string;
  error?: string;
};

/** Human-readable line from transfer-check (same as edge `message`, usually mirrors CRM rule copy). */
function transferCheckDisplayMessage(tc: TransferCheckApiResponse | null | undefined): string {
  const payload = transferCheckResponsePayload(tc);
  if (!payload) return "";
  const top = String(payload.message ?? "").trim();
  if (top) return top;
  const crm = payload.crm_phone_match as CrmMatchModalShape | undefined;
  return String(crm?.rule_message ?? "").trim();
}

/** Single transfer message for DNC / clear / DQ modals (no raw JSON). */
function TransferCheckResultPanel({ transferCheckState }: { transferCheckState: TransferCheckApiResponse | null }) {
  const msg = transferCheckDisplayMessage(transferCheckState);
  if (!msg) return null;
  return (
    <div
      style={{
        textAlign: "left",
        marginTop: 16,
        padding: 14,
        borderRadius: 12,
        border: `1px solid ${T.borderLight}`,
        backgroundColor: "#f8fafc",
      }}
    >
      <p
        style={{
          fontWeight: 800,
          fontSize: 12,
          color: T.textMuted,
          margin: "0 0 8px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}
      >
        TRANSFER CHECK
      </p>
      <p style={{ fontSize: 14, color: T.textDark, margin: 0, lineHeight: 1.55 }}>{msg}</p>
    </div>
  );
}


const REQUIRED_FORM_KEYS: Array<keyof TransferLeadFormData> = [
  "submissionDate",
  "firstName",
  "lastName",
  "street1",
  "city",
  "state",
  "zipCode",
  "phone",
  "language",
  "birthState",
  "dateOfBirth",
  "age",
  "social",
  "driverLicenseNumber",
  "existingCoverageLast2Years",
  "previousApplications2Years",
  "height",
  "weight",
  "doctorName",
  "tobaccoUse",
  "healthConditions",
  "medications",
  "monthlyPremium",
  "coverageAmount",
  "carrier",
  "productType",
  "draftDate",
  "beneficiaryInformation",
  "institutionName",
  "routingNumber",
  "accountNumber",
  "futureDraftDate",
];

/** Today's calendar date as `YYYY-MM-DD` in US Eastern (America/New_York — EST/EDT). */
function getTodayInEasternYyyyMmDd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizePhoneDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function getUsPhone10Digits(value: string): string | null {
  const digits = normalizePhoneDigits(value);
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return null;
}

function formatUsPhone(digits: string) {
  if (digits.length !== 10) return digits;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function calculateAgeFromDob(dateInput: string): string {
  const value = String(dateInput || "").trim();
  if (!value) return "";
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return "";
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";

  const today = new Date();
  let age = today.getFullYear() - year;
  const hasHadBirthdayThisYear =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!hasHadBirthdayThisYear) age -= 1;
  return age >= 0 ? String(age) : "";
}

function buildFormState(initial?: Partial<TransferLeadFormData>, centerNameForLeadSource?: string): TransferLeadFormData {
  const { leadSource: _ls, isDraft: draftFlag, ...fromInitial } = initial ?? {};
  const hasSubmission =
    fromInitial.submissionDate !== undefined && String(fromInitial.submissionDate).trim() !== "";
  return {
    leadUniqueId: "",
    leadValue: "",
    firstName: "",
    lastName: "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    zipCode: "",
    phone: "",
    smsAccess: false,
    emailAccess: false,
    language: "English",
    birthState: "",
    dateOfBirth: "",
    age: "",
    social: "",
    driverLicenseNumber: "",
    existingCoverageLast2Years: "",
    existingCoverageDetails: "",
    previousApplications2Years: "",
    height: "",
    weight: "",
    doctorName: "",
    tobaccoUse: "",
    healthConditions: "",
    medications: "",
    monthlyPremium: "",
    coverageAmount: "",
    carrier: "",
    productType: "",
    includeBackupQuote: false,
    backupCarrier: "",
    backupProductType: "",
    backupMonthlyPremium: "",
    backupCoverageAmount: "",
    draftDate: "",
    beneficiaryInformation: "",
    bankAccountType: "",
    institutionName: "",
    routingNumber: "",
    accountNumber: "",
    futureDraftDate: "",
    additionalInformation: "",
    pipeline: "Transfer Portal",
    stage: "Transfer API",
    ...fromInitial,
    submissionDate: hasSubmission ? String(fromInitial.submissionDate).trim() : getTodayInEasternYyyyMmDd(),
    leadSource: centerNameForLeadSource || FIXED_BPO_LEAD_SOURCE,
    isDraft: draftFlag ?? false,
  };
}

const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 8,
  border: `1.5px solid ${T.border}`,
  fontSize: 14,
  color: T.textDark,
  outline: "none",
  fontFamily: T.font,
  backgroundColor: "#fff",
  transition: "border-color 0.15s, box-shadow 0.15s",
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: T.textMuted,
  marginBottom: 6,
  display: "block",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
};

function toTagParts(raw: string): string[] {
  return String(raw || "")
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function mergeUniqueTags(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map((item) => item.toLowerCase()));
  const merged = [...existing];
  for (const item of incoming) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

type HoveredFieldInfo = { key: string; info: string; x: number; y: number } | null;

/** Tag + Enter chips for health conditions / medications (main form + matches underwriting behavior). */
function TransferTagListBlock({
  label,
  required = false,
  info,
  fieldKey,
  error,
  tags,
  onRemoveTag,
  draftValue,
  onDraftChange,
  onCommitDraft,
  placeholder,
  helperText,
  setHoveredFieldInfo,
  inputStyle,
}: {
  label: string;
  required?: boolean;
  info?: string;
  fieldKey: string;
  error?: string;
  tags: string[];
  onRemoveTag: (index: number) => void;
  draftValue: string;
  onDraftChange: (value: string) => void;
  onCommitDraft: () => void;
  placeholder: string;
  helperText?: string;
  setHoveredFieldInfo?: (info: HoveredFieldInfo) => void;
  inputStyle: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-field-key={fieldKey} data-info={info}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <label
          style={{
            ...labelStyle,
            marginBottom: 0,
          }}
        >
          {label}
          {required ? <span style={{ color: "#dc2626" }}> *</span> : null}
        </label>
        {info ? (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredFieldInfo?.({ key: fieldKey, info, x: rect.left, y: rect.bottom + 8 });
              }}
              onMouseLeave={() => setHoveredFieldInfo?.(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                color: "#93c5fd",
                display: "flex",
                alignItems: "center",
                marginLeft: 2,
              }}
              aria-label={`${label} field help`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          minHeight: tags.length ? undefined : 0,
        }}
      >
        {tags.map((tag, i) => (
          <span
            key={`${fieldKey}-${i}-${tag}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: 8,
              backgroundColor: "#EEF5EE",
              border: `1px solid ${T.borderLight}`,
              fontSize: 13,
              fontWeight: 600,
              color: T.textDark,
              fontFamily: T.font,
            }}
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onRemoveTag(i)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                margin: 0,
                lineHeight: 1,
                fontSize: 15,
                fontWeight: 800,
                color: T.textMuted,
                display: "flex",
                alignItems: "center",
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        value={draftValue}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          onCommitDraft();
        }}
        placeholder={placeholder}
        style={inputStyle}
      />
      {helperText ? (
        <p style={{ margin: 0, fontSize: 12, color: T.textMuted, fontWeight: 500, lineHeight: 1.4 }}>{helperText}</p>
      ) : null}
      {error ? (
        <span
          style={{
            fontSize: 12,
            color: "#dc2626",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {error}
        </span>
      ) : null}
    </div>
  );
}

type TabType = 
  | "Lead Information"
  | "Personal Information"
  | "Contact & Address"
  | "Health Information"
  | "Policy Details"
  | "Banking Information";

const tabSections: Record<TabType, string> = {
  "Lead Information": "section-lead-info",
  "Personal Information": "section-personal-info",
  "Contact & Address": "section-contact-address",
  "Health Information": "section-health-info",
  "Policy Details": "section-policy-details",
  "Banking Information": "section-banking-info",
};

export type TransferLeadSaveDraftMeta = { source: "auto" | "manual" };

export default function TransferLeadApplicationForm({
  onBack,
  onSubmit,
  onSaveDraft,
  onInstantDuplicateCheck,
  initialData,
  submitButtonLabel,
  centerName = "",
  centerDid = "",
  unlockAfterDuplicateRemount = false,
}: {
  onBack: () => void;
  onSubmit: (data: TransferLeadFormData) => void | Promise<boolean | void>;
  onSaveDraft?: (data: TransferLeadFormData, meta?: TransferLeadSaveDraftMeta) => void | Promise<void>;
  onInstantDuplicateCheck?: (data: TransferLeadFormData) => void | Promise<void>;
  initialData?: Partial<TransferLeadFormData>;
  submitButtonLabel?: string;
  centerName?: string;
  /** Call center direct line (DID) from `call_centers.did` — shown on the form and echoed after submit from the intake page. */
  centerDid?: string;
  /** Set when remounting after "Create Duplicate" — restores phone-gate + transfer-check so tabs and submit stay usable. */
  unlockAfterDuplicateRemount?: boolean;
}) {
  const supabase = getSupabaseBrowserClient();
  const isEditMode = (submitButtonLabel || "").toLowerCase().includes("update");
  const resumeVerificationAfterDuplicate =
    Boolean(unlockAfterDuplicateRemount) && !isEditMode;
  const [activeTab, setActiveTab] = useState<TabType>("Lead Information");
  const tabs: TabType[] = [
    "Lead Information",
    "Personal Information",
    "Contact & Address",
    "Health Information",
    "Policy Details",
    "Banking Information"
  ];
  const contentRef = useRef<HTMLDivElement>(null);
  const [showUnderwritingModal, setShowUnderwritingModal] = useState(false);
  const [toolkitUrl, setToolkitUrl] = useState("https://insurancetoolkits.com/login");
  const [dncChecking, setDncChecking] = useState(false);
  const [dncStatus, setDncStatus] = useState<DncStatus>("idle");
  const [dncMessage, setDncMessage] = useState("");
  /** Same DNC/TCPA modal as verification panel (Call Center Lead Intake + transfer flows). */
  const [showDncModal, setShowDncModal] = useState(false);
  const [transferCheckData, setTransferCheckData] = useState<TransferCheckApiResponse | null>(null);
  const [transferCheckError, setTransferCheckError] = useState<string | null>(null);
  const [transferCheckCompleted, setTransferCheckCompleted] = useState(() => resumeVerificationAfterDuplicate);
  const [isCustomerBlocked, setIsCustomerBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [phoneDupChecking, setPhoneDupChecking] = useState(false);
  const [showPhoneDupDetails, setShowPhoneDupDetails] = useState(false);
  const [phoneDupMatch, setPhoneDupMatch] = useState<PhoneDuplicateMatch | null>(null);
  const [phoneDupRuleMessage, setPhoneDupRuleMessage] = useState("");
  const [phoneDupIsAddable, setPhoneDupIsAddable] = useState(true);
  /** All leads sharing this phone (same agent); SSN narrows when length > 1. */
  const [phoneDupCandidates, setPhoneDupCandidates] = useState<PhoneDuplicateMatch[]>([]);
  const phoneDupCandidatesRef = useRef<PhoneDuplicateMatch[]>([]);
  const [duplicateDecisionLog, setDuplicateDecisionLog] = useState<string[]>([]);
  const [ssnCheckState, setSsnCheckState] = useState<SsnCheckState>("idle");
  const [ssnCheckMessage, setSsnCheckMessage] = useState("");
  const [lastCheckedSsn, setLastCheckedSsn] = useState("");
  const [lastAutoCheckedSsn, setLastAutoCheckedSsn] = useState("");
  const [showSsnDupDetails, setShowSsnDupDetails] = useState(false);
  const [ssnDupMatch, setSsnDupMatch] = useState<SsnDuplicateMatch | null>(null);
  const [ssnDupIsAddable, setSsnDupIsAddable] = useState(true);
  const [underwritingData, setUnderwritingData] = useState({
    tobaccoLast12Months: "",
    height: "",
    weight: "",
    carrier: "",
    productLevel: "",
    coverageAmount: "",
    monthlyPremium: "",
  });
  const [underwritingHealthTags, setUnderwritingHealthTags] = useState<string[]>([]);
  const [underwritingMedicationTags, setUnderwritingMedicationTags] = useState<string[]>([]);
  const [underwritingHealthInput, setUnderwritingHealthInput] = useState("");
  const [underwritingMedicationInput, setUnderwritingMedicationInput] = useState("");
  const [healthConditionsTagInput, setHealthConditionsTagInput] = useState("");
  const [medicationsTagInput, setMedicationsTagInput] = useState("");
  const [submitHighlightKeys, setSubmitHighlightKeys] = useState<Set<keyof TransferLeadFormData>>(() => new Set());
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [hoveredFieldInfo, setHoveredFieldInfo] = useState<{ key: string; info: string; x: number; y: number } | null>(null);
  /** Shown during and after submission to handle the transfer step. */
  const [showTransferSubmitGate, setShowTransferSubmitGate] = useState(false);
  const [isSubmittingInTransferModal, setIsSubmittingInTransferModal] = useState(false);
  const [didCopied, setDidCopied] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaveSavingDraft, setLeaveSavingDraft] = useState(false);
  const displayBpoName = (centerName || "").trim() || "BPO";
  const displayCenterDid = (centerDid || "").trim();

  const [formData, setFormData] = useState<TransferLeadFormData>(() => buildFormState(initialData, centerName));

  useEffect(() => {
    if (!initialData) return;
    setFormData(buildFormState(initialData, centerName));
  }, [initialData, centerName]);

  useEffect(() => {
    if (!formData.dateOfBirth || formData.age.trim()) return;
    const computedAge = calculateAgeFromDob(formData.dateOfBirth);
    if (!computedAge) return;
    setFormData((prev) => ({ ...prev, age: computedAge }));
    // Only backfill once when DOB exists and age is empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.dateOfBirth, formData.age]);

  useEffect(() => {
    setSubmitHighlightKeys(new Set());
  }, [formData]);

  const onInvalidateUwProduct = useCallback((list: CarrierProductRow[], carrierNameSnapshot: string) => {
    setUnderwritingData((prev) => {
      if (prev.carrier.trim() !== carrierNameSnapshot) return prev;
      if (!prev.productLevel.trim()) return prev;
      if (list.some((x) => x.name === prev.productLevel)) return prev;
      return { ...prev, productLevel: "" };
    });
  }, []);

  const onInvalidatePolicyProduct = useCallback((list: CarrierProductRow[], carrierNameSnapshot: string) => {
    setFormData((prev) => {
      if (prev.carrier.trim() !== carrierNameSnapshot) return prev;
      if (!prev.productType.trim()) return prev;
      if (list.some((x) => x.name === prev.productType)) return prev;
      return { ...prev, productType: "" };
    });
  }, []);

  const onInvalidateBackupProduct = useCallback((list: CarrierProductRow[], carrierNameSnapshot: string) => {
    setFormData((prev) => {
      if (prev.backupCarrier.trim() !== carrierNameSnapshot) return prev;
      if (!prev.backupProductType.trim()) return prev;
      if (list.some((x) => x.name === prev.backupProductType)) return prev;
      return { ...prev, backupProductType: "" };
    });
  }, []);

  const { carriers, productsForCarrier, loadingProducts: policyCarrierProductsLoading } =
    useCarrierProductDropdowns(supabase, {
      carrierName: formData.carrier,
      onInvalidateProduct: onInvalidatePolicyProduct,
    });

  const { productsForCarrier: uwProductsForCarrier, loadingProducts: uwCarrierProductsLoading } =
    useCarrierProductDropdowns(supabase, {
      carrierName: underwritingData.carrier,
      onInvalidateProduct: onInvalidateUwProduct,
    });

  const {
    productsForCarrier: backupProductsForCarrier,
    loadingProducts: backupCarrierProductsLoading,
  } = useCarrierProductDropdowns(supabase, {
    carrierName: formData.backupCarrier,
    onInvalidateProduct: onInvalidateBackupProduct,
  });

  const phoneError = formData.phone.length > 0 && !getUsPhone10Digits(formData.phone);
  const ssnDigits = normalizeSsnDigits(formData.social);
  const ssnError = formData.social.trim().length > 0 && ssnDigits.length !== 9;

  const fieldStyleWithError = (key: keyof TransferLeadFormData, extra?: CSSProperties): CSSProperties => {
    const error = submitHighlightKeys.has(key);
    return {
      ...fieldStyle,
      ...extra,
      ...(error ? { 
        border: `2px solid ${T.danger}`,
        boxShadow: "0 0 0 3px rgba(220, 38, 38, 0.1)",
      } : {}),
    };
  };

  function generateRandomFourDigits(): string {
    try {
      const cryptoObj = globalThis.crypto;
      if (cryptoObj?.getRandomValues) {
        const buf = new Uint16Array(1);
        cryptoObj.getRandomValues(buf);
        return String(buf[0] % 10000).padStart(4, "0");
      }
    } catch {
      // Fallback below.
    }
    return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  }

  const leadUniqueIdRandomSuffixRef = useRef<string | null>(null);
  if (leadUniqueIdRandomSuffixRef.current === null) {
    leadUniqueIdRandomSuffixRef.current = generateRandomFourDigits();
  }

  const getFieldError = (key: keyof TransferLeadFormData): string | undefined => {
    if (!submitHighlightKeys.has(key)) return undefined;
    
    const fieldLabels: Record<string, string> = {
      submissionDate: "Date of submission is required",
      firstName: "First name is required",
      lastName: "Last name is required",
      street1: "Street address is required",
      city: "City is required",
      state: "State is required",
      zipCode: "ZIP code is required",
      phone: "Valid phone number is required (10 digits)",
      language: "Language is required",
      birthState: "Birth state is required",
      dateOfBirth: "Date of birth is required",
      age: "Age is required",
      social: "Valid SSN is required (9 digits)",
      driverLicenseNumber: "Driver's license number is required",
      existingCoverageLast2Years: "Please select Yes or No",
      previousApplications2Years: "Please select Yes or No",
      height: "Height is required",
      weight: "Weight is required",
      doctorName: "Doctor's name is required",
      tobaccoUse: "Please select Yes or No for tobacco use",
      healthConditions: "Health conditions are required",
      medications: "Medications are required",
      monthlyPremium: "Monthly premium is required",
      coverageAmount: "Coverage amount is required",
      carrier: "Carrier is required",
      productType: "Product type is required",
      draftDate: "Draft date is required",
      beneficiaryInformation: "Beneficiary information is required",
      institutionName: "Institution name is required",
      routingNumber: "Routing number is required",
      accountNumber: "Account number is required",
      futureDraftDate: "Future draft date is required",
      backupCarrier: "Backup carrier is required",
      backupProductType: "Backup product type is required",
      backupMonthlyPremium: "Backup monthly premium is required",
      backupCoverageAmount: "Backup coverage amount is required",
    };
    
    return fieldLabels[key] || "This field is required";
  };

  const computedLeadUniqueId = useMemo(() => {
    const existing = String(formData.leadUniqueId || "").trim().toUpperCase();
    if (existing) return existing;

    // 2 number phone + 3 letters from name + SSN last 2 digits + centre 2 letters + 4 random digits
    const phoneDigits = formData.phone.replace(/\D/g, "");
    const phone2 = phoneDigits.slice(0, 2);
    const nameLetters = `${formData.firstName}${formData.lastName}`.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
    const socialDigits = formData.social.replace(/\D/g, "");
    const ssn2 = socialDigits.slice(-2);
    const center2 = (centerName || "").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
    if (!phone2 || nameLetters.length < 3 || ssn2.length < 2 || center2.length < 2) {
      return "";
    }
    const rand4 = leadUniqueIdRandomSuffixRef.current || "0000";
    return `${phone2}${nameLetters}${ssn2}${center2}${rand4}`.toUpperCase();
  }, [formData.firstName, formData.lastName, formData.phone, formData.social, formData.leadUniqueId, centerName]);

  const executeApplicationSubmit = useCallback(async () => {
    // Show transfer modal immediately with loading state
    setShowTransferSubmitGate(true);
    setIsSubmittingInTransferModal(true);
    try {
      const submitResult = await onSubmit({ ...formData, leadUniqueId: computedLeadUniqueId });
      if (submitResult === false) {
        // Close modal if submission was cancelled/invalid
        setShowTransferSubmitGate(false);
        return;
      }
      // Keep modal open - submission succeeded, will show success content
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Submission failed. Please try again.", type: "error" });
      setShowTransferSubmitGate(false);
    } finally {
      setIsSubmittingInTransferModal(false);
    }
  }, [onSubmit, formData, computedLeadUniqueId]);

  useEffect(() => {
    if (!showTransferSubmitGate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isSubmittingInTransferModal) return;
      setShowTransferSubmitGate(false);
      onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showTransferSubmitGate, isSubmittingInTransferModal, onBack]);

  const set = (key: keyof TransferLeadFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const checkPhoneDuplicate = async (): Promise<PhoneDupCheckResult> => {
    const canonicalDigits = getUsPhone10Digits(formData.phone);
    if (!canonicalDigits) {
      setPhoneDupMatch(null);
      setPhoneDupCandidates([]);
      phoneDupCandidatesRef.current = [];
      setPhoneDupRuleMessage("");
      setPhoneDupIsAddable(true);
      setDuplicateDecisionLog([]);
      return { match: null, isAddable: true, ruleMessage: "" };
    }

    setPhoneDupChecking(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || null;
      if (!currentUserId) {
        setPhoneDupMatch(null);
        setPhoneDupCandidates([]);
        phoneDupCandidatesRef.current = [];
        setPhoneDupRuleMessage("");
        setPhoneDupIsAddable(true);
        setDuplicateDecisionLog([]);
        return { match: null, isAddable: true, ruleMessage: "" };
      }

      const rawDigits = normalizePhoneDigits(formData.phone);
      const variants = Array.from(new Set([formData.phone.trim(), rawDigits, canonicalDigits, formatUsPhone(canonicalDigits)].filter(Boolean)));
      const { data: existing, error: existingError } = await supabase
        .from("leads")
        .select("id, lead_unique_id, first_name, last_name, phone, social, stage, created_at")
        .eq("is_draft", false)
        .in("phone", variants)
        .order("created_at", { ascending: false });

      if (existingError) {
        throw new Error(existingError.message || "Unable to check phone duplicates.");
      }

      const rows = ((existing || []) as PhoneDuplicateQueryRow[]).filter(
        (row) => getUsPhone10Digits(String(row.phone || "")) === canonicalDigits,
      );

      const mapRow = (row: PhoneDuplicateQueryRow): PhoneDuplicateMatch => ({
        id: String(row.id),
        lead_unique_id: row.lead_unique_id ?? null,
        first_name: row.first_name ?? null,
        last_name: row.last_name ?? null,
        phone: row.phone ?? null,
        social: row.social ?? null,
        stage: row.stage ?? null,
        created_at: row.created_at ?? null,
      });

      const candidates = rows.map(mapRow);
      setPhoneDupCandidates(candidates);
      phoneDupCandidatesRef.current = candidates;

      const { data: rulesData, error: rulesError } = await supabase
        .from("ssn_duplicate_stage_rules")
        .select("stage_name, ghl_stage, message, is_addable, is_active, precedence_rank")
        .eq("is_active", true);

      if (rulesError) {
        throw new Error(rulesError.message || "Unable to load duplicate rules.");
      }

      const rules = ((rulesData || []) as SsnDuplicateRule[]).map((rule) => ({
        ...rule,
        stage_name: String(rule.stage_name || "").trim(),
        ghl_stage: String(rule.ghl_stage || "").trim() || null,
      }));

      const ssnDigits = normalizeSsnDigits(formData.social);

      const logPrefix = [
        `Phone duplicate check: normalized phone ***${canonicalDigits.slice(-4)} (${candidates.length} matching non-draft lead(s) in CRM, system-wide per RLS).`,
      ];

      if (candidates.length === 0) {
        setPhoneDupMatch(null);
        setPhoneDupRuleMessage("No existing lead found for this phone number.");
        setPhoneDupIsAddable(true);
        const log = [...logPrefix, "Scenario: no CRM phone match — transfer-check (CRM) shows cleared."];
        setDuplicateDecisionLog(log);
        console.info("[duplicate-check]", log.join(" | "));
        return { match: null, isAddable: true, ruleMessage: "" };
      }

      if (candidates.length === 1) {
        const mapped = candidates[0];
        const resolved = resolveDuplicatePolicy([{ id: mapped.id, stage: mapped.stage }], rules);
        const stage = String(mapped.stage || "").trim();
        const matchedRule = ruleForLeadStage(stage, rules);
        const ghlBit =
          matchedRule?.ghl_stage && matchedRule.ghl_stage.toLowerCase() !== stage.toLowerCase()
            ? ` (GHL: ${matchedRule.ghl_stage})`
            : "";
        const ruleMessage = `${resolved.message}${stage ? ` Stage: ${stage}.` : ""}${ghlBit}`;
        setPhoneDupMatch(mapped);
        setPhoneDupRuleMessage(ruleMessage);
        setPhoneDupIsAddable(resolved.isAddable);
        const log = [...logPrefix, "Scenario: single phone match — stage rules applied.", ...resolved.log];
        setDuplicateDecisionLog(log);
        console.info("[duplicate-check]", log.join(" | "));
        return { match: mapped, isAddable: resolved.isAddable, ruleMessage };
      }

      const narrowed =
        ssnDigits.length === 9
          ? candidates.filter((c) => normalizeSsnDigits(String(c.social || "")) === ssnDigits)
          : [];

      if (narrowed.length === 0) {
        const ruleMessage =
          ssnDigits.length === 9
            ? `This phone is on file for ${candidates.length} leads, but the SSN you entered does not match any of those records. Treating as a different customer (shared or recycled line).`
            : `This phone is on file for ${candidates.length} leads. Enter the customer's full SSN to confirm which record applies (duplicates-of-duplicates check).`;
        setPhoneDupMatch(candidates[0]);
        setPhoneDupRuleMessage(ruleMessage);
        setPhoneDupIsAddable(true);
        const log = [
          ...logPrefix,
          ssnDigits.length === 9
            ? "Scenario: multiple phone matches; SSN did not match any of those leads — allow with shared-line warning."
            : "Scenario: multiple phone matches; waiting for 9-digit SSN to narrow records.",
        ];
        setDuplicateDecisionLog(log);
        console.info("[duplicate-check]", log.join(" | "));
        return { match: candidates[0], isAddable: true, ruleMessage };
      }

      const resolved = resolveDuplicatePolicy(
        narrowed.map((c) => ({ id: c.id, stage: c.stage })),
        rules,
      );
      const detail = narrowed[0];
      const stage = String(detail.stage || "").trim();
      const ruleMessage = `${resolved.message}${stage ? ` Stage: ${stage}.` : ""} (${narrowed.length} record(s) share this phone and SSN.)`;
      setPhoneDupMatch(detail);
      setPhoneDupRuleMessage(ruleMessage);
      setPhoneDupIsAddable(resolved.isAddable);
      const log = [
        ...logPrefix,
        `Scenario: duplicates-of-duplicates — SSN narrowed ${candidates.length} phone lead(s) to ${narrowed.length}.`,
        ...resolved.log,
      ];
      setDuplicateDecisionLog(log);
      console.info("[duplicate-check]", log.join(" | "));
      return { match: detail, isAddable: resolved.isAddable, ruleMessage };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to check phone duplicates.";
      setPhoneDupMatch(null);
      setPhoneDupCandidates([]);
      phoneDupCandidatesRef.current = [];
      setPhoneDupRuleMessage(message);
      setPhoneDupIsAddable(true);
      setDuplicateDecisionLog([`Phone duplicate error: ${message}`]);
      return { match: null, isAddable: true, ruleMessage: "" };
    } finally {
      setPhoneDupChecking(false);
    }
  };

  const checkDnc = async (): Promise<PhoneScreeningGateResult> => {
    const cleanPhone = getUsPhone10Digits(formData.phone);
    if (!cleanPhone) {
      setDncStatus("error");
      setDncMessage("Please enter a valid 10-digit number or 11 digits starting with 1.");
      setTransferCheckData(null);
      setTransferCheckError(null);
      setTransferCheckCompleted(false);
      setIsCustomerBlocked(false);
      setBlockReason("");
      setShowDncModal(true);
      return { status: "error", duplicateBlocksPhone: false };
    }

    setDncChecking(true);
    setDncStatus("idle");
    setDncMessage("");
    setTransferCheckError(null);
    setTransferCheckData(null);
    setTransferCheckCompleted(false);
    setIsCustomerBlocked(false);
    setBlockReason("");

    let duplicateBlocksPhone = false;
    try {
      const dup = await checkPhoneDuplicate();
      if (dup.match) setShowPhoneDupDetails(true);
      if (dup.match && !isEditMode && onInstantDuplicateCheck) {
        void onInstantDuplicateCheck({ ...formData, leadUniqueId: computedLeadUniqueId });
      }
      duplicateBlocksPhone = Boolean(dup.match) && !dup.isAddable;

      /** DNC/screening first; CRM `transfer-check` only if not TCPA (avoids contradictory “cleared” CRM state). */
      const dncRes = await runDncLookup(supabase, cleanPhone);

      setIsCustomerBlocked(false);
      setBlockReason("");

      if (!dncRes.ok) {
        setTransferCheckData(null);
        setTransferCheckCompleted(false);
        setTransferCheckError(null);
        const msg =
          String(dncRes.data.message ?? dncRes.data.error ?? "").trim() ||
          `Screening request failed (${dncRes.status}).`;
        setDncStatus("error");
        setDncMessage(msg);
        setShowDncModal(true);
        return { status: "error", duplicateBlocksPhone };
      }

      const dncData = dncRes.data;
      const dncCallStatus = String(dncData.callStatus ?? "");
      if (dncCallStatus === "ERROR") {
        setTransferCheckData(null);
        setTransferCheckCompleted(false);
        setTransferCheckError(null);
        const msg =
          String(dncData.message ?? "").trim() ||
          "Screening could not be completed. Do not treat this number as safe.";
        setDncStatus("error");
        setDncMessage(msg);
        setShowDncModal(true);
        return { status: "error", duplicateBlocksPhone };
      }

      const dncFlags = dncData.flags as
        | { isTcpa?: boolean; isDnc?: boolean; isInvalid?: boolean; isClean?: boolean }
        | undefined;

      const isTCPA = dncFlags?.isTcpa === true;

      if (isTCPA) {
        setTransferCheckData(null);
        setTransferCheckCompleted(false);
        setTransferCheckError(null);
        setIsCustomerBlocked(true);
        setBlockReason("TCPA Litigator Detected - No Contact Permitted");
        setDncStatus("tcpa");
        setDncMessage(
          String(dncData.message ?? "").trim() ||
            "This number is flagged as a TCPA litigator. All transfers and contact attempts are strictly prohibited.",
        );
        setShowDncModal(true);
        setToast({
          message:
            "This number is flagged as a TCPA litigator. All transfers and contact attempts are strictly prohibited.",
          type: "error",
        });
        return { status: "tcpa", duplicateBlocksPhone };
      }

      const transferRes = await runTransferCheck(supabase, cleanPhone, {
        phoneRaw: formData.phone,
        social: formData.social,
      });

      if (!transferRes.ok) {
        setTransferCheckData(null);
        setTransferCheckCompleted(false);
        const errText =
          String(transferRes.data.message ?? transferRes.data.error ?? "").trim() ||
          `transfer-check failed (${transferRes.status})`;
        setTransferCheckError(errText);
        setDncStatus("error");
        setDncMessage(errText);
        setShowDncModal(true);
        return { status: "error", duplicateBlocksPhone };
      }

      const data = transferRes.data as TransferCheckApiResponse;
      setTransferCheckData(data);
      setTransferCheckCompleted(true);

      const crmMatchGate = data.crm_phone_match as
        | { has_match?: boolean; is_addable?: boolean; rule_message?: string }
        | undefined;
      const crmBlocksTransfer = crmMatchGate?.has_match === true && crmMatchGate?.is_addable === false;

      const isDncList = dncFlags?.isDnc === true;
      const isInvalidPhone = dncFlags?.isInvalid === true;

      // Invalid phone first, then CRM is_addable (always wins over DNC advisory), then DNC list, then clear.
      if (isInvalidPhone) {
        setIsCustomerBlocked(true);
        setBlockReason("Invalid phone (screening)");
        setDncStatus("error");
        setDncMessage(
          String(dncData.message ?? "").trim() || "This phone number appears to be invalid.",
        );
        setShowDncModal(true);
        setToast({
          message: String(dncData.message ?? "").trim() || "Invalid phone number per screening.",
          type: "error",
        });
        return { status: "error", duplicateBlocksPhone };
      }

      if (crmBlocksTransfer) {
        const rm = String(crmMatchGate?.rule_message ?? "").trim();
        setIsCustomerBlocked(true);
        setBlockReason(rm || "CRM transfer rules block this submission.");
        setDncStatus("agency_dq");
        setDncMessage(rm || "This transfer is not permitted based on CRM stage rules.");
        setShowDncModal(true);
        setToast({
          message: rm || "This transfer is not permitted based on CRM stage rules.",
          type: "error",
        });
        return { status: "agency_dq", duplicateBlocksPhone };
      }

      if (isDncList) {
        setDncStatus("dnc");
        const rootMessage = String(data.message ?? "").trim();
        const screeningMessage = String(dncData.message ?? "").trim();
        const crmMatch = (data as { crm_phone_match?: { has_match?: boolean; rule_message?: string } })
          .crm_phone_match;
        const serverDupRule =
          crmMatch?.has_match === true && String(crmMatch.rule_message ?? "").trim()
            ? String(crmMatch.rule_message).trim()
            : "";
        const dupRuleForModal = dup.match && dup.ruleMessage.trim() ? dup.ruleMessage.trim() : "";
        if (serverDupRule) {
          setDncMessage(serverDupRule);
        } else if (dupRuleForModal) {
          setDncMessage(dupRuleForModal);
        } else if (screeningMessage) {
          setDncMessage(screeningMessage);
        } else if (rootMessage) {
          setDncMessage(rootMessage);
        } else {
          setDncMessage("Do not call: this number is on a DNC list.");
        }
        return { status: "dnc", duplicateBlocksPhone };
      }

      setDncStatus("clear");
      const rootMessage = String(data.message ?? "").trim();
      const crmMatch = (data as { crm_phone_match?: { has_match?: boolean; rule_message?: string } })
        .crm_phone_match;
      const serverDupRule =
        crmMatch?.has_match === true && String(crmMatch.rule_message ?? "").trim()
          ? String(crmMatch.rule_message).trim()
          : "";
      const dupRuleForModal = dup.match && dup.ruleMessage.trim() ? dup.ruleMessage.trim() : "";
      if (serverDupRule) {
        setDncMessage(serverDupRule);
      } else if (dupRuleForModal) {
        setDncMessage(dupRuleForModal);
      } else if (rootMessage) {
        setDncMessage(rootMessage);
      } else {
        setDncMessage(TRANSFER_CHECK_CLEAR_USER_MESSAGE);
      }
      setShowDncModal(true);
      return { status: "clear", duplicateBlocksPhone };
    } catch (error) {
      console.error("Transfer check error:", error);
      let message = "Failed to connect to transfer check service.";
      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        message = "Cannot connect to transfer check service. Please try again later.";
      }
      setTransferCheckData(null);
      setTransferCheckCompleted(false);
      setTransferCheckError(message);
      setDncStatus("error");
      setDncMessage(message);
      setShowDncModal(true);
      return { status: "error", duplicateBlocksPhone };
    } finally {
      setDncChecking(false);
    }
  };

  const togglePhoneDupDetails = () => {
    setShowPhoneDupDetails((prev) => !prev);
  };

  function normalizeSsnDigits(value: string) {
    return value.replace(/\D/g, "");
  }

  function formatSsn(digits: string) {
    return digits.length === 9 ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}` : digits;
  }

  const [phoneGatePassed, setPhoneGatePassed] = useState(
    () => isEditMode || resumeVerificationAfterDuplicate,
  );
  useEffect(() => {
    if (isEditMode) setPhoneGatePassed(true);
  }, [isEditMode]);

  const lastSavedDraftSnapshotRef = useRef<string>("");

  const currentDraftSnapshot = useMemo(
    () => JSON.stringify({ ...formData, leadUniqueId: computedLeadUniqueId, isDraft: true }),
    [formData, computedLeadUniqueId],
  );

  useEffect(() => {
    if (!lastSavedDraftSnapshotRef.current) lastSavedDraftSnapshotRef.current = currentDraftSnapshot;
  }, [currentDraftSnapshot]);

  const hasUnsavedDraftChanges =
    Boolean(onSaveDraft) &&
    phoneGatePassed &&
    !showTransferSubmitGate &&
    currentDraftSnapshot !== lastSavedDraftSnapshotRef.current;

  const saveDraftNow = useCallback(
    async (opts?: { thenLeave?: boolean }) => {
      if (!onSaveDraft) return;
      const payload: TransferLeadFormData = { ...formData, leadUniqueId: computedLeadUniqueId, isDraft: true };
      try {
        await onSaveDraft(payload, { source: "manual" });
        lastSavedDraftSnapshotRef.current = JSON.stringify(payload);
        setToast({ message: "Draft saved", type: "success" });
        if (opts?.thenLeave) onBack();
      } catch (e) {
        setToast({ message: e instanceof Error ? e.message : "Failed to save draft", type: "error" });
      }
    },
    [onSaveDraft, formData, computedLeadUniqueId, onBack],
  );

  const requestLeave = useCallback(() => {
    if (!hasUnsavedDraftChanges) {
      onBack();
      return;
    }
    setLeaveConfirmOpen(true);
  }, [hasUnsavedDraftChanges, onBack]);

  useEffect(() => {
    if (!hasUnsavedDraftChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedDraftChanges]);

  const duplicateBlocked = Boolean(phoneDupMatch && !phoneDupIsAddable);
  /** TCPA and CRM DQ block submission; DNC is advisory — intake can continue with proper compliance. */
  const transferCheckBlocksSubmit =
    isCustomerBlocked || dncStatus === "tcpa" || dncStatus === "agency_dq";
  const phoneBundleNeedsSsn =
    !isEditMode &&
    phoneDupCandidates.length > 1 &&
    normalizeSsnDigits(formData.social).length !== 9;
  const submitBlockMessage =
    ssnCheckState === "blocked"
      ? ssnCheckMessage
      : transferCheckBlocksSubmit
        ? blockReason || dncMessage || "This customer cannot be submitted."
        : phoneBundleNeedsSsn
          ? "Enter the customer's full SSN — this phone number is tied to multiple leads."
        : duplicateBlocked
          ? (phoneDupRuleMessage || "A matching lead exists and duplicate creation is not allowed.")
          : "";
  const submitDisabled =
    Boolean(submitBlockMessage) ||
    (!isEditMode && (!transferCheckCompleted || transferCheckBlocksSubmit));

  const dncModalHardStop = dncStatus === "tcpa" || dncStatus === "agency_dq";
  const dncModalDncWarn = dncStatus === "dnc";

  const checkSsnRules = async (rawSsn: string): Promise<{ blocked: boolean; warning: boolean }> => {
    const ssnDigits = normalizeSsnDigits(rawSsn);
    if (ssnDigits.length !== 9) {
      setSsnCheckState("idle");
      setSsnCheckMessage("");
      setSsnDupMatch(null);
      setSsnDupIsAddable(true);
      setShowSsnDupDetails(false);
      return { blocked: false, warning: false };
    }

    if (!isEditMode && lastCheckedSsn === ssnDigits && (ssnCheckState === "blocked" || ssnCheckState === "warning" || ssnCheckState === "clear")) {
      return { blocked: ssnCheckState === "blocked", warning: ssnCheckState === "warning" };
    }

    setSsnCheckState("checking");
    setSsnCheckMessage("Checking SSN against existing leads...");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || null;
      if (!currentUserId) {
        setSsnCheckState("idle");
        setSsnCheckMessage("");
        setSsnDupMatch(null);
        setSsnDupIsAddable(true);
        setShowSsnDupDetails(false);
        return { blocked: false, warning: false };
      }

      const variants = Array.from(new Set([rawSsn.trim(), ssnDigits, formatSsn(ssnDigits)].filter(Boolean)));
      const { data, error } = await supabase
        .from("leads")
        .select("id, lead_unique_id, first_name, last_name, phone, stage, social, created_at")
        .eq("is_draft", false)
        .in("social", variants)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message || "Unable to validate SSN.");
      }

      const matches = (data || []).filter((row) => normalizeSsnDigits(String(row.social || "")) === ssnDigits);
      const { data: rulesData, error: rulesError } = await supabase
        .from("ssn_duplicate_stage_rules")
        .select("stage_name, ghl_stage, message, is_addable, is_active, precedence_rank")
        .eq("is_active", true);

      if (rulesError) {
        throw new Error(rulesError.message || "Unable to load SSN duplicate rules.");
      }

      const rules = ((rulesData || []) as SsnDuplicateRule[]).map((rule) => ({
        ...rule,
        stage_name: String(rule.stage_name || "").trim(),
        ghl_stage: String(rule.ghl_stage || "").trim() || null,
      }));

      const phoneSnap = phoneDupCandidatesRef.current;
      let policyRows = matches;
      if (phoneSnap.length > 1 && matches.length > 0) {
        const overlap = matches.filter((row) => phoneSnap.some((p) => p.id === String(row.id)));
        if (overlap.length > 0) {
          policyRows = overlap;
          setDuplicateDecisionLog((prev) => [
            ...prev,
            `SSN validation: ${matches.length} SSN match(es); narrowed to ${overlap.length} that are also in the current phone duplicate bundle.`,
          ]);
        } else {
          setDuplicateDecisionLog((prev) => [
            ...prev,
            `SSN validation: phone bundle has ${phoneSnap.length} leads; SSN matched ${matches.length} lead(s) outside that bundle — applying full SSN policy.`,
          ]);
        }
      }

      if (phoneSnap.length > 1 && matches.length === 0) {
        const narrowedPhone = phoneSnap.filter((c) => normalizeSsnDigits(String(c.social || "")) === ssnDigits);
        if (narrowedPhone.length > 0) {
          const pres = resolveDuplicatePolicy(
            narrowedPhone.map((c) => ({ id: c.id, stage: c.stage })),
            rules,
          );
          const d = narrowedPhone[0];
          setPhoneDupMatch(d);
          setPhoneDupRuleMessage(
            `${pres.message}${d.stage ? ` Stage: ${d.stage}.` : ""} (${narrowedPhone.length} record(s) share this phone and SSN.)`,
          );
          setPhoneDupIsAddable(pres.isAddable);
          setDuplicateDecisionLog((prev) => [...prev, "SSN validation: no separate SSN query rows; applied policy from phone + on-file SSN.", ...pres.log]);
        } else {
          setPhoneDupRuleMessage(
            `This phone is on file for ${phoneSnap.length} leads; the SSN entered does not match any of those records — treating as a different customer.`,
          );
          setPhoneDupIsAddable(true);
          setDuplicateDecisionLog((prev) => [
            ...prev,
            "SSN validation: multi-phone bundle; SSN not on any of those leads — allow (shared line / new identity).",
          ]);
        }
      }

      const resolved = resolveDuplicatePolicy(
        policyRows.map((row) => ({ id: String(row.id), stage: row.stage ?? null })),
        rules,
      );

      const overlapBundle =
        phoneSnap.length > 1 && matches.length > 0
          ? matches.filter((row) => phoneSnap.some((p) => p.id === String(row.id)))
          : [];
      if (overlapBundle.length > 0 && policyRows.length > 0) {
        const r0 = policyRows[0];
        setPhoneDupMatch({
          id: String(r0.id),
          lead_unique_id: r0.lead_unique_id ?? null,
          first_name: r0.first_name ?? null,
          last_name: r0.last_name ?? null,
          phone: r0.phone ?? null,
          social: r0.social ?? null,
          stage: r0.stage ?? null,
          created_at: r0.created_at ?? null,
        });
        setPhoneDupRuleMessage(
          `${resolved.message}${r0.stage ? ` Stage: ${String(r0.stage)}.` : ""} (${policyRows.length} record(s) after phone + SSN reconciliation.)`,
        );
        setPhoneDupIsAddable(resolved.isAddable);
      }

      const pickDetailRow = (): (typeof matches)[number] | null => {
        if (!policyRows.length) return null;
        const blocker = policyRows.find((r) => ruleForLeadStage(r.stage, rules)?.is_addable === false);
        return blocker || policyRows[0];
      };
      const detailRow = pickDetailRow();

      if (detailRow) {
        const mappedDetail: SsnDuplicateMatch = {
          id: String(detailRow.id),
          lead_unique_id: detailRow.lead_unique_id ?? null,
          first_name: detailRow.first_name ?? null,
          last_name: detailRow.last_name ?? null,
          phone: detailRow.phone ?? null,
          social: detailRow.social ?? null,
          stage: detailRow.stage ?? null,
          created_at: detailRow.created_at ?? null,
        };
        setSsnDupMatch(mappedDetail);
        if (!isEditMode && onInstantDuplicateCheck) {
          void onInstantDuplicateCheck({ ...formData, leadUniqueId: computedLeadUniqueId });
        }
      } else {
        setSsnDupMatch(null);
      }

      setLastCheckedSsn(ssnDigits);

      if (policyRows.length > 0 && !resolved.isAddable) {
        const leadName = `${detailRow?.first_name || ""} ${detailRow?.last_name || ""}`.trim() || "existing lead";
        const matchedRule = ruleForLeadStage(detailRow?.stage, rules);
        const ghlStage = matchedRule?.ghl_stage ? ` (GHL: ${matchedRule.ghl_stage})` : "";
        setSsnCheckState("blocked");
        setSsnDupIsAddable(false);
        setSsnCheckMessage(`${resolved.message} Existing lead: ${leadName}.${ghlStage}`);
        setDuplicateDecisionLog((prev) => [...prev, ...resolved.log]);
        console.info("[duplicate-check]", ["ssn-block", ...resolved.log].join(" | "));
        return { blocked: true, warning: false };
      }

      if (policyRows.length > 0 && resolved.isAddable) {
        const matchedRule = ruleForLeadStage(detailRow?.stage, rules);
        const ghlStage = matchedRule?.ghl_stage ? ` (GHL: ${matchedRule.ghl_stage})` : "";
        setSsnCheckState("warning");
        setSsnDupIsAddable(true);
        setSsnCheckMessage(`${resolved.message}${ghlStage}`);
        setDuplicateDecisionLog((prev) => [...prev, ...resolved.log]);
        console.info("[duplicate-check]", ["ssn-warn", ...resolved.log].join(" | "));
        return { blocked: false, warning: true };
      }

      setSsnCheckState("clear");
      setSsnDupIsAddable(true);
      setSsnDupMatch(null);
      setShowSsnDupDetails(false);
      setSsnCheckMessage("No blocked SSN conflict found.");
      return { blocked: false, warning: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to validate SSN.";
      setSsnCheckState("error");
      setSsnCheckMessage(message);
      setSsnDupMatch(null);
      setSsnDupIsAddable(true);
      setShowSsnDupDetails(false);
      return { blocked: false, warning: false };
    }
  };

  const openUnderwritingModal = () => {
    setUnderwritingData({
      tobaccoLast12Months: formData.tobaccoUse.toLowerCase().includes("yes")
        ? "yes"
        : formData.tobaccoUse.toLowerCase().includes("no")
          ? "no"
          : "",
      height: formData.height,
      weight: formData.weight,
      carrier: formData.carrier,
      productLevel: formData.productType,
      coverageAmount: formData.coverageAmount,
      monthlyPremium: formData.monthlyPremium,
    });
    setUnderwritingHealthTags(mergeUniqueTags([], toTagParts(formData.healthConditions || "")));
    setUnderwritingMedicationTags(mergeUniqueTags([], toTagParts(formData.medications || "")));
    setUnderwritingHealthInput("");
    setUnderwritingMedicationInput("");
    setShowUnderwritingModal(true);
  };

  const saveUnderwritingToForm = () => {
    const normalizedHealthConditions = mergeUniqueTags(underwritingHealthTags, toTagParts(underwritingHealthInput));
    const normalizedMedications = mergeUniqueTags(underwritingMedicationTags, toTagParts(underwritingMedicationInput));
    setFormData((prev) => ({
      ...prev,
      tobaccoUse: underwritingData.tobaccoLast12Months
        ? underwritingData.tobaccoLast12Months === "yes"
          ? "Yes"
          : "No"
        : prev.tobaccoUse,
      healthConditions: normalizedHealthConditions.join(", "),
      medications: normalizedMedications.join(", "),
      height: underwritingData.height,
      weight: underwritingData.weight,
      carrier: underwritingData.carrier,
      productType: underwritingData.productLevel,
      coverageAmount: underwritingData.coverageAmount.replace(/\$/g, "").replace(/,/g, ""),
      monthlyPremium: underwritingData.monthlyPremium.replace(/\$/g, "").replace(/,/g, ""),
    }));
    setShowUnderwritingModal(false);
  };

  const canAccessTab = (tab: TabType) => {
    if (tab === "Lead Information") return true;
    return phoneGatePassed;
  };

  const scrollToSection = (tab: TabType) => {
    if (!canAccessTab(tab)) return;
    const sectionId = tabSections[tab];
    const element = document.getElementById(sectionId);
    if (element && contentRef.current) {
      const containerTop = contentRef.current.getBoundingClientRect().top;
      const elementTop = element.getBoundingClientRect().top;
      const scrollOffset = elementTop - containerTop + contentRef.current.scrollTop - 24;
      contentRef.current.scrollTo({
        top: scrollOffset,
        behavior: "smooth"
      });
    }
    setActiveTab(tab);
  };

  const handleNext = () => {
    const idx = tabs.indexOf(activeTab);
    if (idx < tabs.length - 1) {
      const nextTab = tabs[idx + 1];
      scrollToSection(nextTab);
    }
  };

  const handleBack = () => {
    const idx = tabs.indexOf(activeTab);
    if (idx > 0) {
      const prevTab = tabs[idx - 1];
      scrollToSection(prevTab);
    }
  };

  // Track scroll position to update active tab
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleScroll = () => {
      // If phone gate not passed, always stay on Lead Information
      if (!phoneGatePassed) {
        if (activeTab !== "Lead Information") {
          setActiveTab("Lead Information");
        }
        return;
      }

      // Find which section is most visible in the viewport
      const containerRect = container.getBoundingClientRect();
      const viewportCenter = container.scrollTop + (containerRect.height / 3);
      
      let closestTab: TabType | null = null;
      let closestDistance = Infinity;
      
      for (const tab of tabs) {
        const element = document.getElementById(tabSections[tab]);
        if (element) {
          const elementTop = element.offsetTop;
          const elementCenter = elementTop + (element.offsetHeight / 2);
          const distance = Math.abs(viewportCenter - elementCenter);
          
          if (distance < closestDistance) {
            closestDistance = distance;
            closestTab = tab;
          }
        }
      }
      
      if (closestTab && closestTab !== activeTab) {
        setActiveTab(closestTab);
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, tabs, phoneGatePassed]);

  // Reset to Lead Information tab when phone gate is not passed
  useEffect(() => {
    if (!phoneGatePassed && activeTab !== "Lead Information") {
      setActiveTab("Lead Information");
      // Scroll back to top
      if (contentRef.current) {
        contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [phoneGatePassed, activeTab]);

  return (
    <div style={{ fontFamily: T.font, minHeight: "100vh", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 24, gap: 16 }}>
        <button
          onClick={requestLeave}
          style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 10, width: 40, height: 40, cursor: "pointer", color: T.textMid, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: T.textDark, fontWeight: 800 }}>{displayBpoName} Application</h1>
          <p style={{ margin: "4px 0 0", color: T.textMuted, fontWeight: 600, fontSize: 13 }}>All information needed to track sales for Live Transfers</p>
          <p style={{ margin: "8px 0 0", color: T.textMid, fontWeight: 700, fontSize: 13 }}>
            Center DID (transfer line):{" "}
            {displayCenterDid ? (
              <span style={{ fontFamily: "ui-monospace, monospace", color: "#233217" }}>{displayCenterDid}</span>
            ) : (
              <span style={{ color: T.textMuted, fontWeight: 600 }}>Not configured — ask your admin to set the direct line in BPO Centers.</span>
            )}
          </p>
        </div>
      </div>

      {/* Main Content Card with Tabs */}
      <div style={{ backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.02)", border: `1.5px solid ${T.border}`, flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Tabs - Styled like UserEditorComponent */}
        <div style={{ display: "flex", gap: 4, padding: "8px 16px", borderBottom: `1px solid ${T.borderLight}`, flexWrap: "wrap" }}>
          {tabs.map(tab => {
            const isAccessible = canAccessTab(tab);
            return (
              <button
                key={tab}
                onClick={() => scrollToSection(tab)}
                disabled={!isAccessible}
                style={{
                  padding: "10px 16px",
                  border: "none",
                  borderRadius: 8,
                  backgroundColor: activeTab === tab ? "#233217" : "transparent",
                  cursor: isAccessible ? "pointer" : "not-allowed",
                  fontSize: 12,
                  fontWeight: activeTab === tab ? 700 : 600,
                  color: activeTab === tab ? "#fff" : (isAccessible ? T.textMuted : "#a0a0a0"),
                  transition: "all 0.15s ease-in-out",
                  whiteSpace: "nowrap",
                  opacity: isAccessible ? 1 : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab && isAccessible) {
                    e.currentTarget.style.backgroundColor = "#EEF5EE";
                    e.currentTarget.style.color = "#233217";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = isAccessible ? T.textMuted : "#a0a0a0";
                    e.currentTarget.style.transform = "scale(1)";
                  }
                }}
                onMouseDown={(e) => {
                  if (activeTab !== tab && isAccessible) {
                    e.currentTarget.style.transform = "scale(0.97)";
                  }
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = activeTab === tab ? "scale(1)" : "scale(1)";
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <div ref={contentRef} style={{ padding: 24, flex: 1 }}>
          {/* Section: Lead Information */}
          <div id="section-lead-info" style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 32 }}>
        <Section title="Lead Information" icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/></svg>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Date of Submission" required error={getFieldError("submissionDate")}
              info="Date when this lead/application was submitted."
              fieldKey="submissionDate"
              hoveredFieldInfo={hoveredFieldInfo}
              setHoveredFieldInfo={setHoveredFieldInfo}>
              <input type="date" value={formData.submissionDate} onChange={set("submissionDate")} style={fieldStyleWithError("submissionDate")} />
            </Field>
            <Field label="Phone Number" required error={getFieldError("phone")}
              info="Lead contact phone number for verification calls. Enter 10 digits, or 11 digits if it starts with 1. Check runs DNC/screening (dnc-lookup) then CRM transfer-check; TCPA hits skip transfer-check. Run Check to unlock the full application form."
              fieldKey="phone"
              hoveredFieldInfo={hoveredFieldInfo}
              setHoveredFieldInfo={setHoveredFieldInfo}>
              <div style={{ position: "relative" }}>
                <input
                  placeholder="Enter 10 or 11 digits"
                  value={formData.phone}
                  readOnly={!isEditMode && phoneGatePassed}
                  onChange={(e) => {
                    set("phone")(e);
                    if (!isEditMode) setPhoneGatePassed(false);
                    setDncStatus("idle");
                    setDncMessage("");
                    setShowDncModal(false);
                    setTransferCheckData(null);
                    setTransferCheckError(null);
                    setTransferCheckCompleted(false);
                    setIsCustomerBlocked(false);
                    setBlockReason("");
                    setPhoneDupMatch(null);
                    setPhoneDupCandidates([]);
                    phoneDupCandidatesRef.current = [];
                    setPhoneDupRuleMessage("");
                    setPhoneDupIsAddable(true);
                    setShowPhoneDupDetails(false);
                    setDuplicateDecisionLog([]);
                  }}
                  style={{
                    ...fieldStyle,
                    ...(submitHighlightKeys.has("phone") || phoneError ? { border: `2px solid ${T.danger}` } : {}),
                    ...(!isEditMode && phoneGatePassed ? { backgroundColor: "#f4f7f2", cursor: "not-allowed" } : {}),
                    paddingRight: 120,
                    width: "100%",
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const { status, duplicateBlocksPhone } = await checkDnc();
                    setPhoneGatePassed(
                      (status === "clear" || status === "dnc") && !duplicateBlocksPhone,
                    );
                  }}
                  disabled={dncChecking || phoneDupChecking}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    height: 34,
                    borderRadius: 10,
                    border: "none",
                    padding: "0 14px 0 12px",
                    fontWeight: 700,
                    cursor: dncChecking || phoneDupChecking ? "not-allowed" : "pointer",
                    backgroundColor: dncChecking || phoneDupChecking ? "#c8d4bb" : T.blue,
                    color: "#fff",
                    whiteSpace: "nowrap",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.86.33 1.7.62 2.5a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.58-1.14a2 2 0 0 1 2.11-.45c.8.29 1.64.5 2.5.62A2 2 0 0 1 22 16.92z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {dncChecking || phoneDupChecking ? "Checking..." : "Check"}
                </button>
              </div>
              {!showDncModal && dncStatus !== "idle" && dncMessage && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color:
                      dncStatus === "error" || dncStatus === "tcpa" || dncStatus === "agency_dq"
                        ? T.danger
                        : dncStatus === "dnc"
                          ? "#b45309"
                          : "#166534",
                  }}
                >
                  {dncMessage}
                </div>
              )}
              {!isEditMode && phoneGatePassed && (
                <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: "#166534" }}>
                  Phone number locked after successful check.
                </div>
              )}
            </Field>
          </div>
        </Section>

        {phoneDupMatch && (
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              border: !phoneDupIsAddable ? `2px solid ${T.danger}` : `1px solid ${T.border}`,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: !phoneDupIsAddable ? T.danger : "#ea580c" }}>
                  {phoneDupCandidates.length > 1
                    ? `Multiple leads share this phone (${phoneDupCandidates.length})`
                    : "Phone duplicate found"}
                </h3>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: T.textMuted }}>
                  {phoneDupRuleMessage || "A lead already exists with this phone number."}
                </p>
                {duplicateDecisionLog.length > 0 && (
                  <details style={{ marginTop: 10 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.textMuted }}>
                      Why we showed this message
                    </summary>
                    <ul
                      style={{
                        margin: "8px 0 0",
                        paddingLeft: 18,
                        fontSize: 12,
                        color: T.textMuted,
                        lineHeight: 1.45,
                      }}
                    >
                      {duplicateDecisionLog.map((line, i) => (
                        <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
              <button
                type="button"
                onClick={togglePhoneDupDetails}
                style={{
                  background: "#fff",
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {showPhoneDupDetails ? "Hide Details" : "Show Details"}
              </button>
            </div>
            {showPhoneDupDetails && (
              <div style={{ marginTop: 12, backgroundColor: "#f9fafb", padding: 12, borderRadius: 10, border: "1px solid #c8d4bb" }}>
                {phoneDupCandidates.length > 1 ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {phoneDupCandidates.map((c) => (
                      <li key={c.id} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: T.textDark }}>
                          {(c.first_name || "")} {(c.last_name || "")}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 13, color: "#6b7a5f", fontWeight: 700 }}>
                          Stage: {c.stage || "Unknown"}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.textDark }}>
                      {(phoneDupMatch.first_name || "")} {(phoneDupMatch.last_name || "")}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13, color: "#6b7a5f", fontWeight: 700 }}>
                      Stage: {phoneDupMatch.stage || "Unknown"}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

            </div>

            {/* Section: Personal Information */}
            {phoneGatePassed && (
            <div id="section-personal-info" style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 32 }}>
              <Section title="Personal Information" icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label="First Name" required error={getFieldError("firstName")}
                  info="First name as it appears on the lead ID."
                  fieldKey="firstName"
                  hoveredFieldInfo={hoveredFieldInfo}
                  setHoveredFieldInfo={setHoveredFieldInfo}>
                  <input value={formData.firstName} onChange={set("firstName")} style={fieldStyleWithError("firstName")} />
                </Field>
                <Field label="Last Name" required error={getFieldError("lastName")}
                  info="Last name as it appears on the lead ID."
                  fieldKey="lastName"
                  hoveredFieldInfo={hoveredFieldInfo}
                  setHoveredFieldInfo={setHoveredFieldInfo}>
                  <input value={formData.lastName} onChange={set("lastName")} style={fieldStyleWithError("lastName")} />
                </Field>
                <Field label="Date of Birth" required error={getFieldError("dateOfBirth")}
                  info="Date of birth in MM/DD/YYYY format."
                  fieldKey="dateOfBirth"
                  hoveredFieldInfo={hoveredFieldInfo}
                  setHoveredFieldInfo={setHoveredFieldInfo}>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => {
                      const nextDob = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        dateOfBirth: nextDob,
                        age: calculateAgeFromDob(nextDob),
                      }));
                    }}
                    style={fieldStyleWithError("dateOfBirth")}
                  />
                </Field>
                <Field label="Age" required error={getFieldError("age")}
                  info="Current age at time of application."
                  fieldKey="age"
                  hoveredFieldInfo={hoveredFieldInfo}
                  setHoveredFieldInfo={setHoveredFieldInfo}>
                  <input value={formData.age} onChange={set("age")} style={fieldStyleWithError("age")} />
                </Field>
                <Field label="Social Security Number" required error={getFieldError("social")}
                  info="9-digit Social Security Number for identity verification."
                  fieldKey="social"
                  hoveredFieldInfo={hoveredFieldInfo}
                  setHoveredFieldInfo={setHoveredFieldInfo}>
                  <input
                    value={formData.social}
                    onChange={(e) => {
                      set("social")(e);
                      setLastCheckedSsn("");
                      const nextDigits = normalizeSsnDigits(e.target.value || "");
                      if (nextDigits.length < 9 && lastAutoCheckedSsn) {
                        setLastAutoCheckedSsn("");
                      }
                      if (!isEditMode && nextDigits.length === 9 && nextDigits !== lastAutoCheckedSsn) {
                        setLastAutoCheckedSsn(nextDigits);
                        void checkSsnRules(e.target.value);
                      }
                      if (ssnCheckState !== "idle") {
                        setSsnCheckState("idle");
                        setSsnCheckMessage("");
                      }
                      setSsnDupMatch(null);
                      setSsnDupIsAddable(true);
                      setShowSsnDupDetails(false);
                    }}
                    onBlur={(e) => {
                      if (!isEditMode) void checkSsnRules(e.target.value);
                    }}
                    placeholder="XXX-XX-XXXX"
                    style={{
                      ...fieldStyleWithError("social"),
                      ...(ssnError ? { border: `2px solid ${T.danger}` } : {}),
                    }}
                  />
                  <div style={{ fontSize: 11, color: ssnError ? T.danger : T.textMuted, marginTop: 4 }}>
                    {ssnError ? "SSN must be exactly 9 digits." : "Enter a valid 9-digit SSN."}
                  </div>
                  {ssnCheckState !== "idle" && (
                    <div
                      style={{
                        fontSize: 11,
                        marginTop: 6,
                        fontWeight: 700,
                        color:
                          ssnCheckState === "blocked"
                            ? T.danger
                            : ssnCheckState === "warning"
                              ? "#b45309"
                              : ssnCheckState === "error"
                                ? T.danger
                                : ssnCheckState === "checking"
                                  ? T.textMuted
                                  : "#166534",
                      }}
                    >
                      {ssnCheckMessage}
                    </div>
                  )}
                </Field>
                <Field label="Driver License Number" required error={getFieldError("driverLicenseNumber")}
                  info="State-issued driver license number for identity verification."
                  fieldKey="driverLicenseNumber"
                  hoveredFieldInfo={hoveredFieldInfo}
                  setHoveredFieldInfo={setHoveredFieldInfo}>
                  <input value={formData.driverLicenseNumber} onChange={set("driverLicenseNumber")} style={fieldStyleWithError("driverLicenseNumber")} />
                </Field>
                <Field label="Language" required error={getFieldError("language")}
                  info="Select the primary language for communication with this lead."
                  fieldKey="language"
                  hoveredFieldInfo={hoveredFieldInfo}
                  setHoveredFieldInfo={setHoveredFieldInfo}>
                  <StyledSelect
                    value={formData.language}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, language: val }))}
                    options={[
                      { value: "English", label: "English" },
                      { value: "Spanish", label: "Spanish" },
                    ]}
                    placeholder="Select language"
                    error={submitHighlightKeys.has("language")}
                  />
                </Field>
                <Field
                  label="SMS Access Permission"
                  info="Ask the customer if they allow us to send SMS updates."
                  fieldKey="smsAccess"
                  hoveredFieldInfo={hoveredFieldInfo}
                  setHoveredFieldInfo={setHoveredFieldInfo}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 42, padding: "0 4px", color: T.textDark, fontSize: 14, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={formData.smsAccess}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, smsAccess: e.target.checked }));
                      }}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                    Does customer has access to receive SMS
                  </label>
                </Field>
                <Field
                  label="Email Access Permission"
                  info="Ask the customer if they allow us to send email updates."
                  fieldKey="emailAccess"
                  hoveredFieldInfo={hoveredFieldInfo}
                  setHoveredFieldInfo={setHoveredFieldInfo}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 42, padding: "0 4px", color: T.textDark, fontSize: 14, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={formData.emailAccess}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, emailAccess: e.target.checked }));
                      }}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                    Does customer has access to receive the Email
                  </label>
                </Field>
              </div>
              {ssnDupMatch && (
                <div
                  style={{
                    marginTop: 12,
                    backgroundColor: "#fff",
                    borderRadius: 12,
                    border: !ssnDupIsAddable ? `2px solid ${T.danger}` : `1px solid ${T.border}`,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: !ssnDupIsAddable ? T.danger : "#ea580c" }}>
                        🪪 SSN Duplicate Found
                      </h3>
                      <p style={{ margin: "6px 0 0", fontSize: 13, color: T.textMuted }}>
                        {ssnCheckMessage || "A lead already exists with this SSN."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSsnDupDetails((prev) => !prev)}
                      style={{
                        background: "#fff",
                        border: `1px solid ${T.border}`,
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {showSsnDupDetails ? "Hide Details" : "Show Details"}
                    </button>
                  </div>
                  {showSsnDupDetails && (
                    <div style={{ marginTop: 12, backgroundColor: "#f9fafb", padding: 12, borderRadius: 10, border: "1px solid #c8d4bb" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: T.textDark }}>
                        {(ssnDupMatch.first_name || "")} {(ssnDupMatch.last_name || "")}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 13, color: "#6b7a5f", fontWeight: 700 }}>
                        Stage: {ssnDupMatch.stage || "Unknown"}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Section>
            </div>
            )}

            {/* Section: Contact & Address */}
            {phoneGatePassed && (
            <div id="section-contact-address" style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 32 }}>
              <Section title="Contact & Address" icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              }>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Field label="Street Address" required full error={getFieldError("street1")}
                    info="Primary street address for mailing and underwriting purposes."
                    fieldKey="street1" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    <input placeholder="Street Address" value={formData.street1} onChange={set("street1")} style={fieldStyleWithError("street1")} />
                  </Field>
                  <Field label="Address Line 2" full
                    info="Apartment, suite, or unit number (optional)."
                    fieldKey="street2" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    <input placeholder="Apt, Suite, Unit (optional)" value={formData.street2} onChange={set("street2")} style={fieldStyle} />
                  </Field>
                  <Field label="City" required error={getFieldError("city")}
                    info="City of the primary residence."
                    fieldKey="city" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    <input value={formData.city} onChange={set("city")} style={fieldStyleWithError("city")} />
                  </Field>
                  <Field label="State" required error={getFieldError("state")}
                    info="State of the primary residence."
                    fieldKey="state" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    <StyledSelect
                      value={formData.state}
                      onValueChange={(val) => setFormData((prev) => ({ ...prev, state: val }))}
                      options={usStates.map((s) => ({ value: s, label: s }))}
                      placeholder="Please Select"
                      error={submitHighlightKeys.has("state")}
                    />
                  </Field>
                  <Field label="Zip Code" required error={getFieldError("zipCode")}
                    info="5-digit ZIP code of the primary residence."
                    fieldKey="zipCode" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    <input value={formData.zipCode} onChange={set("zipCode")} style={fieldStyleWithError("zipCode")} />
                  </Field>
                  <Field label="Birth State" required error={getFieldError("birthState")}
                    info="State where the lead was born (required for underwriting)."
                    fieldKey="birthState" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    <StyledSelect
                      value={formData.birthState}
                      onValueChange={(val) => setFormData((prev) => ({ ...prev, birthState: val }))}
                      options={usStates.map((s) => ({ value: s, label: s }))}
                      placeholder="Please Select"
                      error={submitHighlightKeys.has("birthState")}
                    />
                  </Field>
                </div>
              </Section>
            </div>
            )}

            {/* Section: Health Information */}
            {phoneGatePassed && (
            <div id="section-health-info" style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 32 }}>
            <Section
              title="Health Information"
              action={(
                <button
                  type="button"
                  onClick={openUnderwritingModal}
                  style={{
                    backgroundColor: "#4e6e3a",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Open Underwriting Form
                </button>
              )}
              icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              }
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label="Any existing / previous coverage in last 2 years?" required error={getFieldError("existingCoverageLast2Years")}
                  info="Indicates if the lead has had any life insurance coverage in the past 2 years."
                  fieldKey="existingCoverageLast2Years" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                  <YesNo value={formData.existingCoverageLast2Years} onChange={(v) => setFormData((p) => ({ ...p, existingCoverageLast2Years: v, existingCoverageDetails: v === "Yes" ? p.existingCoverageDetails : "" }))} hasError={submitHighlightKeys.has("existingCoverageLast2Years")} />
                </Field>
                {formData.existingCoverageLast2Years === "Yes" && (
                  <Field label="Existing Coverage Details"
                    info="Details about any existing or previous life insurance coverage."
                    fieldKey="existingCoverageDetails" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    <textarea value={formData.existingCoverageDetails} onChange={set("existingCoverageDetails")} style={{ ...fieldStyle, minHeight: 80, resize: "vertical" }} placeholder="Describe the existing coverage details..." />
                  </Field>
                )}
                <Field label="Any previous applications in 2 years?" required error={getFieldError("previousApplications2Years")}
                  info="Indicates if the lead has applied for life insurance in the past 2 years."
                  fieldKey="previousApplications2Years" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                  <YesNo value={formData.previousApplications2Years} onChange={(v) => setFormData((p) => ({ ...p, previousApplications2Years: v }))} hasError={submitHighlightKeys.has("previousApplications2Years")} />
                </Field>
                <Field label="Height" required error={getFieldError("height")}
                  info="Lead height in feet and inches (e.g., 5 ft 10 in)."
                  fieldKey="height" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                  <input placeholder='e.g. 5&apos;10"' value={formData.height} onChange={set("height")} style={fieldStyleWithError("height")} />
                </Field>
                <Field label="Weight" required error={getFieldError("weight")}
                  info="Lead current weight in pounds."
                  fieldKey="weight" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                  <input placeholder="e.g. 175 lbs" value={formData.weight} onChange={set("weight")} style={fieldStyleWithError("weight")} />
                </Field>
                <Field label="Doctor's Name" required error={getFieldError("doctorName")}
                  info="Primary care physician full name for medical history verification."
                  fieldKey="doctorName" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                  <input value={formData.doctorName} onChange={set("doctorName")} style={fieldStyleWithError("doctorName")} />
                </Field>
                <Field label="Tobacco Use" required error={getFieldError("tobaccoUse")}
                  info="Indicates if the lead currently uses tobacco or nicotine products."
                  fieldKey="tobaccoUse" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                  <YesNo value={formData.tobaccoUse} onChange={(v) => setFormData((p) => ({ ...p, tobaccoUse: v }))} hasError={submitHighlightKeys.has("tobaccoUse")} />
                </Field>
                <div
                  style={{
                    gridColumn: "span 2",
                    border: `1px solid ${T.border}`,
                    borderRadius: 12,
                    padding: 16,
                    backgroundColor: "#f9fafb",
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                  }}
                >
                  <TransferTagListBlock
                    label="Health Conditions"
                    required
                    info="Any existing medical conditions that may affect underwriting."
                    fieldKey="healthConditions"
                    error={getFieldError("healthConditions")}
                    tags={mergeUniqueTags([], toTagParts(formData.healthConditions))}
                    onRemoveTag={(index) => {
                      setFormData((prev) => {
                        const tags = mergeUniqueTags([], toTagParts(prev.healthConditions));
                        const next = tags.filter((_, j) => j !== index);
                        return { ...prev, healthConditions: next.join(", ") };
                      });
                    }}
                    draftValue={healthConditionsTagInput}
                    onDraftChange={setHealthConditionsTagInput}
                    onCommitDraft={() => {
                      const parts = toTagParts(healthConditionsTagInput);
                      if (!parts.length) return;
                      setFormData((prev) => ({
                        ...prev,
                        healthConditions: mergeUniqueTags(mergeUniqueTags([], toTagParts(prev.healthConditions)), parts).join(
                          ", ",
                        ),
                      }));
                      setHealthConditionsTagInput("");
                    }}
                    placeholder="Type and press Enter to add conditions..."
                    helperText="Click on conditions above to add them, or type custom conditions."
                    setHoveredFieldInfo={setHoveredFieldInfo}
                    inputStyle={{ ...fieldStyleWithError("healthConditions"), width: "100%", fontSize: 14, minHeight: 44 }}
                  />
                  <TransferTagListBlock
                    label="Medications"
                    required
                    info="List of current medications the lead is taking."
                    fieldKey="medications"
                    error={getFieldError("medications")}
                    tags={mergeUniqueTags([], toTagParts(formData.medications))}
                    onRemoveTag={(index) => {
                      setFormData((prev) => {
                        const tags = mergeUniqueTags([], toTagParts(prev.medications));
                        const next = tags.filter((_, j) => j !== index);
                        return { ...prev, medications: next.join(", ") };
                      });
                    }}
                    draftValue={medicationsTagInput}
                    onDraftChange={setMedicationsTagInput}
                    onCommitDraft={() => {
                      const parts = toTagParts(medicationsTagInput);
                      if (!parts.length) return;
                      setFormData((prev) => ({
                        ...prev,
                        medications: mergeUniqueTags(mergeUniqueTags([], toTagParts(prev.medications)), parts).join(", "),
                      }));
                      setMedicationsTagInput("");
                    }}
                    placeholder="Type and press Enter to add medications..."
                    setHoveredFieldInfo={setHoveredFieldInfo}
                    inputStyle={{ ...fieldStyleWithError("medications"), width: "100%", fontSize: 14, minHeight: 44 }}
                  />
                </div>
              </div>
            </Section>
            </div>
            )}

            {/* Section: Policy Details */}
            {phoneGatePassed && (
            <div id="section-policy-details" style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 32 }}>
              <Section title="Policy Details" icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              }>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Field label="Monthly Premium" required error={getFieldError("monthlyPremium")}
                    info="The monthly premium amount for the selected policy."
                    fieldKey="monthlyPremium" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 600, color: T.textMuted }}>$</span>
                      <input value={formData.monthlyPremium} onChange={set("monthlyPremium")} style={fieldStyleWithError("monthlyPremium", { paddingLeft: 28 })} />
                    </div>
                  </Field>
                  <Field label="Coverage Amount" required error={getFieldError("coverageAmount")}
                    info="The death benefit amount of the policy."
                    fieldKey="coverageAmount" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 600, color: T.textMuted }}>$</span>
                      <input value={formData.coverageAmount} onChange={set("coverageAmount")} style={fieldStyleWithError("coverageAmount", { paddingLeft: 28 })} />
                    </div>
                  </Field>
                  <Field label="Carrier" required error={getFieldError("carrier")}
                    info="The insurance company providing the policy."
                    fieldKey="carrier" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    <StyledSelect
                      value={formData.carrier}
                      onValueChange={(val) => setFormData((prev) => ({ ...prev, carrier: val, productType: "" }))}
                      options={carriers.map((c) => ({ value: c.name, label: c.name }))}
                      placeholder="Please Select"
                      error={submitHighlightKeys.has("carrier")}
                    />
                  </Field>
                  <Field label="Product Type" required error={getFieldError("productType")}
                    info="The specific type of policy product selected."
                    fieldKey="productType" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    {!formData.carrier.trim() ? (
                      <div style={{ ...fieldStyle, color: T.textMuted, display: "flex", alignItems: "center" }}>
                        Select carrier first
                      </div>
                    ) : policyCarrierProductsLoading ? (
                      <div style={{ ...fieldStyle, color: T.textMuted, display: "flex", alignItems: "center" }}>
                        Loading products...
                      </div>
                    ) : productsForCarrier.length === 0 ? (
                      <div style={{ ...fieldStyle, color: T.textMuted, display: "flex", alignItems: "center" }}>
                        No products available for this carrier
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {productsForCarrier.map((product) => (
                          <label
                            key={product.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 14px",
                              borderRadius: 8,
                              border: `1.5px solid ${formData.productType === product.name ? "#233217" : T.border}`,
                              backgroundColor: formData.productType === product.name ? "#EEF5EE" : "#fff",
                              cursor: "pointer",
                              transition: "all 0.15s ease-in-out",
                            }}
                          >
                            <input
                              type="radio"
                              name="productType"
                              value={product.name}
                              checked={formData.productType === product.name}
                              onChange={() => setFormData((prev) => ({ ...prev, productType: product.name }))}
                              style={{ width: 18, height: 18, cursor: "pointer" }}
                            />
                            <span style={{ fontSize: 14, fontWeight: 600, color: T.textDark }}>
                              {product.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </Field>
                <Field
                  label="Add backup quote?"
                  info="Optional second carrier/product quote (premium and face amount)."
                  fieldKey="includeBackupQuote"
                  hoveredFieldInfo={hoveredFieldInfo}
                  setHoveredFieldInfo={setHoveredFieldInfo}
                >
                  <YesNo
                    value={formData.includeBackupQuote ? "Yes" : "No"}
                    onChange={(v) =>
                      setFormData((p) =>
                        v === "Yes"
                          ? { ...p, includeBackupQuote: true }
                          : {
                              ...p,
                              includeBackupQuote: false,
                              backupCarrier: "",
                              backupProductType: "",
                              backupMonthlyPremium: "",
                              backupCoverageAmount: "",
                            },
                      )
                    }
                    hasError={false}
                  />
                </Field>
                {formData.includeBackupQuote && (
                  <>
                    <Field
                      label="Backup carrier"
                      required
                      error={getFieldError("backupCarrier")}
                      info="Select the backup quote carrier first, then product."
                      fieldKey="backupCarrier"
                      hoveredFieldInfo={hoveredFieldInfo}
                      setHoveredFieldInfo={setHoveredFieldInfo}
                    >
                      <StyledSelect
                        value={formData.backupCarrier}
                        onValueChange={(val) =>
                          setFormData((prev) => ({ ...prev, backupCarrier: val, backupProductType: "" }))
                        }
                        options={carriers.map((c) => ({ value: c.name, label: c.name }))}
                        placeholder="Please select"
                        error={submitHighlightKeys.has("backupCarrier")}
                      />
                    </Field>
                    <Field
                      label="Backup product type"
                      required
                      error={getFieldError("backupProductType")}
                      info="Product for the backup quote."
                      fieldKey="backupProductType"
                      hoveredFieldInfo={hoveredFieldInfo}
                      setHoveredFieldInfo={setHoveredFieldInfo}
                    >
                      {!formData.backupCarrier.trim() ? (
                        <div style={{ ...fieldStyle, color: T.textMuted, display: "flex", alignItems: "center" }}>
                          Select backup carrier first
                        </div>
                      ) : backupCarrierProductsLoading ? (
                        <div style={{ ...fieldStyle, color: T.textMuted, display: "flex", alignItems: "center" }}>
                          Loading products...
                        </div>
                      ) : backupProductsForCarrier.length === 0 ? (
                        <div style={{ ...fieldStyle, color: T.textMuted, display: "flex", alignItems: "center" }}>
                          No products available for this carrier
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {backupProductsForCarrier.map((product) => (
                            <label
                              key={product.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 14px",
                                borderRadius: 8,
                                border: `1.5px solid ${formData.backupProductType === product.name ? "#233217" : T.border}`,
                                backgroundColor: formData.backupProductType === product.name ? "#EEF5EE" : "#fff",
                                cursor: "pointer",
                                transition: "all 0.15s ease-in-out",
                              }}
                            >
                              <input
                                type="radio"
                                name="backupProductType"
                                value={product.name}
                                checked={formData.backupProductType === product.name}
                                onChange={() =>
                                  setFormData((prev) => ({ ...prev, backupProductType: product.name }))
                                }
                                style={{ width: 18, height: 18, cursor: "pointer" }}
                              />
                              <span style={{ fontSize: 14, fontWeight: 600, color: T.textDark }}>{product.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </Field>
                    <Field
                      label="Backup monthly premium"
                      required
                      error={getFieldError("backupMonthlyPremium")}
                      info="Monthly premium for the backup quote."
                      fieldKey="backupMonthlyPremium"
                      hoveredFieldInfo={hoveredFieldInfo}
                      setHoveredFieldInfo={setHoveredFieldInfo}
                    >
                      <div style={{ position: "relative" }}>
                        <span
                          style={{
                            position: "absolute",
                            left: 14,
                            top: "50%",
                            transform: "translateY(-50%)",
                            fontSize: 14,
                            fontWeight: 600,
                            color: T.textMuted,
                          }}
                        >
                          $
                        </span>
                        <input
                          value={formData.backupMonthlyPremium}
                          onChange={set("backupMonthlyPremium")}
                          style={fieldStyleWithError("backupMonthlyPremium", { paddingLeft: 28 })}
                        />
                      </div>
                    </Field>
                    <Field
                      label="Backup coverage amount"
                      required
                      error={getFieldError("backupCoverageAmount")}
                      info="Face / coverage amount for the backup quote."
                      fieldKey="backupCoverageAmount"
                      hoveredFieldInfo={hoveredFieldInfo}
                      setHoveredFieldInfo={setHoveredFieldInfo}
                    >
                      <div style={{ position: "relative" }}>
                        <span
                          style={{
                            position: "absolute",
                            left: 14,
                            top: "50%",
                            transform: "translateY(-50%)",
                            fontSize: 14,
                            fontWeight: 600,
                            color: T.textMuted,
                          }}
                        >
                          $
                        </span>
                        <input
                          value={formData.backupCoverageAmount}
                          onChange={set("backupCoverageAmount")}
                          style={fieldStyleWithError("backupCoverageAmount", { paddingLeft: 28 })}
                        />
                      </div>
                    </Field>
                  </>
                )}
                <Field label="Draft Date" required error={getFieldError("draftDate")}
                  info="The date the first premium draft will occur."
                  fieldKey="draftDate" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                  <input type="date" value={formData.draftDate} onChange={set("draftDate")} style={fieldStyleWithError("draftDate")} />
                </Field>
                <Field label="Future Draft Date" required error={getFieldError("futureDraftDate")}
                  info="Scheduled date for a future premium draft if applicable."
                  fieldKey="futureDraftDate" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                  <input type="date" value={formData.futureDraftDate} onChange={set("futureDraftDate")} style={fieldStyleWithError("futureDraftDate")} />
                </Field>
                <Field label="Beneficiary Information" required full error={getFieldError("beneficiaryInformation")}
                  info="Designated person(s) who will receive the policy benefit."
                  fieldKey="beneficiaryInformation" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                  <textarea value={formData.beneficiaryInformation} onChange={set("beneficiaryInformation")} style={{ ...fieldStyleWithError("beneficiaryInformation"), minHeight: 72, resize: "vertical" }} />
                </Field>
              </div>
            </Section>
            </div>
            )}

            {/* Section: Banking Information */}
            {phoneGatePassed && (
            <div id="section-banking-info" style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 32 }}>
              <Section title="Banking Information" icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
              }>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Field label="Bank Account Type"
                    info="Type of bank account for ACH premium drafts."
                    fieldKey="bankAccountType" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    <StyledSelect
                      value={formData.bankAccountType}
                      onValueChange={(val) => setFormData((prev) => ({ ...prev, bankAccountType: val }))}
                      options={[
                        { value: "Checking", label: "Checking" },
                        { value: "Savings", label: "Savings" },
                      ]}
                      placeholder="Please Select"
                    />
                  </Field>
                  <Field label="Institution Name" required error={getFieldError("institutionName")}
                    info="Name of the bank where the account is held."
                    fieldKey="institutionName" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    <input value={formData.institutionName} onChange={set("institutionName")} style={fieldStyleWithError("institutionName")} />
                  </Field>
                  <Field label="Routing Number" required error={getFieldError("routingNumber")}
                    info="9-digit ABA routing number for the bank."
                    fieldKey="routingNumber" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    <input value={formData.routingNumber} onChange={set("routingNumber")} style={fieldStyleWithError("routingNumber")} />
                  </Field>
                  <Field label="Account Number" required error={getFieldError("accountNumber")}
                    info="Bank account number for ACH transactions."
                    fieldKey="accountNumber" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    <input value={formData.accountNumber} onChange={set("accountNumber")} style={fieldStyleWithError("accountNumber")} />
                  </Field>
                </div>
              </Section>
            </div>
            )}

            {/* Section: Additional Information */}
            {phoneGatePassed && (
            <div id="section-additional-info" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Section title="Additional Information" icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              }>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Field label="Additional Notes" full
                    info="Any supplemental details about the lead or application."
                    fieldKey="additionalInformation" hoveredFieldInfo={hoveredFieldInfo} setHoveredFieldInfo={setHoveredFieldInfo}>
                    <textarea value={formData.additionalInformation} onChange={set("additionalInformation")} style={{ ...fieldStyle, minHeight: 96, resize: "vertical" }} />
                  </Field>
                </div>
              </Section>
            </div>
            )}
        </div>
      </div>

      {showUnderwritingModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "98vw", maxWidth: "98vw", height: "96vh", maxHeight: "96vh", overflowY: "auto", backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${T.border}`, padding: 20 }}>
            <h2 style={{ margin: 0, fontSize: 30, color: "#4e6e3a", fontWeight: 800 }}>Underwriting</h2>
            <p style={{ margin: "8px 0 0", fontSize: 16, color: T.textMuted, fontWeight: 600 }}>
              Please read the following script to the customer and verify all information.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 24, marginTop: 18, alignItems: "stretch" }}>
              <div style={{ backgroundColor: "#f9fafb", padding: 16, borderRadius: 12, border: `1px solid ${T.border}`, height: "100%", overflowY: "auto" }}>
                <h4 style={{ marginTop: 0, marginBottom: 12, fontSize: 30, fontWeight: 800 }}>Underwriting Questions</h4>
                <div style={{ fontSize: 24 }}>
                  <p style={{ fontWeight: 600, marginTop: 0 }}>
                    "I am going to ask you some medical questions and we expect your honesty that is going to save us a lot of time. And, this will help us evaluate which insurance carrier comes back with the maximum benefit at the lowest rates for you."
                  </p>
                  <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <p style={{ marginTop: 0, fontWeight: 800, fontSize: 24 }}>Question 1:</p>
                    <p style={{ fontSize: 22, marginBottom: 0 }}>Have you ever been diagnosed or treated for Alzheimer's Dementia, Congestive heart failure, organ transplant, HIV, AIDS, ARC, Leukemia, Tuberculosis, chronic Respiratory disease, currently paralyzed, amputation due to a disease? Are you currently hospitalized in a nursing facility? Due to a disease are you currently confined to a wheelchair? Are you currently on oxygen?</p>
                  </div>
                  <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <p style={{ marginTop: 0, fontWeight: 800, fontSize: 24 }}>Question 2:</p>
                    <p style={{ fontSize: 22, marginBottom: 0 }}>In the last 5 years, have you had any heart attacks, cancers, Alzheimer's, dementia, congestive heart failure, kidney failure or an organ removal? Have you ever had any disorders of the kidney, lung, brain, heart, circulatory system or liver? Or In the last 3 years have you been diagnosed and treated for leukemia, sickle cell anemia, brain disorder, Alzheimer's or dementia, aneurysm, diabetic coma, amputation due to any disease, cirrhosis of the liver, Multiple Sclerosis, chronic respiratory disease, tuberculosis, chronic pneumonia, hepatitis? Or In the last 2 years if you had any stents, pacemaker, defibrillator, valve replacement, stroke, TIA or paralysis?</p>
                  </div>
                  <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
                    <p style={{ marginTop: 0, fontWeight: 800, fontSize: 24 }}>Question 3:</p>
                    <p style={{ fontSize: 22, marginBottom: 0 }}>Or if you have any complications from diabetes? Like (Neuropathy, amputation due to diabetes, retinopathy, diabetic coma, etc) Have you been treated or diagnosed with COPD, Bipolar, or schizophrenia?</p>
                  </div>
                  <div style={{ marginTop: 16, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 12 }}>
                    <p style={{ marginTop: 0, marginBottom: 8, fontWeight: 800, fontSize: 24 }}>Tobacco Usage:</p>
                    <p style={{ fontSize: 22 }}>Have you consumed any tobacco or nicotine products in the last 12 months?</p>
                    <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 24 }}>
                        <input
                          type="radio"
                          name="tobacco"
                          checked={underwritingData.tobaccoLast12Months === "yes"}
                          onChange={() => setUnderwritingData({ ...underwritingData, tobaccoLast12Months: "yes" })}
                        />
                        Yes
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 24 }}>
                        <input
                          type="radio"
                          name="tobacco"
                          checked={underwritingData.tobaccoLast12Months === "no"}
                          onChange={() => setUnderwritingData({ ...underwritingData, tobaccoLast12Months: "no" })}
                        />
                        No
                      </label>
                    </div>
                  </div>
                  <p style={{ fontWeight: 600, fontSize: 24, marginTop: 16 }}>
                    Lastly, do you have any health conditions or take any prescribed medication on a regular basis?
                  </p>
                  <div style={{ padding: 16, background: "#fff", borderRadius: 10, border: `1px solid ${T.border}` }}>
                    <p style={{ marginTop: 0, marginBottom: 8, fontWeight: 800, fontSize: 24 }}>Follow Up:</p>
                    <ul style={{ margin: 0, paddingLeft: 24, fontSize: 22 }}>
                      <li>How many medications are you taking on a daily basis?</li>
                      <li>Do you know what those medications are for?</li>
                      <li>Do you have your medications, or a list of your medications nearby?</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: "#fff", border: "2px solid #ddd6fe", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ backgroundColor: "#4e6e3a", color: "#fff", padding: "8px 16px", fontWeight: 800, fontSize: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Insurance Toolkit</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      style={{ height: 28, fontSize: 12, padding: "0 10px", borderRadius: 6, border: "none", cursor: "pointer" }}
                      onClick={() => setToolkitUrl("https://insurancetoolkits.com/fex/quoter")}
                    >
                      Quote Tool
                    </button>
                    <button
                      type="button"
                      style={{ height: 28, fontSize: 12, padding: "0 10px", borderRadius: 6, border: "1px solid #fff", color: "#fff", background: "transparent", cursor: "pointer" }}
                      onClick={() => setToolkitUrl("https://insurancetoolkits.com/login")}
                    >
                      Login
                    </button>
                  </div>
                </div>
                <div style={{ border: "2px solid #c4b5fd", borderRadius: 10, overflow: "hidden", background: "#fff", flex: 1, minHeight: 600 }}>
                  <iframe
                    style={{ border: "none", height: "100%", width: "100%" }}
                    src={toolkitUrl}
                    title="Insurance Toolkit"
                    id="healthKitIframe"
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <label style={{ fontSize: 24, fontWeight: 800, display: "block", marginBottom: 8 }}>Health Conditions:</label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 10,
                  minHeight: underwritingHealthTags.length ? undefined : 0,
                }}
              >
                {underwritingHealthTags.map((tag, i) => (
                  <span
                    key={`h-${i}-${tag}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 10px",
                      borderRadius: 8,
                      backgroundColor: "#EEF5EE",
                      border: `1px solid ${T.borderLight}`,
                      fontSize: 15,
                      fontWeight: 600,
                      color: T.textDark,
                      fontFamily: T.font,
                    }}
                  >
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove ${tag}`}
                      onClick={() =>
                        setUnderwritingHealthTags((prev) => prev.filter((_, j) => j !== i))
                      }
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: 0,
                        margin: 0,
                        lineHeight: 1,
                        fontSize: 16,
                        fontWeight: 800,
                        color: T.textMuted,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                value={underwritingHealthInput}
                onChange={(e) => setUnderwritingHealthInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const parts = toTagParts(underwritingHealthInput);
                  if (!parts.length) return;
                  setUnderwritingHealthTags((prev) => mergeUniqueTags(prev, parts));
                  setUnderwritingHealthInput("");
                }}
                placeholder="Type and press Enter to add conditions..."
                style={{ ...fieldStyle, fontSize: 18, height: 48, width: "100%", boxSizing: "border-box" }}
              />
              <p style={{ margin: "8px 0 0", fontSize: 13, color: T.textMuted, fontWeight: 500 }}>
                Click on conditions above to add them, or type custom conditions.
              </p>
            </div>

            <div style={{ marginTop: 16 }}>
              <label
                style={{ fontSize: 24, fontWeight: 800, display: "block", marginBottom: 8, color: "#2563eb" }}
              >
                Medications:
              </label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                {underwritingMedicationTags.map((tag, i) => (
                  <span
                    key={`m-${i}-${tag}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 10px",
                      borderRadius: 8,
                      backgroundColor: "#EEF5EE",
                      border: `1px solid ${T.borderLight}`,
                      fontSize: 15,
                      fontWeight: 600,
                      color: T.textDark,
                      fontFamily: T.font,
                    }}
                  >
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove ${tag}`}
                      onClick={() =>
                        setUnderwritingMedicationTags((prev) => prev.filter((_, j) => j !== i))
                      }
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: 0,
                        margin: 0,
                        lineHeight: 1,
                        fontSize: 16,
                        fontWeight: 800,
                        color: T.textMuted,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                value={underwritingMedicationInput}
                onChange={(e) => setUnderwritingMedicationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const parts = toTagParts(underwritingMedicationInput);
                  if (!parts.length) return;
                  setUnderwritingMedicationTags((prev) => mergeUniqueTags(prev, parts));
                  setUnderwritingMedicationInput("");
                }}
                placeholder="Type and press Enter to add medications..."
                style={{ ...fieldStyle, fontSize: 18, height: 48, width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              <div><label style={{ fontSize: 24, fontWeight: 800, display: "block", marginBottom: 8 }}>Height:</label><input value={underwritingData.height} onChange={(e) => setUnderwritingData({ ...underwritingData, height: e.target.value })} placeholder="e.g., 5 ft 10 in" style={{ ...fieldStyle, fontSize: 24, height: 48 }} /></div>
              <div><label style={{ fontSize: 24, fontWeight: 800, display: "block", marginBottom: 8 }}>Weight:</label><input value={underwritingData.weight} onChange={(e) => setUnderwritingData({ ...underwritingData, weight: e.target.value })} placeholder="e.g., 180 lbs" style={{ ...fieldStyle, fontSize: 24, height: 48 }} /></div>
              <div>
                <label style={{ fontSize: 24, fontWeight: 800, display: "block", marginBottom: 8 }}>Carrier:</label>
                <AppSelect
                  value={underwritingData.carrier}
                  onChange={(e: any) => {
                    const v = e.target.value;
                    setUnderwritingData((prev) => ({ ...prev, carrier: v, productLevel: "" }));
                  }}
                  style={{
                    ...fieldStyle,
                    fontSize: 24,
                    height: 56,
                    lineHeight: "1.2",
                    paddingTop: 8,
                    paddingBottom: 8,
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="">Select carrier</option>
                  {carriers.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </AppSelect>
              </div>
              <div>
                <label style={{ fontSize: 24, fontWeight: 800, display: "block", marginBottom: 8 }}>Product Level:</label>
                <AppSelect
                  value={underwritingData.productLevel}
                  onChange={(e: any) => setUnderwritingData((prev) => ({ ...prev, productLevel: e.target.value }))}
                  disabled={!underwritingData.carrier.trim() || uwCarrierProductsLoading}
                  style={{
                    ...fieldStyle,
                    fontSize: 24,
                    height: 56,
                    lineHeight: "1.2",
                    paddingTop: 8,
                    paddingBottom: 8,
                    width: "100%",
                    boxSizing: "border-box",
                    opacity: !underwritingData.carrier.trim() || uwCarrierProductsLoading ? 0.7 : 1,
                  }}
                >
                  <option value="">
                    {uwCarrierProductsLoading
                      ? "Loading products…"
                      : underwritingData.carrier.trim() && productsForCarrier.length === 0
                        ? "No products for this carrier"
                        : "Select product level"}
                  </option>
                  {uwProductsForCarrier.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </AppSelect>
              </div>
              <div><label style={{ fontSize: 24, fontWeight: 800, display: "block", marginBottom: 8 }}>Coverage Amount:</label><input value={underwritingData.coverageAmount} onChange={(e) => setUnderwritingData({ ...underwritingData, coverageAmount: e.target.value })} placeholder="e.g., $10,000" style={{ ...fieldStyle, fontSize: 24, height: 48 }} /></div>
              <div><label style={{ fontSize: 24, fontWeight: 800, display: "block", marginBottom: 8 }}>Monthly Premium:</label><input value={underwritingData.monthlyPremium} onChange={(e) => setUnderwritingData({ ...underwritingData, monthlyPremium: e.target.value })} placeholder="e.g., $50.00" style={{ ...fieldStyle, fontSize: 24, height: 48 }} /></div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14, color: "#4b5563", textAlign: "center", marginBottom: 8 }}>
                Clicking "Save & Verify All" will save all fields below to the verification panel and mark them as verified.
              </div>
              <div style={{ display: "flex", gap: 8, width: "100%" }}>
                <button type="button" style={{ border: `1px solid ${T.border}`, background: "#fff", borderRadius: 8, fontSize: 18, padding: "10px 24px", flex: 1, cursor: "pointer" }} onClick={() => setShowUnderwritingModal(false)}>
                  Cancel
                </button>
                <button type="button" style={{ border: "none", background: "#16a34a", color: "#fff", borderRadius: 8, fontSize: 18, padding: "10px 24px", flex: 1, cursor: "pointer" }} onClick={saveUnderwritingToForm}>
                  Save & Verify All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDncModal && dncStatus !== "idle" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.35)",
            zIndex: 3800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 760,
              maxHeight: "90vh",
              overflow: "auto",
              backgroundColor: "#fff",
              borderRadius: 20,
              border: dncModalHardStop
                ? `2px solid ${T.danger}`
                : dncModalDncWarn
                  ? "2px solid #f59e0b"
                  : `1.5px solid ${T.border}`,
              boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: `1px solid ${T.borderLight}`,
                backgroundColor: dncModalHardStop ? "#fef2f2" : dncModalDncWarn ? "#fffbeb" : "#fff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: dncModalHardStop
                    ? "#dc2626"
                    : dncStatus === "error"
                      ? "#b45309"
                      : dncModalDncWarn
                        ? "#d97706"
                        : "#233217",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {dncModalHardStop || dncModalDncWarn || dncStatus === "error" ? (
                    <>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </>
                  ) : (
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.86.33 1.7.62 2.5a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.58-1.14a2 2 0 0 1 2.11-.45c.8.29 1.64.5 2.5.62A2 2 0 0 1 22 16.92z" />
                  )}
                </svg>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {dncModalHardStop
                    ? "CRITICAL ALERT"
                    : dncModalDncWarn
                      ? "DNC NOTICE"
                      : dncStatus === "error"
                        ? "CHECK FAILED"
                        : "TRANSFER CHECK"}
                </p>
                <h4
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 800,
                    color: dncModalHardStop
                      ? "#dc2626"
                      : dncModalDncWarn
                        ? "#b45309"
                        : dncStatus === "error"
                          ? "#b45309"
                          : "#233217",
                  }}
                >
                  {dncStatus === "tcpa"
                    ? "TCPA LITIGATOR DETECTED"
                    : dncStatus === "agency_dq"
                      ? "CUSTOMER NOT ELIGIBLE (DQ)"
                      : dncStatus === "dnc"
                        ? "DNC LIST MATCH"
                        : dncStatus === "error"
                          ? "TRANSFER CHECK FAILED"
                          : "CHECK PASSED"}
                </h4>
              </div>
            </div>

            <div style={{ padding: "24px", textAlign: "center" }}>
              {dncStatus === "tcpa" && (
                <div style={{ padding: "16px 0" }}>
                  <p style={{ color: "#dc2626", fontWeight: 800, fontSize: 22, margin: "0 0 12px" }}>
                    This number is flagged as a TCPA litigator
                  </p>
                  <p style={{ fontSize: 14, color: T.textMid, margin: 0, lineHeight: 1.6 }}>
                    Proceeding with this lead may result in legal issues. Transfers and contact attempts are prohibited.
                  </p>
                  {dncMessage ? (
                    <p style={{ marginTop: 14, fontSize: 13, color: T.textMuted, fontWeight: 600, lineHeight: 1.45 }}>{dncMessage}</p>
                  ) : null}
                </div>
              )}

              {dncStatus === "dnc" && (
                <div style={{ padding: "16px 0", textAlign: "center" }}>
                  <p style={{ color: "#b45309", fontWeight: 800, fontSize: 22, margin: "0 0 12px" }}>
                    This number is on a do-not-call list
                  </p>
                  <p style={{ fontSize: 14, color: T.textMid, margin: 0, lineHeight: 1.6 }}>
                    Screening flagged DNC. You can still complete and save this lead in the CRM — only contact if you have a
                    valid exemption and follow your compliance workflow. TCPA litigator hits still block intake entirely.
                  </p>
                </div>
              )}

              {dncStatus === "agency_dq" && (
                <div style={{ padding: "16px 0", textAlign: "center" }}>
                  <p style={{ color: "#dc2626", fontWeight: 800, fontSize: 22, margin: "0 0 12px" }}>
                    {blockReason || "Customer has already been DQ from our agency"}
                  </p>
                  <p style={{ fontSize: 14, color: T.textMid, margin: 0, lineHeight: 1.6 }}>
                    This submission cannot proceed for this phone number.
                  </p>
                </div>
              )}

              {dncStatus === "clear" && (
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 15, color: T.textMid, margin: 0, lineHeight: 1.55 }}>{dncMessage}</p>
                </div>
              )}

              {dncStatus === "error" && (
                <div style={{ padding: "16px 0", textAlign: "left" }}>
                  <p style={{ fontSize: 14, color: T.textMid, margin: 0 }}>{dncMessage}</p>
                  {transferCheckError && transferCheckError !== dncMessage ? (
                    <p style={{ fontSize: 13, color: T.textMuted, marginTop: 10 }}>{transferCheckError}</p>
                  ) : null}
                </div>
              )}
            </div>

            <div
              style={{
                padding: "16px 24px",
                borderTop: `1px solid ${T.borderLight}`,
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
                backgroundColor: "#fafcff",
              }}
            >
              <button
                type="button"
                onClick={() => setShowDncModal(false)}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  backgroundColor: "#fff",
                  color: T.textDark,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: "pointer",
                  transition: "all 0.15s ease-in-out",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#233217";
                  e.currentTarget.style.color = "#233217";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.color = T.textDark;
                }}
              >
                {dncModalHardStop || dncStatus === "error" ? "Close" : "Cancel"}
              </button>
              {(dncStatus === "clear" || dncStatus === "dnc") && (
                <button
                  type="button"
                  onClick={() => setShowDncModal(false)}
                  style={{
                    height: 42,
                    padding: "0 24px",
                    borderRadius: 10,
                    border: "none",
                    backgroundColor: "#233217",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(35, 50, 23, 0.2)",
                    transition: "all 0.15s ease-in-out",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#1a260f";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#233217";
                  }}
                >
                  Continue
                </button>
              )}
            </div>
          </div>
        </div>
      )}

{/* Footer Actions */}
      <div style={{
        marginTop: 24,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <button
          onClick={requestLeave}
          style={{
            height: 42,
            padding: "0 20px",
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            backgroundColor: "#fff",
            color: T.textDark,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: T.font,
            cursor: "pointer",
            transition: "all 0.15s ease-in-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#233217";
            e.currentTarget.style.color = "#233217";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = T.border;
            e.currentTarget.style.color = T.textDark;
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          Cancel
        </button>

        {phoneGatePassed && (
          <button
            onClick={async () => {
              const missingKeys = REQUIRED_FORM_KEYS.filter((key) => !String(formData[key] ?? "").trim());
              const highlight = new Set<keyof TransferLeadFormData>(missingKeys);
              if (formData.includeBackupQuote) {
                const backupKeys: (keyof TransferLeadFormData)[] = [
                  "backupCarrier",
                  "backupProductType",
                  "backupMonthlyPremium",
                  "backupCoverageAmount",
                ];
                for (const key of backupKeys) {
                  if (!String(formData[key] ?? "").trim()) highlight.add(key);
                }
              }
              if (formData.phone.trim().length > 0 && !getUsPhone10Digits(formData.phone)) {
                highlight.add("phone");
              }
              if (highlight.size > 0) {
                setSubmitHighlightKeys(highlight);
                setToast({ message: "Please fill all required inputs before submitting.", type: "error" });
                return;
              }
              if (ssnDigits.length !== 9) {
                setSubmitHighlightKeys(new Set<keyof TransferLeadFormData>(["social"]));
                setToast({ message: "Please enter a valid 9-digit SSN before submitting.", type: "error" });
                return;
              }

              if (!isEditMode) {
                const result = await checkSsnRules(formData.social);
                if (result.blocked) return;
              }
              const dup = await checkPhoneDuplicate();
              if (dup.match) setShowPhoneDupDetails(true);
              if (dup.match && !dup.isAddable) return;
              void executeApplicationSubmit();
            }}
            disabled={submitDisabled || showTransferSubmitGate}
            style={{
              height: 48,
              padding: "0 48px",
              borderRadius: 8,
              border: "none",
              backgroundColor: submitDisabled || showTransferSubmitGate ? T.border : "#233217",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              fontFamily: T.font,
              cursor: submitDisabled || showTransferSubmitGate ? "not-allowed" : "pointer",
              boxShadow: submitDisabled || showTransferSubmitGate ? "none" : "0 4px 12px rgba(35, 50, 23, 0.2)",
              opacity: submitDisabled || showTransferSubmitGate ? 0.6 : 1,
              transition: "all 0.15s ease-in-out",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              minWidth: 220,
            }}
            onMouseEnter={(e) => {
              if (!submitDisabled && !showTransferSubmitGate) {
                e.currentTarget.style.backgroundColor = "#1a260f";
              }
            }}
            onMouseLeave={(e) => {
              if (!submitDisabled && !showTransferSubmitGate) {
                e.currentTarget.style.backgroundColor = "#233217";
              }
            }}
            onMouseDown={(e) => { if (!submitDisabled && !showTransferSubmitGate) e.currentTarget.style.transform = "scale(0.97)"; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            {showTransferSubmitGate ? (
              <>
                <div style={{ width: 18, height: 18, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <span>Submitting...</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </>
            ) : (
              "Submit Application"
            )}
          </button>
        )}

        {phoneGatePassed && onSaveDraft && (
          <button
            onClick={() => void saveDraftNow()}
            style={{
              height: 42,
              padding: "0 20px",
              borderRadius: 8,
              border: `1px solid #233217`,
              backgroundColor: "#fff",
              color: "#233217",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: T.font,
              cursor: "pointer",
              transition: "all 0.15s ease-in-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#EEF5EE";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#fff";
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            Save Draft
          </button>
        )}
      </div>
      {phoneGatePassed && submitBlockMessage && (
        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: T.danger, textAlign: "right" }}>
          {submitBlockMessage}
        </div>
      )}
      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}
      {hoveredFieldInfo && (
        <div
          style={{
            position: "fixed",
            top: hoveredFieldInfo.y,
            left: hoveredFieldInfo.x,
            backgroundColor: "#233217",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 500,
            maxWidth: 320,
            width: 320,
            zIndex: 999999,
            boxShadow: "0 12px 32px rgba(35, 50, 23, 0.4)",
            animation: "fadeInUp 0.15s ease-out",
            lineHeight: 1.6,
          }}
        >
          {hoveredFieldInfo.info}
        </div>
      )}

      {leaveConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-draft-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.35)",
            zIndex: 10060,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 560,
              backgroundColor: "#fff",
              borderRadius: 18,
              border: `1px solid ${T.borderLight}`,
              boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom: `1px solid ${T.borderLight}`,
                backgroundColor: "#f8fafc",
              }}
            >
              <h3 id="leave-draft-modal-title" style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.textDark }}>
                Save draft before leaving?
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: T.textMid, lineHeight: 1.45 }}>
                You have unsaved changes. You can save a draft now, or leave without saving.
              </p>
            </div>

            <div style={{ padding: 20, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setLeaveConfirmOpen(false)}
                disabled={leaveSavingDraft}
                style={{
                  height: 40,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  backgroundColor: "#fff",
                  color: T.textDark,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: leaveSavingDraft ? "not-allowed" : "pointer",
                }}
              >
                Stay
              </button>

              <button
                type="button"
                onClick={() => {
                  setLeaveConfirmOpen(false);
                  onBack();
                }}
                disabled={leaveSavingDraft}
                style={{
                  height: 40,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  backgroundColor: "#fff",
                  color: T.textDark,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: leaveSavingDraft ? "not-allowed" : "pointer",
                }}
              >
                Leave without saving
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (leaveSavingDraft) return;
                  setLeaveSavingDraft(true);
                  try {
                    await saveDraftNow({ thenLeave: true });
                  } finally {
                    setLeaveSavingDraft(false);
                    setLeaveConfirmOpen(false);
                  }
                }}
                style={{
                  height: 40,
                  padding: "0 16px",
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: "#233217",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: leaveSavingDraft ? "not-allowed" : "pointer",
                  opacity: leaveSavingDraft ? 0.8 : 1,
                }}
              >
                {leaveSavingDraft ? "Saving…" : "Save draft and leave"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransferSubmitGate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            zIndex: 10050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="transfer-gate-title"
        >
          <div
            style={{
              width: "100%",
              maxWidth: 600,
              backgroundColor: "#fff",
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              padding: 32,
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
            }}
          >
            {isSubmittingInTransferModal ? (
              // Loading state
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px" }}>
                <div style={{ width: 56, height: 56, border: `4px solid ${T.border}`, borderTopColor: "#233217", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 24 }} />
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.textDark, marginBottom: 12 }}>
                  Submitting Application...
                </h3>
                <p style={{ margin: 0, fontSize: 15, color: T.textMuted, textAlign: "center" }}>
                  Please wait while we save your application
                </p>
              </div>
            ) : (
              // Success state - after submission completes
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 id="transfer-gate-title" style={{ margin: 0, fontSize: 24, fontWeight: 800, color: T.textDark }}>
                    Application Submitted
                  </h3>
                </div>
                <p style={{ marginTop: 8, marginBottom: 0, fontSize: 15, color: T.textMid, lineHeight: 1.6 }}>
                  Your application has been successfully saved. Now transfer the customer to the number below, then press <strong style={{ color: T.textDark }}>Transfer</strong> or <strong style={{ color: T.textDark }}>Close</strong> to return to the list.
                </p>
                {displayCenterDid ? (
                  <>
                    <p style={{ marginTop: 20, marginBottom: 12, fontSize: 14, fontWeight: 700, color: T.textMuted }}>
                      Transfer to this DID (direct line)
                    </p>
                    <div
                      style={{
                        backgroundColor: T.rowBg,
                        border: `1px solid ${T.borderLight}`,
                        borderRadius: 12,
                        padding: "20px 24px",
                        marginBottom: 24,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 800,
                          color: "#233217",
                          fontFamily: "ui-monospace, monospace",
                          wordBreak: "break-all",
                          flex: 1,
                          textAlign: "center",
                        }}
                      >
                        {displayCenterDid}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (displayCenterDid) {
                            navigator.clipboard.writeText(displayCenterDid);
                            setDidCopied(true);
                            setTimeout(() => setDidCopied(false), 2000);
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "10px 16px",
                          borderRadius: 8,
                          border: `1px solid ${T.border}`,
                          background: didCopied ? "#dcfce7" : "#fff",
                          color: didCopied ? "#16a34a" : T.textDark,
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.15s ease-in-out",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                        title="Copy DID to clipboard"
                      >
                        {didCopied ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Copied
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <p style={{ marginTop: 20, marginBottom: 24, fontSize: 14, color: T.textMuted, lineHeight: 1.6 }}>
                    No DID is on file for this center. Follow your center&apos;s transfer procedure, then press Transfer or Close to return to the list.
                  </p>
                )}
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTransferSubmitGate(false);
                      onBack();
                    }}
                    style={{
                      background: "#fff",
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      padding: "12px 22px",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 15,
                      color: T.textDark,
                      transition: "all 0.15s ease-in-out",
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTransferSubmitGate(false);
                      onBack();
                    }}
                    style={{
                      border: "none",
                      background: "#233217",
                      color: "#fff",
                      borderRadius: 10,
                      padding: "12px 28px",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 15,
                      transition: "all 0.15s ease-in-out",
                    }}
                  >
                    Transfer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function Section({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusLg, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: "#DCEBDC" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#233217" }}>{icon}</span>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.textDark }}>{title}</h2>
        </div>
        {action}
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  );
}

function Field({ 
  label, 
  children, 
  full = false, 
  error,
  required = false,
  info,
  fieldKey,
  hoveredFieldInfo,
  setHoveredFieldInfo,
}: { 
  label: string; 
  children: ReactNode; 
  full?: boolean;
  error?: string;
  required?: boolean;
  info?: string;
  fieldKey?: string;
  hoveredFieldInfo?: { key: string; info: string; x: number; y: number } | null;
  setHoveredFieldInfo?: (info: { key: string; info: string; x: number; y: number } | null) => void;
}) {
  return (
    <div style={{ gridColumn: full ? "span 2" : "span 1", display: "flex", flexDirection: "column", gap: 6 }} data-field-key={fieldKey} data-info={info}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <label style={{
          ...labelStyle,
          marginBottom: 0,
        }}>
          {label}
          {required && <span style={{ color: "#dc2626" }}>*</span>}
        </label>
        {info && fieldKey && (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredFieldInfo && setHoveredFieldInfo({ key: fieldKey, info, x: rect.left, y: rect.bottom + 8 });
              }}
              onMouseLeave={() => {
                setHoveredFieldInfo && setHoveredFieldInfo(null);
              }}
              style={{ 
                background: "none", 
                border: "none", 
                cursor: "pointer", 
                padding: 0, 
                color: "#93c5fd", 
                display: "flex", 
                alignItems: "center",
                marginLeft: 2,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
            </button>
          </div>
        )}
      </div>
      {children}
      {error && (
        <span style={{ 
          fontSize: 12, 
          color: "#dc2626", 
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          {error}
        </span>
      )}
    </div>
  );
}

function YesNo({ value, onChange, hasError }: { value: string; onChange: (value: string) => void; hasError?: boolean }) {
  return (
    <StyledSelect
      value={value}
      onValueChange={onChange}
      options={[
        { value: "Yes", label: "Yes" },
        { value: "No", label: "No" },
      ]}
      placeholder="Please Select"
      error={hasError}
    />
  );
}
