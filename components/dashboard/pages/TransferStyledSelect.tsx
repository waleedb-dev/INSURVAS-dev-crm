"use client";

import { T } from "@/lib/theme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Dropdown styling shared with `TransferLeadApplicationForm` (and claim modal pattern):
 * 42px trigger, 10px radius, Insurvas borders, green hover/focus ring on menu items.
 */
export function TransferStyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled = false,
  error = false,
  compact = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  compact?: boolean;
}) {
  const height = compact ? 32 : 42;
  const fontSize = compact ? 12 : 14;
  const borderRadius = compact ? 8 : 11;
  const paddingLeft = compact ? 10 : 14;

  return (
    <Select value={value} onValueChange={(val) => onValueChange(val || "")} disabled={disabled}>
      <SelectTrigger
        style={{
          width: "100%",
          height,
          borderRadius,
          border: error ? "1.5px solid #dc2626" : `1px solid ${T.borderLight}`,
          backgroundColor: disabled ? T.blueFaint : "#fff",
          color: value ? T.textDark : T.textMuted,
          fontSize,
          fontWeight: 600,
          paddingLeft,
          paddingRight: 12,
          transition: "all 0.15s ease-in-out",
          boxShadow: error
            ? "0 0 0 3px rgba(220, 38, 38, 0.1)"
            : compact ? "none" : `${T.shadowSm}, inset 0 1px 0 rgba(255,255,255,0.65)`,
        }}
        className={compact
          ? "hover:border-[#638b4b] focus:border-[#638b4b] focus:ring-1 focus:ring-[#638b4b]/20"
          : "transition-all duration-150 ease-in-out hover:border-[#c8d4bb] hover:shadow-md focus:border-[#94c278] focus:ring-2 focus:ring-[#94c278]/25 data-[state=open]:border-[#94c278] data-[state=open]:shadow-md"
        }
      >
        <SelectValue placeholder={placeholder}>
          {value ? options.find((o) => o.value === value)?.label || value : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        style={{
          borderRadius: compact ? 10 : 12,
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          backgroundColor: "#fff",
          padding: compact ? 4 : 6,
          maxHeight: compact ? 200 : 300,
          zIndex: 99999,
        }}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            style={{
              borderRadius: compact ? 6 : 8,
              padding: compact ? "6px 10px" : "10px 14px",
              fontSize,
              fontWeight: 400,
              color: T.textDark,
              cursor: "pointer",
              transition: "all 0.1s ease-in-out",
            }}
            className={compact
              ? "hover:bg-[#f2f8ee] focus:bg-[#f2f8ee]"
              : "hover:bg-[#ddecd4] hover:text-[#3b5229] focus:bg-[#ddecd4] focus:text-[#3b5229] data-[state=checked]:bg-[#638b4b] data-[state=checked]:text-white data-[state=checked]:font-semibold"
            }
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Label style used next to transfer form selects (e.g. application form `labelStyle`). */
export const transferSelectLabelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: "#1f2937",
  marginBottom: 6,
  display: "block" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.4px",
};

/** Base input/textarea style from `TransferLeadApplicationForm` `fieldStyle`. */
export const transferFieldStyle = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 8,
  border: `1.5px solid ${T.border}`,
  fontSize: 14,
  color: T.textDark,
  outline: "none",
  fontFamily: T.font,
  backgroundColor: "#fff",
  transition: "border-color 0.15s, box-shadow 0.15s",
  boxSizing: "border-box" as const,
};

/** Read-only row aligned with `TransferStyledSelect` trigger (42px height). */
export const transferReadonlyFieldStyle = {
  width: "100%",
  minHeight: 42,
  borderRadius: 10,
  border: `1.5px solid ${T.border}`,
  backgroundColor: T.cardBg,
  color: T.textDark,
  fontSize: 14,
  fontWeight: 600,
  paddingLeft: 14,
  paddingRight: 12,
  display: "flex",
  alignItems: "center",
  boxSizing: "border-box" as const,
} as const;
