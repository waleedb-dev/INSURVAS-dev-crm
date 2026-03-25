"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { T } from "@/lib/theme";
import { ActionMenu, Badge, Button, EmptyState, Pagination, Table } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  IconRefresh,
  IconSearch,
  IconCalendar,
  IconChevronDown,
} from "@tabler/icons-react";

type Policy = {
  id: number;
  policy_number: string | null;
  deal_name: string | null;
  policy_status: string | null;
  policy_type: string | null;
  sales_agent: string | null;
  carrier: string | null;
  call_center: string | null;
  commission_type: string | null;
  deal_value: number | null;
  effective_date: string | null;
  status: string | null;
  is_active: boolean;
  lock_status: string | null;
  created_at: string;
  updated_at: string;
};

const LOCK_COLORS: Record<string, { bg: string; color: string }> = {
  pending:  { bg: "#fffbeb", color: "#d97706" },
  locked:   { bg: "#fef2f2", color: "#ef4444" },
  unlocked: { bg: "#ecfdf5", color: "#059669" },
};

const ITEMS_PER_PAGE = 100;

// ── Shared helpers (same pattern as other pages) ──────────────────────────────
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.4, fontFamily: T.font }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function FilterSelect({ label, options, value, onChange }: { label: string; options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", border: `1.5px solid ${open ? T.blue : T.border}`, borderRadius: T.radiusSm, backgroundColor: T.cardBg, cursor: "pointer", fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, userSelect: "none", minWidth: 130, whiteSpace: "nowrap", boxShadow: open ? `0 0 0 3px ${T.blue}18` : "none", transition: "all 0.15s" }}>
        <span style={{ flex: 1 }}>{selected?.label ?? label}</span>
        <IconChevronDown size={14} style={{ color: T.textMuted, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }} />
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: "100%", backgroundColor: T.cardBg, border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, boxShadow: T.shadowMd, zIndex: 200, overflow: "hidden" }}>
          {options.map((opt) => {
            const isSel = opt.value === value;
            return (
              <div key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{ padding: "9px 14px", fontSize: 13, fontWeight: isSel ? 700 : 500, color: isSel ? T.blue : T.textMid, backgroundColor: isSel ? T.blueLight : "transparent", cursor: "pointer", fontFamily: T.font, transition: "background 0.1s" }}
                onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLDivElement).style.backgroundColor = T.rowBg; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = isSel ? T.blueLight : "transparent"; }}>
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DateInput({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <IconCalendar size={14} style={{ position: "absolute", left: 10, color: T.textMuted, pointerEvents: "none" }} />
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ padding: "8px 10px 8px 30px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontFamily: T.font, color: value ? T.textMid : T.textMuted, backgroundColor: T.cardBg, outline: "none", cursor: "pointer", minWidth: 130, transition: "border-color 0.15s" }}
        onFocus={(e) => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.blue}18`; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );
}

const ACTIVE_OPTS = [
  { label: "All Policies",   value: "all" },
  { label: "Active Only",    value: "active" },
  { label: "Inactive Only",  value: "inactive" },
];

export default function PoliciesPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("policies")
      .select("id, policy_number, deal_name, policy_status, policy_type, sales_agent, carrier, call_center, commission_type, deal_value, effective_date, status, is_active, lock_status, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) { setLoadError(error.message); setRows([]); }
    else { setRows((data || []) as Policy[]); }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void loadRows(); }, [loadRows]);
  useEffect(() => { setPage(1); }, [search, activeFilter, carrierFilter, agentFilter, typeFilter, fromDate, toDate]);

  const carrierOptions = useMemo(() => {
    const vals = [...new Set(rows.map((r) => r.carrier).filter(Boolean))] as string[];
    return [{ label: "All Carriers", value: "all" }, ...vals.map((v) => ({ label: v, value: v }))];
  }, [rows]);

  const agentOptions = useMemo(() => {
    const vals = [...new Set(rows.map((r) => r.sales_agent).filter(Boolean))] as string[];
    return [{ label: "All Agents", value: "all" }, ...vals.map((v) => ({ label: v, value: v }))];
  }, [rows]);

  const typeOptions = useMemo(() => {
    const vals = [...new Set(rows.map((r) => r.policy_type).filter(Boolean))] as string[];
    return [{ label: "All Types", value: "all" }, ...vals.map((v) => ({ label: v, value: v }))];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (q && !(
        (r.policy_number || "").toLowerCase().includes(q) ||
        (r.deal_name || "").toLowerCase().includes(q) ||
        (r.sales_agent || "").toLowerCase().includes(q) ||
        (r.carrier || "").toLowerCase().includes(q)
      )) return false;
      if (activeFilter === "active" && !r.is_active) return false;
      if (activeFilter === "inactive" && r.is_active) return false;
      if (carrierFilter !== "all" && r.carrier !== carrierFilter) return false;
      if (agentFilter !== "all" && r.sales_agent !== agentFilter) return false;
      if (typeFilter !== "all" && r.policy_type !== typeFilter) return false;
      const effDate = r.effective_date ? r.effective_date.slice(0, 10) : r.created_at.slice(0, 10);
      if (fromDate && effDate < fromDate) return false;
      if (toDate && effDate > toDate) return false;
      return true;
    });
  }, [rows, search, activeFilter, carrierFilter, agentFilter, typeFilter, fromDate, toDate]);

  const hasFilters = search !== "" || activeFilter !== "all" || carrierFilter !== "all" || agentFilter !== "all" || typeFilter !== "all" || fromDate !== "" || toDate !== "";
  const clearFilters = () => { setSearch(""); setActiveFilter("all"); setCarrierFilter("all"); setAgentFilter("all"); setTypeFilter("all"); setFromDate(""); setToDate(""); };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
    if (filtered.length === 0 && page !== 1) setPage(1);
  }, [filtered.length, page, totalPages]);

  return (
    <div onClick={() => setActiveMenu(null)} style={{ fontFamily: T.font }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.textDark }}>Policies</h1>
        <Button variant="ghost" size="sm" icon={<IconRefresh size={14} />} onClick={() => void loadRows()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loadError && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: T.radiusMd, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
          {loadError}
        </div>
      )}

      {/* Filter panel */}
      <div style={{ backgroundColor: T.cardBg, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: "16px 20px", marginBottom: 16, boxShadow: T.shadowSm }}>
        {/* Row 1 */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <FilterGroup label="Search Records">
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <IconSearch size={14} style={{ position: "absolute", left: 10, color: T.textMuted, pointerEvents: "none" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by policy #, deal name, agent…"
                style={{ padding: "8px 12px 8px 30px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontFamily: T.font, color: T.textDark, backgroundColor: T.rowBg, outline: "none", width: 260, transition: "all 0.15s" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.backgroundColor = T.cardBg; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.blue}18`; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.backgroundColor = T.rowBg; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
          </FilterGroup>

          <FilterGroup label="Active Status">
            <FilterSelect label="All Policies" options={ACTIVE_OPTS} value={activeFilter} onChange={setActiveFilter} />
          </FilterGroup>

          <FilterGroup label="Carrier">
            <FilterSelect label="All Carriers" options={carrierOptions} value={carrierFilter} onChange={setCarrierFilter} />
          </FilterGroup>

          <FilterGroup label="Agent">
            <FilterSelect label="All Agents" options={agentOptions} value={agentFilter} onChange={setAgentFilter} />
          </FilterGroup>

          <FilterGroup label="Policy Type">
            <FilterSelect label="All Types" options={typeOptions} value={typeFilter} onChange={setTypeFilter} />
          </FilterGroup>

          <div style={{ marginLeft: "auto", alignSelf: "flex-end", paddingBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.blue }}>{filtered.length.toLocaleString()}</span>
            <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}> records found</span>
          </div>
        </div>

        {/* Row 2 */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <FilterGroup label="Effective From">
            <DateInput placeholder="Start date" value={fromDate} onChange={setFromDate} />
          </FilterGroup>

          <FilterGroup label="Effective To">
            <DateInput placeholder="End date" value={toDate} onChange={setToDate} />
          </FilterGroup>

          {hasFilters && (
            <button onClick={clearFilters}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, backgroundColor: T.cardBg, color: T.textMid, fontSize: 13, fontWeight: 600, fontFamily: T.font, cursor: "pointer", transition: "all 0.15s", alignSelf: "flex-end" }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = T.danger; el.style.color = T.danger; el.style.backgroundColor = "#fef2f2"; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = T.border; el.style.color = T.textMid; el.style.backgroundColor = T.cardBg; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Table section */}
      <div style={{ backgroundColor: T.cardBg, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, boxShadow: T.shadowSm, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.textDark }}>Policy Records</h2>
          <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>
            <span style={{ fontWeight: 700, color: T.textMid }}>{filtered.length.toLocaleString()}</span> total records
            {totalPages > 1 && <> · Page <span style={{ fontWeight: 700, color: T.textMid }}>{page}</span> of <span style={{ fontWeight: 700, color: T.textMid }}>{totalPages}</span> · Showing <span style={{ fontWeight: 700, color: T.textMid }}>{paginated.length}</span> records</>}
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <Table
            data={paginated.map((r, i) => ({ ...r, _sno: (page - 1) * ITEMS_PER_PAGE + i + 1 }))}
            columns={[
              { header: "S.No", key: "_sno", width: 56,
                render: (r) => <span style={{ fontSize: 13, fontWeight: 600, color: T.textMuted }}>{(r as any)._sno}</span> },
              { header: "Policy #", key: "policy_number",
                render: (r) => <span style={{ fontSize: 12, fontWeight: 700, color: T.blue, fontFamily: "monospace" }}>{r.policy_number || "—"}</span> },
              { header: "Deal Name", key: "deal_name",
                render: (r) => <span style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>{r.deal_name || "—"}</span> },
              { header: "Agent", key: "sales_agent",
                render: (r) => <span style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>{r.sales_agent || "—"}</span> },
              { header: "Carrier", key: "carrier",
                render: (r) => r.carrier
                  ? <Badge variant="custom" label={r.carrier} bgColor={T.blueLight} color={T.blue} />
                  : <span style={{ color: T.textMuted, fontSize: 13 }}>—</span> },
              { header: "Type", key: "policy_type",
                render: (r) => <span style={{ fontSize: 12, color: T.textMid, fontWeight: 600 }}>{r.policy_type || "—"}</span> },
              { header: "Deal Value", key: "deal_value", align: "right",
                render: (r) => <span style={{ fontSize: 13, fontWeight: 800, color: T.textDark }}>{r.deal_value != null ? `$${r.deal_value.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}</span> },
              { header: "Status", key: "policy_status",
                render: (r) => r.policy_status
                  ? <Badge variant="custom" label={r.policy_status} bgColor="#f0f9ff" color="#0369a1" />
                  : <span style={{ color: T.textMuted, fontSize: 13 }}>—</span> },
              { header: "Lock", key: "lock_status",
                render: (r) => {
                  const ls = r.lock_status || "pending";
                  const lc = LOCK_COLORS[ls] ?? { bg: "#f3f4f6", color: "#6b7280" };
                  return <Badge variant="custom" label={ls.charAt(0).toUpperCase() + ls.slice(1)} bgColor={lc.bg} color={lc.color} />;
                } },
              { header: "Active", key: "is_active", align: "center",
                render: (r) => (
                  <Badge variant="custom" label={r.is_active ? "Active" : "Inactive"} bgColor={r.is_active ? "#ecfdf5" : "#f3f4f6"} color={r.is_active ? "#059669" : "#6b7280"} />
                ) },
              { header: "Effective", key: "effective_date",
                render: (r) => <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{r.effective_date ? new Date(r.effective_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}</span> },
              { header: "Actions", key: "actions", align: "center",
                render: (r) => (
                  <div onClick={(e) => e.stopPropagation()}>
                    <ActionMenu id={String(r.id)} activeId={activeMenu} onToggle={setActiveMenu}
                      items={[{ label: "View details", onClick: () => {} }]} />
                  </div>
                ) },
            ]}
          />
          {!loading && filtered.length === 0 && (
            <EmptyState title={rows.length === 0 ? "No policy records yet" : "No matching records"} description={rows.length === 0 ? "Policy records will appear here once synced." : "Try adjusting your search or filter criteria."} compact />
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end" }}>
            <Pagination page={page} totalItems={filtered.length} itemsPerPage={ITEMS_PER_PAGE} itemLabel="records" onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
