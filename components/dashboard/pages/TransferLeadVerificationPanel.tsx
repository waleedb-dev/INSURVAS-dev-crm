"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  loadVerificationItems,
  updateVerificationItem,
  type VerificationItemRow,
} from "./transferLeadParity";

type Props = {
  sessionId: string;
  showProgressSummary?: boolean;
  onProgressChange?: (payload: { verifiedCount: number; totalCount: number; progress: number }) => void;
};

export default function TransferLeadVerificationPanel({
  sessionId,
  showProgressSummary = true,
  onProgressChange,
}: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [items, setItems] = useState<VerificationItemRow[]>([]);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [dncCheckingIds, setDncCheckingIds] = useState<Record<string, boolean>>({});
  const [dncStatusByItem, setDncStatusByItem] = useState<Record<string, "clear" | "dnc" | "tcpa" | "error">>({});
  const [dncMessageByItem, setDncMessageByItem] = useState<Record<string, string>>({});
  const [dncModal, setDncModal] = useState<{
    open: boolean;
    status: "clear" | "dnc" | "tcpa" | "error";
    itemId: string | null;
    phone: string;
    message: string;
  }>({
    open: false,
    status: "clear",
    itemId: null,
    phone: "",
    message: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const loaded = await loadVerificationItems(supabase, sessionId);
        if (cancelled) return;
        setItems(loaded);
        setDraftValues(
          Object.fromEntries(
            loaded.map((item) => [item.id, item.verified_value ?? item.original_value ?? ""]),
          ),
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load verification fields.");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [sessionId, supabase]);

  const verifiedCount = items.filter((item) => item.is_verified).length;
  const progress = items.length > 0 ? Math.round((verifiedCount * 100) / items.length) : 0;

  useEffect(() => {
    if (!onProgressChange) return;
    onProgressChange({ verifiedCount, totalCount: items.length, progress });
  }, [onProgressChange, progress, verifiedCount, items.length]);

  const grouped = useMemo(() => {
    const byGroup = new Map<string, VerificationItemRow[]>();
    items.forEach((item) => {
      const key = item.field_category || "other";
      byGroup.set(key, [...(byGroup.get(key) || []), item]);
    });
    return Array.from(byGroup.entries());
  }, [items]);

  const getValueByFieldName = (fieldName: string) => {
    const match = items.find((item) => item.field_name === fieldName);
    if (!match) return "";
    return String(draftValues[match.id] ?? match.verified_value ?? match.original_value ?? "");
  };

  const saveOne = async (item: VerificationItemRow, nextIsVerified: boolean) => {
    setSavingIds((prev) => ({ ...prev, [item.id]: true }));
    setError(null);
    try {
      const nextValue = draftValues[item.id] ?? item.verified_value ?? item.original_value ?? "";
      await updateVerificationItem(supabase, item.id, {
        isVerified: nextIsVerified,
        verifiedValue: nextValue,
      });
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                is_verified: nextIsVerified,
                verified_value: nextValue,
              }
            : row,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save verification update.");
    } finally {
      setSavingIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const handleDncModalProceed = async () => {
    const itemId = dncModal.itemId;
    if (!itemId) {
      setDncModal({ open: false, status: "clear", itemId: null, phone: "", message: "" });
      return;
    }
    const targetItem = items.find((item) => item.id === itemId);
    if (!targetItem) {
      setDncModal({ open: false, status: "clear", itemId: null, phone: "", message: "" });
      return;
    }
    await saveOne(targetItem, true);
    setDncModal({ open: false, status: "clear", itemId: null, phone: "", message: "" });
  };

  const checkDncForItem = async (item: VerificationItemRow) => {
    const rawPhone = draftValues[item.id] ?? item.verified_value ?? item.original_value ?? "";
    const cleanPhone = String(rawPhone).replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setDncStatusByItem((prev) => ({ ...prev, [item.id]: "error" }));
      setDncMessageByItem((prev) => ({ ...prev, [item.id]: "Please enter a valid 10-digit US phone number first." }));
      return;
    }

    setDncCheckingIds((prev) => ({ ...prev, [item.id]: true }));
    setDncStatusByItem((prev) => ({ ...prev, [item.id]: "clear" }));
    setDncMessageByItem((prev) => ({ ...prev, [item.id]: "" }));

    try {
      const [blacklistResult, dncTestResult] = await Promise.all([
        supabase.functions.invoke("blacklist-check", { body: { phone: cleanPhone } }),
        supabase.functions.invoke("dnc-test", { body: { mobileNumber: cleanPhone } }),
      ]);
      if (blacklistResult.error && dncTestResult.error) {
        throw new Error(blacklistResult.error.message || dncTestResult.error.message || "DNC check failed");
      }

      const toPayload = (input: unknown): Record<string, unknown> => {
        const isPayloadShape = (obj: Record<string, unknown>) =>
          "is_tcpa" in obj ||
          "is_blacklisted" in obj ||
          "is_dnc" in obj ||
          "litigator" in obj ||
          "national_dnc" in obj ||
          "state_dnc" in obj ||
          "dma" in obj ||
          "message" in obj;

        const firstNestedPayload = (obj: Record<string, unknown>): Record<string, unknown> => {
          for (const value of Object.values(obj)) {
            if (value && typeof value === "object") {
              const candidate = value as Record<string, unknown>;
              if (isPayloadShape(candidate)) return candidate;
            }
          }
          return {};
        };

        if (Array.isArray(input)) {
          const first = input[0];
          return first && typeof first === "object" ? (first as Record<string, unknown>) : {};
        }
        if (!input || typeof input !== "object") return {};
        const record = input as Record<string, unknown>;
        const nested = record.data;
        if (Array.isArray(nested)) {
          const first = nested[0];
          return first && typeof first === "object" ? (first as Record<string, unknown>) : {};
        }
        if (nested && typeof nested === "object") {
          const nestedObj = nested as Record<string, unknown>;
          return isPayloadShape(nestedObj) ? nestedObj : firstNestedPayload(nestedObj);
        }
        return isPayloadShape(record) ? record : firstNestedPayload(record);
      };

      const payloadA = blacklistResult.error ? {} : toPayload(blacklistResult.data);
      const payloadB = dncTestResult.error ? {} : toPayload(dncTestResult.data);
      const mergedMessage =
        (typeof payloadA.message === "string" && payloadA.message) ||
        (typeof payloadB.message === "string" && payloadB.message) ||
        "";

      const litigatorA = String(payloadA.litigator ?? "").toUpperCase();
      const nationalDncA = String(payloadA.national_dnc ?? "").toUpperCase();
      const stateDncA = String(payloadA.state_dnc ?? "").toUpperCase();
      const dmaDncA = String(payloadA.dma ?? "").toUpperCase();
      const litigatorB = String(payloadB.litigator ?? "").toUpperCase();
      const nationalDncB = String(payloadB.national_dnc ?? "").toUpperCase();
      const stateDncB = String(payloadB.state_dnc ?? "").toUpperCase();
      const dmaDncB = String(payloadB.dma ?? "").toUpperCase();

      const isTcpa =
        payloadA.is_tcpa === true || payloadA.is_blacklisted === true || litigatorA === "Y" ||
        payloadB.is_tcpa === true || payloadB.is_blacklisted === true || litigatorB === "Y";
      const isDnc =
        payloadA.is_dnc === true || payloadB.is_dnc === true ||
        isTcpa ||
        nationalDncA === "Y" || stateDncA === "Y" || dmaDncA === "Y" ||
        nationalDncB === "Y" || stateDncB === "Y" || dmaDncB === "Y";

      const resolvedStatus: "clear" | "dnc" | "tcpa" =
        isTcpa
          ? "tcpa"
          : isDnc
            ? "dnc"
            : "clear";

      const message =
        mergedMessage ||
        (resolvedStatus === "tcpa"
          ? "WARNING: This number is blacklisted/TCPA flagged."
          : resolvedStatus === "dnc"
            ? "This number is on DNC. Proceed with verbal consent."
            : "This number is clear. Please verify consent with customer.");

      setDncStatusByItem((prev) => ({ ...prev, [item.id]: resolvedStatus }));
      setDncMessageByItem((prev) => ({ ...prev, [item.id]: message }));
      setDncModal({
        open: true,
        status: resolvedStatus,
        itemId: item.id,
        phone: String(rawPhone || cleanPhone),
        message,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to check DNC status.";
      setDncStatusByItem((prev) => ({ ...prev, [item.id]: "error" }));
      setDncMessageByItem((prev) => ({ ...prev, [item.id]: msg }));
      setDncModal({
        open: true,
        status: "error",
        itemId: item.id,
        phone: String(rawPhone || cleanPhone),
        message: msg,
      });
    } finally {
      setDncCheckingIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: `1.5px solid ${T.border}`,
        borderRadius: 18,
        boxShadow: T.shadowSm,
        padding: 18,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: T.textDark, fontWeight: 800 }}>Verification Panel</h3>
        {showProgressSummary && (
          <span style={{ fontSize: 12, fontWeight: 700, color: T.textMid }}>
            {verifiedCount}/{items.length} fields verified
          </span>
        )}
      </div>
      {showProgressSummary && (
        <div style={{ marginTop: 10, marginBottom: 14 }}>
          <div style={{ height: 10, borderRadius: 999, backgroundColor: T.rowBg, overflow: "hidden" }}>
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                borderRadius: 999,
                backgroundColor: progress >= 100 ? "#16a34a" : T.blue,
                transition: "width 0.2s ease",
              }}
            />
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: T.textMuted }}>Progress: {progress}%</p>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 10, color: "#991b1b", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: 560, overflowY: "auto", paddingRight: 4 }}>
        {grouped.map(([groupName, groupItems]) => (
          <section key={groupName}>
            <h4 style={{ margin: "0 0 8px", textTransform: "capitalize", fontSize: 12, letterSpacing: 0.3, color: T.textMuted }}>
              {groupName}
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groupItems.map((item) => {
                const isSaving = Boolean(savingIds[item.id]);
                const isPhoneField = item.field_name === "phone_number";
                const dncStatus = dncStatusByItem[item.id];
                const dncMessage = dncMessageByItem[item.id];
                const dncChecking = Boolean(dncCheckingIds[item.id]);
                return (
                  <div
                    key={item.id}
                    style={{
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      padding: 10,
                      backgroundColor: item.is_verified ? "#f0fdf4" : "#fff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>
                        {isPhoneField && dncStatus ? (
                          <span style={{ marginRight: 6 }}>
                            {dncStatus === "clear" ? "✓" : dncStatus === "error" ? "!" : "×"}
                          </span>
                        ) : null}
                        {item.field_name.replaceAll("_", " ")}
                      </span>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textMid }}>
                        {isPhoneField && (
                          <button
                            type="button"
                            onClick={() => {
                              void checkDncForItem(item);
                            }}
                            disabled={dncChecking}
                            style={{
                              borderRadius: 8,
                              border: "none",
                              padding: "5px 12px",
                              fontWeight: 700,
                              cursor: dncChecking ? "not-allowed" : "pointer",
                              backgroundColor: dncChecking ? "#d1d5db" : T.blue,
                              color: "#fff",
                            }}
                          >
                            {dncChecking ? "Checking..." : "Check"}
                          </button>
                        )}
                        <input
                          type="checkbox"
                          checked={Boolean(item.is_verified)}
                          disabled={isSaving}
                          onChange={(e) => {
                            void saveOne(item, e.target.checked);
                          }}
                        />
                        Verified
                      </label>
                    </div>

                    {isPhoneField && dncMessage && (
                      <div
                        style={{
                          marginBottom: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          color:
                            dncStatus === "error" || dncStatus === "tcpa"
                              ? T.danger
                              : dncStatus === "dnc"
                                ? "#b45309"
                                : "#166534",
                        }}
                      >
                        {dncMessage}
                      </div>
                    )}

                    <input
                      value={draftValues[item.id] ?? ""}
                      onChange={(e) => setDraftValues((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      onBlur={() => {
                        const current = draftValues[item.id] ?? "";
                        if (current === (item.verified_value ?? item.original_value ?? "")) return;
                        void saveOne(item, Boolean(item.is_verified));
                      }}
                      style={{
                        width: "100%",
                        border: `1px solid ${T.border}`,
                        borderRadius: 8,
                        padding: "7px 9px",
                        fontSize: 12,
                        color: T.textDark,
                        backgroundColor: "#fff",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {dncModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.35)",
            zIndex: 3600,
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
              backgroundColor: "#fff",
              borderRadius: 12,
              border: dncModal.status === "tcpa" ? "2px solid #ef4444" : `1.5px solid ${T.border}`,
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
              padding: 18,
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: 26,
                color:
                  dncModal.status === "tcpa"
                    ? "#dc2626"
                    : dncModal.status === "dnc"
                      ? "#ea580c"
                      : dncModal.status === "error"
                        ? "#dc2626"
                        : T.blue,
              }}
            >
              {dncModal.status === "tcpa"
                ? "⚠️ TCPA LITIGATOR WARNING"
                : dncModal.status === "dnc"
                  ? "📞 Do Not Call List"
                  : dncModal.status === "error"
                    ? "DNC Check Failed"
                    : "📞 Phone Verification"}
            </h4>
            <p style={{ margin: "8px 0 0", fontSize: 16, color: T.textMid, lineHeight: 1.45 }}>
              {dncModal.status === "tcpa"
                ? "This number is flagged as a TCPA Litigator. Proceeding may result in legal issues."
                : dncModal.status === "error"
                  ? dncModal.message
                  : "Please read the following script to the customer to obtain verbal consent."}
            </p>

            {dncModal.status === "tcpa" && (
              <div style={{ padding: "16px 0" }}>
                <p style={{ color: "#dc2626", fontWeight: 800, textAlign: "center", fontSize: 30, margin: 0 }}>
                  ⚠️ WARNING: This number is a TCPA LITIGATOR
                </p>
                <p style={{ fontSize: 18, color: T.textMid, textAlign: "center", margin: "12px 0 0" }}>
                  This number has been flagged as a TCPA litigator. It is recommended to NOT proceed with this lead.
                </p>
              </div>
            )}

            {(dncModal.status === "clear" || dncModal.status === "dnc") && (
              <div style={{ padding: "16px 0" }}>
                {dncModal.status === "dnc" && (
                  <p style={{ color: "#ea580c", fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}>
                    ⚠️ This number is on the Do Not Call list
                  </p>
                )}
                <div style={{ backgroundColor: "#f8fafc", padding: 18, borderRadius: 10, border: "2px solid #e5e7eb" }}>
                  <p style={{ fontSize: 20, margin: "0 0 12px", fontWeight: 600, lineHeight: 1.45 }}>
                    Is your phone number{" "}
                    <span style={{ color: T.blue, fontWeight: 800 }}>{dncModal.phone || ""}</span> on the Federal, National or
                    State Do Not Call List?
                  </p>
                  <p style={{ color: T.textMuted, fontSize: 13, margin: "0 0 10px" }}>
                    (if a customer says no and we see it's on the DNC list we still have to take the verbal consent)
                  </p>
                  <p style={{ fontSize: 20, margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
                    Sir/Ma'am, even if your phone number is on the Federal National or State Do not call list do we still have
                    your permission to call you and submit your application for insurance to{" "}
                    <span style={{ color: T.blue, fontWeight: 800 }}>{getValueByFieldName("carrier") || "carrier"}</span> -{" "}
                    {new Date().toLocaleDateString()} via your phone number{" "}
                    <span style={{ color: T.blue, fontWeight: 800 }}>{dncModal.phone || ""}</span>? And do we have your permission
                    to call you on the same phone number in the future if needed?
                  </p>
                  <p style={{ fontSize: 15, color: T.textMid, margin: "12px 0 0", fontWeight: 700 }}>
                    Make sure you get a clear YES on it.
                  </p>
                </div>
              </div>
            )}

            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() =>
                  setDncModal({ open: false, status: "clear", itemId: null, phone: "", message: "" })
                }
                style={{
                  border: `1px solid ${T.border}`,
                  backgroundColor: "#fff",
                  color: T.textDark,
                  borderRadius: 8,
                  padding: "10px 16px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              {dncModal.status !== "tcpa" && dncModal.status !== "error" && (
                <button
                  type="button"
                  onClick={() => {
                    void handleDncModalProceed();
                  }}
                  style={{
                    border: "none",
                    backgroundColor: "#16a34a",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  I Got Verbal Consent - Proceed
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
