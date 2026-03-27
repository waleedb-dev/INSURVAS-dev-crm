"use client";

import type { DailyDealFlowRow } from "./types";
import type { CSSProperties } from "react";

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

export function getGroupValue(row: DailyDealFlowRow, field: string): string {
  if (field === "is_callback") return row.is_callback || row.from_callback ? "Callback" : "Regular Lead";
  if (field === "is_retention_call") return row.is_retention_call ? "Retention" : "Regular";
  return String(row[field as keyof DailyDealFlowRow] || "N/A");
}

export function duplicateKey(row: DailyDealFlowRow): string {
  return `${row.insured_name || ""}|${row.client_phone_number || ""}|${row.lead_vendor || ""}`;
}

export function getBadgeStyle(kind: "vendor" | "status" | "result" | "agent" | "licensed", value?: string | null): CSSProperties {
  const v = (value || "").toLowerCase();
  const map: Record<string, string> = {
    "pending approval": "#16a34a",
    "needs bpo callback": "#eab308",
    "returned to center - dq": "#f97316",
    "dq'd can't be sold": "#6b7280",
    "application withdrawn": "#a855f7",
    "call back fix": "#ec4899",
    "incomplete transfer": "#6366f1",
    submitted: "#16a34a",
    underwriting: "#ca8a04",
    "not submitted": "#dc2626",
  };

  let bg = "#9ca3af";
  if (kind === "status" || kind === "result") {
    bg = map[v] || "#9ca3af";
  } else if (kind === "vendor") {
    bg = "#3b82f6";
  } else if (kind === "agent") {
    bg = "#0ea5e9";
  } else if (kind === "licensed") {
    bg = "#8b5cf6";
  }

  return {
    backgroundColor: bg,
    color: "#fff",
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
