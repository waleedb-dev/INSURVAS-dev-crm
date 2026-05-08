"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { T } from "@/lib/theme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TeamLine = {
  full_name: string;
  email: string;
  phone: string;
  position_key: "owner" | "manager" | "closer" | "custom";
  custom_position_label: string;
  is_center_admin: boolean;
};

const POSITION_OPTIONS: { value: TeamLine["position_key"]; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "closer", label: "Closer" },
  { value: "custom", label: "Custom role" },
];

type AddMemberDraft = {
  full_name: string;
  email: string;
  phone: string;
  position_key: TeamLine["position_key"];
  custom_position_label: string;
};

function emptyDraft(): AddMemberDraft {
  return {
    full_name: "",
    email: "",
    phone: "",
    position_key: "owner",
    custom_position_label: "",
  };
}

function positionLabel(line: Pick<TeamLine, "position_key" | "custom_position_label">): string {
  if (line.position_key === "custom") {
    return line.custom_position_label?.trim() || "Custom role";
  }
  const opt = POSITION_OPTIONS.find((o) => o.value === line.position_key);
  return opt?.label ?? line.position_key;
}

/**
 * Centre admin = the Owner. If multiple owners are present, the first owner wins.
 * If no owner has been added yet, the first row stands in so the data invariant
 * (exactly one centre admin) holds for the submit payload.
 */
function applyAdminRule(rows: TeamLine[]): TeamLine[] {
  if (rows.length === 0) return rows;
  const ownerIdx = rows.findIndex((r) => r.position_key === "owner");
  const adminIdx = ownerIdx >= 0 ? ownerIdx : 0;
  return rows.map((r, i) => ({ ...r, is_center_admin: i === adminIdx }));
}

const SUBMIT_ERROR_MAP: Record<string, string> = {
  invalid_token: "This link is not valid.",
  expired: "This invite has expired.",
  centre_name_required: "Centre name is required.",
  team_required: "Add at least one teammate with email.",
  team_name_email_required: "Each teammate needs a name and email.",
  team_invalid_email: "One or more emails are not valid.",
  team_invalid_position: "Invalid position selected.",
  team_custom_label_required: "Custom roles need a label.",
  team_exactly_one_admin: "Exactly one person must be marked as centre administrator.",
  not_found_or_closed: "This lead is no longer accepting intake.",
  country_required: "Enter a country.",
};

function isValidEmail(value: string): boolean {
  // Intentionally pragmatic: blocks obvious mistakes without being over-strict.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 8,
  border: `1.5px solid ${T.border}`,
  fontSize: 14,
  color: T.textDark,
  outline: "none",
  fontFamily: T.font,
  backgroundColor: "#fff",
  transition: "border-color 0.15s, box-shadow 0.15s",
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: T.textMuted,
  marginBottom: 6,
  display: "block",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
};

/** Smaller labels for dense add-member row */
const compactFieldLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: T.textMuted,
  marginBottom: 4,
  display: "block",
  textTransform: "uppercase",
  letterSpacing: "0.35px",
};

/** Same shadcn Select pattern as dashboard (e.g. BpoOnboardingPage, BpoCentreLeadView). */
function IntakeSelect({
  value,
  onValueChange,
  options,
  ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <Select value={value} onValueChange={(val) => onValueChange(val || "")}>
      <SelectTrigger
        aria-label={ariaLabel}
        className="w-full min-w-0 hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
        style={{
          width: "100%",
          minHeight: 40,
          height: 40,
          borderRadius: 10,
          border: `1px solid ${T.border}`,
          backgroundColor: T.cardBg,
          color: T.textDark,
          fontSize: 13,
          fontWeight: 600,
          paddingLeft: 12,
          paddingRight: 10,
          fontFamily: T.font,
          transition: "all 0.15s ease-in-out",
        }}
      >
        <SelectValue>
          {options.find((o) => o.value === value)?.label ?? value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        className="z-[100000]"
        style={{
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          backgroundColor: T.cardBg,
          padding: 6,
          maxHeight: 300,
        }}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold"
            style={{
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 400,
              color: T.textDark,
              cursor: "pointer",
              transition: "all 0.1s ease-in-out",
            }}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type Props = {
  mode: "open" | "invite";
  inviteToken?: string;
};

export function BpoCentreLeadIntakeForm({ mode, inviteToken = "" }: Props) {
  const isInvite = mode === "invite";
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(isInvite);
  const [centerName, setCenterName] = useState("");
  const [country, setCountry] = useState("");
  const [lines, setLines] = useState<TeamLine[]>([]);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [addDraft, setAddDraft] = useState<AddMemberDraft>(() => emptyDraft());

  const load = useCallback(async () => {
    if (!isInvite) return;
    if (!inviteToken) { setError("Missing invite token."); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("bpo_center_lead_public_get", { p_token: inviteToken });
    setLoading(false);
    if (rpcError) { setError(rpcError.message); return; }
    const p = data as {
      ok?: boolean;
      error?: string;
      centre_display_name?: string;
      country?: string | null;
      form_submitted_at?: string | null;
      team?: Array<{ full_name?: string; email?: string; phone?: string | null; position_key?: string; custom_position_label?: string | null; is_center_admin?: boolean }>;
    };
    if (!p?.ok) { setError(p?.error === "expired" ? "This invite has expired." : "This onboarding link is not valid."); return; }
    setCenterName(p.centre_display_name ?? "");
    setCountry((p.country ?? "").trim());
    setSubmittedAt(p.form_submitted_at ?? null);
    if (Array.isArray(p.team) && p.team.length > 0) {
      const parsed: TeamLine[] = p.team.map((r) => ({
        full_name: r.full_name ?? "",
        email: r.email ?? "",
        phone: r.phone ?? "",
        position_key: (r.position_key as TeamLine["position_key"]) || "owner",
        custom_position_label: r.custom_position_label ?? "",
        is_center_admin: false,
      }));
      setLines(applyAdminRule(parsed));
    }
  }, [inviteToken, isInvite, supabase]);

  useEffect(() => { void load(); }, [load]);

  const removeLine = (index: number) => {
    setLines((ls) => applyAdminRule(ls.filter((_, i) => i !== index)));
  };

  const addLineFromDraft = useCallback(() => {
    const fullName = addDraft.full_name.trim();
    const email = addDraft.email.trim();
    if (!fullName || !email) {
      setError("Name and email are required to add a team member.");
      return;
    }
    if (!isValidEmail(email)) {
      setError(`Invalid email: ${email}`);
      return;
    }
    if (addDraft.position_key === "custom" && !addDraft.custom_position_label.trim()) {
      setError("Custom roles need a label.");
      return;
    }
    if (lines.some((l) => l.email.trim().toLowerCase() === email.toLowerCase())) {
      setError("This email is already on the team.");
      return;
    }
    setError(null);

    setLines((ls) => applyAdminRule([
      ...ls,
      {
        full_name: fullName,
        email,
        phone: addDraft.phone.trim(),
        position_key: addDraft.position_key,
        custom_position_label: addDraft.position_key === "custom" ? addDraft.custom_position_label.trim() : "",
        is_center_admin: false,
      },
    ]));

    setAddDraft(emptyDraft());
  }, [addDraft, lines]);

  const submit = useCallback(async () => {
    if (!centerName.trim()) {
      setError("Centre name is required.");
      return;
    }
    if (!country.trim()) {
      setError("Country is required.");
      return;
    }

    const team = lines
      .filter((l) => l.full_name.trim() && l.email.trim())
      .map((l) => ({
        full_name: l.full_name.trim(),
        email: l.email.trim(),
        phone: l.phone.trim() || null,
        position_key: l.position_key,
        custom_position_label: l.position_key === "custom" ? l.custom_position_label.trim() : "",
        is_center_admin: l.is_center_admin,
      }));

    if (team.length === 0) {
      setError("Add at least one teammate with email.");
      return;
    }

    const invalidEmail = team.find((t) => !isValidEmail(t.email));
    if (invalidEmail) {
      setError(`Invalid email: ${invalidEmail.email}`);
      return;
    }

    const adminCount = team.filter((t) => t.is_center_admin).length;
    if (adminCount !== 1) {
      setError("Select exactly one centre administrator.");
      return;
    }

    if (isInvite && !inviteToken) return;
    setSaving(true);
    setError(null);

    const { data, error: rpcError } = isInvite
      ? await supabase.rpc("bpo_center_lead_public_submit", {
          p_token: inviteToken,
          p_centre_display_name: centerName.trim(),
          p_team: team,
          p_country: country.trim(),
        })
      : await supabase.rpc("bpo_center_lead_public_open_submit", {
          p_centre_display_name: centerName.trim(),
          p_team: team,
          p_country: country.trim(),
        });
    setSaving(false);
    if (rpcError) { setError(rpcError.message); return; }
    const payload = data as { ok?: boolean; error?: string; center_lead_id?: string };
    if (!payload?.ok) { setError(SUBMIT_ERROR_MAP[payload?.error ?? ""] ?? "Could not save. Check all fields."); return; }
    setSuccess(true);
    if (isInvite) await load();

    const adminLine = team.find((t) => t.is_center_admin);
    try {
      await supabase.functions.invoke("bpo-onboarding-notification", {
        body: {
          action: "form_submitted",
          center_lead_id: payload.center_lead_id ?? null,
          centre_name: centerName.trim(),
          team_count: team.length,
          admin_email: adminLine?.email ?? null,
        },
      });
    } catch { /* non-blocking */ }
  }, [centerName, country, inviteToken, isInvite, lines, load, supabase]);

  const pageStyle: CSSProperties = {
    minHeight: "100vh",
    width: "100%",
    boxSizing: "border-box",
    backgroundColor: "#EEF5EE",
    fontFamily: T.font,
    padding: "clamp(12px, 2.5vw, 40px)",
  };

  const shellStyle: CSSProperties = {
    width: "100%",
    maxWidth: 1200,
    margin: "0 auto",
  };

  const cardStyle: CSSProperties = {
    width: "100%",
    background: "#fff",
    border: `1.5px solid ${T.border}`,
    borderRadius: T.radiusLg,
    boxShadow: "0 4px 24px rgba(35, 50, 23, 0.08)",
    overflow: "hidden",
  };

  const headerStyle: CSSProperties = {
    padding: "clamp(18px, 2.5vw, 32px) clamp(20px, 3vw, 40px)",
    borderBottom: `1px solid ${T.borderLight}`,
    backgroundColor: "#DCEBDC",
  };

  const bodyStyle: CSSProperties = {
    padding: "clamp(20px, 3vw, 40px) clamp(20px, 3vw, 40px)",
  };

  const teamBodyStyle: CSSProperties = {
    padding: "clamp(16px, 2.5vw, 28px)",
    display: "flex",
    flexDirection: "column",
    gap: "clamp(14px, 2vw, 20px)",
  };

  const tableShellStyle: CSSProperties = {
    width: "100%",
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusMd,
    overflow: "hidden",
    backgroundColor: "#fff",
  };

  const tableStyle: CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
    fontFamily: T.font,
  };

  const thStyle: CSSProperties = {
    backgroundColor: "#233217",
    color: "#fff",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.45px",
    textTransform: "uppercase",
    padding: "13px 14px",
    textAlign: "left",
    whiteSpace: "nowrap",
  };

  const tdStyle: CSSProperties = {
    padding: "12px 14px",
    color: T.textDark,
    borderBottom: `1px solid ${T.borderLight}`,
    verticalAlign: "middle",
  };

  const addPanelStyle: CSSProperties = {
    borderRadius: T.radiusMd,
    border: `1px solid ${T.borderLight}`,
    backgroundColor: "#f6faf3",
    padding: "clamp(14px, 1.8vw, 18px)",
  };

  const addRowStyle: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: "clamp(10px, 1.5vw, 14px)",
    alignItems: "flex-end",
  };

  const addFieldCellStyle: CSSProperties = {
    flex: "1 1 150px",
    minWidth: 130,
  };

  const compactInputStyle: CSSProperties = {
    ...fieldStyle,
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 500,
    minHeight: 40,
    borderRadius: 10,
  };

  /* ---------- Spinner ---------- */
  if (loading) {
    return (
      <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #DCEBDC", borderTopColor: "#3b5229", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  /* ---------- Fatal error ---------- */
  if (isInvite && error && !centerName && !submittedAt) {
    return (
      <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...cardStyle, maxWidth: 440, textAlign: "center" }}>
          <div style={headerStyle}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.textDark }}>Invalid link</h1>
          </div>
          <div style={{ ...bodyStyle, padding: "32px 24px" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.danger }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Success ---------- */
  if (success || submittedAt) {
    const submittedCentreName = centerName.trim();
    const nextSteps: { title: string; description: string }[] = [
      {
        title: "We review your team",
        description: "Your Insurvas account manager confirms the roster and centre details.",
      },
      {
        title: "Credentials are provisioned",
        description: "We create logins for the centre administrator and closers.",
      },
      {
        title: "Onboarding call scheduled",
        description: "You'll receive an email with next-step instructions and a meeting link.",
      },
    ];

    return (
      <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            ...cardStyle,
            width: "100%",
            maxWidth: 720,
            overflow: "hidden",
          }}
        >
          {/* Branded header */}
          <div
            style={{
              ...headerStyle,
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: 12,
              paddingTop: "clamp(16px, 2.2vw, 26px)",
              paddingBottom: "clamp(16px, 2.2vw, 26px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", minWidth: 0 }}>
              <img
                src="/logo-expanded.png"
                alt="Insurvas"
                style={{
                  height: "clamp(30px, 3.2vw, 38px)",
                  width: "auto",
                  maxWidth: "min(200px, 42vw)",
                  objectFit: "contain",
                  objectPosition: "left center",
                }}
              />
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(1.05rem, 1.6vw, 1.25rem)",
                fontWeight: 800,
                color: T.textDark,
                lineHeight: 1.2,
                textAlign: "center",
                letterSpacing: "-0.01em",
              }}
            >
              Onboarding submitted
            </h1>
            <div aria-hidden style={{ minWidth: 0 }} />
          </div>

          {/* Hero confirmation */}
          <div
            style={{
              padding: "clamp(28px, 4vw, 44px) clamp(24px, 4vw, 48px) clamp(8px, 1.5vw, 16px)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "linear-gradient(180deg, #dcfce7 0%, #bbf7d0 100%)",
                border: "1px solid rgba(35, 50, 23, 0.12)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                boxShadow: "0 6px 20px rgba(35, 50, 23, 0.12)",
              }}
              aria-hidden
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: "clamp(1.5rem, 2.4vw, 2rem)",
                fontWeight: 800,
                color: T.textDark,
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
              }}
            >
              Thank you{submittedCentreName ? `, ${submittedCentreName}` : ""}.
            </h2>
            <p
              style={{
                margin: "12px auto 0",
                fontSize: 15,
                fontWeight: 500,
                color: T.textMuted,
                lineHeight: 1.55,
                maxWidth: "44ch",
              }}
            >
              Your centre lead details have been received. Our team will be in touch shortly with credentials and next steps.
            </p>
          </div>

          {/* Next steps */}
          <div
            style={{
              padding: "clamp(20px, 3vw, 32px) clamp(20px, 4vw, 48px) clamp(28px, 4vw, 40px)",
            }}
          >
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 11,
                fontWeight: 800,
                color: T.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.4px",
                textAlign: "center",
              }}
            >
              What happens next
            </p>
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {nextSteps.map((step, i) => (
                <li
                  key={step.title}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    padding: "14px 16px",
                    borderRadius: T.radiusMd,
                    border: `1px solid ${T.borderLight}`,
                    backgroundColor: "#f6faf3",
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      backgroundColor: "#233217",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 800,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      letterSpacing: "0",
                      marginTop: 1,
                    }}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: T.textDark, lineHeight: 1.35 }}>
                      {step.title}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: T.textMuted, lineHeight: 1.5 }}>
                      {step.description}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "16px clamp(20px, 4vw, 48px) 22px",
              borderTop: `1px solid ${T.borderLight}`,
              backgroundColor: "#fafcf8",
              textAlign: "center",
              fontSize: 12,
              fontWeight: 500,
              color: T.textMuted,
              lineHeight: 1.5,
            }}
          >
            Questions in the meantime? Reply to your Insurvas contact and we'll help you out.
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Form ---------- */
  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <div style={cardStyle}>
          {/* Header — brand + title balanced */}
          <div
            style={{
              ...headerStyle,
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: 12,
              paddingTop: "clamp(16px, 2.2vw, 26px)",
              paddingBottom: "clamp(16px, 2.2vw, 26px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", minWidth: 0 }}>
              <img
                src="/logo-expanded.png"
                alt="Insurvas"
                style={{
                  height: "clamp(30px, 3.2vw, 38px)",
                  width: "auto",
                  maxWidth: "min(200px, 42vw)",
                  objectFit: "contain",
                  objectPosition: "left center",
                }}
              />
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(1.15rem, 2vw, 1.65rem)",
                fontWeight: 800,
                color: T.textDark,
                lineHeight: 1.2,
                textAlign: "center",
                letterSpacing: "-0.02em",
              }}
            >
              BPO Centre Lead Intake
            </h1>
            <div aria-hidden style={{ minWidth: 0 }} />
          </div>

          <div style={bodyStyle}>
            <style>{`
              .intake-form-table tbody tr.intake-data-row:hover td {
                background-color: rgba(220, 235, 220, 0.4);
              }
              .intake-form-table tbody tr.intake-data-row td {
                transition: background-color 0.15s ease-in-out;
              }
              .intake-form-table tbody tr:last-child td {
                border-bottom: none;
              }
              .intake-btn-primary:not(:disabled):hover {
                filter: brightness(1.06);
                box-shadow: 0 4px 14px rgba(35, 50, 23, 0.18);
              }
              .intake-btn-primary:not(:disabled):active {
                transform: scale(0.99);
              }
            `}</style>
            {/* Error banner */}
            {error && (
              <div style={{
                marginBottom: 20,
                padding: "12px 16px",
                borderRadius: T.radiusSm,
                border: `1.5px solid ${T.danger}`,
                backgroundColor: "rgba(59,82,41,0.04)",
                fontSize: 13,
                fontWeight: 700,
                color: T.danger,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                {error}
              </div>
            )}

            {/* Centre name first, then country (same row) */}
            <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: 16,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <label style={compactFieldLabelStyle}>Centre name *</label>
                  <input
                    value={centerName}
                    onChange={(e) => setCenterName(e.target.value)}
                    placeholder="e.g. Apex Transfers LLC"
                    style={{
                      ...fieldStyle,
                      width: "100%",
                      padding: "10px 12px",
                      fontSize: 13,
                      fontWeight: 500,
                      minHeight: 40,
                      borderRadius: 10,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#3b5229";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,139,75,0.12)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>
                <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                  <label style={compactFieldLabelStyle}>Country *</label>
                  <input
                    aria-label="Country"
                    autoComplete="off"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. United Kingdom"
                    style={{
                      ...fieldStyle,
                      width: "100%",
                      padding: "10px 12px",
                      fontSize: 13,
                      fontWeight: 500,
                      minHeight: 40,
                      borderRadius: 10,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#3b5229";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,139,75,0.12)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, lineHeight: 1.5 }}>
                We need the centre name, country, at least one team member, and exactly one marked centre administrator before you submit.
              </div>
            </div>

            {/* Team section */}
            <div
              style={{
                background: "#fafcf8",
                border: `1.5px solid ${T.border}`,
                borderRadius: T.radiusLg,
                overflow: "hidden",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
              }}
            >
              <div
                style={{
                  padding: "clamp(14px, 2vw, 20px) clamp(16px, 2.5vw, 28px)",
                  borderBottom: `1px solid ${T.borderLight}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  background: "linear-gradient(180deg, #e8f0e4 0%, #dcebdc 100%)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.55)",
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "rgba(35,50,23,0.12)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    border: "1px solid rgba(35,50,23,0.08)",
                  }}
                  aria-hidden
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#233217" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                </span>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.textDark, lineHeight: 1.25, letterSpacing: "-0.02em" }}>
                    Centre admin &amp; team
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 600, color: T.textMuted, lineHeight: 1.45 }}>
                    Onboarding team roster
                  </p>
                </div>
              </div>

              <div style={teamBodyStyle}>
                {/* Roster table */}
                <div style={tableShellStyle}>
                  <table className="intake-form-table" style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Name</th>
                        <th style={thStyle}>Email</th>
                        <th style={thStyle}>Position</th>
                        <th style={{ ...thStyle, width: 1, textAlign: "right" }} aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.length === 0 ? (
                        <tr className="intake-empty-row">
                          <td colSpan={4} style={{ ...tdStyle, borderBottom: "none", color: T.textMuted, fontWeight: 600, textAlign: "center", padding: "clamp(22px, 4vw, 36px) 20px", lineHeight: 1.55, fontSize: 13, background: "rgba(255,255,255,0.65)" }}>
                            <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10, maxWidth: "36rem", margin: "0 auto" }}>
                              <span
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: "50%",
                                  background: "rgba(220,235,220,0.65)",
                                  border: `1px solid ${T.borderLight}`,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                                aria-hidden
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="1.75"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                              </span>
                              <span>
                                No team members yet — add the centre team below.
                              </span>
                            </span>
                          </td>
                        </tr>
                      ) : (
                        lines.map((line, idx) => (
                          <tr key={idx} className="intake-data-row">
                            <td style={{ ...tdStyle, fontWeight: 700 }}>{line.full_name}</td>
                            <td style={tdStyle}>{line.email}</td>
                            <td style={{ ...tdStyle, textTransform: line.position_key === "custom" ? "none" : "capitalize" }}>
                              {positionLabel(line)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                              <button
                                type="button"
                                onClick={() => removeLine(idx)}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(59,82,41,0.06)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  border: "none",
                                  background: "transparent",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: T.danger,
                                  padding: "6px 8px",
                                  borderRadius: 8,
                                  transition: "background 0.15s ease-in-out",
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Add team member */}
                <div style={addPanelStyle}>
                  <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.35px" }}>
                    Add team member
                  </p>
                  <div style={addRowStyle}>
                    <div style={{ ...addFieldCellStyle, flex: "2 1 200px" }}>
                      <label style={compactFieldLabelStyle}>Full name</label>
                      <input
                        placeholder="Full name"
                        value={addDraft.full_name}
                        onChange={(e) => setAddDraft((d) => ({ ...d, full_name: e.target.value }))}
                        style={compactInputStyle}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "#3b5229"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,139,75,0.12)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div style={{ ...addFieldCellStyle, flex: "2 1 200px" }}>
                      <label style={compactFieldLabelStyle}>Email</label>
                      <input
                        placeholder="Email"
                        type="text"
                        inputMode="email"
                        autoComplete="email"
                        value={addDraft.email}
                        onChange={(e) => setAddDraft((d) => ({ ...d, email: e.target.value }))}
                        style={compactInputStyle}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "#3b5229"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,139,75,0.12)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div style={addFieldCellStyle}>
                      <label style={compactFieldLabelStyle}>Phone (optional)</label>
                      <input
                        placeholder="Phone"
                        value={addDraft.phone}
                        onChange={(e) => setAddDraft((d) => ({ ...d, phone: e.target.value }))}
                        style={compactInputStyle}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "#3b5229"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,139,75,0.12)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div style={addFieldCellStyle}>
                      <label style={compactFieldLabelStyle}>Position</label>
                      <IntakeSelect
                        ariaLabel="Position"
                        value={addDraft.position_key}
                        onValueChange={(v) => setAddDraft((d) => ({ ...d, position_key: v as TeamLine["position_key"] }))}
                        options={POSITION_OPTIONS}
                      />
                    </div>
                    {addDraft.position_key === "custom" && (
                      <div style={addFieldCellStyle}>
                        <label style={compactFieldLabelStyle}>Custom role</label>
                        <input
                          placeholder="Describe the role"
                          value={addDraft.custom_position_label}
                          onChange={(e) => setAddDraft((d) => ({ ...d, custom_position_label: e.target.value }))}
                          style={compactInputStyle}
                          onFocus={(e) => { e.currentTarget.style.borderColor = "#3b5229"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,139,75,0.12)"; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      className="intake-btn-primary"
                      onClick={addLineFromDraft}
                      style={{
                        flex: "0 0 auto",
                        marginLeft: "auto",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        height: 40,
                        padding: "0 18px",
                        borderRadius: 10,
                        border: "none",
                        backgroundColor: "#233217",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease-in-out",
                        boxShadow: "0 1px 4px rgba(35, 50, 23, 0.16)",
                        fontFamily: T.font,
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Add to team
                    </button>
                  </div>
                </div>
              </div>
            </div>

          {/* Submit action bar */}
          <div
            style={{
              marginTop: "clamp(20px, 2.5vw, 28px)",
              paddingTop: "clamp(16px, 2vw, 20px)",
              borderTop: `1px solid ${T.borderLight}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: T.textMuted, lineHeight: 1.5 }}>
              Need help? Reply to your Insurvas contact.
            </p>
            <button
              type="button"
              disabled={saving}
              className="intake-btn-primary"
              onClick={() => void submit()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 42,
                padding: "0 22px",
                minWidth: 180,
                border: "none",
                borderRadius: 10,
                backgroundColor: saving ? "#c8d4bb" : "#233217",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.01em",
                cursor: saving ? "not-allowed" : "pointer",
                transition: "all 0.15s ease-in-out",
                boxShadow: saving ? "none" : "0 2px 8px rgba(35, 50, 23, 0.18)",
                fontFamily: T.font,
              }}
            >
              {saving ? (
                <>
                  <span
                    aria-hidden
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                  Submitting…
                </>
              ) : (
                <>
                  Submit intake
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
