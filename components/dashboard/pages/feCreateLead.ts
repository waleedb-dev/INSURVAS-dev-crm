import type { SupabaseClient } from "@supabase/supabase-js";
import type { TransferLeadFormData } from "./TransferLeadApplicationForm";

/** Same host/path as the manual `fe-create-lead` curl. */
export const FE_CREATE_LEAD_URL = "https://gqhcjqxcvhgwsqfqgekh.supabase.co/functions/v1/fe-create-lead";

/** 2-letter USPS codes → full state name for `fe-create-lead` (edge expects full name, not "FL"). */
const US_STATE_ABBREV_TO_NAME: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

/** If value is a 2-letter US state code, return full name; otherwise return trimmed original. */
export function expandUsStateAbbrevForFeCreateLead(raw: string): string {
  const t = raw.trim();
  if (t.length !== 2) return t;
  const full = US_STATE_ABBREV_TO_NAME[t.toUpperCase()];
  return full ?? t;
}

function expandStateFieldValue(raw: unknown): unknown {
  if (typeof raw !== "string" || !raw.trim()) return raw;
  return expandUsStateAbbrevForFeCreateLead(raw);
}

/** Clone body and expand `state` / `birth_state` abbreviations before POST. */
export function applyFeCreateLeadStateNameExpansion(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body };
  if ("state" in out) out.state = expandStateFieldValue(out.state);
  if ("birth_state" in out) out.birth_state = expandStateFieldValue(out.birth_state);
  return out;
}

function parseOptionalNumber(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number(String(raw).replace(/\$/g, "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/** Maps BPO intake form → `fe-create-lead` JSON body. */
export function buildFeCreateLeadBodyFromIntakePayload(
  payload: TransferLeadFormData,
  options: {
    submissionId: string;
    leadVendor: string;
    isCallback?: boolean;
    isRetentionCall?: boolean;
    bufferAgent?: string;
    agent?: string;
  },
): Record<string, unknown> {
  const p = payload;
  const street_address =
    [p.street1, p.street2]
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .join(", ") || null;

  const existingParts = [p.existingCoverageLast2Years, p.existingCoverageDetails].map((s) => String(s || "").trim()).filter(Boolean);
  const existing_coverage = existingParts.length ? existingParts.join(" — ") : null;

  const coverage_amount = parseOptionalNumber(p.coverageAmount);
  const monthly_premium = parseOptionalNumber(p.monthlyPremium);
  const backup_coverage_amount = parseOptionalNumber(p.backupCoverageAmount);
  const backup_monthly_premium = parseOptionalNumber(p.backupMonthlyPremium);
  const age = parseOptionalNumber(p.age);

  const lead_vendor = options.leadVendor.trim() || p.leadSource.trim() || null;

  const body: Record<string, unknown> = {
    first_name: p.firstName.trim() || null,
    last_name: p.lastName.trim() || null,
    phone_number: p.phone.trim() || null,
    state: p.state.trim() || null,
    lead_vendor,
    submission_id: options.submissionId,
    street_address,
    city: p.city.trim() || null,
    zip_code: p.zipCode.trim() || null,
    date_of_birth: p.dateOfBirth.trim() || null,
    social_security: p.social.trim() || null,
    birth_state: p.birthState.trim() || null,
    driver_license: p.driverLicenseNumber.trim() || null,
    height: p.height.trim() || null,
    weight: p.weight.trim() || null,
    health_conditions: p.healthConditions.trim() || null,
    tobacco_use: p.tobaccoUse.trim() || null,
    medications: p.medications.trim() || null,
    doctor_name: p.doctorName.trim() || null,
    carrier: p.carrier.trim() || null,
    product_type: p.productType.trim() || null,
    coverage_amount,
    monthly_premium,
    existing_coverage,
    previous_applications: p.previousApplications2Years.trim() || null,
    draft_date: p.draftDate.trim() || null,
    future_draft_date: p.futureDraftDate.trim() || null,
    institution_name: p.institutionName.trim() || null,
    account_type: p.bankAccountType.trim() || null,
    routing_number: p.routingNumber.trim() || null,
    account_number: p.accountNumber.trim() || null,
    beneficiary_information: p.beneficiaryInformation.trim() || null,
    buffer_agent: (options.bufferAgent || "").trim() || null,
    agent: (options.agent || "").trim() || null,
    additional_notes: p.additionalInformation.trim() || null,
    is_callback: options.isCallback ?? false,
    is_retention_call: options.isRetentionCall ?? false,
    has_backup_quote: p.includeBackupQuote,
    backup_carrier: p.includeBackupQuote ? p.backupCarrier.trim() || null : null,
    backup_product_type: p.includeBackupQuote ? p.backupProductType.trim() || null : null,
    backup_monthly_premium: p.includeBackupQuote ? backup_monthly_premium : null,
    backup_coverage_amount: p.includeBackupQuote ? backup_coverage_amount : null,
  };

  if (age !== null) body.age = age;

  return body;
}

export async function postFeCreateLeadAtFixedUrl(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  logPrefix = "[fe-create-lead]",
): Promise<void> {
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const bearer = session?.access_token?.trim() || publishableKey;
  if (!bearer) {
    console.warn(`${logPrefix} missing Bearer token and publishable/anon key`);
    return;
  }

  const bodyForSend = applyFeCreateLeadStateNameExpansion(body);

  console.log(`${logPrefix} POST →`, {
    url: FE_CREATE_LEAD_URL,
    bodyKeys: Object.keys(bodyForSend),
    body: bodyForSend,
  });

  const res = await fetch(FE_CREATE_LEAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      ...(publishableKey ? { apikey: publishableKey } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyForSend),
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (res.ok) {
    console.log(`${logPrefix} OK`, parsed);
    return;
  }

  if (res.status === 404) {
    console.warn(`${logPrefix} 404 — function not deployed at hardcoded URL?`, parsed);
    return;
  }

  const msg =
    parsed && typeof parsed === "object" && parsed !== null && "error" in parsed
      ? String((parsed as { error: string }).error)
      : `fe-create-lead failed (${res.status})`;
  throw new Error(msg);
}
