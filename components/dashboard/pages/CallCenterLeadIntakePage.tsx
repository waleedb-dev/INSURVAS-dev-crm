"use client";

import { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { DataGrid, FilterChip, Pagination, Table } from "@/components/ui";
import TransferLeadApplicationForm, { type TransferLeadFormData } from "./TransferLeadApplicationForm";

type IntakeLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  premium: number;
  type: string;
  source: string;
  pipeline: string;
  stage: string;
  createdAt: string;
};

const INITIAL_LEADS: IntakeLead[] = [
  {
    id: "TL-001",
    name: "Mason Carter",
    email: "mason.carter@example.com",
    phone: "+1 (555) 120-4567",
    premium: 1300,
    type: "Auto",
    source: "Inbound Call",
    pipeline: "Transfer Portal",
    stage: "Transfer API",
    createdAt: "Today, 09:20 AM",
  },
  {
    id: "TL-002",
    name: "Olivia Reed",
    email: "olivia.reed@example.com",
    phone: "+1 (555) 245-9911",
    premium: 2450,
    type: "Home",
    source: "Manual Entry",
    pipeline: "Transfer Portal",
    stage: "Transfer API",
    createdAt: "Today, 10:05 AM",
  },
];

export default function CallCenterLeadIntakePage({ canCreateLeads = true }: { canCreateLeads?: boolean }) {
  const [leads, setLeads] = useState<IntakeLead[]>(INITIAL_LEADS);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterSource, setFilterSource] = useState("All");
  const [page, setPage] = useState(1);
  const [showCreateLead, setShowCreateLead] = useState(false);
  const itemsPerPage = 10;

  const types = Array.from(new Set(leads.map((lead) => lead.type)));
  const sources = Array.from(new Set(leads.map((lead) => lead.source)));

  const filtered = leads.filter((lead) => {
    const matchType = filterType === "All" || lead.type === filterType;
    const matchSource = filterSource === "All" || lead.source === filterSource;
    const query = search.toLowerCase().trim();
    const matchSearch =
      !query ||
      lead.name.toLowerCase().includes(query) ||
      lead.email.toLowerCase().includes(query) ||
      lead.phone.toLowerCase().includes(query) ||
      lead.id.toLowerCase().includes(query);

    return matchType && matchSource && matchSearch;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [search, filterType, filterSource]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
    if (filtered.length === 0 && page !== 1) {
      setPage(1);
    }
  }, [filtered.length, page, totalPages]);

  const handleCreateLead = (payload: TransferLeadFormData) => {
    const nextId = `TL-${String(leads.length + 1).padStart(3, "0")}`;
    const fullName = `${payload.firstName} ${payload.lastName}`.trim();

    const createdLead: IntakeLead = {
      id: nextId,
      name: fullName,
      email: `${payload.firstName.toLowerCase()}.${payload.lastName.toLowerCase()}@example.com`,
      phone: payload.phone,
      premium: Number(payload.monthlyPremium) || 0,
      type: payload.productType || "Transfer",
      source: "Live Transfer",
      pipeline: payload.pipeline || "Transfer Portal",
      stage: payload.stage || "Transfer API",
      createdAt: "Just now",
    };

    setLeads((prev) => [createdLead, ...prev]);
    setShowCreateLead(false);
    setPage(1);
  };

  if (showCreateLead) {
    return (
      <TransferLeadApplicationForm
        onBack={() => setShowCreateLead(false)}
        onSubmit={handleCreateLead}
      />
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, margin: "0 0 4px" }}>
            Transfer workflow — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textDark, margin: 0 }}>Transfer Leads</h1>
        </div>
        <button
          onClick={() => setShowCreateLead(true)}
          disabled={!canCreateLeads}
          title={!canCreateLeads ? "Missing permission: action.transfer_leads.create" : undefined}
          style={{
            backgroundColor: canCreateLeads ? T.blue : T.border,
            color: "#fff",
            border: "none",
            borderRadius: T.radiusMd,
            padding: "10px 22px",
            fontSize: 13,
            fontWeight: 700,
            cursor: canCreateLeads ? "pointer" : "not-allowed",
            fontFamily: T.font,
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: `0 4px 12px ${T.blue}44`,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add New Lead
        </button>
      </div>

      <DataGrid
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search leads by name, phone, email, or ID..."
        filters={
          <>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}
            >
              <option value="All">All Types</option>
              {types.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, color: T.textMid, fontFamily: T.font, cursor: "pointer", backgroundColor: "transparent" }}
            >
              <option value="All">All Sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </>
        }
        activeFilters={
          (filterType !== "All" || filterSource !== "All") ? (
            <>
              {filterType !== "All" && <FilterChip label={`Type: ${filterType}`} onClear={() => setFilterType("All")} />}
              {filterSource !== "All" && <FilterChip label={`Source: ${filterSource}`} onClear={() => setFilterSource("All")} />}
            </>
          ) : null
        }
        pagination={
          <Pagination
            page={page}
            totalItems={filtered.length}
            itemsPerPage={itemsPerPage}
            itemLabel="leads"
            onPageChange={setPage}
          />
        }
      >
        <Table
          data={paginated}
          columns={[
            {
              header: "Lead ID",
              key: "id",
              render: (lead) => <span style={{ fontSize: 12, fontWeight: 700, color: T.blue }}>{lead.id}</span>,
            },
            {
              header: "Name",
              key: "name",
              render: (lead) => <span style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>{lead.name}</span>,
            },
            {
              header: "Contact",
              key: "email",
              render: (lead) => (
                <div>
                  <div style={{ fontSize: 12, color: T.textDark, fontWeight: 700 }}>{lead.phone}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{lead.email}</div>
                </div>
              ),
            },
            {
              header: "Type",
              key: "type",
              render: (lead) => <span style={{ fontSize: 12, color: T.textMid, fontWeight: 700 }}>{lead.type}</span>,
            },
            {
              header: "Pipeline",
              key: "pipeline",
              render: (lead) => (
                <div>
                  <div style={{ fontSize: 12, color: T.textDark, fontWeight: 700 }}>{lead.pipeline}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{lead.stage}</div>
                </div>
              ),
            },
            {
              header: "Premium",
              key: "premium",
              render: (lead) => <span style={{ fontSize: 12, color: T.textDark, fontWeight: 800 }}>${lead.premium.toLocaleString()}</span>,
            },
            {
              header: "Created",
              key: "createdAt",
              render: (lead) => <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{lead.createdAt}</span>,
            },
          ]}
        />
      </DataGrid>
    </div>
  );
}
