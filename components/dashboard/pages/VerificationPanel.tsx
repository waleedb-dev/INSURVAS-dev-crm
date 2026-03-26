"use client";

import * as React from "react";
import { IconLoader2, IconPhone } from "@tabler/icons-react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { runBlacklistDncPhoneCheck } from "@/lib/dncCheck";
import { titleizeKey } from "@/lib/agent/assigned-lead-details.logic";
import { Toast, type ToastType } from "@/components/ui/Toast";
import { useCarrierProductDropdowns, type CarrierProductRow } from "@/lib/useCarrierProductDropdowns";

type VerificationPanelProps = {
  selectedPolicyView: {
    callCenter?: string | null;
    policyNumber?: string | null;
    clientName?: string | null;
    carrier?: string | null;
    agentName?: string | null;
  } | null;
  loading: boolean;
  error: string | null;
  verificationItems: Array<Record<string, unknown>>;
  verificationInputValues: Record<string, string>;
  creatingMissingLeadVerification?: boolean;
  onToggleVerification: (itemId: string, checked: boolean) => void;
  onUpdateValue: (itemId: string, value: string) => void;
  onCreateMissingLeadVerification?: () => Promise<void>;
};

export function VerificationPanel({
  selectedPolicyView,
  loading,
  error,
  verificationItems,
  verificationInputValues,
  creatingMissingLeadVerification = false,
  onToggleVerification,
  onUpdateValue,
  onCreateMissingLeadVerification,
}: VerificationPanelProps) {
  const supabase = React.useMemo(() => getSupabaseBrowserClient(), []);
  const [toast, setToast] = React.useState<{ message: string; type: ToastType } | null>(null);

  const [showUnderwritingModal, setShowUnderwritingModal] = React.useState(false);
  const [conditionInput, setConditionInput] = React.useState("");
  const [medicationInput, setMedicationInput] = React.useState("");
  const [toolkitUrl, setToolkitUrl] = React.useState("https://insurancetoolkits.com/login");
  const [dncCheckingItemId, setDncCheckingItemId] = React.useState<string | null>(null);
  const [showDncModal, setShowDncModal] = React.useState(false);
  const [pendingPhoneVerification, setPendingPhoneVerification] = React.useState<string | null>(null);
  const [phoneDncStatusByItem, setPhoneDncStatusByItem] = React.useState<Record<string, "clear" | "dnc" | "tcpa">>({});
  const [phoneDncStatus, setPhoneDncStatus] = React.useState<"clear" | "dnc" | "tcpa" | null>(null);
  const [dncMessage, setDncMessage] = React.useState<string | null>(null);

  const [underwritingData, setUnderwritingData] = React.useState({
    tobaccoLast12Months: "" as "yes" | "no" | "",
    healthConditions: [] as string[],
    medications: [] as string[],
    height: "",
    weight: "",
    carrier: "",
    productLevel: "",
    coverageAmount: "",
    monthlyPremium: "",
  });

  const addTag = (raw: string, key: "healthConditions" | "medications") => {
    const value = raw.trim();
    if (!value) return;
    setUnderwritingData((prev) => {
      if (prev[key].some((v) => v.toLowerCase() === value.toLowerCase())) return prev;
      return { ...prev, [key]: [...prev[key], value] };
    });
  };

  const removeTag = (key: "healthConditions" | "medications", index: number) => {
    setUnderwritingData((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  };

  const setFieldValueAndVerify = (fieldName: string, value: string) => {
    const item = verificationItems.find(
      (i) => typeof i.id === "string" && typeof i.field_name === "string" && i.field_name === fieldName,
    );
    if (!item || typeof item.id !== "string") return;

    void onUpdateValue(item.id, value);
    void onToggleVerification(item.id, true);
  };

  const cleanMoney = (v: string) => v.replace(/\$/g, "").replace(/,/g, "").trim();

  const checkDnc = async (itemId: string) => {
    const item = verificationItems.find((i) => i.id === itemId);
    const phoneValue =
      verificationInputValues[itemId] ??
      (item && typeof item.verified_value === "string" ? item.verified_value : "") ??
      (item && typeof item.original_value === "string" ? item.original_value : "") ??
      "";

    const cleanPhone = phoneValue.replace(/\D/g, "");
    const normalizedPhone = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;
    if (!normalizedPhone || normalizedPhone.length !== 10) {
      setToast({
        message: "Please enter a valid 10-digit phone number before checking DNC.",
        type: "error",
      });
      return;
    }

    setDncCheckingItemId(itemId);
    try {
      const { status, message } = await runBlacklistDncPhoneCheck(supabase, normalizedPhone);

      setPhoneDncStatusByItem((prev) => ({ ...prev, [itemId]: status }));
      setPhoneDncStatus(status);
      setDncMessage(message);
      setPendingPhoneVerification(itemId);
      setShowDncModal(true);

      setToast({
        message,
        type: status === "tcpa" ? "error" : status === "dnc" ? "warning" : "success",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unable to check DNC status.";
      setToast({
        message: msg,
        type: "error",
      });
    } finally {
      setDncCheckingItemId(null);
    }
  };

  const handleDncModalConfirm = () => {
    if (pendingPhoneVerification) {
      void onToggleVerification(pendingPhoneVerification, true);
      setToast({
        message: "Phone number verified with customer consent.",
        type: "success",
      });
    }
    setPendingPhoneVerification(null);
    setPhoneDncStatus(null);
    setDncMessage(null);
    setShowDncModal(false);
  };

  const handleDncModalCancel = () => {
    setPendingPhoneVerification(null);
    setPhoneDncStatus(null);
    setDncMessage(null);
    setShowDncModal(false);
  };

  const getVerificationFieldValue = React.useCallback(
    (fieldName: string) => {
      const item = verificationItems.find(
        (i) => typeof i.id === "string" && typeof i.field_name === "string" && i.field_name === fieldName,
      );
      if (!item) return "";

      const itemId = typeof item.id === "string" ? item.id : "";
      if (!itemId) return "";

      const fromInput = verificationInputValues[itemId];
      if (typeof fromInput === "string" && fromInput.trim().length > 0) return fromInput.trim();

      const verifiedValue = typeof item.verified_value === "string" ? item.verified_value.trim() : "";
      if (verifiedValue) return verifiedValue;

      const originalValue = typeof item.original_value === "string" ? item.original_value.trim() : "";
      return originalValue;
    },
    [verificationItems, verificationInputValues],
  );

  React.useEffect(() => {
    if (!showUnderwritingModal) return;

    const parseTagList = (value: string) =>
      value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

    const tobaccoRaw = getVerificationFieldValue("tobacco_use").toLowerCase();
    const tobaccoLast12Months: "yes" | "no" | "" =
      tobaccoRaw === "yes" || tobaccoRaw === "true" || tobaccoRaw === "1"
        ? "yes"
        : tobaccoRaw === "no" || tobaccoRaw === "false" || tobaccoRaw === "0"
          ? "no"
          : "";

    setUnderwritingData({
      tobaccoLast12Months,
      healthConditions: parseTagList(getVerificationFieldValue("health_conditions")),
      medications: parseTagList(getVerificationFieldValue("medications")),
      height: getVerificationFieldValue("height"),
      weight: getVerificationFieldValue("weight"),
      carrier: getVerificationFieldValue("carrier"),
      productLevel: getVerificationFieldValue("insurance_application_details"),
      coverageAmount: getVerificationFieldValue("coverage_amount"),
      monthlyPremium: getVerificationFieldValue("monthly_premium"),
    });

    setConditionInput("");
    setMedicationInput("");
  }, [showUnderwritingModal, getVerificationFieldValue]);

  const onInvalidateUwProduct = React.useCallback((list: CarrierProductRow[], carrierNameSnapshot: string) => {
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

  const uwSelectClass =
    "h-12 w-full rounded-md border border-slate-200 bg-white px-3 text-lg outline-none focus:border-purple-500 disabled:opacity-70";

  const saveUnderwritingToVerification = () => {
    if (underwritingData.tobaccoLast12Months) {
      setFieldValueAndVerify("tobacco_use", underwritingData.tobaccoLast12Months === "yes" ? "Yes" : "No");
    }

    if (underwritingData.healthConditions.length > 0) {
      setFieldValueAndVerify("health_conditions", underwritingData.healthConditions.join(", "));
    }

    if (underwritingData.medications.length > 0) {
      setFieldValueAndVerify("medications", underwritingData.medications.join(", "));
    }

    if (underwritingData.height.trim()) {
      setFieldValueAndVerify("height", underwritingData.height.trim());
    }

    if (underwritingData.weight.trim()) {
      setFieldValueAndVerify("weight", underwritingData.weight.trim());
    }

    if (underwritingData.carrier.trim()) {
      setFieldValueAndVerify("carrier", underwritingData.carrier.trim());
    }

    if (underwritingData.productLevel.trim()) {
      setFieldValueAndVerify("insurance_application_details", underwritingData.productLevel.trim());
    }

    if (underwritingData.coverageAmount.trim()) {
      setFieldValueAndVerify("coverage_amount", cleanMoney(underwritingData.coverageAmount));
    }

    if (underwritingData.monthlyPremium.trim()) {
      setFieldValueAndVerify("monthly_premium", cleanMoney(underwritingData.monthlyPremium));
    }

    setShowUnderwritingModal(false);
  };

  const displayPhoneForModal = pendingPhoneVerification
    ? verificationInputValues[pendingPhoneVerification] ?? ""
    : "";

  return (
    <div
      className="h-fit lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:flex lg:flex-col rounded-xl border border-slate-200 bg-white shadow-sm"
      style={{ fontFamily: T.font }}
    >
      <div className="space-y-2 border-b border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Verification Panel</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              onClick={() => setShowUnderwritingModal(true)}
            >
              Underwriting
            </button>
            <div className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800">
              {selectedPolicyView?.callCenter ?? "-"}
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          {selectedPolicyView ? `Selected policy: ${selectedPolicyView.policyNumber ?? "—"}` : "Select a policy to view verification."}
        </p>
      </div>

      <div className="space-y-4 overflow-y-auto p-4 lg:min-h-0 lg:flex-1">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="text-slate-500">Client Name</div>
          <div className="text-right font-semibold text-slate-900">{selectedPolicyView?.clientName ?? "—"}</div>

          <div className="text-slate-500">Carrier</div>
          <div className="text-right font-semibold text-slate-900">{selectedPolicyView?.carrier ?? "—"}</div>

          <div className="text-slate-500">Policy Number</div>
          <div className="text-right font-semibold text-slate-900">{selectedPolicyView?.policyNumber ?? "—"}</div>

          <div className="text-slate-500">Agent</div>
          <div className="text-right font-semibold text-slate-900">{selectedPolicyView?.agentName ?? "—"}</div>
        </div>

        <hr className="border-slate-200" />

        {loading ? (
          <div className="text-sm text-slate-500">Loading verification...</div>
        ) : error ? (
          <div className="space-y-3">
            <div className="text-sm text-red-600">{error}</div>
            {error.toLowerCase().includes("no matching lead found") && onCreateMissingLeadVerification ? (
              <button
                type="button"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={() => {
                  void onCreateMissingLeadVerification().catch(() => {
                    return;
                  });
                }}
                disabled={creatingMissingLeadVerification}
              >
                {creatingMissingLeadVerification ? (
                  <span className="inline-flex items-center gap-2">
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                    Creating lead + verification...
                  </span>
                ) : (
                  "Create lead + verification session"
                )}
              </button>
            ) : null}
          </div>
        ) : verificationItems.length === 0 ? (
          <div className="text-sm text-slate-500">No verification fields yet.</div>
        ) : (
          <div className="space-y-3">
            {verificationItems.map((item) => {
              const itemId = typeof item.id === "string" ? item.id : null;
              if (!itemId) return null;
              const fieldName = typeof item.field_name === "string" ? item.field_name : "";
              const checked = !!item.is_verified;
              const value = verificationInputValues[itemId] ?? "";

              return (
                <div key={itemId} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-xs font-medium text-slate-900" title={fieldName}>
                      {titleizeKey(fieldName || "Field")}
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {fieldName === "phone_number" ? (
                        <button
                          type="button"
                          className="inline-flex h-6 items-center gap-1 rounded-md bg-blue-600 px-2 text-[11px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                          onClick={() => void checkDnc(itemId)}
                          disabled={dncCheckingItemId === itemId}
                        >
                          {dncCheckingItemId === itemId ? (
                            <IconLoader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <IconPhone className="h-3 w-3" />
                          )}
                          Check
                        </button>
                      ) : null}
                      {fieldName === "phone_number" && phoneDncStatusByItem[itemId] ? (
                        <span
                          className={
                            phoneDncStatusByItem[itemId] === "tcpa"
                              ? "rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700"
                              : phoneDncStatusByItem[itemId] === "dnc"
                                ? "rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"
                                : "rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700"
                          }
                        >
                          {phoneDncStatusByItem[itemId].toUpperCase()}
                        </span>
                      ) : null}
                      <div className="text-[11px] text-slate-500">{checked ? "Verified" : "Pending"}</div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={checked}
                        onChange={(e) => void onToggleVerification(itemId, e.target.checked)}
                      />
                    </div>
                  </div>

                  <input
                    value={value}
                    onChange={(e) => void onUpdateValue(itemId, e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showUnderwritingModal ? (
        <div
          className="fixed inset-0 z-[3800] flex items-center justify-center bg-black/45 p-4"
          style={{ fontFamily: T.font }}
        >
          <div className="flex max-h-[96vh] w-[98vw] max-w-[1400px] flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-2xl font-bold text-purple-700">Underwriting</h3>
            <p className="mt-2 text-base text-slate-600">Please read the following script to the customer and verify all information.</p>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.35fr]">
              <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h4 className="mb-3 text-xl font-bold text-slate-900">Underwriting Questions</h4>
                <p className="mb-4 text-base font-medium text-slate-800">
                  &quot;I am going to ask you some medical questions and we expect your honesty that is going to save us a lot of time. And, this will help us evaluate which insurance carrier comes back with the maximum benefit at the lowest rates for you.&quot;
                </p>
                <div className="space-y-3 text-sm text-slate-700">
                  <p className="font-bold">Question 1–3</p>
                  <p>
                    Use the Insurance Toolkit on the right to quote and confirm product details. Capture health conditions and medications using the fields below.
                  </p>
                </div>
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-purple-200">
                <div className="flex flex-shrink-0 items-center justify-between bg-purple-600 px-4 py-2 text-lg font-bold text-white">
                  <span>Insurance Toolkit</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-purple-800"
                      onClick={() => setToolkitUrl("https://insurancetoolkits.com/fex/quoter")}
                    >
                      Quote Tool
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-white px-2 py-1 text-xs font-semibold text-white hover:bg-purple-700"
                      onClick={() => setToolkitUrl("https://insurancetoolkits.com/login")}
                    >
                      Login
                    </button>
                  </div>
                </div>
                <div className="min-h-[520px] flex-1 bg-white">
                  <iframe className="h-full min-h-[520px] w-full border-0" src={toolkitUrl} title="Insurance Toolkit" id="healthKitIframe" />
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <label className="text-xl font-bold text-slate-900">Health Conditions:</label>
              <div className="rounded-md border border-slate-200 p-3">
                <div className="mb-2 flex flex-wrap gap-2">
                  {underwritingData.healthConditions.map((tag, idx) => (
                    <span
                      key={`${tag}-${idx}`}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-800"
                    >
                      {tag}
                      <button type="button" className="font-bold text-slate-500 hover:text-slate-800" onClick={() => removeTag("healthConditions", idx)} aria-label={`Remove ${tag}`}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(conditionInput, "healthConditions");
                      setConditionInput("");
                    }
                  }}
                  placeholder="Type and press Enter to add conditions..."
                  className="h-12 w-full rounded-md border border-slate-200 px-3 text-lg outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xl font-bold text-slate-900">Medications:</label>
              <div className="rounded-md border border-slate-200 p-3">
                <div className="mb-2 flex flex-wrap gap-2">
                  {underwritingData.medications.map((tag, idx) => (
                    <span
                      key={`${tag}-${idx}`}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-800"
                    >
                      {tag}
                      <button type="button" className="font-bold text-slate-500 hover:text-slate-800" onClick={() => removeTag("medications", idx)} aria-label={`Remove ${tag}`}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  value={medicationInput}
                  onChange={(e) => setMedicationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(medicationInput, "medications");
                      setMedicationInput("");
                    }
                  }}
                  placeholder="Type and press Enter to add medications..."
                  className="h-12 w-full rounded-md border border-slate-200 px-3 text-lg outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              {(
                [
                  ["Height", "height", "e.g., 5 ft 10 in"],
                  ["Weight", "weight", "e.g., 180 lbs"],
                  ["Carrier", "carrier", "e.g., AMAM"],
                  ["Product Level", "productLevel", "e.g., Preferred"],
                  ["Coverage Amount", "coverageAmount", "e.g., $10,000"],
                  ["Monthly Premium", "monthlyPremium", "e.g., $50.00"],
                ] as const
              ).map(([label, key, placeholder]) => {
                if (key === "carrier") {
                  return (
                    <div key={key} className="space-y-2">
                      <label className="text-xl font-bold text-slate-900">Carrier:</label>
                      <select
                        value={underwritingData.carrier}
                        onChange={(e) => {
                          const v = e.target.value;
                          setUnderwritingData((prev) => ({ ...prev, carrier: v, productLevel: "" }));
                        }}
                        className={uwSelectClass}
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
                    <div key={key} className="space-y-2">
                      <label className="text-xl font-bold text-slate-900">Product Level:</label>
                      <select
                        value={underwritingData.productLevel}
                        onChange={(e) =>
                          setUnderwritingData((prev) => ({ ...prev, productLevel: e.target.value }))
                        }
                        disabled={!underwritingData.carrier.trim() || uwProductsLoading}
                        className={uwSelectClass}
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
                  <div key={key} className="space-y-2">
                    <label className="text-xl font-bold text-slate-900">{label}:</label>
                    <input
                      value={underwritingData[key]}
                      onChange={(e) => setUnderwritingData((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="h-12 w-full rounded-md border border-slate-200 px-3 text-lg outline-none focus:border-purple-500"
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="mb-2 text-xl font-bold text-slate-900">Tobacco Usage:</p>
              <p className="text-lg text-slate-800">Have you consumed any tobacco or nicotine products in the last 12 months?</p>
              <div className="mt-2 flex gap-4 text-xl">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="tobacco"
                    checked={underwritingData.tobaccoLast12Months === "yes"}
                    onChange={() => setUnderwritingData({ ...underwritingData, tobaccoLast12Months: "yes" })}
                  />
                  Yes
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="tobacco"
                    checked={underwritingData.tobaccoLast12Months === "no"}
                    onChange={() => setUnderwritingData({ ...underwritingData, tobaccoLast12Months: "no" })}
                  />
                  No
                </label>
              </div>
            </div>

            <p className="mt-4 text-center text-sm text-slate-600">
              Clicking &quot;Save &amp; Verify All&quot; will save all fields below to the verification panel and mark them as verified.
            </p>
            <div className="mt-4 flex w-full gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-6 py-3 text-lg font-semibold text-slate-800 hover:bg-slate-50"
                onClick={() => setShowUnderwritingModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-green-600 px-6 py-3 text-lg font-semibold text-white hover:bg-green-700"
                onClick={saveUnderwritingToVerification}
              >
                Save & Verify All
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDncModal ? (
        <div className="fixed inset-0 z-[3900] flex items-center justify-center bg-black/40 p-4" style={{ fontFamily: T.font }}>
          <div
            className={`w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl ${
              phoneDncStatus === "tcpa" ? "border-2 border-red-500" : "border border-slate-200"
            }`}
          >
            <h3
              className={
                phoneDncStatus === "tcpa"
                  ? "text-2xl font-bold text-red-600"
                  : phoneDncStatus === "dnc"
                    ? "text-2xl font-bold text-orange-600"
                    : "text-2xl font-bold text-blue-600"
              }
            >
              {phoneDncStatus === "tcpa" ? "TCPA LITIGATOR WARNING" : phoneDncStatus === "dnc" ? "Do Not Call List" : "Phone Verification"}
            </h3>
            <p className="mt-2 text-base text-slate-600">
              {phoneDncStatus === "tcpa"
                ? "This number is flagged as a TCPA Litigator. Proceeding may result in legal issues."
                : "Please read the following script to the customer to obtain verbal consent."}
            </p>

            {phoneDncStatus === "tcpa" ? (
              <div className="py-4">
                <p className="text-center text-2xl font-bold text-red-600">WARNING: This number is a TCPA LITIGATOR</p>
                <p className="mt-3 text-center text-lg text-slate-600">Do not proceed with this contact. This number has been flagged as TCPA litigator.</p>
              </div>
            ) : (
              <div className="py-4">
                {phoneDncStatus === "dnc" ? (
                  <p className="mb-3 text-lg font-bold text-orange-600">This number is on the Do Not Call list.</p>
                ) : null}
                <div className="space-y-3 rounded-lg border-2 border-slate-200 bg-slate-50 p-6">
                  <p className="text-lg font-medium text-slate-900">
                    Is your phone number <span className="font-bold text-blue-600">{displayPhoneForModal}</span> on the Federal, National or State Do Not Call List?
                  </p>
                  <p className="text-sm text-slate-500">If a customer says no and we see it is on DNC, we still need verbal consent.</p>
                  <p className="text-lg font-medium text-slate-900">
                    Sir/Ma&apos;am, even if your phone number is on the Federal National or State Do Not Call list, do we still have your permission to call you and submit your application for insurance to{" "}
                    <span className="font-bold text-blue-600">
                      {getVerificationFieldValue("carrier") || selectedPolicyView?.carrier || "selected carrier"}
                    </span>{" "}
                    via your phone number <span className="font-bold text-blue-600">{displayPhoneForModal}</span>? And do we have your permission to call you on the same phone number in the future if needed?
                  </p>
                  <p className="text-base font-semibold text-slate-600">Make sure you get a clear YES on it.</p>
                </div>
                {dncMessage ? <p className="mt-3 text-sm text-slate-500">{dncMessage}</p> : null}
              </div>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-lg font-semibold text-slate-800 hover:bg-slate-50"
                onClick={handleDncModalCancel}
              >
                Cancel
              </button>
              {phoneDncStatus !== "tcpa" ? (
                <button
                  type="button"
                  className="rounded-lg bg-green-600 px-6 py-3 text-lg font-semibold text-white hover:bg-green-700"
                  onClick={handleDncModalConfirm}
                >
                  I Got Verbal Consent - Proceed
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
