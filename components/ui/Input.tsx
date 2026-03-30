"use client";

import React, { useState } from "react";

type InputState = "inactive" | "active" | "disabled" | "error";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
    label?: string;
    state?: InputState;
    errorMessage?: string;
    hint?: string;
    rightIcon?: React.ReactNode;
    leftIcon?: React.ReactNode;
}

export function Input({
    label,
    state = "inactive",
    errorMessage,
    hint,
    rightIcon,
    leftIcon,
    style,
    onFocus,
    onBlur,
    ...props
}: InputProps) {
    const [focused, setFocused] = useState(false);

    const isActive = state === "active" || focused;
    const isError = state === "error";
    const isDisabled = state === "disabled";

    const containerStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: "column",
        gap: 6,
        opacity: isDisabled ? 0.6 : 1,
        fontFamily: "'Nunito Sans', sans-serif",
    };

    const labelStyle: React.CSSProperties = {
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: isError ? "#3b5229" : isActive ? "#638b4b" : "#6b7a5f",
        textTransform: "uppercase",
        transition: "color 0.15s",
    };

    const wrapStyle: React.CSSProperties = {
        position: "relative",
        display: "flex",
        alignItems: "center",
    };

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: leftIcon ? "11px 16px 11px 42px" : rightIcon ? "11px 42px 11px 16px" : "11px 16px",
        border: `1.5px solid ${isError ? "#3b5229" : isActive ? "#638b4b" : "#c8d4bb"
            }`,
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 400,
        color: isDisabled ? "#6b7a5f" : "#2e3429",
        backgroundColor: "white",
        fontFamily: "'Nunito Sans', sans-serif",
        outline: "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: isActive
            ? "0 0 0 3px rgba(99,139,75,0.12)"
            : isError
                ? "0 0 0 3px rgba(239,68,68,0.1)"
                : "none",
        ...style,
    };

    return (
        <div style={containerStyle}>
            {label && <label style={labelStyle}>{label}</label>}
            <div style={wrapStyle}>
                {leftIcon && (
                    <span style={{ position: "absolute", left: 14, color: "#6b7a5f", display: "flex" }}>
                        {leftIcon}
                    </span>
                )}
                <input
                    {...props}
                    disabled={isDisabled}
                    style={inputStyle}
                    onFocus={(e) => { setFocused(true); onFocus?.(e); }}
                    onBlur={(e) => { setFocused(false); onBlur?.(e); }}
                />
                {rightIcon && (
                    <span style={{ position: "absolute", right: 14, color: "#6b7a5f", display: "flex" }}>
                        {rightIcon}
                    </span>
                )}
            </div>
            {isError && errorMessage && (
                <span style={{ fontSize: 12, color: "#3b5229", fontWeight: 600 }}>
                    {errorMessage}
                </span>
            )}
            {hint && !isError && (
                <span style={{ fontSize: 12, color: "#6b7a5f" }}>{hint}</span>
            )}
        </div>
    );
}
