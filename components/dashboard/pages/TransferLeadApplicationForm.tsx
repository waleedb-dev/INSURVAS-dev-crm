"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { runBlacklistDncPhoneCheck } from "@/lib/dncCheck";
import { useCarrierProductDropdowns, type CarrierProductRow } from "@/lib/useCarrierProductDropdowns";
import { Toast, type ToastType } from "@/components/ui/Toast";
import { AppSelect } from "@/components/ui/app-select";

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
  language: string;
  birthState: string;
  dateOfBirth: string;
  age: string;
  social: string;
  driverLicenseNumber: string;
  existingCoverageLast2Years: string;
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
type DncStatus = "clear" | "dnc" | "tcpa" | "error" | "idle";
type SsnDuplicateRule = {
  stage_name: string;
  ghl_stage: string | null;
  message: string;
  is_addable: boolean;
  is_active: boolean;
};
type PhoneDuplicateMatch = {
  id: string;
  lead_unique_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  stage: string | null;
  created_at: string | null;
};
type PhoneDuplicateQueryRow = {
  id: string;
  lead_unique_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
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

const usStates = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const FIXED_BPO_LEAD_SOURCE = "BPO Transfer Lead Source";

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

function buildFormState(initial?: Partial<TransferLeadFormData>): TransferLeadFormData {
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
    language: "English",
    birthState: "",
    dateOfBirth: "",
    age: "",
    social: "",
    driverLicenseNumber: "",
    existingCoverageLast2Years: "",
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
    leadSource: FIXED_BPO_LEAD_SOURCE,
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

export default function TransferLeadApplicationForm({
  onBack,
  onSubmit,
  onSaveDraft,
  onInstantDuplicateCheck,
  initialData,
  submitButtonLabel,
  centerName = ""
}: {
  onBack: () => void;
  onSubmit: (data: TransferLeadFormData) => void;
  onSaveDraft?: (data: TransferLeadFormData) => void;
  onInstantDuplicateCheck?: (data: TransferLeadFormData) => void | Promise<void>;
  initialData?: Partial<TransferLeadFormData>;
  submitButtonLabel?: string;
  centerName?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const [showUnderwritingModal, setShowUnderwritingModal] = useState(false);
  const [conditionInput, setConditionInput] = useState("");
  const [medicationInput, setMedicationInput] = useState("");
  const [toolkitUrl, setToolkitUrl] = useState("https://insurancetoolkits.com/login");
  const [dncChecking, setDncChecking] = useState(false);
  const [dncStatus, setDncStatus] = useState<DncStatus>("idle");
  const [dncMessage, setDncMessage] = useState("");
  /** Same DNC/TCPA modal as verification panel (Call Center Lead Intake + transfer flows). */
  const [showDncModal, setShowDncModal] = useState(false);
  const [phoneDupChecking, setPhoneDupChecking] = useState(false);
  const [showPhoneDupDetails, setShowPhoneDupDetails] = useState(false);
  const [phoneDupMatch, setPhoneDupMatch] = useState<PhoneDuplicateMatch | null>(null);
  const [phoneDupRuleMessage, setPhoneDupRuleMessage] = useState("");
  const [phoneDupIsAddable, setPhoneDupIsAddable] = useState(true);
  const [ssnCheckState, setSsnCheckState] = useState<SsnCheckState>("idle");
  const [ssnCheckMessage, setSsnCheckMessage] = useState("");
  const [lastCheckedSsn, setLastCheckedSsn] = useState("");
  const [lastAutoCheckedSsn, setLastAutoCheckedSsn] = useState("");
  const [showSsnDupDetails, setShowSsnDupDetails] = useState(false);
  const [ssnDupMatch, setSsnDupMatch] = useState<SsnDuplicateMatch | null>(null);
  const [ssnDupIsAddable, setSsnDupIsAddable] = useState(true);
  const [underwritingData, setUnderwritingData] = useState({
    tobaccoLast12Months: "",
    healthConditions: [] as string[],
    medications: [] as string[],
    height: "",
    weight: "",
    carrier: "",
    productLevel: "",
    coverageAmount: "",
    monthlyPremium: "",
  });
  const [submitHighlightKeys, setSubmitHighlightKeys] = useState<Set<keyof TransferLeadFormData>>(() => new Set());
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const displayBpoName = (centerName || "").trim() || "BPO";

  const [formData, setFormData] = useState<TransferLeadFormData>(() => buildFormState(initialData));
    // Always force leadSource to the fixed value
    useEffect(() => {
      setFormData((prev) => ({ ...prev, leadSource: FIXED_BPO_LEAD_SOURCE }));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

  useEffect(() => {
    if (!initialData) return;
    setFormData(buildFormState(initialData));
  }, [initialData]);

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

  const { carriers, productsForCarrier, loadingProducts: policyCarrierProductsLoading } =
    useCarrierProductDropdowns(
      supabase,
      {
        open: true,
        carrierName: formData.carrier,
        onInvalidateProduct: onInvalidatePolicyProduct,
      },
    );

  const { productsForCarrier: uwProductsForCarrier, loadingProducts: uwCarrierProductsLoading } =
    useCarrierProductDropdowns(
    supabase,
    {
      open: showUnderwritingModal,
      carrierName: underwritingData.carrier,
      onInvalidateProduct: onInvalidateUwProduct,
    },
    );

  const phoneError = formData.phone.length > 0 && !getUsPhone10Digits(formData.phone);
  const ssnDigits = normalizeSsnDigits(formData.social);
  const ssnError = formData.social.trim().length > 0 && ssnDigits.length !== 9;

  const fieldStyleWithError = (key: keyof TransferLeadFormData, extra?: CSSProperties): CSSProperties => {
    const error = submitHighlightKeys.has(key);
    return {
      ...fieldStyle,
      ...extra,
      ...(error ? { border: `2px solid ${T.danger}` } : {}),
    };
  };

  const computedLeadUniqueId = useMemo(() => {
    // 2 number phones + three letter from names + SSN last 2 digits + center ki 2 letters
    const phoneDigits = formData.phone.replace(/\D/g, "");
    const phone2 = phoneDigits.slice(0, 2);
    const nameLetters = `${formData.firstName}${formData.lastName}`.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
    const socialDigits = formData.social.replace(/\D/g, "");
    const ssn2 = socialDigits.slice(-2);
    const center2 = (centerName || "").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
    if (!phone2 || nameLetters.length < 3 || ssn2.length < 2 || center2.length < 2) {
      return (formData.leadUniqueId || "").toUpperCase();
    }
    return `${phone2}${nameLetters}${ssn2}${center2}`.toUpperCase();
  }, [formData.firstName, formData.lastName, formData.phone, formData.social, formData.leadUniqueId, centerName]);

  const set = (key: keyof TransferLeadFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));

  const checkPhoneDuplicate = async (): Promise<{ match: PhoneDuplicateMatch | null; isAddable: boolean }> => {
    const canonicalDigits = getUsPhone10Digits(formData.phone);
    if (!canonicalDigits) {
      setPhoneDupMatch(null);
      setPhoneDupRuleMessage("");
      setPhoneDupIsAddable(true);
      return { match: null, isAddable: true };
    }

    setPhoneDupChecking(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || null;
      if (!currentUserId) {
        setPhoneDupMatch(null);
        setPhoneDupRuleMessage("");
        setPhoneDupIsAddable(true);
        return { match: null, isAddable: true };
      }

      const rawDigits = normalizePhoneDigits(formData.phone);
      const variants = Array.from(new Set([formData.phone.trim(), rawDigits, canonicalDigits, formatUsPhone(canonicalDigits)].filter(Boolean)));
      const { data: existing, error: existingError } = await supabase
        .from("leads")
        .select("id, lead_unique_id, first_name, last_name, phone, stage, created_at")
        .eq("submitted_by", currentUserId)
        .in("phone", variants)
        .order("created_at", { ascending: false });

      if (existingError) {
        throw new Error(existingError.message || "Unable to check phone duplicates.");
      }

      const match =
        ((existing || []) as PhoneDuplicateQueryRow[]).find(
          (row) => getUsPhone10Digits(String(row.phone || "")) === canonicalDigits,
        ) || null;
      if (!match) {
        setPhoneDupMatch(null);
        setPhoneDupRuleMessage("No existing lead found for this phone number.");
        setPhoneDupIsAddable(true);
        return { match: null, isAddable: true };
      }

      const { data: rulesData, error: rulesError } = await supabase
        .from("ssn_duplicate_stage_rules")
        .select("stage_name, ghl_stage, message, is_addable, is_active")
        .eq("is_active", true);

      if (rulesError) {
        throw new Error(rulesError.message || "Unable to load duplicate rules.");
      }

      const rules = ((rulesData || []) as SsnDuplicateRule[]).map((rule) => ({
        ...rule,
        stage_name: String(rule.stage_name || "").trim(),
        ghl_stage: String(rule.ghl_stage || "").trim() || null,
      }));
      const ruleByGhlStage = new Map<string, SsnDuplicateRule>();
      rules.forEach((rule) => {
        if (rule.ghl_stage) ruleByGhlStage.set(rule.ghl_stage.toLowerCase(), rule);
      });

      const stage = String(match.stage || "").trim();
      const rule = stage ? ruleByGhlStage.get(stage.toLowerCase()) : undefined;
      const ghlStage = rule?.ghl_stage ? ` (GHL: ${rule.ghl_stage})` : "";
      const baseMessage = rule?.message || "A lead already exists with this phone number.";

      const mapped: PhoneDuplicateMatch = {
        id: String(match.id),
        lead_unique_id: match.lead_unique_id ?? null,
        first_name: match.first_name ?? null,
        last_name: match.last_name ?? null,
        phone: match.phone ?? null,
        stage: match.stage ?? null,
        created_at: match.created_at ?? null,
      };

      setPhoneDupMatch(mapped);
      setPhoneDupRuleMessage(`${baseMessage}${stage ? ` Stage: ${stage}.` : ""}${ghlStage}`);
      setPhoneDupIsAddable(rule?.is_addable ?? true);
      return { match: mapped, isAddable: rule?.is_addable ?? true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to check phone duplicates.";
      setPhoneDupMatch(null);
      setPhoneDupRuleMessage(message);
      setPhoneDupIsAddable(true);
      return { match: null, isAddable: true };
    } finally {
      setPhoneDupChecking(false);
    }
  };

  const checkDnc = async (): Promise<DncStatus> => {
    const cleanPhone = getUsPhone10Digits(formData.phone);
    if (!cleanPhone) {
      setDncStatus("error");
      setDncMessage("Please enter a valid 10-digit number or 11 digits starting with 1.");
      return "error";
    }

    setDncChecking(true);
    setDncStatus("idle");
    setDncMessage("");

    try {
      const dup = await checkPhoneDuplicate();
      if (dup.match) setShowPhoneDupDetails(true);

      const { status: resolvedStatus, message } = await runBlacklistDncPhoneCheck(supabase, cleanPhone);

      setDncStatus(resolvedStatus);
      setDncMessage(message);
      setShowDncModal(true);
      return resolvedStatus;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to check DNC status.";
      setDncStatus("error");
      setDncMessage(message);
      setShowDncModal(true);
      return "error";
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

  const isEditMode = (submitButtonLabel || "").toLowerCase().includes("update");
  const [phoneGatePassed, setPhoneGatePassed] = useState(isEditMode);
  useEffect(() => {
    if (isEditMode) setPhoneGatePassed(true);
  }, [isEditMode]);

  const duplicateBlocked = Boolean(phoneDupMatch && !phoneDupIsAddable);
  const submitBlockMessage =
    ssnCheckState === "blocked"
      ? ssnCheckMessage
      : dncStatus === "tcpa"
        ? (dncMessage || "This number is flagged as TCPA/blacklisted. Submission is disabled.")
        : duplicateBlocked
          ? (phoneDupRuleMessage || "A matching lead exists and duplicate creation is not allowed.")
          : "";
  const submitDisabled = Boolean(submitBlockMessage);

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
        .eq("submitted_by", currentUserId)
        .in("social", variants)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message || "Unable to validate SSN.");
      }

      const matches = (data || []).filter((row) => normalizeSsnDigits(String(row.social || "")) === ssnDigits);
      const { data: rulesData, error: rulesError } = await supabase
        .from("ssn_duplicate_stage_rules")
        .select("stage_name, ghl_stage, message, is_addable, is_active")
        .eq("is_active", true);

      if (rulesError) {
        throw new Error(rulesError.message || "Unable to load SSN duplicate rules.");
      }

      const rules = ((rulesData || []) as SsnDuplicateRule[]).map((rule) => ({
        ...rule,
        stage_name: String(rule.stage_name || "").trim(),
        ghl_stage: String(rule.ghl_stage || "").trim() || null,
      }));

      const ruleByGhlStage = new Map<string, SsnDuplicateRule>();
      rules.forEach((rule) => {
        if (rule.ghl_stage) {
          ruleByGhlStage.set(rule.ghl_stage.toLowerCase(), rule);
        }
      });

      const leadWithRule = matches.map((row) => {
        const stage = String(row.stage || "").trim();
        return {
          row,
          rule: stage ? ruleByGhlStage.get(stage.toLowerCase()) : undefined,
        };
      });
      const blockedLead = leadWithRule.find((item) => item.rule && item.rule.is_addable === false);
      const warningLead = leadWithRule.find((item) => item.rule && item.rule.is_addable === true);
      const detailRow = blockedLead?.row || warningLead?.row || matches[0] || null;

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

      if (blockedLead?.rule) {
        const leadName = `${blockedLead.row.first_name || ""} ${blockedLead.row.last_name || ""}`.trim() || "existing lead";
        const ghlStage = blockedLead.rule.ghl_stage ? ` (GHL: ${blockedLead.rule.ghl_stage})` : "";
        setSsnCheckState("blocked");
        setSsnDupIsAddable(false);
        setSsnCheckMessage(
          `${blockedLead.rule.message} Existing lead: ${leadName}.${ghlStage}`,
        );
        return { blocked: true, warning: false };
      }

      if (warningLead?.rule) {
        const ghlStage = warningLead.rule.ghl_stage ? ` (GHL: ${warningLead.rule.ghl_stage})` : "";
        setSsnCheckState("warning");
        setSsnDupIsAddable(true);
        setSsnCheckMessage(
          `${warningLead.rule.message}${ghlStage}`,
        );
        return { blocked: false, warning: true };
      }

      if (matches.length > 0) {
        setSsnCheckState("warning");
        setSsnDupIsAddable(true);
        setSsnCheckMessage("An existing lead with this SSN was found. Review details before submitting.");
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

  const toTagParts = (raw: string) =>
    String(raw || "")
      .split(/[\n,]/)
      .map((part) => part.trim())
      .filter(Boolean);

  const mergeUniqueTags = (existing: string[], incoming: string[]) => {
    const seen = new Set(existing.map((item) => item.toLowerCase()));
    const merged = [...existing];
    incoming.forEach((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    });
    return merged;
  };

  const addTag = (raw: string, key: "healthConditions" | "medications") => {
    const values = toTagParts(raw);
    if (values.length === 0) return;
    setUnderwritingData((prev) => ({
      ...prev,
      [key]: mergeUniqueTags(prev[key], values),
    }));
  };

  const removeTag = (key: "healthConditions" | "medications", index: number) => {
    setUnderwritingData((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  };

  const openUnderwritingModal = () => {
    const healthConditions = formData.healthConditions
      ? formData.healthConditions.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
    const medications = formData.medications
      ? formData.medications.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

    setUnderwritingData({
      tobaccoLast12Months: formData.tobaccoUse.toLowerCase().includes("yes")
        ? "yes"
        : formData.tobaccoUse.toLowerCase().includes("no")
          ? "no"
          : "",
      healthConditions,
      medications,
      height: formData.height,
      weight: formData.weight,
      carrier: formData.carrier,
      productLevel: formData.productType,
      coverageAmount: formData.coverageAmount,
      monthlyPremium: formData.monthlyPremium,
    });
    setConditionInput("");
    setMedicationInput("");
    setShowUnderwritingModal(true);
  };

  const saveUnderwritingToForm = () => {
    const mergedHealthConditions = mergeUniqueTags(
      underwritingData.healthConditions,
      toTagParts(conditionInput),
    );
    const mergedMedications = mergeUniqueTags(
      underwritingData.medications,
      toTagParts(medicationInput),
    );

    setFormData((prev) => ({
      ...prev,
      tobaccoUse: underwritingData.tobaccoLast12Months
        ? underwritingData.tobaccoLast12Months === "yes"
          ? "Yes"
          : "No"
        : prev.tobaccoUse,
      healthConditions: mergedHealthConditions.join(", "),
      medications: mergedMedications.join(", "),
      height: underwritingData.height,
      weight: underwritingData.weight,
      carrier: underwritingData.carrier,
      productType: underwritingData.productLevel,
      coverageAmount: underwritingData.coverageAmount.replace(/\$/g, "").replace(/,/g, ""),
      monthlyPremium: underwritingData.monthlyPremium.replace(/\$/g, "").replace(/,/g, ""),
    }));
    setConditionInput("");
    setMedicationInput("");
    setShowUnderwritingModal(false);
  };

  return (
    <div style={{ fontFamily: T.font }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 24, gap: 16 }}>
        <button
          onClick={onBack}
          style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 10, width: 40, height: 40, cursor: "pointer", color: T.textMid, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: T.textDark, fontWeight: 800 }}>{displayBpoName} Application</h1>
          <p style={{ margin: "4px 0 0", color: T.textMuted, fontWeight: 600, fontSize: 13 }}>All information needed to track sales for Live Transfers</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Section: Lead Info */}
        <Section title="Lead Information" icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/></svg>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Date of Submission *">
              <input type="date" value={formData.submissionDate} onChange={set("submissionDate")} style={fieldStyleWithError("submissionDate")} />
            </Field>
            <Field label="Phone Number *">
              <div style={{ position: "relative" }}>
                <input
                  placeholder="Enter 10 or 11 digits"
                  value={formData.phone}
                  onChange={(e) => {
                    set("phone")(e);
                    if (!isEditMode) setPhoneGatePassed(false);
                    setDncStatus("idle");
                    setDncMessage("");
                    setShowDncModal(false);
                    setPhoneDupMatch(null);
                    setPhoneDupRuleMessage("");
                    setPhoneDupIsAddable(true);
                    setShowPhoneDupDetails(false);
                  }}
                  style={{
                    ...fieldStyle,
                    ...(submitHighlightKeys.has("phone") || phoneError ? { border: `2px solid ${T.danger}` } : {}),
                    paddingRight: 120,
                    width: "100%",
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const dup = await checkPhoneDuplicate();
                    if (dup.match) setShowPhoneDupDetails(true);
                    if (dup.match && !dup.isAddable) {
                      setPhoneGatePassed(false);
                      return;
                    }
                    const dncResult = await checkDnc();
                    setPhoneGatePassed(dncResult !== "tcpa");
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
                      dncStatus === "error" || dncStatus === "tcpa" ? T.danger : dncStatus === "dnc" ? "#b45309" : "#166534",
                  }}
                >
                  {dncMessage}
                </div>
              )}
              <div style={{ fontSize: 11, color: phoneError ? T.danger : T.textMuted, marginTop: 4 }}>
                {phoneError ? "Please enter a valid phone number (10 digits or 11 digits starting with 1)." : "Enter 10 digits, or 11 digits if it starts with 1."}
              </div>
              {!isEditMode && !phoneGatePassed && (
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                  Run phone check first to unlock the full application form.
                </div>
              )}
            </Field>
            <Field label="Language *">
              <AppSelect value={formData.language} onChange={(e: any) => set("language")(e)} style={fieldStyleWithError("language")}>
                <option value="">Select language</option>
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
              </AppSelect>
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
                  📞 Phone Duplicate Found
                </h3>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: T.textMuted }}>
                  {phoneDupRuleMessage || "A lead already exists with this phone number."}
                </p>
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
                <div style={{ fontSize: 16, fontWeight: 800, color: T.textDark }}>
                  {(phoneDupMatch.first_name || "")} {(phoneDupMatch.last_name || "")}
                </div>
                <div style={{ marginTop: 4, fontSize: 13, color: "#6b7a5f", fontWeight: 700 }}>
                  Stage: {phoneDupMatch.stage || "Unknown"}
                </div>
              </div>
            )}
          </div>
        )}

        {phoneGatePassed && (
          <>
            {/* Section: Personal Info */}
            <Section title="Personal Information" icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label="First Name *">
                  <input value={formData.firstName} onChange={set("firstName")} style={fieldStyleWithError("firstName")} />
                </Field>
                <Field label="Last Name *">
                  <input value={formData.lastName} onChange={set("lastName")} style={fieldStyleWithError("lastName")} />
                </Field>
                <Field label="Date of Birth *">
                  <input type="date" value={formData.dateOfBirth} onChange={set("dateOfBirth")} style={fieldStyleWithError("dateOfBirth")} />
                </Field>
                <Field label="Age *">
                  <input value={formData.age} onChange={set("age")} style={fieldStyleWithError("age")} />
                </Field>
                <Field label="Social Security Number *">
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
                <Field label="Driver License Number *">
                  <input value={formData.driverLicenseNumber} onChange={set("driverLicenseNumber")} style={fieldStyleWithError("driverLicenseNumber")} />
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

            {/* Section: Contact & Address */}
            <Section title="Contact & Address" icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            }>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label="Street Address *" full>
                  <input placeholder="Street Address" value={formData.street1} onChange={set("street1")} style={fieldStyleWithError("street1")} />
                </Field>
                <Field label="Address Line 2" full>
                  <input placeholder="Apt, Suite, Unit (optional)" value={formData.street2} onChange={set("street2")} style={fieldStyle} />
                </Field>
                <Field label="City *">
                  <input value={formData.city} onChange={set("city")} style={fieldStyleWithError("city")} />
                </Field>
                <Field label="State *">
                  <AppSelect value={formData.state} onChange={(e: any) => set("state")(e)} style={fieldStyleWithError("state")}>
                    <option value="">Please Select</option>
                    {usStates.map((s) => <option key={s} value={s}>{s}</option>)}
                  </AppSelect>
                </Field>
                <Field label="Zip Code *">
                  <input value={formData.zipCode} onChange={set("zipCode")} style={fieldStyleWithError("zipCode")} />
                </Field>
                <Field label="Birth State *">
                  <AppSelect value={formData.birthState} onChange={(e: any) => set("birthState")(e)} style={fieldStyleWithError("birthState")}>
                    <option value="">Please Select</option>
                    {usStates.map((s) => <option key={s} value={s}>{s}</option>)}
                  </AppSelect>
                </Field>
              </div>
            </Section>

            {/* Section: Health */}
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
                <Field label="Any existing / previous coverage in last 2 years? *">
                  <YesNo value={formData.existingCoverageLast2Years} onChange={(v) => setFormData((p) => ({ ...p, existingCoverageLast2Years: v }))} hasError={submitHighlightKeys.has("existingCoverageLast2Years")} />
                </Field>
                <Field label="Any previous applications in 2 years? *">
                  <YesNo value={formData.previousApplications2Years} onChange={(v) => setFormData((p) => ({ ...p, previousApplications2Years: v }))} hasError={submitHighlightKeys.has("previousApplications2Years")} />
                </Field>
                <Field label="Height *">
                  <input placeholder='e.g. 5&apos;10"' value={formData.height} onChange={set("height")} style={fieldStyleWithError("height")} />
                </Field>
                <Field label="Weight *">
                  <input placeholder="e.g. 175 lbs" value={formData.weight} onChange={set("weight")} style={fieldStyleWithError("weight")} />
                </Field>
                <Field label="Doctor's Name *">
                  <input value={formData.doctorName} onChange={set("doctorName")} style={fieldStyleWithError("doctorName")} />
                </Field>
                <Field label="Tobacco Use *">
                  <YesNo value={formData.tobaccoUse} onChange={(v) => setFormData((p) => ({ ...p, tobaccoUse: v }))} hasError={submitHighlightKeys.has("tobaccoUse")} />
                </Field>
                <Field label="Health Conditions *" full>
                  <textarea value={formData.healthConditions} onChange={set("healthConditions")} style={{ ...fieldStyleWithError("healthConditions"), minHeight: 80, resize: "vertical" }} />
                </Field>
                <Field label="Medications *" full>
                  <textarea value={formData.medications} onChange={set("medications")} style={{ ...fieldStyleWithError("medications"), minHeight: 80, resize: "vertical" }} />
                </Field>
              </div>
            </Section>

            {/* Section: Policy */}
            <Section title="Policy Details" icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            }>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label="Monthly Premium *">
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 600, color: T.textMuted }}>$</span>
                    <input value={formData.monthlyPremium} onChange={set("monthlyPremium")} style={fieldStyleWithError("monthlyPremium", { paddingLeft: 28 })} />
                  </div>
                </Field>
                <Field label="Coverage Amount *">
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 600, color: T.textMuted }}>$</span>
                    <input value={formData.coverageAmount} onChange={set("coverageAmount")} style={fieldStyleWithError("coverageAmount", { paddingLeft: 28 })} />
                  </div>
                </Field>
                <Field label="Carrier *">
                  <AppSelect
                    value={formData.carrier}
                    onChange={(e: any) => {
                      const nextCarrier = e.target.value;
                      setFormData((prev) => ({ ...prev, carrier: nextCarrier, productType: "" }));
                    }}
                    style={fieldStyleWithError("carrier")}
                  >
                    <option value="">Please Select</option>
                    {carriers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </AppSelect>
                </Field>
                <Field label="Product Type *">
                  <AppSelect
                    value={formData.productType}
                    onChange={(e: any) => set("productType")(e)}
                    style={fieldStyleWithError("productType")}
                    disabled={!formData.carrier.trim() || policyCarrierProductsLoading}
                  >
                    <option value="">Please Select</option>
                    {productsForCarrier.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </AppSelect>
                </Field>
                <Field label="Draft Date *">
                  <input type="date" value={formData.draftDate} onChange={set("draftDate")} style={fieldStyleWithError("draftDate")} />
                </Field>
                <Field label="Future Draft Date *">
                  <input type="date" value={formData.futureDraftDate} onChange={set("futureDraftDate")} style={fieldStyleWithError("futureDraftDate")} />
                </Field>
                <Field label="Beneficiary Information *" full>
                  <textarea value={formData.beneficiaryInformation} onChange={set("beneficiaryInformation")} style={{ ...fieldStyleWithError("beneficiaryInformation"), minHeight: 72, resize: "vertical" }} />
                </Field>
              </div>
            </Section>

            {/* Section: Banking */}
            <Section title="Banking Information" icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            }>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label="Bank Account Type">
                  <AppSelect value={formData.bankAccountType} onChange={(e: any) => set("bankAccountType")(e)} style={fieldStyle}>
                    <option value="">Please Select</option>
                    <option value="Checking">Checking</option>
                    <option value="Savings">Savings</option>
                  </AppSelect>
                </Field>
                <Field label="Institution Name *">
                  <input value={formData.institutionName} onChange={set("institutionName")} style={fieldStyleWithError("institutionName")} />
                </Field>
                <Field label="Routing Number *">
                  <input value={formData.routingNumber} onChange={set("routingNumber")} style={fieldStyleWithError("routingNumber")} />
                </Field>
                <Field label="Account Number *">
                  <input value={formData.accountNumber} onChange={set("accountNumber")} style={fieldStyleWithError("accountNumber")} />
                </Field>
              </div>
            </Section>

            {/* Section: Additional */}
            <Section title="Additional Information" icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            }>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label="Additional Notes" full>
                  <textarea value={formData.additionalInformation} onChange={set("additionalInformation")} style={{ ...fieldStyle, minHeight: 96, resize: "vertical" }} />
                </Field>
              </div>
            </Section>
          </>
        )}

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
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {underwritingData.healthConditions.map((tag, idx) => (
                    <span key={`${tag}-${idx}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#f3f4f6", borderRadius: 999, padding: "6px 12px", fontSize: 18 }}>
                      {tag}
                      <button type="button" onClick={() => removeTag("healthConditions", idx)} aria-label={`Remove ${tag}`} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                        x
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(conditionInput, "healthConditions");
                      setConditionInput("");
                    }
                  }}
                  placeholder="Type and press Enter to add conditions..."
                  style={{ ...fieldStyle, fontSize: 24, height: 48 }}
                />
              </div>
              <p style={{ fontSize: 14, color: "#6b7a5f", marginTop: 8 }}>Click on conditions above to add them, or type custom conditions.</p>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 24, fontWeight: 800, display: "block", marginBottom: 8 }}>Medications:</label>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {underwritingData.medications.map((tag, idx) => (
                    <span key={`${tag}-${idx}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#f3f4f6", borderRadius: 999, padding: "6px 12px", fontSize: 18 }}>
                      {tag}
                      <button type="button" onClick={() => removeTag("medications", idx)} aria-label={`Remove ${tag}`} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                        x
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  value={medicationInput}
                  onChange={(e) => setMedicationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(medicationInput, "medications");
                      setMedicationInput("");
                    }
                  }}
                  placeholder="Type and press Enter to add medications..."
                  style={{ ...fieldStyle, fontSize: 24, height: 48 }}
                />
              </div>
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
              backgroundColor: "#fff",
              borderRadius: 12,
              border: dncStatus === "tcpa" ? "2px solid #3b5229" : `1.5px solid ${T.border}`,
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
              padding: 18,
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: 26,
                color:
                  dncStatus === "tcpa"
                    ? "#dc2626"
                    : dncStatus === "dnc"
                      ? "#ea580c"
                      : dncStatus === "error"
                        ? "#dc2626"
                        : T.blue,
              }}
            >
              {dncStatus === "tcpa"
                ? "TCPA LITIGATOR WARNING"
                : dncStatus === "dnc"
                  ? "Do Not Call List"
                  : dncStatus === "error"
                    ? "DNC Check Failed"
                    : "Phone Verification"}
            </h4>
            <p style={{ margin: "8px 0 0", fontSize: 16, color: T.textMid, lineHeight: 1.45 }}>
              {dncStatus === "tcpa"
                ? "This number is flagged as a TCPA Litigator. Proceeding may result in legal issues."
                : dncStatus === "error"
                  ? dncMessage
                  : "Please read the following script to the customer to obtain verbal consent."}
            </p>

            {dncStatus === "tcpa" && (
              <div style={{ padding: "16px 0" }}>
                <p style={{ color: "#dc2626", fontWeight: 800, textAlign: "center", fontSize: 30, margin: 0 }}>
                  WARNING: This number is a TCPA LITIGATOR
                </p>
                <p style={{ fontSize: 18, color: T.textMid, textAlign: "center", margin: "12px 0 0" }}>
                  This number has been flagged as a TCPA litigator. It is recommended to NOT proceed with this lead.
                </p>
              </div>
            )}

            {(dncStatus === "clear" || dncStatus === "dnc") && (
              <div style={{ padding: "16px 0" }}>
                {dncStatus === "dnc" && (
                  <p style={{ color: "#ea580c", fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}>
                    This number is on the Do Not Call list.
                  </p>
                )}
                <div style={{ backgroundColor: "#f8fafc", padding: 18, borderRadius: 10, border: "2px solid #c8d4bb" }}>
                  <p style={{ fontSize: 20, margin: "0 0 12px", fontWeight: 600, lineHeight: 1.45 }}>
                    Is your phone number <span style={{ color: T.blue, fontWeight: 800 }}>{formData.phone || ""}</span> on the
                    Federal, National or State Do Not Call List?
                  </p>
                  <p style={{ color: T.textMuted, fontSize: 13, margin: "0 0 10px" }}>
                    If a customer says no and we see it is on DNC, we still need verbal consent.
                  </p>
                  <p style={{ fontSize: 20, margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
                    Sir/Ma&apos;am, even if your phone number is on the Federal National or State Do Not Call list, do we still
                    have your permission to call you and submit your application for insurance to{" "}
                    <span style={{ color: T.blue, fontWeight: 800 }}>{formData.carrier || "selected carrier"}</span> via your
                    phone number <span style={{ color: T.blue, fontWeight: 800 }}>{formData.phone || ""}</span>? And do we have
                    your permission to call you on the same phone number in the future if needed?
                  </p>
                  <p style={{ fontSize: 15, color: T.textMid, margin: "12px 0 0", fontWeight: 700 }}>
                    Make sure you get a clear YES on it.
                  </p>
                </div>
                {dncMessage ? (
                  <p style={{ marginTop: 12, fontSize: 13, color: T.textMuted, fontWeight: 600, lineHeight: 1.45 }}>{dncMessage}</p>
                ) : null}
              </div>
            )}

            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowDncModal(false)}
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
                {dncStatus === "tcpa" ? "Close" : "Cancel"}
              </button>
              {dncStatus !== "tcpa" && dncStatus !== "error" && (
                <button
                  type="button"
                  onClick={() => setShowDncModal(false)}
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

      {/* Submit */}
      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 12 }}>
        <button
          onClick={onBack}
          style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, padding: "11px 24px", fontWeight: 700, cursor: "pointer", fontFamily: T.font, fontSize: 14, color: T.textMid }}
        >
          Cancel
        </button>
        {phoneGatePassed && onSaveDraft && (
          <button
            onClick={() => onSaveDraft({ ...formData, leadUniqueId: computedLeadUniqueId, isDraft: true })}
            style={{
              background: "#fff",
              border: `1.5px solid ${T.blue}`,
              borderRadius: T.radiusMd,
              padding: "11px 24px",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: T.font,
              fontSize: 14,
              color: T.blue,
            }}
          >
            Save Draft
          </button>
        )}
        {phoneGatePassed && (
          <button
            onClick={async () => {
              const missingKeys = REQUIRED_FORM_KEYS.filter((key) => !String(formData[key] ?? "").trim());
              const highlight = new Set<keyof TransferLeadFormData>(missingKeys);
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
              const dncResult = await checkDnc();
              if (dncResult === "tcpa") return;
              onSubmit({ ...formData, leadUniqueId: computedLeadUniqueId });
            }}
            disabled={submitDisabled}
            style={{
              backgroundColor: submitDisabled ? T.border : T.blue,
              color: "#fff",
              border: "none",
              borderRadius: T.radiusMd,
              padding: "11px 28px",
              fontWeight: 800,
              cursor: submitDisabled ? "not-allowed" : "pointer",
              fontFamily: T.font,
              fontSize: 14,
              boxShadow: submitDisabled ? "none" : `0 4px 12px ${T.blue}44`,
              transition: "all 0.15s",
            }}
          >
            {submitButtonLabel || "Submit Application"}
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
    </div>
  );
}

function Section({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusLg, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: "#fafcff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: T.blue }}>{icon}</span>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.textDark }}>{title}</h2>
        </div>
        {action}
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  );
}

function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "span 2" : "span 1" }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function YesNo({ value, onChange, hasError }: { value: string; onChange: (value: string) => void; hasError?: boolean }) {
  return (
    <AppSelect value={value} onChange={(e: any) => onChange(e.target.value)} style={{
      width: "100%",
      padding: "11px 14px",
      borderRadius: 8,
      border: hasError ? `2px solid ${T.danger}` : `1.5px solid ${T.border}`,
      fontSize: 14,
      color: T.textDark,
      outline: "none",
      fontFamily: T.font,
      backgroundColor: "#fff",
      boxSizing: "border-box",
    }}>
      <option value="">Please Select</option>
      <option value="Yes">Yes</option>
      <option value="No">No</option>
    </AppSelect>
  );
}

