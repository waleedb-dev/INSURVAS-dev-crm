"use client";

import React from "react";
import { IconCheck } from "@tabler/icons-react";

interface CheckboxProps {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
    indeterminate?: boolean;
}

export function Checkbox({ checked = false, onChange, label, disabled, indeterminate }: CheckboxProps) {
    return (
        <label
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                userSelect: "none",
                fontFamily: "'Nunito Sans', sans-serif",
            }}
        >
            <div
                onClick={() => !disabled && onChange?.(!checked)}
                style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    border: checked || indeterminate ? "none" : "2px solid #d1d5db",
                    backgroundColor: checked || indeterminate ? "#638b4b" : "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                    flexShrink: 0,
                    boxShadow: checked ? "0 2px 8px rgba(99,139,75,0.25)" : "none",
                }}
            >
                {checked && <IconCheck size={11} color="white" strokeWidth={3} />}
                {indeterminate && !checked && (
                    <div style={{ width: 8, height: 2, backgroundColor: "white", borderRadius: 1 }} />
                )}
            </div>
            {label && (
                <span style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>{label}</span>
            )}
        </label>
    );
}


interface RadioProps {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
    name?: string;
}

export function Radio({ checked = false, onChange, label, disabled }: RadioProps) {
    return (
        <label
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                userSelect: "none",
                fontFamily: "'Nunito Sans', sans-serif",
            }}
        >
            <div
                onClick={() => !disabled && onChange?.(!checked)}
                style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: checked ? "5px solid #638b4b" : "2px solid #d1d5db",
                    backgroundColor: "white",
                    transition: "all 0.15s",
                    flexShrink: 0,
                    boxShadow: checked ? "0 2px 8px rgba(99,139,75,0.25)" : "none",
                }}
            />
            {label && (
                <span style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>{label}</span>
            )}
        </label>
    );
}


interface SwitchProps {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
}

export function Switch({ checked = false, onChange, label, disabled }: SwitchProps) {
    return (
        <label
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                userSelect: "none",
                fontFamily: "'Nunito Sans', sans-serif",
            }}
        >
            <div
                onClick={() => !disabled && onChange?.(!checked)}
                style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: checked ? "#638b4b" : "#d1d5db",
                    position: "relative",
                    transition: "background-color 0.2s",
                    flexShrink: 0,
                    boxShadow: checked ? "0 2px 8px rgba(99,139,75,0.3)" : "none",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        top: 3,
                        left: checked ? 21 : 3,
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        backgroundColor: "white",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                />
            </div>
            {label && (
                <span style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>{label}</span>
            )}
        </label>
    );
}


interface SegmentOption { label: string; value: string; }
interface SegmentedControlProps {
    options: SegmentOption[];
    value: string;
    onChange: (v: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
    return (
        <div
            style={{
                display: "inline-flex",
                backgroundColor: "#eef2f7",
                borderRadius: 10,
                padding: 4,
                gap: 2,
                fontFamily: "'Nunito Sans', sans-serif",
            }}
        >
            {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        style={{
                            padding: "7px 16px",
                            borderRadius: 8,
                            border: "none",
                            backgroundColor: isSelected ? "#638b4b" : "transparent",
                            color: isSelected ? "white" : "#6b7280",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            transition: "all 0.15s",
                            boxShadow: isSelected ? "0 2px 8px rgba(99,139,75,0.25)" : "none",
                        }}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
