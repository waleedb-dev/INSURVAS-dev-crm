"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { T } from "@/lib/theme";
import UserEditorComponent from "@/components/dashboard/pages/UserEditorComponent";

type TabKey = "info" | "thresholds" | "team";

export interface CentreOnboardingPrefill {
  centreName?: string | null;
  did?: string | null;
  slackChannel?: string | null;
  email?: string | null;
  country?: string | null;
  dailyTransferTarget?: number | null;
  dailySalesTarget?: number | null;
  adminFullName?: string | null;
  adminEmail?: string | null;
  adminPhone?: string | null;
}

export interface CentreCreateValues {
  centreName: string;
  did: string;
  slackChannel: string;
  email: string;
  country: string;
}

export interface CentreTeamMember {
  id: string;
  name: string;
  roleKey: string | null;
}

interface Props {
  prefill: CentreOnboardingPrefill;
  linkedCenterId?: string | null;
  teamMembers?: CentreTeamMember[];
  onRemoveTeamMember?: (userId: string) => void | Promise<void>;
  onCancel?: () => void;
  onCreateCentre?: (values: CentreCreateValues) => Promise<{ id: string } | null>;
  onSaveThresholds?: () => void;
  onTeamSetupSubmit?: () => void | Promise<void>;
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 800,
  color: T.textMuted,
  marginBottom: 8,
  letterSpacing: "0.02em",
};

const baseInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 18px",
  border: `1.5px solid ${T.border}`,
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 600,
  outline: "none",
  backgroundColor: "#fff",
  color: T.textDark,
  transition: "all 0.2s",
};

function isMissingRequired(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && !value.trim()) return true;
  return false;
}

export default function BpoCentreLeadOnboardingForm({
  prefill,
  linkedCenterId,
  teamMembers = [],
  onRemoveTeamMember,
  onCancel,
  onCreateCentre,
  onSaveThresholds,
  onTeamSetupSubmit,
}: Props) {
  const hasCentre = Boolean(linkedCenterId);
  const [activeTab, setActiveTab] = useState<TabKey>(hasCentre ? "team" : "info");

  const [centreName, setCentreName] = useState(prefill.centreName ?? "");
  const [did, setDid] = useState(prefill.did ?? "");
  const [slackChannel, setSlackChannel] = useState(prefill.slackChannel ?? "");
  const [email, setEmail] = useState(prefill.email ?? "");
  const [country, setCountry] = useState(prefill.country ?? "");

  const [touched, setTouched] = useState({ name: false, did: false, slack: false, email: false });
  const [showInvalid, setShowInvalid] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (linkedCenterId && activeTab === "info") setActiveTab("team");
  }, [linkedCenterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [thresholds, setThresholds] = useState({
    leadVendor: "",
    tier: "B" as "A" | "B" | "C",
    isActive: true,
    dailyTransferTarget: prefill.dailyTransferTarget ?? 0,
    dailySalesTarget: prefill.dailySalesTarget ?? 0,
    underwritingThreshold: 0,
    maxDqPercentage: 5,
    minApprovalRatio: 60,
    transferWeight: 40,
    approvalRatioWeight: 30,
    dqWeight: 30,
    slackWebhookUrl: "",
    slackChannelName: prefill.slackChannel ?? "",
    slackChannelId: "",
    slackManagerId: "",
  });

  const invalidName = (showInvalid || touched.name) && isMissingRequired(centreName);
  const invalidDid = (showInvalid || touched.did) && isMissingRequired(did);
  const invalidSlack = (showInvalid || touched.slack) && isMissingRequired(slackChannel);
  const invalidEmail = (showInvalid || touched.email) && isMissingRequired(email);

  const requiredInputStyle = (invalid: boolean): React.CSSProperties => ({
    ...baseInputStyle,
    border: `1.5px solid ${invalid ? T.danger : T.border}`,
    backgroundColor: T.rowBg + "44",
    boxShadow: invalid ? "0 0 0 3px rgba(239,68,68,0.12)" : undefined,
  });

  const weightTotal = thresholds.transferWeight + thresholds.approvalRatioWeight + thresholds.dqWeight;

  const handleCreate = async () => {
    if (
      isMissingRequired(centreName) ||
      isMissingRequired(did) ||
      isMissingRequired(slackChannel) ||
      isMissingRequired(email)
    ) {
      setShowInvalid(true);
      setTouched({ name: true, did: true, slack: true, email: true });
      return;
    }
    if (!onCreateCentre) return;
    setCreating(true);
    const result = await onCreateCentre({
      centreName: centreName.trim(),
      did: did.trim(),
      slackChannel: slackChannel.trim(),
      email: email.trim(),
      country: country.trim(),
    });
    setCreating(false);
    if (result?.id) {
      setActiveTab("team");
    }
  };

  return (
    <div style={{ backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 24, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", borderBottom: `1.5px solid ${T.border}`, padding: "0 20px" }}>
        {([
          { id: "info", label: "Centre Info" },
          { id: "thresholds", label: "Threshold Settings" },
          { id: "team", label: "Team Setup" },
        ] as { id: TabKey; label: string }[]).map((tab) => {
          const isDependent = tab.id !== "info";
          const isDisabled = isDependent && !hasCentre;
          return (
            <div
              key={tab.id}
              onClick={() => !isDisabled && setActiveTab(tab.id)}
              title={isDisabled ? "Create the centre first to unlock this section." : tab.label}
              style={{
                padding: "20px 24px",
                fontSize: 14,
                fontWeight: 800,
                color: isDisabled ? T.border : (activeTab === tab.id ? T.blue : T.textMuted),
                position: "relative",
                cursor: isDisabled ? "not-allowed" : "pointer",
                transition: "color 0.2s",
                opacity: isDisabled ? 0.5 : 1,
              }}
            >
              {tab.label}
              {activeTab === tab.id && !isDisabled && (
                <div style={{ position: "absolute", bottom: -1.5, left: 0, right: 0, height: 3, backgroundColor: T.blue, borderRadius: "3px 3px 0 0" }} />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: 40 }}>
        {activeTab === "info" ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>COUNTRY</label>
                <input
                  autoFocus
                  autoComplete="off"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. United Kingdom"
                  style={baseInputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>CENTRE NAME *</label>
                <input
                  value={centreName}
                  onChange={(e) => setCentreName(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                  placeholder="e.g. Islamabad North Hub"
                  style={requiredInputStyle(invalidName)}
                />
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>DIRECT LINE (DID) *</label>
              <input
                type="tel"
                value={did}
                onChange={(e) => setDid(e.target.value.replace(/[^0-9+]/g, ""))}
                onBlur={() => setTouched((t) => ({ ...t, did: true }))}
                placeholder="e.g. +15550000000"
                style={{ ...requiredInputStyle(invalidDid), width: "100%" }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <label style={labelStyle}>SLACK CHANNEL *</label>
                <input
                  value={slackChannel}
                  onChange={(e) => setSlackChannel(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, slack: true }))}
                  placeholder="#bpo-centre-slack"
                  style={requiredInputStyle(invalidSlack)}
                />
              </div>
              <div>
                <label style={labelStyle}>EMAIL *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="centre@email.com"
                  style={requiredInputStyle(invalidEmail)}
                />
              </div>
            </div>

            <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={onCancel}
                style={{ marginRight: 16, padding: "12px 32px", borderRadius: 10, border: `1.5px solid ${T.border}`, backgroundColor: "#fff", color: T.textDark, fontSize: 14, fontWeight: 800, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating || hasCentre}
                style={{
                  padding: "12px 32px",
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: T.blue,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: creating || hasCentre ? "not-allowed" : "pointer",
                  opacity: creating || hasCentre ? 0.6 : 1,
                  boxShadow: "0 4px 12px rgba(99,139,75,0.25)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                {hasCentre ? "Centre Created" : creating ? "Creating..." : "Create Centre"}
              </button>
            </div>
          </div>
        ) : activeTab === "thresholds" ? (
          <div>
            <SectionHeader title="Basic Information" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>CENTER NAME</label>
                <input
                  value={centreName}
                  disabled
                  style={{ ...baseInputStyle, backgroundColor: T.rowBg, color: T.textMid }}
                />
              </div>
              <div>
                <label style={labelStyle}>LEAD VENDOR *</label>
                <input
                  value={thresholds.leadVendor}
                  onChange={(e) => setThresholds((t) => ({ ...t, leadVendor: e.target.value }))}
                  placeholder="e.g. Vendor ABC"
                  style={baseInputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>TIER</label>
                <select
                  value={thresholds.tier}
                  onChange={(e) => setThresholds((t) => ({ ...t, tier: e.target.value as "A" | "B" | "C" }))}
                  style={{ ...baseInputStyle, cursor: "pointer" }}
                >
                  <option value="A">Tier A (Elite)</option>
                  <option value="B">Tier B (Premium)</option>
                  <option value="C">Tier C (Standard)</option>
                </select>
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 32 }}>
              <input
                type="checkbox"
                checked={thresholds.isActive}
                onChange={(e) => setThresholds((t) => ({ ...t, isActive: e.target.checked }))}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: T.textDark }}>Center is Active</span>
            </label>

            <SectionHeader title="Daily Targets" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginBottom: 32 }}>
              <NumberField
                label="DAILY TRANSFER TARGET"
                value={thresholds.dailyTransferTarget}
                onChange={(v) => setThresholds((t) => ({ ...t, dailyTransferTarget: v }))}
              />
              <NumberField
                label="DAILY SALES TARGET"
                value={thresholds.dailySalesTarget}
                onChange={(v) => setThresholds((t) => ({ ...t, dailySalesTarget: v }))}
              />
              <NumberField
                label="UNDERWRITING THRESHOLD"
                value={thresholds.underwritingThreshold}
                onChange={(v) => setThresholds((t) => ({ ...t, underwritingThreshold: v }))}
              />
            </div>

            <SectionHeader title="Performance Thresholds (%)" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
              <NumberField
                label="MAX DQ PERCENTAGE"
                value={thresholds.maxDqPercentage}
                onChange={(v) => setThresholds((t) => ({ ...t, maxDqPercentage: v }))}
                step={0.01}
                max={100}
              />
              <NumberField
                label="MIN APPROVAL RATIO"
                value={thresholds.minApprovalRatio}
                onChange={(v) => setThresholds((t) => ({ ...t, minApprovalRatio: v }))}
                step={0.01}
                max={100}
              />
            </div>

            <SectionHeader title="Performance Weights (must total 100)" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
              <NumberField
                label="TRANSFER WEIGHT"
                value={thresholds.transferWeight}
                onChange={(v) => setThresholds((t) => ({ ...t, transferWeight: v }))}
                max={100}
              />
              <NumberField
                label="APPROVAL RATIO WEIGHT"
                value={thresholds.approvalRatioWeight}
                onChange={(v) => setThresholds((t) => ({ ...t, approvalRatioWeight: v }))}
                max={100}
              />
              <NumberField
                label="DQ WEIGHT"
                value={thresholds.dqWeight}
                onChange={(v) => setThresholds((t) => ({ ...t, dqWeight: v }))}
                max={100}
              />
            </div>
            <div style={{ marginTop: 12, padding: 12, backgroundColor: T.rowBg, borderRadius: 8, marginBottom: 32 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textMid }}>
                Total: {weightTotal}%
                {weightTotal !== 100 && (
                  <span style={{ color: T.danger, marginLeft: 8 }}>(Should equal 100%)</span>
                )}
              </div>
            </div>

            <SectionHeader title="Slack Integration" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <TextField
                label="WEBHOOK URL"
                value={thresholds.slackWebhookUrl}
                onChange={(v) => setThresholds((t) => ({ ...t, slackWebhookUrl: v }))}
                placeholder="https://hooks.slack.com/services/..."
              />
              <TextField
                label="CHANNEL"
                value={thresholds.slackChannelName}
                onChange={(v) => setThresholds((t) => ({ ...t, slackChannelName: v }))}
                placeholder="#alerts"
              />
              <TextField
                label="CHANNEL ID"
                value={thresholds.slackChannelId}
                onChange={(v) => setThresholds((t) => ({ ...t, slackChannelId: v }))}
                placeholder="C1234567890"
              />
              <TextField
                label="MANAGER ID"
                value={thresholds.slackManagerId}
                onChange={(v) => setThresholds((t) => ({ ...t, slackManagerId: v }))}
                placeholder="U1234567890"
              />
            </div>

            <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={onCancel}
                style={{ marginRight: 16, padding: "12px 32px", borderRadius: 10, border: `1.5px solid ${T.border}`, backgroundColor: "#fff", color: T.textDark, fontSize: 14, fontWeight: 800, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSaveThresholds}
                disabled={!thresholds.leadVendor.trim()}
                style={{
                  padding: "12px 32px",
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: T.blue,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: thresholds.leadVendor.trim() ? "pointer" : "not-allowed",
                  opacity: thresholds.leadVendor.trim() ? 1 : 0.5,
                  boxShadow: "0 4px 12px rgba(99,139,75,0.25)",
                }}
              >
                Save Threshold Settings
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, margin: 0 }}>Centre Team Setup</h3>
                <button
                  type="button"
                  onClick={onCancel}
                  style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${T.border}`, backgroundColor: "#fff", color: T.textDark, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Done
                </button>
              </div>
              <div style={{ fontSize: 14, color: T.textMid }}>
                Create new team members directly in this section and attach them to this centre.
              </div>
            </div>

            <div style={{ border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: "hidden", backgroundColor: "#fff", marginBottom: 28 }}>
              <UserEditorComponent
                onClose={() => {}}
                onSubmit={async () => {
                  await onTeamSetupSubmit?.();
                }}
                presetRoleKey="call_center_admin"
                allowedRoleKeys={["call_center_admin", "call_center_agent"]}
                lockRole={false}
                presetCenterId={linkedCenterId ?? undefined}
                lockCenter={Boolean(linkedCenterId)}
                prefill={{
                  fullName: prefill.adminFullName ?? "",
                  email: prefill.adminEmail ?? "",
                  phone: prefill.adminPhone ?? "",
                }}
              />
            </div>

            <div style={{ border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: "hidden", backgroundColor: "#fff" }}>
              <div style={{ padding: "12px 16px", backgroundColor: "#EEF5EE", borderBottom: `1px solid ${T.border}`, fontSize: 13, fontWeight: 800, color: "#233217" }}>
                Current Team Members
              </div>
              {teamMembers.length === 0 ? (
                <div style={{ padding: "16px", fontSize: 13, color: T.textMuted }}>
                  No team members attached yet.
                </div>
              ) : (
                teamMembers.map((member) => (
                  <div
                    key={member.id}
                    style={{
                      padding: "12px 16px",
                      borderBottom: `1px solid ${T.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, color: T.textDark, fontWeight: 700 }}>{member.name}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                        {member.roleKey === "call_center_admin"
                          ? "Call Center Admin"
                          : member.roleKey === "call_center_agent"
                            ? "Call Center Agent"
                            : member.roleKey || "Role not set"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveTeamMember?.(member.id)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "none",
                        backgroundColor: "#fef2f2",
                        color: "#b91c1c",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 style={{ fontSize: 18, fontWeight: 800, color: T.textDark, marginBottom: 20, paddingBottom: 12, borderBottom: `1.5px solid ${T.border}` }}>
      {title}
    </h3>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  max?: number;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(step && step < 1 ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0)}
        style={baseInputStyle}
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={baseInputStyle}
      />
    </div>
  );
}
