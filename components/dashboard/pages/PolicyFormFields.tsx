"use client";

import type { CSSProperties } from "react";
import { T } from "@/lib/theme";
import { AppSelect } from "@/components/ui/app-select";
import { POLICY_FORM_SECTIONS } from "@/lib/policy-schema";
import { POLICY_DB_SELECT_FIELD_KEYS, dbSelectOptions } from "@/lib/policy-form-utils";

const defaultLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: T.textMuted,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  marginBottom: 6,
  display: "block",
};

const defaultInputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1.5px solid ${T.border}`,
  fontSize: 14,
  fontFamily: T.font,
  color: T.textDark,
  backgroundColor: "#fff",
  outline: "none",
};

export type PolicyFormFieldsProps = {
  draft: Record<string, string>;
  onChange: (key: string, value: string) => void;
  callCenterNames: string[];
  carrierNames: string[];
  stageNames: string[];
  lookupReady: boolean;
  labelStyle?: CSSProperties;
  inputStyle?: CSSProperties;
  sectionTitleStyle?: CSSProperties;
  gridGap?: number;
  sectionMarginBottom?: number;
};

export default function PolicyFormFields({
  draft,
  onChange,
  callCenterNames,
  carrierNames,
  stageNames,
  lookupReady,
  labelStyle = defaultLabelStyle,
  inputStyle = defaultInputStyle,
  sectionTitleStyle,
  gridGap = 14,
  sectionMarginBottom = 22,
}: PolicyFormFieldsProps) {
  const patch = onChange;
  const titleStyle: CSSProperties =
    sectionTitleStyle ?? {
      fontSize: 11,
      fontWeight: 800,
      color: T.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      margin: "0 0 12px",
    };

  if (!lookupReady) {
    return <p style={{ margin: 0, fontSize: 14, color: T.textMuted, fontWeight: 600 }}>Loading options…</p>;
  }

  return (
    <>
      {POLICY_FORM_SECTIONS.map((section) => (
        <div key={section.title} style={{ marginBottom: sectionMarginBottom }}>
          <h3 style={titleStyle}>{section.title}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: gridGap }}>
            {section.fields.map((field) => {
              const colStyle = field.wide ? { gridColumn: "1 / -1" as const } : undefined;
              const val = draft[field.key] ?? "";

              if (POLICY_DB_SELECT_FIELD_KEYS.has(field.key)) {
                const options = dbSelectOptions(field.key, val, callCenterNames, carrierNames, stageNames);
                return (
                  <div key={field.key} style={colStyle}>
                    <label style={labelStyle}>{field.label}</label>
                    <AppSelect
                      value={val}
                      onChange={(e) => patch(field.key, e.target.value)}
                      style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                    >
                      <option value="">Select…</option>
                      {options.map((name) => (
                        <option key={`${field.key}-${name}`} value={name}>
                          {name}
                        </option>
                      ))}
                    </AppSelect>
                  </div>
                );
              }

              if (field.kind === "bool") {
                return (
                  <div key={field.key} style={colStyle}>
                    <label style={labelStyle}>{field.label}</label>
                    <select value={val} onChange={(e) => patch(field.key, e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                      <option value="">—</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                );
              }

              if (field.multiline) {
                return (
                  <div key={field.key} style={colStyle}>
                    <label style={labelStyle}>{field.label}</label>
                    <textarea
                      value={val}
                      onChange={(e) => patch(field.key, e.target.value)}
                      rows={4}
                      style={{ ...inputStyle, resize: "vertical", minHeight: 88 }}
                    />
                  </div>
                );
              }

              if (field.kind === "ts") {
                return (
                  <div key={field.key} style={colStyle}>
                    <label style={labelStyle}>{field.label}</label>
                    <input type="datetime-local" value={val} onChange={(e) => patch(field.key, e.target.value)} style={inputStyle} />
                  </div>
                );
              }

              if (field.kind === "num") {
                return (
                  <div key={field.key} style={colStyle}>
                    <label style={labelStyle}>{field.label}</label>
                    <input type="number" step="any" value={val} onChange={(e) => patch(field.key, e.target.value)} style={inputStyle} />
                  </div>
                );
              }

              return (
                <div key={field.key} style={colStyle}>
                  <label style={labelStyle}>{field.label}</label>
                  <input type="text" value={val} onChange={(e) => patch(field.key, e.target.value)} style={inputStyle} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
