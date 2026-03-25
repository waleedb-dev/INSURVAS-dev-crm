"use client";

import { useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const statusOptions = [
  "Needs callback",
  "Not Interested",
  "DQ",
  "Chargeback DQ",
  "Future Submission Date",
  "Updated Banking/draft date",
  "Fulfilled carrier requirements",
  "Call Never Sent",
  "Disconnected",
  "GI - Currently DQ",
];

const reasonMap: Record<string, string[]> = {
  DQ: [
    "Multiple Chargebacks",
    "Not Cognitively Functional",
    "Transferred Many Times Without Success",
    "TCPA",
    "Decline All Available Carriers",
    "Already a DQ in our System",
    "Other",
  ],
  "Chargeback DQ": ["Chargeback DQ", "Multiple Chargebacks", "Other"],
  "Needs callback": ["Banking information invalid", "Existing Policy - Draft hasn't passed", "Other"],
  "Not Interested": ["Existing coverage - Not Looking for More", "Other"],
  "Future Submission Date": [
    "Draft Date Too Far Away",
    "Birthday is before draft date",
    "Other",
  ],
  "Updated Banking/draft date": ["Updated Banking and draft date", "Updated draft with same banking information"],
  "Fulfilled carrier requirements": ["Fulfilled carrier requirements"],
};

type Props = {
  leadRowId: string;
  submissionId: string;
  leadName: string;
};

export default function TransferLeadCallFixForm({ leadRowId, submissionId, leadName }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [newDraftDate, setNewDraftDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "ok" | "error" } | null>(null);

  const reasons = reasonMap[status] || [];
  const requiresDraftDate = status === "Updated Banking/draft date";

  const save = async () => {
    if (!status) {
      setMessage({ text: "Please select call status.", type: "error" });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id || null;
      const payload = {
        submission_id: submissionId,
        lead_id: leadRowId,
        customer_name: leadName || null,
        call_status: status,
        call_reason: reason || null,
        notes: notes || null,
        new_draft_date: requiresDraftDate ? newDraftDate || null : null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase.from("call_results").upsert(payload, {
        onConflict: "submission_id",
      });
      if (upsertError) throw upsertError;

      const { error: logError } = await supabase.from("call_update_logs").insert({
        submission_id: submissionId,
        lead_id: leadRowId,
        event_type: "call_result_updated",
        event_details: {
          status,
          reason: reason || null,
          notes: notes || null,
          newDraftDate: requiresDraftDate ? newDraftDate || null : null,
        },
        agent_id: userId,
      });
      if (logError) throw logError;

      setMessage({ text: "Call fix update saved.", type: "ok" });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Failed to save call fix data.",
        type: "error",
      });
    } finally {
      setLoading(false);
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
      <h3 style={{ margin: 0, fontSize: 18, color: T.textDark, fontWeight: 800 }}>Call Fix Forms</h3>
      <p style={{ marginTop: 6, marginBottom: 14, fontSize: 12, color: T.textMuted }}>
        Update disposition and workflow notes for this claimed lead.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
            Call Status
          </label>
          <select
            value={status}
            onChange={(e) => {
              const next = e.target.value;
              setStatus(next);
              setReason("");
            }}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}` }}
          >
            <option value="">Select status</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {reasons.length > 0 && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}` }}
            >
              <option value="">Select reason</option>
              {reasons.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}

        {requiresDraftDate && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
              New Draft Date
            </label>
            <input
              type="date"
              value={newDraftDate}
              onChange={(e) => setNewDraftDate(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}` }}
            />
          </div>
        )}

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
            Notes
          </label>
          <textarea
            rows={6}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1.5px solid ${T.border}`,
              resize: "vertical",
              fontFamily: T.font,
            }}
            placeholder="Add details for callback, banking fixes, carrier requirements, or disposition notes."
          />
        </div>

        {message && (
          <div
            style={{
              borderRadius: 8,
              border: `1px solid ${message.type === "ok" ? "#86efac" : "#fecaca"}`,
              backgroundColor: message.type === "ok" ? "#f0fdf4" : "#fef2f2",
              color: message.type === "ok" ? "#166534" : "#991b1b",
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {message.text}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => void save()}
            disabled={loading}
            style={{
              border: "none",
              backgroundColor: loading ? T.border : T.blue,
              color: "#fff",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Saving..." : "Save Call Fix"}
          </button>
        </div>
      </div>
    </div>
  );
}
