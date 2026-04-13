/**
 * Resolves duplicate lead policy when one or more existing leads share a phone and/or SSN.
 * Uses DB-driven rules with precedence_rank (lower = higher priority when choosing messaging).
 */

export type DuplicateStageRule = {
  stage_name: string;
  ghl_stage: string | null;
  message: string;
  is_addable: boolean;
  is_active: boolean;
  precedence_rank?: number | null;
};

export type LeadStageRow = {
  id: string;
  stage: string | null;
};

const DEFAULT_RANK = 10_000;

function norm(s: string) {
  return s.trim().toLowerCase();
}

/** Match CRM `leads.stage` to a rule via ghl_stage or stage_name (case-insensitive). */
export function ruleForLeadStage(stage: string | null | undefined, rules: DuplicateStageRule[]): DuplicateStageRule | undefined {
  const st = String(stage || "").trim();
  if (!st) return undefined;
  const key = norm(st);
  const active = rules.filter((r) => r.is_active);
  return active.find((r) => (r.ghl_stage && norm(r.ghl_stage) === key) || norm(r.stage_name) === key);
}

type Ranked<T> = T & { rank: number };

function minBy<T>(items: T[], score: (x: T) => number): T | undefined {
  if (!items.length) return undefined;
  let best = items[0];
  let bestScore = score(best);
  for (let i = 1; i < items.length; i++) {
    const s = score(items[i]);
    if (s < bestScore) {
      best = items[i];
      bestScore = s;
    }
  }
  return best;
}

/**
 * Among blocking rules, highest priority = lowest precedence_rank.
 * If none block, among allowing rules, highest priority = lowest precedence_rank.
 * Leads with no rule default to addable at DEFAULT_RANK (do not override explicit rules).
 */
export function resolveDuplicatePolicy(
  leads: LeadStageRow[],
  rules: DuplicateStageRule[],
): { isAddable: boolean; message: string; log: string[] } {
  const log: string[] = [];
  if (!leads.length) {
    log.push("No existing leads in scope — duplicate policy skipped.");
    return { isAddable: true, message: "", log };
  }

  const annotated: Ranked<{ lead: LeadStageRow; rule?: DuplicateStageRule }>[] = leads.map((lead) => {
    const rule = ruleForLeadStage(lead.stage, rules);
    const rank = rule?.precedence_rank ?? DEFAULT_RANK;
    return { lead, rule, rank };
  });

  for (const a of annotated) {
    const st = String(a.lead.stage || "").trim() || "(empty stage)";
    if (!a.rule) {
      log.push(`Lead ${a.lead.id}: stage "${st}" has no active rule — treated as addable (rank ${DEFAULT_RANK}).`);
    } else {
      log.push(
        `Lead ${a.lead.id}: stage "${st}" matched rule "${a.rule.stage_name}" (rank ${a.rank}, addable=${a.rule.is_addable}).`,
      );
    }
  }

  const withRules = annotated.filter((a) => a.rule);
  const blocking = withRules.filter((a) => a.rule!.is_addable === false);
  if (blocking.length) {
    const winner = minBy(blocking, (b) => b.rank)!;
    const msg = winner.rule!.message;
    log.push(
      `Decision: BLOCK — highest-priority blocking stage among ${blocking.length} candidate(s) is rank ${winner.rank} (${String(winner.lead.stage || "").trim()}).`,
    );
    return { isAddable: false, message: msg, log };
  }

  const allowing = withRules.filter((a) => a.rule!.is_addable === true);
  if (allowing.length) {
    const winner = minBy(allowing, (b) => b.rank)!;
    const msg = winner.rule!.message;
    log.push(
      `Decision: ALLOW — highest-priority allowing rule is rank ${winner.rank} (${String(winner.lead.stage || "").trim()}).`,
    );
    return { isAddable: true, message: msg, log };
  }

  log.push("Decision: ALLOW — no rule rows matched; default addable.");
  return { isAddable: true, message: "A lead already exists for this match; review stage before submitting.", log };
}
