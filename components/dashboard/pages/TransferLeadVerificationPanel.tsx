"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { runBlacklistDncPhoneCheck } from "@/lib/dncCheck";
import {
  loadVerificationItems,
  updateVerificationItem,
  type VerificationItemRow,
} from "./transferLeadParity";
import { useCarrierProductDropdowns, type CarrierProductRow } from "@/lib/useCarrierProductDropdowns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// StyledSelect component matching LeadEditForm design
function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled = false,
  error = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(val) => onValueChange(val || "")} disabled={disabled}>
      <SelectTrigger
        style={{
          width: "100%",
          height: 42,
          borderRadius: 10,
          border: `1.5px solid ${error ? "#dc2626" : T.border}`,
          backgroundColor: disabled ? T.pageBg : "#fff",
          color: value ? T.textDark : T.textMuted,
          fontSize: 14,
          fontWeight: 600,
          paddingLeft: 14,
          paddingRight: 12,
          transition: "all 0.15s ease-in-out",
          boxShadow: error ? "0 0 0 3px rgba(220, 38, 38, 0.1)" : "none",
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
          backgroundColor: "#fff",
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
              fontSize: 14,
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

// Field component with label and error display
function FormField({
  label,
  error,
  children,
  required = false,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: T.textMid,
          display: "flex",
          gap: 4,
        }}
      >
        {label}
        {required && <span style={{ color: "#dc2626" }}>*</span>}
      </label>
      {children}
      {error && (
        <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
          {error}
        </span>
      )}
    </div>
  );
}

// Input component styled for the form
function FormInput({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
  error,
  prefix,
}: {
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  error?: boolean;
  prefix?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      {prefix && (
        <span
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 14,
            fontWeight: 600,
            color: T.textMuted,
            pointerEvents: "none",
          }}
        >
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%",
          padding: prefix ? "12px 12px 12px 28px" : "12px",
          borderRadius: 8,
          border: `1.5px solid ${error ? "#dc2626" : T.border}`,
          fontSize: 14,
          fontWeight: 600,
          color: disabled ? T.textMuted : T.textDark,
          backgroundColor: disabled ? T.pageBg : "#fff",
          fontFamily: T.font,
          outline: "none",
          transition: "all 0.2s",
          boxShadow: error ? "0 0 0 3px rgba(220, 38, 38, 0.1)" : "none",
        }}
        onFocus={(e) => {
          if (!disabled && !error) {
            e.currentTarget.style.borderColor = T.blue;
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 139, 75, 0.12)";
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? "#dc2626" : T.border;
          e.currentTarget.style.boxShadow = "none";
        }}
      />
    </div>
  );
}

// Textarea component
function FormTextarea({
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  rows?: number;
}) {
  return (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      style={{
        width: "100%",
        padding: "12px",
        borderRadius: 8,
        border: `1.5px solid ${error ? "#dc2626" : T.border}`,
        fontSize: 14,
        fontWeight: 600,
        color: disabled ? T.textMuted : T.textDark,
        backgroundColor: disabled ? T.pageBg : "#fff",
        fontFamily: T.font,
        outline: "none",
        resize: "vertical",
        transition: "all 0.2s",
        boxShadow: error ? "0 0 0 3px rgba(220, 38, 38, 0.1)" : "none",
      }}
      onFocus={(e) => {
        if (!disabled && !error) {
          e.currentTarget.style.borderColor = T.blue;
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 139, 75, 0.12)";
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error ? "#dc2626" : T.border;
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

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

/** Matches `TransferLeadApplicationForm` underwriting modal field chrome. */
const uwModalFieldStyle: CSSProperties = {
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

// Section header component with collapsible functionality
function CollapsibleSectionHeader({
  title,
  verified,
  total,
  progress,
  isCollapsed,
  onToggle,
}: {
  title: string;
  verified: number;
  total: number;
  progress: number;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const isComplete = progress >= 100;
  const isInProgress = progress > 0 && progress < 100;
  
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        margin: "16px 0 12px",
        backgroundColor: "transparent",
        border: "none",
        borderBottom: `2px solid ${isComplete ? "#86efac" : T.borderLight}`,
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Collapse indicator */}
        <span
          style={{
            fontSize: 12,
            color: T.textMuted,
            transition: "transform 0.2s",
            transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
            display: "inline-block",
          }}
        >
          ▼
        </span>
        
        <h3
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 800,
            color: isComplete ? "#166534" : T.textDark,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {title}
        </h3>
        
        {/* Status indicator */}
        {isComplete && (
          <span
            style={{
              backgroundColor: "#dcfce7",
              color: "#166534",
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            ✓ Complete
          </span>
        )}
        {isInProgress && (
          <span
            style={{
              backgroundColor: T.blueLight,
              color: T.blue,
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            {verified}/{total}
          </span>
        )}
      </div>
      
      {/* Mini progress bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {(isInProgress || isComplete) && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: isComplete ? "#166534" : "#4e6e3a",
              minWidth: 34,
              textAlign: "right",
            }}
          >
            {progress}%
          </span>
        )}
        <div
          style={{
            width: 60,
            height: 4,
            borderRadius: 999,
            backgroundColor: T.rowBg,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              borderRadius: 999,
              backgroundColor: isComplete ? "#16a34a" : T.blue,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>
    </button>
  );
}

// Legacy SectionHeader for non-collapsible usage
function SectionHeader({ title }: { title: string }) {
  return (
    <h3
      style={{
        margin: "24px 0 16px",
        fontSize: 14,
        fontWeight: 800,
        color: T.textDark,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        borderBottom: `2px solid ${T.borderLight}`,
        paddingBottom: 8,
      }}
    >
      {title}
    </h3>
  );
}

type Props = {
  sessionId: string;
  showProgressSummary?: boolean;
  onProgressChange?: (payload: { verifiedCount: number; totalCount: number; progress: number }) => void;
  /** Opens claim flow to assign another licensed agent (Transfer Leads workspace). */
  onTransferToLicensedAgent?: () => void;
  leadName?: string;
  submissionId?: string | null;
  callCenterId?: string | null;
  /** Called after call_dropped field is saved. Use to trigger center-transfer-notification. */
  onCallDropped?: (payload: { submissionId: string | null; leadName: string; callCenterId?: string | null }) => void;
};

const VERIFICATION_FIELD_SEQUENCE = [
  "lead_vendor",
  "customer_full_name",
  "street_address",
  "beneficiary_information",
  "phone_number",
  "date_of_birth",
  "age",
  "social_security",
  "driver_license",
  "existing_coverage",
  "height",
  "weight",
  "doctors_name",
  "tobacco_use",
  "health_conditions",
  "medications",
  "carrier",
  "monthly_premium",
  "coverage_amount",
  "draft_date",
  "institution_name",
  "beneficiary_routing",
  "beneficiary_account",
  "account_type",
  "birth_state",
  "email",
  "previous_applications",
  "product_type",
  "future_draft_date",
  "additional_notes",
  "la_notes",
  "call_dropped",
] as const;

const VERIFICATION_FIELD_LABELS: Record<string, string> = {
  lead_vendor: "Lead Vendor",
  customer_full_name: "Customer Full Name",
  street_address: "Street Address",
  beneficiary_information: "Beneficiary Information",
  phone_number: "Phone Number",
  date_of_birth: "Date Of Birth",
  age: "Age",
  social_security: "Social Security",
  driver_license: "Driver License",
  existing_coverage: "Existing Coverage",
  height: "Height",
  weight: "Weight",
  doctors_name: "Doctors Name",
  tobacco_use: "Tobacco Use",
  health_conditions: "Health Conditions",
  medications: "Medications",
  carrier: "Carrier",
  monthly_premium: "Monthly Premium",
  coverage_amount: "Coverage Amount",
  draft_date: "Draft Date",
  institution_name: "Institution Name",
  beneficiary_routing: "Beneficiary Routing",
  beneficiary_account: "Beneficiary Account",
  account_type: "Account Type",
  birth_state: "Birth State",
  email: "Email",
  previous_applications: "Previous Applications",
  product_type: "Product Type",
  future_draft_date: "Future Draft Date",
  additional_notes: "BPO Closer Notes",
  la_notes: "LA Notes",
  call_dropped: "Call Dropped",
};

const HIDDEN_VERIFICATION_FIELDS = new Set<string>(["lead_vendor"]);

// Field section definitions for better UX organization
const FIELD_SECTIONS = {
  "Contact Information": [
    "customer_full_name",
    "phone_number",
    "email",
    "street_address",
  ],
  "Health & Underwriting": [
    "date_of_birth",
    "height",
    "weight",
    "tobacco_use",
    "health_conditions",
    "medications",
    "doctors_name",
    "existing_coverage",
    "previous_applications",
  ],
  "Personal Details": [
    "age",
    "social_security",
    "driver_license",
    "birth_state",
  ],
  "Policy Information": [
    "carrier",
    "product_type",
    "coverage_amount",
    "monthly_premium",
    "future_draft_date",
    "beneficiary_information",
  ],
  "Banking Details": [
    "draft_date",
    "institution_name",
    "beneficiary_routing",
    "beneficiary_account",
    "account_type",
  ],
  "Notes & Disposition": [
    "additional_notes",
    "la_notes",
    "call_dropped",
  ],
} as const;

type SectionName = keyof typeof FIELD_SECTIONS;

// Fields that work well in a two-column layout
const TWO_COLUMN_FIELDS = new Set<string>([
  "date_of_birth",
  "age",
  "height",
  "weight",
  "tobacco_use",
  "existing_coverage",
  "previous_applications",
  "carrier",
  "product_type",
  "coverage_amount",
  "monthly_premium",
  "draft_date",
  "future_draft_date",
  "institution_name",
  "account_type",
  "birth_state",
]);

export default function TransferLeadVerificationPanel({
  sessionId,
  showProgressSummary = true,
  onProgressChange,
  onTransferToLicensedAgent,
  leadName,
  submissionId,
  callCenterId,
  onCallDropped,
}: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [items, setItems] = useState<VerificationItemRow[]>([]);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [dncCheckingIds, setDncCheckingIds] = useState<Record<string, boolean>>({});
  const [dncStatusByItem, setDncStatusByItem] = useState<Record<string, "clear" | "dnc" | "tcpa" | "error">>({});
  const [dncMessageByItem, setDncMessageByItem] = useState<Record<string, string>>({});
  const [dncModal, setDncModal] = useState<{
    open: boolean;
    status: "clear" | "dnc" | "tcpa" | "error";
    itemId: string | null;
    phone: string;
    message: string;
  }>({
    open: false,
    status: "clear",
    itemId: null,
    phone: "",
    message: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [callOutcomeBusy, setCallOutcomeBusy] = useState(false);
  const firstFieldInputRef = useRef<HTMLInputElement | null>(null);
  /** Prevents duplicate auto-runs for the same session + 10-digit phone (e.g. Strict Mode). */
  const autoPhoneCheckRanRef = useRef<string | null>(null);
  const [showUnderwritingModal, setShowUnderwritingModal] = useState(false);
  const [underwritingSaving, setUnderwritingSaving] = useState(false);
  const [verificationFieldsCopied, setVerificationFieldsCopied] = useState(false);
  const [toolkitUrl, setToolkitUrl] = useState("https://insurancetoolkits.com/login");
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
  
  // Single-open accordion: only one section can be expanded at a time.
  const [expandedSection, setExpandedSection] = useState<SectionName | null>("Contact Information");
  
  // Recently verified items for animation
  const [recentlyVerified, setRecentlyVerified] = useState<Set<string>>(new Set());

  const toggleSection = (section: SectionName) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  // Calculate section completion
  const getSectionStats = (sectionFields: readonly string[]) => {
    const sectionItems = orderedItems.filter((item) =>
      sectionFields.includes(item.field_name)
    );
    const verified = sectionItems.filter((item) => item.is_verified).length;
    const total = sectionItems.length;
    return { verified, total, progress: total > 0 ? Math.round((verified / total) * 100) : 0 };
  };

  const onInvalidateUwProduct = useCallback((list: CarrierProductRow[], carrierNameSnapshot: string) => {
    setUnderwritingData((prev) => {
      if (prev.carrier.trim() !== carrierNameSnapshot) return prev;
      if (!prev.productLevel.trim()) return prev;
      if (list.some((x) => x.name === prev.productLevel)) return prev;
      return { ...prev, productLevel: "" };
    });
  }, []);

  const { carriers: uwCarriers, productsForCarrier: uwProducts, loadingProducts: uwProductsLoading } =
    useCarrierProductDropdowns(supabase, {
      carrierName: underwritingData.carrier,
      onInvalidateProduct: onInvalidateUwProduct,
    });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const loaded = await loadVerificationItems(supabase, sessionId);
        if (cancelled) return;
        setItems(loaded);
        setDraftValues(
          Object.fromEntries(
            loaded.map((item) => [item.id, item.verified_value ?? item.original_value ?? ""]),
          ),
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load verification fields.");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [sessionId, supabase]);

  const verifiedCount = items.filter((item) => item.is_verified).length;
  const progress = items.length > 0 ? Math.round((verifiedCount * 100) / items.length) : 0;

  useEffect(() => {
    if (!onProgressChange) return;
    onProgressChange({ verifiedCount, totalCount: items.length, progress });
  }, [onProgressChange, progress, verifiedCount, items.length]);

  const orderedItems = useMemo(() => {
    const visibleItems = items.filter((item) => !HIDDEN_VERIFICATION_FIELDS.has(item.field_name));
    const orderMap = new Map<string, number>(
      VERIFICATION_FIELD_SEQUENCE.map((fieldName, index) => [fieldName, index]),
    );
    return [...visibleItems].sort((a, b) => {
      const aOrder = orderMap.get(a.field_name) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = orderMap.get(b.field_name) ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.field_name.localeCompare(b.field_name);
    });
  }, [items]);

  const verificationFieldsCopyText = useMemo(() => {
    const lines: string[] = [];
    for (const item of orderedItems) {
      const label = VERIFICATION_FIELD_LABELS[item.field_name] || item.field_name.replace(/_/g, " ");
      const raw = String(draftValues[item.id] ?? item.verified_value ?? item.original_value ?? "").trimEnd();
      const flat = raw.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
      lines.push(`${label}: ${flat}`);
    }
    return lines.join("\n");
  }, [orderedItems, draftValues]);

  const copyVerificationFieldsToClipboard = useCallback(async () => {
    if (orderedItems.length === 0) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(verificationFieldsCopyText);
      setVerificationFieldsCopied(true);
      window.setTimeout(() => setVerificationFieldsCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }, [verificationFieldsCopyText, orderedItems.length]);

  const getValueByFieldName = (fieldName: string) => {
    const match = items.find((item) => item.field_name === fieldName);
    if (!match) return "";
    return String(draftValues[match.id] ?? match.verified_value ?? match.original_value ?? "");
  };

  const getValueByFieldNames = (fieldNames: string[]) => {
    for (const fieldName of fieldNames) {
      const value = getValueByFieldName(fieldName).trim();
      if (value) return value;
    }
    return "";
  };

  const openUnderwritingModal = () => {
    const tobaccoRaw = getValueByFieldName("tobacco_use").toLowerCase();
    const tobaccoLast12Months =
      tobaccoRaw === "yes" || tobaccoRaw === "y" || tobaccoRaw === "true"
        ? "yes"
        : tobaccoRaw === "no" || tobaccoRaw === "n" || tobaccoRaw === "false"
          ? "no"
          : "";

    const nextUnderwriting = {
      tobaccoLast12Months,
      height: getValueByFieldName("height"),
      weight: getValueByFieldName("weight"),
      carrier: getValueByFieldName("carrier"),
      productLevel: getValueByFieldNames(["product_type", "insurance_application_details"]),
      coverageAmount: getValueByFieldName("coverage_amount"),
      monthlyPremium: getValueByFieldName("monthly_premium"),
    };

    // TEMP: debugging initial underwriting values on transfer leads page
    // eslint-disable-next-line no-console
    console.log("[TransferLeadVerificationPanel] openUnderwritingModal source", {
      tobacco_use: getValueByFieldName("tobacco_use"),
      health_conditions: getValueByFieldName("health_conditions"),
      medications: getValueByFieldName("medications"),
      height: getValueByFieldName("height"),
      weight: getValueByFieldName("weight"),
      carrier: getValueByFieldName("carrier"),
      product_type: getValueByFieldName("product_type"),
      insurance_application_details: getValueByFieldName("insurance_application_details"),
      coverage_amount: getValueByFieldName("coverage_amount"),
      monthly_premium: getValueByFieldName("monthly_premium"),
    });
    // eslint-disable-next-line no-console
    console.log("[TransferLeadVerificationPanel] setUnderwritingData", nextUnderwriting);

    setUnderwritingData(nextUnderwriting);
    setUnderwritingHealthTags(mergeUniqueTags([], toTagParts(getValueByFieldName("health_conditions"))));
    setUnderwritingMedicationTags(mergeUniqueTags([], toTagParts(getValueByFieldName("medications"))));
    setUnderwritingHealthInput("");
    setUnderwritingMedicationInput("");
    setToolkitUrl("https://insurancetoolkits.com/login");
    setShowUnderwritingModal(true);
  };

  const updateItemVerifiedValue = async (fieldName: string, rawValue: string) => {
    const item = items.find((row) => row.field_name === fieldName);
    const value = String(rawValue || "").trim();
    if (!item || !value) return;
    await updateVerificationItem(supabase, item.id, {
      isVerified: true,
      verifiedValue: value,
    });
    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? {
              ...row,
              is_verified: true,
              verified_value: value,
            }
          : row,
      ),
    );
    setDraftValues((prev) => ({ ...prev, [item.id]: value }));
  };

  const handleUnderwritingSaveAndVerify = async () => {
    setUnderwritingSaving(true);
    setError(null);
    try {
      await updateItemVerifiedValue(
        "tobacco_use",
        underwritingData.tobaccoLast12Months === "yes"
          ? "Yes"
          : underwritingData.tobaccoLast12Months === "no"
            ? "No"
            : "",
      );
      const normalizedHealthConditions = mergeUniqueTags(
        underwritingHealthTags,
        toTagParts(underwritingHealthInput),
      );
      const normalizedMedications = mergeUniqueTags(
        underwritingMedicationTags,
        toTagParts(underwritingMedicationInput),
      );
      await updateItemVerifiedValue("health_conditions", normalizedHealthConditions.join(", "));
      await updateItemVerifiedValue("medications", normalizedMedications.join(", "));
      await updateItemVerifiedValue("height", underwritingData.height);
      await updateItemVerifiedValue("weight", underwritingData.weight);
      await updateItemVerifiedValue("carrier", underwritingData.carrier);
      await updateItemVerifiedValue("product_type", underwritingData.productLevel);
      await updateItemVerifiedValue(
        "coverage_amount",
        underwritingData.coverageAmount.replace(/\$/g, "").replace(/,/g, ""),
      );
      await updateItemVerifiedValue(
        "monthly_premium",
        underwritingData.monthlyPremium.replace(/\$/g, "").replace(/,/g, ""),
      );
      setShowUnderwritingModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save underwriting values.");
    } finally {
      setUnderwritingSaving(false);
    }
  };

  const saveOne = async (item: VerificationItemRow, nextIsVerified: boolean) => {
    setSavingIds((prev) => ({ ...prev, [item.id]: true }));
    setError(null);
    try {
      const nextValue = draftValues[item.id] ?? item.verified_value ?? item.original_value ?? "";
      await updateVerificationItem(supabase, item.id, {
        isVerified: nextIsVerified,
        verifiedValue: nextValue,
      });
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                is_verified: nextIsVerified,
                verified_value: nextValue,
              }
            : row,
        ),
      );
      
      // Trigger animation when verified
      if (nextIsVerified) {
        setRecentlyVerified((prev) => new Set(prev).add(item.id));
        setTimeout(() => {
          setRecentlyVerified((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        }, 800);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save verification update.");
    } finally {
      setSavingIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const handleDncModalProceed = async () => {
    const itemId = dncModal.itemId;
    if (!itemId) {
      setDncModal({ open: false, status: "clear", itemId: null, phone: "", message: "" });
      return;
    }
    const targetItem = items.find((item) => item.id === itemId);
    if (!targetItem) {
      setDncModal({ open: false, status: "clear", itemId: null, phone: "", message: "" });
      return;
    }
    await saveOne(targetItem, true);
    setDncModal({ open: false, status: "clear", itemId: null, phone: "", message: "" });
  };

  /**
   * Transfer phone check (blacklist + DNC/TCPA edge functions).
   * Manual: always opens the result modal (except tcpa still shows litigator copy when `auto`).
   * Auto (page open): runs once per session+phone; TCPA → inline "Litigator" + TCPA modal; otherwise no modal and no message.
   */
  const runTransferPhoneCheck = useCallback(
    async (item: VerificationItemRow, rawPhone: string, options?: { auto?: boolean }) => {
      const auto = Boolean(options?.auto);
      const cleanPhone = String(rawPhone).replace(/\D/g, "");
      if (cleanPhone.length !== 10) {
        if (!auto) {
          setDncStatusByItem((prev) => ({ ...prev, [item.id]: "error" }));
          setDncMessageByItem((prev) => ({
            ...prev,
            [item.id]: "Please enter a valid 10-digit US phone number first.",
          }));
        }
        return;
      }

      setDncCheckingIds((prev) => ({ ...prev, [item.id]: true }));
      setDncStatusByItem((prev) => ({ ...prev, [item.id]: "clear" }));
      setDncMessageByItem((prev) => ({ ...prev, [item.id]: "" }));

      try {
        const { status: resolvedStatus, message } = await runBlacklistDncPhoneCheck(supabase, cleanPhone);

        setDncStatusByItem((prev) => ({ ...prev, [item.id]: resolvedStatus }));

        if (resolvedStatus === "tcpa") {
          const tcpaMessage = auto ? "Litigator" : message;
          setDncMessageByItem((prev) => ({ ...prev, [item.id]: tcpaMessage }));
          setDncModal({
            open: true,
            status: "tcpa",
            itemId: item.id,
            phone: String(rawPhone || cleanPhone),
            message: tcpaMessage,
          });
          return;
        }

        if (auto) {
          setDncMessageByItem((prev) => ({ ...prev, [item.id]: "" }));
          return;
        }

        setDncMessageByItem((prev) => ({ ...prev, [item.id]: message }));
        setDncModal({
          open: true,
          status: resolvedStatus,
          itemId: item.id,
          phone: String(rawPhone || cleanPhone),
          message,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unable to check DNC status.";
        setDncStatusByItem((prev) => ({ ...prev, [item.id]: "error" }));
        setDncMessageByItem((prev) => ({ ...prev, [item.id]: msg }));
        if (!auto) {
          setDncModal({
            open: true,
            status: "error",
            itemId: item.id,
            phone: String(rawPhone || cleanPhone),
            message: msg,
          });
        }
      } finally {
        setDncCheckingIds((prev) => ({ ...prev, [item.id]: false }));
      }
    },
    [supabase],
  );

  const checkDncForItem = async (item: VerificationItemRow) => {
    const rawPhone = draftValues[item.id] ?? item.verified_value ?? item.original_value ?? "";
    await runTransferPhoneCheck(item, rawPhone, { auto: false });
  };

  const setCallDroppedField = async (dropped: boolean) => {
    const item = items.find((row) => row.field_name === "call_dropped");
    if (!item) {
      setError("Call Dropped field is not available for this session.");
      return;
    }
    const value = dropped ? "Yes" : "No";
    setCallOutcomeBusy(true);
    setError(null);
    try {
      await updateVerificationItem(supabase, item.id, {
        isVerified: true,
        verifiedValue: value,
      });
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? { ...row, is_verified: true, verified_value: value }
            : row,
        ),
      );
      setDraftValues((prev) => ({ ...prev, [item.id]: value }));
      if (dropped && onCallDropped) {
        onCallDropped({
          submissionId: submissionId ?? null,
          leadName: leadName ?? "",
          callCenterId: callCenterId ?? null,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save call outcome.");
    } finally {
      setCallOutcomeBusy(false);
    }
  };

  useEffect(() => {
    if (items.length === 0) return;
    const phoneItem = items.find((row) => row.field_name === "phone_number");
    if (!phoneItem) return;
    const raw =
      draftValues[phoneItem.id] ?? phoneItem.verified_value ?? phoneItem.original_value ?? "";
    const clean = String(raw).replace(/\D/g, "");
    if (clean.length !== 10) return;
    const key = `${sessionId}:${clean}`;
    if (autoPhoneCheckRanRef.current === key) return;
    autoPhoneCheckRanRef.current = key;
    void runTransferPhoneCheck(phoneItem, raw, { auto: true });
  }, [sessionId, items, draftValues, runTransferPhoneCheck]);

  // Hide "not started" banner once any field has been verified OR any value has been entered
  const anyFieldHasValue = orderedItems.some(
    (item) => (draftValues[item.id] ?? "").trim().length > 0
  );
  const verificationNotStarted = orderedItems.length > 0 && verifiedCount === 0 && !anyFieldHasValue;

  return (
    <div
      id="transfer-lead-verification-panel"
      style={{
        backgroundColor: "#fff",
        border: `1.5px solid ${T.border}`,
        borderRadius: 18,
        boxShadow: T.shadowSm,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 18, color: T.textDark, fontWeight: 700 }}>Verification Panel</h3>
          {showProgressSummary && (
            <span style={{ fontSize: 12, fontWeight: 600, color: T.textMid }}>
              {verifiedCount}/{items.length} fields verified
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={callOutcomeBusy}
            onClick={() => {
              void setCallDroppedField(true);
            }}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 600,
              fontSize: 12,
              fontFamily: T.font,
              cursor: callOutcomeBusy ? "not-allowed" : "pointer",
              opacity: callOutcomeBusy ? 0.65 : 1,
              backgroundColor: "#dc2626",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              outline: "none",
              transition: "all 0.15s ease-in-out",
            }}
            onFocus={(e) => {
              if (!callOutcomeBusy) {
                e.currentTarget.style.boxShadow = "0 0 0 2px rgba(220, 38, 38, 0.4)";
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Call Dropped
          </button>
          <button
            type="button"
            disabled={callOutcomeBusy}
            onClick={() => {
              void setCallDroppedField(false);
            }}
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 600,
              fontSize: 12,
              fontFamily: T.font,
              cursor: callOutcomeBusy ? "not-allowed" : "pointer",
              opacity: callOutcomeBusy ? 0.65 : 1,
              backgroundColor: "#f3f4f6",
              color: "#111827",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              outline: "none",
              transition: "all 0.15s ease-in-out",
            }}
            onFocus={(e) => {
              if (!callOutcomeBusy) {
                e.currentTarget.style.boxShadow = "0 0 0 2px rgba(35, 50, 23, 0.2)";
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Call Done
          </button>
          <button
            type="button"
            disabled={callOutcomeBusy || !onTransferToLicensedAgent}
            onClick={() => {
              onTransferToLicensedAgent?.();
            }}
            aria-label="Transfer to another licensed agent"
            style={{
              border: "none",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 600,
              fontSize: 12,
              fontFamily: T.font,
              cursor: callOutcomeBusy || !onTransferToLicensedAgent ? "not-allowed" : "pointer",
              opacity: callOutcomeBusy || !onTransferToLicensedAgent ? 0.65 : 1,
              backgroundColor: "#0f172a",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              outline: "none",
              transition: "all 0.15s ease-in-out",
            }}
            onFocus={(e) => {
              if (!callOutcomeBusy && onTransferToLicensedAgent) {
                e.currentTarget.style.boxShadow = "0 0 0 2px rgba(15, 23, 42, 0.4)";
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            Transfer
          </button>
          <button
            type="button"
            onClick={() => void copyVerificationFieldsToClipboard()}
            disabled={orderedItems.length === 0}
            aria-label="Copy all verification field labels and current values"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 8,
              border: `1.5px solid ${T.border}`,
              background: verificationFieldsCopied ? "#dcfce7" : "#fff",
              color: verificationFieldsCopied ? "#16a34a" : T.textDark,
              fontSize: 12,
              fontWeight: 600,
              cursor: orderedItems.length === 0 ? "not-allowed" : "pointer",
              opacity: orderedItems.length === 0 ? 0.5 : 1,
              transition: "all 0.15s ease-in-out",
              fontFamily: T.font,
              outline: "none",
            }}
            onFocus={(e) => {
              if (orderedItems.length > 0) {
                e.currentTarget.style.boxShadow = "0 0 0 2px rgba(35, 50, 23, 0.2)";
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {verificationFieldsCopied ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>
      {showProgressSummary && (
        <div style={{ marginTop: 14, marginBottom: 18 }}>
          {/* Field-style label row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <label
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: T.textMid,
              }}
            >
              Verification Progress
            </label>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: progress >= 100 ? "#16a34a" : T.blue,
                marginLeft: "auto",
              }}
            >
              {progress}%
            </span>
          </div>
          {/* Progress bar - shadcn style with theme colors */}
          <div
            style={{
              height: 12,
              borderRadius: 999,
              backgroundColor: T.rowBg,
              overflow: "hidden",
              border: `1px solid ${T.borderLight}`,
            }}
          >
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{
                width: `${progress}%`,
                height: "100%",
                borderRadius: 999,
                backgroundColor: progress >= 100 ? "#16a34a" : T.blue,
                transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
            {verifiedCount} of {items.length} fields verified
          </p>
        </div>
      )}

      {verificationNotStarted && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 10,
            border: `1px solid ${T.border}`,
            backgroundColor: T.pageBg,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.textMid }}>
            Verification has not started — review each field and mark as verified when correct.
          </p>
          <button
            type="button"
            onClick={() => {
              firstFieldInputRef.current?.focus({ preventScroll: false });
              firstFieldInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            style={{
              flexShrink: 0,
              border: "none",
              backgroundColor: T.blue,
              color: "#fff",
              borderRadius: 8,
              padding: "8px 14px",
              fontWeight: 800,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: T.font,
            }}
          >
            Start verification
          </button>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 10, color: "#991b1b", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
          {error}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 0 0 rgba(134, 239, 172, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(134, 239, 172, 0); }
        }
      `}</style>
      <div style={{ maxHeight: 560, overflowY: "auto", paddingRight: 4 }}>
        {(Object.entries(FIELD_SECTIONS) as [SectionName, readonly string[]][]).map(
          ([sectionName, sectionFields]) => {
            const stats = getSectionStats(sectionFields);
            const isCollapsed = expandedSection !== sectionName;
            
            // Get visible items for this section that are in our ordered list
            const sectionItems = orderedItems.filter((item) =>
              sectionFields.includes(item.field_name)
            );
            
            if (sectionItems.length === 0) return null;

            const isHealthAndUnderwriting = sectionName === "Health & Underwriting";

            return (
              <div key={sectionName} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <CollapsibleSectionHeader
                      title={sectionName}
                      verified={stats.verified}
                      total={stats.total}
                      progress={stats.progress}
                      isCollapsed={isCollapsed}
                      onToggle={() => toggleSection(sectionName)}
                    />
                  </div>
                  {isHealthAndUnderwriting && (
                    <button
                      type="button"
                      onClick={openUnderwritingModal}
                      style={{
                        flexShrink: 0,
                        border: `1px solid ${T.border}`,
                        backgroundColor: T.cardBg,
                        color: T.textDark,
                        borderRadius: T.radiusSm,
                        padding: "6px 12px",
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: "pointer",
                        transition: "all 0.15s ease-in-out",
                        fontFamily: T.font,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = T.blue;
                        e.currentTarget.style.backgroundColor = T.blueFaint;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = T.border;
                        e.currentTarget.style.backgroundColor = T.cardBg;
                      }}
                    >
                      Underwriting
                    </button>
                  )}
                </div>
                
                {!isCollapsed && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: 12,
                      animation: "fadeIn 0.2s ease-out",
                    }}
                  >
                    {sectionItems.map((item) => {
                      const isSaving = Boolean(savingIds[item.id]);
                      const isPhoneField = item.field_name === "phone_number";
                      const dncStatus = dncStatusByItem[item.id];
                      const dncMessage = dncMessageByItem[item.id];
                      const dncChecking = Boolean(dncCheckingIds[item.id]);
                      const label =
                        VERIFICATION_FIELD_LABELS[item.field_name] ||
                        item.field_name.replaceAll("_", " ");
                      const isRecentlyVerified = recentlyVerified.has(item.id);
                      const isTwoColumn = TWO_COLUMN_FIELDS.has(item.field_name);

                      return (
                        <div
                          key={item.id}
                          style={{
                            border: `1.5px solid ${item.is_verified ? "#86efac" : T.border}`,
                            borderRadius: 12,
                            padding: 14,
                            backgroundColor: item.is_verified ? "#f0fdf4" : "#fff",
                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            boxShadow: isRecentlyVerified
                              ? "0 0 0 4px rgba(134, 239, 172, 0.4)"
                              : "none",
                            transform: isRecentlyVerified ? "scale(1.01)" : "scale(1)",
                            ...(isTwoColumn && { gridColumn: "span 1" }),
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              marginBottom: 12,
                              alignItems: "center",
                            }}
                          >
                            <FormField label={label}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {isPhoneField && dncStatus && (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: 20,
                                      height: 20,
                                      borderRadius: "50%",
                                      fontSize: 12,
                                      fontWeight: 800,
                                      backgroundColor:
                                        dncStatus === "clear"
                                          ? "#16a34a"
                                          : dncStatus === "error"
                                            ? "#dc2626"
                                            : dncStatus === "tcpa"
                                              ? "#dc2626"
                                              : "#b45309",
                                      color: "#fff",
                                    }}
                                  >
                                    {dncStatus === "clear" ? "✓" : dncStatus === "error" ? "!" : "×"}
                                  </span>
                                )}
                                {isPhoneField && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void checkDncForItem(item);
                                    }}
                                    disabled={dncChecking}
                                    style={{
                                      borderRadius: 8,
                                      border: "none",
                                      padding: "6px 12px",
                                      fontWeight: 600,
                                      fontSize: 12,
                                      cursor: dncChecking ? "not-allowed" : "pointer",
                                      backgroundColor: dncChecking ? "#c8d4bb" : T.blue,
                                      color: "#fff",
                                      transition: "all 0.2s",
                                      outline: "none",
                                    }}
                                    onFocus={(e) => {
                                      if (!dncChecking) {
                                        e.currentTarget.style.boxShadow = "0 0 0 2px rgba(99, 139, 75, 0.4)";
                                      }
                                    }}
                                    onBlur={(e) => {
                                      e.currentTarget.style.boxShadow = "none";
                                    }}
                                  >
                                    {dncChecking ? "Checking..." : "Check"}
                                  </button>
                                )}
                              </div>
                            </FormField>
                            <label
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 13,
                                fontWeight: 700,
                                color: T.textMid,
                                cursor: "pointer",
                                padding: "6px 10px",
                                borderRadius: 8,
                                backgroundColor: item.is_verified ? "#dcfce7" : T.rowBg,
                                border: `1.5px solid ${item.is_verified ? "#86efac" : T.border}`,
                                transition: "all 0.2s",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(item.is_verified)}
                                disabled={isSaving}
                                onChange={(e) => {
                                  void saveOne(item, e.target.checked);
                                }}
                                style={{
                                  width: 16,
                                  height: 16,
                                  cursor: isSaving ? "not-allowed" : "pointer",
                                }}
                              />
                              <span style={{ color: item.is_verified ? "#166534" : T.textDark }}>
                                {item.is_verified ? "Verified" : "Verify"}
                              </span>
                            </label>
                          </div>

                          {isPhoneField && dncMessage && (
                            <div
                              style={{
                                marginBottom: 12,
                                padding: "10px 14px",
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 700,
                                backgroundColor:
                                  dncStatus === "error" || dncStatus === "tcpa"
                                    ? "#fef2f2"
                                    : dncStatus === "dnc"
                                      ? "#fffbeb"
                                      : "#f0fdf4",
                                color:
                                  dncStatus === "error" || dncStatus === "tcpa"
                                    ? "#dc2626"
                                    : dncStatus === "dnc"
                                      ? "#b45309"
                                      : "#166534",
                                border: `1.5px solid ${
                                  dncStatus === "error" || dncStatus === "tcpa"
                                    ? "#fecaca"
                                    : dncStatus === "dnc"
                                      ? "#fcd34d"
                                      : "#86efac"
                                }`,
                              }}
                            >
                              {dncMessage}
                            </div>
                          )}

                          <FormInput
                            value={draftValues[item.id] ?? ""}
                            onChange={(val) =>
                              setDraftValues((prev) => ({ ...prev, [item.id]: val }))
                            }
                            placeholder={`Enter ${label.toLowerCase()}...`}
                          />

                          {isPhoneField && (
                            <button
                              type="button"
                              onClick={openUnderwritingModal}
                              aria-label="Open underwriting details form"
                              style={{
                                width: "100%",
                                marginTop: 12,
                                border: "none",
                                backgroundColor: "#233217",
                                color: "#fff",
                                borderRadius: 8,
                                padding: "12px 16px",
                                fontWeight: 700,
                                cursor: "pointer",
                                fontSize: 14,
                                boxShadow: "none",
                                transition: "all 0.2s",
                                outline: "none",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#1a260f";
                                e.currentTarget.style.boxShadow = "0 2px 8px rgba(35, 50, 23, 0.15)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "#233217";
                                e.currentTarget.style.boxShadow = "none";
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.boxShadow = "0 0 0 2px rgba(35, 50, 23, 0.3)";
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.boxShadow = "none";
                              }}
                            >
                              Underwriting
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>

      {dncModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.35)",
            zIndex: 3600,
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
              backgroundColor: "#fff",
              borderRadius: 12,
              border: dncModal.status === "tcpa" ? "2px solid #3b5229" : `1.5px solid ${T.border}`,
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
              padding: 18,
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: 26,
                color:
                  dncModal.status === "tcpa"
                    ? "#dc2626"
                    : dncModal.status === "dnc"
                      ? "#ea580c"
                      : dncModal.status === "error"
                        ? "#dc2626"
                        : T.blue,
              }}
            >
              {dncModal.status === "tcpa"
                ? "⚠️ TCPA LITIGATOR WARNING"
                : dncModal.status === "dnc"
                  ? "📞 Do Not Call List"
                  : dncModal.status === "error"
                    ? "DNC Check Failed"
                    : "📞 Phone Verification"}
            </h4>
            <p style={{ margin: "8px 0 0", fontSize: 16, color: T.textMid, lineHeight: 1.45 }}>
              {dncModal.status === "tcpa"
                ? "This number is flagged as a TCPA Litigator. Proceeding may result in legal issues."
                : dncModal.status === "error"
                  ? dncModal.message
                  : "Please read the following script to the customer to obtain verbal consent."}
            </p>

            {dncModal.status === "tcpa" && (
              <div style={{ padding: "16px 0" }}>
                <p style={{ color: "#dc2626", fontWeight: 800, textAlign: "center", fontSize: 30, margin: 0 }}>
                  ⚠️ WARNING: This number is a TCPA LITIGATOR
                </p>
                <p style={{ fontSize: 18, color: T.textMid, textAlign: "center", margin: "12px 0 0" }}>
                  This number has been flagged as a TCPA litigator. It is recommended to NOT proceed with this lead.
                </p>
              </div>
            )}

            {(dncModal.status === "clear" || dncModal.status === "dnc") && (
              <div style={{ padding: "16px 0" }}>
                {dncModal.status === "dnc" && (
                  <p style={{ color: "#ea580c", fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}>
                    ⚠️ This number is on the Do Not Call list
                  </p>
                )}
                <div style={{ backgroundColor: "#f8fafc", padding: 18, borderRadius: 10, border: "2px solid #c8d4bb" }}>
                  <p style={{ fontSize: 20, margin: "0 0 12px", fontWeight: 600, lineHeight: 1.45 }}>
                    Is your phone number{" "}
                    <span style={{ color: T.blue, fontWeight: 800 }}>{dncModal.phone || ""}</span> on the Federal, National or
                    State Do Not Call List?
                  </p>
                  <p style={{ color: T.textMuted, fontSize: 13, margin: "0 0 10px" }}>
                    (if a customer says no and we see it's on the DNC list we still have to take the verbal consent)
                  </p>
                  <p style={{ fontSize: 20, margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
                    Sir/Ma'am, even if your phone number is on the Federal National or State Do not call list do we still have
                    your permission to call you and submit your application for insurance to{" "}
                    <span style={{ color: T.blue, fontWeight: 800 }}>{getValueByFieldName("carrier") || "carrier"}</span> -{" "}
                    {new Date().toLocaleDateString()} via your phone number{" "}
                    <span style={{ color: T.blue, fontWeight: 800 }}>{dncModal.phone || ""}</span>? And do we have your permission
                    to call you on the same phone number in the future if needed?
                  </p>
                  <p style={{ fontSize: 15, color: T.textMid, margin: "12px 0 0", fontWeight: 700 }}>
                    Make sure you get a clear YES on it.
                  </p>
                </div>
                {dncModal.message ? (
                  <p style={{ marginTop: 12, fontSize: 13, color: T.textMuted, fontWeight: 600, lineHeight: 1.45 }}>
                    {dncModal.message}
                  </p>
                ) : null}
              </div>
            )}

            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() =>
                  setDncModal({ open: false, status: "clear", itemId: null, phone: "", message: "" })
                }
                style={{
                  border: `1px solid ${T.border}`,
                  backgroundColor: "#fff",
                  color: T.textDark,
                  borderRadius: 8,
                  padding: "10px 16px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              {dncModal.status !== "tcpa" && dncModal.status !== "error" && (
                <button
                  type="button"
                  onClick={() => {
                    void handleDncModalProceed();
                  }}
                  style={{
                    border: "none",
                    backgroundColor: "#16a34a",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  I Got Verbal Consent - Proceed
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showUnderwritingModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 3700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1400,
              height: "90vh",
              maxHeight: "90vh",
              overflowY: "auto",
              backgroundColor: T.cardBg,
              borderRadius: T.radiusLg,
              border: `1px solid ${T.border}`,
              boxShadow: T.shadowXl,
              padding: 32,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 28, color: T.textDark, fontWeight: 800 }}>Underwriting</h2>
              <button
                type="button"
                onClick={() => setShowUnderwritingModal(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 8,
                  borderRadius: T.radiusSm,
                  color: T.textMuted,
                  fontSize: 24,
                  lineHeight: 1,
                  transition: "all 0.15s ease-in-out",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = T.blueFaint;
                  e.currentTarget.style.color = T.textDark;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = T.textMuted;
                }}
              >
                ×
              </button>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 15, color: T.textMuted, fontWeight: 500 }}>
              Please read the following script to the customer and verify all information.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "12px 40px",
                padding: "14px 20px",
                marginBottom: 24,
                borderRadius: T.radiusMd,
                backgroundColor: "#e0f2fe",
                border: "1px solid #bae6fd",
              }}
            >
              <span style={{ fontSize: 15, color: T.textDark, lineHeight: 1.4 }}>
                <strong style={{ fontWeight: 800 }}>State:</strong>{" "}
                {getValueByFieldNames(["state", "birth_state"]).trim() || "—"}
              </span>
              <span style={{ fontSize: 15, color: T.textDark, lineHeight: 1.4 }}>
                <strong style={{ fontWeight: 800 }}>Date of Birth:</strong>{" "}
                {getValueByFieldName("date_of_birth").trim() || "—"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 24, marginBottom: 24, alignItems: "stretch" }}>
              <div
                style={{
                  backgroundColor: T.blueFaint,
                  padding: 24,
                  borderRadius: T.radiusMd,
                  border: `1px solid ${T.border}`,
                  height: "100%",
                  overflowY: "auto",
                }}
              >
                <h4 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: T.textDark }}>Underwriting Questions</h4>
                <div style={{ fontSize: 15, lineHeight: 1.6 }}>
                  <p style={{ fontWeight: 600, margin: "0 0 16px", color: T.textMid }}>
                    &quot;I am going to ask you some medical questions and we expect your honesty that is going to save us a lot
                    of time. And, this will help us evaluate which insurance carrier comes back with the maximum benefit at the
                    lowest rates for you.&quot;
                  </p>
                  <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: 16, marginBottom: 12 }}>
                    <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: 15, color: T.textDark }}>Question 1:</p>
                    <p style={{ margin: 0, fontSize: 14, color: T.textMid, lineHeight: 1.5 }}>
                      Have you ever been diagnosed or treated for Alzheimer&apos;s Dementia, Congestive heart failure, organ
                      transplant, HIV, AIDS, ARC, Leukemia, Tuberculosis, chronic Respiratory disease, currently paralyzed,
                      amputation due to a disease? Are you currently hospitalized in a nursing facility? Due to a disease are
                      you currently confined to a wheelchair? Are you currently on oxygen?
                    </p>
                  </div>
                  <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: 16, marginBottom: 12 }}>
                    <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: 15, color: T.textDark }}>Question 2:</p>
                    <p style={{ margin: 0, fontSize: 14, color: T.textMid, lineHeight: 1.5 }}>
                      In the last 5 years, have you had any heart attacks, cancers, Alzheimer&apos;s, dementia, congestive heart
                      failure, kidney failure or an organ removal? Have you ever had any disorders of the kidney, lung, brain,
                      heart, circulatory system or liver? Or In the last 3 years have you been diagnosed and treated for
                      leukemia, sickle cell anemia, brain disorder, Alzheimer&apos;s or dementia, aneurysm, diabetic coma,
                      amputation due to any disease, cirrhosis of the liver, Multiple Sclerosis, chronic respiratory disease,
                      tuberculosis, chronic pneumonia, hepatitis? Or In the last 2 years if you had any stents, pacemaker,
                      defibrillator, valve replacement, stroke, TIA or paralysis?
                    </p>
                  </div>
                  <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: 16, marginBottom: 16 }}>
                    <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: 15, color: T.textDark }}>Question 3:</p>
                    <p style={{ margin: 0, fontSize: 14, color: T.textMid, lineHeight: 1.5 }}>
                      Or if you have any complications from diabetes? Like (Neuropathy, amputation due to diabetes, retinopathy,
                      diabetic coma, etc) Have you been treated or diagnosed with COPD, Bipolar, or schizophrenia?
                    </p>
                  </div>
                  <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: T.radiusSm, padding: 16, marginBottom: 16 }}>
                    <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: 15, color: T.textDark }}>Tobacco Usage:</p>
                    <p style={{ margin: "0 0 12px", fontSize: 14, color: T.textMid }}>Have you consumed any tobacco or nicotine products in the last 12 months?</p>
                    <div style={{ display: "flex", gap: 24 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", color: T.textDark }}>
                        <input
                          type="radio"
                          name="uw_tobacco_verify"
                          checked={underwritingData.tobaccoLast12Months === "yes"}
                          onChange={() => setUnderwritingData((prev) => ({ ...prev, tobaccoLast12Months: "yes" }))}
                          style={{ width: 18, height: 18, accentColor: T.blue }}
                        />
                        Yes
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", color: T.textDark }}>
                        <input
                          type="radio"
                          name="uw_tobacco_verify"
                          checked={underwritingData.tobaccoLast12Months === "no"}
                          onChange={() => setUnderwritingData((prev) => ({ ...prev, tobaccoLast12Months: "no" }))}
                          style={{ width: 18, height: 18, accentColor: T.blue }}
                        />
                        No
                      </label>
                    </div>
                  </div>
                  <p style={{ fontWeight: 600, fontSize: 14, margin: "0 0 12px", color: T.textMid }}>
                    Lastly, do you have any health conditions or take any prescribed medication on a regular basis?
                  </p>
                  <div style={{ padding: 16, background: T.cardBg, borderRadius: T.radiusSm, border: `1px solid ${T.border}` }}>
                    <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: 15, color: T.textDark }}>Follow Up:</p>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: T.textMid }}>
                      <li>How many medications are you taking on a daily basis?</li>
                      <li>Do you know what those medications are for?</li>
                      <li>Do you have your medications, or a list of your medications nearby?</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: T.cardBg,
                  border: `2px solid ${T.border}`,
                  borderRadius: T.radiusMd,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    backgroundColor: T.blue,
                    color: "#fff",
                    padding: "12px 20px",
                    fontWeight: 700,
                    fontSize: 15,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>Insurance Toolkit</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      style={{
                        height: 32,
                        fontSize: 13,
                        fontWeight: 600,
                        padding: "0 14px",
                        borderRadius: T.radiusSm,
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: "rgba(255,255,255,0.2)",
                        color: "#fff",
                        transition: "all 0.15s ease-in-out",
                      }}
                      onClick={() => setToolkitUrl("https://insurancetoolkits.com/fex/quoter")}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.3)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)";
                      }}
                    >
                      Quote Tool
                    </button>
                    <button
                      type="button"
                      style={{
                        height: 32,
                        fontSize: 13,
                        fontWeight: 600,
                        padding: "0 14px",
                        borderRadius: T.radiusSm,
                        border: "1px solid rgba(255,255,255,0.4)",
                        color: "#fff",
                        background: "transparent",
                        cursor: "pointer",
                        transition: "all 0.15s ease-in-out",
                      }}
                      onClick={() => setToolkitUrl("https://insurancetoolkits.com/login")}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      Login
                    </button>
                  </div>
                </div>
                <div style={{ border: `2px solid ${T.borderLight}`, borderRadius: T.radiusSm, overflow: "hidden", background: T.cardBg, flex: 1, minHeight: 500 }}>
                  <iframe
                    style={{ border: "none", height: "100%", width: "100%" }}
                    src={toolkitUrl}
                    title="Insurance Toolkit"
                    id="healthKitIframeVerify"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 8, color: T.textDark, textTransform: "uppercase", letterSpacing: "0.4px" }}>Health Conditions:</label>
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
                        padding: "6px 12px",
                        borderRadius: T.radiusSm,
                        backgroundColor: T.blueFaint,
                        border: `1px solid ${T.border}`,
                        fontSize: 13,
                        fontWeight: 600,
                        color: T.textDark,
                        fontFamily: T.font,
                        transition: "all 0.15s ease-in-out",
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        aria-label={`Remove ${tag}`}
                        onClick={() => setUnderwritingHealthTags((prev) => prev.filter((_, j) => j !== i))}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          padding: 0,
                          margin: 0,
                          lineHeight: 1,
                          fontSize: 18,
                          fontWeight: 700,
                          color: T.textMuted,
                          display: "flex",
                          alignItems: "center",
                          transition: "color 0.15s ease-in-out",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = T.danger;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = T.textMuted;
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
                  style={{
                    ...uwModalFieldStyle,
                    fontSize: 14,
                    height: 44,
                    width: "100%",
                    boxSizing: "border-box",
                    borderRadius: T.radiusSm,
                    border: `1.5px solid ${T.border}`,
                    padding: "0 14px",
                    color: T.textDark,
                    backgroundColor: T.cardBg,
                    outline: "none",
                    transition: "all 0.15s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = T.blue;
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(99, 139, 75, 0.15)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <p style={{ margin: "6px 0 0", fontSize: 12, color: T.textMuted, fontWeight: 500 }}>
                  Type custom conditions and press Enter to add.
                </p>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 8, color: T.textDark, textTransform: "uppercase", letterSpacing: "0.4px" }}>Medications:</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  {underwritingMedicationTags.map((tag, i) => (
                    <span
                      key={`m-${i}-${tag}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: T.radiusSm,
                        backgroundColor: T.blueFaint,
                        border: `1px solid ${T.border}`,
                        fontSize: 13,
                        fontWeight: 600,
                        color: T.textDark,
                        fontFamily: T.font,
                        transition: "all 0.15s ease-in-out",
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        aria-label={`Remove ${tag}`}
                        onClick={() => setUnderwritingMedicationTags((prev) => prev.filter((_, j) => j !== i))}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          padding: 0,
                          margin: 0,
                          lineHeight: 1,
                          fontSize: 18,
                          fontWeight: 700,
                          color: T.textMuted,
                          display: "flex",
                          alignItems: "center",
                          transition: "color 0.15s ease-in-out",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = T.danger;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = T.textMuted;
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
                  style={{
                    ...uwModalFieldStyle,
                    fontSize: 14,
                    height: 44,
                    width: "100%",
                    boxSizing: "border-box",
                    borderRadius: T.radiusSm,
                    border: `1.5px solid ${T.border}`,
                    padding: "0 14px",
                    color: T.textDark,
                    backgroundColor: T.cardBg,
                    outline: "none",
                    transition: "all 0.15s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = T.blue;
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(99, 139, 75, 0.15)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16, marginTop: 24 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 8, color: T.textDark, textTransform: "uppercase", letterSpacing: "0.4px" }}>Height:</label>
                <input
                  value={underwritingData.height}
                  onChange={(e) => setUnderwritingData((prev) => ({ ...prev, height: e.target.value }))}
                  placeholder="e.g., 5 ft 10 in"
                  style={{
                    ...uwModalFieldStyle,
                    fontSize: 14,
                    height: 44,
                    borderRadius: T.radiusSm,
                    border: `1.5px solid ${T.border}`,
                    padding: "0 14px",
                    color: T.textDark,
                    backgroundColor: T.cardBg,
                    outline: "none",
                    transition: "all 0.15s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = T.blue;
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(99, 139, 75, 0.15)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 8, color: T.textDark, textTransform: "uppercase", letterSpacing: "0.4px" }}>Weight:</label>
                <input
                  value={underwritingData.weight}
                  onChange={(e) => setUnderwritingData((prev) => ({ ...prev, weight: e.target.value }))}
                  placeholder="e.g., 180 lbs"
                  style={{
                    ...uwModalFieldStyle,
                    fontSize: 14,
                    height: 44,
                    borderRadius: T.radiusSm,
                    border: `1.5px solid ${T.border}`,
                    padding: "0 14px",
                    color: T.textDark,
                    backgroundColor: T.cardBg,
                    outline: "none",
                    transition: "all 0.15s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = T.blue;
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(99, 139, 75, 0.15)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 8, color: T.textDark, textTransform: "uppercase", letterSpacing: "0.4px" }}>Carrier:</label>
                {(() => {
                  const carrierSnapshot = underwritingData.carrier.trim();
                  const carrierExists = carrierSnapshot ? uwCarriers.some((c) => c.name === carrierSnapshot) : true;
                  const options = carrierExists
                    ? uwCarriers.map((c) => ({ value: c.name, label: c.name }))
                    : [{ value: carrierSnapshot, label: carrierSnapshot }, ...uwCarriers.map((c) => ({ value: c.name, label: c.name }))];
                  return (
                <StyledSelect
                  value={underwritingData.carrier}
                  onValueChange={(val) => setUnderwritingData((prev) => ({ ...prev, carrier: val, productLevel: "" }))}
                  options={options}
                  placeholder="Please Select"
                  disabled={false}
                  error={false}
                />
                  );
                })()}
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 12, color: T.textDark, textTransform: "uppercase", letterSpacing: "0.4px" }}>Product Level:</label>
                {!underwritingData.carrier.trim() ? (
                  <div style={{ ...uwModalFieldStyle, fontSize: 14, height: 44, borderRadius: T.radiusSm, display: "flex", alignItems: "center", color: T.textMuted, padding: "0 14px" }}>
                    Select carrier first
                  </div>
                ) : uwProductsLoading ? (
                  <div style={{ ...uwModalFieldStyle, fontSize: 14, height: 44, borderRadius: T.radiusSm, display: "flex", alignItems: "center", color: T.textMuted, padding: "0 14px" }}>
                    Loading products…
                  </div>
                ) : uwProducts.length === 0 ? (
                  <div style={{ ...uwModalFieldStyle, fontSize: 14, height: 44, borderRadius: T.radiusSm, display: "flex", alignItems: "center", color: T.textMuted, padding: "0 14px" }}>
                    No products for this carrier
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(() => {
                      const productSnapshot = underwritingData.productLevel.trim();
                      const productExists = productSnapshot ? uwProducts.some((p) => p.name === productSnapshot) : true;
                      if (!productSnapshot || productExists) return null;
                      return (
                        <label
                          key={`__current_product_${productSnapshot}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "12px 16px",
                            borderRadius: T.radiusSm,
                            border: `1.5px solid ${"#233217"}`,
                            backgroundColor: T.blueFaint,
                            cursor: "pointer",
                            transition: "all 0.15s ease-in-out",
                          }}
                        >
                          <input
                            type="radio"
                            name="productLevel"
                            value={productSnapshot}
                            checked
                            onChange={() => setUnderwritingData((prev) => ({ ...prev, productLevel: productSnapshot }))}
                            style={{ width: 18, height: 18, cursor: "pointer", accentColor: T.blue }}
                          />
                          <span style={{ fontSize: 14, fontWeight: 600, color: T.textDark }}>
                            {productSnapshot} <span style={{ fontWeight: 600, color: T.textMuted }}>(current)</span>
                          </span>
                        </label>
                      );
                    })()}
                    {uwProducts.map((product) => (
                      <label
                        key={product.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 16px",
                          borderRadius: T.radiusSm,
                          border: `1.5px solid ${underwritingData.productLevel === product.name ? "#233217" : T.border}`,
                          backgroundColor: underwritingData.productLevel === product.name ? T.blueFaint : T.cardBg,
                          cursor: "pointer",
                          transition: "all 0.15s ease-in-out",
                        }}
                        onMouseEnter={(e) => {
                          if (underwritingData.productLevel !== product.name) {
                            e.currentTarget.style.borderColor = T.blue;
                            e.currentTarget.style.backgroundColor = T.blueFaint;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (underwritingData.productLevel !== product.name) {
                            e.currentTarget.style.borderColor = T.border;
                            e.currentTarget.style.backgroundColor = T.cardBg;
                          }
                        }}
                      >
                        <input
                          type="radio"
                          name="productLevel"
                          value={product.name}
                          checked={underwritingData.productLevel === product.name}
                          onChange={() => setUnderwritingData((prev) => ({ ...prev, productLevel: product.name }))}
                          style={{ width: 18, height: 18, cursor: "pointer", accentColor: T.blue }}
                        />
                        <span style={{ fontSize: 14, fontWeight: 600, color: T.textDark }}>
                          {product.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 8, color: T.textDark, textTransform: "uppercase", letterSpacing: "0.4px" }}>Coverage Amount:</label>
                <input
                  value={underwritingData.coverageAmount}
                  onChange={(e) => setUnderwritingData((prev) => ({ ...prev, coverageAmount: e.target.value }))}
                  placeholder="e.g., $10,000"
                  style={{
                    ...uwModalFieldStyle,
                    fontSize: 14,
                    height: 44,
                    borderRadius: T.radiusSm,
                    border: `1.5px solid ${T.border}`,
                    padding: "0 14px",
                    color: T.textDark,
                    backgroundColor: T.cardBg,
                    outline: "none",
                    transition: "all 0.15s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = T.blue;
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(99, 139, 75, 0.15)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 8, color: T.textDark, textTransform: "uppercase", letterSpacing: "0.4px" }}>Monthly Premium:</label>
                <input
                  value={underwritingData.monthlyPremium}
                  onChange={(e) => setUnderwritingData((prev) => ({ ...prev, monthlyPremium: e.target.value }))}
                  placeholder="e.g., $50.00"
                  style={{
                    ...uwModalFieldStyle,
                    fontSize: 14,
                    height: 44,
                    borderRadius: T.radiusSm,
                    border: `1.5px solid ${T.border}`,
                    padding: "0 14px",
                    color: T.textDark,
                    backgroundColor: T.cardBg,
                    outline: "none",
                    transition: "all 0.15s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = T.blue;
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(99, 139, 75, 0.15)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: 32, borderTop: `1px solid ${T.borderLight}`, paddingTop: 24 }}>
              <div style={{ fontSize: 13, color: T.textMuted, textAlign: "center", marginBottom: 16, fontWeight: 500 }}>
                Clicking &quot;Save &amp; Verify All&quot; will save all fields below to the verification panel and mark them as verified.
              </div>
              <div style={{ display: "flex", gap: 12, width: "100%" }}>
                <button
                  type="button"
                  disabled={underwritingSaving}
                  style={{
                    border: `1.5px solid ${T.border}`,
                    background: T.cardBg,
                    borderRadius: T.radiusSm,
                    fontSize: 15,
                    fontWeight: 600,
                    padding: "12px 24px",
                    flex: 1,
                    cursor: underwritingSaving ? "not-allowed" : "pointer",
                    color: T.textDark,
                    transition: "all 0.15s ease-in-out",
                  }}
                  onClick={() => setShowUnderwritingModal(false)}
                  onMouseEnter={(e) => {
                    if (!underwritingSaving) {
                      e.currentTarget.style.borderColor = T.blue;
                      e.currentTarget.style.backgroundColor = T.blueFaint;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.backgroundColor = T.cardBg;
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={underwritingSaving}
                  style={{
                    border: "none",
                    background: underwritingSaving ? T.border : T.blue,
                    color: "#fff",
                    borderRadius: T.radiusSm,
                    fontSize: 15,
                    fontWeight: 600,
                    padding: "12px 24px",
                    flex: 1,
                    cursor: underwritingSaving ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease-in-out",
                  }}
                  onClick={() => {
                    void handleUnderwritingSaveAndVerify();
                  }}
                  onMouseEnter={(e) => {
                    if (!underwritingSaving) {
                      e.currentTarget.style.backgroundColor = T.blueHover;
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(35, 50, 23, 0.2)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!underwritingSaving) {
                      e.currentTarget.style.backgroundColor = T.blue;
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }
                  }}
                  onMouseDown={(e) => {
                    if (!underwritingSaving) {
                      e.currentTarget.style.transform = "translateY(0) scale(0.98)";
                    }
                  }}
                  onMouseUp={(e) => {
                    if (!underwritingSaving) {
                      e.currentTarget.style.transform = "translateY(-1px) scale(1)";
                    }
                  }}
                >
                  {underwritingSaving ? "Saving..." : "Save & Verify All"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
