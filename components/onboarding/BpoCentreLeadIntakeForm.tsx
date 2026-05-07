"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { T } from "@/lib/theme";

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

function emptyLine(isAdmin: boolean): TeamLine {
  return { full_name: "", email: "", phone: "", position_key: "owner", custom_position_label: "", is_center_admin: isAdmin };
}

const SUBMIT_ERROR_MAP: Record<string, string> = {
  invalid_token: "This link is not valid.",
  expired: "This invite has expired.",
  centre_name_required: "Centre name is required.",
  team_required: "Add at least one teammate with email.",
  team_name_email_required: "Each teammate needs a name and email.",
  team_invalid_position: "Invalid position selected.",
  team_custom_label_required: "Custom roles need a label.",
  team_exactly_one_admin: "Exactly one person must be marked as centre administrator.",
  not_found_or_closed: "This lead is no longer accepting intake.",
};

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

const selectStyle: CSSProperties = {
  ...fieldStyle,
  fontWeight: 600,
  cursor: "pointer",
  appearance: "auto" as CSSProperties["appearance"],
};

type Props = {
  mode: "open" | "invite";
  inviteToken?: string;
};

export function BpoCentreLeadIntakeForm({ mode, inviteToken = "" }: Props) {
  const isInvite = mode === "invite";
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(isInvite);
  const [centerName, setCenterName] = useState("");
  const [lines, setLines] = useState<TeamLine[]>([emptyLine(true), emptyLine(false)]);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    if (!isInvite) return;
    if (!inviteToken) { setError("Missing invite token."); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("bpo_center_lead_public_get", { p_token: inviteToken });
    setLoading(false);
    if (rpcError) { setError(rpcError.message); return; }
    const p = data as { ok?: boolean; error?: string; centre_display_name?: string; form_submitted_at?: string | null; team?: Array<{ full_name?: string; email?: string; phone?: string | null; position_key?: string; custom_position_label?: string | null; is_center_admin?: boolean }> };
    if (!p?.ok) { setError(p?.error === "expired" ? "This invite has expired." : "This onboarding link is not valid."); return; }
    setCenterName(p.centre_display_name ?? "");
    setSubmittedAt(p.form_submitted_at ?? null);
    if (Array.isArray(p.team) && p.team.length > 0) {
      const anyAdmin = p.team.some((x) => x.is_center_admin);
      setLines(p.team.map((r, idx) => ({
        full_name: r.full_name ?? "", email: r.email ?? "", phone: r.phone ?? "",
        position_key: (r.position_key as TeamLine["position_key"]) || "owner",
        custom_position_label: r.custom_position_label ?? "",
        is_center_admin: !!r.is_center_admin || (!anyAdmin && idx === 0),
      })));
    }
  }, [inviteToken, isInvite, supabase]);

  useEffect(() => { void load(); }, [load]);

  const setAdminLine = (index: number) => {
    setLines((ls) => ls.map((l, i) => ({ ...l, is_center_admin: i === index })));
  };

  const submit = useCallback(async () => {
    const adminCount = lines.filter((l) => l.is_center_admin).length;
    if (adminCount !== 1) { setError("Select exactly one centre administrator."); return; }
    if (isInvite && !inviteToken) return;
    setSaving(true);
    setError(null);
    const team = lines.filter((l) => l.full_name.trim() && l.email.trim()).map((l) => ({
      full_name: l.full_name.trim(), email: l.email.trim(), phone: l.phone.trim() || null,
      position_key: l.position_key,
      custom_position_label: l.position_key === "custom" ? l.custom_position_label.trim() : "",
      is_center_admin: l.is_center_admin,
    }));
    const { data, error: rpcError } = isInvite
      ? await supabase.rpc("bpo_center_lead_public_submit", { p_token: inviteToken, p_centre_display_name: centerName.trim(), p_team: team })
      : await supabase.rpc("bpo_center_lead_public_open_submit", { p_centre_display_name: centerName.trim(), p_team: team });
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
  }, [centerName, inviteToken, isInvite, lines, load, supabase]);

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
    margin: 0,
  };

  const cardStyle: CSSProperties = {
    width: "100%",
    background: "#fff",
    border: `1.5px solid ${T.border}`,
    borderRadius: T.radiusLg,
    boxShadow: T.shadowMd,
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

  /** Team cards: 1 col on narrow viewports, 2+ on wide */
  const teamGridStyle: CSSProperties = {
    padding: "clamp(16px, 2.5vw, 28px)",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 420px), 1fr))",
    gap: "clamp(14px, 2vw, 22px)",
    alignItems: "start",
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
    return (
      <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...cardStyle, maxWidth: 480, textAlign: "center" }}>
          <div style={headerStyle}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.textDark }}>Thank you</h1>
          </div>
          <div style={{ ...bodyStyle, padding: "32px 24px" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.textMuted, lineHeight: 1.6 }}>
              Your centre lead details were received. Our team will follow up with credentials and next steps.
            </p>
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
        {/* Header */}
        <div style={headerStyle}>
          <h1 style={{ margin: 0, fontSize: "clamp(1.25rem, 2.2vw, 1.75rem)", fontWeight: 800, color: T.textDark, lineHeight: 1.2 }}>
            BPO Centre Lead Intake
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: "clamp(12px, 1.4vw, 14px)", fontWeight: 600, color: T.textMuted, lineHeight: 1.5, maxWidth: "72ch" }}>
            One person must be the <strong style={{ color: T.textDark }}>centre administrator</strong>. Add the whole team with name, email, and role.
          </p>
        </div>

        <div style={bodyStyle}>
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

          {/* Centre name */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Centre name</label>
            <input
              value={centerName}
              onChange={(e) => setCenterName(e.target.value)}
              placeholder="e.g. Apex Transfers LLC"
              style={fieldStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#3b5229"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,139,75,0.12)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>

          {/* Team section */}
          <div style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusLg, overflow: "hidden" }}>
            <div style={{
              padding: "clamp(12px, 2vw, 18px) clamp(16px, 2.5vw, 28px)",
              borderBottom: `1px solid ${T.borderLight}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              backgroundColor: "#DCEBDC",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#233217" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.textDark }}>Team</h2>
              </div>
              <button
                type="button"
                onClick={() => setLines((ls) => [...ls, emptyLine(false)])}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: "#233217",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                Add person
              </button>
            </div>

            <div style={teamGridStyle}>
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "clamp(14px, 2vw, 22px)",
                    borderRadius: T.radiusMd,
                    border: `1.5px solid ${line.is_center_admin ? "#3b5229" : T.border}`,
                    backgroundColor: line.is_center_admin ? "rgba(220,235,220,0.3)" : "#fff",
                    transition: "all 0.15s",
                  }}
                >
                  {/* Admin radio */}
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 16 }}>
                    <input
                      type="radio"
                      name="centre_admin"
                      checked={line.is_center_admin}
                      onChange={() => setAdminLine(idx)}
                      style={{ width: 18, height: 18, accentColor: "#3b5229", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 700, color: line.is_center_admin ? "#233217" : T.textMid }}>
                      Centre administrator
                    </span>
                    {line.is_center_admin && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", backgroundColor: "#3b5229", padding: "2px 8px", borderRadius: 6 }}>Admin</span>
                    )}
                  </label>

                  {/* Name + Email */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "clamp(12px, 2vw, 18px)" }}>
                    <div>
                      <label style={labelStyle}>Full name</label>
                      <input
                        value={line.full_name}
                        onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, full_name: e.target.value } : l)))}
                        style={fieldStyle}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "#3b5229"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,139,75,0.12)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Email</label>
                      <input
                        type="email"
                        value={line.email}
                        onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, email: e.target.value } : l)))}
                        style={fieldStyle}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "#3b5229"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,139,75,0.12)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div style={{ marginTop: 16 }}>
                    <label style={labelStyle}>Phone (optional)</label>
                    <input
                      value={line.phone}
                      onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, phone: e.target.value } : l)))}
                      style={fieldStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "#3b5229"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,139,75,0.12)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
                    />
                  </div>

                  {/* Position */}
                  <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: line.position_key === "custom" ? "repeat(auto-fit, minmax(160px, 1fr))" : "1fr", gap: "clamp(12px, 2vw, 18px)" }}>
                    <div>
                      <label style={labelStyle}>Position</label>
                      <select
                        value={line.position_key}
                        onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, position_key: e.target.value as TeamLine["position_key"] } : l)))}
                        style={selectStyle}
                      >
                        {POSITION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    {line.position_key === "custom" && (
                      <div>
                        <label style={labelStyle}>Custom role</label>
                        <input
                          value={line.custom_position_label}
                          placeholder="Describe the role"
                          onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, custom_position_label: e.target.value } : l)))}
                          style={fieldStyle}
                          onFocus={(e) => { e.currentTarget.style.borderColor = "#3b5229"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,139,75,0.12)"; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Remove */}
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setLines((ls) => {
                          const next = ls.filter((_, i) => i !== idx);
                          if (!next.some((l) => l.is_center_admin) && next.length > 0) next[0] = { ...next[0], is_center_admin: true };
                          return next;
                        });
                      }}
                      style={{
                        marginTop: 14,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                        color: T.danger,
                        padding: 0,
                        transition: "opacity 0.15s",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            style={{
              marginTop: "clamp(20px, 3vw, 32px)",
              width: "100%",
              padding: "clamp(14px, 2vw, 18px) 24px",
              border: "none",
              borderRadius: 10,
              backgroundColor: saving ? "#c8d4bb" : "#233217",
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              boxShadow: T.shadowSm,
            }}
          >
            {saving ? "Submitting…" : "Submit intake"}
          </button>

          <p style={{ marginTop: 16, textAlign: "center", fontSize: 12, fontWeight: 500, color: T.textMuted }}>
            If you need help, reply to your Insurvas contact.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
