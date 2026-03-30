"use client";

import React, { useState, useRef, useEffect } from "react";
import { IconChevronDown, IconCheck } from "@tabler/icons-react";

interface DropdownOption {
    label: string;
    value: string;
}

interface DropdownProps {
    options: DropdownOption[];
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    avatar?: string;
    avatarLabel?: string;
    disabled?: boolean;
    style?: React.CSSProperties;
}

export function Dropdown({
    options,
    value,
    onChange,
    placeholder = "Select...",
    avatar,
    avatarLabel,
    disabled,
    style,
}: DropdownProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const selected = options.find((o) => o.value === value);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const triggerStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 14px",
        border: `1.5px solid ${open ? "#638b4b" : "#e5e7eb"}`,
        borderRadius: 10,
        backgroundColor: "white",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Nunito Sans', sans-serif",
        fontSize: 14,
        fontWeight: 600,
        color: disabled ? "#9ca3af" : "#374151",
        outline: "none",
        minWidth: 160,
        justifyContent: "space-between",
        userSelect: "none",
        boxShadow: open ? "0 0 0 3px rgba(99,139,75,0.12)" : "none",
        transition: "all 0.15s",
        opacity: disabled ? 0.6 : 1,
        ...style,
    };

    const menuStyle: React.CSSProperties = {
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        minWidth: "100%",
        backgroundColor: "white",
        border: "1.5px solid #e5e7eb",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
        zIndex: 100,
        overflow: "hidden",
        animation: "fadeIn 0.12s ease",
    };

    return (
        <div style={{ position: "relative", display: "inline-block" }} ref={ref}>
            <div
                style={triggerStyle}
                onClick={() => !disabled && setOpen(!open)}
                role="button"
                aria-expanded={open}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && !disabled && setOpen(!open)}
            >
                {/* Avatar variant */}
                {avatar && (
                    <img
                        src={avatar}
                        alt={avatarLabel}
                        style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }}
                    />
                )}
                <span style={{ flex: 1 }}>{selected?.label ?? avatarLabel ?? placeholder}</span>
                <IconChevronDown
                    size={16}
                    style={{
                        color: "#6b7280",
                        transition: "transform 0.2s",
                        transform: open ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                />
            </div>

            {open && (
                <div style={menuStyle}>
                    {options.map((opt) => {
                        const isSelected = opt.value === value;
                        return (
                            <div
                                key={opt.value}
                                onClick={() => { onChange?.(opt.value); setOpen(false); }}
                                style={{
                                    padding: "10px 16px",
                                    fontSize: 14,
                                    fontWeight: isSelected ? 700 : 500,
                                    color: isSelected ? "#638b4b" : "#374151",
                                    backgroundColor: isSelected ? "#EEF4FF" : "transparent",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    transition: "background 0.1s",
                                    fontFamily: "'Nunito Sans', sans-serif",
                                }}
                                onMouseEnter={(e) => {
                                    if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = "#f9fafb";
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLDivElement).style.backgroundColor = isSelected ? "#EEF4FF" : "transparent";
                                }}
                            >
                                {opt.label}
                                {isSelected && <IconCheck size={14} />}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
