import type { SupabaseClient } from "@supabase/supabase-js";

export type DncResolvedStatus = "clear" | "dnc" | "tcpa";

/** Last 10 digits for comparison with API list entries. */
export function normalizePhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** True if `list` contains a string whose digits match `normalizedPhone10`. */
export function phoneDigitsInList(list: unknown, normalizedPhone10: string): boolean {
  if (!Array.isArray(list)) return false;
  return list.some((v) => {
    const digits = typeof v === "string" || typeof v === "number" ? String(v).replace(/\D/g, "") : "";
    const candidate = digits.length > 10 ? digits.slice(-10) : digits;
    return candidate === normalizedPhone10;
  });
}

/** `dnc-test` may return `{ tcpa_litigator: ["7864998027"] }` or a map of phone → boolean. */
export function tcpaLitigatorIndicatesTcpa(value: unknown, normalizedPhone10: string): boolean {
  if (phoneDigitsInList(value, normalizedPhone10)) return true;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const map = value as Record<string, unknown>;
    const exact = map[normalizedPhone10];
    if (typeof exact === "boolean") return exact;
    if (typeof exact === "string") return exact.toLowerCase() === "true";
    return Boolean(exact);
  }
  return false;
}

/**
 * Edge functions often nest real fields under repeated `data` keys, e.g.
 * `{ status: "success", data: { tcpa_litigator: ["786..."] } }`.
 * Walking the chain fixes false "clear" when the parent object matched `isPayloadShape` via `status` only.
 */
export function collectPayloadRecordChain(root: unknown, maxDepth = 12): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (v: unknown, depth: number) => {
    if (depth > maxDepth || v === null || v === undefined) return;
    if (typeof v === "string") {
      try {
        const parsed = JSON.parse(v) as unknown;
        walk(parsed, depth);
      } catch {
        return;
      }
      return;
    }
    if (typeof v !== "object" || Array.isArray(v)) return;
    const r = v as Record<string, unknown>;
    out.push(r);
    if ("data" in r && r.data !== undefined) {
      walk(r.data, depth + 1);
    }
  };
  walk(root, 0);
  return out;
}

function firstMessageInRecords(records: Record<string, unknown>[]): string {
  const hit = records.find((r) => typeof r.message === "string" && (r.message as string).trim().length > 0);
  return typeof hit?.message === "string" ? hit.message : "";
}

const TCPA_LITIGATOR_KEYS = ["tcpa_litigator", "tcpalitigator", "TCPA_LITIGATOR", "TcpaLitigator"];
const DNC_LIST_KEYS = ["federal_dnc", "federaldnc", "dnc", "DNC"];

function getKeyCaseInsensitive(obj: Record<string, unknown>, wantedLower: string): unknown {
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === wantedLower) return obj[key];
  }
  return undefined;
}

/**
 * Walks the entire response tree (including JSON strings inside properties like `body`, `data`, `result`)
 * so we never miss `tcpa_litigator` when the edge function double-encodes or uses alternate nesting.
 */
export function deepScanTcpaLitigator(root: unknown, normalizedPhone10: string): boolean {
  const seen = new WeakSet<object>();
  const go = (v: unknown): boolean => {
    if (v === null || v === undefined) return false;
    if (typeof v === "string") {
      const t = v.trim();
      if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
        try {
          return go(JSON.parse(t) as unknown);
        } catch {
          return false;
        }
      }
      return false;
    }
    if (typeof v !== "object") return false;
    if (Array.isArray(v)) return v.some(go);
    if (seen.has(v)) return false;
    seen.add(v);
    const o = v as Record<string, unknown>;
    for (const k of TCPA_LITIGATOR_KEYS) {
      if (k in o && tcpaLitigatorIndicatesTcpa(o[k], normalizedPhone10)) return true;
    }
    const anyTcpa = getKeyCaseInsensitive(o, "tcpa_litigator");
    if (anyTcpa !== undefined && tcpaLitigatorIndicatesTcpa(anyTcpa, normalizedPhone10)) return true;
    return Object.values(o).some(go);
  };
  return go(root);
}

/**
 * Handles the common `dnc-test` body (and unwrapped inner `data` only), e.g.
 * `{"status":"success","data":{"cleaned_number":[],"tcpa_litigator":["7864998027"],"invalid":[]}}`
 */
export function tcpaFromDncTestEnvelope(input: unknown, normalizedPhone10: string): boolean {
  if (input === null || input === undefined) return false;
  if (typeof input === "string") {
    try {
      return tcpaFromDncTestEnvelope(JSON.parse(input) as unknown, normalizedPhone10);
    } catch {
      return false;
    }
  }
  if (typeof input !== "object" || Array.isArray(input)) return false;
  const r = input as Record<string, unknown>;
  const inner =
    r.data !== undefined && typeof r.data === "object" && !Array.isArray(r.data)
      ? (r.data as Record<string, unknown>)
      : r;
  return tcpaLitigatorIndicatesTcpa(inner.tcpa_litigator, normalizedPhone10);
}

export function deepScanDncPhoneLists(root: unknown, normalizedPhone10: string): boolean {
  const seen = new WeakSet<object>();
  const go = (v: unknown): boolean => {
    if (v === null || v === undefined) return false;
    if (typeof v === "string") {
      const t = v.trim();
      if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
        try {
          return go(JSON.parse(t) as unknown);
        } catch {
          return false;
        }
      }
      return false;
    }
    if (typeof v !== "object") return false;
    if (Array.isArray(v)) return v.some(go);
    if (seen.has(v)) return false;
    seen.add(v);
    const o = v as Record<string, unknown>;
    for (const k of DNC_LIST_KEYS) {
      if (k in o && phoneDigitsInList(o[k], normalizedPhone10)) return true;
    }
    const fd = getKeyCaseInsensitive(o, "federal_dnc");
    const dnc = getKeyCaseInsensitive(o, "dnc");
    if (phoneDigitsInList(fd, normalizedPhone10) || phoneDigitsInList(dnc, normalizedPhone10)) return true;
    return Object.values(o).some(go);
  };
  return go(root);
}

/** Normalizes edge-function responses (arrays, nested `data`, stringified JSON). */
export function toBlacklistDncPayload(input: unknown): Record<string, unknown> {
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input) as unknown;
      return toBlacklistDncPayload(parsed);
    } catch {
      return {};
    }
  }

  const isPayloadShape = (obj: Record<string, unknown>) =>
    "is_tcpa" in obj ||
    "is_blacklisted" in obj ||
    "is_dnc" in obj ||
    "litigator" in obj ||
    "national_dnc" in obj ||
    "state_dnc" in obj ||
    "dma" in obj ||
    "status" in obj ||
    "message" in obj ||
    "tcpa_litigator" in obj ||
    "federal_dnc" in obj ||
    "dnc" in obj ||
    "cleaned_number" in obj ||
    "invalid" in obj;

  const firstNestedPayload = (obj: Record<string, unknown>): Record<string, unknown> => {
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") {
        const candidate = value as Record<string, unknown>;
        if (isPayloadShape(candidate)) return candidate;
      }
    }
    return {};
  };

  if (Array.isArray(input)) {
    const first = input[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : {};
  }
  if (!input || typeof input !== "object") return {};
  const record = input as Record<string, unknown>;
  const nested = record.data;
  if (Array.isArray(nested)) {
    const first = nested[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : {};
  }
  if (nested && typeof nested === "object") {
    const nestedObj = nested as Record<string, unknown>;
    if (isPayloadShape(nestedObj)) {
      const inner = nestedObj.data;
      if (
        inner &&
        typeof inner === "object" &&
        !Array.isArray(inner) &&
        ("tcpa_litigator" in (inner as Record<string, unknown>) ||
          "federal_dnc" in (inner as Record<string, unknown>) ||
          "dnc" in (inner as Record<string, unknown>) ||
          "cleaned_number" in (inner as Record<string, unknown>))
      ) {
        return inner as Record<string, unknown>;
      }
      return nestedObj;
    }
    return firstNestedPayload(nestedObj);
  }
  return isPayloadShape(record) ? record : firstNestedPayload(record);
}

export type BlacklistDncInvokeResult = {
  payloadA: Record<string, unknown>;
  payloadB: Record<string, unknown>;
  mergedMessage: string;
  rawDataA: unknown;
  rawDataB: unknown;
  /** Full `{ data, error }` from `functions.invoke` — scan when `data` shape varies by runtime. */
  blacklistInvoke: Awaited<ReturnType<SupabaseClient["functions"]["invoke"]>>;
  dncInvoke: Awaited<ReturnType<SupabaseClient["functions"]["invoke"]>>;
};

/**
 * Calls `blacklist-check` + `dnc-test` and merges payloads (same contract as Transfer Lead forms).
 */
export async function invokeBlacklistAndDncTest(
  supabase: SupabaseClient,
  cleanPhone10: string,
): Promise<BlacklistDncInvokeResult> {
  const [blacklistResult, dncTestResult] = await Promise.all([
    supabase.functions.invoke("blacklist-check", { body: { phone: cleanPhone10 } }),
    // Some deployments read `phone` only, others `mobileNumber` — send both.
    supabase.functions.invoke("dnc-test", { body: { mobileNumber: cleanPhone10, phone: cleanPhone10 } }),
  ]);
  if (blacklistResult.error && dncTestResult.error) {
    throw new Error(blacklistResult.error.message || dncTestResult.error.message || "DNC check failed");
  }

  // Always read `data` when the client returns it — `error` can still be set on some responses while `data` holds the JSON body.
  const rawDataA = blacklistResult.data ?? null;
  const rawDataB = dncTestResult.data ?? null;
  const payloadA = toBlacklistDncPayload(blacklistResult.data);
  const payloadB = toBlacklistDncPayload(dncTestResult.data);
  const chainA = collectPayloadRecordChain(rawDataA);
  const chainB = collectPayloadRecordChain(rawDataB);
  const mergedMessage =
    firstMessageInRecords(chainA) ||
    firstMessageInRecords(chainB) ||
    (typeof payloadA.message === "string" && payloadA.message) ||
    (typeof payloadB.message === "string" && payloadB.message) ||
    "";

  return { payloadA, payloadB, mergedMessage, rawDataA, rawDataB, blacklistInvoke: blacklistResult, dncInvoke: dncTestResult };
}

export function resolveDncStatusFromPayloads(
  payloadA: Record<string, unknown>,
  payloadB: Record<string, unknown>,
  mergedMessage: string,
  normalizedPhone10: string,
  rawDataA?: unknown,
  rawDataB?: unknown,
): { status: DncResolvedStatus; message: string } {
  const chainA = collectPayloadRecordChain(rawDataA !== undefined ? rawDataA : payloadA);
  const chainB = collectPayloadRecordChain(rawDataB !== undefined ? rawDataB : payloadB);
  const all = [...chainA, ...chainB];

  const rawA = rawDataA !== undefined ? rawDataA : payloadA;
  const rawB = rawDataB !== undefined ? rawDataB : payloadB;

  const isTcpaFromNormalized = all.some(
    (p) =>
      p.is_tcpa === true ||
      p.is_blacklisted === true ||
      String(p.litigator ?? "").toUpperCase() === "Y",
  );

  const isTcpaFromLists = all.some((p) => tcpaLitigatorIndicatesTcpa(p.tcpa_litigator, normalizedPhone10));

  const isTcpaFromDncEnvelopeShape =
    tcpaFromDncTestEnvelope(rawA, normalizedPhone10) ||
    tcpaFromDncTestEnvelope(rawB, normalizedPhone10) ||
    tcpaFromDncTestEnvelope(payloadA, normalizedPhone10) ||
    tcpaFromDncTestEnvelope(payloadB, normalizedPhone10);

  const isTcpaFromDeepScan = deepScanTcpaLitigator(rawA, normalizedPhone10) || deepScanTcpaLitigator(rawB, normalizedPhone10);

  const isTcpaFromMessage = all.some((payload) => {
    const msg = typeof payload.message === "string" ? payload.message.toLowerCase() : "";
    return msg.includes("tcpa") || msg.includes("litigator");
  });

  const isTcpa =
    isTcpaFromNormalized ||
    isTcpaFromLists ||
    isTcpaFromDncEnvelopeShape ||
    isTcpaFromDeepScan ||
    isTcpaFromMessage;

  const isDncFromNormalized = all.some((p) => p.is_dnc === true);

  const isDncFromLists =
    all.some(
      (p) =>
        phoneDigitsInList(p.federal_dnc, normalizedPhone10) || phoneDigitsInList(p.dnc, normalizedPhone10),
    ) ||
    deepScanDncPhoneLists(rawA, normalizedPhone10) ||
    deepScanDncPhoneLists(rawB, normalizedPhone10);

  const isDnc =
    isDncFromNormalized ||
    isTcpa ||
    all.some((p) => {
      const nationalDnc = String(p.national_dnc ?? "").toUpperCase();
      const stateDnc = String(p.state_dnc ?? "").toUpperCase();
      const dma = String(p.dma ?? "").toUpperCase();
      return nationalDnc === "Y" || stateDnc === "Y" || dma === "Y";
    }) ||
    isDncFromLists;

  const status: DncResolvedStatus = isTcpa ? "tcpa" : isDnc ? "dnc" : "clear";

  const message = pickUserFacingMessage(status, mergedMessage);

  return { status, message };
}

/** `blacklist-check` can return a generic "clear" message while `dnc-test` lists tcpa_litigator — never show that copy when status is tcpa/dnc. */
function pickUserFacingMessage(status: DncResolvedStatus, mergedMessage: string): string {
  const tcpaDefault = "WARNING: This number is blacklisted/TCPA flagged.";
  const dncDefault = "This number is on DNC. Proceed with verbal consent.";
  const clearDefault = "This number is clear. Please verify consent with customer.";

  const m = mergedMessage.trim();
  const mergedSaysClear = m.toLowerCase().includes("this number is clear");

  if (status === "tcpa") {
    return m && !mergedSaysClear ? m : tcpaDefault;
  }
  if (status === "dnc") {
    return m && !mergedSaysClear ? m : dncDefault;
  }
  return m || clearDefault;
}

/** Single entry point: invoke both functions and return status + user-facing message. */
export async function runBlacklistDncPhoneCheck(
  supabase: SupabaseClient,
  cleanPhone10: string,
): Promise<{ status: DncResolvedStatus; message: string }> {
  const normalized = normalizePhoneDigits(cleanPhone10);
  const inv = await invokeBlacklistAndDncTest(supabase, normalized);
  const resolved = resolveDncStatusFromPayloads(
    inv.payloadA,
    inv.payloadB,
    inv.mergedMessage,
    normalized,
    inv.rawDataA ?? undefined,
    inv.rawDataB ?? undefined,
  );

  if (resolved.status === "tcpa") {
    return resolved;
  }

  const envelopeTcpa =
    deepScanTcpaLitigator(inv.blacklistInvoke, normalized) ||
    deepScanTcpaLitigator(inv.dncInvoke, normalized);

  if (envelopeTcpa) {
    return {
      status: "tcpa",
      message: pickUserFacingMessage("tcpa", inv.mergedMessage || ""),
    };
  }

  return resolved;
}
