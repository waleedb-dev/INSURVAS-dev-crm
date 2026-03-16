"use client";
import React, { ReactNode } from "react";
import { T } from "@/lib/theme";

interface TableColumn<T> {
  header: ReactNode;
  key: string;
  width?: string | number;
  align?: "left" | "center" | "right";
  render?: (item: T, index: number) => ReactNode;
  sortable?: boolean;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  stickyHeader?: boolean;
  rowStyle?: React.CSSProperties;
  headerStyle?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
  hoverEffect?: boolean;
}

export function Table<T extends { id: string | number }>({
  columns,
  data,
  onRowClick,
  stickyHeader = true,
  rowStyle,
  headerStyle,
  containerStyle,
  hoverEffect = true,
}: TableProps<T>) {
  return (
    <div style={{ width: "100%", overflowX: "auto", ...containerStyle }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={stickyHeader ? { position: "sticky", top: 0, zIndex: 10, backgroundColor: "#fff" } : {}}>
          <tr style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: T.pageBg, ...headerStyle }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: "14px 16px",
                  textAlign: col.align || "left",
                  fontSize: 11,
                  fontWeight: 800,
                  color: T.textMuted,
                  width: col.width,
                  whiteSpace: "nowrap",
                }}
              >
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: col.align === "center" ? "center" : col.align === "right" ? "flex-end" : "flex-start",
                  gap: 4 
                }}>
                  {col.header}
                  {col.sortable && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M7 15l5 5 5-5M7 9l5-5 5 5"/>
                    </svg>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr
              key={item.id}
              onClick={() => onRowClick?.(item)}
              style={{
                borderBottom: `1px solid ${T.borderLight}`,
                cursor: onRowClick ? "pointer" : "default",
                transition: "background-color 0.15s",
                ...rowStyle,
              }}
              onMouseEnter={(e) => {
                if (hoverEffect) e.currentTarget.style.backgroundColor = T.rowBg;
              }}
              onMouseLeave={(e) => {
                if (hoverEffect) e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: "12px 16px",
                    fontSize: 13,
                    color: T.textDark,
                    textAlign: col.align || "left",
                  }}
                >
                  {col.render ? col.render(item, index) : (item as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
