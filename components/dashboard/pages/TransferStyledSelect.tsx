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
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(val) => onValueChange(val || "")} disabled={disabled}>
      <SelectTrigger
        style={{
          width: "100%",
          height: 42,
          borderRadius: 10,
          border: `1.5px solid ${error ? "#dc2626" : T.border}`,
          backgroundColor: disabled ? T.pageBg : "#fff",
          color: value ? T.textDark : T.textMuted,
          fontSize: 14,
          fontWeight: 600,
          paddingLeft: 14,
          paddingRight: 12,
          transition: "all 0.15s ease-in-out",
          boxShadow: error ? "0 0 0 3px rgba(220, 38, 38, 0.1)" : "none",
        }}
        className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
      >
        <SelectValue placeholder={placeholder}>
          {value ? options.find((o) => o.value === value)?.label || value : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        style={{
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          backgroundColor: "#fff",
          padding: 6,
          maxHeight: 300,
          zIndex: 99999,
        }}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            style={{
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 400,
              color: T.textDark,
              cursor: "pointer",
              transition: "all 0.1s ease-in-out",
            }}
            className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold"
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
