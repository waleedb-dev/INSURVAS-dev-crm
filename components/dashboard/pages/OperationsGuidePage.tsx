"use client";
import { useState } from "react";
import { T } from "@/lib/theme";

interface Section { id: string; title: string; icon: string; tag: string; tagColor: string; content: string[]; }

const SECTIONS: Section[] = [
  {
    id: "onboarding", title: "Onboarding New Agents", icon: "🚀", tag: "HR", tagColor: "#3b82f6",
    content: [
      "Complete I-9 and W-9 forms on the employee portal before your first day.",
      "Obtain your state insurance license (Life & Health and/or P&C) before writing policies.",
      "Complete NIPR appointment with each carrier prior to submitting applications.",
      "Set up your CRM credentials through IT — request access via the helpdesk.",
      "Shadow a Senior Agent for your first week before taking solo appointments.",
      "Review the carrier portal logins document shared by your manager.",
      "Complete mandatory compliance training in the LMS within your first 30 days.",
    ],
  },
  {
    id: "claims", title: "Claims Processing", icon: "📋", tag: "Operations", tagColor: "#8b5cf6",
    content: [
      "Direct clients to call their carrier's 1-800 claims number immediately after a loss.",
      "For complex claims, email the claims team at claims@unlimited-ins.com with the policy number and brief description.",
      "Document all client communications in the CRM within 24 hours of the interaction.",
      "Follow up with clients within 3 business days of a claim being filed.",
      "Escalate denied claims to the Manager — do not advise clients on appealing without approval.",
      "Keep detailed records of adjuster names, contact info, and claim reference numbers.",
    ],
  },
  {
    id: "carrier-submission", title: "Carrier Submission Process", icon: "📤", tag: "Underwriting", tagColor: "#f59e0b",
    content: [
      "Verify client eligibility before submitting — check loss runs (3-5 years) for commercial accounts.",
      "Always obtain a signed application before binding any policy.",
      "Submit P&C new business to Progressive through the rater; Life to carrier direct portals.",
      "For E&S lines, route to the surplus lines desk — allow 5–7 business days for quotes.",
      "Confirm binding confirmation in writing via email and upload to the CRM policy record.",
      "Notify clients of coverage effective dates within 1 business day of binding.",
    ],
  },
  {
    id: "compliance", title: "Compliance & Ethics", icon: "⚖️", tag: "Legal", tagColor: "#dc2626",
    content: [
      "Never guarantee coverage outcomes or quote specific claim payouts to clients.",
      "Replacement policies require a completed Replacement Notice signed by the client.",
      "Maintain all client records for a minimum of 7 years per state regulations.",
      "Do not share client data with third parties without written consent.",
      "Report any suspected fraud immediately to the compliance team — see the Fraud Hotline SOP.",
      "Annual CE (Continuing Education) hours must be completed 60 days before license expiration.",
      "Gifts and benefits to clients are capped at $25 per occurrence per state law.",
    ],
  },
  {
    id: "commissions-guide", title: "Commission Structure", icon: "💰", tag: "Finance", tagColor: "#16a34a",
    content: [
      "New Business P&C: 10–12% of first-year premium, paid monthly after 60-day hold.",
      "Life & Annuity: 15–55% (varies by carrier and product type) — see carrier schedules.",
      "Commercial Lines: 10% standard, with performance bonuses at 100%+ quota.",
      "Renewals: 5–8% depending on carrier and line of business.",
      "Chargebacks apply on policies cancelled within the first 9 months of the term.",
      "Commission statements are issued on the 5th of each month via the agent portal.",
      "Direct deposit enrollment is mandatory — email payroll@unlimited-ins.com for setup.",
    ],
  },
  {
    id: "crm-guide", title: "CRM Usage Guide", icon: "🖥️", tag: "Tech", tagColor: "#0ea5e9",
    content: [
      "All leads must be entered into the CRM within 2 hours of first contact.",
      "Update lead stages in the Pipeline view after every client interaction.",
      "Use the Activity Log to document calls, emails, and meetings with timestamps.",
      "Attach all signed documents directly to the policy record — not in email.",
      "The Daily Deal Flow dashboard resets at midnight UTC — submit deals before EOD.",
      "Use the Assigning page if a lead needs to be transferred to another agent.",
      "Run your commission report monthly from the Commissions tab to verify accuracy.",
    ],
  },
];

export default function OperationsGuidePage() {
  const [open, setOpen] = useState<string | null>("onboarding");
  const [search, setSearch] = useState("");

  const filtered = SECTIONS.filter((s) =>
    !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.content.some((c) => c.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>Internal Reference</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textDark, margin: 0 }}>Operations Guide</h1>
        </div>
        <div style={{ position: "relative" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="7" cy="7" r="5.5" stroke={T.textMuted} strokeWidth="1.5" />
            <path d="M11 11L14 14" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guides…" style={{ padding: "10px 14px 10px 34px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, fontSize: 13, fontFamily: T.font, color: T.textMid, width: 240, backgroundColor: T.cardBg }}
            onFocus={(e) => { e.currentTarget.style.borderColor = T.blue; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = T.border; }}
          />
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        {[{ label: "Updated", value: "Mar 10, 2026" }, { label: "Sections", value: SECTIONS.length }, { label: "Version", value: "v2.4" }].map(({ label, value }) => (
          <div key={label} style={{ backgroundColor: T.cardBg, borderRadius: T.radiusMd, padding: "10px 18px", boxShadow: T.shadowSm, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{label}:</span>
            <span style={{ fontSize: 13, color: T.textDark, fontWeight: 800 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Accordion */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((section) => {
          const isOpen = open === section.id;
          return (
            <div key={section.id} style={{ backgroundColor: T.cardBg, borderRadius: T.radiusLg, boxShadow: T.shadowSm, overflow: "hidden", border: `1.5px solid ${isOpen ? section.tagColor + "44" : "transparent"}`, transition: "border-color 0.2s" }}>
              <button onClick={() => setOpen(isOpen ? null : section.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", border: "none", background: "none", cursor: "pointer", fontFamily: T.font, textAlign: "left" }}>
                <span style={{ fontSize: 22 }}>{section.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: T.textDark }}>{section.title}</span>
                    <span style={{ backgroundColor: section.tagColor + "18", color: section.tagColor, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{section.tag}</span>
                  </div>
                  <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{section.content.length} guidelines</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transition: "transform 0.22s", transform: isOpen ? "rotate(180deg)" : "rotate(0)", flexShrink: 0 }}>
                  <path d="M4 6L8 10L12 6" stroke={T.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {isOpen && (
                <div style={{ padding: "0 20px 20px", animation: "fadeIn 0.18s ease" }}>
                  <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    {section.content.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: section.tagColor + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: section.tagColor }}>{idx + 1}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: T.textMid, fontWeight: 600, lineHeight: 1.6 }}>
                          {search ? highlightMatch(item, search, section.tagColor) : item}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p style={{ margin: 0, fontSize: 15, color: T.textMuted, fontWeight: 600 }}>No results for "{search}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string, color: string) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ backgroundColor: color + "28", color, fontWeight: 800, borderRadius: 3, padding: "0 2px" }}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
