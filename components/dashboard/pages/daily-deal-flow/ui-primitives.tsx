"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export function SelectInput({
  value,
  onChange,
  options,
  style,
  multiple = false,
}: {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  options: { value: string; label: string }[];
  style?: CSSProperties;
  multiple?: boolean;
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

  const triggerStyle: CSSProperties = {
    width: "100%",
    minHeight: 38,
    border: "1px solid #c9d7bc",
    borderRadius: 12,
    fontSize: 13,
    color: T.textDark,
    padding: "9px 12px",
    background: "#fcfdf9",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    textAlign: "left",
    boxShadow: "0 1px 2px rgba(28,32,26,0.05)",
    transition: "border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease",
    ...style,
  };

  const contentStyle =
    "w-(--anchor-width) min-w-[240px] rounded-2xl border border-[#d5e0cb] bg-[#fcfdf9] p-2 shadow-[0_18px_40px_rgba(28,32,26,0.14)]";
  const itemBaseClass =
    "min-h-0 rounded-xl px-3 py-2.5 text-[13px] font-medium text-[#233021] outline-none focus:bg-[#edf4e5] focus:text-[#233021] data-[highlighted]:bg-[#edf4e5] data-[highlighted]:text-[#233021]";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger style={triggerStyle}>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            fontWeight: 600,
          }}
        >
          {selectedLabel}
        </span>
        <span style={{ color: "#6b7a5f", fontSize: 11, flexShrink: 0 }}>
          &#9662;
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className={contentStyle}>
        {multiple ? (
          <DropdownMenuGroup>
            <div className="max-h-72 overflow-y-auto">
              <DropdownMenuCheckboxItem
                checked={Array.isArray(value) && value.length === 0}
                className={`${itemBaseClass} mb-1 bg-[#dfead2] font-semibold text-[#638b4b]`}
                onCheckedChange={() => onChange([])}
              >
                {options[0]?.label ?? "All"}
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator className="mx-1 my-2 bg-[#e3eadb]" />
              {options.slice(1).map((option) => {
                const checked = Array.isArray(value) && value.includes(option.value);
                return (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={checked}
                    className={`${itemBaseClass} mb-1 ${checked ? "bg-[#edf4e5] font-semibold" : ""}`}
                    onCheckedChange={(nextChecked) => {
                      const currentValues = Array.isArray(value) ? value : [];
                      if (nextChecked) {
                        onChange([...currentValues, option.value]);
                        return;
                      }

                      onChange(
                        currentValues.filter((entry) => entry !== option.value),
                      );
                    }}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </div>
          </DropdownMenuGroup>
        ) : (
          <DropdownMenuGroup>
            <DropdownMenuRadioGroup
              value={Array.isArray(value) ? value[0] : value}
              onValueChange={(nextValue) => onChange(nextValue)}
            >
              <div>
                {options.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                    className={`${itemBaseClass} mb-1 ${
                      (Array.isArray(value) ? value[0] : value) === option.value
                        ? "bg-[#edf4e5] font-semibold text-[#638b4b]"
                        : ""
                    }`}
                  >
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </div>
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
