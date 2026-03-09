"use client";

import React from "react";

type BadgeVariant =
    | "todo"
    | "in-progress"
    | "in-review"
    | "done"
    | "approved"
    | "pending"
    | "junior"
    | "middle"
    | "senior"
    | "sick-leave"
    | "vacation"
    | "work-remotely"
    | "custom";

interface BadgeProps {
    variant?: BadgeVariant;
    label?: string;
    dot?: boolean;
    color?: string;
    bgColor?: string;
}

const VARIANT_MAP: Record<BadgeVariant, { label: string; color: string; bg: string }> = {
    "todo": { label: "To Do", color: "#6b7280", bg: "#f3f4f6" },
    "in-progress": { label: "In Progress", color: "#4285f4", bg: "#EEF4FF" },
    "in-review": { label: "In Review", color: "#7c3aed", bg: "#f5f3ff" },
    "done": { label: "Done", color: "#059669", bg: "#ecfdf5" },
    "approved": { label: "Approved", color: "#059669", bg: "#ecfdf5" },
    "pending": { label: "Pending", color: "#d97706", bg: "#fffbeb" },
    "junior": { label: "Junior", color: "#059669", bg: "#ecfdf5" },
    "middle": { label: "Middle", color: "#4285f4", bg: "#EEF4FF" },
    "senior": { label: "Senior", color: "#7c3aed", bg: "#f5f3ff" },
    "sick-leave": { label: "Sick Leave", color: "#6b7280", bg: "#f3f4f6" },
    "vacation": { label: "Vacation", color: "#4285f4", bg: "#EEF4FF" },
    "work-remotely": { label: "Work Remotely", color: "#0891b2", bg: "#ecfeff" },
    "custom": { label: "", color: "#374151", bg: "#f3f4f6" },
};

export function Badge({ variant = "custom", label, dot = false, color, bgColor }: BadgeProps) {
    const preset = VARIANT_MAP[variant];
    const finalColor = color ?? preset.color;
    const finalBg = bgColor ?? preset.bg;
    const finalLabel = label ?? preset.label;

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: dot ? 6 : 0,
                padding: "3px 10px",
                borderRadius: 20,
                backgroundColor: finalBg,
                color: finalColor,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "'Nunito Sans', sans-serif",
                whiteSpace: "nowrap",
                lineHeight: 1.8,
            }}
        >
            {dot && (
                <span
                    style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: finalColor,
                        flexShrink: 0,
                    }}
                />
            )}
            {finalLabel}
        </span>
    );
}


// ─── Progress Spinner ────────────────────────────────────────────────────────
interface ProgressProps {
    value?: number; // 0–100
    size?: number;
    strokeWidth?: number;
    color?: string;
}

export function ProgressSpinner({
    value = 65,
    size = 52,
    strokeWidth = 5,
    color = "#4285f4",
}: ProgressProps) {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (value / 100) * circ;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Track */}
            <circle
                cx={size / 2} cy={size / 2} r={r}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={strokeWidth}
            />
            {/* Progress */}
            <circle
                cx={size / 2} cy={size / 2} r={r}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 0.4s" }}
            />
        </svg>
    );
}


// ─── Avatar ──────────────────────────────────────────────────────────────────
interface AvatarProps {
    src?: string;
    name?: string;
    size?: number;
    style?: React.CSSProperties;
}

function stringToColor(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const colors = ["#4285f4", "#34a853", "#ea4335", "#fbbc05", "#7c3aed", "#0891b2"];
    return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ src, name = "?", size = 36, style }: AvatarProps) {
    const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                backgroundColor: src ? undefined : stringToColor(name),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0,
                fontFamily: "'Nunito Sans', sans-serif",
                fontSize: size * 0.37,
                fontWeight: 700,
                color: "white",
                ...style,
            }}
        >
            {src ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
        </div>
    );
}
