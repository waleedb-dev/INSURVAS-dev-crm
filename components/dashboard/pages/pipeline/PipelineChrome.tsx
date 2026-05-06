"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { T } from "@/lib/theme";
import { Filter, Grid3X3, List } from "lucide-react";

const BRAND_GREEN = "#233217";

export type PipelineStat = {
  label: string;
  value: string;
  icon: ReactNode;
  color?: string;
};

export function PipelineStatSkeleton() {
  return (
    <Card
      style={{
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        borderBottom: "4px solid #DCEBDC",
        background: T.cardBg,
        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
        padding: "20px 24px",
        minHeight: 100,
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: 1 }}>
        <div style={{ width: 80, height: 10, borderRadius: 4, background: "linear-gradient(90deg, #E8E8E8 25%, #F0F0F0 50%, #E8E8E8 75%)", backgroundSize: "200% 100%", animation: "pipeline-shimmer 1.5s infinite" }} />
        <div style={{ width: 60, height: 26, borderRadius: 6, background: "linear-gradient(90deg, #E8E8E8 25%, #F0F0F0 50%, #E8E8E8 75%)", backgroundSize: "200% 100%", animation: "pipeline-shimmer 1.5s infinite" }} />
      </div>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(90deg, #E8E8E8 25%, #F0F0F0 50%, #E8E8E8 75%)", backgroundSize: "200% 100%", animation: "pipeline-shimmer 1.5s infinite" }} />
      <style>{`
        @keyframes pipeline-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </Card>
  );
}

export function PipelineStatGrid({
  loading = false,
  stats,
  hoveredIndex,
  onHoverIndexChange,
}: {
  loading?: boolean;
  stats: PipelineStat[];
  hoveredIndex: number | null;
  onHoverIndexChange: (index: number | null) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
      {loading
        ? Array.from({ length: 4 }).map((_, index) => <PipelineStatSkeleton key={index} />)
        : stats.map(({ label, value, icon, color = BRAND_GREEN }, index) => (
            <Card
              key={label}
              onMouseEnter={() => onHoverIndexChange(index)}
              onMouseLeave={() => onHoverIndexChange(null)}
              style={{
                borderRadius: 16,
                border: `1px solid ${T.border}`,
                borderBottom: `4px solid ${color}`,
                background: `linear-gradient(135deg, color-mix(in srgb, ${color} 20%, ${T.cardBg}) 0%, ${T.cardBg} 80%)`,
                boxShadow:
                  hoveredIndex === index
                    ? "0 14px 40px rgba(28, 32, 26, 0.08), 0 4px 14px rgba(28, 32, 26, 0.05)"
                    : "0 4px 12px rgba(0,0,0,0.03)",
                transform: hoveredIndex === index ? "translateY(-3px)" : "translateY(0)",
                transition:
                  "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
                padding: "20px 24px",
                minHeight: 100,
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                cursor: "default",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: BRAND_GREEN, letterSpacing: "0.45px", textTransform: "uppercase", lineHeight: 1.25 }}>{label}</span>
                <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.05, wordBreak: "break-all" }}>{value}</div>
              </div>
              <div
                style={{
                  color,
                  backgroundColor:
                    hoveredIndex === index
                      ? `color-mix(in srgb, ${color} 24%, transparent)`
                      : `color-mix(in srgb, ${color} 15%, transparent)`,
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition:
                    "background-color 0.32s cubic-bezier(0.22, 1, 0.36, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
                  transform: hoveredIndex === index ? "scale(1.04)" : "scale(1)",
                }}
              >
                {icon}
              </div>
            </Card>
          ))}
    </div>
  );
}

export function PipelineToolbar({
  left,
  filterExpanded,
  hasActiveFilters,
  activeFilterCount,
  viewMode,
  onToggleFilters,
  onViewModeChange,
  actions,
  children,
}: {
  left: ReactNode;
  filterExpanded: boolean;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  viewMode: "kanban" | "list";
  onToggleFilters: () => void;
  onViewModeChange: (mode: "kanban" | "list") => void;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const expanded = filterExpanded || hasActiveFilters;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 14 }}>
      <div
        style={{
          width: "100%",
          background: T.cardBg,
          border: `1px solid ${T.border}`,
          borderBottom: expanded ? "none" : `1px solid ${T.border}`,
          borderRadius: expanded ? "16px 16px 0 0" : 16,
          padding: "14px 20px",
          boxShadow: expanded ? "none" : T.shadowSm,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{left}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onToggleFilters}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 38,
              padding: "0 16px",
              borderRadius: 10,
              border: filterExpanded ? `1.5px solid ${BRAND_GREEN}` : `1px solid ${T.border}`,
              background: filterExpanded ? "#DCEBDC" : T.pageBg,
              color: filterExpanded ? BRAND_GREEN : T.textDark,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: T.font,
              cursor: "pointer",
              transition: "all 0.15s ease-in-out",
            }}
          >
            <Filter size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: BRAND_GREEN, color: "#fff", fontSize: 11, fontWeight: 700 }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          <div style={{ display: "flex", border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
            <button type="button" aria-label="Kanban view" onClick={() => onViewModeChange("kanban")} style={{ padding: "8px 10px", background: viewMode === "kanban" ? "#DCEBDC" : "#fff", color: viewMode === "kanban" ? BRAND_GREEN : T.textMuted, border: "none", cursor: "pointer" }}>
              <Grid3X3 size={16} />
            </button>
            <button type="button" aria-label="List view" onClick={() => onViewModeChange("list")} style={{ padding: "8px 10px", background: viewMode === "list" ? "#DCEBDC" : "#fff", color: viewMode === "list" ? BRAND_GREEN : T.textMuted, border: "none", borderLeft: `1px solid ${T.border}`, cursor: "pointer" }}>
              <List size={16} />
            </button>
          </div>
          {actions}
        </div>
      </div>
      {expanded && children}
    </div>
  );
}
