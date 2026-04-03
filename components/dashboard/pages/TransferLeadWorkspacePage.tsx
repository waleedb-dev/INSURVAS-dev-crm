"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import TransferLeadClaimModal from "./TransferLeadClaimModal";
import TransferLeadVerificationPanel from "./TransferLeadVerificationPanel";
import TransferLeadCallFixForm from "./TransferLeadCallFixForm";
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

  const progressLabel =
    verificationProgress.progress >= 100
      ? "Completed"
      : verificationProgress.progress > 0
        ? "Just Started"
        : "Not Started";

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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = T.pageBg;
            e.currentTarget.style.color = T.textDark;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = T.textMuted;
          }}
          title="Go back"
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
          
          {/* Lead metadata row */}
          <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>ID:</span>
              <span style={{ fontSize: 13, color: T.textMid, fontWeight: 700, fontFamily: "monospace" }}>
                {lead.leadUniqueId}
              </span>
            </div>
            
            {lead.phone && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>Phone:</span>
                <a
                  href={`tel:${lead.phone.replace(/\D/g, "")}`}
                  style={{
                    fontSize: 15,
                    color: T.blue,
                    fontWeight: 700,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 6,
                    backgroundColor: T.blueLight,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = T.blueFaint;
                    e.currentTarget.style.color = T.blueHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = T.blueLight;
                    e.currentTarget.style.color = T.blue;
                  }}
                  title="Click to call"
                >
                  📞 {lead.phone}
                </a>
              </div>
            )}
            
            {lead.source && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>Source:</span>
                <span style={{ fontSize: 13, color: T.textMid, fontWeight: 700 }}>{lead.source}</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Indicator - Right side */}
        {sessionId && (
          <div
            style={{
              backgroundColor: verificationProgress.progress >= 100 ? "#f0fdf4" : T.pageBg,
              borderRadius: 12,
              padding: "14px 18px",
              minWidth: 220,
              border: `1px solid ${verificationProgress.progress >= 100 ? "#86efac" : T.border}`,
            }}
          >
            {/* Label row with dynamic color */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Verification
              </span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: progressColor,
                }}
              >
                {verificationProgress.progress}%
              </span>
            </div>

            {/* Color-coded progress bar */}
            <div
              style={{
                height: 6,
                borderRadius: 999,
                backgroundColor: T.rowBg,
                overflow: "hidden",
                marginBottom: 10,
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
                  borderRadius: 999,
                  backgroundColor: progressColor,
                  transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </div>

            {/* Status text - shows remaining fields or completion */}
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: verificationProgress.progress >= 100 ? "#16a34a" : T.textMuted,
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              {verificationProgress.progress >= 100 ? (
                <>
                  <span style={{ fontSize: 14 }}>✓</span> Complete
                </>
              ) : verificationProgress.progress === 0 ? (
                <span style={{ color: "#dc2626" }}>{remainingFields} fields to verify</span>
              ) : (
                <span>{remainingFields} fields remaining</span>
              )}
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
                    padding: "9px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
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
                    padding: "9px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
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
          <TransferLeadCallFixForm
            leadRowId={lead.rowId}
            submissionId={lead.submissionId || lead.rowId}
            verificationSessionId={sessionId}
            leadName={lead.leadName}
            leadPhone={lead.phone}
            leadVendor={lead.source}
          />
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
      />
    </div>
  );
}
