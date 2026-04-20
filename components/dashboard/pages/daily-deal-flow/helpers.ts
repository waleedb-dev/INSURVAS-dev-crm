"use client";

import type { DailyDealFlowRow } from "./types";
import type { CSSProperties } from "react";
import { T } from "@/lib/theme";

export function formatDateShort(value?: string | null): string {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIndex = Number(month) - 1;
  return `${monthNames[monthIndex] || month} ${day.padStart(2, "0")}, ${year.slice(-2)}`;
}

export function dateObjectToESTString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getCurrentTimestampEST(): string {
  const now = new Date();
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return est.toISOString();
}

export function getTodayDateEST(): string {
  return dateObjectToESTString(new Date());
}

export function createDateFromString(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Status label in DDF UI/export; underwriting rows align with pending approval. */
export function displayDdfStatus(status?: string | null): string {
  const s = String(status || "").trim();
  if (!s) return "N/A";
  if (s === "Underwriting") return "Pending Approval";
  return s;
}

export function getGroupValue(row: DailyDealFlowRow, field: string): string {
  if (field === "is_callback") return row.is_callback || row.from_callback ? "Callback" : "Regular Lead";
  if (field === "is_retention_call") return row.is_retention_call ? "Retention" : "Regular";
  if (field === "status") return displayDdfStatus(row.status);
  return String(row[field as keyof DailyDealFlowRow] || "N/A");
}

export function duplicateKey(row: DailyDealFlowRow): string {
  return `${row.insured_name || ""}|${row.client_phone_number || ""}|${row.lead_vendor || ""}`;
}

const VENDOR_COLORS: Record<string, { backgroundColor: string; color: string }> = {};
const AGENT_COLORS: Record<string, { backgroundColor: string; color: string }> = {};
const VENDOR_COLOR_PALETTE = [
  { backgroundColor: "#3b82f6", color: "#fff" },
  { backgroundColor: "#8b5cf6", color: "#fff" },
  { backgroundColor: "#ec4899", color: "#fff" },
  { backgroundColor: "#f97316", color: "#fff" },
  { backgroundColor: "#06b6d4", color: "#fff" },
  { backgroundColor: "#84cc16", color: "#fff" },
  { backgroundColor: "#f43f5e", color: "#fff" },
  { backgroundColor: "#14b8a6", color: "#fff" },
  { backgroundColor: "#a855f7", color: "#fff" },
  { backgroundColor: "#eab308", color: "#000" },
];
const AGENT_COLOR_PALETTE = [
  { backgroundColor: "#0ea5e9", color: "#fff" },
  { backgroundColor: "#6366f1", color: "#fff" },
  { backgroundColor: "#d946ef", color: "#fff" },
  { backgroundColor: "#f97316", color: "#fff" },
  { backgroundColor: "#2dd4bf", color: "#fff" },
  { backgroundColor: "#a3e635", color: "#000" },
  { backgroundColor: "#fb7185", color: "#fff" },
  { backgroundColor: "#38bdf8", color: "#fff" },
  { backgroundColor: "#c084fc", color: "#fff" },
  { backgroundColor: "#fbbf24", color: "#000" },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getUniqueColor(value: string, palette: { backgroundColor: string; color: string }[], cache: Record<string, { backgroundColor: string; color: string }>): { backgroundColor: string; color: string } {
  const key = value.toLowerCase();
  if (!cache[key]) {
    const index = hashString(key) % palette.length;
    cache[key] = palette[index];
  }
  return cache[key];
}

export function getVendorBadgeStyle(value?: string | null): CSSProperties {
  const v = value || "";
  if (!v) return { backgroundColor: "#6b7280", color: "#fff" };
  const colors = getUniqueColor(v, VENDOR_COLOR_PALETTE, VENDOR_COLORS);
  return {
    ...colors,
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 700,
    display: "inline-block",
    whiteSpace: "nowrap",
  };
}

export function getAgentBadgeStyle(value?: string | null): CSSProperties {
  const v = value || "";
  if (!v) return { backgroundColor: "#6b7280", color: "#fff" };
  const colors = getUniqueColor(v, AGENT_COLOR_PALETTE, AGENT_COLORS);
  return {
    ...colors,
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 700,
    display: "inline-block",
    whiteSpace: "nowrap",
  };
}

export function getBadgeStyle(kind: "vendor" | "status" | "result" | "agent" | "licensed", value?: string | null): CSSProperties {
  const v = (value || "").toLowerCase();
  const map: Record<string, { backgroundColor: string; color: string }> = {
    "pending approval": { backgroundColor: "#22c55e", color: "#fff" },
    "needs bpo callback": { backgroundColor: "#f59e0b", color: "#fff" },
    "returned to center - dq": { backgroundColor: "#6b7280", color: "#fff" },
    "dq'd can't be sold": { backgroundColor: "#6b7280", color: "#fff" },
    "application withdrawn": { backgroundColor: "#ef4444", color: "#fff" },
    "call back fix": { backgroundColor: "#f59e0b", color: "#fff" },
    "incomplete transfer": { backgroundColor: "#3b82f6", color: "#fff" },
    submitted: { backgroundColor: "#22c55e", color: "#fff" },
    underwriting: { backgroundColor: "#f59e0b", color: "#fff" },
    "not submitted": { backgroundColor: "#ef4444", color: "#fff" },
    "previously sold bpo": { backgroundColor: "#6b7280", color: "#fff" },
    "fulfilled carrier requirements": { backgroundColor: "#22c55e", color: "#fff" },
    "not interested": { backgroundColor: "#ef4444", color: "#fff" },
  };

  let colors: { backgroundColor: string; color: string } = { backgroundColor: "#233217", color: "#fff" };
  if (kind === "status" || kind === "result") {
    colors = map[v] || colors;
  } else if (kind === "vendor") {
    colors = getUniqueColor(v, VENDOR_COLOR_PALETTE, VENDOR_COLORS);
  } else if (kind === "agent") {
    colors = getUniqueColor(v, AGENT_COLOR_PALETTE, AGENT_COLORS);
  } else {
    colors = { backgroundColor: "#233217", color: "#fff" };
  }

  return {
    ...colors,
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 700,
    display: "inline-block",
    whiteSpace: "nowrap",
  };
}

export function generatePendingApprovalNotes(
  licensedAgentAccount: string,
  carrier: string,
  productType: string,
  monthlyPremium: number | null,
  coverageAmount: number | null,
  draftDate: string | null,
): string {
  const parts: string[] = [];
  if (licensedAgentAccount && licensedAgentAccount !== "N/A") parts.push(`1. Licensed agent account: ${licensedAgentAccount}`);
  if (carrier && carrier !== "N/A") parts.push(`2. Carrier: ${carrier}`);
  if (productType && productType !== "N/A") parts.push(`3. Carrier product name and level: ${productType}`);
  if (monthlyPremium && monthlyPremium > 0) parts.push(`4. Premium amount: $${monthlyPremium}`);
  if (coverageAmount && coverageAmount > 0) parts.push(`5. Coverage amount: $${coverageAmount}`);
  if (draftDate) parts.push(`6. Draft date: ${draftDate}`);
  parts.push("7. Sent to Underwriting");
  if (/aetna|corebridge/i.test(carrier)) {
    parts.push("8. Commissions from this carrier are paid after the first successful draft");
  } else if (/cica/i.test(carrier)) {
    parts.push("8. Commissions from this carrier are paid 10-14 days after first successful draft");
  } else {
    parts.push("8. Commissions are paid after policy is officially approved and issued");
  }
  return parts.join("\n");
}
