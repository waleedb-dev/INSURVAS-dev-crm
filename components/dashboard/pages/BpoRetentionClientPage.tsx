"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useDashboardContext } from "@/components/dashboard/DashboardContext";
import TransferLeadSsnPolicyCards from "./TransferLeadSsnPolicyCards";
import { LeadCard } from "./LeadCard";
import TransferLeadVerificationPanel from "./TransferLeadVerificationPanel";
import {
  findOrCreateVerificationSession,
  type ClaimLeadContext,
  type ClaimSelections,
} from "./transferLeadParity";

type TabId = "policies" | "lead-notes";

type LeadNoteRow = {
  id: string;
  body: string;
  created_at: string;
  created_by: string | null;
  authorName?: string;
};

type LeadSnapshot = {
  rowId: string;
  submissionId: string | null;
  name: string;
  phone: string;
  callCenterId: string | null;
  leadSource: string;
  carrier: string;
  productType: string;
  monthlyPremium: string;
  coverageAmount: string;
  stage: string;
  streetAddress: string;
  beneficiaryInformation: string;
  draftDate: string;
  futureDraftDate: string;
  licensedAgent: string;
  centerName: string;
  claimContext: ClaimLeadContext;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPhoneDisplay(phone: string | null | undefined) {
  const raw = String(phone ?? "").replace(/\D/g, "");
  if (raw.length === 10) {
    return `+1${raw}`;
  }
  return phone || "—";
}

function buildStreetAddress(row: Record<string, unknown>) {
  return [
    String(row.street1 ?? "").trim(),
    String(row.street2 ?? "").trim(),
    String(row.city ?? "").trim(),
    String(row.state ?? "").trim(),
    String(row.zip_code ?? "").trim(),
  ]
    .filter(Boolean)
    .join(", ");
}

function NoteList({
  notes,
  emptyTitle,
}: {
  notes: Array<{ id: string; title: string; subtitle: string; body: string }>;
  emptyTitle: string;
}) {
  if (notes.length === 0) {
    return (
      <div style={{ borderRadius: 12, border: `1px dashed ${T.border}`, padding: 18, textAlign: "center", fontSize: 14, fontWeight: 600, color: T.textMuted }}>
        {emptyTitle}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {notes.map((note) => (
        <div key={note.id} style={{ borderRadius: 14, border: `1px solid ${T.border}`, backgroundColor: "#fff", padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.textDark }}>{note.title}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>{note.subtitle}</div>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: T.textDark, whiteSpace: "pre-wrap" }}>{note.body}</div>
        </div>
      ))}
    </div>
  );
}

export default function BpoRetentionClientPage({ leadRowId }: { leadRowId: string }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const params = useParams<{ role?: string }>();
  const searchParams = useSearchParams();
  const routeRole = Array.isArray(params?.role) ? params.role[0] : params?.role || "agent";
  const sourcePage = searchParams.get("page") || "bpo-kill-list-retention";
  const { currentRole } = useDashboardContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("policies");
  const [lead, setLead] = useState<LeadSnapshot | null>(null);
  const [verificationSessionId, setVerificationSessionId] = useState<string | null>(null);
  const [dealNotes, setDealNotes] = useState<LeadNoteRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: leadError } = await supabase
          .from("leads")
          .select("id, lead_unique_id, submission_id, first_name, last_name, phone, lead_source, carrier, product_type, monthly_premium, coverage_amount, stage, street1, street2, city, state, zip_code, beneficiary_information, draft_date, future_draft_date, licensed_agent_account, call_center_id, call_centers(name)")
          .eq("id", leadRowId)
          .maybeSingle();

        if (leadError || !data) throw new Error(leadError?.message || "Lead not found.");

        const snap: LeadSnapshot = {
          rowId: String(data.id),
          submissionId: data.submission_id ? String(data.submission_id) : null,
          name: `${String(data.first_name ?? "").trim()} ${String(data.last_name ?? "").trim()}`.trim() || "Unnamed Lead",
          phone: String(data.phone ?? ""),
          callCenterId: data.call_center_id ? String(data.call_center_id) : null,
          leadSource: String(data.lead_source ?? "—"),
          carrier: String(data.carrier ?? "—"),
          productType: String(data.product_type ?? "—"),
          monthlyPremium: String(data.monthly_premium ?? "—"),
          coverageAmount: String(data.coverage_amount ?? "—"),
          stage: String(data.stage ?? "—"),
          streetAddress: buildStreetAddress(data as Record<string, unknown>),
          beneficiaryInformation: String(data.beneficiary_information ?? "—"),
          draftDate: String(data.draft_date ?? "—"),
          futureDraftDate: String(data.future_draft_date ?? "—"),
          licensedAgent: String(data.licensed_agent_account ?? "—"),
          centerName: String((data.call_centers as { name?: string | null } | null)?.name ?? "BPO"),
          claimContext: {
            rowId: String(data.id),
            leadUniqueId: String(data.lead_unique_id ?? "N/A"),
            leadName: `${String(data.first_name ?? "").trim()} ${String(data.last_name ?? "").trim()}`.trim() || "Unnamed Lead",
            phone: String(data.phone ?? ""),
            source: String(data.lead_source ?? ""),
            submissionId: data.submission_id ? String(data.submission_id) : null,
            callCenterId: data.call_center_id ? String(data.call_center_id) : null,
          },
        };

        const retentionSelection: ClaimSelections = {
          workflowType: "retention",
          bufferAgentId: null,
          licensedAgentId: null,
          retentionAgentId: null,
          isRetentionCall: true,
          retentionType: "new_sale",
          retentionNotes: "",
          quoteCarrier: "",
          quoteProduct: "",
          quoteCoverage: "",
          quoteMonthlyPremium: "",
        };

        const session = await findOrCreateVerificationSession(supabase, snap.claimContext, retentionSelection);

        const { data: leadNoteRows, error: leadNotesError } = await supabase
          .from("lead_notes")
          .select("id, body, created_at, created_by")
          .eq("lead_id", snap.rowId)
          .order("created_at", { ascending: false });
        if (leadNotesError) throw leadNotesError;

        const creatorIds = [...new Set(((leadNoteRows || []) as Array<{ created_by?: string | null }>).map((row) => row.created_by).filter(Boolean))] as string[];
        let authorById: Record<string, string> = {};
        if (creatorIds.length) {
          const { data: users } = await supabase.from("users").select("id, full_name").in("id", creatorIds);
          if (users) {
            authorById = Object.fromEntries(users.map((user) => [user.id, user.full_name?.trim() || "User"]));
          }
        }

        const mappedLeadNotes = ((leadNoteRows || []) as Array<{ id: string; body: string; created_at: string; created_by: string | null }>).map((row) => ({
          ...row,
          authorName: row.created_by ? authorById[row.created_by] ?? "User" : "System",
        }));

        if (!cancelled) {
          setLead(snap);
          setVerificationSessionId(session.sessionId);
          setDealNotes(mappedLeadNotes);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load retention lead.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [leadRowId, supabase]);

  if (currentRole !== "call_center_admin" && currentRole !== "system_admin") {
    return (
      <div style={{ padding: 24, borderRadius: 14, border: "1.5px solid #fecaca", backgroundColor: "#fef2f2", maxWidth: 600, margin: "40px auto" }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 20, color: "#991b1b", fontWeight: 700 }}>Access Denied</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#7f1d1d", lineHeight: 1.6 }}>
          This page is only available to center admins and system admins.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/${routeRole}?page=${sourcePage}`)}
          style={{ display: "inline-flex", alignItems: "center", gap: 10, height: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${T.border}`, backgroundColor: "#fff", color: T.textDark, cursor: "pointer", fontSize: 14, fontWeight: 700 }}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.textMuted }}>Matched by: retention queue</span>
      </div>

      {loading ? (
        <div style={{ borderRadius: 16, border: `1px solid ${T.border}`, backgroundColor: T.cardBg, padding: "80px 40px", textAlign: "center", fontSize: 14, fontWeight: 600, color: T.textMuted }}>
          Loading retention lead...
        </div>
      ) : error || !lead ? (
        <div style={{ borderRadius: 16, border: "1px solid #fecaca", backgroundColor: "#fef2f2", padding: 24, fontSize: 14, fontWeight: 600, color: "#991b1b" }}>
          {error || "Lead not found."}
        </div>
      ) : (
        <div style={{ borderRadius: 20, border: `1px solid ${T.border}`, backgroundColor: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, color: T.textDark }}>{lead.name}</h1>
                <span style={{ display: "inline-flex", alignItems: "center", padding: "8px 16px", borderRadius: 14, backgroundColor: "#dbeafe", color: "#1d4ed8", fontSize: 18, fontWeight: 800 }}>
                  {formatPhoneDisplay(lead.phone)}
                </span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 16, fontWeight: 600, color: T.textMuted }}>
                {lead.carrier} • {lead.stage} • {lead.centerName}
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(420px, 0.95fr)", gap: 24, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 0, backgroundColor: "#e7edf8", borderRadius: 16, padding: 4, width: "100%" }}>
                {[
                  { id: "policies", label: "Policies" },
                  { id: "lead-notes", label: "Lead Notes" },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as TabId)}
                      style={{
                        flex: 1,
                        height: 44,
                        borderRadius: 14,
                        border: "none",
                        backgroundColor: active ? "#fff" : "transparent",
                        color: T.textDark,
                        fontSize: 15,
                        fontWeight: active ? 800 : 600,
                        cursor: "pointer",
                        boxShadow: active ? "0 2px 8px rgba(0,0,0,0.05)" : "none",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {activeTab === "policies" ? (
                <TransferLeadSsnPolicyCards leadRowId={lead.rowId} supabase={supabase} />
              ) : (
                <LeadCard icon="📝" title="Lead Notes" defaultExpanded collapsible={false}>
                  <NoteList
                    notes={dealNotes.map((note) => ({
                      id: note.id,
                      title: note.authorName || "User",
                      subtitle: formatDateTime(note.created_at),
                      body: note.body,
                    }))}
                    emptyTitle="No lead notes have been added yet."
                  />
                </LeadCard>
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              {verificationSessionId ? (
                <TransferLeadVerificationPanel
                  sessionId={verificationSessionId}
                  showProgressSummary={false}
                  hideToolbarActions
                  includeLeadVendorField
                  bodyMaxHeight="calc(100vh - 320px)"
                  leadName={lead.name}
                  submissionId={lead.submissionId}
                  callCenterId={lead.callCenterId}
                />
              ) : (
                <div style={{ borderRadius: 16, border: `1px solid ${T.border}`, backgroundColor: T.cardBg, padding: "60px 24px", textAlign: "center", fontSize: 14, fontWeight: 600, color: T.textMuted }}>
                  Loading verification panel...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
