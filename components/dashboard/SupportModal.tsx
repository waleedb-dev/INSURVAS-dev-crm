"use client";

export default function SupportModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.35)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        animation: "fadeIn 0.18s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#fff", borderRadius: 20, padding: "40px 40px 36px",
          width: "100%", maxWidth: 500, position: "relative",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)", animation: "fadeInDown 0.2s ease",
        }}
      >
        <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", cursor: "pointer", color: "#6b7a5f", fontSize: 20, lineHeight: 1, padding: 4, borderRadius: 8, transition: "color 0.15s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#3b5229"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#6b7a5f"; }}
          aria-label="Close"
        >✕</button>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1c201a", marginBottom: 20 }}>Need some Help?</h2>

        <div style={{ backgroundColor: "#f2f8ee", borderRadius: 16, height: 180, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <SupportIllustration />
        </div>

        <p style={{ fontSize: 14, color: "#6b7a5f", lineHeight: 1.6, marginBottom: 28 }}>
          Describe your question and our specialists will answer you within 24 hours.
        </p>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#6b7a5f", display: "block", marginBottom: 8 }}>Request Subject</label>
          <div style={{ position: "relative" }}>
            <select style={{ width: "100%", padding: "13px 40px 13px 16px", border: "1.5px solid #c8d4bb", borderRadius: 12, fontSize: 14, color: "#2e3429", backgroundColor: "#fff", appearance: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <option>Technical difficulties</option>
              <option>Billing enquiry</option>
              <option>Feature request</option>
              <option>Other</option>
            </select>
            <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#6b7a5f" }}>▾</span>
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#6b7a5f", display: "block", marginBottom: 8 }}>Description</label>
          <textarea placeholder="Add some description of the request" style={{ width: "100%", padding: "13px 16px", border: "1.5px solid #c8d4bb", borderRadius: 12, fontSize: 14, color: "#2e3429", resize: "vertical", minHeight: 110, fontFamily: "inherit", lineHeight: 1.5, transition: "border-color 0.15s" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#638b4b"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#c8d4bb"; }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ backgroundColor: "transparent", color: "#6b7a5f", border: "1.5px solid #c8d4bb", borderRadius: 12, padding: "13px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "border-color 0.15s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#6b7a5f"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#c8d4bb"; }}
          >Cancel</button>
          <button style={{ backgroundColor: "#638b4b", color: "#fff", border: "none", borderRadius: 12, padding: "13px 32px", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(99,139,75,0.35)", fontFamily: "inherit", transition: "opacity 0.15s, transform 0.1s" }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.opacity = "0.88"; el.style.transform = "scale(0.99)"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.opacity = "1"; el.style.transform = "scale(1)"; }}
          >Send Request</button>
        </div>
      </div>
    </div>
  );
}

function SupportIllustration() {
  return (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none">
      <rect x="20" y="100" width="120" height="8" rx="4" fill="#c7d5e8" />
      <rect x="45" y="68" width="65" height="38" rx="6" fill="#ffffff" stroke="#c7d5e8" strokeWidth="2" />
      <rect x="48" y="71" width="59" height="30" rx="3" fill="#ddecd4" />
      <rect x="53" y="75" width="30" height="3" rx="1.5" fill="#93c5fd" />
      <rect x="53" y="81" width="49" height="2" rx="1" fill="#bfdbfe" />
      <rect x="53" y="86" width="40" height="2" rx="1" fill="#bfdbfe" />
      <rect x="53" y="91" width="45" height="2" rx="1" fill="#bfdbfe" />
      <path d="M40 106 L120 106 L115 100 L45 100 Z" fill="#c8d4bb" />
      <ellipse cx="98" cy="56" rx="12" ry="16" fill="#f9a8d4" />
      <rect x="86" y="68" width="24" height="20" rx="6" fill="#fff7ed" />
      <circle cx="98" cy="42" r="14" fill="#fde68a" />
      <path d="M84 40 Q84 24 98 22 Q112 24 112 40 Q112 32 105 30 Q101 26 98 26 Q95 26 91 30 Q86 32 84 40Z" fill="#1e1b4b" />
      <rect x="72" y="68" width="8" height="28" rx="4" fill="#fff7ed" />
      <rect x="28" y="85" width="24" height="18" rx="4" fill="#60a5fa" />
      <ellipse cx="40" cy="85" rx="14" ry="5" fill="#638b4b" />
      <line x1="40" y1="80" x2="40" y2="60" stroke="#4ade80" strokeWidth="2" />
      <ellipse cx="40" cy="62" rx="10" ry="14" fill="#66d88a" opacity="0.8" />
      <ellipse cx="32" cy="70" rx="7" ry="10" fill="#4ade80" opacity="0.8" />
      <ellipse cx="48" cy="70" rx="7" ry="10" fill="#86efac" opacity="0.8" />
      <rect x="122" y="85" width="16" height="15" rx="3" fill="#74a557" />
      <rect x="126" y="68" width="8" height="22" rx="4" fill="#34d399" />
      <rect x="118" y="74" width="8" height="3" rx="1.5" fill="#34d399" />
      <rect x="134" y="76" width="8" height="3" rx="1.5" fill="#34d399" />
    </svg>
  );
}
