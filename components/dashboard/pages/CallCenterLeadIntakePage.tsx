"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { ActionMenu, DataGrid, FilterChip, Pagination, Table, Toast } from "@/components/ui";
import TransferLeadApplicationForm, { type TransferLeadFormData } from "./TransferLeadApplicationForm";
import LeadViewComponent from "./LeadViewComponent";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type IntakeLead = {
  rowId: string;
  id: string;
  name: string;
  phone: string;
  premium: number;
  type: string;
  source: string;
  pipeline: string;
  stage: string;
  createdAt: string;
};

const FIXED_BPO_LEAD_SOURCE = "BPO Transfer Lead Source";

// ── Color maps matching the DailyDealFlow style ─────────────────────────────
const TYPE_CONFIG: Record<string, { bg: string; color: string }> = {
  "Preferred":  { bg: "#eff6ff", color: "#2563eb" },
  "Standard":   { bg: "#f0fdf4", color: "#16a34a" },
  "Graded":     { bg: "#fdf4ff", color: "#9333ea" },
  "Modified":   { bg: "#fff7ed", color: "#ea580c" },
  "GI":         { bg: "#fef9c3", color: "#ca8a04" },
  "Immediate":  { bg: "#fdf4ff", color: "#d946ef" },
  "Level":      { bg: "#f0fdf4", color: "#059669" },
  "ROP":        { bg: "#f8fafc", color: "#475569" },
  "Transfer":   { bg: "#eff6ff", color: "#2563eb" },
};

const getTypeConfig = (type: string) =>
  TYPE_CONFIG[type] ?? { bg: T.blueFaint, color: T.blue };

// Generate a consistent avatar color from a string
function stringToColor(str: string) {
  const colors = [T.blue, "#ec4899", "#8b5cf6", "#0ea5e9", "#f59e0b", "#f97316", "#14b8a6", "#64748b"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function buildLeadUniqueId(payload: TransferLeadFormData): string {
  const namePart = `${payload.firstName}${payload.lastName}`.toLowerCase().replace(/[^a-z0-9]/g, "");
  const phoneDigits = payload.phone.replace(/\D/g, "");
  const socialDigits = payload.social.replace(/\D/g, "");
  const phoneLast4 = phoneDigits.slice(-4);
  const socialLast4 = socialDigits.slice(-4);
  return `${namePart}-${phoneLast4}-${socialLast4}`;
}

export default function CallCenterLeadIntakePage({ canCreateLeads = true }: { canCreateLeads?: boolean }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [leads, setLeads] = useState<IntakeLead[]>([]);
  const [viewingLead, setViewingLead] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterSource, setFilterSource] = useState("All");
  const [page, setPage] = useState(1);
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const itemsPerPage = 10;


  const refreshLeads = async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("id, lead_unique_id, first_name, last_name, phone, lead_value, product_type, lead_source, pipeline, stage, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setToast({ message: error.message || "Failed to load leads", type: "error" });
      return;
    }

    const mapped: IntakeLead[] = (data || []).map((lead: any) => ({
      rowId: lead.id,
      id: lead.lead_unique_id || "N/A",
      name: `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "Unnamed Lead",
      phone: lead.phone || "",
      premium: Number(lead.lead_value) || 0,
      type: lead.product_type || "Transfer",
      source: lead.lead_source || "Unknown",
      pipeline: lead.pipeline || "Transfer Portal",
      stage: lead.stage || "Transfer API",
      createdAt: lead.created_at ? new Date(lead.created_at).toLocaleString() : "Just now",
    }));

    setLeads(mapped);
  };

  useEffect(() => {
    refreshLeads();
  }, [supabase]);

  const types = Array.from(new Set(leads.map((lead) => lead.type)));
  const sources = Array.from(new Set(leads.map((lead) => lead.source)));

  const filtered = leads.filter((lead) => {
    const matchType = filterType === "All" || lead.type === filterType;
    const matchSource = filterSource === "All" || lead.source === filterSource;
    const query = search.toLowerCase().trim();
    const matchSearch =
      !query ||
      lead.name.toLowerCase().includes(query) ||
      lead.phone.toLowerCase().includes(query) ||
      lead.id.toLowerCase().includes(query);
    return matchType && matchSource && matchSearch;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => { setPage(1); }, [search, filterType, filterSource]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
    if (filtered.length === 0 && page !== 1) setPage(1);
  }, [filtered.length, page, totalPages]);

  // Stats
  const totalPremium = leads.reduce((s, l) => s + l.premium, 0);
  const avgPremium = leads.length ? totalPremium / leads.length : 0;
  const uniquePipelines = new Set(leads.map((l) => l.pipeline)).size;

  const handleCreateLead = async (payload: TransferLeadFormData) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setToast({ message: "You are not logged in", type: "error" });
      return;
    }

    const leadUniqueId = payload.leadUniqueId || buildLeadUniqueId(payload);

    const { error } = await supabase.from("leads").insert({
      lead_unique_id: leadUniqueId,
      lead_value: Number(payload.leadValue || 0),
      lead_source: FIXED_BPO_LEAD_SOURCE,
      submission_date: payload.submissionDate,
      first_name: payload.firstName,
      last_name: payload.lastName,
      street1: payload.street1,
      street2: payload.street2 || null,
      city: payload.city,
      state: payload.state,
      zip_code: payload.zipCode,
      phone: payload.phone,
      birth_state: payload.birthState,
      date_of_birth: payload.dateOfBirth,
      age: payload.age,
      social: payload.social,
      driver_license_number: payload.driverLicenseNumber,
      existing_coverage_last_2_years: payload.existingCoverageLast2Years,
      previous_applications_2_years: payload.previousApplications2Years,
      height: payload.height,
      weight: payload.weight,
      doctor_name: payload.doctorName,
      tobacco_use: payload.tobaccoUse,
      health_conditions: payload.healthConditions,
      medications: payload.medications,
      monthly_premium: payload.monthlyPremium,
      coverage_amount: payload.coverageAmount,
      carrier: payload.carrier,
      product_type: payload.productType,
      draft_date: payload.draftDate,
      beneficiary_information: payload.beneficiaryInformation,
      bank_account_type: payload.bankAccountType || null,
      institution_name: payload.institutionName,
      routing_number: payload.routingNumber,
      account_number: payload.accountNumber,
      future_draft_date: payload.futureDraftDate,
      additional_information: payload.additionalInformation || null,
      pipeline: payload.pipeline || "Transfer Portal",
      stage: payload.stage || "Transfer API",
      submitted_by: session.user.id,
    });

    if (error) {
      setToast({ message: error.message || "Failed to save lead", type: "error" });
      return;
    }

    setToast({ message: "Lead saved successfully", type: "success" });
    setShowCreateLead(false);
    setPage(1);
    await refreshLeads();
  };

  if (showCreateLead) {
    return (
      <TransferLeadApplicationForm
        onBack={() => setShowCreateLead(false)}
        onSubmit={handleCreateLead}
      />
    );
  }

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
      {/* Header */}
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
            boxShadow: canCreateLeads ? `0 4px 12px ${T.blue}44` : "none",
            transition: "all 0.15s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add New Lead
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Leads", value: leads.length.toString(), color: T.blue },
          { label: "Total Premium Volume", value: `$${totalPremium.toLocaleString()}`, color: "#16a34a" },
          { label: "Avg Premium", value: `$${avgPremium.toFixed(0)}`, color: "#ca8a04" },
          { label: "Active Pipelines", value: uniquePipelines.toString(), color: "#7c3aed" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: T.cardBg, borderRadius: T.radiusLg, padding: "18px 20px", boxShadow: T.shadowSm, borderLeft: `4px solid ${color}` }}>
            <p style={{ margin: "0 0 6px", fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{label}</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color }}>{value}</p>
          </div>
        ))}
      </div>

      <DataGrid
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search leads by name, phone, source, or ID..."
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
              <button
                onClick={() => { setFilterType("All"); setFilterSource("All"); }}
                style={{ background: "none", border: "none", color: T.blue, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "4px 8px", fontFamily: T.font, marginLeft: "auto" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "underline")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "none")}
              >
                Reset All
              </button>
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
          onRowClick={(lead) => setViewingLead({ id: lead.id, name: lead.name })}
          columns={[
            {
              header: "Lead ID",
              key: "id",
              render: (lead) => (
                <span style={{ fontSize: 12, fontWeight: 700, color: T.blue, textDecoration: "underline" }}>
                  {lead.id}
                </span>
              ),
            },
            {
              header: "Client",
              key: "name",
              render: (lead) => {
                const avatarColor = stringToColor(lead.name);
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      backgroundColor: avatarColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}>
                      {getInitials(lead.name)}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.textDark }}>{lead.name}</span>
                  </div>
                );
              },
            },
            {
              header: "Contact",
              key: "phone",
              render: (lead) => (
                <div>
                  <div style={{ fontSize: 12, color: T.textDark, fontWeight: 700 }}>{lead.phone}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginTop: 2 }}>{lead.source}</div>
                </div>
              ),
            },
            {
              header: "Type",
              key: "type",
              render: (lead) => {
                const tc = getTypeConfig(lead.type);
                return (
                  <span style={{
                    backgroundColor: tc.bg,
                    color: tc.color,
                    borderRadius: 6,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}>
                    {lead.type}
                  </span>
                );
              },
            },
            {
              header: "Pipeline",
              key: "pipeline",
              render: (lead) => (
                <div>
                  <div style={{ fontSize: 12, color: T.textDark, fontWeight: 700 }}>{lead.pipeline}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginTop: 2 }}>{lead.stage}</div>
                </div>
              ),
            },
            {
              header: "Premium",
              key: "premium",
              render: (lead) => (
                <span style={{ fontSize: 13, fontWeight: 800, color: T.textDark }}>
                  ${lead.premium.toLocaleString()}
                </span>
              ),
            },
            {
              header: "Created",
              key: "createdAt",
              render: (lead) => (
                <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>
                  {lead.createdAt}
                </span>
              ),
            },
            {
              header: "Actions",
              key: "actions",
              align: "center",
              render: (lead) => (
                <div onClick={(e) => e.stopPropagation()}>
                  <ActionMenu
                    id={lead.id}
                    activeId={activeMenu}
                    onToggle={setActiveMenu}
                    items={[
                      { label: "View Details", onClick: () => setViewingLead({ id: lead.id, name: lead.name }) },
                      { label: "Delete", danger: true },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
      </DataGrid>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
