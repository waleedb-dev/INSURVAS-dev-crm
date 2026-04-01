/**
 * Global design tokens – single source of truth.
 * Every dashboard component MUST import colors from here.
 * Extracted directly from UX-design/Dashboard.jpg.
 */
export const T = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  pageBg:      "var(--pageBg, #f2f8ee)",   // green-50
  /** Left nav column — fixed dark chrome (same fill as table headers that match nav). */
  asideChrome: "#3b5229",
  sidebarBg:   "var(--sidebarBg, #e8efdf)",   // slightly darker green than pageBg
  cardBg:      "var(--cardBg, #ffffff)",
  rowBg:       "var(--rowBg, #f2f8ee)",   // green-50

  // ── Brand ────────────────────────────────────────────────────────────────
  blue:        "var(--blue, #638b4b)",   // primary – active nav, buttons, links
  blueHover:   "var(--blueHover, #4e6e3a)",   // button hover
  blueLight:   "var(--blueLight, #ddecd4)",   // green tint bg
  blueFaint:   "var(--blueFaint, #f2f8ee)",   // subtle green wash

  // ── Text ─────────────────────────────────────────────────────────────────
  textDark:    "var(--textDark, #1c201a)",   // green-900
  textMid:     "var(--textMid, #2e3429)",   // green-800 tint
  textMuted:   "var(--textMuted, #6b7a5f)",   // green-600 tint

  // ── Borders ──────────────────────────────────────────────────────────────
  border:      "var(--border, #c8d4bb)",   // green-200 tint
  borderLight: "var(--borderLight, #ddecd4)",   // green-100

  // ── Event accent bars ─────────────────────────────────────────────────────
  accentBlue:   "var(--accentBlue, #638b4b)",  // green-500
  accentPink:   "var(--accentPink, #94c278)",  // green-300
  accentPurple: "var(--accentPurple, #4e6e3a)",  // green-600

  // ── Priority arrows ───────────────────────────────────────────────────────
  priorityHigh: "var(--priorityHigh, #3b5229)",  // green-700 ↑
  priorityLow:  "var(--priorityLow, #74a557)",  // green-400 ↓

  // ── Status / semantic ─────────────────────────────────────────────────────
  danger:      "var(--danger, #3b5229)",  // green-700
  success:     "var(--success, #638b4b)",  // green-500
  warning:     "var(--warning, #74a557)",  // green-400

  // ── Member avatar palette (kept here so they're consistent everywhere) ───
  memberBlue:   "var(--memberBlue, #638b4b)",  // green-500
  memberAmber:  "var(--memberAmber, #74a557)",  // green-400
  memberPink:   "var(--memberPink, #94c278)",  // green-300
  memberViolet: "var(--memberViolet, #4e6e3a)",  // green-600
  memberSky:    "var(--memberSky, #bbd9a9)",  // green-200
  memberTeal:   "var(--memberTeal, #3b5229)",  // green-700
  memberSlate:  "var(--memberSlate, #6b7a5f)",  // green-muted
  memberOrange: "var(--memberOrange, #74a557)",  // green-400

  // ── Shadows ───────────────────────────────────────────────────────────────
  shadowSm:  "0 2px 8px  rgba(0,0,0,0.04)",
  shadowMd:  "0 2px 12px rgba(0,0,0,0.06)",
  shadowLg:  "0 8px 32px rgba(0,0,0,0.10)",
  shadowXl:  "0 20px 60px rgba(0,0,0,0.14)",

  // ── Radii ────────────────────────────────────────────────────────────────
  radiusSm:  8,
  radiusMd:  12,
  radiusLg:  16,
  radiusXl:  20,

  // ── Font ─────────────────────────────────────────────────────────────────
  font: "'SpotifyMix', sans-serif",
} as const;
