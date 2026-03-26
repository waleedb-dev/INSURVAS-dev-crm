"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { runBlacklistDncPhoneCheck } from "@/lib/dncCheck";
import {
  loadVerificationItems,
  updateVerificationItem,
  type VerificationItemRow,
} from "./transferLeadParity";
import { useCarrierProductDropdowns, type CarrierProductRow } from "@/lib/useCarrierProductDropdowns";

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
  const [showUnderwritingModal, setShowUnderwritingModal] = useState(false);
  const [underwritingSaving, setUnderwritingSaving] = useState(false);
  const [toolkitUrl, setToolkitUrl] = useState("https://insurancetoolkits.com/login");
  const [underwritingData, setUnderwritingData] = useState({
    tobaccoLast12Months: "",
    healthConditions: "",
    medications: "",
    height: "",
    weight: "",
    carrier: "",
    productLevel: "",
    coverageAmount: "",
    monthlyPremium: "",
  });

  const onInvalidateUwProduct = useCallback((list: CarrierProductRow[], carrierNameSnapshot: string) => {
    setUnderwritingData((prev) => {
      if (prev.carrier.trim() !== carrierNameSnapshot) return prev;
      if (!prev.productLevel.trim()) return prev;
      if (list.some((x) => x.name === prev.productLevel)) return prev;
      return { ...prev, productLevel: "" };
    });
  }, []);

  const { carriers: uwCarriers, productsForCarrier: uwProducts, loadingProducts: uwProductsLoading } =
    useCarrierProductDropdowns(supabase, {
      open: showUnderwritingModal,
      carrierName: underwritingData.carrier,
      onInvalidateProduct: onInvalidateUwProduct,
    });

  const uwFieldStyle: CSSProperties = {
    width: "100%",
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "9px 10px",
    boxSizing: "border-box",
    fontSize: 14,
    fontFamily: T.font,
    backgroundColor: "#fff",
  };

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

  const getValueByFieldNames = (fieldNames: string[]) => {
    for (const fieldName of fieldNames) {
      const value = getValueByFieldName(fieldName).trim();
      if (value) return value;
    }
    return "";
  };

  const openUnderwritingModal = () => {
    const tobaccoRaw = getValueByFieldName("tobacco_use").toLowerCase();
    const tobaccoLast12Months =
      tobaccoRaw === "yes" || tobaccoRaw === "y" || tobaccoRaw === "true"
        ? "yes"
        : tobaccoRaw === "no" || tobaccoRaw === "n" || tobaccoRaw === "false"
          ? "no"
          : "";

    setUnderwritingData({
      tobaccoLast12Months,
      healthConditions: getValueByFieldName("health_conditions"),
      medications: getValueByFieldName("medications"),
      height: getValueByFieldName("height"),
      weight: getValueByFieldName("weight"),
      carrier: getValueByFieldName("carrier"),
      productLevel: getValueByFieldNames(["product_type", "insurance_application_details"]),
      coverageAmount: getValueByFieldName("coverage_amount"),
      monthlyPremium: getValueByFieldName("monthly_premium"),
    });
    setToolkitUrl("https://insurancetoolkits.com/login");
    setShowUnderwritingModal(true);
  };

  const updateItemVerifiedValue = async (fieldName: string, rawValue: string) => {
    const item = items.find((row) => row.field_name === fieldName);
    const value = String(rawValue || "").trim();
    if (!item || !value) return;
    await updateVerificationItem(supabase, item.id, {
      isVerified: true,
      verifiedValue: value,
    });
    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? {
              ...row,
              is_verified: true,
              verified_value: value,
            }
          : row,
      ),
    );
    setDraftValues((prev) => ({ ...prev, [item.id]: value }));
  };

  const handleUnderwritingSaveAndVerify = async () => {
    setUnderwritingSaving(true);
    setError(null);
    try {
      await updateItemVerifiedValue(
        "tobacco_use",
        underwritingData.tobaccoLast12Months === "yes"
          ? "Yes"
          : underwritingData.tobaccoLast12Months === "no"
            ? "No"
            : "",
      );
      await updateItemVerifiedValue("health_conditions", underwritingData.healthConditions);
      await updateItemVerifiedValue("medications", underwritingData.medications);
      await updateItemVerifiedValue("height", underwritingData.height);
      await updateItemVerifiedValue("weight", underwritingData.weight);
      await updateItemVerifiedValue("carrier", underwritingData.carrier);
      await updateItemVerifiedValue("product_type", underwritingData.productLevel);
      await updateItemVerifiedValue(
        "coverage_amount",
        underwritingData.coverageAmount.replace(/\$/g, "").replace(/,/g, ""),
      );
      await updateItemVerifiedValue(
        "monthly_premium",
        underwritingData.monthlyPremium.replace(/\$/g, "").replace(/,/g, ""),
      );
      setShowUnderwritingModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save underwriting values.");
    } finally {
      setUnderwritingSaving(false);
    }
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
      const { status: resolvedStatus, message } = await runBlacklistDncPhoneCheck(supabase, cleanPhone);

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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showProgressSummary && (
            <span style={{ fontSize: 12, fontWeight: 700, color: T.textMid }}>
              {verifiedCount}/{items.length} fields verified
            </span>
          )}
        </div>
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
                    {isPhoneField && (
                      <button
                        type="button"
                        onClick={openUnderwritingModal}
                        style={{
                          width: "100%",
                          marginTop: 10,
                          border: "none",
                          backgroundColor: "#7c3aed",
                          color: "#fff",
                          borderRadius: 8,
                          padding: "10px 12px",
                          fontWeight: 800,
                          cursor: "pointer",
                          fontSize: 14,
                        }}
                      >
                        Underwriting
                      </button>
                    )}
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
                {dncModal.message ? (
                  <p style={{ marginTop: 12, fontSize: 13, color: T.textMuted, fontWeight: 600, lineHeight: 1.45 }}>
                    {dncModal.message}
                  </p>
                ) : null}
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

      {showUnderwritingModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            zIndex: 3700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <div
            style={{
              width: "95vw",
              maxWidth: 1400,
              maxHeight: "95vh",
              overflowY: "auto",
              backgroundColor: "#fff",
              borderRadius: 14,
              border: `1.5px solid ${T.border}`,
              padding: 18,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#7c3aed" }}>Underwriting</h4>
            <p style={{ marginTop: 8, marginBottom: 12, color: T.textMid, fontSize: 16 }}>
              Please read the following script to the customer and verify all information.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "stretch" }}>
              <div style={{ backgroundColor: "#f8fafc", padding: 14, borderRadius: 10, border: `1px solid ${T.border}`, overflowY: "auto" }}>
                <h5 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 800 }}>Underwriting Questions</h5>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 18, color: T.textDark }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    "I am going to ask you some medical questions and we expect your honesty that is going to save us a lot of
                    time. This helps us evaluate which insurance carrier gives the maximum benefit at the lowest rate."
                  </p>
                  <div style={{ backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 }}>
                    <p style={{ margin: 0, fontWeight: 800 }}>Question 1</p>
                    <p style={{ margin: "6px 0 0", fontSize: 16 }}>
                      Have you ever been diagnosed with Alzheimer's, dementia, CHF, organ transplant, HIV/AIDS, TB, chronic
                      respiratory disease, currently paralyzed, amputation due to disease, currently on oxygen, or currently in
                      nursing facility?
                    </p>
                  </div>
                  <div style={{ backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 }}>
                    <p style={{ margin: 0, fontWeight: 800 }}>Question 2</p>
                    <p style={{ margin: "6px 0 0", fontSize: 16 }}>
                      In the last 5 years, any heart attack, cancer, dementia, kidney failure, organ removal? Any disorder of
                      kidney/lung/brain/heart/liver? Or recent stent, pacemaker, defibrillator, stroke, TIA, paralysis?
                    </p>
                  </div>
                  <div style={{ backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 }}>
                    <p style={{ margin: 0, fontWeight: 800 }}>Question 3</p>
                    <p style={{ margin: "6px 0 0", fontSize: 16 }}>
                      Any diabetes complications (neuropathy, retinopathy, diabetic coma), COPD, bipolar, or schizophrenia?
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ border: "2px solid #c4b5fd", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ backgroundColor: "#7c3aed", color: "#fff", padding: "10px 12px", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Insurance Toolkit</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setToolkitUrl("https://insurancetoolkits.com/fex/quoter")}
                      style={{ border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 700 }}
                    >
                      Quote Tool
                    </button>
                    <button
                      type="button"
                      onClick={() => setToolkitUrl("https://insurancetoolkits.com/login")}
                      style={{ border: "1px solid #fff", background: "transparent", color: "#fff", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 700 }}
                    >
                      Login
                    </button>
                  </div>
                </div>
                <div style={{ minHeight: 520, backgroundColor: "#fff" }}>
                  <iframe
                    style={{ border: "none", height: "100%", minHeight: 520, width: "100%" }}
                    src={toolkitUrl}
                    title="Insurance Toolkit"
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1", border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
                <label style={{ fontWeight: 800, display: "block", marginBottom: 8 }}>Tobacco Usage (last 12 months)</label>
                <div style={{ display: "flex", gap: 16 }}>
                  <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="radio"
                      name="uw_tobacco"
                      checked={underwritingData.tobaccoLast12Months === "yes"}
                      onChange={() => setUnderwritingData((prev) => ({ ...prev, tobaccoLast12Months: "yes" }))}
                    />
                    Yes
                  </label>
                  <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="radio"
                      name="uw_tobacco"
                      checked={underwritingData.tobaccoLast12Months === "no"}
                      onChange={() => setUnderwritingData((prev) => ({ ...prev, tobaccoLast12Months: "no" }))}
                    />
                    No
                  </label>
                </div>
              </div>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
                <label style={{ fontWeight: 800, display: "block", marginBottom: 8 }}>Health Conditions (comma separated)</label>
                <textarea
                  value={underwritingData.healthConditions}
                  onChange={(e) => setUnderwritingData((prev) => ({ ...prev, healthConditions: e.target.value }))}
                  rows={4}
                  style={{ width: "100%", border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 10px", resize: "vertical" }}
                />
              </div>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
                <label style={{ fontWeight: 800, display: "block", marginBottom: 8 }}>Medications (comma separated)</label>
                <textarea
                  value={underwritingData.medications}
                  onChange={(e) => setUnderwritingData((prev) => ({ ...prev, medications: e.target.value }))}
                  rows={4}
                  style={{ width: "100%", border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 10px", resize: "vertical" }}
                />
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {(
                [
                  ["Height", "height", "e.g. 5'10\""],
                  ["Weight", "weight", "e.g. 180 lbs"],
                  ["Carrier", "carrier", "e.g. AMAM"],
                  ["Product Level", "productLevel", ""],
                  ["Coverage Amount", "coverageAmount", "e.g. $10,000"],
                  ["Monthly Premium", "monthlyPremium", "e.g. $50.00"],
                ] as const
              ).map(([label, key, placeholder]) => {
                if (key === "carrier") {
                  return (
                    <div key={key} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
                      <label style={{ fontWeight: 800, display: "block", marginBottom: 8 }}>Carrier</label>
                      <select
                        value={underwritingData.carrier}
                        onChange={(e) => {
                          const v = e.target.value;
                          setUnderwritingData((prev) => ({ ...prev, carrier: v, productLevel: "" }));
                        }}
                        style={uwFieldStyle}
                      >
                        <option value="">Select carrier</option>
                        {uwCarriers.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                if (key === "productLevel") {
                  return (
                    <div key={key} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
                      <label style={{ fontWeight: 800, display: "block", marginBottom: 8 }}>Product Level</label>
                      <select
                        value={underwritingData.productLevel}
                        onChange={(e) => setUnderwritingData((prev) => ({ ...prev, productLevel: e.target.value }))}
                        disabled={!underwritingData.carrier.trim() || uwProductsLoading}
                        style={{ ...uwFieldStyle, opacity: !underwritingData.carrier.trim() || uwProductsLoading ? 0.7 : 1 }}
                      >
                        <option value="">
                          {uwProductsLoading
                            ? "Loading products…"
                            : underwritingData.carrier.trim() && uwProducts.length === 0
                              ? "No products for this carrier"
                              : "Select product level"}
                        </option>
                        {uwProducts.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return (
                  <div key={key} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
                    <label style={{ fontWeight: 800, display: "block", marginBottom: 8 }}>{label}</label>
                    <input
                      value={underwritingData[key as keyof typeof underwritingData]}
                      onChange={(e) =>
                        setUnderwritingData((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      placeholder={placeholder}
                      style={{ width: "100%", border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 10px" }}
                    />
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: T.textMuted, textAlign: "center" }}>
              Clicking "Save & Verify All" will save entered fields to verification panel and mark them as verified.
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowUnderwritingModal(false)}
                disabled={underwritingSaving}
                style={{
                  border: `1px solid ${T.border}`,
                  backgroundColor: "#fff",
                  color: T.textDark,
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontWeight: 700,
                  cursor: underwritingSaving ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleUnderwritingSaveAndVerify();
                }}
                disabled={underwritingSaving}
                style={{
                  border: "none",
                  backgroundColor: underwritingSaving ? T.border : "#16a34a",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontWeight: 700,
                  cursor: underwritingSaving ? "not-allowed" : "pointer",
                }}
              >
                {underwritingSaving ? "Saving..." : "Save & Verify All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
