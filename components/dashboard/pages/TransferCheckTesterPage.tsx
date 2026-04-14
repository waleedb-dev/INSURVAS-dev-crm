"use client";

import { useMemo, useState } from "react";
import { Phone, Search, User } from "lucide-react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { runDncLookup } from "@/lib/dncLookupApi";
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

type CrmDuplicateSummary = {
  has_match?: boolean;
  rule_message?: string;
  error?: string;
  /** From CRM `leads` when the match is unambiguous. */
  matched_contact_name?: string;
};

/** Prefer server CRM copy when present (edge `crm_phone_match.rule_message`). */
function pickCrmDuplicateMessage(crm: CrmDuplicateSummary | undefined): string {
  if (crm?.has_match !== true) return "";
  const msg = String(crm.rule_message ?? "").trim();
  if (msg) return msg;
  const err = String(crm.error ?? "").trim();
  if (err) return err;
  return "";
}

function summarizeDncLookupEdge(
  data: Record<string, unknown> | null,
  httpOk: boolean,
): { line: string; tone: "muted" | "ok" | "warn" | "danger" } {
  if (!data) return { line: "—", tone: "muted" };
  if (!httpOk) {
    const m = String(data.message ?? data.error ?? "dnc-check request failed").trim();
    return { line: m || "dnc-check failed", tone: "danger" };
  }
  const cs = String(data.callStatus ?? "").trim();
  const msg = String(data.message ?? "").trim();
  const flags = data.flags as Record<string, unknown> | undefined;
  const bits: string[] = [];
  if (flags?.isTcpa === true) bits.push("TCPA");
  if (flags?.isDnc === true) bits.push("DNC");
  if (flags?.isInvalid === true) bits.push("invalid");
  if (flags?.isClean === true) bits.push("clean");
  const flagStr = bits.length ? ` (${bits.join(", ")})` : "";
  const line = (cs ? `[${cs}] ` : "") + (msg || "—") + flagStr;
  if (cs === "DANGER" || cs === "ERROR") return { line, tone: "danger" };
  if (cs === "WARNING" || cs === "INVALID") return { line, tone: "warn" };
  return { line, tone: "ok" };
}

export default function TransferCheckTesterPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [phoneInput, setPhoneInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawPayload, setRawPayload] = useState<Record<string, unknown> | null>(null);
  const [dncLookupPayload, setDncLookupPayload] = useState<Record<string, unknown> | null>(null);
  const [dncLookupHttpOk, setDncLookupHttpOk] = useState(false);
  const [displayPhone, setDisplayPhone] = useState<string | null>(null);

  const runSearch = async () => {
    const clean = normalizePhone10(phoneInput);
    if (!clean) {
      setError("Enter a valid 10-digit US mobile number (or 11 digits starting with 1).");
      setRawPayload(null);
      setDncLookupPayload(null);
      setDisplayPhone(null);
      return;
    }
    setLoading(true);
    setError(null);
    setRawPayload(null);
    setDncLookupPayload(null);
    setDncLookupHttpOk(false);
    setDisplayPhone(clean);
    try {
      const [transferRes, dncRes] = await Promise.all([
        runTransferCheck(supabase, clean, {
          phoneRaw: phoneInput.trim(),
        }),
        runDncLookup(supabase, clean),
      ]);

      setRawPayload(transferRes.data);
      setDncLookupPayload(dncRes.data);
      setDncLookupHttpOk(dncRes.ok);

      if (!transferRes.ok) {
        const msg =
          String(transferRes.data.message ?? transferRes.data.error ?? "").trim() ||
          `transfer-check failed (${transferRes.status}).`;
        setError(msg);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      setRawPayload(null);
      setDncLookupPayload(null);
    } finally {
      setLoading(false);
    }
  };

  const rootMessage = rawPayload ? String(rawPayload.message ?? "").trim() : "";
  const crmDup = rawPayload?.crm_phone_match as CrmDuplicateSummary | undefined;
  const crmDuplicateMessage = pickCrmDuplicateMessage(crmDup);
  const transferCheckLine =
    [rootMessage, crmDuplicateMessage].find((s) => String(s ?? "").trim().length > 0)?.trim() || "—";
  const customerName =
    String(crmDup?.matched_contact_name ?? "").trim() ||
    pickCustomerName(
      rawPayload &&
        typeof rawPayload.data === "object" &&
        rawPayload.data !== null &&
        !Array.isArray(rawPayload.data)
        ? (rawPayload.data as Record<string, unknown>)
        : undefined,
    );
  const dncEdge = summarizeDncLookupEdge(dncLookupPayload, dncLookupHttpOk);

  const dncBannerBg =
    dncEdge.tone === "danger"
      ? "#fef2f2"
      : dncEdge.tone === "warn"
        ? "#fffbeb"
        : dncEdge.tone === "ok"
          ? "#f0fdf4"
          : T.rowBg;
  const dncBannerBorder =
    dncEdge.tone === "danger"
      ? "#fecaca"
      : dncEdge.tone === "warn"
        ? "#fde68a"
        : dncEdge.tone === "ok"
          ? "#bbf7d0"
          : T.borderLight;
  const dncBannerColor =
    dncEdge.tone === "danger" ? "#991b1b" : dncEdge.tone === "warn" ? "#92400e" : dncEdge.tone === "ok" ? "#166534" : T.textMid;

  const infoRows: [string, string][] = [
    ["Mobile number", displayPhone ? displayPhone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3") : "—"],
    ["Name", customerName],
    ["dnc-check", dncEdge.line],
    ["transfer-check", transferCheckLine],
  ];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 8px 48px" }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: T.textDark }}>Search user by mobile number</h1>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
        Runs <strong>dnc-check</strong> and <strong>transfer-check</strong> in parallel. <strong>Transfer-check</strong> is
        CRM-only: phone match → SSN cohort → <code style={{ fontSize: 12 }}>crm_phone_match</code> / stage precedence
        (see raw JSON).
      </p>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "stretch",
          flexWrap: "wrap",
          marginBottom: 16,
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
            placeholder="Phone (555) 123-4567"
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

      {displayPhone && dncLookupPayload && !loading && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 10,
            backgroundColor: dncBannerBg,
            border: `1px solid ${dncBannerBorder}`,
            color: dncBannerColor,
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          <strong style={{ fontWeight: 800 }}>dnc-check:</strong> {dncEdge.line}
        </div>
      )}

      {displayPhone && rawPayload && !loading && (
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
                {JSON.stringify(
                  {
                    transfer_check: rawPayload,
                    dnc_lookup: dncLookupPayload,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
