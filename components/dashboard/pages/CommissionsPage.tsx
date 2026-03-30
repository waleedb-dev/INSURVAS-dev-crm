"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { ActionMenu, Badge, Button, EmptyState, Input, Pagination, Table } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { IconRefresh } from "@tabler/icons-react";
import { FieldLabel, SelectInput } from "./daily-deal-flow/ui-primitives";
import { ALL_OPTION } from "./daily-deal-flow/constants";

type Commission = {
  id: number;
  policy_number: string;
  commission_amount: number;
  commission_rate: number | null;
  commission_type: string | null;
  sales_agent_id: string | null;
  sales_agent_name: string | null;
  writing_no: string | null;
  status: string;
  earned_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:  { bg: "#fffbeb", color: "#d97706" },
  approved: { bg: "#ecfdf5", color: "#059669" },
  paid:     { bg: "#f2f8ee", color: "#638b4b" },
  rejected: { bg: "#fef2f2", color: "#3b5229" },
};

const ITEMS_PER_PAGE = 100;

function mapOpts(values: string[]) {
  return [{ value: ALL_OPTION, label: "All" }, ...values.map((v) => ({ value: v, label: v }))];
}

const STATUS_OPTS_STATIC = ["pending", "approved", "paid", "rejected"];

export default function CommissionsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_OPTION);
  const [typeFilter, setTypeFilter] = useState(ALL_OPTION);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("commissions")
      .select("id, policy_number, commission_amount, commission_rate, commission_type, sales_agent_name, writing_no, status, earned_at, paid_at, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) { setLoadError(error.message); setRows([]); }
    else { setRows((data || []) as Commission[]); }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void loadRows(); }, [loadRows]);
  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter, fromDate, toDate]);

  const typeOptions = useMemo(() => {
    const types = [...new Set(rows.map((r) => r.commission_type).filter(Boolean))] as string[];
    return mapOpts(types);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (q && !(
        r.policy_number.toLowerCase().includes(q) ||
        (r.sales_agent_name || "").toLowerCase().includes(q) ||
        (r.writing_no || "").toLowerCase().includes(q)
      )) return false;
      if (statusFilter !== ALL_OPTION && r.status !== statusFilter) return false;
      if (typeFilter !== ALL_OPTION && r.commission_type !== typeFilter) return false;
      const earnedDate = r.earned_at ? r.earned_at.slice(0, 10) : r.created_at.slice(0, 10);
      if (fromDate && earnedDate < fromDate) return false;
      if (toDate && earnedDate > toDate) return false;
      return true;
    });
  }, [rows, search, statusFilter, typeFilter, fromDate, toDate]);

  const hasFilters = search !== "" || statusFilter !== ALL_OPTION || typeFilter !== ALL_OPTION || fromDate !== "" || toDate !== "";
  const clearFilters = () => { setSearch(""); setStatusFilter(ALL_OPTION); setTypeFilter(ALL_OPTION); setFromDate(""); setToDate(""); };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
    if (filtered.length === 0 && page !== 1) setPage(1);
  }, [filtered.length, page, totalPages]);

  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div onClick={() => setActiveMenu(null)} style={{ fontFamily: T.font }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.textDark }}>Commissions</h1>
          <p style={{ margin: "4px 0 0", color: T.textMuted, fontSize: 13 }}>View and filter commission records.</p>
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
              placeholder="Policy #, agent, writing no…"
            />
          </div>
          <div>
            <FieldLabel label="From Date" />
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ width: "100%", height: 36, border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.textDark, padding: "0 8px" }} />
          </div>
          <div>
            <FieldLabel label="To Date" />
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ width: "100%", height: 36, border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.textDark, padding: "0 8px" }} />
          </div>
        </div>

        {/* Row 2: dropdowns */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <div>
            <FieldLabel label="Status" />
            <SelectInput value={statusFilter} onChange={(v) => setStatusFilter(String(v))} options={mapOpts(STATUS_OPTS_STATIC)} />
          </div>
          <div>
            <FieldLabel label="Commission Type" />
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
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.textDark }}>Commission Records</h2>
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
                render: (r) => <span style={{ fontSize: 12, fontWeight: 700, color: T.blue, fontFamily: "monospace" }}>{r.policy_number}</span> },
              { header: "Agent", key: "sales_agent_name",
                render: (r) => <span style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>{r.sales_agent_name || "—"}</span> },
              { header: "Writing No", key: "writing_no",
                render: (r) => <span style={{ fontSize: 12, color: T.textMuted, fontFamily: "monospace" }}>{r.writing_no || "—"}</span> },
              { header: "Type", key: "commission_type",
                render: (r) => r.commission_type
                  ? <Badge variant="custom" label={r.commission_type} bgColor={T.blueLight} color={T.blue} />
                  : <span style={{ color: T.textMuted, fontSize: 13 }}>—</span> },
              { header: "Amount", key: "commission_amount", align: "right",
                render: (r) => <span style={{ fontSize: 13, fontWeight: 800, color: T.textDark }}>{fmt(r.commission_amount)}</span> },
              { header: "Rate", key: "commission_rate", align: "right",
                render: (r) => <span style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>{r.commission_rate != null ? `${r.commission_rate}%` : "—"}</span> },
              { header: "Status", key: "status",
                render: (r) => {
                  const sc = STATUS_COLORS[r.status] ?? { bg: "#f3f4f6", color: "#6b7a5f" };
                  return <Badge variant="custom" label={r.status.charAt(0).toUpperCase() + r.status.slice(1)} bgColor={sc.bg} color={sc.color} />;
                } },
              { header: "Earned At", key: "earned_at",
                render: (r) => <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{r.earned_at ? new Date(r.earned_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}</span> },
              { header: "Paid At", key: "paid_at",
                render: (r) => <span style={{ fontSize: 12, color: r.paid_at ? T.success : T.textMuted, fontWeight: 600 }}>{r.paid_at ? new Date(r.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}</span> },
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
            <EmptyState title={rows.length === 0 ? "No commission records yet" : "No matching records"} description={rows.length === 0 ? "Commission records will appear here once created." : "Try adjusting your search or filter criteria."} compact />
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
