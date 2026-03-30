"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui";
import { T } from "@/lib/theme";
import { ALL_OPTION } from "./constants";
import { FieldLabel, SelectInput } from "./ui-primitives";

type Props = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  dateFilter: string;
  dateFromFilter: string;
  dateToFilter: string;
  onDateFilterChange: (value: string) => void;
  onDateFromFilterChange: (value: string) => void;
  onDateToFilterChange: (value: string) => void;
  bufferAgentFilter: string;
  onBufferAgentFilterChange: (value: string) => void;
  retentionAgentFilter: string[];
  onRetentionAgentFilterChange: (value: string[]) => void;
  licensedAgentFilter: string;
  onLicensedAgentFilterChange: (value: string) => void;
  leadVendorFilter: string;
  onLeadVendorFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  carrierFilter: string;
  onCarrierFilterChange: (value: string) => void;
  callResultFilter: string;
  onCallResultFilterChange: (value: string) => void;
  retentionFilter: string;
  onRetentionFilterChange: (value: string) => void;
  incompleteUpdatesFilter: string;
  onIncompleteUpdatesFilterChange: (value: string) => void;
  laCallbackFilter: string;
  onLaCallbackFilterChange: (value: string) => void;
  hourFromFilter: string;
  hourToFilter: string;
  onHourFromFilterChange: (value: string) => void;
  onHourToFilterChange: (value: string) => void;
  bufferOptions: string[];
  retentionOptions: string[];
  licensedOptions: string[];
  vendorOptions: string[];
  statusOptions: string[];
  carrierOptions: string[];
  callResultOptions: string[];
  laCallbackOptions: string[];
  totalRows: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
};

const hourOptions = Array.from({ length: 24 }, (_, i) => ({ value: String(i), label: `${String(i).padStart(2, "0")}:00` }));

function mapOptions(values: string[]) {
  return [{ value: ALL_OPTION, label: "All" }, ...values.map((v) => ({ value: v, label: v }))];
}

function MultiSelectDropdown({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selectedLabel = useMemo(() => {
    if (value.length === 0) return "All";
    if (value.length === 1) return value[0];
    const [first, ...rest] = value;
    return `${first}${rest.length ? ` +${rest.length}` : ""}`;
  }, [value]);

  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option));
      return;
    }
    onChange([...value, option]);
  };

  const clearAll = () => onChange([]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: "100%",
          height: 36,
          border: `1.5px solid ${T.border}`,
          borderRadius: 8,
          background: "#fff",
          color: T.textDark,
          fontSize: 13,
          textAlign: "left",
          padding: "0 10px",
          cursor: "pointer",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{selectedLabel}</span>
        <span style={{ color: T.textMuted, fontSize: 11, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 0,
            right: 0,
            zIndex: 30,
            background: "#fff",
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            boxShadow: T.shadowMd,
            maxHeight: 220,
            overflowY: "auto",
            padding: 8,
          }}
        >
          <button
            type="button"
            onClick={clearAll}
            style={{
              width: "100%",
              textAlign: "left",
              border: "none",
              background: value.length === 0 ? T.blueLight : "transparent",
              color: value.length === 0 ? T.blue : T.textMid,
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              padding: "6px 8px",
              cursor: "pointer",
              marginBottom: 6,
            }}
          >
            All
          </button>
          {options.map((option) => {
            const checked = value.includes(option);
            return (
              <label
                key={option}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 6,
                  padding: "6px 8px",
                  background: checked ? "#f2f8ee" : "transparent",
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" checked={checked} onChange={() => toggleOption(option)} />
                <span style={{ fontSize: 12, color: T.textDark }}>{option}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

const DATE_INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  height: 36,
  border: `1.5px solid ${T.border}`,
  borderRadius: 8,
  fontSize: 13,
  color: T.textDark,
  padding: "0 8px",
  boxSizing: "border-box",
  background: "#fff",
};

export function DdfToolbar(props: Props) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: "16px 20px",
        boxShadow: T.shadowSm,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* ── Row 1: Search + Date filters ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16, alignItems: "end" }}>
        <div>
          <FieldLabel label="Search" />
          <Input
            value={props.searchTerm}
            onChange={(e) => props.onSearchTermChange(e.currentTarget.value)}
            placeholder="Name, phone, submission id, vendor..."
            style={{ height: 36 }}
          />
        </div>
        <div>
          <FieldLabel label="Single Date" />
          <input type="date" value={props.dateFilter} onChange={(e) => props.onDateFilterChange(e.currentTarget.value)} style={DATE_INPUT_STYLE} />
        </div>
        <div>
          <FieldLabel label="Date From" />
          <input type="date" value={props.dateFromFilter} onChange={(e) => props.onDateFromFilterChange(e.currentTarget.value)} style={DATE_INPUT_STYLE} />
        </div>
        <div>
          <FieldLabel label="Date To" />
          <input type="date" value={props.dateToFilter} onChange={(e) => props.onDateToFilterChange(e.currentTarget.value)} style={DATE_INPUT_STYLE} />
        </div>
      </div>

      {/* ── Row 2: Main agent / vendor / status dropdowns (7 columns) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 16, alignItems: "end" }}>
        <div>
          <FieldLabel label="Buffer Agent" />
          <SelectInput value={props.bufferAgentFilter} onChange={(v) => props.onBufferAgentFilterChange(String(v))} options={mapOptions(props.bufferOptions)} />
        </div>
        <div>
          <FieldLabel label="Retention Agent" />
          <MultiSelectDropdown value={props.retentionAgentFilter} onChange={props.onRetentionAgentFilterChange} options={props.retentionOptions} />
        </div>
        <div>
          <FieldLabel label="Licensed Agent" />
          <SelectInput value={props.licensedAgentFilter} onChange={(v) => props.onLicensedAgentFilterChange(String(v))} options={mapOptions(props.licensedOptions)} />
        </div>
        <div>
          <FieldLabel label="Lead Vendor" />
          <SelectInput value={props.leadVendorFilter} onChange={(v) => props.onLeadVendorFilterChange(String(v))} options={mapOptions(props.vendorOptions)} />
        </div>
        <div>
          <FieldLabel label="Status" />
          <SelectInput value={props.statusFilter} onChange={(v) => props.onStatusFilterChange(String(v))} options={mapOptions(props.statusOptions)} />
        </div>
        <div>
          <FieldLabel label="Carrier" />
          <SelectInput value={props.carrierFilter} onChange={(v) => props.onCarrierFilterChange(String(v))} options={mapOptions(props.carrierOptions)} />
        </div>
        <div>
          <FieldLabel label="Call Result" />
          <SelectInput value={props.callResultFilter} onChange={(v) => props.onCallResultFilterChange(String(v))} options={mapOptions(props.callResultOptions)} />
        </div>
      </div>

      {/* ── Row 3: Secondary filters (left-aligned, not stretched) ── */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 120 }}>
          <FieldLabel label="Retention Type" />
          <SelectInput value={props.retentionFilter} onChange={(v) => props.onRetentionFilterChange(String(v))} options={[{ value: ALL_OPTION, label: "All" }, { value: "Retention", label: "Retention" }, { value: "Regular", label: "Regular" }]} style={{ minWidth: 120 }} />
        </div>
        <div style={{ minWidth: 120 }}>
          <FieldLabel label="Updates" />
          <SelectInput value={props.incompleteUpdatesFilter} onChange={(v) => props.onIncompleteUpdatesFilterChange(String(v))} options={[{ value: ALL_OPTION, label: "All" }, { value: "Incomplete", label: "Incomplete" }, { value: "Complete", label: "Complete" }]} style={{ minWidth: 120 }} />
        </div>
        <div style={{ minWidth: 120 }}>
          <FieldLabel label="LA Callback" />
          <SelectInput value={props.laCallbackFilter} onChange={(v) => props.onLaCallbackFilterChange(String(v))} options={mapOptions(props.laCallbackOptions)} style={{ minWidth: 120 }} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginLeft: 8 }}>
          <div style={{ minWidth: 90 }}>
            <FieldLabel label="Hour From" />
            <SelectInput value={props.hourFromFilter} onChange={(v) => props.onHourFromFilterChange(String(v))} options={[{ value: ALL_OPTION, label: "All" }, ...hourOptions]} style={{ minWidth: 90 }} />
          </div>
          <div style={{ minWidth: 90 }}>
            <FieldLabel label="Hour To" />
            <SelectInput value={props.hourToFilter} onChange={(v) => props.onHourToFilterChange(String(v))} options={[{ value: ALL_OPTION, label: "All" }, ...hourOptions]} style={{ minWidth: 90 }} />
          </div>
        </div>
      </div>

      {/* ── Footer: row count + clear filters ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
          {props.totalRows.toLocaleString()} rows
        </div>
        {props.hasActiveFilters && (
          <button
            type="button"
            onClick={props.onClearFilters}
            style={{ background: "none", border: "none", color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "4px 0" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.textDecoration = "underline")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.textDecoration = "none")}
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
}
