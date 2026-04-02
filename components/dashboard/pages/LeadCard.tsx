"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { T } from "@/lib/theme";

interface LeadCardProps {
  icon: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  actions?: ReactNode;
}

export function LeadCard({
  icon,
  title,
  subtitle,
  children,
  defaultExpanded = true,
  collapsible = true,
  actions,
}: LeadCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  const headerContent = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        backgroundColor: "#EEF5EE",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.textDark }}>{title}</p>
        {subtitle && <p style={{ margin: "2px 0 0", fontSize: 12, color: T.textMuted, fontWeight: 500 }}>{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div style={{
      backgroundColor: "#fff",
      borderRadius: 16,
      border: `1.5px solid ${T.border}`,
      boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
      overflow: "hidden",
    }}>
      {/* Header */}
      {collapsible ? (
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            width: "100%",
            padding: "20px 24px",
            border: "none",
            background: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            textAlign: "left",
          }}
        >
          {headerContent}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {actions}
            {/* Chevron Icon */}
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: "#EEF5EE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "transform 0.25s ease",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4e6e3a"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {headerContent}
          {actions && <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{actions}</div>}
        </div>
      )}

      {/* Collapsible Content */}
      <div
        style={{
          maxHeight: collapsible ? (isExpanded ? contentHeight : 0) : undefined,
          overflow: "hidden",
          transition: collapsible ? "max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)" : undefined,
        }}
      >
        <div ref={contentRef} style={{ padding: "0 24px 24px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

interface InfoFieldProps {
  label: string;
  value: ReactNode;
}

export function InfoField({ label, value }: InfoFieldProps) {
  return (
    <div>
      <p style={{ margin: "0 0 4px", fontSize: 12, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.textDark }}>
        {value || "—"}
      </p>
    </div>
  );
}

interface InfoGridProps {
  columns: number;
  children: ReactNode;
  bordered?: boolean;
}

export function InfoGrid({ columns, children, bordered = true }: InfoGridProps) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: 20,
      marginBottom: bordered ? 20 : 0,
      paddingBottom: bordered ? 16 : 0,
      borderBottom: bordered ? `1px solid ${T.borderLight}` : undefined,
    }}>
      {children}
    </div>
  );
}

// Helper functions
export const formatCurrency = (val: number | undefined) => {
  if (val == null) return "—";
  return `$${Number(val).toLocaleString()}`;
};

export const formatBool = (val: boolean | undefined) => {
  if (val === true) return "Yes";
  if (val === false) return "No";
  return "—";
};

export const formatDate = (val: string | undefined) => {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};
