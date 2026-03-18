"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { T } from "@/lib/theme";

interface ActionMenuItem {
  label: string;
  onClick?: () => void;
  danger?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  /** id used to track which menu is open from the parent */
  id: string;
  activeId: string | null;
  onToggle: (id: string | null) => void;
}

export function ActionMenu({ items, id, activeId, onToggle }: ActionMenuProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const isOpen = activeId === id;

  // Calculate fixed position when opening
  useEffect(() => {
    if (isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({
        // open upward: position bottom of dropdown at top of button
        top: rect.top + window.scrollY - 4,   // we'll transform it upward via transform
        left: rect.right + window.scrollX,    // right-aligned to button right edge
      });
    }
  }, [isOpen]);

  // Close on outside click or scroll
  useEffect(() => {
    if (!isOpen) return;
    const close = () => onToggle(null);
    document.addEventListener("mousedown", close, true);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close, true);
      document.removeEventListener("scroll", close, true);
    };
  }, [isOpen, onToggle]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(isOpen ? null : id);
        }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: T.textMuted,
          padding: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          transition: "background-color 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = T.rowBg; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {isOpen && coords && typeof document !== "undefined" && createPortal(
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: coords.top,
            left: coords.left,
            transform: "translate(-100%, -100%)",
            width: 160,
            backgroundColor: "#fff",
            borderRadius: T.radiusMd,
            boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
            border: `1.5px solid ${T.border}`,
            zIndex: 99999,
            overflow: "hidden",
          }}
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { item.onClick?.(); onToggle(null); }}
              style={{
                display: "block",
                width: "100%",
                padding: "10px 16px",
                border: "none",
                background: "none",
                cursor: item.onClick ? "pointer" : "default",
                fontFamily: T.font,
                fontSize: 13,
                fontWeight: 600,
                color: item.danger ? T.danger : T.textMid,
                textAlign: "left",
                transition: "background-color 0.12s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = item.danger ? "#fef2f2" : T.rowBg;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
