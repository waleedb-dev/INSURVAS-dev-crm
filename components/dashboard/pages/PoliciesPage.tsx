"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { ActionMenu, Badge, Button, EmptyState, Input, Pagination, Table } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { IconRefresh } from "@tabler/icons-react";
import { FieldLabel, SelectInput } from "./daily-deal-flow/ui-primitives";
import { ALL_OPTION } from "./daily-deal-flow/constants";

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
  locked:   { bg: "#fef2f2", color: "#3b5229" },
  unlocked: { bg: "#ecfdf5", color: "#059669" },
};

const ITEMS_PER_PAGE = 100;

function mapOpts(values: string[]) {
  return [{ value: ALL_OPTION, label: "All" }, ...values.map((v) => ({ value: v, label: v }))];
}

const ACTIVE_OPTS = [
  { value: ALL_OPTION, label: "All" },
  { value: "active",   label: "Active Only" },
  { value: "inactive", label: "Inactive Only" },
];

export default function PoliciesPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState(ALL_OPTION);
  const [carrierFilter, setCarrierFilter] = useState(ALL_OPTION);
  const [agentFilter, setAgentFilter] = useState(ALL_OPTION);
  const [typeFilter, setTypeFilter] = useState(ALL_OPTION);
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
    return mapOpts(vals);
  }, [rows]);

  const agentOptions = useMemo(() => {
    const vals = [...new Set(rows.map((r) => r.sales_agent).filter(Boolean))] as string[];
    return mapOpts(vals);
  }, [rows]);

  const typeOptions = useMemo(() => {
    const vals = [...new Set(rows.map((r) => r.policy_type).filter(Boolean))] as string[];
    return mapOpts(vals);
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
      if (carrierFilter !== ALL_OPTION && r.carrier !== carrierFilter) return false;
      if (agentFilter !== ALL_OPTION && r.sales_agent !== agentFilter) return false;
      if (typeFilter !== ALL_OPTION && r.policy_type !== typeFilter) return false;
      const effDate = r.effective_date ? r.effective_date.slice(0, 10) : r.created_at.slice(0, 10);
      if (fromDate && effDate < fromDate) return false;
      if (toDate && effDate > toDate) return false;
      return true;
    });
  }, [rows, search, activeFilter, carrierFilter, agentFilter, typeFilter, fromDate, toDate]);

  const hasFilters = search !== "" || activeFilter !== ALL_OPTION || carrierFilter !== ALL_OPTION || agentFilter !== ALL_OPTION || typeFilter !== ALL_OPTION || fromDate !== "" || toDate !== "";
  const clearFilters = () => { setSearch(""); setActiveFilter(ALL_OPTION); setCarrierFilter(ALL_OPTION); setAgentFilter(ALL_OPTION); setTypeFilter(ALL_OPTION); setFromDate(""); setToDate(""); };

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
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.textDark }}>Policies</h1>
          <p style={{ margin: "4px 0 0", color: T.textMuted, fontSize: 13 }}>View and filter policy records.</p>
        </div>
        <Button variant="ghost" size="sm" icon={<IconRefresh size={14} />} onClick={() => void loadRows()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loadError && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: T.radiusMd, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
          {loadError}
        </div>
      )}

      {/* Filter panel — same structure as DdfToolbar */}
      <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, boxShadow: T.shadowSm, display: "grid", gap: 12, marginBottom: 16 }}>
        {/* Row 1: search + dates */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 1fr))", gap: 12 }}>
          <div style={{ gridColumn: "span 2" }}>
            <FieldLabel label="Search" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              placeholder="Policy #, deal name, agent, carrier…"
            />
          </div>
          <div>
            <FieldLabel label="Effective From" />
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ width: "100%", height: 36, border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.textDark, padding: "0 8px" }} />
          </div>
          <div>
            <FieldLabel label="Effective To" />
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ width: "100%", height: 36, border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.textDark, padding: "0 8px" }} />
          </div>
        </div>

        {/* Row 2: dropdowns */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <div>
            <FieldLabel label="Active Status" />
            <SelectInput value={activeFilter} onChange={(v) => setActiveFilter(String(v))} options={ACTIVE_OPTS} />
          </div>
          <div>
            <FieldLabel label="Carrier" />
            <SelectInput value={carrierFilter} onChange={(v) => setCarrierFilter(String(v))} options={carrierOptions} />
          </div>
          <div>
            <FieldLabel label="Agent" />
            <SelectInput value={agentFilter} onChange={(v) => setAgentFilter(String(v))} options={agentOptions} />
          </div>
          <div>
            <FieldLabel label="Policy Type" />
            <SelectInput value={typeFilter} onChange={(v) => setTypeFilter(String(v))} options={typeOptions} />
          </div>
        </div>

        {/* Footer: row count + clear */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{filtered.length.toLocaleString()} rows</div>
          {hasFilters && (
            <button onClick={clearFilters}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, backgroundColor: T.cardBg, color: T.textMid, fontSize: 12, fontWeight: 600, fontFamily: T.font, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = "#3b5229"; el.style.color = "#3b5229"; el.style.backgroundColor = "#fef2f2"; }}
              onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = T.border; el.style.color = T.textMid; el.style.backgroundColor = T.cardBg; }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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
                  const lc = LOCK_COLORS[ls] ?? { bg: "#f3f4f6", color: "#6b7a5f" };
                  return <Badge variant="custom" label={ls.charAt(0).toUpperCase() + ls.slice(1)} bgColor={lc.bg} color={lc.color} />;
                } },
              { header: "Active", key: "is_active", align: "center",
                render: (r) => (
                  <Badge variant="custom" label={r.is_active ? "Active" : "Inactive"} bgColor={r.is_active ? "#ecfdf5" : "#f3f4f6"} color={r.is_active ? "#059669" : "#6b7a5f"} />
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
