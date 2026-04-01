import {
  POLICY_FORM_SECTIONS,
  type PolicyFieldSpec,
  type PolicyRow,
} from "@/lib/policy-schema";

/** Fields that use options loaded from Supabase. */
export const POLICY_DB_SELECT_FIELD_KEYS = new Set<string>(["call_center", "carrier", "ghl_stage"]);

export function mergeSelectOptions(sortedNames: string[], current: string): string[] {
  const t = current.trim();
  if (!t) return sortedNames;
  if (sortedNames.includes(t)) return sortedNames;
  return [t, ...sortedNames];
}

export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function rowValueToFormString(
  row: PolicyRow,
  key: string,
  kind?: PolicyFieldSpec["kind"]
): string {
  const v = row[key];
  if (v == null || v === "") return "";
  if (kind === "bool") return v === true ? "true" : v === false ? "false" : "";
  if (kind === "ts") {
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (kind === "num") {
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
    return String(v);
  }
  return String(v);
}

/** Form draft for all editable policy fields (excludes Record section). */
export function buildDraftFromPolicyRow(policyRow: PolicyRow): Record<string, string> {
  const fields = POLICY_FORM_SECTIONS.flatMap((s) => s.fields);
  const draft: Record<string, string> = {};
  for (const f of fields) {
    draft[f.key] = rowValueToFormString(policyRow, f.key, f.kind);
  }
  return draft;
}

export function datetimeLocalToIso(local: string): string | null {
  const t = local.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function payloadFromDraft(draft: Record<string, string>, forUpdate: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const fields = POLICY_FORM_SECTIONS.flatMap((s) => s.fields);

  for (const spec of fields) {
    const raw = draft[spec.key] ?? "";
    const trimmed = raw.trim();

    if (spec.kind === "bool") {
      if (trimmed === "") {
        if (forUpdate) payload[spec.key] = null;
        continue;
      }
      payload[spec.key] = trimmed === "true";
      continue;
    }

    if (trimmed === "") {
      if (forUpdate) payload[spec.key] = null;
      continue;
    }

    if (spec.kind === "num") {
      const n = Number(trimmed);
      if (Number.isFinite(n)) payload[spec.key] = n;
      else if (forUpdate) payload[spec.key] = null;
      continue;
    }

    if (spec.kind === "ts") {
      const iso = datetimeLocalToIso(trimmed);
      if (iso) payload[spec.key] = iso;
      else if (forUpdate) payload[spec.key] = null;
      continue;
    }

    payload[spec.key] = trimmed;
  }
  return payload;
}

export function dbSelectOptions(
  fieldKey: string,
  val: string,
  callCenterNames: string[],
  carrierNames: string[],
  stageNames: string[]
): string[] {
  switch (fieldKey) {
    case "call_center":
      return mergeSelectOptions(callCenterNames, val);
    case "carrier":
      return mergeSelectOptions(carrierNames, val);
    case "ghl_stage":
      return mergeSelectOptions(stageNames, val);
    default:
      return [];
  }
}
