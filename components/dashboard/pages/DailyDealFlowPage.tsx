"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { T } from "@/lib/theme";
import { Button, EmptyState, Pagination, Table } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentUserPrimaryRole } from "@/lib/auth/user-role";
import type { RoleKey } from "@/lib/auth/roles";
import {
  IconRefresh,
  IconSearch,
  IconCalendar,
  IconChevronDown,
} from "@tabler/icons-react";

type DailyDealRow = {
  id: string;
  date: string;
  created_at: string;
  submission_id: string;
  client_phone_number: string | null;
  insured_name: string | null;
  lead_vendor: string | null;
  buffer_agent: string | null;
  retention_agent: string | null;
  agent: string | null;
  licensed_agent_account: string | null;
  status: string | null;
  call_result: string | null;
  carrier: string | null;
  product_type: string | null;
  draft_date: string | null;
  monthly_premium: number | null;
  face_amount: number | null;
  la_callback: string | null;
  notes: string | null;
};

/** Roles that see all centers (org-wide Daily Deal Flow). */
const DDF_GLOBAL_ROLES: readonly RoleKey[] = [
  "system_admin",
  "sales_manager",
  "sales_agent_licensed",
  "sales_agent_unlicensed",
  "hr",
  "accounting",
];

function isCallCenterScopedRole(role: RoleKey | null): role is "call_center_admin" | "call_center_agent" {
  return role === "call_center_admin" || role === "call_center_agent";
}

// ─── Tiny inline filter dropdown (label + chevron) ───────────────────────────
function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          border: `1.5px solid ${open ? T.blue : T.border}`,
          borderRadius: T.radiusSm,
          backgroundColor: T.cardBg,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          color: T.textMid,
          fontFamily: T.font,
          userSelect: "none",
          minWidth: 120,
          whiteSpace: "nowrap",
          boxShadow: open ? `0 0 0 3px ${T.blue}18` : "none",
          transition: "all 0.15s",
        }}
      >
        <span style={{ flex: 1 }}>{selected?.label ?? label}</span>
        <IconChevronDown
          size={14}
          style={{
            color: T.textMuted,
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        />
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: "100%",
            backgroundColor: T.cardBg,
            border: `1.5px solid ${T.border}`,
            borderRadius: T.radiusMd,
            boxShadow: T.shadowMd,
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          {options.map((opt) => {
            const isSel = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  padding: "9px 14px",
                  fontSize: 13,
                  fontWeight: isSel ? 700 : 500,
                  color: isSel ? T.blue : T.textMid,
                  backgroundColor: isSel ? T.blueLight : "transparent",
                  cursor: "pointer",
                  fontFamily: T.font,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLDivElement).style.backgroundColor = T.rowBg; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = isSel ? T.blueLight : "transparent"; }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tiny date input ──────────────────────────────────────────────────────────
function DateInput({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <IconCalendar size={14} style={{ position: "absolute", left: 10, color: T.textMuted, pointerEvents: "none" }} />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: "8px 10px 8px 30px",
          border: `1.5px solid ${T.border}`,
          borderRadius: T.radiusSm,
          fontSize: 13,
          fontFamily: T.font,
          color: value ? T.textMid : T.textMuted,
          backgroundColor: T.cardBg,
          outline: "none",
          cursor: "pointer",
          minWidth: 130,
          transition: "border-color 0.15s",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.blue}18`; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );
}

// ─── Filter label wrapper ─────────────────────────────────────────────────────
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

// ─── Constants ────────────────────────────────────────────────────────────────
const DATE_FILTER_OPTS = [
  { label: "All dates", value: "all" },
  { label: "Today", value: "today" },
  { label: "This week", value: "week" },
  { label: "This month", value: "month" },
];

const ITEMS_PER_PAGE = 100;

export default function DailyDealFlowPage({ canProcessActions: _canProcessActions = true }: { canProcessActions?: boolean }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [rows, setRows] = useState<DailyDealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scopeHint, setScopeHint] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [centerFilter, setCenterFilter] = useState("all");

  const [page, setPage] = useState(1);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setScopeHint(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      setRows([]);
      setLoadError("Not signed in.");
      setLoading(false);
      return;
    }

    const role = await getCurrentUserPrimaryRole(supabase, session.user.id);
    let q = supabase
      .from("daily_deal_flow")
      .select("id, date, created_at, submission_id, client_phone_number, lead_vendor, insured_name, buffer_agent, retention_agent, agent, licensed_agent_account, status, call_result, carrier, product_type, draft_date, monthly_premium, face_amount, la_callback, notes")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (role && isCallCenterScopedRole(role)) {
      setScopeHint("Scoped by role policies.");
    } else if (role && DDF_GLOBAL_ROLES.includes(role)) {
      setScopeHint("Organization-wide — all centers.");
    } else {
      setScopeHint(null);
    }

    const { data, error } = await q;
    if (error) {
      setLoadError(error.message);
      setRows([]);
    } else {
      const baseRows = ((data || []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id || ""),
        date: String(row.date || ""),
        created_at: String(row.created_at || ""),
        submission_id: String(row.submission_id || ""),
        client_phone_number: typeof row.client_phone_number === "string" ? row.client_phone_number : null,
        insured_name: typeof row.insured_name === "string" ? row.insured_name : null,
        lead_vendor: typeof row.lead_vendor === "string" ? row.lead_vendor : null,
        buffer_agent: typeof row.buffer_agent === "string" ? row.buffer_agent : null,
        retention_agent: typeof row.retention_agent === "string" ? row.retention_agent : null,
        agent: typeof row.agent === "string" ? row.agent : null,
        licensed_agent_account: typeof row.licensed_agent_account === "string" ? row.licensed_agent_account : null,
        status: typeof row.status === "string" ? row.status : null,
        call_result: typeof row.call_result === "string" ? row.call_result : null,
        carrier: typeof row.carrier === "string" ? row.carrier : null,
        product_type: typeof row.product_type === "string" ? row.product_type : null,
        draft_date: typeof row.draft_date === "string" ? row.draft_date : null,
        monthly_premium: typeof row.monthly_premium === "number" ? row.monthly_premium : null,
        face_amount: typeof row.face_amount === "number" ? row.face_amount : null,
        la_callback: typeof row.la_callback === "string" ? row.la_callback : null,
        notes: typeof row.notes === "string" ? row.notes : null,
      }));
      setRows(baseRows);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void loadRows(); }, [loadRows]);
  useEffect(() => { setPage(1); }, [search, dateFilter, fromDate, toDate, centerFilter]);

  // ── Centers list (derived) ──────────────────────────────────────────────────
  const centerOptions = useMemo(() => {
    const names = [...new Set(rows.map((r) => r.lead_vendor).filter(Boolean))] as string[];
    return [{ label: "All Centers", value: "all" }, ...names.map((n) => ({ label: n, value: n }))];
  }, [rows]);

  // ── Filtering ───────────────────────────────────────────────────────────────
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);

    return rows.filter((r) => {
      if (q && !(
        (r.insured_name || "").toLowerCase().includes(q) ||
        r.submission_id.toLowerCase().includes(q) ||
        (r.lead_vendor || "").toLowerCase().includes(q) ||
        (r.client_phone_number || "").toLowerCase().includes(q) ||
        (r.status || "").toLowerCase().includes(q) ||
        (r.call_result || "").toLowerCase().includes(q) ||
        (r.carrier || "").toLowerCase().includes(q) ||
        (r.product_type || "").toLowerCase().includes(q) ||
        r.date.includes(q)
      )) return false;

      if (dateFilter === "today" && r.date !== todayStr) return false;
      if (dateFilter === "week" && new Date(r.date) < weekAgo) return false;
      if (dateFilter === "month" && new Date(r.date) < monthAgo) return false;
      if (fromDate && r.date < fromDate) return false;
      if (toDate && r.date > toDate) return false;
      if (centerFilter !== "all" && r.lead_vendor !== centerFilter) return false;

      return true;
    });
  }, [rows, search, dateFilter, fromDate, toDate, centerFilter, todayStr]);

  const hasFilters = search !== "" || dateFilter !== "all" || fromDate !== "" || toDate !== "" || centerFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setDateFilter("all");
    setFromDate("");
    setToDate("");
    setCenterFilter("all");
  };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
    if (filtered.length === 0 && page !== 1) setPage(1);
  }, [filtered.length, page, totalPages]);

  return (
    <div style={{ fontFamily: T.font }}>

      {/* ── Top bar: title + subtext + actions ────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
        gap: 16,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.textDark }}>Daily Deal Flow</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<IconRefresh size={14} />}
            onClick={() => void loadRows()}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {loadError && (
        <div style={{
          marginBottom: 16,
          padding: "12px 16px",
          borderRadius: T.radiusMd,
          background: "#fef2f2",
          color: "#b91c1c",
          fontSize: 13,
          fontWeight: 600,
        }}>
          {loadError} — Run the SQL migration <code style={{ fontSize: 12 }}>sql/daily_deal_flow.sql</code> in Supabase if the table is missing.
        </div>
      )}

      {/* ── Filter panel ─────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: T.cardBg,
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusLg,
        padding: "16px 20px",
        marginBottom: 16,
        boxShadow: T.shadowSm,
      }}>
        {/* Row 1: search + date filters */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          {/* Search */}
          <FilterGroup label="Search Records">
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <IconSearch size={14} style={{ position: "absolute", left: 10, color: T.textMuted, pointerEvents: "none" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, id, center, date…"
                style={{
                  padding: "8px 12px 8px 30px",
                  border: `1.5px solid ${T.border}`,
                  borderRadius: T.radiusSm,
                  fontSize: 13,
                  fontFamily: T.font,
                  color: T.textDark,
                  backgroundColor: T.rowBg,
                  outline: "none",
                  width: 240,
                  transition: "all 0.15s",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.backgroundColor = T.cardBg; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.blue}18`; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.backgroundColor = T.rowBg; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
          </FilterGroup>

          <FilterGroup label="Filter by Date">
            <FilterSelect
              label="All dates"
              options={DATE_FILTER_OPTS}
              value={dateFilter}
              onChange={setDateFilter}
            />
          </FilterGroup>

          <FilterGroup label="From Date">
            <DateInput placeholder="Select start date" value={fromDate} onChange={setFromDate} />
          </FilterGroup>

          <FilterGroup label="To Date">
            <DateInput placeholder="Select end date" value={toDate} onChange={setToDate} />
          </FilterGroup>

          {/* record count */}
          <div style={{ marginLeft: "auto", alignSelf: "flex-end", paddingBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.blue }}>
              {filtered.length.toLocaleString()}
            </span>
            <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}> records found</span>
          </div>
        </div>

        {/* Row 2: center filter + clear */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <FilterGroup label="Center">
            <FilterSelect
              label="All Centers"
              options={centerOptions}
              value={centerFilter}
              onChange={setCenterFilter}
            />
          </FilterGroup>

          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                border: `1.5px solid ${T.border}`,
                borderRadius: T.radiusSm,
                backgroundColor: T.cardBg,
                color: T.textMid,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: T.font,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = T.danger;
                (e.currentTarget as HTMLButtonElement).style.color = T.danger;
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#fef2f2";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = T.border;
                (e.currentTarget as HTMLButtonElement).style.color = T.textMid;
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = T.cardBg;
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Table section ─────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: T.cardBg,
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusLg,
        boxShadow: T.shadowSm,
        overflow: "hidden",
      }}>
        {/* Section header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: `1px solid ${T.border}`,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.textDark }}>
            Deal Flow Data
          </h2>
          <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>
            <span style={{ fontWeight: 700, color: T.textMid }}>{filtered.length.toLocaleString()}</span> total records
            {totalPages > 1 && (
              <>
                {" · "}Page <span style={{ fontWeight: 700, color: T.textMid }}>{page}</span> of{" "}
                <span style={{ fontWeight: 700, color: T.textMid }}>{totalPages}</span>
                {" · "}Showing <span style={{ fontWeight: 700, color: T.textMid }}>{paginated.length}</span> records
              </>
            )}
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 2200 }}>
          <Table
            data={paginated.map((r, i) => ({ ...r, _sno: (page - 1) * ITEMS_PER_PAGE + i + 1 }))}
            columns={[
              {
                header: "S.No",
                key: "_sno",
                width: 56,
                render: (r) => (
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.textMuted }}>{(r as any)._sno}</span>
                ),
              },
              {
                header: "Date",
                key: "date",
                render: (r) => (
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.textDark }}>
                    {new Date(r.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                    <span style={{ display: "block", fontSize: 11, color: T.textMuted, fontWeight: 500 }}>
                      {new Date(r.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                ),
              },
              {
                header: "Lead Vendor",
                key: "lead_vendor",
                render: (r) => <span style={{ fontSize: 13, color: T.textDark }}>{r.lead_vendor || "—"}</span>,
              },
              {
                header: "Insured Name",
                key: "insured_name",
                render: (r) => <span style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>{r.insured_name || "—"}</span>,
              },
              {
                header: "Phone Number",
                key: "client_phone_number",
                render: (r) => <span style={{ fontSize: 13, color: T.textDark }}>{r.client_phone_number || "—"}</span>,
              },
              {
                header: "Buffer Agent",
                key: "buffer_agent",
                render: (r) => <span style={{ fontSize: 13, color: T.textDark }}>{r.buffer_agent || "—"}</span>,
              },
              {
                header: "Retention Agent",
                key: "retention_agent",
                render: (r) => <span style={{ fontSize: 13, color: T.textDark }}>{r.retention_agent || "—"}</span>,
              },
              {
                header: "Agent",
                key: "agent",
                render: (r) => <span style={{ fontSize: 13, color: T.textDark }}>{r.agent || "—"}</span>,
              },
              {
                header: "Licensed Account",
                key: "licensed_agent_account",
                render: (r) => <span style={{ fontSize: 13, color: T.textDark }}>{r.licensed_agent_account || "—"}</span>,
              },
              {
                header: "Status",
                key: "status",
                render: (r) => <span style={{ fontSize: 13, color: T.textDark }}>{r.status || "—"}</span>,
              },
              {
                header: "Call Result",
                key: "call_result",
                render: (r) => <span style={{ fontSize: 13, color: T.textDark }}>{r.call_result || "—"}</span>,
              },
              {
                header: "Carrier",
                key: "carrier",
                render: (r) => <span style={{ fontSize: 13, color: T.textDark }}>{r.carrier || "—"}</span>,
              },
              {
                header: "Product Type",
                key: "product_type",
                render: (r) => <span style={{ fontSize: 13, color: T.textDark }}>{r.product_type || "—"}</span>,
              },
              {
                header: "Draft Date",
                key: "draft_date",
                render: (r) => <span style={{ fontSize: 13, color: T.textDark }}>{r.draft_date || "—"}</span>,
              },
              {
                header: "MP",
                key: "monthly_premium",
                render: (r) => <span style={{ fontSize: 13, color: T.textDark }}>{r.monthly_premium != null ? `$${r.monthly_premium}` : "—"}</span>,
              },
              {
                header: "Face Amount",
                key: "face_amount",
                render: (r) => <span style={{ fontSize: 13, color: T.textDark }}>{r.face_amount != null ? `$${r.face_amount}` : "—"}</span>,
              },
              {
                header: "LA Callback",
                key: "la_callback",
                render: (r) => <span style={{ fontSize: 13, color: T.textDark }}>{r.la_callback || "—"}</span>,
              },
              {
                header: "Notes",
                key: "notes",
                render: (r) => <span style={{ fontSize: 13, color: T.textDark }}>{r.notes || "—"}</span>,
              },
            ]}
          />
          </div>

          {!loading && filtered.length === 0 && (
            <EmptyState
              title={rows.length === 0 ? "No daily deal entries yet" : "No matching entries"}
              description={
                rows.length === 0
                  ? "Submit a lead from Transfer Leads to populate this list."
                  : "Try adjusting your search or filter criteria."
              }
              compact
            />
          )}
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div style={{
            padding: "14px 20px",
            borderTop: `1px solid ${T.border}`,
            display: "flex",
            justifyContent: "flex-end",
          }}>
            <Pagination
              page={page}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              itemLabel="entries"
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
