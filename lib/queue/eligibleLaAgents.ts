"use client";

/** Sent to `get-eligible-agent`; no toolbar control — English default */
export const ELIGIBILITY_LANGUAGE: "English" | "Spanish" = "English";

export type EligibleAgentsResponse =
  | {
      success?: boolean;
      eligible_agents_count?: number;
      eligible_agents?: Array<{ name: string; upline?: string | null; upline_required?: boolean | null }>;
    }
  | { error?: string };

export type LaMatchRow = { id: string; name: string; email: string | null };

function normalise(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase();
}

export function normaliseUsState(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const t = raw.toUpperCase();
  const MAP: Record<string, string> = {
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
  return MAP[t] || raw;
}

/** First whitespace-delimited token, lowercased (for matching RPC / Slack first-name style). */
function firstNameToken(displayName: string | null | undefined): string {
  const t = String(displayName ?? "")
    .trim()
    .split(/\s+/)[0];
  return normalise(t);
}

/** Normalised strings from CRM `full_name` that should match an API eligible name. */
function crmEligibleMatchTokens(crmFullName: string): Set<string> {
  const raw = String(crmFullName ?? "").trim();
  const s = new Set<string>();
  if (!raw) return s;
  s.add(normalise(raw));
  s.add(firstNameToken(raw));
  const stripped = raw.replace(/\s+(agent|closer|admin|bpo)\s*$/i, "").trim();
  if (stripped && stripped !== raw) {
    s.add(normalise(stripped));
    s.add(firstNameToken(stripped));
  }
  return s;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + c);
    }
  }
  return dp[m][n];
}

const PARTIAL_PREFIX_MIN = 3;

/** Shorter string is a prefix of the longer; shorter length ≥ minChars (avoids "a" → everyone). */
function oneIsPrefixOfOther(a: string, b: string, minChars: number): boolean {
  if (!a || !b) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length < minChars) return false;
  return longer.startsWith(shorter);
}

function normalisedNameWords(crmFullName: string): string[] {
  return String(crmFullName ?? "")
    .trim()
    .split(/\s+/)
    .map((w) => normalise(w))
    .filter(Boolean);
}

/**
 * When several licensed users share a first name (e.g. two "Zack" in `users`), pick one:
 * 1) sole `@insurvas.com` email, 2) normalised name === `"{eligible} agent"`, 3) shortest `full_name`.
 */
function disambiguateCandidates(candidates: LaMatchRow[], el: string): { id: string; label: string } | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return { id: candidates[0].id, label: candidates[0].name };

  const insurvas = candidates.filter((c) => normalise(c.email ?? "").endsWith("@insurvas.com"));
  if (insurvas.length === 1) return { id: insurvas[0].id, label: insurvas[0].name };

  const agentStyle = candidates.filter((c) => normalise(c.name) === `${el} agent`);
  if (agentStyle.length === 1) return { id: agentStyle[0].id, label: agentStyle[0].name };

  const lengths = candidates.map((c) => normalise(c.name).length);
  const minLen = Math.min(...lengths);
  const shortest = candidates.filter((c) => normalise(c.name).length === minLen);
  if (shortest.length === 1) return { id: shortest[0].id, label: shortest[0].name };

  return null;
}

/**
 * Map eligible-agent `name` from the API to a licensed agent `users.id` using (in order):
 * token set, fuzzy first token, prefix partial, any word, substring — with disambiguation when
 * multiple CRM users match (duplicate first names).
 */
export function resolveLaUserId(eligibleName: string, licensedAgents: LaMatchRow[]): { id: string; label: string } | null {
  const el = normalise(eligibleName);
  if (!el) return null;

  const tryStep = (matches: LaMatchRow[]) => disambiguateCandidates(matches, el);

  const byToken = licensedAgents.filter((a) => crmEligibleMatchTokens(a.name).has(el));
  const u1 = tryStep(byToken);
  if (u1) return u1;

  if (el.length >= 4) {
    const fuzzy = licensedAgents.filter((a) => {
      const ft = firstNameToken(a.name);
      return ft.length >= 4 && levenshtein(ft, el) <= 1;
    });
    const u2 = tryStep(fuzzy);
    if (u2) return u2;
  }

  const byFirstPrefix = licensedAgents.filter((a) => {
    const ft = firstNameToken(a.name);
    return oneIsPrefixOfOther(el, ft, PARTIAL_PREFIX_MIN);
  });
  const u3 = tryStep(byFirstPrefix);
  if (u3) return u3;

  const byAnyWord = licensedAgents.filter((a) => {
    for (const w of normalisedNameWords(a.name)) {
      if (w === el) return true;
      if (oneIsPrefixOfOther(el, w, PARTIAL_PREFIX_MIN)) return true;
    }
    return false;
  });
  const u4 = tryStep(byAnyWord);
  if (u4) return u4;

  if (el.length >= PARTIAL_PREFIX_MIN) {
    const bySubstring = licensedAgents.filter((a) => normalise(a.name).includes(el));
    return tryStep(bySubstring);
  }

  return null;
}

export function buildQueueLaEligibilityKey(
  carrier: string,
  state: string,
  leadVendor: string,
  language: "English" | "Spanish",
): string {
  return `${carrier}||${state}||${leadVendor}||${language}`;
}

/** POST `/api/get-eligible-agent` and map API names to CRM licensed-agent select options. */
export async function requestQueueEligibleLaOptions(args: {
  carrier: string;
  state: string;
  leadVendor: string;
  language: "English" | "Spanish";
  licensedAgents: LaMatchRow[];
}): Promise<{ options: Array<{ value: string; label: string }>; unmatchedEligible: string[] }> {
  const resp = await fetch("/api/get-eligible-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      carrier: args.carrier,
      state: args.state,
      lead_vendor: args.leadVendor,
      language: args.language,
    }),
  });
  const payload = (await resp.json()) as EligibleAgentsResponse;
  if (!resp.ok) {
    const msg =
      (payload && "error" in payload && typeof payload.error === "string" && payload.error) || `HTTP ${resp.status}`;
    throw new Error(msg);
  }

  const list = (payload && "eligible_agents" in payload ? payload.eligible_agents : null) ?? [];
  const unmatchedEligible: string[] = [];
  const options = list
    .map((a) => {
      const apiName = String(a?.name ?? "").trim();
      if (!apiName) return null;
      const resolved = resolveLaUserId(apiName, args.licensedAgents);
      if (!resolved) {
        unmatchedEligible.push(apiName);
        return null;
      }
      const needsUpline = Boolean(a?.upline_required);
      return {
        value: resolved.id,
        label: needsUpline ? `${resolved.label} (upline required)` : resolved.label,
      };
    })
    .filter(Boolean) as Array<{ value: string; label: string }>;

  return {
    options: [{ value: "__unassigned__", label: "Unassigned" }, ...options],
    unmatchedEligible,
  };
}
