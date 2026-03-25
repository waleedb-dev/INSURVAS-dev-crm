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
  paid:     { bg: "#eff6ff", color: "#4285f4" },
  rejected: { bg: "#fef2f2", color: "#ef4444" },
};

const ITEMS_PER_PAGE = 100;

// ── Shared small helpers (same as DailyDealFlowPage) ──────────────────────────
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

function FilterSelect({
  label, options, value, onChange,
}: { label: string; options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
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
              <div key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }} style={{ padding: "9px 14px", fontSize: 13, fontWeight: isSel ? 700 : 500, color: isSel ? T.blue : T.textMid, backgroundColor: isSel ? T.blueLight : "transparent", cursor: "pointer", fontFamily: T.font, transition: "background 0.1s" }}
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

const STATUS_OPTS = [
  { label: "All Statuses", value: "all" },
  { label: "Pending",      value: "pending" },
  { label: "Approved",     value: "approved" },
  { label: "Paid",         value: "paid" },
  { label: "Rejected",     value: "rejected" },
];

export default function CommissionsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
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
    return [{ label: "All Types", value: "all" }, ...types.map((t) => ({ label: t, value: t }))];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (q && !(
        r.policy_number.toLowerCase().includes(q) ||
        (r.sales_agent_name || "").toLowerCase().includes(q) ||
        (r.writing_no || "").toLowerCase().includes(q)
      )) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.commission_type !== typeFilter) return false;
      const earnedDate = r.earned_at ? r.earned_at.slice(0, 10) : r.created_at.slice(0, 10);
      if (fromDate && earnedDate < fromDate) return false;
      if (toDate && earnedDate > toDate) return false;
      return true;
    });
  }, [rows, search, statusFilter, typeFilter, fromDate, toDate]);

  const hasFilters = search !== "" || statusFilter !== "all" || typeFilter !== "all" || fromDate !== "" || toDate !== "";
  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setTypeFilter("all"); setFromDate(""); setToDate(""); };

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
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.textDark }}>Commissions</h1>
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
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by policy, agent, writing no…"
                style={{ padding: "8px 12px 8px 30px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontFamily: T.font, color: T.textDark, backgroundColor: T.rowBg, outline: "none", width: 260, transition: "all 0.15s" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.backgroundColor = T.cardBg; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.blue}18`; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.backgroundColor = T.rowBg; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
          </FilterGroup>

          <FilterGroup label="Status">
            <FilterSelect label="All Statuses" options={STATUS_OPTS} value={statusFilter} onChange={setStatusFilter} />
          </FilterGroup>

          <FilterGroup label="Commission Type">
            <FilterSelect label="All Types" options={typeOptions} value={typeFilter} onChange={setTypeFilter} />
          </FilterGroup>

          <FilterGroup label="From Date">
            <DateInput placeholder="Start date" value={fromDate} onChange={setFromDate} />
          </FilterGroup>

          <FilterGroup label="To Date">
            <DateInput placeholder="End date" value={toDate} onChange={setToDate} />
          </FilterGroup>

          <div style={{ marginLeft: "auto", alignSelf: "flex-end", paddingBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.blue }}>{filtered.length.toLocaleString()}</span>
            <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}> records found</span>
          </div>
        </div>

        {/* Row 2: clear */}
        {hasFilters && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={clearFilters}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, backgroundColor: T.cardBg, color: T.textMid, fontSize: 13, fontWeight: 600, fontFamily: T.font, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = T.danger; el.style.color = T.danger; el.style.backgroundColor = "#fef2f2"; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = T.border; el.style.color = T.textMid; el.style.backgroundColor = T.cardBg; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              Clear Filters
            </button>
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
                  const sc = STATUS_COLORS[r.status] ?? { bg: "#f3f4f6", color: "#6b7280" };
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
