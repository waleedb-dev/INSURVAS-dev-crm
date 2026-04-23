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

function isDncTcpaLitigator(data: Record<string, unknown> | null, httpOk: boolean): boolean {
  if (!data || !httpOk) return false;
  const flags = data.flags as { isTcpa?: boolean } | undefined;
  return flags?.isTcpa === true;
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
  const isDnc = flags?.isDnc === true;
  const bits: string[] = [];
  if (flags?.isTcpa === true) bits.push("TCPA");
  if (flags?.isDnc === true) bits.push("DNC");
  if (flags?.isInvalid === true) bits.push("invalid");
  if (flags?.isClean === true) bits.push("clean");
  const flagStr = bits.length ? ` (${bits.join(", ")})` : "";
  // Product choice: do not surface DNC messaging here — only TCPA should interrupt the workflow.
  if (isDnc) return { line: "—", tone: "muted" };
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
  const [tcpaBlocked, setTcpaBlocked] = useState(false);
  const [tcpaModalOpen, setTcpaModalOpen] = useState(false);
  const [tcpaModalMessage, setTcpaModalMessage] = useState("");

  const runSearch = async () => {
    const clean = normalizePhone10(phoneInput);
    if (!clean) {
      setError("Enter a valid 10-digit US mobile number (or 11 digits starting with 1).");
      setRawPayload(null);
      setDncLookupPayload(null);
      setDisplayPhone(null);
      setTcpaBlocked(false);
      setTcpaModalOpen(false);
      return;
    }
    setLoading(true);
    setError(null);
    setRawPayload(null);
    setDncLookupPayload(null);
    setDncLookupHttpOk(false);
    setTcpaBlocked(false);
    setTcpaModalOpen(false);
    setTcpaModalMessage("");
    setDisplayPhone(clean);
    try {
      const dncRes = await runDncLookup(supabase, clean);
      const dncData =
        dncRes.data && typeof dncRes.data === "object" && !Array.isArray(dncRes.data)
          ? (dncRes.data as Record<string, unknown>)
          : null;
      setDncLookupPayload(dncData);
      setDncLookupHttpOk(dncRes.ok);

      if (!dncRes.ok) {
        const msg =
          String(dncData?.message ?? dncData?.error ?? "").trim() ||
          `dnc-check failed (${dncRes.status}).`;
        setError(msg);
        return;
      }

      const dncCallStatus = String(dncData?.callStatus ?? "");
      if (dncCallStatus === "ERROR") {
        setError(
          String(dncData?.message ?? "").trim() ||
            "Screening could not be completed. Do not treat this number as safe.",
        );
        return;
      }

      if (isDncTcpaLitigator(dncData, true)) {
        setTcpaBlocked(true);
        setTcpaModalMessage(
          String(dncData?.message ?? "").trim() ||
            "This number is flagged as a TCPA litigator. Contact and transfer-check are not permitted.",
        );
        setTcpaModalOpen(true);
        return;
      }

      const transferRes = await runTransferCheck(supabase, clean);

      setRawPayload(
        transferRes.data && typeof transferRes.data === "object" && !Array.isArray(transferRes.data)
          ? (transferRes.data as Record<string, unknown>)
          : null,
      );

      if (!transferRes.ok) {
        const msg =
          String(transferRes.data?.message ?? transferRes.data?.error ?? "").trim() ||
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
  const transferCheckLine = tcpaBlocked
    ? "Not run — TCPA litigator (dnc-check). CRM transfer-check is skipped."
    : [rootMessage, crmDuplicateMessage].find((s) => String(s ?? "").trim().length > 0)?.trim() || "—";
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
    ["transfer-check", transferCheckLine],
  ];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 8px 48px" }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: T.textDark }}>Search user by mobile number</h1>

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

      {displayPhone && dncLookupPayload && !loading && (tcpaBlocked || rawPayload) && (
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
          </div>
        </div>
      )}

      {tcpaModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tcpa-tester-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.35)",
            zIndex: 3800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 760,
              maxHeight: "90vh",
              overflow: "auto",
              backgroundColor: "#fff",
              borderRadius: 20,
              border: `2px solid ${T.danger}`,
              boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: `1px solid ${T.borderLight}`,
                backgroundColor: "#fef2f2",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  CRITICAL ALERT
                </p>
                <h4
                  id="tcpa-tester-modal-title"
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#dc2626",
                  }}
                >
                  TCPA LITIGATOR DETECTED
                </h4>
              </div>
            </div>

            <div style={{ padding: "24px", textAlign: "center" }}>
              <div style={{ padding: "16px 0" }}>
                <p style={{ color: "#dc2626", fontWeight: 800, fontSize: 22, margin: "0 0 12px" }}>
                  This number is flagged as a TCPA litigator
                </p>
                <p style={{ fontSize: 14, color: T.textMid, margin: 0, lineHeight: 1.6 }}>
                  Proceeding with this lead may result in legal issues. Transfers and contact attempts are prohibited.
                </p>
                <p style={{ fontSize: 14, color: T.textMid, margin: "12px 0 0", lineHeight: 1.6 }}>
                  CRM transfer-check was not run for this number.
                </p>
                {tcpaModalMessage ? (
                  <p style={{ marginTop: 14, fontSize: 13, color: T.textMuted, fontWeight: 600, lineHeight: 1.45 }}>{tcpaModalMessage}</p>
                ) : null}
              </div>
            </div>

            <div
              style={{
                padding: "16px 24px",
                borderTop: `1px solid ${T.borderLight}`,
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
                backgroundColor: "#fafcff",
              }}
            >
              <button
                type="button"
                onClick={() => setTcpaModalOpen(false)}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  backgroundColor: "#fff",
                  color: T.textDark,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: "pointer",
                  transition: "all 0.15s ease-in-out",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#233217";
                  e.currentTarget.style.color = "#233217";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.color = T.textDark;
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
