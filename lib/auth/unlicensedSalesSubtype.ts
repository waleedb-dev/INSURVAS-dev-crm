/** Stored on `public.users.unlicensed_sales_subtype` when role is sales_agent_unlicensed. */
export const UNLICENSED_SALES_SUBTYPE_KEYS = ["buffer_agent", "retention_agent"] as const;

export type UnlicensedSalesSubtype = (typeof UNLICENSED_SALES_SUBTYPE_KEYS)[number];

export const UNLICENSED_SALES_SUBTYPE_LABELS: Record<UnlicensedSalesSubtype, string> = {
  buffer_agent: "Buffer agent",
  retention_agent: "Retention agent",
};

export function isUnlicensedSalesSubtype(value: unknown): value is UnlicensedSalesSubtype {
  return value === "buffer_agent" || value === "retention_agent";
}
