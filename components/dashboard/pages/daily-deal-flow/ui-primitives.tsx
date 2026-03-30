"use client";

import type { CSSProperties, ReactNode } from "react";
import { T } from "@/lib/theme";

export function FieldLabel({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: T.textMuted,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  style,
  multiple = false,
}: {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  options: { value: string; label: string }[];
  style?: CSSProperties;
  multiple?: boolean;
}) {
  return (
    <select
      multiple={multiple}
      value={value as string | readonly string[]}
      onChange={(e) => {
        if (multiple) {
          const list = Array.from(e.currentTarget.selectedOptions).map((o) => o.value);
          onChange(list);
          return;
        }
        onChange(e.currentTarget.value);
      }}
      style={{
        width: "100%",
        border: `1.5px solid ${T.border}`,
        borderRadius: 8,
        fontSize: 13,
        color: T.textMid,
        padding: multiple ? "8px" : "8px 10px",
        background: T.cardBg,
        minHeight: multiple ? 92 : 36,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  width = 980,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,32,26,0.45)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: width,
          maxHeight: "90vh",
          overflow: "auto",
          background: T.cardBg,
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          boxShadow: T.shadowMd,
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.textDark }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer", color: T.textMuted }}
          >
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
