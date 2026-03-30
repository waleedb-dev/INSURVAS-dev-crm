"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FilterChip, Input } from "@/components/ui";
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
          background: T.cardBg,
          color: T.textMid,
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
            background: T.cardBg,
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
                  background: checked ? T.blueFaint : "transparent",
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
  color: T.textMid,
  padding: "0 8px",
  boxSizing: "border-box",
  background: T.cardBg,
};

export function DdfToolbar(props: Props) {
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);
  const activeFilterChips = useMemo(
    () =>
      [
        props.dateFilter
          ? { label: `Date: ${props.dateFilter}`, onClear: () => props.onDateFilterChange("") }
          : null,
        props.dateFromFilter
          ? { label: `From: ${props.dateFromFilter}`, onClear: () => props.onDateFromFilterChange("") }
          : null,
        props.dateToFilter
          ? { label: `To: ${props.dateToFilter}`, onClear: () => props.onDateToFilterChange("") }
          : null,
        props.bufferAgentFilter !== ALL_OPTION
          ? { label: `Buffer: ${props.bufferAgentFilter}`, onClear: () => props.onBufferAgentFilterChange(ALL_OPTION) }
          : null,
        ...props.retentionAgentFilter.map((agent) => ({
          label: `Retention: ${agent}`,
          onClear: () => props.onRetentionAgentFilterChange(props.retentionAgentFilter.filter((value) => value !== agent)),
        })),
        props.licensedAgentFilter !== ALL_OPTION
          ? { label: `Licensed: ${props.licensedAgentFilter}`, onClear: () => props.onLicensedAgentFilterChange(ALL_OPTION) }
          : null,
        props.leadVendorFilter !== ALL_OPTION
          ? { label: `Vendor: ${props.leadVendorFilter}`, onClear: () => props.onLeadVendorFilterChange(ALL_OPTION) }
          : null,
        props.statusFilter !== ALL_OPTION
          ? { label: `Status: ${props.statusFilter}`, onClear: () => props.onStatusFilterChange(ALL_OPTION) }
          : null,
        props.carrierFilter !== ALL_OPTION
          ? { label: `Carrier: ${props.carrierFilter}`, onClear: () => props.onCarrierFilterChange(ALL_OPTION) }
          : null,
        props.callResultFilter !== ALL_OPTION
          ? { label: `Result: ${props.callResultFilter}`, onClear: () => props.onCallResultFilterChange(ALL_OPTION) }
          : null,
        props.retentionFilter !== ALL_OPTION
          ? { label: `Type: ${props.retentionFilter}`, onClear: () => props.onRetentionFilterChange(ALL_OPTION) }
          : null,
        props.incompleteUpdatesFilter !== ALL_OPTION
          ? { label: `Updates: ${props.incompleteUpdatesFilter}`, onClear: () => props.onIncompleteUpdatesFilterChange(ALL_OPTION) }
          : null,
        props.laCallbackFilter !== ALL_OPTION
          ? { label: `LA Callback: ${props.laCallbackFilter}`, onClear: () => props.onLaCallbackFilterChange(ALL_OPTION) }
          : null,
        props.hourFromFilter !== ALL_OPTION
          ? { label: `Hour From: ${props.hourFromFilter.padStart(2, "0")}:00`, onClear: () => props.onHourFromFilterChange(ALL_OPTION) }
          : null,
        props.hourToFilter !== ALL_OPTION
          ? { label: `Hour To: ${props.hourToFilter.padStart(2, "0")}:00`, onClear: () => props.onHourToFilterChange(ALL_OPTION) }
          : null,
      ].filter(Boolean) as Array<{ label: string; onClear: () => void }>,
    [props],
  );
  const detailedFilterCount = activeFilterChips.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          background: T.cardBg,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: "10px 16px",
          boxShadow: T.shadowSm,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260 }}>
          <div style={{ flex: 1, maxWidth: 440 }}>
            <Input
              value={props.searchTerm}
              onChange={(e) => props.onSearchTermChange(e.currentTarget.value)}
              placeholder="Search entries by name, phone, submission id, vendor..."
              style={{ height: 36 }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, whiteSpace: "nowrap" }}>
            {props.totalRows.toLocaleString()} total
          </span>
          <button
            type="button"
            onClick={() => setFilterPanelExpanded((prev) => !prev)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 34,
              padding: "0 14px",
              borderRadius: 8,
              border: filterPanelExpanded ? `1.5px solid ${T.blue}` : `1px solid ${T.border}`,
              background: filterPanelExpanded ? T.blueLight : T.pageBg,
              color: filterPanelExpanded ? T.blue : T.textDark,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: T.font,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filters
            {detailedFilterCount > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: T.blue,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {detailedFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {(filterPanelExpanded || props.hasActiveFilters) && (
        <div
          style={{
            background: T.cardBg,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: "16px 20px",
            boxShadow: T.shadowSm,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {filterPanelExpanded && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
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
                <div>
                  <FieldLabel label="Buffer Agent" />
                  <SelectInput value={props.bufferAgentFilter} onChange={(v) => props.onBufferAgentFilterChange(String(v))} options={mapOptions(props.bufferOptions)} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
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
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
                <div>
                  <FieldLabel label="Carrier" />
                  <SelectInput value={props.carrierFilter} onChange={(v) => props.onCarrierFilterChange(String(v))} options={mapOptions(props.carrierOptions)} />
                </div>
                <div>
                  <FieldLabel label="Call Result" />
                  <SelectInput value={props.callResultFilter} onChange={(v) => props.onCallResultFilterChange(String(v))} options={mapOptions(props.callResultOptions)} />
                </div>
                <div>
                  <FieldLabel label="Retention Type" />
                  <SelectInput value={props.retentionFilter} onChange={(v) => props.onRetentionFilterChange(String(v))} options={[{ value: ALL_OPTION, label: "All" }, { value: "Retention", label: "Retention" }, { value: "Regular", label: "Regular" }]} />
                </div>
                <div>
                  <FieldLabel label="Updates" />
                  <SelectInput value={props.incompleteUpdatesFilter} onChange={(v) => props.onIncompleteUpdatesFilterChange(String(v))} options={[{ value: ALL_OPTION, label: "All" }, { value: "Incomplete", label: "Incomplete" }, { value: "Complete", label: "Complete" }]} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, alignItems: "end" }}>
                <div>
                  <FieldLabel label="LA Callback" />
                  <SelectInput value={props.laCallbackFilter} onChange={(v) => props.onLaCallbackFilterChange(String(v))} options={mapOptions(props.laCallbackOptions)} />
                </div>
                <div>
                  <FieldLabel label="Hour From" />
                  <SelectInput value={props.hourFromFilter} onChange={(v) => props.onHourFromFilterChange(String(v))} options={[{ value: ALL_OPTION, label: "All" }, ...hourOptions]} />
                </div>
                <div>
                  <FieldLabel label="Hour To" />
                  <SelectInput value={props.hourToFilter} onChange={(v) => props.onHourToFilterChange(String(v))} options={[{ value: ALL_OPTION, label: "All" }, ...hourOptions]} />
                </div>
              </div>
            </div>
          )}

          {props.hasActiveFilters && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                paddingTop: filterPanelExpanded ? 16 : 0,
                borderTop: filterPanelExpanded ? `1px solid ${T.borderLight}` : "none",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Active:
                </span>
                {activeFilterChips.map((chip) => (
                  <FilterChip key={chip.label} label={chip.label} onClear={chip.onClear} />
                ))}
              </div>

              <button
                type="button"
                onClick={props.onClearFilters}
                style={{
                  background: "none",
                  border: "none",
                  color: T.blue,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: "4px 0",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.textDecoration = "underline")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.textDecoration = "none")}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
