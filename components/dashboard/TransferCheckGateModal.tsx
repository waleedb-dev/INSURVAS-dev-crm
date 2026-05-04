"use client";

import { T } from "@/lib/theme";
import {
  formatTransferCheckValue,
  transferCheckDataEntriesForModal,
  type TransferScreeningSnapshot,
} from "@/lib/transferScreening";

type Props = {
  open: boolean;
  loading: boolean;
  clientName?: string | null;
  snapshot: TransferScreeningSnapshot;
  onDismiss: () => void;
};

export default function TransferCheckGateModal({ open, loading, clientName, snapshot, onDismiss }: Props) {
  if (!open) return null;

  const {
    noPhoneSkip,
    transferCheckData,
    transferCheckMessage,
    transferCheckError,
    tcpaBlocked,
    agencyDqBlocked,
    dncListBlocked,
    phoneInvalidBlocked,
  } = snapshot;

  const transferCheckModalCritical = tcpaBlocked || agencyDqBlocked || phoneInvalidBlocked;
  const transferCheckModalDncAdvisory = dncListBlocked && !loading;
  const transferCheckModalError = !!transferCheckError && !loading;
  const transferCheckModalClear =
    !loading &&
    !noPhoneSkip &&
    !transferCheckModalCritical &&
    !dncListBlocked &&
    !transferCheckModalError;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.35)",
        zIndex: 6000,
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
          border: transferCheckModalCritical
            ? `2px solid ${T.danger}`
            : transferCheckModalDncAdvisory
              ? "2px solid #f59e0b"
              : `1.5px solid ${T.border}`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: `1px solid ${T.borderLight}`,
            backgroundColor: transferCheckModalCritical
              ? "#fef2f2"
              : transferCheckModalDncAdvisory
                ? "#fffbeb"
                : "#fff",
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
              backgroundColor: transferCheckModalCritical
                ? "#dc2626"
                : transferCheckModalError
                  ? "#b45309"
                  : transferCheckModalDncAdvisory
                    ? "#d97706"
                    : noPhoneSkip
                      ? "#64748b"
                      : "#233217",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {transferCheckModalCritical || transferCheckModalError || transferCheckModalDncAdvisory || noPhoneSkip ? (
                <>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </>
              ) : (
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.86.33 1.7.62 2.5a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.58-1.14a2 2 0 0 1 2.11-.45c.8.29 1.64.5 2.5.62A2 2 0 0 1 22 16.92z" />
              )}
            </svg>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
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
              {noPhoneSkip
                ? "TRANSFER CHECK"
                : transferCheckModalCritical
                  ? "CRITICAL ALERT"
                  : transferCheckModalDncAdvisory
                    ? "DNC NOTICE"
                    : transferCheckModalError
                      ? "CHECK FAILED"
                      : loading
                        ? "TRANSFER CHECK"
                        : "TRANSFER CHECK"}
            </p>
            <h4
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: transferCheckModalCritical
                  ? "#dc2626"
                  : transferCheckModalDncAdvisory
                    ? "#b45309"
                    : transferCheckModalError
                      ? "#b45309"
                      : noPhoneSkip
                        ? T.textDark
                        : "#233217",
              }}
            >
              {loading
                ? "RUNNING SCREENING & TRANSFER CHECK…"
                : noPhoneSkip
                  ? "NO PHONE ON QUEUE ITEM"
                  : tcpaBlocked
                    ? "TCPA LITIGATOR DETECTED"
                    : phoneInvalidBlocked
                      ? "INVALID PHONE"
                      : dncListBlocked
                        ? "DNC LIST MATCH"
                        : agencyDqBlocked
                          ? "CUSTOMER NOT ELIGIBLE (DQ)"
                          : transferCheckModalError
                            ? "TRANSFER CHECK FAILED"
                            : "CHECK PASSED"}
            </h4>
            {clientName ? (
              <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 600, color: T.textMuted }}>{clientName}</p>
            ) : null}
          </div>
        </div>

        <div style={{ padding: "24px", textAlign: "center" }}>
          {loading && (
            <p style={{ fontSize: 15, color: T.textMid, margin: 0, lineHeight: 1.55 }}>
              Please wait while we verify this phone number against screening and transfer rules.
            </p>
          )}

          {noPhoneSkip && !loading && (
            <div style={{ padding: "8px 0", textAlign: "left" }}>
              <p style={{ fontSize: 15, color: T.textMid, margin: 0, lineHeight: 1.55 }}>
                Assignment was saved. This queue row has no phone number, so the transfer check was skipped. Add a phone on
                the transfer lead if you need screening.
              </p>
            </div>
          )}

          {tcpaBlocked && !loading && (
            <div style={{ padding: "16px 0" }}>
              <p style={{ color: "#dc2626", fontWeight: 800, fontSize: 22, margin: "0 0 12px" }}>
                This number is flagged as a TCPA litigator
              </p>
              <p style={{ fontSize: 14, color: T.textMid, margin: 0, lineHeight: 1.6 }}>
                Proceeding with this lead may result in legal issues. Transfers and contact attempts are prohibited.
              </p>
              {transferCheckMessage ? (
                <p style={{ marginTop: 14, fontSize: 13, color: T.textMuted, fontWeight: 600, lineHeight: 1.45 }}>
                  {transferCheckMessage}
                </p>
              ) : null}
            </div>
          )}

          {phoneInvalidBlocked && !loading && (
            <div style={{ padding: "16px 0" }}>
              <p style={{ color: "#dc2626", fontWeight: 800, fontSize: 22, margin: "0 0 12px" }}>Invalid phone number</p>
              <p style={{ fontSize: 14, color: T.textMid, margin: 0, lineHeight: 1.6 }}>{transferCheckMessage}</p>
            </div>
          )}

          {dncListBlocked && !loading && (
            <div style={{ padding: "16px 0" }}>
              <p style={{ color: "#b45309", fontWeight: 800, fontSize: 22, margin: "0 0 12px" }}>
                This number is on a do-not-call list
              </p>
              <p style={{ fontSize: 14, color: T.textMid, margin: 0, lineHeight: 1.6 }}>
                Screening flagged DNC. Follow your centre&apos;s compliance rules. TCPA litigator hits still block contact.
              </p>
              {transferCheckMessage ? (
                <p style={{ marginTop: 14, fontSize: 13, color: T.textMuted, fontWeight: 600, lineHeight: 1.45 }}>
                  {transferCheckMessage}
                </p>
              ) : null}
            </div>
          )}

          {agencyDqBlocked && !loading && (
            <div style={{ padding: "16px 0" }}>
              <p style={{ color: "#dc2626", fontWeight: 800, fontSize: 22, margin: "0 0 12px" }}>
                Customer has already been DQ from our agency
              </p>
              <p style={{ fontSize: 14, color: T.textMid, margin: 0, lineHeight: 1.6 }}>
                This submission cannot proceed for this phone number.
              </p>
              {transferCheckData?.data && transferCheckDataEntriesForModal(transferCheckData.data).length > 0 ? (
                <div
                  style={{
                    marginTop: 16,
                    padding: 14,
                    backgroundColor: "#f8fafc",
                    borderRadius: 12,
                    border: `1px solid ${T.borderLight}`,
                    textAlign: "left",
                  }}
                >
                  <p style={{ fontWeight: 800, fontSize: 12, color: T.textMuted, margin: "0 0 8px" }}>API details</p>
                  {transferCheckDataEntriesForModal(transferCheckData.data).map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(100px, 38%) 1fr",
                        gap: 8,
                        fontSize: 13,
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ color: T.textMuted, fontWeight: 700 }}>{k}</span>
                      <span style={{ color: T.textDark, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {formatTransferCheckValue(v)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {transferCheckModalClear && !dncListBlocked && (
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 15, color: T.textMid, margin: "0 0 16px", lineHeight: 1.55 }}>{transferCheckMessage}</p>
              {transferCheckData?.data && transferCheckDataEntriesForModal(transferCheckData.data).length > 0 ? (
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    padding: 16,
                    borderRadius: 12,
                    border: `1px solid ${T.borderLight}`,
                    marginBottom: 12,
                  }}
                >
                  <p style={{ fontWeight: 800, fontSize: 13, color: T.textDark, margin: "0 0 12px" }}>
                    Policy / transfer details
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {transferCheckDataEntriesForModal(transferCheckData.data).map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(120px, 40%) 1fr",
                          gap: 8,
                          fontSize: 13,
                        }}
                      >
                        <span style={{ color: T.textMuted, fontWeight: 700 }}>{k}</span>
                        <span style={{ color: T.textDark, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {formatTransferCheckValue(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {transferCheckModalError && (
            <div style={{ padding: "16px 0", textAlign: "left" }}>
              <p style={{ fontSize: 14, color: T.textMid, margin: 0 }}>{transferCheckError}</p>
            </div>
          )}
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
          {!loading && (
            <>
              <button
                type="button"
                onClick={onDismiss}
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
              >
                {transferCheckModalCritical || transferCheckModalError ? "Close" : "Dismiss"}
              </button>
              {transferCheckModalClear && (
                <button
                  type="button"
                  onClick={onDismiss}
                  style={{
                    height: 42,
                    padding: "0 24px",
                    borderRadius: 10,
                    border: "none",
                    backgroundColor: "#233217",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(35, 50, 23, 0.2)",
                    transition: "all 0.15s ease-in-out",
                  }}
                >
                  Continue
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
