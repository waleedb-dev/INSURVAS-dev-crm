"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import TransferLeadClaimModal from "./TransferLeadClaimModal";
import TransferLeadVerificationPanel from "./TransferLeadVerificationPanel";
import TransferLeadCallFixForm from "./TransferLeadCallFixForm";
import TransferLeadSsnPolicyCards from "./TransferLeadSsnPolicyCards";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import {
  applyClaimSelectionToSession,
  fetchClaimAgents,
  fetchLatestSessionForSubmission,
  findOrCreateVerificationSession,
  saveFullRetentionWorkflow,
  type ClaimLeadContext,
  type ClaimSelections,
} from "./transferLeadParity";
import { runDncLookup } from "@/lib/dncLookupApi";
import { runTransferCheck, TRANSFER_CHECK_CLEAR_USER_MESSAGE } from "@/lib/transferCheckApi";

type TransferCheckApiResponse = {
  data?: Record<string, unknown>;
  warnings?: { policy?: boolean };
  warningMessage?: string;
  message?: string;
  phone?: string;
  status?: string;
  crm_phone_match?: {
    has_match?: boolean;
    is_addable?: boolean;
    rule_message?: string;
    matched_contact_name?: string;
    stages?: string[];
    lead_ids?: string[];
    scenario?: string;
  };
};

function formatTransferCheckValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

/** Omit `dnc` from API `data` in the modal — DNC is used only for TCPA logic, not shown to agents. */
function transferCheckDataEntriesForModal(data: Record<string, unknown> | undefined): [string, unknown][] {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data).filter(([k]) => k.toLowerCase() !== "dnc");
}

function normalizePhoneDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function getUsPhone10Digits(value: string): string | null {
  const digits = normalizePhoneDigits(value);
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return null;
}

const defaultSelection: ClaimSelections = {
  workflowType: "buffer",
  bufferAgentId: null,
  licensedAgentId: null,
  retentionAgentId: null,
  isRetentionCall: false,
  retentionType: "",
  retentionNotes: "",
  quoteCarrier: "",
  quoteProduct: "",
  quoteCoverage: "",
  quoteMonthlyPremium: "",
};

type Props = {
  leadRowId: string;
};

export default function TransferLeadWorkspacePage({ leadRowId }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const params = useParams<{ role?: string }>();
  const role = Array.isArray(params?.role) ? params.role[0] : params?.role || "agent";
  const { permissionKeys } = useDashboardContext();
  const canViewTransferClaimReclaimVisit = permissionKeys.has("action.transfer_leads.claim_reclaim_visit");

  const [lead, setLead] = useState<ClaimLeadContext | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openClaim, setOpenClaim] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [selection, setSelection] = useState<ClaimSelections>(defaultSelection);
  const [verificationProgress, setVerificationProgress] = useState({
    verifiedCount: 0,
    totalCount: 0,
    progress: 0,
  });
  const [agents, setAgents] = useState<{
    bufferAgents: { id: string; name: string; roleKey: string }[];
    licensedAgents: { id: string; name: string; roleKey: string }[];
    retentionAgents: { id: string; name: string; roleKey: string }[];
  }>({ bufferAgents: [], licensedAgents: [], retentionAgents: [] });
  const [isRetentionOnlyMode, setIsRetentionOnlyMode] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [tcpaChecking, setTcpaChecking] = useState(true);
  const [tcpaCheckCompleted, setTcpaCheckCompleted] = useState(false);
  const [tcpaBlocked, setTcpaBlocked] = useState(false);
  const [tcpaBlockReason, setTcpaBlockReason] = useState("");
  const [agencyDqBlocked, setAgencyDqBlocked] = useState(false);
  const [dncListBlocked, setDncListBlocked] = useState(false);
  const [phoneInvalidBlocked, setPhoneInvalidBlocked] = useState(false);
  const [transferCheckMessage, setTransferCheckMessage] = useState("");
  const [transferCheckData, setTransferCheckData] = useState<TransferCheckApiResponse | null>(null);
  const [transferCheckError, setTransferCheckError] = useState<string | null>(null);
  const [transferCheckModalDismissed, setTransferCheckModalDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) setSessionUserId(session?.user?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: leadError } = await supabase
          .from("leads")
          .select("id, lead_unique_id, first_name, last_name, phone, lead_source, submission_id")
          .eq("id", leadRowId)
          .maybeSingle();
        if (leadError || !data) throw new Error(leadError?.message || "Lead not found.");
        const leadName = `${String(data.first_name || "").trim()} ${String(data.last_name || "").trim()}`.trim();
        const context: ClaimLeadContext = {
          rowId: String(data.id),
          leadUniqueId: String(data.lead_unique_id || "N/A"),
          leadName: leadName || "Unnamed Lead",
          phone: String(data.phone || ""),
          source: String(data.lead_source || ""),
          submissionId: data.submission_id ? String(data.submission_id) : null,
        };
        const loadedAgents = await fetchClaimAgents(supabase);
        // Some environments still have rows where leads.submission_id is empty.
        // Fallback to lead row id so already-claimed sessions still resolve.
        const lookupSubmissionId = context.submissionId || context.rowId;
        let existingSessionId: string | null = null;
        if (lookupSubmissionId) {
          const existing = await fetchLatestSessionForSubmission(supabase, lookupSubmissionId);
          existingSessionId = existing?.id || null;
        }

        if (!cancelled) {
          setLead(context);
          setAgents(loadedAgents);
          setSessionId(existingSessionId);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to open Transfer Lead workspace.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [leadRowId, supabase]);

  useEffect(() => {
    setTransferCheckModalDismissed(false);
    setTransferCheckData(null);
    setTransferCheckError(null);
    setAgencyDqBlocked(false);
    setDncListBlocked(false);
    setPhoneInvalidBlocked(false);
    setTcpaBlocked(false);
    setTcpaBlockReason("");
    setTransferCheckMessage("");
  }, [leadRowId]);

  useEffect(() => {
    let cancelled = false;
    const runTcpaGate = async () => {
      if (!lead) {
        setTcpaChecking(false);
        setTcpaCheckCompleted(false);
        setTcpaBlocked(false);
        setTcpaBlockReason("");
        setAgencyDqBlocked(false);
        setDncListBlocked(false);
        setPhoneInvalidBlocked(false);
        setTransferCheckMessage("");
        setTransferCheckData(null);
        setTransferCheckError(null);
        return;
      }

      const cleanPhone = getUsPhone10Digits(lead.phone || "");
      if (!cleanPhone) {
        setTcpaChecking(false);
        setTcpaCheckCompleted(true);
        setTcpaBlocked(false);
        setTcpaBlockReason("");
        setAgencyDqBlocked(false);
        setDncListBlocked(false);
        setPhoneInvalidBlocked(false);
        setTransferCheckMessage("");
        setTransferCheckData(null);
        setTransferCheckError(null);
        return;
      }

      setTcpaChecking(true);
      setTcpaCheckCompleted(false);
      setTcpaBlocked(false);
      setTcpaBlockReason("");
      setAgencyDqBlocked(false);
      setDncListBlocked(false);
      setPhoneInvalidBlocked(false);
      setTransferCheckMessage("");
      setTransferCheckData(null);
      setTransferCheckError(null);

      try {
        const [transferRes, dncRes] = await Promise.all([
          runTransferCheck(supabase, cleanPhone),
          runDncLookup(supabase, cleanPhone),
        ]);
        if (cancelled) return;

        if (!dncRes.ok) {
          const msg =
            String(dncRes.data.message ?? dncRes.data.error ?? "").trim() ||
            `Screening request failed (${dncRes.status}).`;
          setTransferCheckError(msg);
          return;
        }

        const dncData = dncRes.data;
        const dncCallStatus = String(dncData.callStatus ?? "");
        if (dncCallStatus === "ERROR") {
          setTransferCheckError(
            String(dncData.message ?? "").trim() ||
              "Screening could not be completed. Do not treat this number as safe.",
          );
          return;
        }

        if (!transferRes.ok) {
          const data = transferRes.data as TransferCheckApiResponse;
          const errText =
            String(data.message ?? "").trim() ||
            `Failed to check phone number (${transferRes.status})`;
          setTransferCheckError(errText);
          return;
        }

        const data = transferRes.data as TransferCheckApiResponse;
        setTransferCheckData(data);

        const crmGate = data.crm_phone_match as
          | { has_match?: boolean; is_addable?: boolean; rule_message?: string }
          | undefined;
        const crmBlocksTransfer = crmGate?.has_match === true && crmGate?.is_addable === false;

        const dncFlags = dncData.flags as
          | { isTcpa?: boolean; isDnc?: boolean; isInvalid?: boolean }
          | undefined;

        const isTCPA = dncFlags?.isTcpa === true;
        const isDncList = dncFlags?.isDnc === true && !isTCPA;
        const isInvalidPhone = dncFlags?.isInvalid === true;

        // Message precedence (single winner): TCPA → invalid phone → DNC list → CRM transfer block → clear.
        if (isTCPA) {
          setTcpaBlocked(true);
          setTcpaBlockReason("TCPA Litigator Detected - No Contact Permitted");
          setTransferCheckMessage(
            String(dncData.message ?? "").trim() ||
              "This number is flagged as a TCPA litigator. All transfers and contact attempts are strictly prohibited.",
          );
          return;
        }

        if (isInvalidPhone) {
          setPhoneInvalidBlocked(true);
          setTransferCheckMessage(
            String(dncData.message ?? "").trim() || "This phone number appears to be invalid.",
          );
          return;
        }

        if (isDncList) {
          setDncListBlocked(true);
          setTransferCheckMessage(
            String(dncData.message ?? "").trim() || "Do not call: this number is on a DNC list.",
          );
          return;
        }

        if (crmBlocksTransfer) {
          setAgencyDqBlocked(true);
          setTransferCheckMessage(
            String(crmGate?.rule_message ?? "").trim() ||
              "This transfer is not permitted based on CRM stage rules.",
          );
          return;
        }

        const rootMessage = String(data.message ?? "").trim();
        if (rootMessage) {
          setTransferCheckMessage(rootMessage);
        } else {
          setTransferCheckMessage(TRANSFER_CHECK_CLEAR_USER_MESSAGE);
        }
      } catch (error) {
        if (cancelled) return;
        let message = "Failed to connect to transfer check service.";
        if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
          message = "Cannot connect to transfer check service. Please try again later.";
        }
        setTransferCheckError(message);
      } finally {
        if (!cancelled) {
          setTcpaChecking(false);
          setTcpaCheckCompleted(true);
        }
      }
    };
    void runTcpaGate();
    return () => {
      cancelled = true;
    };
  }, [lead]);

  const startClaim = async () => {
    if (!canViewTransferClaimReclaimVisit) {
      setError("Missing permission to claim this lead.");
      return;
    }
    if (!lead) return;
    setClaimLoading(true);
    setError(null);
    try {
      // For retention-only mode, use the full retention workflow
      if (isRetentionOnlyMode) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id || null;
        await saveFullRetentionWorkflow(supabase, lead, selection, userId);
        setOpenClaim(false);
        setError(null);
        return;
      }

      // Standard claim workflow
      const found = await findOrCreateVerificationSession(supabase, lead, selection);
      await applyClaimSelectionToSession(supabase, found.sessionId, found.submissionId, selection);
      setSessionId(found.sessionId);
      setOpenClaim(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim lead.");
    } finally {
      setClaimLoading(false);
    }
  };

  const openClaimAndInitialize = async () => {
    if (!canViewTransferClaimReclaimVisit) {
      setError("Missing permission to claim this lead.");
      return;
    }
    if (!lead) return;
    setSelection(defaultSelection);
    setIsRetentionOnlyMode(false);
    setOpenClaim(true);
    setClaimLoading(true);
    setError(null);
    try {
      // Initialize verification session as soon as Start verification is clicked.
      const found = await findOrCreateVerificationSession(supabase, lead, defaultSelection);
      setSessionId(found.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize verification session.");
    } finally {
      setClaimLoading(false);
    }
  };

  const openRetentionModal = async () => {
    if (!canViewTransferClaimReclaimVisit) {
      setError("Missing permission to process retention.");
      return;
    }
    if (!lead) return;
    const retentionSelection: ClaimSelections = {
      ...defaultSelection,
      workflowType: "retention",
      isRetentionCall: true,
      retentionType: "new_sale",
    };
    setSelection(retentionSelection);
    setIsRetentionOnlyMode(true);
    setOpenClaim(true);
    setClaimLoading(true);
    setError(null);
    try {
      // Initialize verification session for retention
      const found = await findOrCreateVerificationSession(supabase, lead, retentionSelection);
      setSessionId(found.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize retention session.");
    } finally {
      setClaimLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ margin: 0, color: T.textMid, fontWeight: 700 }}>Loading Transfer Lead workspace...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div style={{ padding: 24, borderRadius: 14, border: `1.5px solid ${T.border}`, backgroundColor: "#fff" }}>
        <p style={{ margin: 0, color: "#991b1b", fontWeight: 700 }}>{error || "Lead not found."}</p>
      </div>
    );
  }

  const needsTransferCheckModal = Boolean(getUsPhone10Digits(lead.phone || ""));
  const showTransferCheckModal =
    needsTransferCheckModal &&
    (tcpaChecking ||
      !tcpaCheckCompleted ||
      tcpaBlocked ||
      agencyDqBlocked ||
      (dncListBlocked && !transferCheckModalDismissed) ||
      phoneInvalidBlocked ||
      !!transferCheckError ||
      (tcpaCheckCompleted &&
        !tcpaBlocked &&
        !agencyDqBlocked &&
        !phoneInvalidBlocked &&
        !transferCheckError &&
        !transferCheckModalDismissed));

  /** TCPA, CRM DQ, invalid phone: hard stop. DNC is advisory — workspace can continue after acknowledge. */
  const transferCheckModalCritical = tcpaBlocked || agencyDqBlocked || phoneInvalidBlocked;
  const transferCheckModalLoading = needsTransferCheckModal && (tcpaChecking || !tcpaCheckCompleted);
  const transferCheckModalDncAdvisory = dncListBlocked && !transferCheckModalLoading;
  const transferCheckModalError = !!transferCheckError && !transferCheckModalLoading;
  const transferCheckModalClear =
    tcpaCheckCompleted &&
    !tcpaBlocked &&
    !agencyDqBlocked &&
    !phoneInvalidBlocked &&
    !transferCheckError &&
    !transferCheckModalLoading;

  // Determine progress color based on percentage
  const getProgressColor = (p: number) => {
    if (p >= 100) return "#16a34a"; // Green
    if (p >= 31) return "#638b4b"; // Blue/green (in progress)
    if (p > 0) return "#f97316"; // Orange (just started)
    return "#dc2626"; // Red (not started)
  };

  const progressColor = getProgressColor(verificationProgress.progress);
  const remainingFields = verificationProgress.totalCount - verificationProgress.verifiedCount;

  return (
    <>
      <div
        aria-hidden={showTransferCheckModal}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          ...(showTransferCheckModal
            ? { pointerEvents: "none" as const, userSelect: "none" as const, filter: "blur(2px)", opacity: 0.92 }
            : {}),
        }}
      >
      {/* Compact Header Bar */}
      <div
        style={{
          backgroundColor: "#fff",
          border: `1.5px solid ${T.border}`,
          borderRadius: 16,
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          position: "relative",
        }}
      >
        {/* Back Button - Minimal, top-left */}
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            border: "none",
            backgroundColor: "transparent",
            color: T.textMuted,
            padding: 8,
            fontSize: 20,
            cursor: "pointer",
            lineHeight: 1,
            transition: "all 0.2s",
            borderRadius: 8,
            outline: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = T.pageBg;
            e.currentTarget.style.color = T.textDark;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = T.textMuted;
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = "0 0 0 2px rgba(35, 50, 23, 0.2)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          ←
        </button>

        {/* Lead Info - Centered, better hierarchy */}
        <div style={{ flex: 1, paddingLeft: 40, paddingRight: 20 }}>
          <h1 
            style={{ 
              margin: 0, 
              fontSize: 26, 
              color: T.textDark, 
              fontWeight: 800,
              letterSpacing: "-0.3px",
            }}
          >
            {lead.leadName}
          </h1>
        </div>

        {/* Progress Indicator - Right side */}
        {sessionId && (
          <div
            style={{
              backgroundColor: verificationProgress.progress >= 100 ? "#f0fdf4" : T.pageBg,
              borderRadius: 12,
              padding: "12px 16px",
              minWidth: 200,
              maxWidth: 240,
              border: `1px solid ${verificationProgress.progress >= 100 ? "#86efac" : T.border}`,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                }}
              >
                Progress
              </span>
              <span
                style={{
                  fontSize: 20,
                  lineHeight: 1,
                  fontWeight: 700,
                  color: progressColor,
                }}
              >
                {verificationProgress.progress}%
              </span>
            </div>

            <div
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: "#e7ebef",
                overflow: "hidden",
              }}
            >
              <div
                role="progressbar"
                aria-valuenow={verificationProgress.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{
                  width: `${verificationProgress.progress}%`,
                  height: "100%",
                  borderRadius: 3,
                  backgroundColor: progressColor,
                  transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>
                {verificationProgress.verifiedCount}/{verificationProgress.totalCount} fields
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  padding: "4px 8px",
                  backgroundColor:
                    verificationProgress.progress >= 100
                      ? "#dcfce7"
                      : verificationProgress.progress > 0
                        ? "#ffedd5"
                        : "#fee2e2",
                  color:
                    verificationProgress.progress >= 100
                      ? "#166534"
                      : verificationProgress.progress > 0
                        ? "#9a3412"
                        : "#b91c1c",
                }}
              >
                {verificationProgress.progress >= 100
                  ? "Complete"
                  : verificationProgress.progress > 0
                    ? "In Progress"
                    : "Not Started"}
              </span>
            </div>
          </div>
        )}
        
        {/* No session - Show claim buttons */}
        {!sessionId && (
          <>
            {canViewTransferClaimReclaimVisit ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => void openRetentionModal()}
                  style={{
                    border: `1.5px solid ${T.border}`,
                    backgroundColor: "#ede9fe",
                    color: "#5b21b6",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease-in-out",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 0 2px rgba(35, 50, 23, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  Claim Retention
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void openClaimAndInitialize();
                  }}
                  style={{
                    border: "none",
                    backgroundColor: T.blue,
                    color: "#fff",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease-in-out",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 0 2px rgba(99, 139, 75, 0.4)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  Start verification
                </button>
              </div>
            ) : (
              <div style={{ border: `1.5px solid ${T.border}`, backgroundColor: T.pageBg, borderRadius: 8, padding: "8px 12px", color: T.textMuted, fontWeight: 700, fontSize: 12 }}>
                You do not have permission to claim/reclaim this lead.
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div style={{ border: "1px solid #fecaca", borderRadius: 8, backgroundColor: "#fef2f2", color: "#991b1b", padding: "8px 10px", fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {sessionId && canViewTransferClaimReclaimVisit && lead ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
          <TransferLeadVerificationPanel
            sessionId={sessionId}
            showProgressSummary={false}
            onProgressChange={setVerificationProgress}
            onTransferToLicensedAgent={() => {
              if (!canViewTransferClaimReclaimVisit) {
                setError("Missing permission to transfer this lead.");
                return;
              }
              setSelection({ ...defaultSelection, workflowType: "licensed" });
              setOpenClaim(true);
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <TransferLeadCallFixForm
              leadRowId={lead.rowId}
              submissionId={lead.submissionId || lead.rowId}
              verificationSessionId={sessionId}
              leadName={lead.leadName}
              leadPhone={lead.phone}
              leadVendor={lead.source}
              sessionUserId={sessionUserId}
            />
            <TransferLeadSsnPolicyCards leadRowId={lead.rowId} supabase={supabase} />
          </div>
        </div>
      ) : sessionId && !canViewTransferClaimReclaimVisit ? (
        <div style={{ backgroundColor: "#fef2f2", border: `1.5px solid #fecaca`, borderRadius: 14, padding: 18 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: "#991b1b", fontWeight: 700 }}>Access Restricted</h3>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#7f1d1d" }}>
            You do not have permission to view the verification panel. This lead has an active verification session that can only be accessed by licensed agents or managers.
          </p>
        </div>
      ) : (
        <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: T.textDark }}>No active verification session</h3>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: T.textMid }}>
            Use <strong style={{ fontWeight: 800 }}>Start verification</strong> above to claim and initialize the session, then complete the verification panel and call forms.
          </p>
        </div>
      )}
      </div>

      <TransferLeadClaimModal
        open={openClaim}
        loading={claimLoading}
        leadName={lead?.leadName || ""}
        agents={agents}
        selection={selection}
        onChange={setSelection}
        onClose={() => setOpenClaim(false)}
        onSubmit={() => {
          void startClaim();
        }}
        retentionOnly={isRetentionOnlyMode}
        sessionUserId={sessionUserId}
      />

      {showTransferCheckModal && (
        <div
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
                        : "#233217",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {transferCheckModalCritical || transferCheckModalError || transferCheckModalDncAdvisory ? (
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
                  {transferCheckModalCritical
                    ? "CRITICAL ALERT"
                    : transferCheckModalDncAdvisory
                      ? "DNC NOTICE"
                      : transferCheckModalError
                        ? "CHECK FAILED"
                        : transferCheckModalLoading
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
                          : "#233217",
                  }}
                >
                  {transferCheckModalLoading
                    ? "RUNNING SCREENING & TRANSFER CHECK…"
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
              </div>
            </div>

            <div style={{ padding: "24px", textAlign: "center" }}>
              {transferCheckModalLoading && (
                <p style={{ fontSize: 15, color: T.textMid, margin: 0, lineHeight: 1.55 }}>
                  Please wait while we verify this phone number against screening and transfer rules.
                </p>
              )}

              {tcpaBlocked && !transferCheckModalLoading && (
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

              {phoneInvalidBlocked && !transferCheckModalLoading && (
                <div style={{ padding: "16px 0" }}>
                  <p style={{ color: "#dc2626", fontWeight: 800, fontSize: 22, margin: "0 0 12px" }}>
                    Invalid phone number
                  </p>
                  <p style={{ fontSize: 14, color: T.textMid, margin: 0, lineHeight: 1.6 }}>{transferCheckMessage}</p>
                </div>
              )}

              {dncListBlocked && !transferCheckModalLoading && (
                <div style={{ padding: "16px 0" }}>
                  <p style={{ color: "#b45309", fontWeight: 800, fontSize: 22, margin: "0 0 12px" }}>
                    This number is on a do-not-call list
                  </p>
                  <p style={{ fontSize: 14, color: T.textMid, margin: 0, lineHeight: 1.6 }}>
                    Screening flagged DNC. You can continue in this workspace if you have a valid exemption and follow
                    compliance. TCPA litigator hits still block the session.
                  </p>
                  {transferCheckMessage ? (
                    <p style={{ marginTop: 14, fontSize: 13, color: T.textMuted, fontWeight: 600, lineHeight: 1.45 }}>
                      {transferCheckMessage}
                    </p>
                  ) : null}
                </div>
              )}

              {agencyDqBlocked && !transferCheckModalLoading && (
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

              {transferCheckModalClear &&
                transferCheckModalDismissed === false &&
                !dncListBlocked && (
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
              {!transferCheckModalLoading && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (transferCheckModalCritical) {
                        router.back();
                        return;
                      }
                      if (transferCheckModalError) {
                        setTransferCheckError(null);
                        setTransferCheckModalDismissed(true);
                        return;
                      }
                      setTransferCheckModalDismissed(true);
                    }}
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
                    {transferCheckModalCritical || transferCheckModalError ? "Close" : "Cancel"}
                  </button>
                  {transferCheckModalClear && transferCheckModalDismissed === false && (
                    <button
                      type="button"
                      onClick={() => setTransferCheckModalDismissed(true)}
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
      )}
    </>
  );
}
