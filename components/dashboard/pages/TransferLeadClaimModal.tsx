"use client";

import { useMemo } from "react";
import { T } from "@/lib/theme";
import type {
  AgentOption,
  ClaimSelections,
  ClaimWorkflowType,
  RetentionType,
} from "./transferLeadParity";

type Props = {
  open: boolean;
  loading: boolean;
  leadName: string;
  agents: {
    bufferAgents: AgentOption[];
    licensedAgents: AgentOption[];
    retentionAgents: AgentOption[];
  };
  selection: ClaimSelections;
  onChange: (next: ClaimSelections) => void;
  onClose: () => void;
  onSubmit: () => void;
};

function RadioTile({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        border: `1.5px solid ${active ? T.blue : T.border}`,
        backgroundColor: active ? T.blueFaint : "#fff",
        borderRadius: 10,
        padding: "10px 12px",
        fontWeight: 700,
        fontSize: 13,
        color: active ? T.blue : T.textDark,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export default function TransferLeadClaimModal({
  open,
  loading,
  leadName,
  agents,
  selection,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  const valid = useMemo(() => {
    if (selection.workflowType === "buffer") return Boolean(selection.bufferAgentId);
    if (selection.workflowType === "licensed") return Boolean(selection.licensedAgentId);
    if (selection.workflowType === "retention") {
      if (!selection.retentionAgentId || !selection.retentionType) return false;
      if (selection.retentionType !== "new_sale" && !selection.retentionNotes.trim()) return false;
      return true;
    }
    return false;
  }, [selection]);

  if (!open) return null;

  const setWorkflow = (workflowType: ClaimWorkflowType) => {
    onChange({ ...selection, workflowType });
  };

  const setRetentionType = (retentionType: RetentionType | "") => {
    onChange({ ...selection, retentionType });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.45)",
        zIndex: 3500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          maxHeight: "90vh",
          overflowY: "auto",
          backgroundColor: "#fff",
          borderRadius: 14,
          border: `1.5px solid ${T.border}`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
          padding: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, color: T.textDark }}>Claim Call</h2>
        <p style={{ marginTop: 6, marginBottom: 14, fontSize: 13, color: T.textMid }}>
          Claim this lead and initialize verification workflow for{" "}
          <span style={{ fontWeight: 700, color: T.textDark }}>{leadName || "selected lead"}</span>.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <RadioTile active={selection.workflowType === "buffer"} label="Buffer to Licensed" onClick={() => setWorkflow("buffer")} />
          <RadioTile active={selection.workflowType === "licensed"} label="Direct to Licensed" onClick={() => setWorkflow("licensed")} />
          <RadioTile active={selection.workflowType === "retention"} label="Retention Workflow" onClick={() => setWorkflow("retention")} />
        </div>

        {selection.workflowType === "buffer" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
              Buffer Agent
            </label>
            <select
              value={selection.bufferAgentId || ""}
              onChange={(e) => onChange({ ...selection, bufferAgentId: e.target.value || null })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}` }}
            >
              <option value="">Select buffer agent</option>
              {agents.bufferAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {selection.workflowType === "licensed" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
              Licensed Agent
            </label>
            <select
              value={selection.licensedAgentId || ""}
              onChange={(e) => onChange({ ...selection, licensedAgentId: e.target.value || null })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}` }}
            >
              <option value="">Select licensed agent</option>
              {agents.licensedAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {selection.workflowType === "retention" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                Retention Agent
              </label>
              <select
                value={selection.retentionAgentId || ""}
                onChange={(e) => onChange({ ...selection, retentionAgentId: e.target.value || null })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}` }}
              >
                <option value="">Select retention agent</option>
                {agents.retentionAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                Retention Type
              </label>
              <select
                value={selection.retentionType}
                onChange={(e) => setRetentionType((e.target.value || "") as RetentionType | "")}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}` }}
              >
                <option value="">Select retention type</option>
                <option value="new_sale">New Sale</option>
                <option value="fixed_payment">Fixed Failed Payment</option>
                <option value="carrier_requirements">Carrier Requirements</option>
              </select>
            </div>

            {selection.retentionType === "new_sale" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 12,
                  backgroundColor: T.blueFaint,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <input
                  value={selection.quoteCarrier}
                  placeholder="Carrier (optional)"
                  onChange={(e) => onChange({ ...selection, quoteCarrier: e.target.value })}
                  style={{ width: "100%", padding: "9px 10px", border: `1px solid ${T.border}`, borderRadius: 8 }}
                />
                <input
                  value={selection.quoteProduct}
                  placeholder="Product (optional)"
                  onChange={(e) => onChange({ ...selection, quoteProduct: e.target.value })}
                  style={{ width: "100%", padding: "9px 10px", border: `1px solid ${T.border}`, borderRadius: 8 }}
                />
                <input
                  value={selection.quoteCoverage}
                  placeholder="Coverage (optional)"
                  onChange={(e) => onChange({ ...selection, quoteCoverage: e.target.value })}
                  style={{ width: "100%", padding: "9px 10px", border: `1px solid ${T.border}`, borderRadius: 8 }}
                />
                <input
                  value={selection.quoteMonthlyPremium}
                  placeholder="Monthly premium (optional)"
                  onChange={(e) => onChange({ ...selection, quoteMonthlyPremium: e.target.value })}
                  style={{ width: "100%", padding: "9px 10px", border: `1px solid ${T.border}`, borderRadius: 8 }}
                />
              </div>
            )}

            {(selection.retentionType === "fixed_payment" || selection.retentionType === "carrier_requirements") && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, display: "block" }}>
                  Retention Notes
                </label>
                <textarea
                  value={selection.retentionNotes}
                  onChange={(e) => onChange({ ...selection, retentionNotes: e.target.value })}
                  rows={5}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1.5px solid ${T.border}`,
                    resize: "vertical",
                    fontFamily: T.font,
                  }}
                />
              </div>
            )}
          </>
        )}

        <div
          style={{
            marginTop: 10,
            paddingTop: 12,
            borderTop: `1px solid ${T.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13, color: T.textMid }}>
            <input
              type="checkbox"
              checked={selection.isRetentionCall}
              onChange={(e) => onChange({ ...selection, isRetentionCall: e.target.checked })}
            />
            Mark as retention call
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                border: `1.5px solid ${T.border}`,
                backgroundColor: "#fff",
                color: T.textDark,
                borderRadius: 8,
                padding: "9px 14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={loading || !valid}
              style={{
                border: "none",
                backgroundColor: loading || !valid ? T.border : T.blue,
                color: "#fff",
                borderRadius: 8,
                padding: "9px 14px",
                fontWeight: 700,
                cursor: loading || !valid ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Claiming..." : "Claim & Open"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
