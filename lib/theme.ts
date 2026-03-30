/**
 * Global design tokens – single source of truth.
 * Every dashboard component MUST import colors from here.
 * Extracted directly from UX-design/Dashboard.jpg.
 */
export const T = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  pageBg:      "#f4f9fd",   // page / outer bg
  sidebarBg:   "#ffffff",   // sidebar bg
  cardBg:      "#ffffff",   // card / panel bg
  rowBg:       "#f4f9fd",   // table row / member card bg

  // ── Brand ────────────────────────────────────────────────────────────────
  blue:        "#638b4b",   // primary – active nav, buttons, links
  blueHover:   "#4e6e3a",   // button hover
  blueLight:   "#ddecd4",   // green tint bg
  blueFaint:   "#f2f8ee",   // subtle green wash

  // ── Text ─────────────────────────────────────────────────────────────────
  textDark:    "#1a202c",   // headings, primary labels
  textMid:     "#2d3748",   // body copy
  textMuted:   "#8a94a6",   // secondary labels, placeholders

  // ── Borders ──────────────────────────────────────────────────────────────
  border:      "#e2e8f0",   // default border
  borderLight: "#f0f4f8",   // subtle divider

  // ── Event accent bars ─────────────────────────────────────────────────────
  accentBlue:   "#638b4b",
  accentPink:   "#e879a0",
  accentPurple: "#a855f7",

  // ── Priority arrows ───────────────────────────────────────────────────────
  priorityHigh: "#f59e0b",  // amber  ↑
  priorityLow:  "#22c55e",  // green  ↓

  // ── Status / semantic ─────────────────────────────────────────────────────
  danger:      "#ef4444",
  success:     "#22c55e",
  warning:     "#f59e0b",

  // ── Member avatar palette (kept here so they're consistent everywhere) ───
  memberBlue:   "#638b4b",
  memberAmber:  "#f59e0b",
  memberPink:   "#ec4899",
  memberViolet: "#8b5cf6",
  memberSky:    "#0ea5e9",
  memberTeal:   "#14b8a6",
  memberSlate:  "#64748b",
  memberOrange: "#f97316",

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
