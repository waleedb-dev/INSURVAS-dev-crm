"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { ActionMenu, Badge, Button, EmptyState, FilterChip, Input, Pagination, Table } from "@/components/ui";
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
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);

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
  const totalCommissionAmount = useMemo(
    () => filtered.reduce((sum, row) => sum + (Number(row.commission_amount) || 0), 0),
    [filtered],
  );
  const averageCommissionAmount = useMemo(
    () => (filtered.length ? totalCommissionAmount / filtered.length : 0),
    [filtered.length, totalCommissionAmount],
  );
  const paidCommissionCount = useMemo(
    () => filtered.filter((row) => row.status === "paid").length,
    [filtered],
  );
  const activeFilterChips = useMemo(
    () =>
      [
        statusFilter !== ALL_OPTION ? { label: `Status: ${statusFilter}`, onClear: () => setStatusFilter(ALL_OPTION) } : null,
        typeFilter !== ALL_OPTION ? { label: `Type: ${typeFilter}`, onClear: () => setTypeFilter(ALL_OPTION) } : null,
        fromDate !== "" ? { label: `From: ${fromDate}`, onClear: () => setFromDate("") } : null,
        toDate !== "" ? { label: `To: ${toDate}`, onClear: () => setToDate("") } : null,
      ].filter(Boolean) as Array<{ label: string; onClear: () => void }>,
    [statusFilter, typeFilter, fromDate, toDate],
  );

  return (
    <div onClick={() => setActiveMenu(null)} style={{ fontFamily: T.font }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.textDark }}>Commissions</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void loadRows()} disabled={loading}>
          <IconRefresh size={14} />
          Refresh
        </Button>
      </div>

      {loadError && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: T.radiusMd, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
          {loadError}
        </div>
      )}

      <style>{`
        @keyframes stat-card-in {
          from { opacity: 0; transform: translateY(8px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
        {[
          {
            label: "TOTAL RECORDS",
            value: filtered.length.toLocaleString(),
            color: T.blue,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>
            ),
          },
          {
            label: "TOTAL COMMISSION",
            value: fmt(totalCommissionAmount),
            color: T.memberAmber,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            ),
          },
          {
            label: "AVG COMMISSION",
            value: fmt(averageCommissionAmount),
            color: T.memberPink,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
            ),
          },
          {
            label: "PAID RECORDS",
            value: paidCommissionCount.toLocaleString(),
            color: T.memberTeal,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            ),
          },
        ].map(({ label, value, color, icon }, index) => (
          <div
            key={label}
            style={{
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              borderBottom: `4px solid ${color}`,
              background: `linear-gradient(135deg, color-mix(in srgb, ${color} 20%, ${T.cardBg}) 0%, ${T.cardBg} 80%)`,
              boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
              padding: "20px 24px",
              display: "flex",
              justifyContent: "space-between",
              animation: "stat-card-in 0.3s cubic-bezier(0.16,1,0.3,1) both",
              animationDelay: `${index * 50}ms`,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</span>
              <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            </div>
            <div style={{ color, backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, width: 54, height: 54, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {icon}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
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
          <div style={{ flex: 1, minWidth: 260, maxWidth: 440 }}>
            <Input value={search} onChange={(e) => setSearch(e.currentTarget.value)} placeholder="Search commissions by policy, agent, writing no..." />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, whiteSpace: "nowrap" }}>{filtered.length.toLocaleString()} total</span>
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
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filters
              {activeFilterChips.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: T.blue, color: "#fff", fontSize: 11, fontWeight: 800 }}>{activeFilterChips.length}</span>}
            </button>
          </div>
        </div>

        {(filterPanelExpanded || hasFilters) && (
          <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 20px", boxShadow: T.shadowSm, display: "grid", gap: 16 }}>
            {filterPanelExpanded && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 1fr))", gap: 12 }}>
                  <div>
                    <FieldLabel label="From Date" />
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ width: "100%", height: 36, border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.textDark, padding: "0 8px" }} />
                  </div>
                  <div>
                    <FieldLabel label="To Date" />
                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ width: "100%", height: 36, border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.textDark, padding: "0 8px" }} />
                  </div>
                  <div>
                    <FieldLabel label="Status" />
                    <SelectInput value={statusFilter} onChange={(v) => setStatusFilter(String(v))} options={mapOpts(STATUS_OPTS_STATIC)} />
                  </div>
                  <div>
                    <FieldLabel label="Commission Type" />
                    <SelectInput value={typeFilter} onChange={(v) => setTypeFilter(String(v))} options={typeOptions} />
                  </div>
                </div>
              </>
            )}

            {hasFilters && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingTop: filterPanelExpanded ? 16 : 0, borderTop: filterPanelExpanded ? `1px solid ${T.borderLight}` : "none" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Active:</span>
                  {activeFilterChips.map((chip) => (
                    <FilterChip key={chip.label} label={chip.label} onClear={chip.onClear} />
                  ))}
                </div>
                <button type="button" onClick={clearFilters} style={{ background: "none", border: "none", color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "4px 0" }}>
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
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
          <Pagination page={page} totalItems={filtered.length} itemsPerPage={ITEMS_PER_PAGE} itemLabel="records" onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}
