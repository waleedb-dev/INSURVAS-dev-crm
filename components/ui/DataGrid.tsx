"use client";

import React, { ReactNode } from "react";
import { T } from "@/lib/theme";

interface DataGridProps {
  search: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  activeFilters?: ReactNode;
  children: ReactNode;
  pagination?: ReactNode;
  style?: React.CSSProperties;
  /** When true, omit the built-in search/filter header (use an external toolbar). */
  noHeader?: boolean;
}

export function DataGrid({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  activeFilters,
  children,
  pagination,
  style,
  noHeader = false,
}: DataGridProps) {
  return (
    <div style={{ 
      backgroundColor: T.cardBg, 
      borderRadius: T.radiusXl, 
      boxShadow: T.shadowSm, 
      display: "flex",
      flexDirection: "column",
      position: "relative",
      ...style 
    }}>
      {/* Filters + Search Header */}
      {!noHeader && (
      <div style={{ 
        padding: "20px 20px", 
        borderBottom: `1px solid ${T.border}`, 
        display: "flex", 
        gap: 16, 
        alignItems: "center", 
        justifyContent: "space-between",
        flexShrink: 0,
        borderRadius: `${T.radiusXl}px ${T.radiusXl}px 0 0`,
        overflow: "hidden"
      }}>
        {/* Search Input */}
        <div style={{ position: "relative", flex: 1, maxWidth: 450 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", zIndex: 1 }}>
            <circle cx="7" cy="7" r="5.5" stroke={T.textMuted} strokeWidth="2" />
            <path d="M11 11L14 14" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input 
            value={search} 
            onChange={(e) => onSearchChange(e.target.value)} 
            placeholder={searchPlaceholder} 
            style={{ 
              padding: "12px 42px 12px 44px", 
              border: `1.5px solid ${T.border}`, 
              borderRadius: T.radiusMd, 
              fontSize: 14, 
              fontFamily: T.font, 
              color: T.textDark, 
              width: "100%", 
              backgroundColor: T.rowBg,
              outline: "none",
              transition: "all 0.2s"
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.backgroundColor = T.cardBg; e.currentTarget.style.boxShadow = `0 0 0 4px ${T.blue}15`; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.backgroundColor = T.rowBg; e.currentTarget.style.boxShadow = "none"; }}
          />
          {search && (
            <button 
              onClick={() => onSearchChange("")}
              style={{ 
                position: "absolute", 
                right: 12, 
                top: "50%", 
                transform: "translateY(-50%)", 
                background: "none", 
                border: "none", 
                cursor: "pointer", 
                color: T.textMuted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 4,
                borderRadius: "50%",
                transition: "background-color 0.2s",
                zIndex: 2
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}
        </div>
        
        {/* Right side filters */}
        {filters && (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {filters}
          </div>
        )}
      </div>
      )}

      {/* Active Filter Chips Row */}
      {!noHeader && activeFilters && (
        <div style={{ 
          padding: "10px 20px", 
          backgroundColor: T.sidebarBg, 
          borderBottom: `1px solid ${T.border}`, 
          display: "flex", 
          flexWrap: "wrap", 
          gap: 8, 
          alignItems: "center",
          flexShrink: 0
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginRight: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Active Filters:</span>
          {activeFilters}
        </div>
      )}

      {/* Grid Content (Table) */}
      <div style={{ flex: 1, overflowX: "auto", overflowY: "visible" }}>
        {children}
      </div>

      {/* Footer (Pagination) */}
      {pagination && (
        <div style={{ flexShrink: 0, borderRadius: `0 0 ${T.radiusXl}px ${T.radiusXl}px`, overflow: "hidden" }}>
          {pagination}
        </div>
      )}
    </div>
  );
}

export function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      gap: 6, 
      backgroundColor: T.cardBg, 
      border: `1px solid ${T.border}`, 
      borderRadius: 100, 
      padding: "4px 4px 4px 12px", 
      boxShadow: "0 1px 2px rgba(0,0,0,0.02)" 
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.textMid }}>{label}</span>
      <button 
        onClick={onClear}
        style={{ 
          width: 20, 
          height: 20, 
          borderRadius: "50%", 
          border: "none", 
          backgroundColor: T.rowBg, 
          color: T.textMuted, 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          cursor: "pointer",
          transition: "all 0.15s"
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = T.danger + "15"; (e.currentTarget as HTMLElement).style.color = T.danger; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; (e.currentTarget as HTMLElement).style.color = T.textMuted; }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  );
}
