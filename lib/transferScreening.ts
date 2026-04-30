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
