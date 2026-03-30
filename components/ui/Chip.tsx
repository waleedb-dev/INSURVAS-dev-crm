"use client";

import React from "react";
import { IconX } from "@tabler/icons-react";

type ChipVariant = "choice" | "input" | "filter";

interface ChipProps {
    label: string;
    selected?: boolean;
    onToggle?: () => void;
    onRemove?: () => void;
    avatar?: string;
    variant?: ChipVariant;
    disabled?: boolean;
    icon?: React.ReactNode;
}

export function Chip({
    label,
    selected = false,
    onToggle,
    onRemove,
    avatar,
    variant = "choice",
    disabled,
    icon,
}: ChipProps) {
    const isInput = variant === "input";

    const chipStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: isInput || avatar ? "5px 10px 5px 6px" : "5px 14px",
        borderRadius: 20,
        border: `1.5px solid ${selected ? "#638b4b" : "#c8d4bb"}`,
        backgroundColor: selected ? "#f2f8ee" : "white",
        color: selected ? "#638b4b" : "#2e3429",
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        userSelect: "none",
        fontFamily: "'Nunito Sans', sans-serif",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
    };

    return (
        <div style={chipStyle} onClick={() => !disabled && !isInput && onToggle?.()}>
            {/* Avatar */}
            {avatar && (
                <img
                    src={avatar}
                    alt={label}
                    style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }}
                />
            )}
            {/* Icon */}
            {!avatar && icon && <span style={{ display: "flex" }}>{icon}</span>}

            <span>{label}</span>

            {/* Choice chip selection dot */}
            {variant === "choice" && selected && !onRemove && (
                <div
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: "#638b4b",
                        marginLeft: 2,
                    }}
                />
            )}

            {/* Remove button for input chips */}
            {(isInput || onRemove) && (
                <button
                    onClick={(e) => { e.stopPropagation(); !disabled && onRemove?.(); }}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        color: "#6b7a5f",
                        marginLeft: 2,
                    }}
                >
                    <IconX size={13} strokeWidth={2.5} />
                </button>
            )}
        </div>
    );
}
