/** Shared policy field layout for `public.policies` (Lead view + Convert to Client modal). */

export type PolicyRow = Record<string, unknown>;

export type PolicyFieldSpec = {
  key: string;
  label: string;
  wide?: boolean;
  multiline?: boolean;
  kind?: "text" | "ts" | "num" | "bool";
};

function fmtBool(value: unknown) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

/** Read-only display for Policy & coverage tab. */
export function policyDisplayValue(row: PolicyRow | null, key: string, kind: PolicyFieldSpec["kind"] = "text"): string {
  if (!row) return "";
  const v = row[key];
  if (v == null || v === "") return "";
  if (kind === "bool") return fmtBool(v);
  if (kind === "ts") {
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }
  if (kind === "num") {
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : String(v);
  }
  return String(v);
}

/** Same columns as the Policy & coverage tab; excludes system-only `Record` block from editable forms. */
export const POLICY_SCHEMA_SECTIONS: { title: string; fields: PolicyFieldSpec[] }[] = [
  {
    title: "Policy",
    fields: [
      { key: "deal_name", label: "deal_name" },
      { key: "policy_type", label: "policy_type" },
      { key: "carrier", label: "carrier" },
      { key: "carrier_status", label: "carrier_status" },
      { key: "policy_number", label: "policy_number" },
      { key: "policy_status", label: "policy_status" },
      { key: "status", label: "status" },
      { key: "deal_value", label: "deal_value", kind: "num" },
      { key: "cc_value", label: "cc_value", kind: "num" },
      { key: "is_active", label: "is_active", kind: "bool" },
      { key: "group_title", label: "group_title" },
      { key: "group_color", label: "group_color" },
    ],
  },
  {
    title: "People & placement",
    fields: [
      { key: "sales_agent", label: "sales_agent" },
      { key: "call_center", label: "call_center" },
      { key: "phone_number", label: "phone_number" },
    ],
  },
  {
    title: "Dates",
    fields: [
      { key: "effective_date", label: "effective_date", kind: "ts" },
      { key: "deal_creation_date", label: "deal_creation_date", kind: "ts" },
      { key: "lead_creation_date", label: "lead_creation_date", kind: "ts" },
      { key: "last_updated", label: "last_updated", kind: "ts" },
    ],
  },
  {
    title: "Commission & writing",
    fields: [
      { key: "writing_no", label: "writing_no" },
      { key: "commission_type", label: "commission_type" },
      { key: "cc_pmt_ws", label: "cc_pmt_ws" },
      { key: "cc_cb_ws", label: "cc_cb_ws" },
    ],
  },
  {
    title: "CRM",
    fields: [
      { key: "ghl_name", label: "ghl_name" },
      { key: "ghl_stage", label: "ghl_stage" },
      { key: "monday_item_id", label: "monday_item_id" },
    ],
  },
  {
    title: "Notes",
    fields: [
      { key: "notes", label: "notes", wide: true, multiline: true },
      { key: "tasks", label: "tasks", wide: true, multiline: true },
    ],
  },
  {
    title: "Disposition",
    fields: [
      { key: "disposition", label: "disposition" },
      { key: "disposition_date", label: "disposition_date", kind: "ts" },
      { key: "disposition_agent_id", label: "disposition_agent_id" },
      { key: "disposition_agent_name", label: "disposition_agent_name" },
      { key: "disposition_notes", label: "disposition_notes", wide: true, multiline: true },
      { key: "callback_datetime", label: "callback_datetime", kind: "ts" },
      { key: "disposition_count", label: "disposition_count", kind: "num" },
    ],
  },
  {
    title: "Lock",
    fields: [
      { key: "lock_status", label: "lock_status" },
      { key: "locked_at", label: "locked_at", kind: "ts" },
      { key: "locked_by", label: "locked_by" },
      { key: "locked_by_name", label: "locked_by_name" },
      { key: "lock_reason", label: "lock_reason", wide: true, multiline: true },
    ],
  },
  {
    title: "Record",
    fields: [
      { key: "id", label: "id" },
      { key: "lead_id", label: "lead_id" },
      { key: "created_at", label: "created_at", kind: "ts" },
      { key: "updated_at", label: "updated_at", kind: "ts" },
    ],
  },
];

export const POLICY_FORM_SECTIONS = POLICY_SCHEMA_SECTIONS.filter((s) => s.title !== "Record");
