import type { SupabaseClient } from "@supabase/supabase-js";
import { runDncLookup } from "@/lib/dncLookupApi";
import { runTransferCheck, TRANSFER_CHECK_CLEAR_USER_MESSAGE } from "@/lib/transferCheckApi";

export type TransferCheckApiResponse = {
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

export function formatTransferCheckValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

/** Omit `dnc` from API `data` in the modal — DNC is used only for TCPA logic, not shown to agents. */
export function transferCheckDataEntriesForModal(data: Record<string, unknown> | undefined): [string, unknown][] {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data).filter(([k]) => k.toLowerCase() !== "dnc");
}

function normalizePhoneDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

export function getUsPhone10Digits(value: string): string | null {
  const digits = normalizePhoneDigits(value);
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return null;
}

export type TransferScreeningSnapshot = {
  noPhoneSkip: boolean;
  transferCheckData: TransferCheckApiResponse | null;
  transferCheckMessage: string;
  transferCheckError: string | null;
  tcpaBlocked: boolean;
  tcpaBlockReason: string;
  agencyDqBlocked: boolean;
  dncListBlocked: boolean;
  phoneInvalidBlocked: boolean;
};

/** Initial state before a screening run completes */
export const IDLE_TRANSFER_SCREENING: TransferScreeningSnapshot = {
  noPhoneSkip: false,
  transferCheckData: null,
  transferCheckMessage: "",
  transferCheckError: null,
  tcpaBlocked: false,
  tcpaBlockReason: "",
  agencyDqBlocked: false,
  dncListBlocked: false,
  phoneInvalidBlocked: false,
};

/** Stored on `lead_queue_items.transfer_screening_json` (versioned for migrations). */
export type PersistedTransferScreeningV1 = {
  v: 1;
  noPhoneSkip: boolean;
  transferCheckMessage: string;
  transferCheckError: string | null;
  tcpaBlocked: boolean;
  agencyDqBlocked: boolean;
  dncListBlocked: boolean;
  phoneInvalidBlocked: boolean;
};

export function snapshotToPersistedPayload(snapshot: TransferScreeningSnapshot): PersistedTransferScreeningV1 {
  return {
    v: 1,
    noPhoneSkip: snapshot.noPhoneSkip,
    transferCheckMessage: snapshot.transferCheckMessage,
    transferCheckError: snapshot.transferCheckError,
    tcpaBlocked: snapshot.tcpaBlocked,
    agencyDqBlocked: snapshot.agencyDqBlocked,
    dncListBlocked: snapshot.dncListBlocked,
    phoneInvalidBlocked: snapshot.phoneInvalidBlocked,
  };
}

export function parsePersistedTransferScreening(raw: unknown): PersistedTransferScreeningV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  return {
    v: 1,
    noPhoneSkip: Boolean(o.noPhoneSkip),
    transferCheckMessage: String(o.transferCheckMessage ?? ""),
    transferCheckError:
      o.transferCheckError == null || o.transferCheckError === ""
        ? null
        : String(o.transferCheckError),
    tcpaBlocked: Boolean(o.tcpaBlocked),
    agencyDqBlocked: Boolean(o.agencyDqBlocked),
    dncListBlocked: Boolean(o.dncListBlocked),
    phoneInvalidBlocked: Boolean(o.phoneInvalidBlocked),
  };
}

export type TransferScreeningBadgeTone = "critical" | "warning" | "error" | "success" | "muted";

export function transferScreeningBadgeMeta(p: PersistedTransferScreeningV1): {
  shortLabel: string;
  message: string;
  tone: TransferScreeningBadgeTone;
} {
  if (p.transferCheckError) {
    return {
      shortLabel: "Check failed",
      message: p.transferCheckError,
      tone: "error",
    };
  }
  if (p.noPhoneSkip) {
    return {
      shortLabel: "No phone",
      message: "Transfer check skipped — no phone on this queue row.",
      tone: "muted",
    };
  }
  if (p.tcpaBlocked) {
    return {
      shortLabel: "TCPA",
      message:
        p.transferCheckMessage.trim() ||
        "This number is flagged as a TCPA litigator. No contact or transfers.",
      tone: "critical",
    };
  }
  if (p.phoneInvalidBlocked) {
    return {
      shortLabel: "Invalid phone",
      message: p.transferCheckMessage.trim() || "This phone number appears to be invalid.",
      tone: "critical",
    };
  }
  if (p.dncListBlocked) {
    return {
      shortLabel: "DNC",
      message:
        p.transferCheckMessage.trim() ||
        "Do-not-call list match — follow your centre's compliance rules.",
      tone: "warning",
    };
  }
  if (p.agencyDqBlocked) {
    return {
      shortLabel: "CRM DQ",
      message:
        p.transferCheckMessage.trim() ||
        "Not permitted based on CRM stage / agency rules.",
      tone: "critical",
    };
  }
  return {
    shortLabel: "Clear",
    message: p.transferCheckMessage.trim() || TRANSFER_CHECK_CLEAR_USER_MESSAGE,
    tone: "success",
  };
}

/** Inline pill styles for queue cards (no theme import — safe in shared lib). */
export function transferScreeningBadgeChrome(tone: TransferScreeningBadgeTone): {
  background: string;
  color: string;
  border: string;
} {
  switch (tone) {
    case "critical":
    case "error":
      return { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" };
    case "warning":
      return { background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" };
    case "success":
      return { background: "#ecfdf5", color: "#166534", border: "1px solid #86efac" };
    case "muted":
    default:
      return { background: "#f4f4f5", color: "#52525b", border: "1px solid #e4e4e7" };
  }
}

const emptySnapshot = (): Omit<TransferScreeningSnapshot, "noPhoneSkip"> => ({
  transferCheckData: null,
  transferCheckMessage: "",
  transferCheckError: null,
  tcpaBlocked: false,
  tcpaBlockReason: "",
  agencyDqBlocked: false,
  dncListBlocked: false,
  phoneInvalidBlocked: false,
});

/**
 * Runs `transfer-check` and DNC screening in parallel, using the same interpretation as
 * `TransferLeadWorkspacePage` (TCPA → invalid phone → DNC list → CRM DQ → clear message).
 */
export async function runTransferScreeningForPhone(
  supabase: SupabaseClient,
  phoneRaw: string | null | undefined,
): Promise<TransferScreeningSnapshot> {
  const cleanPhone = getUsPhone10Digits(String(phoneRaw ?? ""));
  if (!cleanPhone) {
    return { noPhoneSkip: true, ...emptySnapshot() };
  }

  try {
    const [transferRes, dncRes] = await Promise.all([
      runTransferCheck(supabase, cleanPhone),
      runDncLookup(supabase, cleanPhone),
    ]);

    if (!dncRes.ok) {
      const msg =
        String(dncRes.data.message ?? dncRes.data.error ?? "").trim() ||
        `Screening request failed (${dncRes.status}).`;
      return { noPhoneSkip: false, ...emptySnapshot(), transferCheckError: msg };
    }

    const dncData = dncRes.data;
    const dncCallStatus = String(dncData.callStatus ?? "");
    if (dncCallStatus === "ERROR") {
      return {
        noPhoneSkip: false,
        ...emptySnapshot(),
        transferCheckError:
          String(dncData.message ?? "").trim() ||
          "Screening could not be completed. Do not treat this number as safe.",
      };
    }

    if (!transferRes.ok) {
      const data = transferRes.data as TransferCheckApiResponse;
      const errText =
        String(data.message ?? "").trim() || `Failed to check phone number (${transferRes.status})`;
      return { noPhoneSkip: false, ...emptySnapshot(), transferCheckError: errText };
    }

    const data = transferRes.data as TransferCheckApiResponse;
    const crmGate = data.crm_phone_match as
      | { has_match?: boolean; is_addable?: boolean; rule_message?: string }
      | undefined;
    const crmBlocksTransfer = crmGate?.has_match === true && crmGate?.is_addable === false;

    const dncFlags = dncData.flags as
      | { isTcpa?: boolean; isDnc?: boolean; isInvalid?: boolean }
      | undefined;

    const isTCPA = dncFlags?.isTcpa === true;
    const isDncList = dncFlags?.isDnc === true && !isTCPA;
    const isInvalidPhone = dncFlags?.isInvalid === true;

    if (isTCPA) {
      return {
        noPhoneSkip: false,
        transferCheckData: data,
        transferCheckMessage:
          String(dncData.message ?? "").trim() ||
          "This number is flagged as a TCPA litigator. All transfers and contact attempts are strictly prohibited.",
        transferCheckError: null,
        tcpaBlocked: true,
        tcpaBlockReason: "TCPA Litigator Detected - No Contact Permitted",
        agencyDqBlocked: false,
        dncListBlocked: false,
        phoneInvalidBlocked: false,
      };
    }

    if (isInvalidPhone) {
      return {
        noPhoneSkip: false,
        transferCheckData: data,
        transferCheckMessage:
          String(dncData.message ?? "").trim() || "This phone number appears to be invalid.",
        transferCheckError: null,
        tcpaBlocked: false,
        tcpaBlockReason: "",
        agencyDqBlocked: false,
        dncListBlocked: false,
        phoneInvalidBlocked: true,
      };
    }

    if (isDncList) {
      return {
        noPhoneSkip: false,
        transferCheckData: data,
        transferCheckMessage:
          String(dncData.message ?? "").trim() || "Do not call: this number is on a DNC list.",
        transferCheckError: null,
        tcpaBlocked: false,
        tcpaBlockReason: "",
        agencyDqBlocked: false,
        dncListBlocked: true,
        phoneInvalidBlocked: false,
      };
    }

    if (crmBlocksTransfer) {
      return {
        noPhoneSkip: false,
        transferCheckData: data,
        transferCheckMessage:
          String(crmGate?.rule_message ?? "").trim() ||
          "This transfer is not permitted based on CRM stage rules.",
        transferCheckError: null,
        tcpaBlocked: false,
        tcpaBlockReason: "",
        agencyDqBlocked: true,
        dncListBlocked: false,
        phoneInvalidBlocked: false,
      };
    }

    const rootMessage = String(data.message ?? "").trim();
    return {
      noPhoneSkip: false,
      transferCheckData: data,
      transferCheckMessage: rootMessage || TRANSFER_CHECK_CLEAR_USER_MESSAGE,
      transferCheckError: null,
      tcpaBlocked: false,
      tcpaBlockReason: "",
      agencyDqBlocked: false,
      dncListBlocked: false,
      phoneInvalidBlocked: false,
    };
  } catch (error) {
    let message = "Failed to connect to transfer check service.";
    if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
      message = "Cannot connect to transfer check service. Please try again later.";
    }
    return { noPhoneSkip: false, ...emptySnapshot(), transferCheckError: message };
  }
}
