"use client";

import { T } from "@/lib/theme";

interface PaginationProps {
  page: number;
  totalItems: number;
  itemsPerPage: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  hideSummary?: boolean;
}

export function Pagination({
  page,
  totalItems,
  itemsPerPage,
  itemLabel,
  onPageChange,
  hideSummary = false,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * itemsPerPage + 1;
  const end = totalItems === 0 ? 0 : Math.min(totalItems, safePage * itemsPerPage);
  const prevDisabled = safePage === 1;
  const nextDisabled = safePage === totalPages || totalItems === 0;

  return (
    <div
      style={{
        padding: "16px 20px",
        borderTop: `1px solid ${T.border}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: T.rowBg,
      }}
    >
      {hideSummary ? <span /> : (
        <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
          Showing {start} - {end} of {totalItems} {itemLabel}
        </span>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 700 }}>
          Page {safePage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(safePage - 1)}
          disabled={prevDisabled}
          style={{
            backgroundColor: "transparent",
            color: prevDisabled ? T.textMuted : T.textDark,
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusSm,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: prevDisabled ? "not-allowed" : "pointer",
            fontFamily: T.font,
            opacity: prevDisabled ? 0.5 : 1,
          }}
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(safePage + 1)}
          disabled={nextDisabled}
          style={{
            backgroundColor: "transparent",
            color: nextDisabled ? T.textMuted : T.textDark,
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusSm,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: nextDisabled ? "not-allowed" : "pointer",
            fontFamily: T.font,
            opacity: nextDisabled ? 0.5 : 1,
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
