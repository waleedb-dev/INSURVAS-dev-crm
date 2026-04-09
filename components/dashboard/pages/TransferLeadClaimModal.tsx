"use client";

import { useEffect, useMemo } from "react";
import { T } from "@/lib/theme";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  defaultLicensedAgentIdForSession,
  type AgentOption,
  type ClaimSelections,
  type ClaimWorkflowType,
} from "./transferLeadParity";

// StyledSelect component matching LeadEditForm design
function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(val) => onValueChange(val || "")} disabled={disabled}>
      <SelectTrigger
        style={{
          width: "100%",
          height: 42,
          borderRadius: 10,
          border: `1.5px solid ${T.border}`,
          backgroundColor: disabled ? T.pageBg : "#fff",
          color: value ? T.textDark : T.textMuted,
          fontSize: 14,
          fontWeight: 600,
          paddingLeft: 14,
          paddingRight: 12,
          transition: "all 0.15s ease-in-out",
        }}
        className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
      >
        <SelectValue placeholder={placeholder}>
          {value
            ? options.find((o) => o.value === value)?.label || value
            : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        style={{
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          backgroundColor: "#fff",
          padding: 6,
          maxHeight: 300,
          zIndex: 50,
        }}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            style={{
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 400,
              color: T.textDark,
              cursor: "pointer",
              transition: "all 0.1s ease-in-out",
            }}
            className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// FormField component matching LeadEditForm
function FormField({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: T.textMid,
          display: "flex",
          gap: 4,
        }}
      >
        {label}
        {required && <span style={{ color: "#dc2626" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

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
  retentionOnly?: boolean;
  /** When set, “Direct to Licensed” pre-selects this user if they appear in `agents.licensedAgents`. */
  sessionUserId?: string | null;
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
  retentionOnly = false,
  sessionUserId = null,
}: Props) {
  const valid = useMemo(() => {
    if (retentionOnly || selection.workflowType === "retention") {
      if (!selection.retentionAgentId || !selection.licensedAgentId) return false;
      const effectiveRetentionType = selection.retentionType || "new_sale";
      if (effectiveRetentionType !== "new_sale" && !selection.retentionNotes.trim()) return false;
      return true;
    }
    if (selection.workflowType === "buffer_only") return Boolean(selection.bufferAgentId);
    if (selection.workflowType === "buffer") {
      return Boolean(selection.bufferAgentId && selection.licensedAgentId);
    }
    if (selection.workflowType === "licensed") return Boolean(selection.licensedAgentId);
    return false;
  }, [selection, retentionOnly]);

  // Auto-set workflow to retention when in retention-only mode
  useMemo(() => {
    if (retentionOnly && selection.workflowType !== "retention") {
      onChange({ ...selection, workflowType: "retention", retentionType: "new_sale" });
    }
  }, [retentionOnly, selection, onChange]);

  useEffect(() => {
    if (!open) return;
    if (
      selection.workflowType !== "licensed" &&
      selection.workflowType !== "retention" &&
      selection.workflowType !== "buffer"
    ) {
      return;
    }
    const hasValid =
      selection.licensedAgentId &&
      agents.licensedAgents.some((a) => a.id === selection.licensedAgentId);
    if (hasValid) return;
    const auto = defaultLicensedAgentIdForSession(agents.licensedAgents, sessionUserId);
    if (!auto) return;
    onChange({ ...selection, licensedAgentId: auto });
  }, [open, selection, agents.licensedAgents, sessionUserId, onChange]);

  if (!open) return null;

  const setWorkflow = (workflowType: ClaimWorkflowType) => {
    if (workflowType === "buffer_only") {
      onChange({
        ...selection,
        workflowType: "buffer_only",
        licensedAgentId: null,
      });
      return;
    }
    if (workflowType === "licensed") {
      const auto = defaultLicensedAgentIdForSession(agents.licensedAgents, sessionUserId);
      const keep =
        selection.licensedAgentId &&
        agents.licensedAgents.some((a) => a.id === selection.licensedAgentId)
          ? selection.licensedAgentId
          : null;
      onChange({
        ...selection,
        workflowType,
        licensedAgentId: keep ?? auto ?? null,
      });
      return;
    }
    if (workflowType === "retention") {
      const auto = defaultLicensedAgentIdForSession(agents.licensedAgents, sessionUserId);
      const keep =
        selection.licensedAgentId &&
        agents.licensedAgents.some((a) => a.id === selection.licensedAgentId)
          ? selection.licensedAgentId
          : null;
      onChange({
        ...selection,
        workflowType,
        retentionType: "new_sale",
        licensedAgentId: keep ?? auto ?? null,
      });
      return;
    }
    if (workflowType === "buffer") {
      const auto = defaultLicensedAgentIdForSession(agents.licensedAgents, sessionUserId);
      const keep =
        selection.licensedAgentId &&
        agents.licensedAgents.some((a) => a.id === selection.licensedAgentId)
          ? selection.licensedAgentId
          : null;
      onChange({
        ...selection,
        workflowType,
        licensedAgentId: keep ?? auto ?? null,
      });
      return;
    }
    onChange({ ...selection, workflowType });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 3500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          width: "100%",
          maxWidth: 760,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 32px",
            borderBottom: `1px solid ${T.borderLight}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 800,
                margin: "0 0 8px",
                color: T.textDark,
              }}
            >
              {retentionOnly ? "Claim Retention" : "Claim Call"}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: T.textMuted,
                fontWeight: 600,
              }}
            >
              {retentionOnly
                ? "Process retention workflow for "
                : "Claim this lead and initialize verification workflow for "}
              <span style={{ fontWeight: 700, color: T.textDark }}>{leadName || "selected lead"}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: T.textMuted,
              padding: 8,
              borderRadius: 8,
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = T.pageBg;
              e.currentTarget.style.color = T.textDark;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = T.textMuted;
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            padding: "24px 32px",
            overflowY: "auto",
            backgroundColor: "#fff",
          }}
        >

        {!retentionOnly && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <RadioTile active={selection.workflowType === "buffer_only"} label="Buffer" onClick={() => setWorkflow("buffer_only")} />
            <RadioTile active={selection.workflowType === "buffer"} label="Buffer to Licensed" onClick={() => setWorkflow("buffer")} />
            <RadioTile active={selection.workflowType === "licensed"} label="Direct to Licensed" onClick={() => setWorkflow("licensed")} />
            <RadioTile active={selection.workflowType === "retention"} label="Retention Workflow" onClick={() => setWorkflow("retention")} />
          </div>
        )}

        {selection.workflowType === "buffer_only" && (
          <div style={{ marginBottom: 20 }}>
            <FormField label="Buffer Agent" required>
              <StyledSelect
                value={selection.bufferAgentId || ""}
                onValueChange={(val) => onChange({ ...selection, bufferAgentId: val || null })}
                options={[
                  { value: "", label: "Select buffer agent" },
                  ...agents.bufferAgents.map((agent) => ({ value: agent.id, label: agent.name })),
                ]}
                placeholder="Select buffer agent"
              />
            </FormField>
          </div>
        )}

        {selection.workflowType === "buffer" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <FormField label="Buffer Agent" required>
              <StyledSelect
                value={selection.bufferAgentId || ""}
                onValueChange={(val) => onChange({ ...selection, bufferAgentId: val || null })}
                options={[
                  { value: "", label: "Select buffer agent" },
                  ...agents.bufferAgents.map((agent) => ({ value: agent.id, label: agent.name })),
                ]}
                placeholder="Select buffer agent"
              />
            </FormField>
            <FormField label="Licensed Agent" required>
              <StyledSelect
                value={selection.licensedAgentId || ""}
                onValueChange={(val) => onChange({ ...selection, licensedAgentId: val || null })}
                options={[
                  { value: "", label: "Select licensed agent" },
                  ...agents.licensedAgents.map((agent) => ({ value: agent.id, label: agent.name })),
                ]}
                placeholder="Select licensed agent"
              />
            </FormField>
          </div>
        )}

        {selection.workflowType === "licensed" && (
          <div style={{ marginBottom: 20 }}>
            <FormField label="Licensed Agent" required>
              <StyledSelect
                value={selection.licensedAgentId || ""}
                onValueChange={(val) => onChange({ ...selection, licensedAgentId: val || null })}
                options={[
                  { value: "", label: "Select licensed agent" },
                  ...agents.licensedAgents.map((agent) => ({ value: agent.id, label: agent.name })),
                ]}
                placeholder="Select licensed agent"
              />
            </FormField>
          </div>
        )}

        {selection.workflowType === "retention" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              <FormField label="Retention Agent" required>
                <StyledSelect
                  value={selection.retentionAgentId || ""}
                  onValueChange={(val) => onChange({ ...selection, retentionAgentId: val || null })}
                  options={[
                    { value: "", label: "Select retention agent" },
                    ...agents.retentionAgents.map((agent) => ({ value: agent.id, label: agent.name })),
                  ]}
                  placeholder="Select retention agent"
                />
              </FormField>
              <FormField label="Licensed Agent" required>
                <StyledSelect
                  value={selection.licensedAgentId || ""}
                  onValueChange={(val) => onChange({ ...selection, licensedAgentId: val || null })}
                  options={[
                    { value: "", label: "Select licensed agent" },
                    ...agents.licensedAgents.map((agent) => ({ value: agent.id, label: agent.name })),
                  ]}
                  placeholder="Select licensed agent"
                />
              </FormField>
            </div>

            {(selection.retentionType === "fixed_payment" || selection.retentionType === "carrier_requirements") && (
              <div style={{ marginBottom: 20 }}>
                <FormField label="Retention Notes" required>
                  <textarea
                    value={selection.retentionNotes}
                    onChange={(e) => onChange({ ...selection, retentionNotes: e.target.value })}
                    rows={5}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: 8,
                      border: `1.5px solid ${T.border}`,
                      resize: "vertical",
                      fontFamily: T.font,
                      fontSize: 14,
                      fontWeight: 600,
                      color: T.textDark,
                      backgroundColor: "#fff",
                      outline: "none",
                      transition: "all 0.2s",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = T.blue;
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 139, 75, 0.12)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </FormField>
              </div>
            )}
          </>
        )}

        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 32px",
            borderTop: `1.5px solid ${T.borderLight}`,
            backgroundColor: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {!retentionOnly && (
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13, color: T.textMid, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={selection.isRetentionCall}
                onChange={(e) => onChange({ ...selection, isRetentionCall: e.target.checked })}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              Mark as retention call
            </label>
          )}
          <div style={{ display: "flex", gap: 12, marginLeft: "auto" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                background: "#fff",
                border: `1.5px solid ${T.border}`,
                borderRadius: 8,
                padding: "0 24px",
                height: 44,
                fontWeight: 700,
                cursor: "pointer",
                color: T.textDark,
                fontSize: 14,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = T.blue;
                e.currentTarget.style.backgroundColor = T.pageBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = T.border;
                e.currentTarget.style.backgroundColor = "#fff";
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={loading || !valid}
              style={{
                background: loading || !valid ? T.border : "#233217",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "0 32px",
                height: 44,
                fontSize: 14,
                fontWeight: 700,
                cursor: loading || !valid ? "not-allowed" : "pointer",
                opacity: loading || !valid ? 0.6 : 1,
                boxShadow: loading || !valid ? "none" : "0 4px 12px rgba(35, 50, 23, 0.2)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!loading && valid) {
                  e.currentTarget.style.backgroundColor = "#1a260f";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(35, 50, 23, 0.3)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#233217";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(35, 50, 23, 0.2)";
              }}
            >
              {loading ? (retentionOnly ? "Processing..." : "Claiming...") : (retentionOnly ? "Process Retention" : "Claim & Open")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
