export const ROLE_KEYS = [
  "system_admin",
  "sales_admin",
  "sales_manager",
  "sales_agent_licensed",
  "sales_agent_unlicensed",
  "call_center_admin",
  "call_center_agent",
  "hr",
  "accounting",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

const ROLE_SET = new Set<string>(ROLE_KEYS);

export function isRoleKey(value: string): value is RoleKey {
  return ROLE_SET.has(value);
}

export function pickPrimaryRole(roleKeys: string[]): RoleKey | null {
  for (const role of ROLE_KEYS) {
    if (roleKeys.includes(role)) {
      return role;
    }
  }

  return null;
}

export const ROLE_TITLES: Record<RoleKey, string> = {
  system_admin: "System Admin Console",
  sales_admin: "Sales Admin Console",
  sales_manager: "Sales Management Console",
  sales_agent_licensed: "Licensed Sales Console",
  sales_agent_unlicensed: "Unlicensed Sales Console",
  call_center_admin: "Call Center Operations Console",
  call_center_agent: "Call Center Agent Workspace",
  hr: "HR Operations Console",
  accounting: "Accounting Console",
};

export const ROLE_SUMMARIES: Record<RoleKey, string> = {
  system_admin: "Global controls, user management, and operational visibility.",
  sales_admin: "Sales operations visibility across all centers and teams.",
  sales_manager: "Team assignment, pipeline performance, and deal movement.",
  sales_agent_licensed: "Owned/team leads, conversion workflow, and callback queue.",
  sales_agent_unlicensed: "Verification/disposition workflow for assigned leads.",
  call_center_admin: "Center performance and oversight of call-center submissions.",
  call_center_agent: "Lead submission and follow-up on your own transferred leads.",
  hr: "User lifecycle, onboarding, and role administration tasks.",
  accounting: "Commission, deal tracker, and financial-status visibility.",
};
