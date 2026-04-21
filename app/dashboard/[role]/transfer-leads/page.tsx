"use client";

import { useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { T } from "@/lib/theme";
import { DataGrid, FilterChip } from "@/components/ui/DataGrid";
import { Table } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import CreateLeadModal from "@/components/dashboard/pages/CreateLeadModal";
import { 
  Users, 
  Clock, 
  CheckCircle, 
  ArrowLeftRight,
  Filter,
  Plus,
} from "lucide-react";

interface Lead {
  id: string;
  dealId: string;
  customerName: string;
  phone: string;
  status: "pending" | "in-progress" | "completed" | "rejected";
  agent: string;
  carrier: string;
  createdAt: string;
  transferredBy: string;
}

const INSURVAS_PRIMARY = "#233217";
const INSURVAS_TEXT_SECONDARY = "#647864";

const mockLeads: Lead[] = [
  { id: "LD-001", dealId: "DL-2024-001", customerName: "Sarah Johnson", phone: "(555) 123-4567", status: "pending", agent: "Mike T.", carrier: "AIG", createdAt: "2 hours ago", transferredBy: "John D." },
  { id: "LD-002", dealId: "DL-2024-002", customerName: "Robert Williams", phone: "(555) 234-5678", status: "in-progress", agent: "Sarah M.", carrier: "State Farm", createdAt: "4 hours ago", transferredBy: "Emily R." },
  { id: "LD-003", dealId: "DL-2024-003", customerName: "Maria Garcia", phone: "(555) 345-6789", status: "completed", agent: "Mike T.", carrier: "GEICO", createdAt: "6 hours ago", transferredBy: "John D." },
  { id: "LD-004", dealId: "DL-2024-004", customerName: "James Brown", phone: "(555) 456-7890", status: "rejected", agent: "Sarah M.", carrier: "Progressive", createdAt: "1 day ago", transferredBy: "Emily R." },
  { id: "LD-005", dealId: "DL-2024-005", customerName: "Linda Davis", phone: "(555) 567-8901", status: "pending", agent: "Mike T.", carrier: "Allstate", createdAt: "1 day ago", transferredBy: "John D." },
  { id: "LD-006", dealId: "DL-2024-006", customerName: "Michael Wilson", phone: "(555) 678-9012", status: "in-progress", agent: "Sarah M.", carrier: "Liberty Mutual", createdAt: "2 days ago", transferredBy: "Emily R." },
  { id: "LD-007", dealId: "DL-2024-007", customerName: "Patricia Moore", phone: "(555) 789-0123", status: "pending", agent: "Mike T.", carrier: "Farmers", createdAt: "2 days ago", transferredBy: "John D." },
  { id: "LD-008", dealId: "DL-2024-008", customerName: "Christopher Taylor", phone: "(555) 890-1234", status: "completed", agent: "Sarah M.", carrier: "Nationwide", createdAt: "3 days ago", transferredBy: "Emily R." },
];

const statusColors: Record<Lead["status"], { bg: string; text: string; label: string }> = {
  "pending": { bg: "#FEF3C7", text: "#92400E", label: "Pending" },
  "in-progress": { bg: "#DBEAFE", text: "#1E40AF", label: "In Progress" },
  "completed": { bg: "#D1FAE5", text: "#065F46", label: "Completed" },
  "rejected": { bg: "#FEE2E2", text: "#991B1B", label: "Rejected" },
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
}

function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        padding: "20px 24px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        transition: "all 0.15s ease-in-out",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = T.shadowMd;
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ 
          fontSize: 12, 
          fontWeight: 600, 
          color: INSURVAS_TEXT_SECONDARY, 
          margin: "0 0 8px 0",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          {label}
        </p>
        <p style={{ 
          fontSize: 32, 
          fontWeight: 800, 
          color: INSURVAS_PRIMARY, 
          margin: "0 0 4px 0",
          lineHeight: 1.1,
        }}>
          {value}
        </p>
        {trend && (
          <p style={{ 
            fontSize: 12, 
            fontWeight: 500, 
            color: "#059669", 
            margin: 0,
          }}>
            {trend}
          </p>
        )}
      </div>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: "#EEF5EE",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: INSURVAS_PRIMARY,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    </div>
  );
}

export default function TransferLeadsPage() {
  const router = useRouter();
  const params = useParams<{ role?: string }>();
  const role = Array.isArray(params?.role) ? params.role[0] : params?.role || "agent";

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<Lead["status"] | "all">("all");
  const [createLeadModalOpen, setCreateLeadModalOpen] = useState(false);
  const itemsPerPage = 5;

  const stats = useMemo(() => ({
    total: mockLeads.length,
    pending: mockLeads.filter(l => l.status === "pending").length,
    inProgress: mockLeads.filter(l => l.status === "in-progress").length,
    completed: mockLeads.filter(l => l.status === "completed").length,
  }), []);

  const filteredLeads = useMemo(() => {
    return mockLeads.filter((lead) => {
      const matchesSearch = search === "" || 
        lead.customerName.toLowerCase().includes(search.toLowerCase()) ||
        lead.dealId.toLowerCase().includes(search.toLowerCase()) ||
        lead.phone.includes(search);
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const paginatedLeads = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredLeads.slice(start, start + itemsPerPage);
  }, [filteredLeads, page]);

  const handleDealIdClick = (dealId: string) => {
    router.push(`/dashboard/${role}/transfer-leads/${dealId}`);
  };

  const columns = [
    {
      key: "id",
      header: "Lead ID",
      width: 100,
      render: (lead: Lead) => (
        <span style={{ fontWeight: 700, color: INSURVAS_PRIMARY }}>{lead.id}</span>
      ),
    },
    {
      key: "dealId",
      header: "Deal ID",
      width: 130,
      render: (lead: Lead) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDealIdClick(lead.dealId);
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontWeight: 500,
            color: T.blue,
            fontSize: 13,
            textDecoration: "underline",
            textUnderlineOffset: 2,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.blueHover; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.blue; }}
        >
          {lead.dealId}
        </button>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      width: 160,
      render: (lead: Lead) => <span style={{ fontWeight: 500 }}>{lead.customerName}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      width: 140,
      render: (lead: Lead) => <span style={{ color: INSURVAS_TEXT_SECONDARY }}>{lead.phone}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: 120,
      render: (lead: Lead) => {
        const status = statusColors[lead.status];
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              backgroundColor: status.bg,
              color: status.text,
            }}
          >
            {status.label}
          </span>
        );
      },
    },
    {
      key: "carrier",
      header: "Carrier",
      width: 120,
      render: (lead: Lead) => <span style={{ color: INSURVAS_TEXT_SECONDARY }}>{lead.carrier}</span>,
    },
    {
      key: "agent",
      header: "Agent",
      width: 100,
      render: (lead: Lead) => <span style={{ color: INSURVAS_TEXT_SECONDARY }}>{lead.agent}</span>,
    },
    {
      key: "transferredBy",
      header: "Transferred By",
      width: 120,
      render: (lead: Lead) => <span style={{ color: INSURVAS_TEXT_SECONDARY }}>{lead.transferredBy}</span>,
    },
    {
      key: "createdAt",
      header: "Created",
      width: 100,
      render: (lead: Lead) => <span style={{ color: INSURVAS_TEXT_SECONDARY, fontSize: 12 }}>{lead.createdAt}</span>,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, height: "100%" }}>
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ 
            fontSize: 24, 
            fontWeight: 800, 
            color: INSURVAS_PRIMARY, 
            margin: 0,
            lineHeight: 1.2,
          }}>
            Transfer Leads
          </h1>
          <p style={{ 
            fontSize: 14, 
            color: INSURVAS_TEXT_SECONDARY, 
            margin: "4px 0 0 0",
          }}>
            Manage and track lead transfers across your team
          </p>
        </div>
        <button
          onClick={() => setCreateLeadModalOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            backgroundColor: INSURVAS_PRIMARY,
            color: "white",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: T.font,
            cursor: "pointer",
            transition: "all 0.15s ease-in-out",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#1a2616"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = INSURVAS_PRIMARY; }}
          onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.98)"; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
        >
          <Plus size={18} /> Add New Lead
        </button>
      </div>

      <CreateLeadModal
        open={createLeadModalOpen}
        onClose={() => setCreateLeadModalOpen(false)}
        onSuccess={() => {
          setPage(1);
        }}
      />

      {/* Stats Cards */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(4, 1fr)", 
        gap: 20,
      }}>
        <StatCard 
          label="Total Leads" 
          value={stats.total} 
          icon={<Users size={24} />}
          trend="+12% from last week"
        />
        <StatCard 
          label="Pending Transfer" 
          value={stats.pending} 
          icon={<Clock size={24} />}
        />
        <StatCard 
          label="In Progress" 
          value={stats.inProgress} 
          icon={<ArrowLeftRight size={24} />}
        />
        <StatCard 
          label="Completed Today" 
          value={stats.completed} 
          icon={<CheckCircle size={24} />}
        />
      </div>

      {/* Data Grid */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          search={search}
          onSearchChange={(val) => { setSearch(val); setPage(1); }}
          searchPlaceholder="Search by customer, deal ID, or phone..."
          headerActions={
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 40,
                padding: "0 16px",
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                backgroundColor: "white",
                color: INSURVAS_PRIMARY,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: T.font,
                cursor: "pointer",
                transition: "all 0.15s ease-in-out",
              }}
              onMouseEnter={(e) => { 
                const el = e.currentTarget as HTMLElement;
                el.style.backgroundColor = "#EEF5EE";
                el.style.borderColor = INSURVAS_PRIMARY;
              }}
              onMouseLeave={(e) => { 
                const el = e.currentTarget as HTMLElement;
                el.style.backgroundColor = "white";
                el.style.borderColor = T.border;
              }}
            >
              <Filter size={16} /> Export
            </button>
          }
          filters={
            <>
              {(["all", "pending", "in-progress", "completed", "rejected"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: statusFilter === status ? `1.5px solid ${INSURVAS_PRIMARY}` : `1px solid ${T.border}`,
                    backgroundColor: statusFilter === status ? "#EEF5EE" : "white",
                    color: statusFilter === status ? INSURVAS_PRIMARY : INSURVAS_TEXT_SECONDARY,
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: T.font,
                    cursor: "pointer",
                    transition: "all 0.15s ease-in-out",
                  }}
                >
                  {status === "all" ? "All Status" : statusColors[status]?.label || status}
                </button>
              ))}
            </>
          }
          activeFilters={
            statusFilter !== "all" ? (
              <FilterChip 
                label={statusColors[statusFilter]?.label || statusFilter} 
                onClear={() => setStatusFilter("all")} 
              />
            ) : undefined
          }
          pagination={
            <Pagination
              page={page}
              totalItems={filteredLeads.length}
              itemsPerPage={itemsPerPage}
              itemLabel="leads"
              onPageChange={setPage}
            />
          }
          style={{ flex: 1, height: "100%" }}
        >
          <Table
            columns={columns}
            data={paginatedLeads}
            onRowClick={(lead) => handleDealIdClick(lead.dealId)}
            viewportHeight="calc(100vh - 420px)"
            containerStyle={{ minHeight: 400 }}
          />
        </DataGrid>
      </div>
    </div>
  );
}
