"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { T } from "@/lib/theme";

export function FieldLabel({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: T.textMuted,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

import { Button } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

export function SelectInput({
  value,
  onChange,
  options,
  style,
  multiple = false,
  disabled = false,
}: {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  options: { value: string; label: string }[];
  style?: CSSProperties;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const selectedLabel = useMemo(() => {
    if (multiple) {
      const selectedValues = Array.isArray(value) ? value : [];
      if (selectedValues.length === 0) {
        return options[0]?.label ?? "All";
      }
      if (selectedValues.length === 1) {
        return (
          options.find((option) => option.value === selectedValues[0])?.label ??
          selectedValues[0]
        );
      }
      const firstLabel =
        options.find((option) => option.value === selectedValues[0])?.label ??
        selectedValues[0];
      return `${firstLabel} +${selectedValues.length - 1}`;
    }

    const selectedValue = Array.isArray(value) ? value[0] : value;
    return (
      options.find((option) => option.value === selectedValue)?.label ??
      options[0]?.label ??
      "Select"
    );
  }, [multiple, options, value]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="flex items-center justify-between w-full h-[38px] px-3 text-[13px] border font-[600] rounded-[8px] shadow-sm bg-[var(--cardBg,#ffffff)] border-[var(--border,#c8d4bb)] text-[var(--textDark,#1c201a)] hover:bg-[var(--pageBg,#f4f7f1)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        style={style}
      >
        <span className="truncate">{selectedLabel}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 shrink-0 text-[var(--textMuted,#7b8a6a)]">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-[220px] max-h-[300px] overflow-y-auto !p-0 !rounded-xl !border-[var(--border,#c8d4bb)] bg-[var(--cardBg,#ffffff)] shadow-lg overflow-hidden">
        {multiple ? (
          <DropdownMenuGroup>
            <DropdownMenuCheckboxItem
              checked={Array.isArray(value) && value.length === 0}
              onCheckedChange={() => onChange([])}
              className="!rounded-none !py-2.5 !pl-4 !pr-10 text-[13.5px] !font-medium text-[var(--textDark,#1c201a)] focus:!bg-[var(--blue,#638b4b)] focus:!text-white !cursor-pointer transition-colors"
            >
              {options[0]?.label ?? "All"}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator className="!m-0 bg-[var(--borderLight,#ddecd4)]" />
            {options.slice(1).map((option) => {
              const checked = Array.isArray(value) && value.includes(option.value);
              return (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={checked}
                  onCheckedChange={(nextChecked) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    if (nextChecked) {
                      onChange([...currentValues, option.value]);
                    } else {
                      onChange(currentValues.filter((entry) => entry !== option.value));
                    }
                  }}
                  className="!rounded-none !py-2.5 !pl-4 !pr-10 text-[13.5px] !font-medium text-[var(--textDark,#1c201a)] focus:!bg-[var(--blue,#638b4b)] focus:!text-white !cursor-pointer transition-colors"
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuGroup>
        ) : (
          <DropdownMenuGroup>
            <DropdownMenuRadioGroup
              value={Array.isArray(value) ? value[0] : (value as string)}
              onValueChange={(nextValue) => onChange(nextValue)}
            >
              {options.map((option) => (
                <DropdownMenuRadioItem 
                  key={option.value} 
                  value={option.value}
                  className="!rounded-none !py-2.5 !pl-4 !pr-10 text-[13.5px] !font-medium text-[var(--textDark,#1c201a)] focus:!bg-[var(--blue,#638b4b)] focus:!text-white !cursor-pointer transition-colors"
                >
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  width = 980,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,32,26,0.45)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: width,
          maxHeight: "90vh",
          overflow: "auto",
          background: T.cardBg,
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          boxShadow: T.shadowMd,
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              color: T.textDark,
            }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 20,
              cursor: "pointer",
              color: T.textMuted,
            }}
          >
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
