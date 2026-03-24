"use client";

import { T } from "@/lib/theme";

interface EmptyStateProps {
  title?: string;
  description?: string;
  emoji?: string;
  compact?: boolean;
}

export function EmptyState({
  title = "No data found",
  description = "Try changing your search or filters.",
  emoji = "📭",
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      style={{
        padding: compact ? "24px 16px" : "40px 20px",
        textAlign: "center",
        borderTop: `1px solid ${T.borderLight}`,
      }}
    >
      <div style={{ fontSize: compact ? 24 : 32, marginBottom: 8 }}>{emoji}</div>
      <p style={{ margin: "0 0 4px", color: T.textDark, fontSize: 14, fontWeight: 700 }}>{title}</p>
      <p style={{ margin: 0, color: T.textMuted, fontSize: 12, fontWeight: 600 }}>{description}</p>
    </div>
  );
}
