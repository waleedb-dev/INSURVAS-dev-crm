"use client";

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Children } from "react";
import { SelectInput } from "@/components/dashboard/pages/daily-deal-flow/ui-primitives";

type AppSelectProps = {
  value: string;
  onChange: (event: any) => void;
  children: ReactNode;
  style?: CSSProperties;
  disabled?: boolean;
  multiple?: boolean;
};

function isOptionElement(child: ReactNode): child is ReactElement {
  return Boolean(child) && typeof child === "object" && "type" in (child as object) && (child as ReactElement).type === "option";
}

function extractOptions(children: ReactNode): { value: string; label: string }[] {
  return Children.toArray(children)
    .filter(isOptionElement)
    .map((optionEl) => {
      const rawValue = optionEl.props.value;
      const label = typeof optionEl.props.children === "string" ? optionEl.props.children : String(optionEl.props.children ?? "");
      return { value: String(rawValue ?? ""), label };
    });
}

export function AppSelect({ value, onChange, children, style, disabled, multiple = false }: AppSelectProps) {
  const options = extractOptions(children);

  return (
    <SelectInput
      value={value}
      onChange={(next) => {
        const nextValue = Array.isArray(next) ? String(next[0] ?? "") : String(next);
        // Keep compatibility with existing native-select handlers.
        onChange({ target: { value: nextValue } });
      }}
      options={options}
      style={style}
      disabled={disabled}
      multiple={multiple}
    />
  );
}

