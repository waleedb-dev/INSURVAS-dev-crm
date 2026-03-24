"use client";
import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { ActionMenu, Pagination, Table, DataGrid, FilterChip, EmptyState } from "@/components/ui";
import LeadViewComponent from "./LeadViewComponent";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type DailyDealRow = {
  id: string;
  flow_date: string;
  created_at: string;
  lead_id: string;
  lead_unique_id: string | null;
  lead_name: string;
  center_name: string | null;
};

export default function DailyDealFlowPage({ canProcessActions: _canProcessActions = true }: { canProcessActions?: boolean }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<DailyDealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 12;
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [viewingLead, setViewingLead] = useState<{ id: string; name: string } | null>(null);

  const loadRows = async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("daily_deal_flow")
      .select("id, flow_date, created_at, lead_id, lead_unique_id, lead_name, center_name")
      .order("flow_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError(error.message);
      setRows([]);
    } else {
      setRows((data || []) as DailyDealRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadRows();
  }, [supabase]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const totalToday = useMemo(() => rows.filter((r) => r.flow_date === todayStr).length, [rows, todayStr]);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      r.lead_name.toLowerCase().includes(q) ||
      (r.lead_unique_id || "").toLowerCase().includes(q) ||
      (r.center_name || "").toLowerCase().includes(q) ||
      r.flow_date.includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
    if (filtered.length === 0 && page !== 1) setPage(1);
  }, [filtered.length, page, totalPages]);

  if (viewingLead) {
    return (
      <LeadViewComponent
        leadId={viewingLead.id}
        leadName={viewingLead.name}
        onBack={() => setViewingLead(null)}
      />
    );
  }

  return (
    <div onClick={() => setActiveMenu(null)}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>
            Today — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textDark, margin: 0 }}>Daily Deal Flow</h1>
          <p style={{ fontSize: 13, color: T.textMuted, margin: "8px 0 0", maxWidth: 560 }}>
            Entries appear when a lead is submitted from Transfer Leads (BPO intake). Columns: date, lead id, name, and center.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRows()}
          disabled={loading}
          style={{
            backgroundColor: T.rowBg,
            color: T.textMid,
            border: `1.5px solid ${T.border}`,
            borderRadius: T.radiusMd,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            fontFamily: T.font,
          }}
        >
          Refresh
        </button>
      </div>

      {loadError && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: T.radiusMd,
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {loadError} — Run the SQL migration <code style={{ fontSize: 12 }}>sql/daily_deal_flow.sql</code> in Supabase if the table is missing.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total entries", value: String(rows.length), color: T.blue },
          { label: "Today", value: String(totalToday), color: "#16a34a" },
          { label: "Filtered", value: String(filtered.length), color: "#7c3aed" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              backgroundColor: T.cardBg,
              borderRadius: T.radiusLg,
              padding: "18px 20px",
              boxShadow: T.shadowSm,
              borderLeft: `4px solid ${color}`,
            }}
          >
            <p style={{ margin: "0 0 6px", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{label}</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color }}>{value}</p>
          </div>
        ))}
      </div>

      <DataGrid
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, lead id, center, date…"
        filters={null}
        activeFilters={search ? <FilterChip label={`Search: ${search}`} onClear={() => setSearch("")} /> : null}
        pagination={
          <Pagination page={page} totalItems={filtered.length} itemsPerPage={itemsPerPage} itemLabel="entries" onPageChange={setPage} />
        }
      >
        <Table
          data={paginated}
          onRowClick={(r) =>
            setViewingLead({ id: r.lead_unique_id || r.lead_id, name: r.lead_name })
          }
          columns={[
            {
              header: "Date",
              key: "flow_date",
              render: (r) => (
                <span style={{ fontSize: 13, fontWeight: 600, color: T.textDark }}>
                  {r.flow_date}
                  <span style={{ display: "block", fontSize: 11, color: T.textMuted, fontWeight: 500 }}>
                    {new Date(r.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
              ),
            },
            {
              header: "Lead ID",
              key: "lead_unique_id",
              render: (r) => (
                <span style={{ fontSize: 12, fontWeight: 700, color: T.blue }}>{r.lead_unique_id || "—"}</span>
              ),
            },
            {
              header: "Name",
              key: "lead_name",
              render: (r) => <span style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>{r.lead_name}</span>,
            },
            {
              header: "Center",
              key: "center_name",
              render: (r) => (
                <span style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>{r.center_name || "—"}</span>
              ),
            },
            {
              header: "Actions",
              key: "actions",
              align: "center",
              render: (r) => (
                <div onClick={(e) => e.stopPropagation()}>
                  <ActionMenu
                    id={r.id}
                    activeId={activeMenu}
                    onToggle={setActiveMenu}
                    items={[
                      {
                        label: "View lead",
                        onClick: () => setViewingLead({ id: r.lead_unique_id || r.lead_id, name: r.lead_name }),
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
        {!loading && filtered.length === 0 && (
          <EmptyState
            title={rows.length === 0 ? "No daily deal entries yet" : "No matching entries"}
            description={
              rows.length === 0
                ? "Submit a lead from Transfer Leads to populate this list."
                : "Try a different search."
            }
            compact
          />
        )}
      </DataGrid>
    </div>
  );
}
