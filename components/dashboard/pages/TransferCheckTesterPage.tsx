"use client";

import { useMemo, useState } from "react";
import { Phone, Search, User } from "lucide-react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { runTransferCheck } from "@/lib/transferCheckApi";

function normalizePhone10(value: string): string | null {
  const d = value.replace(/\D/g, "");
  if (d.length === 10) return d;
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  return null;
}

function pickCustomerName(data: Record<string, unknown> | undefined): string {
  if (!data || typeof data !== "object") return "—";
  const preferred = ["Name", "Customer Name", "Full Name", "Insured Name", "Customer", "First Name"];
  for (const k of preferred) {
    const v = data[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  for (const [k, v] of Object.entries(data)) {
    if (!/name/i.test(k) || k.toLowerCase().includes("user")) continue;
    if (v != null && String(v).trim() && typeof v !== "object") return String(v).trim();
  }
  return "—";
}

function pickPolicyStatus(data: Record<string, unknown> | undefined, rootMessage: string): string {
  if (!data || typeof data !== "object") {
    return rootMessage.trim() || "—";
  }
  const ps = data["Policy Status"] ?? data["policy status"];
  if (ps != null && String(ps).trim()) return String(ps).trim();
  if (rootMessage.trim()) return rootMessage.trim();
  return "—";
}

type CrmDuplicateSummary = {
  has_match?: boolean;
  rule_message?: string;
  error?: string;
  /** From CRM `leads` when the match is a single row (or SSN-narrowed to one). */
  matched_contact_name?: string;
};

/** Prefer server CRM copy when a duplicate exists (edge `crm_duplicate.rule_message`). */
function pickCrmDuplicateMessage(crm: CrmDuplicateSummary | undefined): string {
  if (crm?.has_match !== true) return "";
  const msg = String(crm.rule_message ?? "").trim();
  if (msg) return msg;
  const err = String(crm.error ?? "").trim();
  if (err) return err;
  return "";
}

function dncSummary(dnc: { message?: string } | undefined): string {
  const msg = String(dnc?.message ?? "").trim();
  if (!msg) return "";
  return msg;
}

export default function TransferCheckTesterPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [phoneInput, setPhoneInput] = useState("");
  const [socialInput, setSocialInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawPayload, setRawPayload] = useState<Record<string, unknown> | null>(null);
  const [displayPhone, setDisplayPhone] = useState<string | null>(null);

  const runSearch = async () => {
    const clean = normalizePhone10(phoneInput);
    if (!clean) {
      setError("Enter a valid 10-digit US mobile number (or 11 digits starting with 1).");
      setRawPayload(null);
      setDisplayPhone(null);
      return;
    }
    setLoading(true);
    setError(null);
    setRawPayload(null);
    setDisplayPhone(clean);
    try {
      const { ok, status, data } = await runTransferCheck(supabase, clean, {
        phoneRaw: phoneInput.trim(),
        social: socialInput.trim() || undefined,
      });
      if (!ok) {
        const msg =
          String(data.message ?? data.error ?? "").trim() ||
          `Request failed (${status}).`;
        setError(msg);
        setRawPayload(data);
        return;
      }
      setRawPayload(data as Record<string, unknown>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer check failed.");
      setRawPayload(null);
    } finally {
      setLoading(false);
    }
  };

  const apiData =
    rawPayload && typeof rawPayload.data === "object" && rawPayload.data !== null && !Array.isArray(rawPayload.data)
      ? (rawPayload.data as Record<string, unknown>)
      : undefined;
  const rootMessage = rawPayload ? String(rawPayload.message ?? "").trim() : "";
  const dnc = rawPayload?.dnc as { message?: string } | undefined;
  const dncText = dncSummary(dnc);
  const crmDup = rawPayload?.crm_duplicate as CrmDuplicateSummary | undefined;
  const crmDuplicateMessage = pickCrmDuplicateMessage(crmDup);
  const agencyStatus = pickPolicyStatus(apiData, rootMessage);
  const customerName =
    String(crmDup?.matched_contact_name ?? "").trim() || pickCustomerName(apiData);
  const showDncWarning = !error && displayPhone && rawPayload && !dncText && !loading;

  const infoRows: [string, string][] = [
    ["Mobile number", displayPhone ? displayPhone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3") : "—"],
    ["Name", customerName],
  ];
  if (crmDuplicateMessage) {
    infoRows.push(["CRM duplicate", crmDuplicateMessage]);
    infoRows.push(["Agency / TCPA", agencyStatus]);
  } else {
    infoRows.push(["Policy status", agencyStatus]);
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 8px 48px" }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: T.textDark }}>Search user by mobile number</h1>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
        Calls the <strong>transfer-check</strong> Edge Function (same path as Transfer Leads phone check). Optional SSN
        narrows CRM duplicate policy when multiple leads share the phone.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "stretch",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              flex: "1 1 220px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              backgroundColor: T.cardBg,
            }}
          >
            <Phone size={20} color={T.textMuted} aria-hidden />
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void runSearch()}
              placeholder="(555) 123-4567"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: 15,
                fontWeight: 600,
                color: T.textDark,
                background: "transparent",
                minWidth: 0,
              }}
            />
          </div>
          <div
            style={{
              flex: "1 1 200px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              backgroundColor: T.cardBg,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, color: T.textMuted, whiteSpace: "nowrap" }}>SSN</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={socialInput}
              onChange={(e) => setSocialInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void runSearch()}
              placeholder="Optional (multi-match)"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: 14,
                fontWeight: 600,
                color: T.textDark,
                background: "transparent",
                minWidth: 0,
              }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 20px",
            borderRadius: 10,
            border: "none",
            fontWeight: 800,
            fontSize: 14,
            cursor: loading ? "not-allowed" : "pointer",
            backgroundColor: loading ? T.border : T.blue,
            color: "#fff",
            boxShadow: loading ? "none" : "0 2px 8px rgba(35, 50, 23, 0.15)",
          }}
        >
          <Search size={18} aria-hidden />
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 10,
            backgroundColor: "#fef2f2",
            border: `1px solid #fecaca`,
            color: "#991b1b",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {showDncWarning && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 10,
            backgroundColor: "#eff6ff",
            border: `1px solid #bfdbfe`,
            color: "#1e40af",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          Could not verify DNC status from the response (no <code style={{ fontSize: 12 }}>dnc.message</code>). Policy
          fields may still be present below.
        </div>
      )}

      {dncText && !error && displayPhone && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 10,
            backgroundColor: T.blueFaint,
            border: `1px solid ${T.borderLight}`,
            color: T.textMid,
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          <strong style={{ color: T.textDark }}>DNC / screening:</strong> {dncText}
        </div>
      )}

      {displayPhone && rawPayload && !error && (
        <div
          style={{
            borderRadius: 12,
            border: `1px solid ${T.borderLight}`,
            overflow: "hidden",
            backgroundColor: T.cardBg,
            boxShadow: "0 2px 10px rgba(35, 50, 23, 0.06)",
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              backgroundColor: T.rowBg,
              borderBottom: `1px solid ${T.borderLight}`,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <User size={20} color={T.blue} aria-hidden />
            <span style={{ fontWeight: 800, fontSize: 15, color: T.textDark }}>User information</span>
          </div>
          <div style={{ padding: 16 }}>
            {infoRows.map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: `1px solid ${T.borderLight}`,
                  fontSize: 13,
                }}
              >
                <span style={{ color: T.textMuted, fontWeight: 700 }}>{label}</span>
                <span style={{ color: T.textDark, fontWeight: 600 }}>{value}</span>
              </div>
            ))}
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.textMuted }}>
                Raw API JSON
              </summary>
              <pre
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: T.rowBg,
                  border: `1px solid ${T.borderLight}`,
                  fontSize: 11,
                  overflow: "auto",
                  maxHeight: 280,
                }}
              >
                {JSON.stringify(rawPayload, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
