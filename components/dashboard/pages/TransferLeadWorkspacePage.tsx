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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          backgroundColor: "#fff",
          border: `1.5px solid ${T.border}`,
          borderRadius: 16,
          padding: "14px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              border: `1.5px solid ${T.border}`,
              backgroundColor: "#fff",
              color: T.textDark,
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 700,
              cursor: "pointer",
              marginBottom: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span aria-hidden="true">←</span>
            <span>Back</span>
          </button>
          <h2 style={{ margin: 0, fontSize: 22, color: T.textDark }}>{lead.leadName}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: T.textMuted }}>
            Lead ID: {lead.leadUniqueId} {lead.phone ? `| ${lead.phone}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {sessionId && (
            <div
              style={{
                border: `1.5px solid ${T.border}`,
                backgroundColor: "#fee2e2",
                color: "#991b1b",
                borderRadius: 8,
                padding: "8px 12px",
                fontWeight: 700,
                minWidth: 160,
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.9 }}>Progress</div>
              <div style={{ fontSize: 14, lineHeight: 1.2 }}>
                {verificationProgress.progress}% - {progressLabel}
              </div>
              <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>
                {verificationProgress.verifiedCount}/{verificationProgress.totalCount} verified
              </div>
            </div>
          )}
          {!sessionId && (
            <>
              {canViewTransferClaimReclaimVisit ? (
                <>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/${role}/retention-flow?leadRowId=${lead.rowId}`)}
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
                </>
              ) : (
                <div style={{ border: `1.5px solid ${T.border}`, backgroundColor: T.pageBg, borderRadius: 8, padding: "8px 12px", color: T.textMuted, fontWeight: 700, fontSize: 12 }}>
                  You do not have permission to claim/reclaim this lead.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{ border: "1px solid #fecaca", borderRadius: 8, backgroundColor: "#fef2f2", color: "#991b1b", padding: "8px 10px", fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {sessionId ? (
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
            leadName={lead.leadName}
            leadPhone={lead.phone}
            leadVendor={lead.source}
          />
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
        leadName={lead.leadName}
        agents={agents}
        selection={selection}
        onChange={setSelection}
        onClose={() => setOpenClaim(false)}
        onSubmit={() => {
          void startClaim();
        }}
      />
    </div>
  );
}
