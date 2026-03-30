"use client";

import React from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { T } from "@/lib/theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "link" | "icon";
type ButtonSize = "sm" | "md" | "lg";
type ButtonState = "enabled" | "hover" | "pressed" | "disabled" | "loading";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    state?: ButtonState;
    icon?: React.ReactNode;
    iconPosition?: "left" | "right";
    children?: React.ReactNode;
    fullWidth?: boolean;
}

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
    sm: { padding: "7px 14px", fontSize: 12, gap: 6 },
    md: { padding: "10px 20px", fontSize: 14, gap: 8 },
    lg: { padding: "13px 28px", fontSize: 15, gap: 10 },
};

export function Button({
    variant = "primary",
    size = "md",
    state = "enabled",
    icon,
    iconPosition = "left",
    children,
    fullWidth,
    style,
    ...props
}: ButtonProps) {
    const isDisabled = state === "disabled" || props.disabled;
    const isLoading = state === "loading";

    const base: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: T.font,
        fontWeight: 700,
        borderRadius: 10,
        border: "none",
        cursor: isDisabled ? "not-allowed" : "pointer",
        transition: "all 0.15s ease",
        width: fullWidth ? "100%" : undefined,
        outline: "none",
        ...sizeStyles[size],
    };

    const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
        primary: {
            backgroundColor:
                state === "pressed"
                    ? T.blueHover
                    : state === "hover"
                        ? T.blueHover
                        : isDisabled
                            ? T.border
                            : T.blue,
            color: isDisabled ? "rgba(255,255,255,0.7)" : "white",
            boxShadow: isDisabled
                ? "none"
                    : state === "pressed"
                    ? "inset 0 2px 6px rgba(0,0,0,0.15)"
                    : "0 4px 12px rgba(99,139,75,0.3)",
        },
        secondary: {
            backgroundColor:
                state === "pressed"
                    ? T.blueLight
                    : state === "hover"
                        ? T.blueFaint
                        : isDisabled
                            ? T.pageBg
                            : T.cardBg,
            color: isDisabled ? T.textMuted : T.blue,
            border: `1.5px solid ${isDisabled ? T.border : state === "pressed" ? T.blueLight : T.blue}`,
        },
        ghost: {
            backgroundColor:
                state === "pressed"
                    ? T.blueLight
                    : state === "hover"
                        ? T.blueFaint
                        : isDisabled
                            ? T.pageBg
                            : "transparent",
            color: isDisabled ? T.textMuted : T.textMid,
            border: `1.5px solid ${T.border}`,
        },
        icon: {
            backgroundColor:
                state === "pressed"
                    ? T.blueHover
                    : state === "hover"
                        ? T.blueHover
                        : isDisabled
                            ? T.border
                            : T.blue,
            color: "white",
            padding: size === "sm" ? 7 : size === "lg" ? 12 : 10,
            borderRadius: 10,
            boxShadow: isDisabled ? "none" : "0 4px 12px rgba(99,139,75,0.3)",
        },
        link: {
            backgroundColor: "transparent",
            color: isDisabled ? T.textMuted : state === "pressed" ? T.blueHover : T.blue,
            padding: 0,
            borderRadius: 0,
            gap: 4,
            fontWeight: 600,
        },
    };

    return (
        <button
            {...props}
            disabled={isDisabled || isLoading}
            style={{ ...base, ...variantStyles[variant], ...style }}
        >
            {isLoading ? (
                <IconLoader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
                <>
                    {icon && iconPosition === "left" && icon}
                    {children}
                    {icon && iconPosition === "right" && icon}
                </>
            )}
        </button>
    );
}
